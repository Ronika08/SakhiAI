/**
 * Shared helper for knowledge-base entries.
 *
 * Entry shape:
 *   id        unique id
 *   topic     periods | pcos | pregnancy | nutrition | womens-health | first-aid |
 *             safety | mental | medication | cycle-tracking | wellness | emergency
 *   priority  higher wins when several entries match (safety-critical ≥ 10)
 *   kw        { en, hi, kn } keyword lists. A keyword is a string (substring /
 *             word-start match) or an array of strings that must ALL appear.
 *             Keywords of every language are matched regardless of the selected UI
 *             language, so a Hindi question typed while the UI is English still works.
 *   title     short localized label (used for topic suggestions)
 *   a         { en, hi, kn } the answer. Entries without hi/kn fall back to English
 *             with a visible note.
 *   action    optional UI action (e.g. OPEN_EMERGENCY)
 *   critical  true for safety/emergency answers (no extra disclaimer appended)
 */
export const entry = (id, topic, priority, kw, title, a, extra = {}) => ({
  id, topic, priority, kw, title, a, ...extra,
})
