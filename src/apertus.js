// apertus.js — blocking note parser (regex-based, no external API)

const VALID_ZONES = ['USL', 'USC', 'USR', 'SL', 'CS', 'SR', 'DSL', 'DSC', 'DSR'];

const ZONE_ALIASES = {
  'UPSTAGE LEFT': 'USL', 'UPSTAGE CENTER': 'USC', 'UPSTAGE RIGHT': 'USR',
  'STAGE LEFT': 'SL', 'CENTER STAGE': 'CS', 'CENTER': 'CS', 'STAGE RIGHT': 'SR',
  'DOWNSTAGE LEFT': 'DSL', 'DOWNSTAGE CENTER': 'DSC', 'DOWNSTAGE RIGHT': 'DSR',
  'UP LEFT': 'USL', 'UP CENTER': 'USC', 'UP RIGHT': 'USR',
  'DOWN LEFT': 'DSL', 'DOWN CENTER': 'DSC', 'DOWN RIGHT': 'DSR',
  'UP STAGE LEFT': 'USL', 'UP STAGE CENTER': 'USC', 'UP STAGE RIGHT': 'USR',
  'DOWN STAGE LEFT': 'DSL', 'DOWN STAGE CENTER': 'DSC', 'DOWN STAGE RIGHT': 'DSR',
};

// Movement verbs we recognize
const MOVE_VERBS = [
  'crosses to', 'cross to', 'moves to', 'move to', 'enters at', 'enters',
  'enter at', 'enter', 'walks to', 'walk to', 'goes to', 'go to',
  'crosses downstage', 'crosses upstage', 'moves downstage', 'moves upstage',
  'steps to', 'step to', 'runs to', 'run to', 'backs to', 'back to',
];

const EXIT_VERBS = ['exits', 'exit', 'leaves', 'leave', 'storms off', 'walks off', 'runs off'];

function normalizeZone(raw) {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase().replace(/[^A-Z ]/g, '');
  if (VALID_ZONES.includes(upper)) return upper;
  if (ZONE_ALIASES[upper]) return ZONE_ALIASES[upper];
  // Try stripping "THE" prefix e.g. "the DSR"
  const stripped = upper.replace(/^THE\s+/, '');
  if (VALID_ZONES.includes(stripped)) return stripped;
  if (ZONE_ALIASES[stripped]) return ZONE_ALIASES[stripped];
  return null;
}

// Build a regex that matches any zone code or alias
const ZONE_PATTERN = [
  ...VALID_ZONES,
  ...Object.keys(ZONE_ALIASES),
].sort((a, b) => b.length - a.length) // longest first to avoid partial matches
  .map(z => z.replace(/ /g, '\\s+'))
  .join('|');

const ZONE_RE = new RegExp(`\\b(${ZONE_PATTERN})\\b`, 'i');

// Extract character name from a line that is a character cue (ALL CAPS word(s) alone on a line)
// or from a stage direction prefix like "John crosses to DSR"
function extractCharacterFromDirection(line, knownCharacters) {
  // Try known characters first
  for (const name of knownCharacters) {
    if (line.toUpperCase().startsWith(name.toUpperCase())) return name;
  }
  // Try "NAME verb" pattern at line start
  const nameMatch = line.match(/^([A-Z][A-Z\s]{1,20}?)\s+(?:crosses|moves|enters|walks|goes|steps|runs|backs|exits|leaves)/i);
  if (nameMatch) return nameMatch[1].trim();
  return null;
}

function parseLineForBlocking(line, lineIndex, knownCharacters) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Check for exit
  const exitVerbRe = new RegExp(`\\b(${EXIT_VERBS.join('|')})\\b`, 'i');
  const hasExit = exitVerbRe.test(trimmed);

  // Check for zone
  const zoneMatch = trimmed.match(ZONE_RE);
  const zone = zoneMatch ? normalizeZone(zoneMatch[0]) : null;

  // Check for movement verb
  const moveVerbRe = new RegExp(`\\b(${MOVE_VERBS.map(v => v.replace(/ /g, '\\s+')).join('|')})\\b`, 'i');
  const hasMoveVerb = moveVerbRe.test(trimmed);

  if (!hasMoveVerb && !hasExit) return null;
  if (!zone && !hasExit) return null;

  const character = extractCharacterFromDirection(trimmed, knownCharacters);
  if (!character) return null;

  const action = hasExit ? 'exits' : (trimmed.match(moveVerbRe)?.[0] || 'moves to');

  return {
    character,
    action,
    location: hasExit ? null : zone,
    script_line_index: lineIndex,
    confidence: zone ? 1.0 : 0.5,
  };
}

// First pass: find all character names (lines that are just ALL CAPS, possibly with spaces)
function detectCharacters(lines) {
  const names = new Set();
  for (const line of lines) {
    const trimmed = line.trim();
    // Character cue lines: ALL CAPS, 1–4 words, no punctuation except hyphens
    if (/^[A-Z][A-Z\s\-]{0,30}$/.test(trimmed) && trimmed.length >= 2 && trimmed.split(/\s+/).length <= 4) {
      // Exclude common non-character headers
      if (!['ACT ONE', 'ACT TWO', 'SCENE', 'END OF', 'INTERMISSION', 'THE END', 'FADE OUT', 'BLACKOUT'].some(h => trimmed.startsWith(h))) {
        names.add(trimmed);
      }
    }
  }
  return [...names];
}

/**
 * parseBlockingNotes(textLines, _apiKey, onProgress)
 * Pure regex-based parser — no external API.
 * Returns { resolved: [...], unresolved: [...], error: null }
 */
export async function parseBlockingNotes(textLines, _apiKey, onProgress) {
  const resolved = [];
  const unresolved = [];

  // Detect character names from the script
  const knownCharacters = detectCharacters(textLines);

  const chunkSize = 10;
  const totalChunks = Math.ceil(textLines.length / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    if (onProgress) onProgress(i + 1, totalChunks);

    const start = i * chunkSize;
    const chunk = textLines.slice(start, start + chunkSize);

    for (let j = 0; j < chunk.length; j++) {
      const lineIndex = start + j;
      const line = chunk[j];

      const event = parseLineForBlocking(line, lineIndex, knownCharacters);
      if (!event) continue;

      if (event.confidence >= 0.7 && event.location !== undefined) {
        resolved.push(event);
      } else {
        unresolved.push({
          id: `unresolved-${lineIndex}`,
          text: line,
          script_line_index: lineIndex,
          character: event.character,
          reason: 'Could not confidently determine location',
          rawEvent: event,
        });
      }
    }

    // Yield to keep UI responsive
    await new Promise(r => setTimeout(r, 0));
  }

  return { resolved, unresolved, error: null };
}
