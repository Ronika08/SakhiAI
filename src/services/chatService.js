/**
 * services/chatService.js
 *
 * Phase 6 — Hybrid AI Assistant: Rule Engine matching logic.
 * Phase 6.3 — Intent-Based Medical Rule Engine.
 *
 * This is the "fast path" in the hybrid architecture — UNCHANGED since
 * Phase 6.1/6.2:
 *
 *   User → Rule Engine → Rule found? → YES → Immediate Reply → END
 *                              │
 *                              NO
 *                              ↓
 *                          AI Fallback → END
 *
 * Phase 6.3 adds a second, optional matching step that runs strictly
 * AFTER a category has already matched, and strictly BEFORE returning:
 *
 *   Category matched (e.g. "PCOS")
 *           │
 *           ▼
 *   Does the message also match a known INTENT for that category
 *   (e.g. "Diet", "Symptoms", "Treatment")?
 *           │
 *      ┌────┴────┐
 *     YES         NO
 *      │           │
 *      ▼           ▼
 *  Specialized   Existing category-level
 *  intent reply  generic reply (unchanged
 *                behavior from Phase 6.1)
 *
 * Either way, this still returns a single, immediate, non-AI reply — the
 * AI is still only ever reached when NO category matches at all. Nothing
 * about that outer flow, or the emergency-first priority, changes here.
 *
 * Rule data lives in constants/ruleEngineData.js (categories).
 * Intent data lives in constants/medicalIntents.js (sub-intents).
 * This file only contains matching logic, so responses can be edited in
 * either data file without touching how matching works.
 *
 * Public API is unchanged from Phase 6.1:
 *   getRuleResponse(message) -> { reply, action, category, isEmergency } | null
 * Existing callers (SakhiAI.jsx) keep working without modification.
 * One additional, non-breaking field (`intent`) is now included on the
 * returned object — `null` whenever no specific intent applied, exactly
 * preserving the old generic-reply behavior for those cases.
 */

import { RULES } from "../constants/ruleEngineData";
import { INTENTS } from "../constants/medicalIntents";

/**
 * Emergency rules are always checked first, regardless of where they sit
 * in the RULES array, so an emergency keyword can never lose priority to
 * an unrelated rule earlier in the list. Everything else is matched in
 * the order it's defined in ruleEngineData.js.
 */
const PRIORITIZED_RULES = [
  ...RULES.filter((rule) => rule.isEmergency),
  ...RULES.filter((rule) => !rule.isEmergency),
];

/**
 * Keyword matching. Longer keywords are substring matches (unchanged behaviour).
 * Very short keywords ("hi", "hey", "pms"...) must match a whole word, otherwise
 * "hi" would match inside "this", "which" or "think" and swallow real questions
 * as greetings before they could reach the local knowledge base or the AI.
 */
function keywordMatches(text, keyword) {
  if (keyword.length <= 3) {
    return new RegExp(`(^|[^\\p{L}\\p{N}])${keyword}($|[^\\p{L}\\p{N}])`, "u").test(text);
  }
  return text.includes(keyword);
}

/**
 * Looks for a specific intent within an already-matched category.
 * Emergency is intentionally never passed through here — it must never
 * be narrowed, delayed, or reworded past its original immediate reply.
 *
 * @param {string} category
 * @param {string} lowerCaseText
 * @returns {{ intent: string, reply: string } | null}
 */
function matchIntent(category, lowerCaseText) {
  const intentsForCategory = INTENTS[category];
  if (!intentsForCategory) return null;

  for (const intentRule of intentsForCategory) {
    if (intentRule.keywords.some((k) => keywordMatches(lowerCaseText, k))) {
      return { intent: intentRule.intent, reply: intentRule.reply };
    }
  }

  return null;
}

/**
 * Matches a user message against the rule engine.
 *
 * Never matches twice / never falls through to AI once a category
 * matches — the caller (SakhiAI.jsx) relies on a non-null return here to
 * stop and render the reply immediately, without calling the AI
 * fallback. This holds whether or not a specific intent was also found.
 *
 * @param {string} message - Raw user input.
 * @returns {{
 *   reply: string,
 *   action: string | null,
 *   category: string,
 *   isEmergency: boolean,
 *   intent: string | null
 * } | null}
 */
export function getRuleResponse(message) {
  if (!message || typeof message !== "string") return null;

  const text = message.toLowerCase();

  for (const rule of PRIORITIZED_RULES) {
    if (rule.keywords.some((k) => keywordMatches(text, k))) {
      // Category matched. Emergency skips intent-matching entirely and
      // always returns its single, immediate reply as-is.
      if (rule.isEmergency) {
        return {
          reply: rule.reply,
          action: rule.action,
          category: rule.category,
          isEmergency: rule.isEmergency,
          intent: null,
        };
      }

      // Try to narrow to a specific intent within this category.
      const intentMatch = matchIntent(rule.category, text);

      return {
        reply: intentMatch ? intentMatch.reply : rule.reply,
        action: rule.action,
        category: rule.category,
        isEmergency: rule.isEmergency,
        intent: intentMatch ? intentMatch.intent : null,
      };
    }
  }

  return null;
}