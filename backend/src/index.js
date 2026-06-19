/**
 * SafeTrack Backend — Entry Point
 * Node.js / Express with Socket.IO
 */
require('express-async-errors');
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');

const { prisma } = require('./config/db');
const { initSocketHandlers } = require('./sockets');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const contactsRouter = require('./routes/contacts');
const locationRouter = require('./routes/location');
const sosRouter = require('./routes/sos');
const trackersRouter = require('./routes/trackers');
const pingsRouter = require('./routes/pings');
const settingsRouter = require('./routes/settings');
const smsWebhookRouter = require('./routes/smsWebhook');
const { startCronJobs } = require('./jobs');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// ─── Socket.IO ────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible everywhere
app.set('io', io);

// ─── Middleware ────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// ─── Static (web client) ──────────────────────────────
app.use(express.static('../web-client'));

// ─── API Routes ────────────────────────────────────────
const api = express.Router();
api.use('/auth', authRouter);
api.use('/users', usersRouter);
api.use('/contacts', contactsRouter);
api.use('/location', locationRouter);
api.use('/sos', sosRouter);
api.use('/trackers', trackersRouter);
api.use('/pings', pingsRouter);
api.use('/settings', settingsRouter);
app.use('/api/v1', api);

// ─── SMS Webhook (no JWT, uses webhook secret) ─────────
app.use('/webhook/sms', smsWebhookRouter);

// ─── Health Check ──────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error Handler ─────────────────────────────────────
app.use(errorHandler);

// ─── Socket.IO Handlers ────────────────────────────────
initSocketHandlers(io);

// ─── Cron Jobs ─────────────────────────────────────────
startCronJobs();

// ─── Start ─────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 SafeTrack backend running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  server.close();
});
