const crypto = require('crypto');
const mongoose = require('mongoose');
const razorpayInstance = require('../utils/razorpay');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Slot = require('../models/Slot');
const sendEmail = require('../utils/sendEmail');

// Confirms a booking, marks its slots as booked, and emails the player.
// Shared by both the client-driven /verify flow and the /webhook flow.
const confirmBooking = async (bookingId, payment) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking || booking.status !== 'pending') return;

      await Payment.findOneAndUpdate(
        { bookingId },
        {
          bookingId,
          gateway: 'razorpay',
          gatewayOrderId: payment.orderId,
          gatewayPaymentId: payment.paymentId,
          gatewaySignature: payment.signature,
          amount: booking.totalAmount,
          status: 'success',
          paidAt: new Date(),
        },
        { upsert: true, session },
      );

      await Booking.updateOne({ _id: bookingId }, { status: 'confirmed' }, { session });
      await Slot.updateMany({ _id: { $in: booking.slotIds } }, { status: 'booked' }, { session });
    });
  } finally {
    session.endSession();
  }

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
};

exports.createOrder = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findOne({ _id: bookingId, playerId: req.user._id, status: 'pending' });
    if (!booking) return res.status(404).json({ error: 'Booking not found or not pending' });

    const order = await razorpayInstance.orders.create({
      amount: booking.totalAmount * 100,
      currency: 'INR',
      receipt: bookingId.toString(),
      notes: { bookingId: bookingId.toString() },
    });

    res.json({ razorpayOrderId: order.id, amount: order.amount, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { bookingId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature)
      return res.status(400).json({ error: 'Payment verification failed' });

    await confirmBooking(bookingId, {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    res.json({ success: true, bookingId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Razorpay calls this directly when a payment is captured. Handles the case where
// the user closes the browser/loses connection before /verify completes.
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.rawBody)
      .digest('hex');

    if (signature !== expectedSignature)
      return res.status(400).json({ error: 'Invalid webhook signature' });

    const event = req.body;
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const bookingId = payment.notes?.bookingId;
      if (bookingId) {
        await confirmBooking(bookingId, {
          orderId: payment.order_id,
          paymentId: payment.id,
          signature: null,
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
