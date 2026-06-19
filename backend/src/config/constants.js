/**
 * Ping interval constants (seconds) for each preset mode
 */
const PING_INTERVALS = {
  HIGH:   30,      // 30 seconds
  MEDIUM: 300,     // 5 minutes
  LOW:    900,     // 15 minutes
};

const PING_BATTERY_IMPACT = {
  HIGH:   'High battery impact',
  MEDIUM: 'Moderate battery impact',
  LOW:    'Low battery impact',
};

const REMOTE_PING_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

module.exports = { PING_INTERVALS, PING_BATTERY_IMPACT, REMOTE_PING_EXPIRY_MS };
