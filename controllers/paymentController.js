const crypto = require('crypto');
const mongoose = require('mongoose');
const razorpayInstance = require('../utils/razorpay');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Slot = require('../models/Slot');
const sendEmail = require('../utils/sendEmail');

exports.createOrder = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findOne({ _id: bookingId, playerId: req.user._id, status: 'pending' });
    if (!booking) return res.status(404).json({ error: 'Booking not found or not pending' });

    const order = await razorpayInstance.orders.create({
      amount: booking.totalAmount * 100,
      currency: 'INR',
      receipt: bookingId.toString(),
    });

    res.json({ razorpayOrderId: order.id, amount: order.amount, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.verifyPayment = async (req, res) => {
  const { bookingId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature)
    return res.status(400).json({ error: 'Payment verification failed' });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking || booking.status !== 'pending') throw new Error('Invalid booking state');

      await Payment.create([{
        bookingId,
        gateway: 'razorpay',
        gatewayOrderId: razorpay_order_id,
        gatewayPaymentId: razorpay_payment_id,
        gatewaySignature: razorpay_signature,
        amount: booking.totalAmount,
        status: 'success',
        paidAt: new Date(),
      }], { session });

      await Booking.updateOne({ _id: bookingId }, { status: 'confirmed' }, { session });
      await Slot.updateMany({ _id: { $in: booking.slotIds } }, { status: 'booked' }, { session });
    });

    session.endSession();

    // Fire-and-forget confirmation email
    Booking.findById(bookingId)
      .populate('courtId', 'name city location')
      .populate('slotIds', 'date startTime endTime')
      .populate('playerId', 'name email')
      .then(b => {
        const first = b.slotIds[0];
        const last = b.slotIds[b.slotIds.length - 1];
        return sendEmail({
          to: b.playerId.email,
          subject: `Booking Confirmed – ${b.courtId.name}`,
          html: `<h2>Booking Confirmed</h2>
                 <p>Hi ${b.playerId.name},</p>
                 <p><strong>Court:</strong> ${b.courtId.name}, ${b.courtId.city}</p>
                 <p><strong>Date:</strong> ${first.date}</p>
                 <p><strong>Time:</strong> ${first.startTime} – ${last.endTime}</p>
                 <p><strong>Duration:</strong> ${b.slotIds.length} hour(s)</p>
                 <p><strong>Amount Paid:</strong> ₹${b.totalAmount}</p>
                 <p><strong>Booking ID:</strong> ${bookingId}</p>`,
        });
      })
      .catch(console.error);

    res.json({ success: true, bookingId });
  } catch (err) {
    session.endSession();
    res.status(500).json({ error: err.message });
  }
};
