// pages/settings.js — About / Settings screen

import { navigate } from '../main.js';

export function renderSettings(container) {
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
          <h2>About BlockViz</h2>

          <section class="settings-section">
            <h3>How it works</h3>
            <p class="settings-desc">
              BlockViz parses standard theatrical blocking notation directly — no AI or internet connection required.
              Upload a script (.txt or .pdf) that contains explicit blocking directions, and BlockViz will extract
              character movements and animate them on a bird's-eye stage map.
            </p>
          </section>

          <section class="settings-section">
            <h3>Blocking notation format</h3>
            <p class="settings-desc">Write blocking directions as plain stage directions in your script:</p>
            <ul class="settings-list">
              <li><code>JOHN crosses to DSR</code></li>
              <li><code>Mary enters USL</code></li>
              <li><code>Otto moves to CS</code></li>
              <li><code>Vera walks to DSL</code></li>
              <li><code>The Clerk exits</code></li>
            </ul>
          </section>

          <section class="settings-section">
            <h3>Stage zones</h3>
            <div class="zone-grid-display">
              <div class="zone-cell">USL</div><div class="zone-cell">USC</div><div class="zone-cell">USR</div>
              <div class="zone-cell">SL</div><div class="zone-cell">CS</div><div class="zone-cell">SR</div>
              <div class="zone-cell">DSL</div><div class="zone-cell">DSC</div><div class="zone-cell">DSR</div>
            </div>
            <p class="settings-desc zone-note">US = Upstage &nbsp;|&nbsp; DS = Downstage &nbsp;|&nbsp; L = Left &nbsp;|&nbsp; R = Right &nbsp;|&nbsp; C = Center</p>
          </section>

          <div class="settings-footer">
            <button class="btn btn-primary" id="back-btn">Open Stage View</button>
          </div>
        </div>
      </main>
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => navigate('#stage'));
}
