const cron = require('node-cron');
const { prisma } = require('../config/db');

function startCronJobs() {
  // ── Location History Retention Purge ──────────────────
  // Runs once per hour; deletes rows older than each user's configured retention
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running location history retention purge...');
    try {
      // Get all users who have a retention setting
      const settings = await prisma.userSettings.findMany({
        where: { retentionDays: { not: null } },
        select: { userId: true, retentionDays: true }
      });

      for (const { userId, retentionDays } of settings) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - retentionDays);
        const deleted = await prisma.locationHistory.deleteMany({
          where: { userId, recordedAt: { lt: cutoff } }
        });
        if (deleted.count > 0) {
          console.log(`[Cron] Purged ${deleted.count} history rows for user ${userId} (>${retentionDays}d)`);
        }
      }
    } catch (err) {
      console.error('[Cron] Retention purge error:', err.message);
    }
  });

  // ── Remote Ping Expiry ────────────────────────────────
  // Marks DELIVERED pings as EXPIRED if no response within 10 min
  cron.schedule('*/10 * * * *', async () => {
    const threshold = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.remotePing.updateMany({
      where: { status: 'DELIVERED', deliveredAt: { lt: threshold } },
      data: { status: 'EXPIRED' }
    });
  });

  // ── SOS Event Auto-Resolve ────────────────────────────
  // Auto-resolve SOS events older than 24h with no explicit resolution
  cron.schedule('0 2 * * *', async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.sosEvent.updateMany({
      where: { resolvedAt: null, createdAt: { lt: cutoff } },
      data: { resolvedAt: new Date() }
    });
  });

  console.log('✅ Cron jobs started');
}

module.exports = { startCronJobs };
