const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  bookingId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  gateway:            { type: String, enum: ['razorpay', 'stripe'], required: true },
  gatewayOrderId:     { type: String },
  gatewayPaymentId:   { type: String },
  gatewaySignature:   { type: String },
  amount:             { type: Number, required: true },
  currency:           { type: String, default: 'INR' },
  status:             { type: String, enum: ['initiated', 'success', 'failed', 'refunded'], default: 'initiated' },
  paidAt:             { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
