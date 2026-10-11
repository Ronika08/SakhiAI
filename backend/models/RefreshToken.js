/**
 * models/RefreshToken.js
 *
 * Server-side record of an issued refresh token. Only a SHA-256 hash of the
 * token is stored — a database leak never exposes usable tokens. Tokens are
 * rotated on every refresh; presenting an already-rotated token revokes the
 * whole family (token-theft detection). Expired records are removed by a TTL
 * index.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    userAgent: { type: String, maxlength: 300, default: null },
  },
  { timestamps: true }
);

// MongoDB removes documents automatically after `expiresAt`.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('RefreshToken', refreshTokenSchema);
