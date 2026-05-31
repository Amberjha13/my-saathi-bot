const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // whatsapp number
  language: { type: String, default: null },              // hindi/bengali/maithili/angika
  onboarded: { type: Boolean, default: false },           // language selected?
  history: [                                               // conversation history
    {
      role: { type: String, enum: ['user', 'assistant'] },
      content: { type: String }
    }
  ],
  lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

// Auto expire sessions after 24 hours of inactivity
sessionSchema.index({ lastActive: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('Session', sessionSchema);