const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  emailOrUsername: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: { expires: 300 } } // TTL index to automatically delete OTP after 5 minutes
});

const Otp = mongoose.model('Otp', otpSchema);
module.exports = Otp;
