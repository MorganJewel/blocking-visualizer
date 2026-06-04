// pages/upload.js — Upload screen

import { state, navigate } from '../main.js';

export function renderUpload(container) {
  container.innerHTML = `
    <div class="page upload-page">
      <header class="app-header">
        <h1 class="logo">Block<span class="logo-accent">Viz</span></h1>
        <p class="tagline">Theatrical Blocking Visualizer</p>
        <nav class="header-nav">
          <a href="#settings" class="nav-link">Settings</a>
        </nav>
      </header>

      <main class="upload-main">
        <div class="upload-card">
          <div class="upload-icon" aria-hidden="true">🎭</div>
          <h2>How do you want to use BlockViz?</h2>

          <div class="mode-picker">
            <button class="mode-card active" id="mode-animate">
              <div class="mode-icon">🎬</div>
              <div class="mode-title">Animate My Blocking</div>
              <div class="mode-desc">Your script already has blocking written in. Apertus AI reads it and animates characters on stage.</div>
            </button>
            <button class="mode-card" id="mode-build">
              <div class="mode-icon">✏️</div>
              <div class="mode-title">Build Blocking Manually</div>
              <div class="mode-desc">No blocking yet. Upload your script for character detection, then click zones to place characters yourself.</div>
            </button>
          </div>

          <div class="drop-zone" id="drop-zone">
            <input type="file" id="script-file" accept=".pdf,.txt,text/plain,application/pdf" hidden />
            <div class="drop-inner" id="drop-inner">
              <div class="drop-icon">📄</div>
              <p>Drag &amp; drop your script here</p>
              <p class="drop-sub">or</p>
              <button class="btn btn-secondary" id="browse-btn" type="button">Browse Files</button>
              <p class="drop-hint">Accepts .pdf or .txt — max 50 MB</p>
            </div>
          </div>

          <div class="file-info" id="file-info" style="display:none">
            <span class="file-icon">📃</span>
            <span id="file-name-display"></span>
            <span id="file-size-display" class="file-size"></span>
            <button class="btn-icon" id="remove-file-btn" title="Remove file" type="button">✕</button>
          </div>

          <div id="upload-error" class="error-msg" style="display:none"></div>

          <button class="btn btn-primary btn-large" id="proceed-btn" disabled>
            Parse Blocking Notes →
          </button>
        </div>


        <div class="upload-info-cards">
          <div class="info-card">
            <div class="info-card-icon">🗺️</div>
            <h3>9-Zone Stage Map</h3>
            <p>Visualize movement across all standard stage zones: USL, USC, USR, SL, CS, SR, DSL, DSC, DSR.</p>
          </div>
          <div class="info-card">
            <div class="info-card-icon">🤖</div>
            <h3>AI-Powered Parsing</h3>
            <p>Apertus AI extracts blocking directions from your script and flags ambiguous notes for manual review.</p>
          </div>
          <div class="info-card">
            <div class="info-card-icon">⚡</div>
            <h3>Conflict Detection</h3>
            <p>Add furniture, speakers, and lighting rigs. BlockViz warns you when characters occupy the same zone.</p>
          </div>
        </div>
      </main>
    </div>
  `;

  const fileInput = container.querySelector('#script-file');
  const browseBtn = container.querySelector('#browse-btn');
  const dropZone = container.querySelector('#drop-zone');
  const dropInner = container.querySelector('#drop-inner');
  const fileInfo = container.querySelector('#file-info');
  const fileNameDisplay = container.querySelector('#file-name-display');
  const fileSizeDisplay = container.querySelector('#file-size-display');
  const removeBtn = container.querySelector('#remove-file-btn');
  const proceedBtn = container.querySelector('#proceed-btn');
  const uploadError = container.querySelector('#upload-error');

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function showError(msg) {
    uploadError.textContent = msg;
    uploadError.style.display = 'block';
  }

  function clearError() {
    uploadError.style.display = 'none';
    uploadError.textContent = '';
  }

  function handleFile(file) {
    clearError();
    if (!file) return;

    const validTypes = ['application/pdf', 'text/plain'];
    const validExtensions = ['.pdf', '.txt'];
    const hasValidType = validTypes.includes(file.type);
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!hasValidType && !hasValidExt) {
      showError('Invalid file type. Please upload a .pdf or .txt file.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showError('File is too large. Maximum size is 50 MB.');
      return;
    }

    state.script = file;
    state.scriptText = '';

    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = formatSize(file.size);
    fileInfo.style.display = 'flex';
    dropInner.style.display = 'none';
    proceedBtn.disabled = false;
  }

  function removeFile() {
    state.script = null;
    state.scriptText = '';
    fileInput.value = '';
    fileInfo.style.display = 'none';
    dropInner.style.display = 'flex';
    proceedBtn.disabled = true;
    clearError();
  }

  // Mode picker
  const modeAnimate = container.querySelector('#mode-animate');
  const modeBuild = container.querySelector('#mode-build');

  function setMode(mode) {
    state.mode = mode;
    modeAnimate.classList.toggle('active', mode === 'animate');
    modeBuild.classList.toggle('active', mode === 'build');
    proceedBtn.textContent = mode === 'animate' ? 'Parse Blocking Notes →' : 'Detect Characters →';
  }

  modeAnimate.addEventListener('click', () => setMode('animate'));
  modeBuild.addEventListener('click', () => setMode('build'));
  setMode(state.mode);

  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
  removeBtn.addEventListener('click', removeFile);

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  proceedBtn.addEventListener('click', () => {
    if (!state.script) {
      showError('Please select a file first.');
      return;
    }
    navigate(state.mode === 'animate' ? '#parsing' : '#stage');
  });
}
