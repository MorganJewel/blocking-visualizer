// pages/parsing.js — Parsing screen

import { state, navigate } from '../main.js';
import { extractTextFromFile } from '../parser.js';
import { parseBlockingNotes } from '../apertus.js';
import { buildTimeline, getAllCharacters } from '../timeline.js';
import { getNextColor } from '../stage.js';

export function renderParsing(container) {
  container.innerHTML = `
    <div class="page parsing-page">
      <header class="app-header">
        <h1 class="logo">Block<span class="logo-accent">Viz</span></h1>
        <p class="tagline">Parsing Script…</p>
      </header>
      <main class="parsing-main">
        <div class="parsing-card">
          <div id="parsing-steps">
            <div class="parse-step" id="step-extract">
              <div class="step-indicator" id="ind-extract">⏳</div>
              <div class="step-content">
                <div class="step-title">Extracting text from script</div>
                <div class="step-detail" id="detail-extract"></div>
              </div>
            </div>
            <div class="parse-step" id="step-ai">
              <div class="step-indicator" id="ind-ai">⏸️</div>
              <div class="step-content">
                <div class="step-title">Parsing blocking notation</div>
                <div class="step-detail" id="detail-ai">Waiting…</div>
              </div>
            </div>
            <div class="parse-step" id="step-build">
              <div class="step-indicator" id="ind-build">⏸️</div>
              <div class="step-content">
                <div class="step-title">Building timeline</div>
                <div class="step-detail" id="detail-build">Waiting…</div>
              </div>
            </div>
          </div>

          <div class="progress-bar-outer">
            <div class="progress-bar-inner" id="progress-bar" style="width:0%"></div>
          </div>
          <div class="progress-label" id="progress-label">Starting…</div>

          <div id="parsing-error" class="error-msg" style="display:none"></div>
          <div id="parsing-summary" class="parsing-summary" style="display:none"></div>

          <div class="parsing-actions" id="parsing-actions" style="display:none">
            <button class="btn btn-primary" id="go-to-stage-btn">Open Stage View →</button>
            <a href="#upload" class="btn btn-secondary">← Upload Different Script</a>
          </div>
        </div>
      </main>
    </div>
  `;

  const progressBar = container.querySelector('#progress-bar');
  const progressLabel = container.querySelector('#progress-label');
  const parsingError = container.querySelector('#parsing-error');
  const parsingSummary = container.querySelector('#parsing-summary');
  const parsingActions = container.querySelector('#parsing-actions');

  function setProgress(pct, msg) {
    progressBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
    progressLabel.textContent = msg;
  }

  function setStepState(stepId, indId, state, detail) {
    const stepEl = container.querySelector(`#${stepId}`);
    const indEl = container.querySelector(`#${indId}`);
    const detailEl = container.querySelector(`#detail-${stepId.replace('step-', '')}`);
    if (!stepEl || !indEl) return;

    stepEl.className = 'parse-step ' + state;
    const icons = { active: '🔄', done: '✅', error: '❌', waiting: '⏸️' };
    indEl.textContent = icons[state] || '⏸️';
    if (detailEl && detail !== undefined) detailEl.textContent = detail;
  }

  function showError(msg) {
    parsingError.textContent = msg;
    parsingError.style.display = 'block';
    parsingActions.style.display = 'flex';
  }

  async function runParsing() {
    if (!state.script) {
      showError('No script file found. Please go back and upload a file.');
      parsingActions.style.display = 'flex';
      return;
    }

    // Step 1: Extract text
    setStepState('step-extract', 'ind-extract', 'active', 'Initializing…');
    setProgress(5, 'Extracting text from file…');

    let scriptText = '';
    try {
      scriptText = await extractTextFromFile(state.script, (pct, msg) => {
        const mapped = Math.round(5 + pct * 0.3);
        setProgress(mapped, msg);
        setStepState('step-extract', 'ind-extract', 'active', msg);
      });
      state.scriptText = scriptText;
      setStepState('step-extract', 'ind-extract', 'done',
        `Extracted ${scriptText.length.toLocaleString()} characters`);
      setProgress(35, 'Text extraction complete.');
    } catch (err) {
      setStepState('step-extract', 'ind-extract', 'error', err.message);
      showError('Text extraction failed: ' + err.message);
      return;
    }

    // Step 2: AI parsing
    setStepState('step-ai', 'ind-ai', 'active', 'Sending to HuggingFace AI…');
    setProgress(38, 'Preparing text chunks for AI…');

    const lines = scriptText.split('\n').filter(l => l.trim().length > 0);
    const totalChunks = Math.ceil(lines.length / 10);

    let resolved = [];
    let unresolved = [];
    let aiError = null;

    try {
      const result = await parseBlockingNotes(lines, import.meta.env.VITE_PUBLICAI_API_KEY || import.meta.env.VITE_HF_API_KEY || '', (batch, total) => {
        const pct = 38 + Math.round((batch / total) * 45);
        const msg = `Processing batch ${batch} of ${total}…`;
        setProgress(pct, msg);
        setStepState('step-ai', 'ind-ai', 'active', msg);
      });
      resolved = result.resolved;
      unresolved = result.unresolved;
      aiError = result.error;
    } catch (err) {
      setStepState('step-ai', 'ind-ai', 'error', err.message);
      showError('AI parsing failed: ' + err.message);
      return;
    }

    if (aiError) {
      setStepState('step-ai', 'ind-ai', 'error', aiError);
      // Don't fully abort — we may have partial results
      parsingError.textContent = 'AI warning: ' + aiError;
      parsingError.style.display = 'block';
    } else {
      setStepState('step-ai', 'ind-ai', 'done',
        `Found ${resolved.length} blocking events, ${unresolved.length} unresolved`);
    }

    setProgress(83, 'AI parsing complete. Building timeline…');

    // Step 3: Build timeline
    setStepState('step-build', 'ind-build', 'active', 'Sorting events…');

    const timeline = buildTimeline(resolved);
    state.blockingEvents = timeline;
    state.unresolvedNotes = unresolved;
    state.currentStep = 0;
    state.isPlaying = false;

    // Assign characters
    const charNames = getAllCharacters(timeline);
    // Merge unresolved characters too
    unresolved.forEach(u => { if (u.character) charNames.push(u.character); });
    const uniqueChars = [...new Set(charNames)];

    for (const name of uniqueChars) {
      if (!state.characters[name]) {
        state.characters[name] = { color: getNextColor(), visible: true };
      }
    }

    setStepState('step-build', 'ind-build', 'done',
      `${timeline.length} events, ${uniqueChars.length} characters`);
    setProgress(100, 'Done!');

    // Summary
    parsingSummary.style.display = 'block';
    parsingSummary.innerHTML = `
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-num">${timeline.length}</span>
          <span class="summary-label">Blocking Events</span>
        </div>
        <div class="summary-item">
          <span class="summary-num">${uniqueChars.length}</span>
          <span class="summary-label">Characters</span>
        </div>
        <div class="summary-item">
          <span class="summary-num">${unresolved.length}</span>
          <span class="summary-label">Unresolved Notes</span>
        </div>
        <div class="summary-item">
          <span class="summary-num">${lines.length}</span>
          <span class="summary-label">Script Lines</span>
        </div>
      </div>
    `;

    parsingActions.style.display = 'flex';

    const goBtn = container.querySelector('#go-to-stage-btn');
    goBtn.addEventListener('click', () => navigate('#stage'));
  }

  // Start parsing automatically
  runParsing();
}
