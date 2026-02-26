const chalk = require("chalk");
const { Chess } = require("chess.js");

const PIECE_SYMBOLS = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

const PIECE_NAMES = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

function displayBoard(fen, highlightFrom = null, highlightTo = null) {
  const chess = new Chess(fen);
  const board = chess.board();

  console.log();
  console.log(chalk.bold.cyan("  ┌────────────────────────────────┐"));

  for (let rank = 7; rank >= 0; rank--) {
    let line = chalk.bold.cyan(`${rank + 1} │`);
    for (let file = 0; file < 8; file++) {
      const square = String.fromCharCode(97 + file) + (rank + 1);
      const piece = board[7 - rank][file];
      const isLight = (rank + file) % 2 === 1;

      let cellBg = isLight ? chalk.bgHex("#F0D9B5") : chalk.bgHex("#B58863");
      let symbol = "    ";

      if (piece) {
        const fenChar =
          piece.color === "w"
            ? piece.type.toUpperCase()
            : piece.type.toLowerCase();
        symbol = ` ${PIECE_SYMBOLS[fenChar] || "?"}  `;
      }

      if (square === highlightFrom) {
        cellBg = chalk.bgHex("#FFFF00");
        if (piece) {
          const fenChar =
            piece.color === "w"
              ? piece.type.toUpperCase()
              : piece.type.toLowerCase();
          symbol = ` ${PIECE_SYMBOLS[fenChar] || "?"}  `;
        }
      } else if (square === highlightTo) {
        cellBg = chalk.bgHex("#00FF00");
        if (piece) {
          const fenChar =
            piece.color === "w"
              ? piece.type.toUpperCase()
              : piece.type.toLowerCase();
          symbol = ` ${PIECE_SYMBOLS[fenChar] || "?"}  `;
        }
      }

      line += cellBg(chalk.black(symbol));
    }
    line += chalk.bold.cyan("│");
    console.log(line);
  }

  console.log(chalk.bold.cyan("  └────────────────────────────────┘"));
  console.log(chalk.bold.cyan("    a   b   c   d   e   f   g   h  "));
  console.log();
}

function parseMoveDescription(uciMove, fen) {
  const from = uciMove.substring(0, 2);
  const to = uciMove.substring(2, 4);
  const promotion = uciMove.length > 4 ? uciMove[4] : null;

  const chess = new Chess(fen);
  let san = uciMove;
  try {
    const moveObj = chess.move({ from, to, promotion: promotion || undefined });
    if (moveObj) san = moveObj.san;
  } catch (e) {}

  const chess2 = new Chess(fen);
  const piece = chess2.get(from);
  const pieceName = piece ? PIECE_NAMES[piece.type] : "Unknown";
  const pieceSymbol = piece
    ? PIECE_SYMBOLS[
        piece.color === "w"
          ? piece.type.toUpperCase()
          : piece.type.toLowerCase()
      ]
    : "?";

  const description = `${pieceSymbol} ${pieceName} from ${from} to ${to}${
    promotion ? ` (promote to ${PIECE_NAMES[promotion] || promotion})` : ""
  }`;

  return { from, to, san, description, promotion };
}

function displayMoveSuggestion(result, fen, displayConfig = {}) {
  const {
    showCandidates = true,
    showEvaluation = true,
    showBoard = true,
  } = displayConfig;
  const moveInfo = parseMoveDescription(result.move, fen);

  console.log(chalk.bold("━".repeat(50)));
  console.log();
  console.log(chalk.bold.green("  ⚡ SUGGESTED MOVE:"));
  console.log();
  console.log(
    chalk.bold.white.bgGreen(`   ${moveInfo.san}   `) +
      "  " +
      chalk.dim(moveInfo.description),
  );
  console.log();

  if (showEvaluation) {
    console.log(chalk.bold.yellow(`  📊 Evaluation: ${result.evaluation}`));
    console.log(
      chalk.dim(
        `  🎯 Move rank: #${result.rank} of ${result.allCandidates ? result.allCandidates.length : 1} candidates`,
      ),
    );
    console.log();
  }

  if (showBoard) {
    displayBoard(fen, moveInfo.from, moveInfo.to);
  }

  if (showCandidates && result.allCandidates) {
    console.log(chalk.bold.blue("  📋 All candidates:"));
    for (const c of result.allCandidates) {
      const cInfo = parseMoveDescription(c.move, fen);
      const prefix = c.selected ? chalk.green("  ▸ ") : chalk.dim("    ");
      const moveText = c.selected
        ? chalk.bold.green(cInfo.san)
        : chalk.white(cInfo.san);
      const evalText = chalk.dim(`(${c.evaluation})`);
      console.log(
        `${prefix}#${c.rank} ${moveText} ${evalText} ${chalk.dim(cInfo.description)}`,
      );
    }
    console.log();
  }

  console.log(chalk.bold("━".repeat(50)));
}

function displayStatus(message, type = "info") {
  const icons = {
    info: chalk.blue("ℹ"),
    success: chalk.green("✓"),
    warning: chalk.yellow("⚠"),
    error: chalk.red("✗"),
    waiting: chalk.magenta("◉"),
    scanning: chalk.cyan("⟳"),
  };
  console.log(`  ${icons[type] || icons.info} ${message}`);
}

function displayBanner() {
  console.log();
  console.log(chalk.bold.cyan("╔══════════════════════════════════════════╗"));
  console.log(
    chalk.bold.cyan("║") +
      chalk.bold.white("    ♔  Chess Automation Assistant  ♚    ") +
      chalk.bold.cyan("║"),
  );
  console.log(
    chalk.bold.cyan("║") +
      chalk.dim.white("       Move Suggester for Chess.com       ") +
      chalk.bold.cyan("║"),
  );
  console.log(chalk.bold.cyan("╚══════════════════════════════════════════╝"));
  console.log();
}

function displayGameEnd(result) {
  console.log();
  console.log(
    chalk.bold.yellow("╔══════════════════════════════════════════╗"),
  );
  console.log(
    chalk.bold.yellow("║") +
      chalk.bold.white("          🏁 GAME OVER 🏁                ") +
      chalk.bold.yellow("║"),
  );
  console.log(
    chalk.bold.yellow("╚══════════════════════════════════════════╝"),
  );
  if (result) console.log(chalk.bold(`  Result: ${result}`));
  console.log();
}

function clearScreen() {
  process.stdout.write("\x1B[2J\x1B[3J\x1B[H");
}

module.exports = {
  displayBoard,
  displayMoveSuggestion,
  displayStatus,
  displayBanner,
  displayGameEnd,
  clearScreen,
  parseMoveDescription,
};
