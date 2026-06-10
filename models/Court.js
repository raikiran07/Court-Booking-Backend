const mongoose = require('mongoose');

const CourtSchema = new mongoose.Schema({
  ownerId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:         { type: String, required: true },
  description:  { type: String },
  location:     { type: String, required: true },
  city:         { type: String, required: true, lowercase: true },
  coordinates:  { lat: Number, lng: Number },
  pricePerHour: { type: Number, required: true },
  surfaceType:  { type: String, enum: ['natural_grass', 'artificial_turf', 'concrete'] },
  amenities:    [{ type: String }],
  images:       [{ type: String }],
  operatingHours: {
    isWholeDay: { type: Boolean, default: false },
    openTime:   { type: String },   // 'HH:MM' e.g. '06:00'
    closeTime:  { type: String },   // 'HH:MM' e.g. '22:00'
  },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true });

CourtSchema.index({ city: 1, isActive: 1 });

module.exports = mongoose.model('Court', CourtSchema);
