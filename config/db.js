const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // Eagerly create collections + sync all schema indexes at startup
    // (Mongoose is lazy by default — without this, collections only appear on first write)
    const models = [
      require('../models/User'),
      require('../models/Court'),
      require('../models/Slot'),
      require('../models/Booking'),
      require('../models/Payment'),
    ];
    await Promise.all(models.map(m => m.createIndexes()));
    console.log('Collections and indexes ready');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
