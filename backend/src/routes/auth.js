const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../config/jwt');
const { AppError } = require('../middleware/errorHandler');

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {
  const { username, phone, password, displayName } = req.body;
  if (!username || !phone || !password) {
    throw new AppError('username, phone, and password are required', 400);
  }
  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      username: username.toLowerCase().trim(),
      phone: phone.trim(),
      passwordHash: hash,
      displayName: displayName || username,
      settings: {
        create: {} // default settings
      }
    },
    select: { id: true, username: true, phone: true, displayName: true, createdAt: true }
  });

  const accessToken = signAccessToken({ sub: user.id, username: user.username });
  const refreshToken = signRefreshToken({ sub: user.id });
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  res.status(201).json({ user, accessToken, refreshToken });
});

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { usernameOrPhone, password } = req.body;
  if (!usernameOrPhone || !password) {
    throw new AppError('usernameOrPhone and password are required', 400);
  }
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: usernameOrPhone.toLowerCase().trim() },
        { phone: usernameOrPhone.trim() }
      ]
    }
  });
  if (!user) throw new AppError('Invalid credentials', 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError('Invalid credentials', 401);

  const accessToken = signAccessToken({ sub: user.id, username: user.username });
  const refreshToken = signRefreshToken({ sub: user.id });
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  res.json({
    user: { id: user.id, username: user.username, phone: user.phone, displayName: user.displayName },
    accessToken,
    refreshToken
  });
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('refreshToken required', 400);

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError('Refresh token expired or revoked', 401);
  }

  // Rotate refresh token
  await prisma.refreshToken.delete({ where: { token: refreshToken } });
  const newRefresh = signRefreshToken({ sub: decoded.sub });
  await prisma.refreshToken.create({
    data: {
      token: newRefresh,
      userId: decoded.sub,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  const accessToken = signAccessToken({ sub: decoded.sub });
  res.json({ accessToken, refreshToken: newRefresh });
});

// POST /api/v1/auth/logout
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  res.json({ ok: true });
});

module.exports = router;
