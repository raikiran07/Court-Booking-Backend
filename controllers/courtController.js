const Court = require('../models/Court');
const Slot = require('../models/Slot');

exports.getCourts = async (req, res) => {
  try {
    const { city, date, startTime, endTime } = req.query;
    const filter = { isActive: true };
    if (city) filter.city = city.toLowerCase();

    const courts = await Court.find(filter).lean();

    if (date && startTime && endTime) {
      const courtIds = courts.map(c => c._id);
      const slots = await Slot.find({
        courtId: { $in: courtIds },
        date,
        startTime: { $gte: startTime },
        endTime: { $lte: endTime },
        status: 'available',
      }).lean();

      const slotMap = {};
      slots.forEach(s => {
        const id = s.courtId.toString();
        slotMap[id] = (slotMap[id] || 0) + 1;
      });

      return res.json(courts.map(c => ({ ...c, availableSlots: slotMap[c._id.toString()] || 0 })));
    }

    res.json(courts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCourt = async (req, res) => {
  try {
    const court = await Court.findById(req.params.id).populate('ownerId', 'name email phone');
    if (!court || !court.isActive) return res.status(404).json({ error: 'Court not found' });
    res.json(court);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createCourt = async (req, res) => {
  try {
    const court = await Court.create({ ...req.body, ownerId: req.user._id });
    res.status(201).json(court);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCourt = async (req, res) => {
  try {
    const court = await Court.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!court) return res.status(404).json({ error: 'Court not found or not yours' });
    res.json(court);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCourt = async (req, res) => {
  try {
    const court = await Court.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user._id },
      { isActive: false },
      { new: true }
    );
    if (!court) return res.status(404).json({ error: 'Court not found or not yours' });
    res.json({ message: 'Court deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
