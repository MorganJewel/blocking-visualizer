// conflict.js — tech element vs character conflict detection

import { applyStepFromScratch, getConflictsAtStep } from './timeline.js';

/**
 * checkAllConflicts(techElements, timeline, characters)
 * Iterate all steps in the timeline, find zone collisions between
 * characters and tech elements.
 * Returns array of { stepIndex, techElementId, techElementName, character, zone }
 */
export function checkAllConflicts(techElements, timeline, characters) {
  if (!techElements.length || !timeline.length) return [];

  const allConflicts = [];

  for (let stepIndex = 0; stepIndex < timeline.length; stepIndex++) {
    const positions = applyStepFromScratch(timeline, stepIndex);

    // Only consider visible characters
    const filteredPositions = {};
    for (const [name, zone] of Object.entries(positions)) {
      if (!characters[name] || characters[name].visible !== false) {
        filteredPositions[name] = zone;
      }
    }

    const stepConflicts = getConflictsAtStep(techElements, filteredPositions);
    for (const conflict of stepConflicts) {
      allConflicts.push({ stepIndex, ...conflict });
    }
  }

  return allConflicts;
}

/**
 * checkStepConflicts(techElements, characterPositions)
 * Check conflicts at a single step. Returns array of conflict objects.
 */
export function checkStepConflicts(techElements, characterPositions) {
  return getConflictsAtStep(techElements, characterPositions);
}

/**
 * getConflictingTechIds(conflicts)
 * Get the set of tech element ids that have any conflict.
 */
export function getConflictingTechIds(conflicts) {
  return [...new Set(conflicts.map(c => c.techElementId))];
}

/**
 * getConflictsAtStepIndex(allConflicts, stepIndex)
 * Filter pre-computed allConflicts to a specific step.
 */
export function getConflictsAtStepIndex(allConflicts, stepIndex) {
  return allConflicts.filter(c => c.stepIndex === stepIndex);
}
