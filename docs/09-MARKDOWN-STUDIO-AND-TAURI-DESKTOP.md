# EyeShots: Markdown Studio & Tauri 2.0 Desktop Application

This document outlines the architecture, execution model, and operations for both the **Markdown (.md) Reader & Writer** and the **Tauri 2.0 Native Desktop Application**.

---

## 1. Markdown (.md) Reader & Writer Studio

EyeShots provides a dual-mode, 100% in-browser studio for reading, writing, and bi-directional converting between Markdown (`.md`) and Portable Document Format (`.pdf`).

### Route: `/markdown-pdf`

### 1.1 Mode A: Markdown Reader & Writer (MD ➔ PDF)
- **Live Dual-Pane Editor:** Split workspace featuring a syntax-aware raw Markdown editor alongside a real-time GitHub-flavored reader preview.
- **Formatting Toolbar:** Quick syntax injection for:
  - Headings: `# H1`, `## H2`, `### H3`
  - Inline Styles: `**Bold**`, `*Italic*`, `~Strikethrough~`
  - Blocks: `> Blockquote`, `` `Code` ``, ` ```Code Blocks``` `
  - Structures: Tables, Task lists (`- [x]`), Bullet lists, Numbered lists
- **Reading Metrics:** Real-time word count, character count, and estimated reading time.
- **Client-Side PDF Generation:** Vector text layout compiled via `pdf-lib` directly in browser memory with zero server upload.
- **Raw Export:** 1-click download of the edited `.md` file.

### 1.2 Mode B: PDF to Markdown (PDF ➔ MD Extractor)
- **Zero-Cloud Extraction:** Extracts textual streams from uploaded PDFs using PDF.js text layer.
- **Typography & Layout Heuristics:**
  - Font sizes $\ge 18\text{pt}$ are mapped to `### Heading`
  - Font sizes $\ge 14\text{pt}$ are mapped to `#### Subheading`
  - Bullet symbols (`•`, `-`) are mapped to clean Markdown lists (`- Item`)
  - Vertical baseline delta analysis preserves paragraphs and linebreaks
- **Output:** Instant copy-to-clipboard or `.md` file download.

---

## 2. Tauri 2.0 Native Desktop Architecture

EyeShots utilizes **Tauri 2.0 (Rust)** to package the web application as a lightweight, memory-efficient native desktop application for Windows, macOS, and Linux.

### 2.1 Workspace Structure
```
d:/EyeShots/
├── apps/
│   ├── web/                     # Next.js 15 Web Application
│   └── desktop/
│       ├── package.json         # Desktop CLI runner
│       └── src-tauri/
│           ├── Cargo.toml       # Rust & Tauri 2 core dependencies
│           ├── build.rs         # Tauri build hook
│           ├── tauri.conf.json  # Window configuration & bundle metadata
│           ├── capabilities/    # Tauri 2 permission policies
│           └── src/
│               ├── main.rs      # Native application entrypoint
│               └── lib.rs       # Tauri runtime builder
```

### 2.2 Desktop Scripts & Commands
To run or build the desktop app:

```bash
# Launch EyeShots Native Desktop Application in Development Mode:
npm run dev:desktop

# Compile Native Windows Executable (.exe / .msi):
npm run build:desktop
```

### 2.3 Key Benefits of the Tauri 2.0 Desktop App
1. **Tiny Binary Size:** Less than 15 MB install footprint (vs 150+ MB with Electron).
2. **Minimal Memory:** Native webview engine consumes ~40 MB RAM at idle.
3. **Local File Security:** Native OS file dialogs while keeping all client-first WASM privacy guarantees intact.
4. **Air-Gapped Privacy:** All core tools (Merge, Split, Rotate, Delete, Edit, Markdown Studio) operate with zero network connection.
