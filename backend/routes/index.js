/**
 * routes/index.js
 *
 * Central API router.
 *
 * This file is the single place where feature-specific route modules are
 * mounted under the `/api` prefix (applied in server.js). Individual route
 * files should stay focused on one feature/resource and must not define
 * their own top-level prefixing here — that mapping lives in this file so
 * the overall API surface is visible at a glance.
 *
 * To add a new feature: create routes/<feature>Routes.js, import it below,
 * and add one line to the `router.use(...)` block.
 */

import { Router } from 'express';
import chatRoutes from './chatRoutes.js';
import authRoutes from './authRoutes.js';
import emergencyContactRoutes from './emergencyContactRoutes.js';
import safetyCheckInRoutes from './safetyCheckInRoutes.js';
import emergencySOSRoutes from './emergencySOSRoutes.js';
import cycleLogRoutes from './cycleLogRoutes.js';
import moodLogRoutes from './moodLogRoutes.js';
import healthKnowledgeRoutes from './healthKnowledgeRoutes.js';
import safeRouteRoutes from './safeRouteRoutes.js';

const router = Router();

/**
 * GET /api
 * Simple index route so hitting the API root confirms the router is wired
 * up correctly and lists the available sub-resources.
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SakhiAI API',
    resources: [
      '/api/chat',
      '/api/auth',
      '/api/contacts',
      '/api/checkins',
      '/api/sos',
      '/api/cycles',
      '/api/moods',
      '/api/health-tips',
      '/api/routes',
    ],
  });
});

// Feature routes
router.use('/chat', chatRoutes);
router.use('/auth', authRoutes);
router.use('/contacts', emergencyContactRoutes);
router.use('/checkins', safetyCheckInRoutes);
router.use('/sos', emergencySOSRoutes);
router.use('/cycles', cycleLogRoutes);
router.use('/moods', moodLogRoutes);
router.use('/health-tips', healthKnowledgeRoutes);
router.use('/routes', safeRouteRoutes);

export default router;
