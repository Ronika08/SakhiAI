/**
 * models/User.js
 *
 * Mongoose schema/model for a SakhiAI user account.
 *
 * Passwords are always stored hashed (bcrypt) — never in plain text.
 * The pre-save hook hashes automatically whenever `password` is set or
 * changed, so callers (controllers/services) just assign the plain-text
 * password and call `save()`.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../config/index.js';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      maxlength: [100, 'Name must be 100 characters or fewer.'],
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address.'],
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [8, 'Password must be at least 8 characters long.'],
      select: false, // excluded from query results by default
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    trustedCircle: [
      {
        name: { type: String, trim: true },
        phone: { type: String, trim: true },
        relation: { type: String, trim: true },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },

    // Authorization role. Regular users are "user"; "admin" is reserved for
    // future administrative endpoints.
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    // App preferences (profile settings).
    preferences: {
      language: { type: String, trim: true, maxlength: 10, default: 'en' },
      notifications: {
        reminders: { type: Boolean, default: true },
        sosAlerts: { type: Boolean, default: true },
      },
    },

    // Health preferences used by the cycle tracker defaults. No diagnoses or
    // medical conditions are stored here on purpose (data minimisation).
    healthPreferences: {
      typicalCycleLengthDays: { type: Number, min: 15, max: 60, default: 28 },
      typicalPeriodLengthDays: { type: Number, min: 1, max: 14, default: 5 },
    },

    // Brute-force protection (see authService.login).
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

/**
 * Hash the password before saving, but only if it was newly set/changed —
 * avoids re-hashing an already-hashed password on unrelated updates.
 */
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(config.auth.bcryptRounds);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

/**
 * Compares a plain-text candidate password against this user's hashed
 * password. Use with `.select('+password')` on the query, since password
 * is excluded by default.
 */
userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Strips sensitive/internal fields whenever a user document is serialized
 * to JSON (e.g. in an API response), so `password` never leaks by accident.
 */
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

export default User;
