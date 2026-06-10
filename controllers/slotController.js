const Slot = require('../models/Slot');
const Court = require('../models/Court');

exports.getSlots = async (req, res) => {
  try {
    const filter = { courtId: req.params.courtId };
    if (req.query.date) filter.date = req.query.date;

    let slots = await Slot.find(filter).sort({ date: 1, startTime: 1 });

    // Auto-generate slots from operatingHours when none exist for this date.
    // This means owners only need to set operating hours — no manual slot creation required.
    if (slots.length === 0 && req.query.date) {
      const court = await Court.findById(req.params.courtId).select('operatingHours');
      const oh = court?.operatingHours;

      if (oh) {
        const openHour  = oh.isWholeDay ? 0  : parseInt((oh.openTime  || '00:00').split(':')[0]);
        const closeHour = oh.isWholeDay ? 24 : parseInt((oh.closeTime || '00:00').split(':')[0]);

        if (closeHour > openHour) {
          const toCreate = [];
          for (let h = openHour; h < closeHour; h++) {
            toCreate.push({
              courtId: req.params.courtId,
              date: req.query.date,
              startTime: `${String(h).padStart(2, '0')}:00`,
              endTime:   h === 23 ? '24:00' : `${String(h + 1).padStart(2, '0')}:00`,
              status: 'available',
            });
          }
          // ordered:false — silently skip duplicates if called concurrently
          await Slot.insertMany(toCreate, { ordered: false }).catch(() => {});
          slots = await Slot.find(filter).sort({ date: 1, startTime: 1 });
        }
      }
    }

    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createSlots = async (req, res) => {
  try {
    const { courtId } = req.params;
    const court = await Court.findOne({ _id: courtId, ownerId: req.user._id });
    if (!court) return res.status(403).json({ error: 'Not your court' });

    const slotsData = (Array.isArray(req.body) ? req.body : [req.body]).map(s => ({ ...s, courtId }));

    // ordered: false lets valid docs insert even if some violate the unique index
    const result = await Slot.insertMany(slotsData, { ordered: false }).catch(err => {
      if (err.code === 11000) return err.insertedDocs || [];
      throw err;
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSlot = async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.slotId).populate('courtId');
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.courtId.ownerId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Not your court' });
    if (slot.status === 'booked')
      return res.status(400).json({ error: 'Cannot delete a booked slot' });
    await slot.deleteOne();
    res.json({ message: 'Slot deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
