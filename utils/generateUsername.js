/**
 * Username Generator Utility
 * Generates unique random usernames based on user's name
 */

const User = require('../models/User');

/**
 * Generate a random string of characters
 * @param {number} length - Length of random string
 * @returns {string} - Random alphanumeric string
 */
const generateRandomString = (length = 4) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Sanitize a name to create a base username
 * Removes special characters, spaces, and converts to lowercase
 * @param {string} name - User's name
 * @returns {string} - Sanitized base name
 */
const sanitizeName = (name) => {
  if (!name || typeof name !== 'string') {
    return 'user';
  }

  // Get first name only (split by space)
  const firstName = name.split(' ')[0];

  // Remove special characters, keep only alphanumeric and convert to lowercase
  const sanitized = firstName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

  // Return 'user' if the result is empty or too short
  return sanitized.length >= 2 ? sanitized : 'user';
};

/**
 * Generate a unique username for a new user
 * Format: <name><random> (e.g., davis7x4k, john9m2p, maria3b8w)
 * @param {string} name - User's name
 * @param {number} maxAttempts - Maximum attempts to find unique username
 * @returns {Promise<string>} - Unique username
 */
const generateUsername = async (name, maxAttempts = 10) => {
  const baseName = sanitizeName(name);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate random suffix (4-6 chars for uniqueness)
    const suffixLength = attempt < 5 ? 4 : 6;
    const randomSuffix = generateRandomString(suffixLength);
    const username = `${baseName}${randomSuffix}`;

    // Check if this username is available
    const existingUser = await User.findOne({ username }).lean();
    if (!existingUser) {
      return username;
    }
  }

  // Fallback: use timestamp-based username
  const timestamp = Date.now().toString(36);
  return `${baseName}${timestamp}`;
};

/**
 * Generate username for a single user (for migration)
 * @param {Object} user - User document
 * @returns {Promise<string>} - Generated username
 */
const generateUsernameForUser = async (user) => {
  return await generateUsername(user.name);
};

/**
 * Migrate existing users without usernames
 * @returns {Promise<Object>} - Migration results
 */
const migrateExistingUsers = async () => {
  const results = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  try {
    // Find all users without a username
    const usersWithoutUsername = await User.find({
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: '' }
      ]
    }).select('_id name email');

    results.total = usersWithoutUsername.length;
    console.log(`Found ${results.total} users without usernames`);

    for (const user of usersWithoutUsername) {
      try {
        const username = await generateUsername(user.name);

        await User.findByIdAndUpdate(user._id, { username });

        results.updated++;
        console.log(`✅ Updated user ${user.email} -> @${username}`);
      } catch (error) {
        results.errors.push({ userId: user._id, email: user.email, error: error.message });
        console.error(`❌ Failed to update user ${user.email}:`, error.message);
      }
    }

    results.skipped = results.total - results.updated - results.errors.length;

    console.log('\n📊 Migration Summary:');
    console.log(`   Total users processed: ${results.total}`);
    console.log(`   Successfully updated: ${results.updated}`);
    console.log(`   Errors: ${results.errors.length}`);

    return results;
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

/**
 * Check if a username is available
 * @param {string} username - Username to check
 * @returns {Promise<boolean>} - True if available
 */
const isUsernameAvailable = async (username) => {
  if (!username) return false;

  const normalizedUsername = username.toLowerCase().trim();

  // Validate format
  if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
    return false;
  }

  // Check minimum length
  if (normalizedUsername.length < 3) {
    return false;
  }

  const existingUser = await User.findOne({ username: normalizedUsername }).lean();
  return !existingUser;
};

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {object} - { valid: boolean, error: string|null }
 */
const validateUsername = (username) => {
  if (!username) {
    return { valid: false, error: 'Username is required' };
  }

  const normalized = username.toLowerCase().trim();

  if (normalized.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (normalized.length > 30) {
    return { valid: false, error: 'Username must be less than 30 characters' };
  }

  if (!/^[a-z0-9_]+$/.test(normalized)) {
    return { valid: false, error: 'Username can only contain lowercase letters, numbers, and underscores' };
  }

  if (/^[0-9]/.test(normalized)) {
    return { valid: false, error: 'Username cannot start with a number' };
  }

  // Reserved words
  const reserved = ['admin', 'support', 'help', 'moderator', 'mod', 'system', 'bananaltalk', 'banatalk', 'official'];
  if (reserved.some(word => normalized.includes(word))) {
    return { valid: false, error: 'This username is not allowed' };
  }

  return { valid: true, error: null };
};

module.exports = {
  generateUsername,
  generateUsernameForUser,
  migrateExistingUsers,
  isUsernameAvailable,
  validateUsername,
  sanitizeName,
  generateRandomString
};
