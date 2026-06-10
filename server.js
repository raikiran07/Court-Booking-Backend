require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const courtRoutes = require('./routes/courts');
const slotRoutes = require('./routes/slots');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const uploadRoutes = require('./routes/uploads');

connectDB();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true });
app.use('/api/auth', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/uploads', uploadRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Expire pending bookings older than 15 minutes and release their slots
cron.schedule('*/5 * * * *', async () => {
  const Booking = require('./models/Booking');
  const Slot = require('./models/Slot');
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const stale = await Booking.find({ status: 'pending', createdAt: { $lt: cutoff } });
  if (!stale.length) return;
  const slotIds = stale.flatMap(b => b.slotIds);
  await Booking.updateMany({ _id: { $in: stale.map(b => b._id) } }, { status: 'expired' });
  await Slot.updateMany({ _id: { $in: slotIds } }, { status: 'available' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
