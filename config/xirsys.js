/**
 * Xirsys TURN/STUN Configuration
 * https://xirsys.com
 */

const axios = require('axios');

const XIRSYS_API_URL = 'https://global.xirsys.net';

/**
 * Fetch ICE servers from Xirsys
 * Returns STUN and TURN server credentials
 */
const getIceServers = async () => {
  try {
    const channel = process.env.XIRSYS_CHANNEL || 'default';

    const response = await axios.put(
      `${XIRSYS_API_URL}/_turn/${channel}`,
      {},
      {
        auth: {
          username: process.env.XIRSYS_IDENT,
          password: process.env.XIRSYS_SECRET
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.v && response.data.v.iceServers) {
      console.log('Fetched ICE servers from Xirsys');
      return response.data.v.iceServers;
    }

    throw new Error('Invalid Xirsys response');
  } catch (error) {
    console.error('Failed to fetch ICE servers:', error.message);

    // Fallback to free STUN servers
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
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
