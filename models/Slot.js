const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema({
  courtId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Court', required: true },
  date:      { type: String, required: true },
  startTime: { type: String, required: true },
  endTime:   { type: String, required: true },
  status:    { type: String, enum: ['available', 'reserved', 'booked', 'blocked'], default: 'available' },
  price:     { type: Number },
}, { timestamps: true });

SlotSchema.index({ courtId: 1, date: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model('Slot', SlotSchema);
