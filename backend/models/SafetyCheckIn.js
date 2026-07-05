/**
 * models/SafetyCheckIn.js
 *
 * Represents a single "Safety Check-In" session: a user signals they're
 * heading somewhere and expects to confirm they're safe by a deadline.
 * If the deadline passes without confirmation, the app (via a future
 * scheduled job/service) notifies the user's Trusted Circle.
 *
 * Lifecycle: pending -> confirmed | missed | cancelled
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const STATUS_VALUES = ['pending', 'confirmed', 'missed', 'cancelled'];

const safetyCheckInSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A check-in must belong to a user.'],
      index: true,
    },
    label: {
      type: String,
      trim: true,
      maxlength: [150, 'Label must be 150 characters or fewer.'],
      default: 'Safety Check-In',
    },
    startLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      address: { type: String, trim: true, default: null },
    },
    destination: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      address: { type: String, trim: true, default: null },
    },
    // The time by which the user must confirm they're safe.
    deadline: {
      type: Date,
      required: [true, 'A check-in deadline is required.'],
    },
    status: {
      type: String,
      enum: STATUS_VALUES,
      default: 'pending',
      index: true,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    // Snapshot of which trusted contacts should be alerted if this
    // check-in is missed. Stored at creation time so later edits to the
    // user's Trusted Circle don't retroactively change an in-flight check-in.
    notifyContacts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'EmergencyContact',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Efficiently find all pending check-ins whose deadline has passed
// (used by the future scheduled job that triggers "missed" notifications).
safetyCheckInSchema.index({ status: 1, deadline: 1 });

/**
 * Marks this check-in as confirmed (the user made it home safe).
 */
safetyCheckInSchema.methods.confirm = function confirm() {
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  return this.save();
};

/**
 * Marks this check-in as cancelled (the user no longer needs it tracked).
 */
safetyCheckInSchema.methods.cancel = function cancel() {
  this.status = 'cancelled';
  return this.save();
};

const SafetyCheckIn = mongoose.model('SafetyCheckIn', safetyCheckInSchema);

export default SafetyCheckIn;
