/**
 * models/PasswordReset.js
 *
 * One-time password-reset tokens. Only the SHA-256 hash is stored; the raw
 * token exists solely in the e-mailed link. Tokens expire (TTL index) and
 * are single-use (`usedAt`).
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

const passwordResetSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PasswordReset', passwordResetSchema);
