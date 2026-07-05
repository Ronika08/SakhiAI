/**
 * routes/emergencyContactRoutes.js
 *
 * Route definitions for the Trusted Circle feature. Mounted at
 * `/api/contacts` by routes/index.js. Every route requires authentication
 * since contacts are always scoped to the logged-in user.
 */

import { Router } from 'express';
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
} from '../controllers/emergencyContactController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// All trusted-circle routes require an authenticated user.
router.use(protect);

/**
 * GET /api/contacts
 * List the current user's trusted contacts.
 */
router.get('/', getContacts);

/**
 * POST /api/contacts
 * Add a new trusted contact.
 */
router.post('/', createContact);

/**
 * PATCH /api/contacts/:id
 * Update an existing trusted contact.
 */
router.patch('/:id', updateContact);

/**
 * DELETE /api/contacts/:id
 * Remove a trusted contact.
 */
router.delete('/:id', deleteContact);

export default router;
