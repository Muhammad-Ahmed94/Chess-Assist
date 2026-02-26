const puppeteer = require("puppeteer-core");
const config = require("../config");
const StockfishEngine = require("./engine");
const { scanBoard, waitForBoard, detectGameEnd } = require("./scanner");
const {
  displayBanner,
  displayMoveSuggestion,
  displayStatus,
  displayGameEnd: showGameEnd,
  clearScreen,
} = require("./display");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectBrowser() {
  displayStatus("Connecting to browser...", "info");
  displayStatus(
    `Looking for browser on debugging port ${config.debuggingPort}...`,
    "info",
  );

  try {
    const browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${config.debuggingPort}`,
      defaultViewport: null,
    });
    displayStatus("Connected!", "success");
    return browser;
  } catch (err) {
    console.log();
    displayStatus("Could not connect to browser.", "error");
    displayStatus(
      "Please launch your browser with remote debugging enabled:",
      "warning",
    );
    console.log();
    console.log("  Step 1: Close ALL browser windows completely");
    console.log("  Step 2: Run one of these commands in a NEW terminal:");
    console.log();
    console.log(
      '  Edge:   & "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --remote-debugging-port=9222',
    );
    console.log(
      '  Chrome: & "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222',
    );
    console.log();
    displayStatus(
      "Then navigate to chess.com, start a game, and run npm start again.",
      "info",
    );
    console.log();
    throw new Error("Browser connection failed");
  }
}

async function findGamePage(browser) {
  const pages = await browser.pages();

  for (const page of pages) {
    const url = page.url();
    if (
      url.includes("chess.com") &&
      (url.includes("/game/") || url.includes("/play") || url.includes("/live"))
    ) {
      displayStatus(`Found chess.com game tab: ${url}`, "success");
      return page;
    }
  }

  for (const page of pages) {
    if (page.url().includes("chess.com")) {
      displayStatus(`Found chess.com tab: ${page.url()}`, "success");
      return page;
    }
  }

  displayStatus(
    "No chess.com tab found! Please open chess.com in your browser.",
    "error",
  );
  throw new Error("No chess.com tab found");
}

async function main() {
  clearScreen();
  displayBanner();

  let browser;
  try {
    browser = await connectBrowser();
  } catch (e) {
    process.exit(1);
  }

  let page;
  try {
    page = await findGamePage(browser);
  } catch (e) {
    process.exit(1);
  }

  displayStatus("Initializing Stockfish engine...", "info");
  const engine = new StockfishEngine();
  try {
    await engine.init();
    displayStatus("Stockfish engine ready!", "success");
  } catch (e) {
    displayStatus(`Failed to initialize Stockfish: ${e.message}`, "error");
    process.exit(1);
  }

  displayStatus("Waiting for chess board to load...", "scanning");
  try {
    await waitForBoard(page, 120000);
    displayStatus("Chess board detected!", "success");
  } catch (e) {
    displayStatus("Chess board not found. Is a game in progress?", "error");
    process.exit(1);
  }

  let lastFen = null;
  let moveNumber = 0;
  let lastSuggestion = null;
  let stalePollCount = 0;
  let currentGameUrl = page.url();

  console.log();
  displayStatus("Game loop started! Watching for moves...", "success");
  console.log();

  while (true) {
    try {
      if (stalePollCount >= 10) {
        displayStatus(
          "Board seems stale. Checking for new game tabs...",
          "scanning",
        );
        try {
          const newPage = await findGamePage(browser);
          const newUrl = newPage.url();
          if (newUrl !== currentGameUrl) {
            page = newPage;
            currentGameUrl = newUrl;
            lastFen = null;
            moveNumber = 0;
            lastSuggestion = null;
            stalePollCount = 0;
            displayStatus(`Switched to new game: ${newUrl}`, "success");
            await sleep(1000);
            continue;
          }
        } catch (e) {}
        stalePollCount = 0;
      }

      const boardState = await scanBoard(page, config.playerColor);

      if (moveNumber > 0) {
        const gameStatus = await detectGameEnd(page);
        if (gameStatus.ended) {
          clearScreen();
          displayBanner();
          showGameEnd(gameStatus.result);
          break;
        }
      }

      if (boardState.fen === lastFen) {
        stalePollCount++;
        await sleep(config.pollInterval);
        continue;
      }

      stalePollCount = 0;
      lastFen = boardState.fen;
      moveNumber++;

      if (boardState.isMyTurn) {
        clearScreen();
        displayBanner();
        displayStatus(
          `Move ${moveNumber} — Your turn (${boardState.playerColor === "w" ? "White" : "Black"})`,
          "info",
        );
        displayStatus("Analyzing position with Stockfish...", "scanning");

        const analysis = await engine.analyze(boardState.fen);
        const suggestion = engine.selectHumanizedMove(analysis.candidates);

        if (suggestion) {
          clearScreen();
          displayBanner();
          displayMoveSuggestion(suggestion, boardState.fen, {
            showCandidates: config.showCandidates,
            showEvaluation: config.showEvaluation,
            showBoard: config.showBoard,
          });
          lastSuggestion = suggestion;
          console.log();
          displayStatus(
            "Make this move on the board, then wait for opponent...",
            "waiting",
          );
        } else {
          displayStatus("No valid moves found!", "error");
        }
      } else {
        if (!lastSuggestion) {
          clearScreen();
          displayBanner();
        }
        displayStatus(
          `Move ${moveNumber} — Opponent's turn. Waiting...`,
          "waiting",
        );
      }

      await sleep(config.pollInterval);
    } catch (err) {
      if (
        err.message.includes("Session closed") ||
        err.message.includes("Target closed") ||
        err.message.includes("Protocol error") ||
        err.message.includes("Execution context was destroyed")
      ) {
        displayStatus("Connection lost. Looking for game tab...", "warning");
        try {
          page = await findGamePage(browser);
          currentGameUrl = page.url();
          displayStatus("Reconnected!", "success");
          lastFen = null;
          stalePollCount = 0;
        } catch (reconErr) {
          displayStatus("Could not reconnect. Exiting.", "error");
          break;
        }
      } else {
        displayStatus(`Error: ${err.message}`, "error");
        await sleep(config.pollInterval * 2);
      }
    }
  }

  engine.destroy();
  displayStatus("Engine stopped. Goodbye!", "info");
}

process.on("SIGINT", () => {
  console.log();
  displayStatus("Interrupted. Shutting down...", "warning");
  process.exit(0);
});

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
