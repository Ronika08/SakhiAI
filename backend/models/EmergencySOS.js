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

// pending        – created, notifications not yet attempted
// sent           – at least one provider ACCEPTED an alert (delivery not guaranteed)
// failed         – providers configured, but every attempt failed / nobody reachable
// not_configured – no notification provider is configured on the server
// cancelled      – cancelled by the user
// resolved       – user marked themselves safe
const STATUS_VALUES = ['pending', 'sent', 'failed', 'not_configured', 'cancelled', 'resolved'];

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
    // False when the device could not obtain a GPS fix. The SOS is still
    // recorded and sent (without coordinates) — GPS failure must never block
    // an emergency.
    locationAvailable: { type: Boolean, default: true },
    // good ≤100 m · low ≤1000 m · poor >1000 m · unknown
    locationQuality: { type: String, enum: ['good', 'low', 'poor', 'unknown'], default: 'unknown' },
    accuracyMeters: { type: Number, min: 0, default: null },
    locationCapturedAt: { type: Date, default: null },
    // Client-generated ID so a retry after a network failure never creates a duplicate event.
    clientEventId: { type: String, trim: true, maxlength: 64, default: undefined },
    latitude: {
      type: Number,
      required: [
        function latRequired() {
          return this.locationAvailable !== false;
        },
        'Latitude is required.',
      ],
      min: [-90, 'Latitude must be between -90 and 90.'],
      max: [90, 'Latitude must be between -90 and 90.'],
    },
    longitude: {
      type: Number,
      required: [
        function lngRequired() {
          return this.locationAvailable !== false;
        },
        'Longitude is required.',
      ],
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
    // Per-attempt notification outcomes (see services/notificationService.js).
    notifications: [
      {
        provider: { type: String, default: null },
        channel: { type: String, default: null },
        contact: { type: Schema.Types.ObjectId, ref: 'EmergencyContact', default: null },
        contactName: { type: String, default: null },
        status: { type: String, required: true },
        detail: { type: String, default: null },
        at: { type: Date, default: Date.now },
      },
    ],
    // Overall outcome: SENT | FAILED | NOT_CONFIGURED | NO_RECIPIENT | NO_CONTACTS | PENDING
    notificationStatus: { type: String, default: 'PENDING' },
    // Retry bookkeeping for transient provider failures (status RETRYING).
    notificationAttempts: { type: Number, default: 0 },
    nextRetryAt: { type: Date, default: null },
    // When the device actually triggered the SOS (differs from triggeredAt/createdAt
    // if it was created offline and synced later).
    clientTriggeredAt: { type: Date, default: null },
    syncedLate: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
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
emergencySOSSchema.index(
  { user: 1, clientEventId: 1 },
  { unique: true, partialFilterExpression: { clientEventId: { $type: 'string' } } }
);

// Speeds up finding all events still awaiting/failing notification delivery,
// which a background retry job would query against.
emergencySOSSchema.index({ status: 1, triggeredAt: 1 });

const EmergencySOS = mongoose.model('EmergencySOS', emergencySOSSchema);

export default EmergencySOS;
