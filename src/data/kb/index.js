import { PERIODS, PCOS, PREGNANCY } from './core'
import { NUTRITION, WOMENS_HEALTH, FIRST_AID, MENTAL, MEDICATION, APP_HOWTO } from './health'
import { SAFETY, EMERGENCY } from './safety'

/** The complete local knowledge base. Works with no network. */
export const KNOWLEDGE_BASE = [
  ...EMERGENCY, ...SAFETY, ...FIRST_AID, ...MEDICATION,
  ...PERIODS, ...PCOS, ...PREGNANCY, ...NUTRITION, ...WOMENS_HEALTH, ...MENTAL, ...APP_HOWTO,
]

export const KB_TOPICS = [
  'periods', 'pcos', 'pregnancy', 'nutrition', 'womens-health', 'first-aid',
  'safety', 'mental', 'medication', 'cycle-tracking', 'wellness', 'emergency',
]
