/**
 * models/PushSubscription.js
 *
 * A Web Push subscription registered by a signed-in user's browser/device.
 * Used by the free Web Push notification provider: SOS alerts are pushed to
 * (a) the user's own other devices and (b) any SakhiAI user whose account
 * e-mail matches one of the user's trusted contacts.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

const pushSubscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true, maxlength: 1000 },
    keys: {
      p256dh: { type: String, required: true, maxlength: 200 },
      auth: { type: String, required: true, maxlength: 100 },
    },
    userAgent: { type: String, maxlength: 300, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('PushSubscription', pushSubscriptionSchema);
