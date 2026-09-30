# Tom Clancy's The Division 2 - Build Optimizer

⚠️ **Project Status: Alpha (In Development)** – *This tool is currently under active development, incomplete, and not final. Features, stats, and calculations are subject to change.*

A fast, web-based build optimization tool designed for **Tom Clancy's The Division 2** to help agents calculate, analyze, and fine-tune their gear stats, attributes, and talents to maximize efficiency and damage output in-game.

> 🤖 **Note:** This project was built with the assistance of AI, developed together with [Vibe Code](https://mistral.ai) (powered by Mistral AI), which handled code refactoring, data extraction, and build tooling.

## ✨ Features

- **Stat Calculation & Theorycrafting:** Evaluates weapons, gear pieces, mods, and talents, including Named/Exotic items with fixed attributes and perks
- **Automatic Mod Optimization:** Picks the best compatible mod loadout per weapon slot based on the current crit setup
- **JSON-Driven Data:** All game data lives in versioned JSON databases (`weapons.json`, `talent.json`, `talents-display.json`, `mod.json`, `gear.json`) – no duplicated inline copies
- **Responsive Design:** Modern, clean UI built with Tailwind CSS (precompiled, no CDN at runtime), usable on desktop and mobile

## 🛠️ Built With

- **HTML5** – Structure and layout
- **Tailwind CSS** – Styling and modern UI components (statically compiled via `build-tailwind.sh`)
- **JavaScript (ES6+)** – Core logic, calculations, and interactivity

## 📦 Project Structure

```
index.html          Markup and layout
style.css           Custom styles
tailwind.css        Precompiled Tailwind build (generated)
js/boot.js          Entry point: loads JSON data via fetch(), then the app scripts
js/app.js           App logic (part 1)
js/app2.js          App logic (part 2) and page initialization
weapons.json        Weapon database (incl. Named/Exotic variants)
talent.json         High-End weapon talent database
talents-display.json  Talent display groups
mod.json            Weapon mod catalog (optic/muzzle/underbarrel/magazine)
gear.json           Named/Exotic gear and green gear set database
```

## 📦 Getting Started (Local Development)

The app loads its data via `fetch()`, so it must be served over HTTP – opening `index.html` directly via `file://` will not work.

Quick start with Python:

```bash
git clone https://github.com/ApexSHD/division2-build-optimizer.git
cd division2-build-optimizer
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser. Any other static file server works as well.

The tool is also available online via **GitHub Pages**: https://apexshd.github.io/division2-build-optimizer/

## 🔄 Rebuilding Tailwind

If you add new Tailwind classes to the HTML or JS, rebuild the static stylesheet:

```bash
npm i -D tailwindcss@3   # once
./build-tailwind.sh
```

## 🤝 Contributing & Credits

- Game data model inspired by community tables (weapon stats, talent lists, mod catalog)
- Development assisted by [Vibe Code](https://mistral.ai) – AI-powered coding agent by Mistral AI
- *The Division 2* is a trademark of Ubisoft Entertainment; this project is a fan tool and is not affiliated with or endorsed by Ubisoft.
