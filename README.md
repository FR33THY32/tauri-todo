# ✦ Todo — Obsidian Glass

A fast, keyboard-driven Todo + Ideas app built with **Tauri 2**, **React 19**, and **Tailwind CSS 4**. Obsidian glass UI with a Rust backend. Runs on Windows, Linux (WSL2 via WSLg), and macOS.

## Features

### Tasks
- ✅ Add, edit, toggle, reorder (drag & drop), and delete todos
- 🔍 Search + filter by All / Active / Done
- 📅 Smart input parsing — `"meeting tomorrow #work"` auto-extracts due dates and list routing
- 📋 Multiple lists with quick switching
- 📝 Expandable notes and due dates per task
- ↩️ Undo on delete (toast with 4s window)

### Ideas
- 💡 Separate Ideas view for dumping raw thoughts before they vanish
- ⚡ Quick Capture (`Alt+Space`) — type `!` prefix to instantly save an idea
- 🚀 Promote any idea to a task in your active list (with undo)
- 🔍 Search ideas

### Quick Capture (Alt+Space)
- Global hotkey summons a floating command bar from anywhere
- Smart input: `"meeting tomorrow #work"` → task with due date in Work list
- Idea mode: `"! shower thought"` → saved as idea instantly
- Live parsing chips show extracted dates, list tags, and mode
- Success confirmation with emerald flash before auto-hide

### Design
- 🎨 Obsidian glass aesthetic — deep dark translucent layers with film grain
- 🌗 Dark / Light theme toggle
- 🖥️ Custom frameless window with system tray
- ⌨️ Full keyboard navigation (Vim-style `j/k`, `Space`, `D`, `E`, `Enter`)

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

# Install frontend dependencies
cd frontend && npm install && cd ..

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

## Project Structure

```
todo-app/
├── frontend/                   # React + Vite frontend
│   ├── index.html              # Main app entry
│   ├── capture.html            # Quick Capture window entry
│   ├── src/
│   │   ├── App.tsx             # Main app (state, routing, keyboard nav)
│   │   ├── CaptureApp.tsx      # Quick Capture floating bar
│   │   ├── components/
│   │   │   ├── Titlebar.tsx    # Custom window titlebar
│   │   │   ├── ListSwitcher.tsx# List/Ideas dropdown
│   │   │   ├── Stats.tsx       # Task counters
│   │   │   ├── AddTodo.tsx     # Smart input with live parsing
│   │   │   ├── SearchBar.tsx   # Search filter
│   │   │   ├── FilterTabs.tsx  # All / Active / Done tabs
│   │   │   ├── TodoItem.tsx    # Task card (expand, edit, notes, due)
│   │   │   ├── IdeasView.tsx   # Ideas list + input + search
│   │   │   └── EmptyState.tsx  # Context-aware empty states
│   │   ├── lib/
│   │   │   ├── tauri.ts        # Typed API wrapper (all invoke calls)
│   │   │   ├── types.ts        # Todo, Idea, ListInfo, AppSnapshot
│   │   │   ├── smart-input.ts  # Natural language date/list parser
│   │   │   └── utils.ts        # cn() helper
│   │   └── index.css           # Obsidian glass theme + animations
│   └── vite.config.ts
├── src-tauri/
│   ├── Cargo.toml              # Rust dependencies
│   ├── tauri.conf.json         # Window config, permissions, build
│   ├── capabilities/           # Tauri v2 permissions
│   └── src/
│       ├── main.rs             # Entry point
│       └── lib.rs              # Commands, persistence, tray, shortcuts
├── build.ps1                   # Windows build script (WiX workaround)
└── README.md
```

## Keyboard Shortcuts

### Global
| Shortcut | Action |
|----------|--------|
| `Alt+Space` | Toggle Quick Capture |
| `Ctrl+N` | Focus input (task or idea, context-aware) |
| `Ctrl+F` | Focus search |
| `Ctrl+I` | Toggle Ideas / Tasks view |

### List Navigation (when not in an input)
| Shortcut | Action |
|----------|--------|
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `Space` | Toggle task complete |
| `E` | Edit task title |
| `D` | Delete (with undo) |
| `Enter` | Expand task / Promote idea |
| `P` | Promote idea to task (Ideas view) |
| `Escape` | Exit keyboard mode / Close expanded |

### Quick Capture
| Input | Action |
|-------|--------|
| `meeting tomorrow` | Creates task with due date |
| `buy milk #personal` | Creates task in Personal list |
| `! random thought` | Saves as idea |
| `Escape` | Dismiss |

## Smart Input Syntax

The input parser recognizes natural language dates and list tags:

- **Today/Tomorrow**: `today`, `tomorrow`, `tmr`, `tmrw`
- **Relative**: `in 3 days`, `in 2 weeks`
- **Day names**: `friday`, `next monday`, `on wed`
- **Dates**: `Jan 15`, `March 3`, `12/25`
- **By prefix**: `by friday`, `by tomorrow`
- **List tags**: `#personal`, `#work` (matches list names)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Tauri 2 |
| Backend | Rust (serde, chrono, uuid) |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS 4 + Radix UI |
| Build | Vite 8 |
| Persistence | JSON file in app data dir |
