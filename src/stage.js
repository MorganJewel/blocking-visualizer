// stage.js — SVG stage rendering and animation. Only this file directly manipulates SVG elements.

export const STAGE_WIDTH = 600;
export const STAGE_HEIGHT = 400;

// Zone definitions: { x, y, width, height } in SVG coordinate space
// Stage grid is 3 cols x 3 rows. Column widths: 200. Row heights: ~133.
export const ZONES = {
  USL: { x: 0,   y: 0,   width: 200, height: 133 },
  USC: { x: 200, y: 0,   width: 200, height: 133 },
  USR: { x: 400, y: 0,   width: 200, height: 133 },
  SL:  { x: 0,   y: 133, width: 200, height: 134 },
  CS:  { x: 200, y: 133, width: 200, height: 134 },
  SR:  { x: 400, y: 133, width: 200, height: 134 },
  DSL: { x: 0,   y: 267, width: 200, height: 133 },
  DSC: { x: 200, y: 267, width: 200, height: 133 },
  DSR: { x: 400, y: 267, width: 200, height: 133 },
};

// Return center point of a zone
export function zoneCenter(zoneName) {
  const z = ZONES[zoneName];
  if (!z) return { cx: STAGE_WIDTH / 2, cy: STAGE_HEIGHT / 2 };
  return { cx: z.x + z.width / 2, cy: z.y + z.height / 2 };
}

// Default character colors
const DEFAULT_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#fd79a8', '#00cec9', '#fdcb6e',
];
let colorIndex = 0;

export function getNextColor() {
  return DEFAULT_COLORS[colorIndex++ % DEFAULT_COLORS.length];
}

/**
 * initStage(svgElement)
 * Draw the 9-zone grid with labels and stage border.
 */
export function initStage(svgElement) {
  svgElement.innerHTML = '';
  svgElement.setAttribute('viewBox', `0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`);
  svgElement.setAttribute('width', '100%');
  svgElement.setAttribute('height', '100%');

  // Stage background
  const bg = createSVGEl('rect', {
    x: 0, y: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT,
    fill: '#1b4332', rx: 4,
  });
  svgElement.appendChild(bg);

  // Draw zone cells
  for (const [zoneName, zone] of Object.entries(ZONES)) {
    // Zone rect
    const rect = createSVGEl('rect', {
      x: zone.x, y: zone.y, width: zone.width, height: zone.height,
      fill: 'none', stroke: '#2d6a4f', 'stroke-width': 1.5,
    });
    rect.dataset.zone = zoneName;
    svgElement.appendChild(rect);

    // Zone label
    const label = createSVGEl('text', {
      x: zone.x + zone.width / 2,
      y: zone.y + zone.height / 2,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: '#52b788',
      'font-size': 13,
      'font-family': 'monospace',
      'font-weight': 'bold',
      opacity: 0.6,
      'pointer-events': 'none',
    });
    label.textContent = zoneName;
    svgElement.appendChild(label);
  }

  // Audience label at bottom
  const audienceLabel = createSVGEl('text', {
    x: STAGE_WIDTH / 2,
    y: STAGE_HEIGHT - 6,
    'text-anchor': 'middle',
    fill: '#74c69d',
    'font-size': 10,
    'font-family': 'sans-serif',
    opacity: 0.5,
  });
  audienceLabel.textContent = '▼ AUDIENCE';
  svgElement.appendChild(audienceLabel);

  // Groups for layering (tech and chars below overlays)
  const techGroup = createSVGEl('g', { id: 'tech-elements' });
  svgElement.appendChild(techGroup);

  const charGroup = createSVGEl('g', { id: 'characters' });
  svgElement.appendChild(charGroup);

  // Clickable zone overlays — must be last so they sit on top and receive clicks
  const overlayGroup = createSVGEl('g', { id: 'zone-overlays', style: 'pointer-events:all' });
  for (const [zoneName, zone] of Object.entries(ZONES)) {
    const overlay = createSVGEl('rect', {
      x: zone.x, y: zone.y, width: zone.width, height: zone.height,
      fill: 'transparent', stroke: 'none', cursor: 'default',
      'data-zone': zoneName,
    });
    overlayGroup.appendChild(overlay);
  }
  svgElement.appendChild(overlayGroup);
}

/**
 * setZoneClickHandler(svgElement, fn)
 * Enables click-to-place mode. fn(zoneName) is called on click.
 * Zones glow on hover while active.
 */
export function setZoneClickHandler(svgElement, fn) {
  const overlays = svgElement.querySelectorAll('#zone-overlays rect');
  overlays.forEach(rect => {
    rect.style.cursor = 'pointer';
    rect._clickFn = (e) => { e.stopPropagation(); fn(rect.dataset.zone); };
    rect._overFn = () => { rect.setAttribute('fill', 'rgba(201,168,76,0.18)'); };
    rect._outFn  = () => { rect.setAttribute('fill', 'transparent'); };
    rect.addEventListener('click', rect._clickFn);
    rect.addEventListener('mouseover', rect._overFn);
    rect.addEventListener('mouseout', rect._outFn);
  });
}

/**
 * clearZoneClickHandler(svgElement)
 * Disables click-to-place mode.
 */
export function clearZoneClickHandler(svgElement) {
  const overlays = svgElement.querySelectorAll('#zone-overlays rect');
  overlays.forEach(rect => {
    rect.style.cursor = 'default';
    rect.setAttribute('fill', 'transparent');
    if (rect._clickFn) rect.removeEventListener('click', rect._clickFn);
    if (rect._overFn)  rect.removeEventListener('mouseover', rect._overFn);
    if (rect._outFn)   rect.removeEventListener('mouseout', rect._outFn);
  });
}

/**
 * renderCharacters(svgElement, characters, positions)
 * characters: { name: { color, visible } }
 * positions: { name: zoneName } — current zone for each character
 * Creates or updates character circles.
 */
export function renderCharacters(svgElement, characters, positions) {
  const group = svgElement.querySelector('#characters');
  if (!group) return;

  // Remove characters no longer present
  const existing = Array.from(group.querySelectorAll('g[data-character]'));
  for (const el of existing) {
    if (!characters[el.dataset.character]) {
      group.removeChild(el);
    }
  }

  for (const [name, charData] of Object.entries(characters)) {
    if (!charData.visible) {
      const el = group.querySelector(`g[data-character="${CSS.escape(name)}"]`);
      if (el) el.style.display = 'none';
      continue;
    }

    const zone = positions[name];
    if (!zone) continue;

    const { cx, cy } = zoneCenter(zone);
    let charGroup = group.querySelector(`g[data-character="${CSS.escape(name)}"]`);

    if (!charGroup) {
      // Create new character group
      charGroup = createSVGEl('g', { 'data-character': name });

      const circle = createSVGEl('circle', {
        r: 18, fill: charData.color, stroke: '#fff', 'stroke-width': 2, opacity: 0.92,
      });
      circle.classList.add('char-circle');

      const initial = createSVGEl('text', {
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: '#fff', 'font-size': 13, 'font-weight': 'bold',
        'font-family': 'sans-serif', 'pointer-events': 'none',
      });
      initial.classList.add('char-label');
      initial.textContent = name.charAt(0).toUpperCase();

      const nameLabel = createSVGEl('text', {
        y: 28, 'text-anchor': 'middle', fill: charData.color,
        'font-size': 10, 'font-family': 'sans-serif',
        'pointer-events': 'none',
      });
      nameLabel.classList.add('char-name');
      nameLabel.textContent = name.length > 8 ? name.slice(0, 7) + '…' : name;

      charGroup.appendChild(circle);
      charGroup.appendChild(initial);
      charGroup.appendChild(nameLabel);
      group.appendChild(charGroup);
    }

    charGroup.style.display = '';
    charGroup.setAttribute('transform', `translate(${cx}, ${cy})`);

    // Update color if changed
    const circle = charGroup.querySelector('.char-circle');
    if (circle) circle.setAttribute('fill', charData.color);
    const nameLabel = charGroup.querySelector('.char-name');
    if (nameLabel) nameLabel.setAttribute('fill', charData.color);
  }
}

/**
 * renderTechElements(svgElement, techElements, conflicts)
 * techElements: [{ id, name, zone, movable }]
 * conflicts: array of tech element ids that are in conflict at current step
 */
export function renderTechElements(svgElement, techElements, conflicts = []) {
  const group = svgElement.querySelector('#tech-elements');
  if (!group) return;

  group.innerHTML = '';

  for (const tech of techElements) {
    const zone = ZONES[tech.zone];
    if (!zone) continue;

    const isConflict = conflicts.includes(tech.id);
    const padding = 6;
    const w = zone.width - padding * 2;
    const h = zone.height - padding * 2;

    const techGroup = createSVGEl('g', { 'data-tech': tech.id });

    const rect = createSVGEl('rect', {
      x: zone.x + padding,
      y: zone.y + padding,
      width: w,
      height: h,
      fill: isConflict ? 'rgba(231, 76, 60, 0.25)' : 'rgba(201, 168, 76, 0.15)',
      stroke: isConflict ? '#e74c3c' : '#c9a84c',
      'stroke-width': isConflict ? 2.5 : 1.5,
      'stroke-dasharray': '5,3',
      rx: 3,
    });

    const label = createSVGEl('text', {
      x: zone.x + zone.width / 2,
      y: zone.y + zone.height / 2 - 6,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: isConflict ? '#e74c3c' : '#c9a84c',
      'font-size': 10,
      'font-family': 'sans-serif',
      'font-weight': 'bold',
      'pointer-events': 'none',
    });
    label.textContent = tech.name.length > 10 ? tech.name.slice(0, 9) + '…' : tech.name;

    const sublabel = createSVGEl('text', {
      x: zone.x + zone.width / 2,
      y: zone.y + zone.height / 2 + 8,
      'text-anchor': 'middle',
      fill: isConflict ? '#e74c3c' : '#8a6f2e',
      'font-size': 9,
      'font-family': 'sans-serif',
      'pointer-events': 'none',
    });
    sublabel.textContent = tech.movable ? '(movable)' : '(fixed)';

    if (isConflict) {
      const warn = createSVGEl('text', {
        x: zone.x + zone.width - padding - 4,
        y: zone.y + padding + 12,
        'text-anchor': 'end',
        fill: '#e74c3c',
        'font-size': 14,
        'pointer-events': 'none',
      });
      warn.textContent = '⚠';
      techGroup.appendChild(warn);
    }

    techGroup.appendChild(rect);
    techGroup.appendChild(label);
    techGroup.appendChild(sublabel);
    group.appendChild(techGroup);
  }
}

/**
 * animateToStep(svgElement, characterPositions, characters)
 * Move all character dots to their new positions (direct attribute set + CSS transition via class).
 */
export function animateToStep(svgElement, characterPositions, characters) {
  const group = svgElement.querySelector('#characters');
  if (!group) return;

  for (const [name, zoneName] of Object.entries(characterPositions)) {
    const charGroup = group.querySelector(`g[data-character="${CSS.escape(name)}"]`);
    if (!charGroup) continue;
    if (!characters[name] || !characters[name].visible) continue;

    const { cx, cy } = zoneCenter(zoneName);
    charGroup.setAttribute('transform', `translate(${cx}, ${cy})`);
  }
}

/**
 * flashConflict(svgElement, zoneName)
 * Briefly flash a zone red to indicate a conflict.
 */
export function flashConflict(svgElement, zoneName) {
  const zone = ZONES[zoneName];
  if (!zone) return;

  const flash = createSVGEl('rect', {
    x: zone.x, y: zone.y, width: zone.width, height: zone.height,
    fill: 'rgba(231,76,60,0.4)', rx: 3,
    'pointer-events': 'none',
  });
  svgElement.appendChild(flash);
  setTimeout(() => { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 600);
}

/**
 * exportSVG(svgElement)
 * Returns a serialized SVG string for download.
 */
export function exportSVG(svgElement) {
  const clone = svgElement.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  return svgStr;
}

// Helper to create SVG elements with attributes
export function createSVGEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}
