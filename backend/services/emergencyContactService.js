/**
 * services/emergencyContactService.js
 *
 * Business logic for managing a user's "Trusted Circle" — the emergency
 * contacts notified during SOS triggers or missed Safety Check-Ins.
 * Kept separate from the controller so validation/ownership rules live
 * in one reusable place.
 */

import EmergencyContact from '../models/EmergencyContact.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const MAX_CONTACTS_PER_USER = 10;

/**
 * Lists all trusted-circle contacts for a user, primary contacts first.
 */
async function listContacts(userId) {
  return EmergencyContact.find({ user: userId }).sort({ isPrimary: -1, createdAt: 1 });
}

/**
 * Adds a new trusted contact for a user.
 *
 * @param {string} userId
 * @param {Object} data - { name, phone, email, relation, isPrimary }
 */
async function addContact(userId, data) {
  const count = await EmergencyContact.countDocuments({ user: userId });
  if (count >= MAX_CONTACTS_PER_USER) {
    throw new AppError(`You can have at most ${MAX_CONTACTS_PER_USER} trusted contacts.`, 400);
  }

  try {
    const contact = await EmergencyContact.create({ ...data, user: userId });
    logger.info(`Trusted contact added for user ${userId}: ${contact.phone}`);
    return contact;
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError('This phone number is already in your trusted circle.', 409);
    }
    throw err;
  }
}

/**
 * Updates an existing trusted contact, scoped to its owning user so one
 * user can never modify another user's contact by guessing an id.
 */
async function updateContact(userId, contactId, updates) {
  const contact = await EmergencyContact.findOneAndUpdate(
    { _id: contactId, user: userId },
    updates,
    { new: true, runValidators: true }
  );

  if (!contact) {
    throw new AppError('Trusted contact not found.', 404);
  }

  return contact;
}

/**
 * Removes a trusted contact, scoped to its owning user.
 */
async function removeContact(userId, contactId) {
  const result = await EmergencyContact.findOneAndDelete({ _id: contactId, user: userId });
  if (!result) {
    throw new AppError('Trusted contact not found.', 404);
  }
  logger.info(`Trusted contact removed for user ${userId}: ${contactId}`);
  return result;
}

export default { listContacts, addContact, updateContact, removeContact };
