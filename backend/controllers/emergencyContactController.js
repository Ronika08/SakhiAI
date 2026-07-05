/**
 * controllers/emergencyContactController.js
 *
 * HTTP layer for the Trusted Circle feature. All routes here are expected
 * to run behind the `protect` auth middleware, so `req.user.id` is always
 * available. Validation of request bodies happens here; ownership rules
 * and persistence live in services/emergencyContactService.js.
 */

import { AppError } from '../middleware/errorHandler.js';
import emergencyContactService from '../services/emergencyContactService.js';

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const PHONE_REGEX = /^[+]?[\d\s()-]{7,20}$/;

/**
 * Validates the subset of contact fields present in the request body.
 * Used by both create (all required) and update (all optional) handlers.
 */
function validateContactFields(body, { requireAll }) {
  const { name, phone, email, relation, isPrimary } = body;

  if (requireAll || name !== undefined) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new AppError('Field "name" is required and must be a non-empty string.', 400);
    }
  }

  if (requireAll || phone !== undefined) {
    if (!phone || typeof phone !== 'string' || !PHONE_REGEX.test(phone.trim())) {
      throw new AppError('A valid "phone" number is required.', 400);
    }
  }

  if (email !== undefined && email !== null) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
      throw new AppError('Field "email" must be a valid email address.', 400);
    }
  }

  if (relation !== undefined && relation !== null && typeof relation !== 'string') {
    throw new AppError('Field "relation" must be a string.', 400);
  }

  if (isPrimary !== undefined && typeof isPrimary !== 'boolean') {
    throw new AppError('Field "isPrimary" must be a boolean.', 400);
  }

  return {
    ...(name !== undefined && { name: name.trim() }),
    ...(phone !== undefined && { phone: phone.trim() }),
    ...(email !== undefined && { email: email ? email.trim() : null }),
    ...(relation !== undefined && { relation }),
    ...(isPrimary !== undefined && { isPrimary }),
  };
}

/**
 * GET /api/contacts
 */
export const getContacts = asyncHandler(async (req, res) => {
  const contacts = await emergencyContactService.listContacts(req.user.id);
  res.status(200).json({ success: true, data: { contacts } });
});

/**
 * POST /api/contacts
 * Body: { name, phone, email?, relation?, isPrimary? }
 */
export const createContact = asyncHandler(async (req, res) => {
  const data = validateContactFields(req.body, { requireAll: true });
  const contact = await emergencyContactService.addContact(req.user.id, data);
  res.status(201).json({ success: true, data: { contact } });
});

/**
 * PATCH /api/contacts/:id
 * Body: any subset of { name, phone, email, relation, isPrimary }
 */
export const updateContact = asyncHandler(async (req, res) => {
  const updates = validateContactFields(req.body, { requireAll: false });

  if (Object.keys(updates).length === 0) {
    throw new AppError('At least one field must be provided to update.', 400);
  }

  const contact = await emergencyContactService.updateContact(req.user.id, req.params.id, updates);
  res.status(200).json({ success: true, data: { contact } });
});

/**
 * DELETE /api/contacts/:id
 */
export const deleteContact = asyncHandler(async (req, res) => {
  await emergencyContactService.removeContact(req.user.id, req.params.id);
  res.status(200).json({ success: true, message: 'Trusted contact removed.' });
});

export default { getContacts, createContact, updateContact, deleteContact };
