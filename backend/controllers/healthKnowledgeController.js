/**
 * controllers/healthKnowledgeController.js
 *
 * HTTP layer for browsing/searching the offline Health Knowledge Base
 * (backs the Health Tips feature). These routes are public/read-only —
 * no authentication required, since health tips are general-purpose
 * content, not user-specific data.
 */

import { AppError } from '../middleware/errorHandler.js';
import healthKnowledgeService from '../services/healthKnowledgeService.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const VALID_CATEGORIES = ['cycle', 'wellness', 'safety'];

/**
 * GET /api/health-tips
 * Query params: category? ("cycle" | "wellness" | "safety")
 */
export const getTips = asyncHandler(async (req, res) => {
  const { category } = req.query;

  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    throw new AppError(`Query param "category" must be one of: ${VALID_CATEGORIES.join(', ')}.`, 400);
  }

  const tips = healthKnowledgeService.listByCategory(category);
  res.status(200).json({ success: true, data: { tips } });
});

/**
 * GET /api/health-tips/search
 * Query params: q (required), limit? (defaults to 3)
 * Declared before "/:id" at the router level so "search" isn't captured
 * as an id param.
 */
export const searchTips = asyncHandler(async (req, res) => {
  const { q, limit } = req.query;

  if (!q || typeof q !== 'string' || !q.trim()) {
    throw new AppError('Query param "q" is required.', 400);
  }

  let parsedLimit = 3;
  if (limit !== undefined) {
    parsedLimit = parseInt(limit, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
      throw new AppError('Query param "limit" must be a positive number.', 400);
    }
  }

  const results = healthKnowledgeService.search(q.trim(), parsedLimit);
  res.status(200).json({ success: true, data: { results } });
});

/**
 * GET /api/health-tips/:id
 */
export const getTip = asyncHandler(async (req, res) => {
  const tip = healthKnowledgeService.getById(req.params.id);

  if (!tip) {
    throw new AppError('Health tip not found.', 404);
  }

  res.status(200).json({ success: true, data: { tip } });
});

export default { getTips, searchTips, getTip };
