const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  playerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courtId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Court', required: true },
  slotIds:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Slot' }],
  status:      {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'expired'],
    default: 'pending',
  },
  totalAmount: { type: Number, required: true },
  notes:       { type: String },
  cancelledAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Booking', BookingSchema);
