// pages/settings.js — Settings screen

import { getApiKey, saveApiKey, clearApiKey } from '../settings.js';
import { navigate } from '../main.js';

export function renderSettings(container) {
  const currentKey = getApiKey();
  const maskedKey = currentKey ? currentKey.slice(0, 8) + '…' : '';

  container.innerHTML = `
    <div class="page settings-page">
      <header class="app-header">
        <h1 class="logo">Block<span class="logo-accent">Viz</span></h1>
        <nav class="header-nav">
          <a href="#upload" class="nav-link">← Back</a>
        </nav>
      </header>

      <main class="settings-main">
        <div class="settings-card">
          <h2>Settings</h2>

          <section class="settings-section">
            <h3>HuggingFace API Key</h3>
            <p class="settings-desc">
              BlockViz uses the HuggingFace Inference API (model:
              <code>mistralai/Mistral-7B-Instruct-v0.2</code>) to parse blocking notes from your script.
              You need a free HuggingFace account and API token.
            </p>
            <p class="settings-desc">
              Get your token at:
              <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener">
                huggingface.co/settings/tokens
              </a>
            </p>

            <div class="api-key-form">
              <div class="form-row key-row">
                <input
                  type="password"
                  id="api-key-input"
                  class="form-input"
                  placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value="${currentKey}"
                  autocomplete="off"
                  spellcheck="false"
                />
                <button class="btn btn-secondary btn-sm" id="toggle-key-btn" type="button">Show</button>
              </div>
              ${currentKey ? `<p class="key-saved-hint">Currently saved: <code>${maskedKey}</code></p>` : ''}

              <div class="form-actions">
                <button class="btn btn-primary" id="save-key-btn">Save API Key</button>
                ${currentKey ? `<button class="btn btn-danger" id="clear-key-btn">Clear Key</button>` : ''}
              </div>

              <div id="key-message" class="key-message" style="display:none"></div>
            </div>
          </section>

          <section class="settings-section">
            <h3>About BlockViz</h3>
            <p class="settings-desc">
              BlockViz is a theatrical blocking visualization tool. Upload a script, and the AI
              will extract character movement notes and display them on an interactive SVG stage map.
            </p>
            <p class="settings-desc">
              <strong>Stage zones:</strong> USL (upstage left), USC (upstage center), USR (upstage right),
              SL (stage left), CS (center stage), SR (stage right), DSL (downstage left),
              DSC (downstage center), DSR (downstage right).
            </p>
            <p class="settings-desc">
              <strong>Privacy:</strong> Your API key is stored only in your browser's localStorage
              and never sent anywhere except to HuggingFace's API.
            </p>
          </section>

          <div class="settings-footer">
            <button class="btn btn-primary" id="back-to-stage-btn">Open Stage View</button>
          </div>
        </div>
      </main>
    </div>
  `;

  const keyInput = container.querySelector('#api-key-input');
  const toggleBtn = container.querySelector('#toggle-key-btn');
  const saveBtn = container.querySelector('#save-key-btn');
  const clearBtn = container.querySelector('#clear-key-btn');
  const keyMessage = container.querySelector('#key-message');
  const backBtn = container.querySelector('#back-to-stage-btn');

  function showMessage(msg, isError = false) {
    keyMessage.textContent = msg;
    keyMessage.className = 'key-message ' + (isError ? 'key-message-error' : 'key-message-success');
    keyMessage.style.display = 'block';
    setTimeout(() => { keyMessage.style.display = 'none'; }, 3000);
  }

  toggleBtn.addEventListener('click', () => {
    if (keyInput.type === 'password') {
      keyInput.type = 'text';
      toggleBtn.textContent = 'Hide';
    } else {
      keyInput.type = 'password';
      toggleBtn.textContent = 'Show';
    }
  });

  saveBtn.addEventListener('click', () => {
    const key = keyInput.value.trim();
    if (!key) {
      showMessage('Please enter an API key.', true);
      return;
    }
    if (!key.startsWith('hf_') && key.length < 10) {
      showMessage('That does not look like a valid HuggingFace token. Tokens usually start with "hf_".', true);
      return;
    }
    saveApiKey(key);
    showMessage('API key saved successfully!');
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearApiKey();
      keyInput.value = '';
      showMessage('API key cleared.');
      // Re-render to update UI
      setTimeout(() => renderSettings(container), 300);
    });
  }

  backBtn.addEventListener('click', () => navigate('#stage'));
}
