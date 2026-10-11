/**
 * models/WellnessLog.js
 *
 * One document per user per calendar day capturing daily wellness habits.
 * (Mood has its own model/endpoints — MoodLog — and is referenced here only
 * as an optional label so existing Wellness UI data can round-trip.)
 *
 * `date` is a "YYYY-MM-DD" string in the user's local calendar so the day a
 * user sees is the day that is stored, regardless of server time zone.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

const SLEEP_BUCKETS = ['<5h', '5-6h', '6-7h', '7-8h', '8-9h', '>9h'];

const wellnessLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: {
      type: String,
      required: [true, 'Field "date" is required.'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format.'],
    },
    waterGlasses: { type: Number, min: [0, 'waterGlasses must be 0-30.'], max: [30, 'waterGlasses must be 0-30.'], default: 0 },
    sleepHours: { type: Number, min: [0, 'sleepHours must be 0-24.'], max: [24, 'sleepHours must be 0-24.'], default: null },
    // The existing UI records sleep as a bucket label; keep it for round-tripping.
    sleepBucket: { type: String, enum: [...SLEEP_BUCKETS, null], default: null },
    activityMinutes: { type: Number, min: [0, 'activityMinutes must be 0-1440.'], max: [1440, 'activityMinutes must be 0-1440.'], default: null },
    stressLevel: { type: Number, min: [1, 'stressLevel must be 1-5.'], max: [5, 'stressLevel must be 1-5.'], default: null },
    mood: { type: String, trim: true, maxlength: 30, default: null },
    note: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true }
);

wellnessLogSchema.index({ user: 1, date: -1 }, { unique: true });

export const WELLNESS_SLEEP_BUCKETS = SLEEP_BUCKETS;
export default mongoose.model('WellnessLog', wellnessLogSchema);
