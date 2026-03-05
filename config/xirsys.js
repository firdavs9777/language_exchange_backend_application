/**
 * Xirsys TURN/STUN Configuration
 * https://xirsys.com
 */

const axios = require('axios');

const XIRSYS_API_URL = 'https://global.xirsys.net';
const DEFAULT_CHANNEL = 'banatalk';
const REQUEST_TIMEOUT_MS = 5000;
const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

/**
 * Fetch ICE servers from Xirsys
 * Returns STUN and TURN server credentials
 */
const getIceServers = async () => {
  // Check credentials before making request
  const ident = process.env.XIRSYS_IDENT;
  const secret = process.env.XIRSYS_SECRET;

  if (!ident || !secret) {
    console.warn('Xirsys credentials not configured. Using fallback STUN servers.');
    return FALLBACK_ICE_SERVERS;
  }

  try {
    const channel = process.env.XIRSYS_CHANNEL || DEFAULT_CHANNEL;

    const response = await axios.put(
      `${XIRSYS_API_URL}/_turn/${channel}`,
      {},
      {
        auth: {
          username: ident,
          password: secret
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: REQUEST_TIMEOUT_MS
      }
    );

    if (response.data && response.data.v && response.data.v.iceServers) {
      console.log('Fetched ICE servers from Xirsys');
      return response.data.v.iceServers;
    }

    throw new Error('Invalid Xirsys response');
  } catch (error) {
    console.error('Failed to fetch ICE servers:', error.message);
    return FALLBACK_ICE_SERVERS;
  }
};

/**
 * Validate Xirsys configuration
 */
const validateConfig = () => {
  const required = ['XIRSYS_IDENT', 'XIRSYS_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`Missing Xirsys config: ${missing.join(', ')}. Using fallback STUN servers.`);
    return false;
  }
  return true;
};

module.exports = {
  getIceServers,
  validateConfig
};
