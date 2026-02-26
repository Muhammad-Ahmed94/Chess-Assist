const { Chess } = require("chess.js");

const PIECE_MAP = {
  wp: { type: "p", color: "w" },
  wn: { type: "n", color: "w" },
  wb: { type: "b", color: "w" },
  wr: { type: "r", color: "w" },
  wq: { type: "q", color: "w" },
  wk: { type: "k", color: "w" },
  bp: { type: "p", color: "b" },
  bn: { type: "n", color: "b" },
  bb: { type: "b", color: "b" },
  br: { type: "r", color: "b" },
  bq: { type: "q", color: "b" },
  bk: { type: "k", color: "b" },
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];

function squareNumToAlgebraic(squareNum) {
  const str = String(squareNum);
  if (str.length < 2) return null;
  const fileIdx = parseInt(str[str.length - 2], 10) - 1;
  const rankIdx = parseInt(str[str.length - 1], 10) - 1;
  if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) return null;
  return FILES[fileIdx] + RANKS[rankIdx];
}

async function scanBoardPieces(page) {
  const pieces = await page.evaluate(() => {
    const results = [];
    const pieceElements = document.querySelectorAll(".piece");

    for (const el of pieceElements) {
      const classes = Array.from(el.classList);
      let pieceType = null;
      let squareNum = null;

      for (const cls of classes) {
        if (cls.length === 2 && /^[wb][pnbrqk]$/.test(cls)) {
          pieceType = cls;
        }
        if (cls.startsWith("square-")) {
          squareNum = cls.replace("square-", "");
        }
      }

      if (pieceType && squareNum) {
        results.push({ pieceType, squareNum });
      }
    }
    return results;
  });

  return pieces
    .map(({ pieceType, squareNum }) => {
      const mapped = PIECE_MAP[pieceType];
      const square = squareNumToAlgebraic(squareNum);
      if (!mapped || !square) return null;
      return { type: mapped.type, color: mapped.color, square };
    })
    .filter(Boolean);
}

async function detectPlayerColor(page) {
  return await page.evaluate(() => {
    const board = document.querySelector("wc-chess-board, .board");
    if (board) {
      return board.classList.contains("flipped") ? "b" : "w";
    }
    return "w";
  });
}

function buildFEN(pieces, turn) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  for (const { type, color, square } of pieces) {
    const file = FILES.indexOf(square[0]);
    const rank = parseInt(square[1], 10) - 1;
    if (file < 0 || rank < 0) continue;
    const symbol = color === "w" ? type.toUpperCase() : type.toLowerCase();
    board[7 - rank][file] = symbol;
  }

  const rows = board.map((row) => {
    let fenRow = "";
    let emptyCount = 0;
    for (const cell of row) {
      if (cell === null) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          fenRow += emptyCount;
          emptyCount = 0;
        }
        fenRow += cell;
      }
    }
    if (emptyCount > 0) fenRow += emptyCount;
    return fenRow;
  });

  const position = rows.join("/");

  let castling = "";
  const has = (t, c, s) =>
    pieces.some((p) => p.type === t && p.color === c && p.square === s);
  if (has("k", "w", "e1") && has("r", "w", "h1")) castling += "K";
  if (has("k", "w", "e1") && has("r", "w", "a1")) castling += "Q";
  if (has("k", "b", "e8") && has("r", "b", "h8")) castling += "k";
  if (has("k", "b", "e8") && has("r", "b", "a8")) castling += "q";
  if (!castling) castling = "-";

  return `${position} ${turn} ${castling} - 0 1`;
}

async function getMoveList(page) {
  return await page.evaluate(() => {
    const moveElements = document.querySelectorAll(
      ".main-line-row .node .node-highlight-content, " +
        "move-list .move .text, " +
        ".play-controller-moveList .move-text-component",
    );
    const moves = [];
    for (const el of moveElements) {
      const text = el.textContent.trim();
      if (text && !/^\d+\.?$/.test(text)) {
        moves.push(text);
      }
    }
    return moves;
  });
}

async function scanBoard(page, playerColorOverride = "auto") {
  const pieces = await scanBoardPieces(page);
  const playerColor =
    playerColorOverride === "auto"
      ? await detectPlayerColor(page)
      : playerColorOverride;

  const moveList = await getMoveList(page);
  const turn = moveList.length % 2 === 0 ? "w" : "b";
  const fen = buildFEN(pieces, turn);

  return {
    fen,
    turn,
    playerColor,
    pieces,
    moveList,
    isMyTurn: turn === playerColor,
  };
}

async function waitForBoard(page, timeout = 60000) {
  await page.waitForSelector("wc-chess-board, .board", { timeout });
}

async function detectGameEnd(page) {
  return await page.evaluate(() => {
    const modalSelectors = [
      ".game-over-modal",
      ".modal-game-over-component",
      ".board-modal-container-container",
    ];

    for (const sel of modalSelectors) {
      const modal = document.querySelector(sel);
      if (modal) {
        const rect = modal.getBoundingClientRect();
        const style = window.getComputedStyle(modal);
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0";

        if (isVisible) {
          const resultText = modal.textContent || "";
          const lines = resultText
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && l.length < 120);
          return { ended: true, result: lines.slice(0, 3).join("\n") };
        }
      }
    }

    return { ended: false, result: null };
  });
}

module.exports = {
  scanBoard,
  scanBoardPieces,
  buildFEN,
  detectPlayerColor,
  waitForBoard,
  detectGameEnd,
  getMoveList,
  squareNumToAlgebraic,
};
