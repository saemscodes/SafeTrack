const router = require('express').Router();
const { prisma } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { PING_INTERVALS, PING_BATTERY_IMPACT } = require('../config/constants');

router.use(authMiddleware);

// GET /api/v1/settings
router.get('/', async (req, res) => {
  const settings = await prisma.userSettings.findUnique({ where: { userId: req.user.sub } });
  const effectiveInterval = getEffectiveInterval(settings);
  res.json({
    ...settings,
    effectiveIntervalSec: effectiveInterval,
    pingPresets: Object.entries(PING_INTERVALS).map(([mode, secs]) => ({
      mode,
      intervalSec: secs,
      batteryImpact: PING_BATTERY_IMPACT[mode]
    }))
  });
});

// PUT /api/v1/settings
router.put('/', async (req, res) => {
  const { pingMode, adaptivePingEnabled, customPingIntervalSec, locationSharingEnabled, retentionDays, sosMode, sosGroupId } = req.body;
  const updated = await prisma.userSettings.update({
    where: { userId: req.user.sub },
    data: {
      ...(pingMode != null && { pingMode }),
      ...(adaptivePingEnabled != null && { adaptivePingEnabled }),
      ...(customPingIntervalSec != null && { customPingIntervalSec }),
      ...(locationSharingEnabled != null && { locationSharingEnabled }),
      ...(retentionDays != null && { retentionDays }),
      ...(sosMode != null && { sosMode }),
      ...(sosGroupId != null && { sosGroupId })
    }
  });
  const effectiveInterval = getEffectiveInterval(updated);
  res.json({ ...updated, effectiveIntervalSec: effectiveInterval });
});

function getEffectiveInterval(settings) {
  if (!settings) return PING_INTERVALS.MEDIUM;
  if (settings.pingMode === 'CUSTOM' && settings.customPingIntervalSec) return settings.customPingIntervalSec;
  return PING_INTERVALS[settings.pingMode] || PING_INTERVALS.MEDIUM;
}

module.exports = router;
