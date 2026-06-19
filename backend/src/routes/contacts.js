const router = require('express').Router();
const { prisma } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

router.use(authMiddleware);

// Helper: get the canonical link between two users (regardless of A/B ordering)
async function getLink(userAId, userBId) {
  return prisma.contactLink.findFirst({
    where: {
      OR: [
        { userAId, userBId },
        { userAId: userBId, userBId: userAId }
      ]
    }
  });
}

// GET /api/v1/contacts — list all contacts (accepted + pending)
router.get('/', async (req, res) => {
  const userId = req.user.sub;
  const links = await prisma.contactLink.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    include: {
      userA: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      userB: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
    }
  });

  const contacts = links.map(link => {
    const other = link.userAId === userId ? link.userB : link.userA;
    const isInitiator = link.initiatedBy === userId;
    return {
      linkId: link.id,
      status: link.status,
      isInitiator,
      contact: other,
      createdAt: link.createdAt
    };
  });
  res.json(contacts);
});

// POST /api/v1/contacts/request — send contact request
router.post('/request', async (req, res) => {
  const { targetUserId } = req.body;
  const userId = req.user.sub;
  if (!targetUserId) throw new AppError('targetUserId required', 400);
  if (targetUserId === userId) throw new AppError('Cannot add yourself', 400);

  // Check target exists
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new AppError('User not found', 404);

  // Check no existing link
  const existing = await getLink(userId, targetUserId);
  if (existing) {
    if (existing.status === 'ACCEPTED') throw new AppError('Already connected', 409);
    if (existing.status === 'PENDING') throw new AppError('Request already pending', 409);
    if (existing.status === 'REVOKED') {
      // Re-activate
      const updated = await prisma.contactLink.update({
        where: { id: existing.id },
        data: { status: 'PENDING', initiatedBy: userId }
      });
      return res.json(updated);
    }
  }

  const link = await prisma.contactLink.create({
    data: {
      userAId: userId,
      userBId: targetUserId,
      initiatedBy: userId,
      status: 'PENDING'
    }
  });

  // Emit socket event to target
  const io = req.app.get('io');
  io.to(`user:${targetUserId}`).emit('contact:request', {
    linkId: link.id,
    fromUserId: userId
  });

  res.status(201).json(link);
});

// PUT /api/v1/contacts/:linkId/accept
router.put('/:linkId/accept', async (req, res) => {
  const { linkId } = req.params;
  const userId = req.user.sub;

  const link = await prisma.contactLink.findUnique({ where: { id: linkId } });
  if (!link) throw new AppError('Link not found', 404);
  if (link.userBId !== userId && link.userAId !== userId) throw new AppError('Forbidden', 403);
  if (link.initiatedBy === userId) throw new AppError('Cannot accept your own request', 400);
  if (link.status !== 'PENDING') throw new AppError('Link is not pending', 400);

  const updated = await prisma.contactLink.update({
    where: { id: linkId },
    data: { status: 'ACCEPTED' }
  });

  const io = req.app.get('io');
  const otherId = link.userAId === userId ? link.userBId : link.userAId;
  io.to(`user:${otherId}`).emit('contact:accepted', { linkId: link.id, byUserId: userId });

  res.json(updated);
});

// DELETE /api/v1/contacts/:linkId — revoke link
router.delete('/:linkId', async (req, res) => {
  const { linkId } = req.params;
  const userId = req.user.sub;

  const link = await prisma.contactLink.findUnique({ where: { id: linkId } });
  if (!link) throw new AppError('Link not found', 404);
  if (link.userAId !== userId && link.userBId !== userId) throw new AppError('Forbidden', 403);

  const updated = await prisma.contactLink.update({
    where: { id: linkId },
    data: { status: 'REVOKED' }
  });

  const io = req.app.get('io');
  const otherId = link.userAId === userId ? link.userBId : link.userAId;
  io.to(`user:${otherId}`).emit('contact:revoked', { linkId: link.id, byUserId: userId });

  res.json({ ok: true });
});

// ─── GROUPS ───────────────────────────────────────────

// GET /api/v1/contacts/groups
router.get('/groups', async (req, res) => {
  const groups = await prisma.contactGroup.findMany({
    where: { ownerId: req.user.sub },
    include: {
      members: {
        include: {
          // member info resolved via lookup
        }
      }
    }
  });
  res.json(groups);
});

// POST /api/v1/contacts/groups
router.post('/groups', async (req, res) => {
  const { name, memberIds } = req.body; // memberIds: array of linked user IDs
  if (!name) throw new AppError('Group name required', 400);

  const group = await prisma.contactGroup.create({
    data: {
      ownerId: req.user.sub,
      name,
      members: {
        create: (memberIds || []).map(id => ({ linkedUserId: id }))
      }
    },
    include: { members: true }
  });
  res.status(201).json(group);
});

// PUT /api/v1/contacts/groups/:groupId
router.put('/groups/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const { name, memberIds } = req.body;
  const group = await prisma.contactGroup.findUnique({ where: { id: groupId } });
  if (!group || group.ownerId !== req.user.sub) throw new AppError('Not found', 404);

  // Replace members
  await prisma.contactGroupMember.deleteMany({ where: { groupId } });
  const updated = await prisma.contactGroup.update({
    where: { id: groupId },
    data: {
      name: name || group.name,
      members: {
        create: (memberIds || []).map(id => ({ linkedUserId: id }))
      }
    },
    include: { members: true }
  });
  res.json(updated);
});

// DELETE /api/v1/contacts/groups/:groupId
router.delete('/groups/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const group = await prisma.contactGroup.findUnique({ where: { id: groupId } });
  if (!group || group.ownerId !== req.user.sub) throw new AppError('Not found', 404);
  await prisma.contactGroup.delete({ where: { id: groupId } });
  res.json({ ok: true });
});

module.exports = router;
