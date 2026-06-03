// timeline.js — blocking event timeline logic

/**
 * buildTimeline(blockingEvents)
 * Sort events by script_line_index, return ordered array.
 */
export function buildTimeline(blockingEvents) {
  return [...blockingEvents].sort((a, b) => a.script_line_index - b.script_line_index);
}

/**
 * applyStep(timeline, stepIndex, initialPositions)
 * Compute character positions after applying all events up to and including stepIndex.
 * initialPositions: { characterName: zoneName } — starting positions (or empty)
 * Returns { characterName: zoneName }
 */
export function applyStep(timeline, stepIndex, initialPositions = {}) {
  const positions = { ...initialPositions };

  for (let i = 0; i <= stepIndex && i < timeline.length; i++) {
    const evt = timeline[i];
    if (evt.character && evt.location) {
      positions[evt.character] = evt.location;
    }
  }

  return positions;
}

/**
 * applyStepFromScratch(timeline, stepIndex)
 * Compute positions by replaying from the beginning up to stepIndex.
 */
export function applyStepFromScratch(timeline, stepIndex) {
  return applyStep(timeline, stepIndex, {});
}

/**
 * getConflictsAtStep(techElements, characterPositions)
 * Returns array of { techElementId, techElementName, character, zone }
 */
export function getConflictsAtStep(techElements, characterPositions) {
  const conflicts = [];
  for (const tech of techElements) {
    for (const [charName, zone] of Object.entries(characterPositions)) {
      if (zone && tech.zone === zone) {
        conflicts.push({
          techElementId: tech.id,
          techElementName: tech.name,
          character: charName,
          zone,
        });
      }
    }
  }
  return conflicts;
}

/**
 * getAllCharacters(timeline)
 * Extract unique character names from timeline.
 */
export function getAllCharacters(timeline) {
  const names = new Set();
  for (const evt of timeline) {
    if (evt.character) names.add(evt.character);
  }
  return Array.from(names);
}
