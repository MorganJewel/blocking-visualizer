// apertus.js — HuggingFace API calls + blocking script generation

const ZONE_FULL_NAMES = {
  USL: 'upstage left',  USC: 'upstage center',  USR: 'upstage right',
  SL:  'stage left',    CS:  'center stage',     SR:  'stage right',
  DSL: 'downstage left',DSC: 'downstage center', DSR: 'downstage right',
};

function detectStyle(scriptText) {
  if (!scriptText) return { format: 'standard', zones: 'abbrev', names: 'upper' };

  const parenDirections = (scriptText.match(/\([^)]*(?:cross|enter|exit|move|walk)[^)]*\)/gi) || []).length;
  const abbrevZones = (scriptText.match(/\b(DSR|DSL|DSC|USR|USL|USC|SL|SR|CS)\b/g) || []).length;
  const fullZones   = (scriptText.match(/\b(downstage|upstage|stage left|stage right|center stage)\b/gi) || []).length;
  const capsLines   = (scriptText.match(/^[A-Z][A-Z\s]{1,25}$/gm) || []).length;

  return {
    format: parenDirections > 2 ? 'parens' : 'standard',
    zones:  abbrevZones >= fullZones ? 'abbrev' : 'full',
    names:  capsLines > 3 ? 'upper' : 'title',
  };
}

/**
 * generateBlockingScript(events, scriptText, formatOverride)
 * Converts blocking events to written notation.
 * formatOverride: 'auto' | 'standard' | 'parens' | 'narrative'
 */
export function generateBlockingScript(events, scriptText, formatOverride = 'auto') {
  if (!events || events.length === 0) return '';

  const detected = detectStyle(scriptText);
  const useParens     = formatOverride === 'parens'    || (formatOverride === 'auto' && detected.format === 'parens');
  const useFullZones  = formatOverride === 'narrative' || (formatOverride === 'auto' && detected.zones === 'full');
  const useUpperNames = formatOverride !== 'narrative' && (formatOverride === 'auto' ? detected.names === 'upper' : formatOverride === 'standard');

  const lines = events.map(evt => {
    const name = useUpperNames ? evt.character.toUpperCase() : evt.character;
    const zone = evt.location
      ? (useFullZones ? (ZONE_FULL_NAMES[evt.location] || evt.location) : evt.location)
      : null;

    let line;
    if (!zone || evt.action === 'exits') {
      line = `${name} exits.`;
    } else if (evt.action === 'enters') {
      line = `${name} enters ${useFullZones ? 'at ' : ''}${zone}.`;
    } else {
      line = `${name} ${evt.action} ${zone}.`;
    }

    return useParens ? `(${line})` : line;
  });

  return lines.join('\n');
}

const HF_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';

const VALID_ZONES = ['USL', 'USC', 'USR', 'SL', 'CS', 'SR', 'DSL', 'DSC', 'DSR'];

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function buildPrompt(lines) {
  const text = lines.join('\n');
  return `<s>[INST] You are a theatrical blocking note parser. Extract stage directions from the following script excerpt.

Stage zones are: USL (upstage left), USC (upstage center), USR (upstage right), SL (stage left), CS (center stage), SR (stage right), DSL (downstage left), DSC (downstage center), DSR (downstage right).

For each blocking direction you find, output a JSON object with:
- "character": the character name (string)
- "action": the type of movement such as "crosses to", "enters", "exits", "moves to" (string)
- "location": one of the 9 zone codes above (string), or null if exiting
- "script_line_index": the 0-based index of the line in the excerpt where this appears (number)
- "confidence": your confidence from 0.0 to 1.0 that you correctly identified this blocking note (number)

Return ONLY a valid JSON array. No explanation, no markdown, no extra text. If there are no blocking directions, return an empty array [].

Script excerpt:
${text}
[/INST]</s>`;
}

function extractJSON(raw) {
  const trimmed = raw.trim();
  const arrMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch (e) {
      // fall through
    }
  }
  return null;
}

function validateEvent(evt, chunkStartIndex) {
  if (!evt || typeof evt !== 'object') return null;
  const character = typeof evt.character === 'string' ? evt.character.trim() : null;
  const action = typeof evt.action === 'string' ? evt.action.trim() : 'moves to';
  let location = typeof evt.location === 'string' ? evt.location.trim().toUpperCase() : null;
  const script_line_index = typeof evt.script_line_index === 'number'
    ? chunkStartIndex + evt.script_line_index
    : chunkStartIndex;
  const confidence = typeof evt.confidence === 'number' ? evt.confidence : 0.5;

  if (!character) return null;

  if (location && !VALID_ZONES.includes(location)) {
    const zoneMap = {
      'UPSTAGE LEFT': 'USL', 'UPSTAGE CENTER': 'USC', 'UPSTAGE RIGHT': 'USR',
      'STAGE LEFT': 'SL', 'CENTER STAGE': 'CS', 'CENTER': 'CS', 'STAGE RIGHT': 'SR',
      'DOWNSTAGE LEFT': 'DSL', 'DOWNSTAGE CENTER': 'DSC', 'DOWNSTAGE RIGHT': 'DSR',
      'UP LEFT': 'USL', 'UP CENTER': 'USC', 'UP RIGHT': 'USR',
      'DOWN LEFT': 'DSL', 'DOWN CENTER': 'DSC', 'DOWN RIGHT': 'DSR',
    };
    location = zoneMap[location] || null;
  }

  return { character, action, location, script_line_index, confidence };
}

/**
 * parseBlockingNotes(textLines, apiKey, onProgress)
 * Chunks lines into groups of 10, sends each to HuggingFace,
 * parses the JSON response, separates resolved vs unresolved.
 * Returns { resolved: [...], unresolved: [...], error: null|string }
 */
export async function parseBlockingNotes(textLines, apiKey, onProgress) {
  const key = apiKey || import.meta.env.VITE_HF_API_KEY || '';
  if (!key) {
    return { resolved: [], unresolved: [], error: 'No HuggingFace API key set. Go to Settings to add your key.' };
  }

  const chunks = chunkArray(textLines, 10);
  const resolved = [];
  const unresolved = [];
  let errorMsg = null;

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);

    const chunk = chunks[i];
    const chunkStartIndex = i * 10;
    const prompt = buildPrompt(chunk);

    let raw = '';
    try {
      const response = await fetch(HF_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 512,
            temperature: 0.1,
            return_full_text: false,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 503) {
          await new Promise(r => setTimeout(r, 8000));
          const retry = await fetch(HF_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: prompt,
              parameters: { max_new_tokens: 512, temperature: 0.1, return_full_text: false },
            }),
          });
          if (!retry.ok) {
            errorMsg = `HuggingFace API error: ${retry.status}`;
            continue;
          }
          const retryData = await retry.json();
          raw = Array.isArray(retryData) ? (retryData[0]?.generated_text || '') : (retryData.generated_text || '');
        } else {
          errorMsg = `HuggingFace API error ${response.status}: ${errText.slice(0, 200)}`;
          continue;
        }
      } else {
        const data = await response.json();
        raw = Array.isArray(data) ? (data[0]?.generated_text || '') : (data.generated_text || '');
      }
    } catch (fetchErr) {
      errorMsg = `Network error: ${fetchErr.message}`;
      continue;
    }

    const parsed = extractJSON(raw);
    if (!parsed || !Array.isArray(parsed)) {
      chunk.forEach((line, idx) => {
        if (line.trim()) {
          unresolved.push({
            id: `unresolved-${chunkStartIndex + idx}`,
            text: line,
            script_line_index: chunkStartIndex + idx,
            reason: 'Could not parse AI response',
          });
        }
      });
      continue;
    }

    for (const evt of parsed) {
      const validated = validateEvent(evt, chunkStartIndex);
      if (!validated) continue;

      if (validated.confidence >= 0.7 && validated.location) {
        resolved.push(validated);
      } else {
        const localIdx = evt.script_line_index || 0;
        const lineText = chunk[localIdx] || chunk[0] || '';
        unresolved.push({
          id: `unresolved-${validated.script_line_index}`,
          text: lineText,
          script_line_index: validated.script_line_index,
          character: validated.character,
          reason: validated.confidence < 0.7
            ? `Low confidence (${(validated.confidence * 100).toFixed(0)}%)`
            : 'No valid location detected',
          rawEvent: validated,
        });
      }
    }
  }

  return { resolved, unresolved, error: errorMsg };
}
