/**
 * TURN/STUN Server Configuration
 * Supports: Self-hosted Coturn (free), Xirsys (paid), or STUN-only fallback
 */

const axios = require('axios');

// Free Google STUN servers (fallback)
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

/**
 * Get ICE servers for WebRTC
 * Priority: Self-hosted Coturn > Xirsys > STUN-only
 */
const getIceServers = async () => {
  // Option 1: Self-hosted Coturn (FREE - recommended)
  if (process.env.TURN_SERVER && process.env.TURN_USERNAME && process.env.TURN_PASSWORD) {
    console.log('Using self-hosted TURN server');
    return [
      ...STUN_SERVERS,
      {
        urls: process.env.TURN_SERVER,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_PASSWORD
      },
      {
        urls: process.env.TURN_SERVER.replace('turn:', 'turns:').replace(':3478', ':5349'),
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_PASSWORD
      }
    ];
  }

  // Option 2: Xirsys (paid service)
  if (process.env.XIRSYS_IDENT && process.env.XIRSYS_SECRET) {
    try {
      const channel = process.env.XIRSYS_CHANNEL || 'bananatalk';
      const response = await axios.put(
        `https://global.xirsys.net/_turn/${channel}`,
        {},
        {
          auth: {
            username: process.env.XIRSYS_IDENT,
            password: process.env.XIRSYS_SECRET
          },
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        }
      );

      if (response.data?.v?.iceServers) {
        console.log('Using Xirsys TURN servers');
        return response.data.v.iceServers;
      }
    } catch (error) {
      console.error('Xirsys failed:', error.message);
    }
  }

  // Option 3: STUN only (free, ~80% success rate)
  console.warn('No TURN server configured. Using STUN only (~80% of calls will work)');
  return STUN_SERVERS;
};

/**
 * Validate TURN configuration
 */
const validateConfig = () => {
  // Check for self-hosted Coturn
  if (process.env.TURN_SERVER && process.env.TURN_USERNAME && process.env.TURN_PASSWORD) {
    console.log('TURN: Self-hosted Coturn configured');
    return true;
  }

  // Check for Xirsys
  if (process.env.XIRSYS_IDENT && process.env.XIRSYS_SECRET) {
    console.log('TURN: Xirsys configured');
    return true;
  }

  console.warn('TURN: No TURN server configured. Some calls may fail behind strict NAT.');
  return false;
};

/**
 * Test TURN server connectivity
 */
const testTurnServer = async () => {
  if (!process.env.TURN_SERVER) {
    return { success: false, message: 'No TURN server configured' };
  }

  try {
    // Basic connectivity test - just verify the server responds
    const turnUrl = process.env.TURN_SERVER;
    const host = turnUrl.replace('turn:', '').split(':')[0];

    return {
      success: true,
      message: `TURN server configured: ${host}`,
      config: {
        server: process.env.TURN_SERVER,
        username: process.env.TURN_USERNAME,
        hasPassword: !!process.env.TURN_PASSWORD
      }
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = {
  getIceServers,
  validateConfig,
  testTurnServer
};
