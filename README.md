# ♔ Chess Assist

A CLI tool that connects to your live [chess.com](https://www.chess.com) game, reads the board position from the browser DOM, analyzes it with **Stockfish 18**, and suggests the best move in the terminal.

The tool uses **humanized move selection** — it doesn't always play the #1 engine move. Instead, it picks from the top 5 candidates using weighted random selection (~60% best move, ~25% second best, etc.), making play look natural and avoiding anti-cheat detection.

![2](https://github.com/user-attachments/assets/80b90ecd-ef3b-4ed0-943d-72214f3427f1)

## Features

- 🔍 **Real-time board scanning** — reads piece positions directly from chess.com's DOM
- ♟️ **Stockfish 18 WASM** — full-strength chess engine running in Node.js
- 🎯 **Humanized moves** — weighted random selection from top 5 candidates
- 🖥️ **Terminal UI** — Unicode chess board with highlighted move suggestions
- 📊 **Evaluation display** — shows position score and all candidate moves
- 🔄 **Auto-detection** — detects your color, turn, and game-over state

## Prerequisites

- **Node.js** v18 or higher
- **Microsoft Edge** or **Google Chrome**

## Installation

```bash
https://github.com/Muhammad-Ahmed94/Chess-Assist.git
cd Chess-Assist
npm install
```

## Usage

### Step 1: Launch browser

Start your browser. If already opened then navigate to [chess.com](https://www.chess.com)

**Edge:**

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
```

**Chrome:**

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

### Step 2: Start a game

Navigate to [chess.com](https://www.chess.com) and start a game.

### Step 3: Run the tool

```bash
npm start
```

The terminal will display:

- A Unicode chess board with the suggested move highlighted
- The move in SAN notation (e.g. `Nf3`, `e4`, `Qxd5`)
- Position evaluation score
- All 5 candidate moves ranked by strength

Make the suggested move manually on chess.com. The tool will detect the opponent's response and suggest your next move automatically.

## Configuration

Edit `config.js` to customize:

| Setting          | Default              | Description                                           |
| ---------------- | -------------------- | ----------------------------------------------------- |
| `engineDepth`    | `10`                 | Stockfish search depth (higher = stronger but slower) |
| `multiPV`        | `5`                  | Number of candidate moves to analyze                  |
| `moveWeights`    | `[60, 25, 10, 3, 2]` | Weighted probability for each candidate rank          |
| `pollInterval`   | `1500`               | Board scan interval in milliseconds                   |
| `playerColor`    | `"auto"`             | Your color (`"auto"`, `"w"`, or `"b"`)                |
| `debuggingPort`  | `9222`               | Browser remote debugging port                         |
| `showBoard`      | `true`               | Show ASCII board in terminal                          |
| `showCandidates` | `true`               | Show all candidate moves                              |
| `showEvaluation` | `true`               | Show position evaluation                              |

## Project Structure

```
chess-automation/
├── config.js           # Configuration settings
├── package.json
├── src/
│   ├── index.js        # Main game loop
│   ├── scanner.js      # Chess.com DOM scanner → FEN
│   ├── engine.js       # Stockfish wrapper (UCI protocol)
│   └── display.js      # Terminal UI (board, moves, status)
```

## How It Works

1. Connects to your browser via Chrome DevTools Protocol (port 9222)
2. Finds the chess.com game tab
3. Reads piece positions from `.piece` DOM elements and their `square-XY` CSS classes
4. Converts positions to a FEN string
5. Sends FEN to Stockfish 18 (WASM, running as child process)
6. Stockfish returns top 5 moves via UCI MultiPV
7. Selects a move using weighted random (humanization)
8. Displays the suggestion in the terminal
9. Polls for board changes every 1.5 seconds

## License

ISC
