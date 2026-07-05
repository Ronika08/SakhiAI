/**
 * models/MoodLog.js
 *
 * Represents a single mood check-in for a user — backend persistence for
 * the Mood Tracker feature on the Wellness Dashboard. Kept separate from
 * CycleLog since mood can be logged independently of a period (daily
 * check-ins), while CycleLog.mood is a single per-cycle summary field.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const MOOD_VALUES = [
  'happy',
  'calm',
  'energetic',
  'neutral',
  'tired',
  'anxious',
  'sad',
  'irritable',
  'stressed',
];

const moodLogSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A mood log must belong to a user.'],
      index: true,
    },

    mood: {
      type: String,
      enum: {
        values: MOOD_VALUES,
        message: `mood must be one of: ${MOOD_VALUES.join(', ')}.`,
      },
      required: [true, 'Field "mood" is required.'],
    },

    // Self-reported intensity of the mood, 1 (mild) to 5 (intense).
    intensity: {
      type: Number,
      min: [1, 'intensity must be between 1 and 5.'],
      max: [5, 'intensity must be between 1 and 5.'],
      default: 3,
    },

    // The calendar date this entry represents (defaults to today).
    // Stored separately from createdAt so a user can log/edit a past day
    // without it being mistaken for when the record was created.
    loggedDate: {
      type: Date,
      default: Date.now,
      required: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: [500, 'note must be 500 characters or fewer.'],
      default: null,
    },

    // Optional free-form tags for lightweight correlation
    // (e.g. "work", "sleep", "period", "exercise").
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 30,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Speeds up "this user's mood history, most recent first" queries and
// day-level lookups used by the wellness dashboard's mood calendar.
moodLogSchema.index({ user: 1, loggedDate: -1 });

const MoodLog = mongoose.model('MoodLog', moodLogSchema);

export default MoodLog;
