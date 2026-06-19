const router = require('express').Router();
const { prisma } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

router.use(authMiddleware);

// GET /api/v1/trackers — list my tracker tags
router.get('/', async (req, res) => {
  const tags = await prisma.trackerTag.findMany({
    where: { userId: req.user.sub, isActive: true },
    orderBy: { pairedAt: 'desc' }
  });
  res.json(tags);
});

// POST /api/v1/trackers — pair a new BLE tag
router.post('/', async (req, res) => {
  const { label, bleUuid } = req.body;
  if (!label || !bleUuid) throw new AppError('label and bleUuid required', 400);

  const tag = await prisma.trackerTag.create({
    data: {
      userId: req.user.sub,
      label,
      bleUuid
    }
  });
  res.status(201).json(tag);
});

// PUT /api/v1/trackers/:id — rename or update a tag
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { label } = req.body;
  const tag = await prisma.trackerTag.findUnique({ where: { id } });
  if (!tag || tag.userId !== req.user.sub) throw new AppError('Tag not found', 404);

  const updated = await prisma.trackerTag.update({
    where: { id },
    data: { label }
  });
  res.json(updated);
});

// POST /api/v1/trackers/:id/seen — BLE beacon seen event from device
router.post('/:id/seen', async (req, res) => {
  const { id } = req.params;
  const { lat, lng, batteryPct, address } = req.body;
  const tag = await prisma.trackerTag.findUnique({ where: { id } });
  if (!tag || tag.userId !== req.user.sub) throw new AppError('Tag not found', 404);

  const now = new Date();
  const updated = await prisma.trackerTag.update({
    where: { id },
    data: {
      lastSeenLat: lat,
      lastSeenLng: lng,
      lastSeenAt: now,
      lastSeenAddress: address || null,
      batteryPct: batteryPct || tag.batteryPct
    }
  });

  // Write to history with BLE_TRACKER_TAG source
  await prisma.locationHistory.create({
    data: {
      userId: req.user.sub,
      lat, lng,
      source: 'BLE_TRACKER_TAG',
      trackerTagId: id,
      recordedAt: now
    }
  });

  // Update current location for the item's user (represents phone location when tag was seen)
  await prisma.currentLocation.upsert({
    where: { userId: req.user.sub },
    create: { userId: req.user.sub, lat, lng, source: 'BLE_TRACKER_TAG', trackerTagId: id },
    update: { lat, lng, source: 'BLE_TRACKER_TAG', trackerTagId: id }
  });

  res.json(updated);
});

// DELETE /api/v1/trackers/:id — unpair a tag
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const tag = await prisma.trackerTag.findUnique({ where: { id } });
  if (!tag || tag.userId !== req.user.sub) throw new AppError('Tag not found', 404);

  await prisma.trackerTag.update({ where: { id }, data: { isActive: false } });
  res.json({ ok: true });
});

module.exports = router;
