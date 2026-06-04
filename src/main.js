import './styles/main.css';
import { renderUpload } from './pages/upload.js';
import { renderParsing } from './pages/parsing.js';
import { renderStageView } from './pages/stage-view.js';
import { renderSettings } from './pages/settings.js';

// ===== GLOBAL APP STATE =====
export const state = {
  script: null,        // File object
  scriptText: '',      // Extracted text
  blockingEvents: [],  // { character, action, location, script_line_index, confidence }
  unresolvedNotes: [], // { text, script_line_index, id }
  characters: {},      // { name: { color, visible } }
  techElements: [],    // { id, name, zone, movable }
  currentStep: 0,
  isPlaying: false,
  playInterval: null,
  conflicts: [],       // { stepIndex, character, techElement }
  mode: 'animate',     // 'animate' | 'build'
};

// ===== ROUTER =====
const routes = {
  '#upload': renderUpload,
  '#parsing': renderParsing,
  '#stage': renderStageView,
  '#settings': renderSettings,
};

export function navigate(hash) {
  window.location.hash = hash;
}

function handleRoute() {
  const hash = window.location.hash || '#upload';
  const app = document.getElementById('app');
  app.innerHTML = '';

  const renderFn = routes[hash] || renderUpload;
  renderFn(app);
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', handleRoute);
