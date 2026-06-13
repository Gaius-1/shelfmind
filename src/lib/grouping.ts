import { normalizeWeight } from './normalization.ts'

/**
 * Signal priority constants for grouping decisions.
 *
 * Barcode (1.0) > Weight/Volume blocker (0.95) > Name Tag OCR (0.85) > Visual similarity (0.65)
 */
export const GROUPING_SIGNAL_PRIORITY = {
  BARCODE: 1.0,
  WEIGHT_BLOCKER: 0.95,
  NAME_TAG_OCR: 0.85,
  VISUAL_SIMILARITY: 0.65,
} as const

/** Minimal extraction shape required by the grouping module. */
export type GroupableExtraction = {
  productGroupKey: string
  vision: Partial<Record<string, string>> | null
}

/**
 * Normalizes the product group key to a comparable string.
 */
function normalizeGroupKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Groups an array of extractions by normalized product group key, with a
 * weight-blocker heuristic: two extractions that share the same normalized
 * name key but have significantly different normalized WEIGHT values are
 * placed in separate groups.
 *
 * The weight blocker prevents, for example, a 500g and a 1kg variant of the
 * same product from being merged into a single IMDB record.
 */
export function groupExtractions<T extends GroupableExtraction>(
  extractions: T[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = {}

  for (const ext of extractions) {
    const baseKey = normalizeGroupKey(ext.productGroupKey)
    const extWeight = normalizeWeight(ext.vision?.WEIGHT ?? '')

    // Find which subgroup (baseKey or baseKey__weightN) this extraction belongs to
    let assignedKey = baseKey

    if (extWeight) {
      // Check existing groups that share the same base key
      const matchingKeys = Object.keys(groups).filter(
        (k) => k === baseKey || k.startsWith(`${baseKey}__w_`),
      )

      let foundCompatible = false
      for (const existingKey of matchingKeys) {
        const existingGroup = groups[existingKey]
        // Compare against the weight of the first item in the existing group
        const existingWeight = normalizeWeight(existingGroup[0].vision?.WEIGHT ?? '')

        if (!existingWeight || existingWeight === extWeight) {
          // Compatible — same weight or existing has no weight
          assignedKey = existingKey
          foundCompatible = true
          break
        }
        // Different weight → continue looking for another compatible subgroup
      }

      if (!foundCompatible && matchingKeys.length > 0) {
        // All existing subgroups have a different weight — create a new subgroup
        // Check if the base key group has no weight set; if so, we can still join it
        if (groups[baseKey]) {
          const baseWeight = normalizeWeight(groups[baseKey][0].vision?.WEIGHT ?? '')
          if (!baseWeight) {
            assignedKey = baseKey
          } else {
            assignedKey = `${baseKey}__w_${extWeight}`
          }
        } else {
          assignedKey = `${baseKey}__w_${extWeight}`
        }
      }
    }

    if (!groups[assignedKey]) {
      groups[assignedKey] = []
    }
    groups[assignedKey].push(ext)
  }

  return groups
}
