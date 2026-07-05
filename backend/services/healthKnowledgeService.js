/**
 * services/healthKnowledgeService.js
 *
 * Offline Health Knowledge Base + AI Fallback Responses.
 *
 * This module serves two purposes:
 *   1. A small, curated set of women's health/safety Q&A entries that can
 *      be searched without calling any external AI provider — useful for
 *      instant answers to common questions and for offline-first behavior.
 *   2. A fallback response generator that `aiProvider`/`chatController`
 *      can call when every configured AI provider is unavailable (missing
 *      API key, network failure, rate limit), so the chat feature degrades
 *      gracefully instead of failing outright.
 *
 * This is intentionally simple keyword matching, not a real search index.
 * It can be swapped for a proper vector/full-text search later without
 * changing the public functions exported here.
 */

import logger from '../utils/logger.js';

/**
 * Each entry: { id, category, question, answer, keywords[] }
 * `keywords` drives matching against a user's free-text query.
 */
const KNOWLEDGE_BASE = [
  {
    id: 'cycle-length',
    category: 'cycle',
    question: 'What is a normal menstrual cycle length?',
    answer:
      'A typical menstrual cycle ranges from 21 to 35 days, counted from the first day of one period to the first day of the next. Cycles that are consistently shorter, longer, or highly irregular are worth discussing with a doctor.',
    keywords: ['cycle length', 'normal period', 'cycle days', 'how long is a period'],
  },
  {
    id: 'period-pain',
    category: 'cycle',
    question: 'How can I manage period cramps?',
    answer:
      'Mild period cramps can often be eased with a heating pad, gentle movement, staying hydrated, and over-the-counter pain relief as directed on the label. If pain is severe, worsening, or disrupts daily life, please see a doctor — it could indicate a condition like endometriosis.',
    keywords: ['cramps', 'period pain', 'menstrual pain', 'dysmenorrhea'],
  },
  {
    id: 'missed-period',
    category: 'cycle',
    question: 'Why might I miss a period?',
    answer:
      'A missed period can be caused by stress, significant weight changes, intense exercise, hormonal birth control, pregnancy, or underlying conditions like PCOS or thyroid issues. If you miss a period unexpectedly, consider a pregnancy test if relevant and consult a doctor if it continues.',
    keywords: ['missed period', 'late period', 'no period'],
  },
  {
    id: 'mood-swings',
    category: 'wellness',
    question: 'Why do I feel more emotional before my period?',
    answer:
      'Hormonal shifts in the days before a period (often called PMS) can affect mood, causing irritability, sadness, or anxiety for some people. Regular sleep, light exercise, and tracking your mood alongside your cycle can help you anticipate and manage these shifts.',
    keywords: ['mood swings', 'pms', 'emotional before period', 'irritable'],
  },
  {
    id: 'stress-management',
    category: 'wellness',
    question: 'How can I manage everyday stress?',
    answer:
      'Simple habits — regular sleep, short walks, deep breathing, journaling, and staying connected with people you trust — can meaningfully reduce day-to-day stress. If stress feels constant or overwhelming, talking to a mental health professional can help.',
    keywords: ['stress', 'anxiety', 'overwhelmed', 'relax'],
  },
  {
    id: 'safety-checkin',
    category: 'safety',
    question: 'What is a Safety Check-In and when should I use it?',
    answer:
      'A Safety Check-In lets you set a deadline for a trip or outing. If you don\u2019t confirm you\u2019re safe by that time, your Trusted Circle is automatically notified. It\u2019s useful for solo travel, late commutes, first dates, or any time you want someone watching out for you.',
    keywords: ['check-in', 'checkin', 'safety check', 'trusted circle notify'],
  },
  {
    id: 'emergency-sos',
    category: 'safety',
    question: 'What happens when I trigger Emergency SOS?',
    answer:
      'Triggering Emergency SOS immediately shares your live location and an alert message with your Trusted Circle contacts. Use it any time you feel unsafe. In a life-threatening emergency, also contact local emergency services directly.',
    keywords: ['sos', 'emergency', 'panic button', 'unsafe'],
  },
  {
    id: 'trusted-circle-setup',
    category: 'safety',
    question: 'How do I set up my Trusted Circle?',
    answer:
      'Add the people you\u2019d want notified in an emergency — close family, friends, or roommates — with their name and phone number. You can mark one as primary and choose whether they\u2019re notified for SOS alerts, missed check-ins, or both.',
    keywords: ['trusted circle', 'add contact', 'emergency contact setup'],
  },
];

/**
 * Searches the offline knowledge base for entries relevant to a query,
 * using simple keyword/substring matching. Returns entries sorted by
 * how many keywords matched (most relevant first).
 *
 * @param {string} query
 * @param {number} [limit=3]
 */
function search(query, limit = 3) {
  if (!query || typeof query !== 'string') return [];

  const normalized = query.toLowerCase();

  const scored = KNOWLEDGE_BASE.map((entry) => {
    const matchCount = entry.keywords.filter((kw) => normalized.includes(kw)).length;
    const questionMatch = entry.question.toLowerCase().includes(normalized) ? 1 : 0;
    return { entry, score: matchCount + questionMatch };
  }).filter((item) => item.score > 0);

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((item) => item.entry);
}

/**
 * Fetches a single knowledge base entry by id.
 */
function getById(id) {
  return KNOWLEDGE_BASE.find((entry) => entry.id === id) || null;
}

/**
 * Lists all entries, optionally filtered by category
 * ("cycle" | "wellness" | "safety").
 */
function listByCategory(category) {
  if (!category) return KNOWLEDGE_BASE;
  return KNOWLEDGE_BASE.filter((entry) => entry.category === category);
}

/**
 * Generates a fallback chat reply when no AI provider is available.
 * Tries the offline knowledge base first; if nothing matches closely
 * enough, returns a clear, honest message rather than pretending to
 * understand the question.
 *
 * @param {string} message - The user's chat message.
 * @returns {{ reply: string, provider: string, matchedEntryId: string|null }}
 */
function getFallbackResponse(message) {
  const matches = search(message, 1);

  if (matches.length > 0) {
    logger.info(`AI fallback served from knowledge base: ${matches[0].id}`);
    return {
      reply: matches[0].answer,
      provider: 'offline-knowledge-base',
      matchedEntryId: matches[0].id,
    };
  }

  logger.warn('AI fallback: no knowledge base match found for message.');
  return {
    reply:
      "I'm having trouble reaching the AI assistant right now, and I don't have a ready answer for that in my offline knowledge base. Please try again in a moment, or reach out to a healthcare professional for anything urgent.",
    provider: 'offline-knowledge-base',
    matchedEntryId: null,
  };
}

export default { search, getById, listByCategory, getFallbackResponse };
