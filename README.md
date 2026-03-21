# ✦ Todo — Glassy Tauri App

A fast, minimal Todo app built with **Tauri 2** and a glassmorphism UI. Zero JavaScript frameworks — just vanilla HTML/CSS/JS with a Rust backend. Runs on WSL2 via WSLg.

## Features

- ✅ Add, edit, toggle, and delete todos
- 🔍 Filter by All / Active / Done
- 💾 Persistent storage (JSON file in app data)
- 🎨 Glassmorphism UI with animated gradient orbs
- ⚡ Native performance — Tauri + Rust
- ⌨️ Keyboard shortcuts (`Ctrl+N` to focus input, `Enter` to add, `Escape` to cancel edit)

## Prerequisites (WSL2 / Ubuntu)

```bash
# 1. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Install system dependencies
sudo apt-get update && sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  libxdo-dev \
  libssl-dev

# 3. Install Tauri CLI
cargo install tauri-cli --version "^2.0"
```

## Getting Started

```bash
cd todo-app

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

## Project Structure

```
todo-app/
├── ui/                     # Frontend (served by Tauri)
│   ├── index.html          # Main HTML
│   ├── styles.css          # Glassmorphism styles
│   └── app.js              # Vanilla JS app logic
├── src-tauri/
│   ├── Cargo.toml          # Rust dependencies
│   ├── tauri.conf.json     # Tauri configuration
│   ├── capabilities/       # Tauri v2 permissions
│   └── src/
│       ├── main.rs         # Entry point
│       └── lib.rs          # Commands + JSON persistence
└── README.md
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | Focus input |
| `Enter` | Add todo / Confirm edit |
| `Escape` | Cancel edit |
