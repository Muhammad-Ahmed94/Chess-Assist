const { spawn } = require("child_process");
const path = require("path");
const config = require("../config");

const STOCKFISH_PATH = path.join(
  __dirname,
  "..",
  "node_modules",
  "stockfish",
  "bin",
  "stockfish-18-single.js",
);

class StockfishEngine {
  constructor() {
    this.process = null;
    this.ready = false;
    this.analysisResolve = null;
    this.candidates = [];
    this.bestMove = null;
    this._messageHandler = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.process = spawn(process.execPath, [STOCKFISH_PATH], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.process.on("error", (err) => {
        reject(new Error(`Stockfish process error: ${err.message}`));
      });

      this.process.on("exit", (code) => {
        if (code !== 0 && !this.ready) {
          reject(new Error(`Stockfish process exited with code ${code}`));
        }
      });

      let buffer = "";
      this.process.stdout.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) this._onMessage(trimmed);
        }
      });

      this.process.stderr.on("data", () => {});

      this._messageHandler = (message) => {
        if (message === "uciok") {
          this._send(`setoption name MultiPV value ${config.multiPV}`);
          this._send("isready");
          this._messageHandler = (msg) => {
            if (msg === "readyok") {
              this.ready = true;
              this._messageHandler = (m) => this._handleAnalysisMessage(m);
              resolve();
            }
          };
        }
      };

      this._send("uci");

      setTimeout(() => {
        if (!this.ready)
          reject(new Error("Stockfish init timed out after 15s"));
      }, 15000);
    });
  }

  _onMessage(message) {
    if (this._messageHandler) this._messageHandler(message);
  }

  _send(command) {
    if (this.process && this.process.stdin.writable) {
      this.process.stdin.write(command + "\n");
    }
  }

  _handleAnalysisMessage(message) {
    if (!message) return;

    if (
      message.startsWith("info") &&
      message.includes("multipv") &&
      message.includes(" pv ")
    ) {
      const candidate = this._parseInfoLine(message);
      if (candidate) {
        const idx = this.candidates.findIndex(
          (c) => c.pvIndex === candidate.pvIndex,
        );
        if (idx >= 0) this.candidates[idx] = candidate;
        else this.candidates.push(candidate);
      }
    }

    if (message.startsWith("bestmove")) {
      this.bestMove = message.split(" ")[1];
      if (this.analysisResolve) {
        this.analysisResolve({
          bestMove: this.bestMove,
          candidates: [...this.candidates].sort(
            (a, b) => a.pvIndex - b.pvIndex,
          ),
        });
        this.analysisResolve = null;
      }
    }
  }

  _parseInfoLine(line) {
    const parts = line.split(" ");
    const result = {};
    for (let i = 0; i < parts.length; i++) {
      switch (parts[i]) {
        case "depth":
          result.depth = parseInt(parts[i + 1], 10);
          break;
        case "multipv":
          result.pvIndex = parseInt(parts[i + 1], 10);
          break;
        case "score":
          result.scoreType = parts[i + 1];
          result.scoreValue = parseInt(parts[i + 2], 10);
          break;
        case "pv":
          result.moves = parts.slice(i + 1);
          result.move = parts[i + 1];
          break;
        case "nps":
          result.nps = parseInt(parts[i + 1], 10);
          break;
      }
    }
    return result.move ? result : null;
  }

  async analyze(fen) {
    return new Promise((resolve) => {
      this.candidates = [];
      this.bestMove = null;
      this.analysisResolve = resolve;
      this._send("ucinewgame");
      this._send(`position fen ${fen}`);
      this._send(`go depth ${config.engineDepth}`);
    });
  }

  selectHumanizedMove(candidates) {
    if (!candidates || candidates.length === 0) return null;

    if (candidates.length === 1) {
      const c = candidates[0];
      return {
        move: c.move,
        rank: 1,
        evaluation: this._formatEval(c),
        allCandidates: [
          {
            rank: 1,
            move: c.move,
            evaluation: this._formatEval(c),
            selected: true,
          },
        ],
      };
    }

    const weights = config.moveWeights.slice(0, candidates.length);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    let selectedIdx = 0;

    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selectedIdx = i;
        break;
      }
    }

    const selected = candidates[selectedIdx];
    return {
      move: selected.move,
      rank: selectedIdx + 1,
      evaluation: this._formatEval(selected),
      allCandidates: candidates.map((c, i) => ({
        rank: i + 1,
        move: c.move,
        evaluation: this._formatEval(c),
        selected: i === selectedIdx,
      })),
    };
  }

  _formatEval(candidate) {
    if (!candidate) return "?";
    if (candidate.scoreType === "mate")
      return `Mate in ${candidate.scoreValue}`;
    if (candidate.scoreType === "cp") {
      const pawns = (candidate.scoreValue / 100).toFixed(2);
      return `${pawns > 0 ? "+" : ""}${pawns}`;
    }
    return "?";
  }

  destroy() {
    if (this.process) {
      this._send("quit");
      setTimeout(() => {
        if (this.process) {
          this.process.kill();
          this.process = null;
        }
      }, 1000);
    }
  }
}

module.exports = StockfishEngine;
