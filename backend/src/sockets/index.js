const { verifyAccessToken } = require('../config/jwt');

/**
 * Socket.IO Real-Time Handlers
 * 
 * Rooms: each authenticated user joins room `user:<userId>`
 * Events:
 *   - location:update  — live location broadcast to contacts
 *   - sos:alert        — SOS event to notified contacts
 *   - sos:ack          — Ack receipt back to sos triggerer
 *   - contact:request  — New contact request notification
 *   - contact:accepted — Contact request accepted
 *   - contact:revoked  — Contact link revoked
 *   - ping:forced      — Remote ping command to target device
 */

function initSocketHandlers(io) {
  // ── Auth middleware on Socket.IO connections ─────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.sub;
      socket.username = decoded.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`[Socket] User connected: ${userId} (${socket.id})`);

    // Join personal room
    socket.join(`user:${userId}`);

    // ── Client announces it is active / present ──────
    socket.on('presence:online', () => {
      socket.broadcast.emit('presence:update', { userId, online: true });
    });

    // ── Client subscribes to another user's location ─
    socket.on('subscribe:location', ({ targetUserId }) => {
      // Validation happens server-side when location updates are broadcast
      socket.join(`watch:${targetUserId}`);
    });

    socket.on('unsubscribe:location', ({ targetUserId }) => {
      socket.leave(`watch:${targetUserId}`);
    });

    // ── Client reports forced ping response ──────────
    socket.on('ping:respond', async ({ pingId, lat, lng }) => {
      // This is a websocket-path response; HTTP path is via POST /location/update
      const { prisma } = require('../config/db');
      const ping = await prisma.remotePing.findUnique({ where: { id: pingId } });
      if (ping && ping.targetId === userId) {
        await prisma.remotePing.update({
          where: { id: pingId },
          data: { status: 'RESPONDED', respondedAt: new Date(), responseLat: lat, responseLng: lng }
        });
        io.to(`user:${ping.issuerId}`).emit('ping:responded', {
          pingId,
          targetUserId: userId,
          lat, lng,
          respondedAt: new Date()
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${userId}`);
    });
  });

  console.log('✅ Socket.IO handlers initialized');
}

module.exports = { initSocketHandlers };
