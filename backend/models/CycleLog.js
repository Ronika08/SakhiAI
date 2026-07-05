/**
 * models/CycleLog.js
 *
 * Represents a single logged menstrual cycle entry for a user — the
 * backend persistence layer for the frontend's Cycle Tracker feature
 * (previously only backed by local storage via src/services/cycleService.js).
 *
 * One document per cycle: a start date, optional end date, optional
 * symptoms/mood/flow logging for that cycle, and free-form notes.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const FLOW_LEVELS = ['spotting', 'light', 'medium', 'heavy'];

const SYMPTOM_OPTIONS = [
  'cramps',
  'headache',
  'bloating',
  'fatigue',
  'backache',
  'nausea',
  'acne',
  'tender_breasts',
  'mood_swings',
  'food_cravings',
];

const cycleLogSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A cycle log must belong to a user.'],
      index: true,
    },

    // First day of menstrual bleeding for this cycle.
    startDate: {
      type: Date,
      required: [true, 'Field "startDate" is required.'],
    },

    // Last day of bleeding, if known/completed. Null while the period
    // is ongoing or hasn't been closed out by the user yet.
    endDate: {
      type: Date,
      default: null,
      validate: {
        validator(value) {
          return !value || !this.startDate || value >= this.startDate;
        },
        message: 'endDate cannot be before startDate.',
      },
    },

    // Predicted length of this cycle in days (start of this period to
    // start of the next), used to power forecasting on the dashboard.
    cycleLengthDays: {
      type: Number,
      min: [10, 'cycleLengthDays must be at least 10.'],
      max: [90, 'cycleLengthDays must be 90 or fewer.'],
      default: null,
    },

    flow: {
      type: String,
      enum: {
        values: FLOW_LEVELS,
        message: `flow must be one of: ${FLOW_LEVELS.join(', ')}.`,
      },
      default: null,
    },

    symptoms: [
      {
        type: String,
        enum: {
          values: SYMPTOM_OPTIONS,
          message: `symptoms entries must be one of: ${SYMPTOM_OPTIONS.join(', ')}.`,
        },
      },
    ],

    // Free-text mood note for this cycle (structured mood tracking lives
    // in its own MoodLog model — this is cycle-specific context only).
    mood: {
      type: String,
      trim: true,
      maxlength: [200, 'mood must be 200 characters or fewer.'],
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'notes must be 1000 characters or fewer.'],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Speeds up "this user's cycles, most recent first" queries that power
// the tracker timeline and next-period prediction.
cycleLogSchema.index({ user: 1, startDate: -1 });

const CycleLog = mongoose.model('CycleLog', cycleLogSchema);

export default CycleLog;
