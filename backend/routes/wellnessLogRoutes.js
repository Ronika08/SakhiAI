/**
 * routes/wellnessLogRoutes.js – mounted at `/api/wellness`. Auth required.
 */

import { Router } from 'express';
import { upsertDay, getLogs, getSummary, deleteLog } from '../controllers/wellnessLogController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/', getLogs);
router.get('/summary', getSummary);
router.put('/:date', upsertDay);
router.delete('/:id', deleteLog);

export default router;
