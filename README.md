# BlockViz — Theatrical Blocking Visualizer

BlockViz is a browser-based tool for visualizing theatrical blocking (character movement) from a script. Upload a PDF or plain-text script, and BlockViz uses AI to extract character movement directions and display them on an interactive SVG bird's-eye stage map.

## Features

- Upload PDF or .txt scripts
- Automatic text extraction via PDF.js (with Tesseract.js OCR fallback for image-based PDFs)
- AI-powered blocking note parsing using HuggingFace Inference API (Mistral-7B)
- Interactive 9-zone SVG stage map (USL, USC, USR, SL, CS, SR, DSL, DSC, DSR)
- Character dots with color customization and visibility toggles
- Animated playback: step forward/back, play all, reset
- Tech element editor: add furniture, speakers, lighting rigs to stage zones
- Conflict detection: warns when characters and tech elements occupy the same zone
- Unresolved notes panel for manually assigning ambiguous blocking directions
- Export current stage state as SVG

## How to Run Locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## How to Deploy to GitHub Pages

```bash
npm run build
```

This produces a `dist/` folder. Push it to a `gh-pages` branch or configure GitHub Actions to deploy the `dist/` folder. The `vite.config.js` uses `base: './'` for compatibility with GitHub Pages subdirectory hosting.

Example using the `gh-pages` npm package:
```bash
npm install -D gh-pages
npx gh-pages -d dist
```

## HuggingFace API Key

BlockViz requires a HuggingFace API token to parse blocking notes.

1. Create a free account at https://huggingface.co
2. Go to https://huggingface.co/settings/tokens
3. Create a token with read access
4. Open BlockViz and click **Settings** in the navigation bar
5. Paste your token and click **Save API Key**

The key is stored only in your browser's `localStorage` under the key `blockviz_hf_api_key`. It is never sent anywhere except directly to the HuggingFace Inference API.

## How Blocking Note Parsing Works

1. The script text is split into lines and chunked into groups of 10 lines.
2. Each chunk is sent to HuggingFace's Inference API using the model `mistralai/Mistral-7B-Instruct-v0.2`.
3. The model is prompted to return a JSON array of blocking events: `{ character, action, location, script_line_index, confidence }`.
4. Events with confidence >= 0.7 and a valid zone code are added to the resolved timeline.
5. Events with low confidence or missing location are flagged as "unresolved" and shown in the Unresolved Notes panel for manual assignment.
6. All resolved events are sorted by `script_line_index` to build the timeline.

Valid zone codes: **USL**, **USC**, **USR**, **SL**, **CS**, **SR**, **DSL**, **DSC**, **DSR**

Example blocking notes the parser understands:
- "John crosses to DSR"
- "Mary enters USL"
- "Alice moves to CS"
- "Bob exits SR"

## Tech Stack

- Vite + Vanilla JavaScript (no frameworks)
- SVG for all stage visualization
- PDF.js (CDN) for PDF text extraction
- Tesseract.js (CDN) for OCR fallback
- HuggingFace Inference API for AI parsing
