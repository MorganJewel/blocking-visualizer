// pages/stage-view.js — Stage View main screen

import { state, navigate } from '../main.js';
import { generateBlockingScript } from '../apertus.js';
import {
  initStage, renderCharacters, renderTechElements,
  animateToStep, exportSVG, getNextColor, ZONES,
  setZoneClickHandler, clearZoneClickHandler,
} from '../stage.js';
import { applyStepFromScratch, getConflictsAtStep } from '../timeline.js';
import { checkAllConflicts, getConflictingTechIds, getConflictsAtStepIndex } from '../conflict.js';

let allConflicts = [];
let svgEl = null;

export function renderStageView(container) {
  container.innerHTML = `
    <div class="page stage-page">
      <header class="app-header stage-header">
        <h1 class="logo">Block<span class="logo-accent">Viz</span></h1>
        <nav class="header-nav">
          <a href="#upload" class="nav-link">Upload</a>
          <a href="#settings" class="nav-link">Settings</a>
        </nav>
      </header>

      <div class="stage-layout">
        <!-- LEFT: Stage map -->
        <div class="stage-panel">
          <div class="panel-title">Stage Map</div>

          <!-- Click-to-place toolbar -->
          <div class="place-toolbar" id="place-toolbar">
            <label class="place-label">Place:</label>
            <input type="text" id="place-char" class="form-input form-input-sm" placeholder="Character name…" list="char-datalist" autocomplete="off" />
            <datalist id="char-datalist"></datalist>
            <select id="place-action" class="form-select form-select-sm">
              <option value="enters">enters</option>
              <option value="crosses to" selected>crosses to</option>
              <option value="exits">exits</option>
            </select>
            <button class="btn btn-accent" id="place-mode-btn">＋ Click a Zone</button>
            <span class="place-hint" id="place-hint" style="display:none">👆 Click any zone below</span>
            <button class="btn btn-secondary btn-sm" id="place-cancel-btn" style="display:none">Cancel</button>
            <span class="place-name-prompt" id="place-name-prompt" style="display:none">← Enter a name first</span>
          </div>

          <div class="svg-wrapper">
            <svg id="stage-svg" xmlns="http://www.w3.org/2000/svg"></svg>
          </div>
          <!-- Playback toolbar -->
          <div class="playback-toolbar">
            <button class="toolbar-btn" id="btn-reset" title="Reset to start">⏮</button>
            <button class="toolbar-btn" id="btn-back" title="Step back">◀</button>
            <button class="toolbar-btn" id="btn-play" title="Play">▶</button>
            <button class="toolbar-btn" id="btn-forward" title="Step forward">▶▶</button>
            <button class="toolbar-btn" id="btn-pause" title="Pause" style="display:none">⏸</button>
            <span class="step-counter" id="step-counter">Step 0 / 0</span>
            <button class="toolbar-btn export-btn" id="btn-export" title="Export SVG">⬇ Export SVG</button>
          </div>

          <!-- Conflict warnings -->
          <div class="conflict-panel" id="conflict-panel" style="display:none">
            <div class="conflict-title">⚠ Conflicts at this step</div>
            <div id="conflict-list"></div>
          </div>
        </div>

        <!-- RIGHT: Script panel + side panels -->
        <div class="right-column">
          <!-- Script text -->
          <div class="script-panel">
            <div class="panel-title">Script</div>
            <div class="script-text" id="script-text"></div>
          </div>

          <!-- Side panels tabbed -->
          <div class="side-panels">
            <div class="tab-bar">
              <button class="tab-btn active" data-tab="characters">Characters</button>
              <button class="tab-btn" data-tab="tech">Tech Elements</button>
              <button class="tab-btn" data-tab="unresolved">
                Unresolved
                <span class="badge" id="unresolved-badge">${state.unresolvedNotes.length}</span>
              </button>
              <button class="tab-btn" data-tab="blockingtext">📝 Blocking</button>
            </div>

            <div class="tab-content">
              <!-- Characters tab -->
              <div class="tab-pane active" id="tab-characters">
                <div id="character-list"></div>
              </div>

              <!-- Tech Elements tab -->
              <div class="tab-pane" id="tab-tech">
                <div class="tech-add-form">
                  <div class="form-row">
                    <input type="text" id="tech-name-input" placeholder="Element name (e.g. Chair)" class="form-input" />
                  </div>
                  <div class="form-row">
                    <select id="tech-zone-select" class="form-select">
                      ${Object.keys(ZONES).map(z => `<option value="${z}">${z}</option>`).join('')}
                    </select>
                    <label class="form-checkbox">
                      <input type="checkbox" id="tech-movable" />
                      Movable
                    </label>
                  </div>
                  <button class="btn btn-primary btn-sm" id="add-tech-btn">+ Add Element</button>
                  <div id="tech-add-error" class="error-msg" style="display:none"></div>
                </div>
                <div id="tech-list"></div>
              </div>

              <!-- Unresolved notes tab -->
              <div class="tab-pane" id="tab-unresolved">
                <div id="unresolved-list"></div>
              </div>

              <!-- Blocking text tab -->
              <div class="tab-pane" id="tab-blockingtext">
                <div class="blocking-text-toolbar">
                  <select id="bt-format" class="form-select form-select-sm">
                    <option value="auto">Style: auto-detect</option>
                    <option value="standard">Standard (NAME crosses to DSR.)</option>
                    <option value="parens">Parenthetical ((Name crosses to DSR.))</option>
                    <option value="narrative">Narrative (Name crosses downstage right.)</option>
                  </select>
                  <button class="btn btn-secondary btn-sm" id="bt-copy">Copy</button>
                  <button class="btn btn-secondary btn-sm" id="bt-download">↓ .txt</button>
                </div>
                <textarea id="blocking-text-output" class="blocking-textarea" readonly placeholder="Place characters on stage to generate blocking text…"></textarea>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  svgEl = container.querySelector('#stage-svg');
  initStage(svgEl);

  // If no events yet, show placeholder
  if (state.blockingEvents.length === 0) {
    renderEmptyState(container);
  }

  // Auto-detect characters from script text and seed into state
  if (state.scriptText) {
    const detected = detectCharactersFromScript(state.scriptText);
    detected.forEach(name => {
      if (!state.characters[name]) {
        state.characters[name] = { color: getNextColor(), visible: true };
      }
    });
  }

  buildScriptPanel(container);
  renderCharacterPanel(container);
  renderTechPanel(container);
  renderUnresolvedPanel(container);
  recomputeConflicts();
  renderStageAtCurrentStep();

  setupPlayback(container);
  setupTabs(container);
  setupPlacement(container);
  renderCharacterPanel(container);
  updateCharDatalist(container);
}

function renderEmptyState(container) {
  // Only show empty state if there's also no script text loaded
  if (state.scriptText) return;
  const scriptText = container.querySelector('#script-text');
  scriptText.innerHTML = `
    <div class="empty-state">
      <p>No script loaded yet.</p>
      <p>Go to <a href="#upload">Upload</a> to load a script.</p>
      <p class="empty-hint">You can still place characters using the toolbar above the stage.</p>
    </div>
  `;
}

function buildScriptPanel(container) {
  const scriptText = container.querySelector('#script-text');
  if (!state.scriptText && state.blockingEvents.length === 0) return;

  const lines = state.scriptText ? state.scriptText.split('\n') : [];

  // Build index of which lines have blocking events
  const eventsByLine = {};
  state.blockingEvents.forEach((evt, idx) => {
    const li = evt.script_line_index;
    if (!eventsByLine[li]) eventsByLine[li] = [];
    eventsByLine[li].push({ ...evt, eventIndex: idx });
  });

  if (lines.length === 0) {
    // Just list events
    const ul = document.createElement('ul');
    ul.className = 'event-only-list';
    state.blockingEvents.forEach((evt, idx) => {
      const li = document.createElement('li');
      li.className = 'event-item';
      li.dataset.eventIndex = idx;
      li.textContent = `${evt.character} → ${evt.location} (${evt.action})`;
      li.addEventListener('click', () => jumpToStep(idx, container));
      ul.appendChild(li);
    });
    scriptText.appendChild(ul);
    return;
  }

  scriptText.innerHTML = '';
  lines.forEach((line, lineIdx) => {
    const div = document.createElement('div');
    div.className = 'script-line';
    div.dataset.lineIndex = lineIdx;

    if (eventsByLine[lineIdx]) {
      div.classList.add('blocking-line');
      const events = eventsByLine[lineIdx];
      div.title = events.map(e => `${e.character} → ${e.location}`).join('; ');
      div.dataset.eventIndex = events[0].eventIndex;
      div.addEventListener('click', () => jumpToStep(events[0].eventIndex, container));

      const lineText = document.createElement('span');
      lineText.textContent = line || ' ';
      const badge = document.createElement('span');
      badge.className = 'blocking-badge';
      badge.textContent = events.map(e => `${e.character}→${e.location}`).join(', ');
      div.appendChild(lineText);
      div.appendChild(badge);
    } else {
      div.textContent = line || ' ';
    }

    scriptText.appendChild(div);
  });
}

function renderCharacterPanel(container) {
  const list = container.querySelector('#character-list');
  list.innerHTML = '';

  const names = Object.keys(state.characters);
  if (names.length === 0) {
    list.innerHTML = '<p class="empty-hint">No characters detected yet.</p>';
    return;
  }

  for (const name of names) {
    const charData = state.characters[name];
    const row = document.createElement('div');
    row.className = 'character-row';
    row.innerHTML = `
      <label class="char-visibility">
        <input type="checkbox" data-char="${name}" ${charData.visible ? 'checked' : ''} />
      </label>
      <input type="color" class="color-swatch" data-char="${name}" value="${charData.color}" title="Change color" />
      <span class="char-name-label">${name}</span>
    `;

    const checkbox = row.querySelector('input[type=checkbox]');
    checkbox.addEventListener('change', (e) => {
      state.characters[name].visible = e.target.checked;
      recomputeConflicts();
      renderStageAtCurrentStep();
    });

    const colorInput = row.querySelector('input[type=color]');
    colorInput.addEventListener('input', (e) => {
      state.characters[name].color = e.target.value;
      renderStageAtCurrentStep();
    });

    list.appendChild(row);
  }
}

function renderTechPanel(container) {
  const list = container.querySelector('#tech-list');
  list.innerHTML = '';

  if (state.techElements.length === 0) {
    list.innerHTML = '<p class="empty-hint">No tech elements added yet.</p>';
    return;
  }

  for (const tech of state.techElements) {
    const conflicting = allConflicts.some(c => c.techElementId === tech.id);
    const row = document.createElement('div');
    row.className = 'tech-row' + (conflicting ? ' tech-conflict' : '');
    row.innerHTML = `
      <div class="tech-row-info">
        <span class="tech-name">${tech.name}</span>
        <span class="tech-zone-badge">${tech.zone}</span>
        ${tech.movable ? '<span class="tech-movable-tag">movable</span>' : ''}
        ${conflicting ? '<span class="conflict-tag">⚠ conflict</span>' : ''}
      </div>
      <div class="tech-row-actions">
        <select class="form-select form-select-sm" data-tech-id="${tech.id}" title="Change zone">
          ${Object.keys(ZONES).map(z => `<option value="${z}" ${z === tech.zone ? 'selected' : ''}>${z}</option>`).join('')}
        </select>
        <button class="btn-icon btn-delete" data-tech-id="${tech.id}" title="Remove">✕</button>
      </div>
    `;

    const zoneSelect = row.querySelector('select');
    zoneSelect.addEventListener('change', (e) => {
      const t = state.techElements.find(el => el.id === tech.id);
      if (t) {
        t.zone = e.target.value;
        recomputeConflicts();
        renderStageAtCurrentStep();
        renderTechPanel(container);
      }
    });

    const deleteBtn = row.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', () => {
      state.techElements = state.techElements.filter(el => el.id !== tech.id);
      recomputeConflicts();
      renderStageAtCurrentStep();
      renderTechPanel(container);
    });

    list.appendChild(row);
  }
}

function renderUnresolvedPanel(container) {
  const list = container.querySelector('#unresolved-list');
  list.innerHTML = '';

  if (state.unresolvedNotes.length === 0) {
    list.innerHTML = '<p class="empty-hint">No unresolved notes. All blocking notes were parsed successfully.</p>';
    return;
  }

  for (const note of state.unresolvedNotes) {
    const row = document.createElement('div');
    row.className = 'unresolved-row';
    row.innerHTML = `
      <div class="unresolved-text">"${note.text || '(no text)'}"</div>
      <div class="unresolved-reason">${note.reason || 'Unknown reason'}</div>
      <div class="unresolved-assign">
        <input type="text" class="form-input form-input-sm" placeholder="Character name"
          value="${note.character || ''}" data-note-id="${note.id}" id="char-input-${note.id}" />
        <select class="form-select form-select-sm" data-note-id="${note.id}" id="zone-input-${note.id}">
          <option value="">— select zone —</option>
          ${Object.keys(ZONES).map(z => `<option value="${z}">${z}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" data-note-id="${note.id}">Assign</button>
      </div>
    `;

    const assignBtn = row.querySelector('button');
    assignBtn.addEventListener('click', () => {
      const charInput = container.querySelector(`#char-input-${note.id}`);
      const zoneInput = container.querySelector(`#zone-input-${note.id}`);
      const character = charInput ? charInput.value.trim() : '';
      const zone = zoneInput ? zoneInput.value : '';

      if (!character || !zone) {
        alert('Please enter both a character name and a destination zone.');
        return;
      }

      // Remove from unresolved
      state.unresolvedNotes = state.unresolvedNotes.filter(n => n.id !== note.id);

      // Add to resolved events
      const newEvent = {
        character,
        action: 'moves to',
        location: zone,
        script_line_index: note.script_line_index || 0,
        confidence: 1.0,
      };
      state.blockingEvents.push(newEvent);
      state.blockingEvents.sort((a, b) => a.script_line_index - b.script_line_index);

      // Ensure character exists
      if (!state.characters[character]) {
        state.characters[character] = { color: getNextColor(), visible: true };
      }

      recomputeConflicts();
      renderStageAtCurrentStep();
      renderCharacterPanel(container);
      renderUnresolvedPanel(container);
      updateStepCounter(container);

      // Update badge
      const badge = container.querySelector('#unresolved-badge');
      if (badge) badge.textContent = state.unresolvedNotes.length;
    });

    list.appendChild(row);
  }

  // Update badge
  const badge = container.querySelector('#unresolved-badge');
  if (badge) badge.textContent = state.unresolvedNotes.length;
}

export function refreshBlockingText(container) {
  const ta = container.querySelector('#blocking-text-output');
  const fmt = container.querySelector('#bt-format');
  if (!ta) return;
  const override = fmt ? fmt.value : 'auto';
  ta.value = generateBlockingScript(state.blockingEvents, state.scriptText, override);
}

function setupTabs(container) {
  const tabBtns = container.querySelectorAll('.tab-btn');
  const tabPanes = container.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tabId = 'tab-' + btn.dataset.tab;
      const pane = container.querySelector('#' + tabId);
      if (pane) pane.classList.add('active');
      if (btn.dataset.tab === 'blockingtext') refreshBlockingText(container);
    });
  });

  // Blocking text tab: format change, copy, download
  const btFormat = container.querySelector('#bt-format');
  const btCopy   = container.querySelector('#bt-copy');
  const btDl     = container.querySelector('#bt-download');
  if (btFormat) btFormat.addEventListener('change', () => refreshBlockingText(container));
  if (btCopy) btCopy.addEventListener('click', () => {
    const ta = container.querySelector('#blocking-text-output');
    if (!ta || !ta.value) return;
    navigator.clipboard.writeText(ta.value).then(() => {
      btCopy.textContent = 'Copied!';
      setTimeout(() => { btCopy.textContent = 'Copy'; }, 1500);
    });
  });
  if (btDl) btDl.addEventListener('click', () => {
    const ta = container.querySelector('#blocking-text-output');
    if (!ta || !ta.value) return;
    const blob = new Blob([ta.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'blocking-notes.txt';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  });

  // Add tech element
  const addBtn = container.querySelector('#add-tech-btn');
  const techError = container.querySelector('#tech-add-error');
  addBtn.addEventListener('click', () => {
    const nameInput = container.querySelector('#tech-name-input');
    const zoneSelect = container.querySelector('#tech-zone-select');
    const movableCheck = container.querySelector('#tech-movable');

    const name = nameInput.value.trim();
    const zone = zoneSelect.value;

    if (!name) {
      techError.textContent = 'Please enter a name for the tech element.';
      techError.style.display = 'block';
      return;
    }

    techError.style.display = 'none';

    const id = 'tech-' + Date.now();
    state.techElements.push({ id, name, zone, movable: movableCheck.checked });
    nameInput.value = '';
    movableCheck.checked = false;

    recomputeConflicts();
    renderStageAtCurrentStep();
    renderTechPanel(container);
  });
}

function setupPlayback(container) {
  const btnPlay = container.querySelector('#btn-play');
  const btnPause = container.querySelector('#btn-pause');
  const btnForward = container.querySelector('#btn-forward');
  const btnBack = container.querySelector('#btn-back');
  const btnReset = container.querySelector('#btn-reset');
  const btnExport = container.querySelector('#btn-export');

  btnPlay.addEventListener('click', () => startPlay(container));
  btnPause.addEventListener('click', () => pausePlay(container));
  btnForward.addEventListener('click', () => stepForward(container));
  btnBack.addEventListener('click', () => stepBack(container));
  btnReset.addEventListener('click', () => resetPlay(container));
  btnExport.addEventListener('click', doExport);

  updateStepCounter(container);
}

function startPlay(container) {
  if (state.isPlaying) return;
  if (state.blockingEvents.length === 0) return;

  state.isPlaying = true;
  container.querySelector('#btn-play').style.display = 'none';
  container.querySelector('#btn-pause').style.display = 'inline-flex';

  state.playInterval = setInterval(() => {
    if (state.currentStep < state.blockingEvents.length - 1) {
      state.currentStep++;
      renderStageAtCurrentStep();
      updateStepCounter(container);
      highlightScriptLine(container);
    } else {
      pausePlay(container);
    }
  }, 1000);
}

function pausePlay(container) {
  state.isPlaying = false;
  clearInterval(state.playInterval);
  state.playInterval = null;
  container.querySelector('#btn-play').style.display = 'inline-flex';
  container.querySelector('#btn-pause').style.display = 'none';
}

function stepForward(container) {
  pausePlay(container);
  if (state.currentStep < state.blockingEvents.length - 1) {
    state.currentStep++;
    renderStageAtCurrentStep();
    updateStepCounter(container);
    highlightScriptLine(container);
  }
}

function stepBack(container) {
  pausePlay(container);
  if (state.currentStep > 0) {
    state.currentStep--;
    renderStageAtCurrentStep();
    updateStepCounter(container);
    highlightScriptLine(container);
  }
}

function resetPlay(container) {
  pausePlay(container);
  state.currentStep = 0;
  renderStageAtCurrentStep();
  updateStepCounter(container);
  highlightScriptLine(container);
}

function jumpToStep(eventIndex, container) {
  pausePlay(container);
  state.currentStep = eventIndex;
  renderStageAtCurrentStep();
  updateStepCounter(container);
  highlightScriptLine(container);
}

function updateStepCounter(container) {
  const counter = container.querySelector('#step-counter');
  if (counter) {
    const total = state.blockingEvents.length;
    counter.textContent = total === 0
      ? 'No events'
      : `Step ${state.currentStep + 1} / ${total}`;
  }
}

function highlightScriptLine(container) {
  const scriptText = container.querySelector('#script-text');
  if (!scriptText) return;

  // Remove previous highlight
  scriptText.querySelectorAll('.blocking-line.current').forEach(el => el.classList.remove('current'));

  const evt = state.blockingEvents[state.currentStep];
  if (!evt) return;

  // Find and highlight matching line
  const line = scriptText.querySelector(`.blocking-line[data-event-index="${state.currentStep}"]`);
  if (line) {
    line.classList.add('current');
    line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function renderStageAtCurrentStep() {
  if (!svgEl) return;

  const positions = applyStepFromScratch(state.blockingEvents, state.currentStep);
  const stepConflicts = getConflictsAtStep(state.techElements, positions);
  const conflictingTechIds = getConflictingTechIds(stepConflicts);

  renderTechElements(svgEl, state.techElements, conflictingTechIds);
  animateToStep(svgEl, positions, state.characters);
  renderCharacters(svgEl, state.characters, positions);

  // Show conflict panel
  const conflictPanel = document.querySelector('#conflict-panel');
  const conflictList = document.querySelector('#conflict-list');
  if (conflictPanel && conflictList) {
    if (stepConflicts.length > 0) {
      conflictPanel.style.display = 'block';
      conflictList.innerHTML = stepConflicts.map(c =>
        `<div class="conflict-item">⚠ <strong>${c.character}</strong> and tech element <strong>${c.techElementName}</strong> both in <strong>${c.zone}</strong></div>`
      ).join('');
    } else {
      conflictPanel.style.display = 'none';
    }
  }
}

function recomputeConflicts() {
  allConflicts = checkAllConflicts(state.techElements, state.blockingEvents, state.characters);
}

function detectCharactersFromScript(text) {
  if (!text) return [];
  const found = new Set();
  text.split('\n').forEach(line => {
    const t = line.trim();
    // ALL-CAPS lines of 1-4 words = character cues
    if (/^[A-Z][A-Z\s\-]{1,30}$/.test(t) && t.split(/\s+/).length <= 4) {
      const skip = ['ACT ONE','ACT TWO','ACT THREE','SCENE','END OF','THE END','FADE OUT','BLACKOUT','INTERMISSION','PROLOGUE','EPILOGUE'];
      if (!skip.some(s => t.startsWith(s))) found.add(t);
    }
  });
  return [...found];
}

function updateCharDatalist(container) {
  const dl = container.querySelector('#char-datalist');
  if (!dl) return;
  // Merge known characters + any detected from script text
  const fromScript = detectCharactersFromScript(state.scriptText);
  const all = new Set([...Object.keys(state.characters), ...fromScript]);
  dl.innerHTML = [...all].map(n => `<option value="${n}">`).join('');
}

function setupPlacement(container) {
  const placeBtn     = container.querySelector('#place-mode-btn');
  const cancelBtn    = container.querySelector('#place-cancel-btn');
  const hint         = container.querySelector('#place-hint');
  const charInput    = container.querySelector('#place-char');
  const actionSelect = container.querySelector('#place-action');
  let placementActive = false;

  updateCharDatalist(container);

  const namePrompt = container.querySelector('#place-name-prompt');

  function enterPlacementMode() {
    const name = charInput.value.trim();
    if (!name) {
      charInput.focus();
      charInput.classList.add('input-error');
      if (namePrompt) { namePrompt.style.display = 'inline'; setTimeout(() => { namePrompt.style.display = 'none'; }, 2500); }
      return;
    }
    charInput.classList.remove('input-error');
    placementActive = true;
    placeBtn.style.display = 'none';
    cancelBtn.style.display = 'inline-flex';
    hint.style.display = 'inline';
    container.querySelector('.svg-wrapper').classList.add('placement-active');

    setZoneClickHandler(svgEl, (zoneName) => {
      const action = actionSelect ? actionSelect.value : 'crosses to';

      if (!state.characters[name]) {
        state.characters[name] = { color: getNextColor(), visible: true };
      }

      state.blockingEvents.push({
        character: name,
        action,
        location: zoneName,
        script_line_index: state.blockingEvents.length,
        confidence: 1.0,
      });

      state.currentStep = state.blockingEvents.length - 1;

      recomputeConflicts();
      renderStageAtCurrentStep();
      buildScriptPanel(container);
      renderCharacterPanel(container);
      updateStepCounter(container);
      updateCharDatalist(container);
      refreshBlockingText(container);

      exitPlacementMode();
    });
  }

  function exitPlacementMode() {
    placementActive = false;
    placeBtn.style.display = 'inline-flex';
    cancelBtn.style.display = 'none';
    hint.style.display = 'none';
    container.querySelector('.svg-wrapper').classList.remove('placement-active');
    clearZoneClickHandler(svgEl);
  }

  placeBtn.addEventListener('click', enterPlacementMode);
  cancelBtn.addEventListener('click', exitPlacementMode);
  charInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enterPlacementMode();
    charInput.classList.remove('input-error');
  });
}

function doExport() {
  if (!svgEl) return;
  const svgStr = exportSVG(svgEl);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'blockviz-stage.svg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
