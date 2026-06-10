const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const Court = require('../models/Court');

const CANCEL_WINDOW_HOURS = 24;

exports.createBooking = async (req, res) => {
  try {
    const { courtId, slotIds, notes } = req.body;
    if (!Array.isArray(slotIds) || slotIds.length === 0)
      return res.status(400).json({ error: 'At least one slot is required' });

    // Verify all requested slots exist, belong to this court, and are available
    const slots = await Slot.find({ _id: { $in: slotIds }, courtId, status: 'available' });
    if (slots.length !== slotIds.length)
      return res.status(409).json({ error: 'One or more slots are not available' });

    // Reject if any slot is already held by a pending or confirmed booking
    const conflict = await Booking.findOne({
      slotIds: { $in: slotIds },
      status: { $in: ['pending', 'confirmed'] },
    });
    if (conflict) return res.status(409).json({ error: 'One or more slots are already reserved' });

    // Slots must be on the same date and consecutive (no gaps)
    slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (!slots.every(s => s.date === slots[0].date))
      return res.status(400).json({ error: 'All slots must be on the same date' });
    for (let i = 0; i < slots.length - 1; i++) {
      if (slots[i].endTime !== slots[i + 1].startTime)
        return res.status(400).json({ error: 'Slots must be consecutive with no gaps' });
    }

    const court = await Court.findById(courtId);
    const totalAmount = slots.reduce((sum, s) => sum + (s.price ?? court.pricePerHour), 0);

    const booking = await Booking.create({ playerId: req.user._id, courtId, slotIds, totalAmount, notes });

    await Slot.updateMany({ _id: { $in: slotIds } }, { status: 'reserved' });

    res.status(201).json({ bookingId: booking._id, amount: totalAmount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ playerId: req.user._id })
      .populate('courtId', 'name city location images')
      .populate('slotIds', 'date startTime endTime')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCourtBookings = async (req, res) => {
  try {
    const court = await Court.findOne({ _id: req.params.courtId, ownerId: req.user._id });
    if (!court) return res.status(403).json({ error: 'Not your court' });

    const bookings = await Booking.find({ courtId: req.params.courtId })
      .populate('playerId', 'name email phone')
      .populate('slotIds', 'date startTime endTime')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, playerId: req.user._id });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'confirmed')
      return res.status(400).json({ error: 'Only confirmed bookings can be cancelled' });

    // Use the first slot to check the cancellation window
    const firstSlot = await Slot.findById(booking.slotIds[0]);
    const slotDateTime = new Date(`${firstSlot.date}T${firstSlot.startTime}:00`);
    const hoursUntilSlot = (slotDateTime - Date.now()) / 3_600_000;
    if (hoursUntilSlot < CANCEL_WINDOW_HOURS)
      return res.status(400).json({ error: `Cannot cancel within ${CANCEL_WINDOW_HOURS} hours of the slot` });

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await booking.save();
    await Slot.updateMany({ _id: { $in: booking.slotIds } }, { status: 'available' });
    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
