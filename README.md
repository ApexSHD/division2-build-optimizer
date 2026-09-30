# Tom Clancy's The Division 2 - Build Optimizer

⚠️ **Project Status: Alpha (In Development)** – *This tool is currently under active development, incomplete, and not final. Features, stats, and calculations are subject to change.*

A fast, web-based build optimization tool designed for **Tom Clancy's The Division 2** to help agents calculate and fine-tune their gear stats.

## ✨ Features & Tech Stack
- **Stat Calculation & Theorycrafting:** Evaluates gear pieces and bonuses using JavaScript (ES6+) and modular JSON databases (`gear.json`, `mod.json`, `talent.json`, `weapons.json`).
- **Interface:** Built with HTML5 and Tailwind CSS for a responsive, modern gaming UI.

## 📦 Getting Started
Clone the repository and open `index.html` in any modern web browser to run this client-side application:
```bash
git clone https://github.com
cd division2-build-optimizer
```

Tailwind CSS - Styling and modern UI components

JavaScript (ES6+) - Core logic, calculations, and interactivity

📦 Getting Started (Local Development)
## Running Locally

The app loads its data (`weapons.json`, `talent.json`, `talents-display.json`, `mod.json`, `gear.json`) via `fetch()`, so it must be served over HTTP (opening `index.html` directly via `file://` will not work).

Quick start with Python:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser. Any other static file server works as well.
