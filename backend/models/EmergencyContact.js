/**
 * models/EmergencyContact.js
 *
 * Represents one entry in a user's "Trusted Circle" — the people who get
 * notified during a Safety Check-In failure or Emergency SOS trigger.
 *
 * Kept as its own collection (rather than only the embedded array on
 * User) so contacts can be queried, notified, and audited independently
 * of the user document as the SOS/notifications features grow.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const emergencyContactSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A contact must belong to a user.'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Contact name is required.'],
      trim: true,
      maxlength: [100, 'Name must be 100 characters or fewer.'],
    },
    phone: {
      type: String,
      required: [true, 'Contact phone number is required.'],
      trim: true,
      match: [/^[+]?[\d\s()-]{7,20}$/, 'Please provide a valid phone number.'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address.'],
    },
    relation: {
      type: String,
      trim: true,
      default: null, // e.g. "Sister", "Roommate", "Friend"
    },
    isPrimary: {
      type: Boolean,
      default: false, // primary contacts are notified first during SOS
    },
    notifyOn: {
      sos: { type: Boolean, default: true },
      checkInMissed: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

// A user shouldn't have duplicate contacts with the exact same phone number.
emergencyContactSchema.index({ user: 1, phone: 1 }, { unique: true });

const EmergencyContact = mongoose.model('EmergencyContact', emergencyContactSchema);

export default EmergencyContact;
