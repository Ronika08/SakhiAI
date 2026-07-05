/**
 * models/EmergencySOS.js
 *
 * Represents a single Emergency SOS ("panic button") trigger event.
 * Created the moment a user activates SOS; a future notification service
 * is responsible for alerting `contactsNotified` and updating `status`
 * to reflect whether those notifications actually went out.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const STATUS_VALUES = ['pending', 'sent', 'failed'];

const emergencySOSSchema = new Schema(
  {
    // The user who triggered this SOS event.
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'An SOS event must belong to a user.'],
      index: true,
    },

    // When the SOS was triggered on the server. Defaults to now, but kept
    // as an explicit field (rather than relying solely on createdAt) so
    // it can't be altered by unrelated document updates.
    triggeredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    // Location captured at the moment of trigger.
    latitude: {
      type: Number,
      required: [true, 'Latitude is required.'],
      min: [-90, 'Latitude must be between -90 and 90.'],
      max: [90, 'Latitude must be between -90 and 90.'],
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required.'],
      min: [-180, 'Longitude must be between -180 and 180.'],
      max: [180, 'Longitude must be between -180 and 180.'],
    },

    // Shareable map link (e.g. Google Maps URL) for the captured location,
    // generated at trigger time so it's included in outgoing alerts.
    locationUrl: {
      type: String,
      trim: true,
      default: null,
    },

    // Trusted Circle contacts this event notified (or attempted to notify).
    contactsNotified: [
      {
        type: Schema.Types.ObjectId,
        ref: 'EmergencyContact',
      },
    ],

    // Optional custom message sent alongside the alert.
    message: {
      type: String,
      trim: true,
      maxlength: [500, 'Message must be 500 characters or fewer.'],
      default: null,
    },

    // Delivery status of the SOS notification pipeline.
    status: {
      type: String,
      enum: {
        values: STATUS_VALUES,
        message: `Status must be one of: ${STATUS_VALUES.join(', ')}.`,
      },
      default: 'pending',
      index: true,
      required: true,
    },

    // Diagnostic context captured from the triggering device, useful for
    // support/debugging (e.g. "iPhone 14, iOS 17.4, SakhiAI v1.2.0").
    deviceInfo: {
      type: String,
      trim: true,
      default: null,
    },

    // Device battery percentage at trigger time (0-100), if available.
    batteryLevel: {
      type: Number,
      min: [0, 'Battery level must be between 0 and 100.'],
      max: [100, 'Battery level must be between 0 and 100.'],
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt / updatedAt
  }
);

// Speeds up "most recent SOS events for a user" queries (e.g. history view).
emergencySOSSchema.index({ user: 1, triggeredAt: -1 });

// Speeds up finding all events still awaiting/failing notification delivery,
// which a background retry job would query against.
emergencySOSSchema.index({ status: 1, triggeredAt: 1 });

const EmergencySOS = mongoose.model('EmergencySOS', emergencySOSSchema);

export default EmergencySOS;
