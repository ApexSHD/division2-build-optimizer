The Division 2 - Build Optimizer
A web-based build optimization tool designed for Tom Clancy's The Division 2. This application helps agents calculate, analyze, and fine-tune their gear stats, attributes, and talents to maximize efficiency and damage output in-game.

✨ Features
Stat Calculation: Easily input and evaluate gear pieces, weapons, and brand/gear sets.

Responsive Design: Built with a modern, clean UI utilizing Tailwind CSS for seamless usage on desktop and mobile.

Interactive Interface: Fast and lightweight client-side logic powered by JavaScript.

Built With
HTML5 - Structure and layout

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
