const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const UserInteraction = require('../models/UserInteraction');
const ErrorResponse = require('../utils/errorResponse');
const { processUserImages } = require('../utils/imageUtils');
const path = require('path');
const fs = require('fs').promises;
const deleteFromSpaces = require('../utils/deleteFromSpaces');
const { getBlockedUserIds } = require('../utils/blockingUtils');
const { validateUsername } = require('../utils/usernameValidation');

// Field selection for public user data (excludes sensitive fields like email, password)
const USER_PUBLIC_FIELDS = 'name username bio occupation school images native_language language_to_learn level languageLevel streakDays totalXp createdAt userMode vipSubscription.isActive vipSubscription.plan location gender birth_year birth_month birth_day followers following mbti bloodType topics privacySettings isOnline lastActive';
const USER_LIST_FIELDS = 'name username images native_language language_to_learn level languageLevel userMode location followers following isOnline lastActive gender birth_year birth_month birth_day bio occupation school vipSubscription.isActive topics createdAt';




// @desc     Upload multiple user photos at once (Spaces)
// @route    POST /api/v1/auth/users/:id/photos
// @access   Private
exports.uploadMultiplePhotos = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  // Check authorization
  if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to upload photos for this user', 403));
  }

  if (!req.files || req.files.length === 0) {
    return next(new ErrorResponse('Please upload at least one file', 400));
  }

  // Check if adding these would exceed limit
  const totalImages = user.images.length + req.files.length;
  if (totalImages > 10) {
    // Rollback - delete uploaded files from Spaces
    await Promise.all(
      req.files.map(file => deleteFromSpaces(file.location))
    );
    return next(new ErrorResponse(
      `Cannot upload ${req.files.length} images. Maximum of 10 images allowed (you currently have ${user.images.length})`, 
      400
    ));
  }

  // Add all uploaded images
  const newImageUrls = req.files.map(file => file.location);
  user.images.push(...newImageUrls);
  
  await user.save();

  return res.status(200).json({
    success: true,
    message: `${req.files.length} image(s) uploaded successfully`,
    images: user.images,
    uploadedImages: newImageUrls,
    totalImages: user.images.length
  });
});
// ---------------------------------------------------------------------------
// Shared filter builder — used by both getUsers and getUsersCount so that
// the two endpoints always agree on which documents are in scope.
// ---------------------------------------------------------------------------
async function buildUsersQuery(req) {
  // Get blocked users if authenticated
  let blockedUserIds = [];
  let excludedUserIds = [];

  if (req.user) {
    // Get blocked users
    blockedUserIds = Array.from(await getBlockedUserIds(req.user._id));

    // Get skipped/waved users if excludeInteracted is true (default)
    const excludeInteracted = req.query.excludeInteracted !== 'false';
    if (excludeInteracted) {
      try {
        excludedUserIds = await UserInteraction.getExcludedUserIds(req.user._id, ['skip', 'wave']);
        excludedUserIds = excludedUserIds.map(id => id.toString());
      } catch (err) {
        console.log('Could not fetch excluded users:', err.message);
      }
    }
  }

  // Build query - exclude blocked and interacted users
  let query = {};
  const allExcludedIds = [...blockedUserIds, ...excludedUserIds];

  if (allExcludedIds.length > 0) {
    query._id = { $nin: allExcludedIds };
  }

  // Also exclude current user from results
  if (req.user) {
    if (query._id) {
      query._id.$nin.push(req.user._id);
    } else {
      query._id = { $nin: [req.user._id] };
    }
  }

  // Language exchange filter - find users who speak what I'm learning OR want to learn what I speak
  const { nativeLanguage, learningLanguage, matchLanguage } = req.query;

  if (matchLanguage === 'true' && (nativeLanguage || learningLanguage)) {
    // Language exchange matching: find complementary partners
    const languageConditions = [];

    // Find users whose native language matches what I'm learning
    if (learningLanguage) {
      languageConditions.push({
        native_language: { $regex: new RegExp(`^${learningLanguage}$`, 'i') }
      });
    }

    // Find users who want to learn my native language
    if (nativeLanguage) {
      languageConditions.push({
        language_to_learn: { $regex: new RegExp(`^${nativeLanguage}$`, 'i') }
      });
    }

    if (languageConditions.length > 0) {
      query.$or = languageConditions;
    }
  } else {
    // Direct language filtering: find users with exact native/learning language
    if (nativeLanguage) {
      query.native_language = { $regex: new RegExp(nativeLanguage, 'i') };
    }
    if (learningLanguage) {
      query.language_to_learn = { $regex: new RegExp(learningLanguage, 'i') };
    }
  }

  // Gender filter (available to all users)
  if (req.query.gender) {
    const genderMap = {
      'male': ['male', 'm', 'man', 'boy'],
      'female': ['female', 'f', 'woman', 'girl'],
      'other': ['other', 'non-binary', 'nonbinary', 'nb']
    };
    const genderVariants = genderMap[req.query.gender.toLowerCase()] || [req.query.gender];
    query.gender = { $regex: new RegExp(`^(${genderVariants.join('|')})$`, 'i') };
  }

  // Age filter (using birth_year)
  const currentYear = new Date().getFullYear();
  if (req.query.minAge || req.query.maxAge) {
    const minAge = parseInt(req.query.minAge, 10);
    const maxAge = parseInt(req.query.maxAge, 10);

    if (minAge && minAge > 18) {
      // min age = current year - birth_year, so birth_year <= currentYear - minAge
      query.birth_year = { ...query.birth_year, $lte: currentYear - minAge };
    }
    if (maxAge && maxAge < 100) {
      // max age = current year - birth_year, so birth_year >= currentYear - maxAge
      query.birth_year = { ...query.birth_year, $gte: currentYear - maxAge };
    }
  }

  // Online only filter — use the persisted isOnline flag, the same field that
  // drives the green presence dots (socket connect/disconnect maintains it).
  // The previous in-memory presence cache diverged from this flag after server
  // restarts / across instances, so the filter returned nothing while dots
  // still showed users online.
  if (req.query.onlineOnly === 'true' || req.query.online === 'true') {
    query.isOnline = true;
  }

  // Country filter (available to all users)
  if (req.query.country) {
    query['location.country'] = { $regex: new RegExp(req.query.country, 'i') };
  }

  // Language level filter (CEFR: A1-C2)
  if (req.query.languageLevel) {
    query.languageLevel = req.query.languageLevel.toUpperCase();
  }

  // Topics filter — matches users who have at least one of the requested topic IDs
  if (req.query.topics) {
    const topicIds = req.query.topics
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (topicIds.length > 0) {
      query.topics = { $in: topicIds };
    }
  }

  // Mutual interests minimum — requires at least N overlapping topics with the current user
  if (req.query.topicsAtLeast) {
    const minOverlap = parseInt(req.query.topicsAtLeast, 10);
    if (minOverlap > 0) {
      const myTopics = (req.user && req.user.topics) ? req.user.topics : [];
      if (myTopics.length === 0) {
        // Current user has no topics → no overlap possible → return empty result set
        query._id = { ...(query._id || {}), $in: [] };
      } else {
        const overlapCondition = {
          $gte: [
            { $size: { $setIntersection: ['$topics', myTopics] } },
            minOverlap,
          ],
        };
        // Merge with any existing $expr (defensive — none expected today)
        query.$expr = query.$expr
          ? { $and: [query.$expr, overlapCondition] }
          : overlapCondition;
      }
    }
  }

  // Server-side search filter (search in name, username, bio, languages)
  if (req.query.search && req.query.search.trim()) {
    let searchTerm = req.query.search.trim();
    const isUsernameSearch = searchTerm.startsWith('@');

    // Remove @ prefix if user typed it for username search
    if (isUsernameSearch) {
      searchTerm = searchTerm.substring(1);
    }

    const searchRegex = new RegExp(searchTerm, 'i');

    // If searching with @ prefix, search ONLY by username and ignore language filters
    // This allows finding any user by their exact username
    if (isUsernameSearch) {
      // Clear language-related filters for username search
      delete query.$or;
      delete query.$and;
      query.username = searchRegex;
    } else {
      // Regular search - search in multiple fields
      const searchConditions = [
        { name: searchRegex },
        { username: searchRegex },
        { bio: searchRegex },
        { native_language: searchRegex },
        { language_to_learn: searchRegex }
      ];

      // Combine with existing $or conditions if any
      if (query.$or) {
        // Wrap existing $or and search $or in $and
        query.$and = [
          { $or: query.$or },
          { $or: searchConditions }
        ];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }
  }

  return query;
}

// @desc     Get all users (Community/Explore) with server-side filtering
// @route    GET /api/v1/auth/users
// @access   Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const query = await buildUsersQuery(req);

  // Sort: VIP first, then online, then most recently active (default)
  // Override with ?sort=recently_active to sort by lastSeenAt desc
  const sortOptions = req.query.sort === 'recently_active'
    ? { lastSeenAt: -1, _id: -1 }
    : {
        'vipSubscription.isActive': -1,
        'isOnline': -1,
        'lastActive': -1
      };

  const [users, total] = await Promise.all([
    User.find(query)
      .select(USER_LIST_FIELDS)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query)
  ]);

  // Process users to add imageUrls and counts
  const processedUsers = users.map(user => {
    // Generate imageUrls
    let imageUrls = null;
    if (user.images && Array.isArray(user.images) && user.images.length > 0) {
      imageUrls = user.images.map(image => {
        if (image.startsWith('http://') || image.startsWith('https://')) {
          return image;
        }
        return `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`;
      });
    }

    return {
      ...user,
      imageUrls,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0
    };
  });

  res.status(200).json({
    success: true,
    count: processedUsers.length,
    total,
    pages: Math.ceil(total / limit),
    data: processedUsers
  });
});

// @desc     Count users matching the same filter set as getUsers (Community filter count)
// @route    GET /api/v1/auth/users/count
// @access   Private
exports.getUsersCount = asyncHandler(async (req, res, next) => {
  const query = await buildUsersQuery(req);
  const count = await User.countDocuments(query);
  return res.status(200).json({ success: true, data: { count } });
});

// @desc     Get single user
// @route    GET /api/v1/auth/users/:id
// @access   Private/Admin
exports.getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .select(USER_PUBLIC_FIELDS);

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  // Process user images to add imageUrls
  const userWithImages = processUserImages(user, req);

  res.status(200).json({
    success: true,
    data: userWithImages
  });
});

// @desc     Get single user — PUBLIC read path (no auth required)
// @route    GET /api/v1/auth/users/:id/public
// @access   Public (optionalAuth — req.user is set if a valid token is
//           present, but a missing/invalid token still resolves here)
//
// Powers logged-out web visits to shared banatalk.com/profile/:id links
// (Package 0 app<->web deep linking). Same USER_PUBLIC_FIELDS + response
// shape as getUser so the web client can reuse its existing parser, but
// additionally respects the user's privacySettings for anyone who isn't
// viewing their own profile:
//   - privacySettings.showCountryRegion === false → drop location.country/state
//   - privacySettings.showCity === false          → drop location.city
//   - privacySettings.showAge === false            → drop birth_year/month/day
//   - privacySettings.showOnlineStatus === false   → drop isOnline/lastActive
//   - privacySettings.showGiftingLevel === false   → drop vipSubscription
//
// NOTE: the schema has no single "whole profile is private" switch today —
// only these granular toggles. As defensive forward-compatibility, if a
// future `privacySettings.isPrivate` / `privacySettings.profileVisibility
// === 'private'` field is ever added, this falls back to a minimal-fields
// response (name/username/first image/bio) instead of leaking everything,
// while still returning the same { success, data } shape (not a 403) so a
// shared link never hard-breaks the web page.
exports.getUserPublic = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).select(USER_PUBLIC_FIELDS);

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  const isOwner = !!(req.user && req.user._id.toString() === req.params.id);
  const privacySettings = user.privacySettings || {};

  // Forward-compatible whole-profile privacy gate (not present in the
  // current schema — see note above).
  const isWhollyPrivate =
    !isOwner &&
    (privacySettings.isPrivate === true || privacySettings.profileVisibility === 'private');

  if (isWhollyPrivate) {
    const minimal = {
      _id: user._id,
      name: user.name,
      username: user.username,
      bio: user.bio,
      images: user.images && user.images.length ? [user.images[0]] : [],
    };
    const minimalWithImages = processUserImages(minimal, req);
    return res.status(200).json({
      success: true,
      data: minimalWithImages,
    });
  }

  const userWithImages = processUserImages(user, req);

  if (!isOwner) {
    // Redact fields per granular privacy toggles. Defaults are `true`
    // (visible) per the schema, so only explicit `false` hides a field.
    if (privacySettings.showCountryRegion === false) {
      if (userWithImages.location) {
        delete userWithImages.location.country;
        delete userWithImages.location.state;
      }
    }
    if (privacySettings.showCity === false) {
      if (userWithImages.location) {
        delete userWithImages.location.city;
      }
    }
    if (privacySettings.showAge === false) {
      delete userWithImages.birth_year;
      delete userWithImages.birth_month;
      delete userWithImages.birth_day;
    }
    if (privacySettings.showOnlineStatus === false) {
      delete userWithImages.isOnline;
      delete userWithImages.lastActive;
    }
    if (privacySettings.showGiftingLevel === false) {
      delete userWithImages.vipSubscription;
    }
  }

  res.status(200).json({
    success: true,
    data: userWithImages,
  });
});

// @desc     Get user by username
// @route    GET /api/v1/users/username/:username
// @access   Private
exports.getUserByUsername = asyncHandler(async (req, res, next) => {
  const { username } = req.params;

  // Normalize username (lowercase, remove @ if present)
  const normalizedUsername = username.toLowerCase().replace(/^@/, '').trim();

  if (!normalizedUsername) {
    return next(new ErrorResponse('Username is required', 400));
  }

  const user = await User.findOne({ username: normalizedUsername })
    .select(USER_PUBLIC_FIELDS);

  if (!user) {
    return next(new ErrorResponse(`User not found with username @${normalizedUsername}`, 404));
  }

  // Process user images to add imageUrls
  const userWithImages = processUserImages(user, req);

  res.status(200).json({
    success: true,
    data: userWithImages
  });
});

// @desc     Search users by username (partial match)
// @route    GET /api/v1/users/search/username
// @access   Private
exports.searchUsersByUsername = asyncHandler(async (req, res, next) => {
  const { q, limit = 20 } = req.query;

  if (!q || q.length < 2) {
    return next(new ErrorResponse('Search query must be at least 2 characters', 400));
  }

  // Normalize query (lowercase, remove @ if present)
  const normalizedQuery = q.toLowerCase().replace(/^@/, '').trim();

  // Get blocked users
  let blockedUserIds = [];
  if (req.user) {
    blockedUserIds = Array.from(await getBlockedUserIds(req.user._id));
  }

  // Build query - partial match on username, exclude blocked users and self
  const query = {
    username: { $regex: normalizedQuery, $options: 'i' },
    _id: { $nin: [...blockedUserIds, req.user._id] }
  };

  const users = await User.find(query)
    .select(USER_LIST_FIELDS)
    .limit(parseInt(limit, 10))
    .lean();

  // Process images for each user
  const usersWithImages = users.map(user => processUserImages(user, req));

  res.status(200).json({
    success: true,
    count: usersWithImages.length,
    data: usersWithImages
  });
});

// @desc     Create user
// @route    POST /api/v1/auth/users
// @access   Private/Admin
exports.createUser = asyncHandler(async (req, res, next) => {
  const user = await User.create(req.body);

  res.status(201).json({
    success: true,
    data: user
  });
});

// @desc     Update user
// @route    PUT /api/v1/auth/users/:id
// @access   Private (own profile) or Admin
exports.updateUser = asyncHandler(async (req, res, next) => {
  // Authorization check - users can only update their own profile
  if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to update this user', 403));
  }

  // Filter out sensitive fields that users cannot update themselves.
  // birthDateChangesAt is a server-managed audit trail — clients can never
  // write it directly (we append to it ourselves below when birth changes).
  const restrictedFields = ['role', 'userMode', 'vipSubscription', 'fcmTokens', 'password', 'email', 'birthDateChangesAt'];
  const updateData = { ...req.body };

  // Only admins can update restricted fields
  if (req.user.role !== 'admin') {
    restrictedFields.forEach(field => delete updateData[field]);
  }

  // Validate that native_language and language_to_learn are different
  const existingUser = await User.findById(req.params.id).select('native_language language_to_learn birth_year birth_month birth_day birthDateChangesAt');
  const newNativeLanguage = (updateData.native_language || existingUser?.native_language || '').toLowerCase().trim();
  const newLanguageToLearn = (updateData.language_to_learn || existingUser?.language_to_learn || '').toLowerCase().trim();

  if (newNativeLanguage && newLanguageToLearn && newNativeLanguage === newLanguageToLearn) {
    return next(new ErrorResponse('Native language and language to learn cannot be the same', 400));
  }

  // Birthdate change handling: validate the proposed date, enforce the
  // ≤3-changes-per-60-days cap (sliding window), and append a timestamp to
  // birthDateChangesAt on accept. Admins bypass the cap so support can fix
  // user mistakes.
  const birthTouched = ['birth_year', 'birth_month', 'birth_day'].some(
    f => f in updateData
  );
  if (birthTouched && existingUser) {
    const currentDate = `${existingUser.birth_year}-${existingUser.birth_month}-${existingUser.birth_day}`;
    const newYear = updateData.birth_year ?? existingUser.birth_year ?? '';
    const newMonth = updateData.birth_month ?? existingUser.birth_month ?? '';
    const newDay = updateData.birth_day ?? existingUser.birth_day ?? '';
    const newDate = `${newYear}-${newMonth}-${newDay}`;

    if (newDate !== currentDate) {
      // Real-date validation — reject e.g. 2025-02-31 by round-tripping
      // through Date and confirming the components survived.
      const y = parseInt(newYear, 10);
      const m = parseInt(newMonth, 10);
      const d = parseInt(newDay, 10);
      const dt = new Date(y, m - 1, d);
      if (
        !y || !m || !d ||
        dt.getFullYear() !== y ||
        dt.getMonth() !== m - 1 ||
        dt.getDate() !== d
      ) {
        return next(new ErrorResponse('Invalid birthdate', 400));
      }

      // Min age 13 (COPPA floor).
      const now = new Date();
      let age = now.getFullYear() - y;
      const beforeBirthdayThisYear =
        now.getMonth() < m - 1 ||
        (now.getMonth() === m - 1 && now.getDate() < d);
      if (beforeBirthdayThisYear) age -= 1;
      if (age < 13) {
        return next(new ErrorResponse('You must be at least 13 years old', 400));
      }

      // Rate limit: ≤3 changes in any trailing 60-day window. Admins skip
      // the cap so support can correct mistakes.
      if (req.user.role !== 'admin') {
        const windowMs = 60 * 24 * 60 * 60 * 1000;
        const cutoff = Date.now() - windowMs;
        const recent = (existingUser.birthDateChangesAt || [])
          .map(d => new Date(d))
          .filter(d => d.getTime() > cutoff);
        if (recent.length >= 3) {
          const earliestInWindow = recent
            .slice()
            .sort((a, b) => a.getTime() - b.getTime())[0];
          const nextAvailableAt = new Date(earliestInWindow.getTime() + windowMs);
          return res.status(429).json({
            success: false,
            error: 'Birthdate can be changed at most 3 times per 60 days',
            nextAvailableAt: nextAvailableAt.toISOString(),
            remainingChanges: 0,
          });
        }
      }

      // Record the change (server-controlled — we already stripped any
      // client-supplied birthDateChangesAt above).
      updateData.birthDateChangesAt = [
        ...(existingUser.birthDateChangesAt || []),
        new Date(),
      ];
    }
  }

  const user = await User.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  });

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  sendTokenResponse(user, 200, res);
});

// @desc     Delete user
// @route    DELETE /api/v1/auth/users/:id
// @access   Private (own account) or Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  // Authorization check - users can only delete their own account
  if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to delete this user', 403));
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  // Delete all user images from S3/Spaces
  if (user.images && user.images.length > 0) {
    await Promise.all(
      user.images.map(image => deleteFromSpaces(image))
    );
  }

  // Cascade delete all user-related data
  const userCascadeDeleteService = require('../services/userCascadeDeleteService');
  const deleteResult = await userCascadeDeleteService.deleteUserAndAllData(req.params.id);

  res.status(200).json({
    success: true,
    message: 'User account and all associated data deleted successfully',
    data: deleteResult
  });
});

// @desc     Update profile picture (first image only)
// @route    PUT /api/v1/auth/users/:id/profile-picture
// @access   Private
exports.updateProfilePicture = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  // Check authorization - user can only update their own profile picture
  if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to update this user\'s profile picture', 403));
  }

  if (!req.file || !req.file.location) {
    return next(new ErrorResponse('Please upload a file', 400));
  }

  const newImageUrl = req.file.location;
  let oldProfilePicture = null;
  
  if (user.images.length > 0) {
    // Replace existing profile picture
    oldProfilePicture = user.images[0];
    user.images[0] = newImageUrl;
  } else {
    // First time adding profile picture
    user.images.unshift(newImageUrl);
  }

  await user.save();

  // Delete old image from Spaces if it existed
  if (oldProfilePicture) {
    await deleteFromSpaces(oldProfilePicture);
  }

  return res.status(200).json({
    success: true,
    message: oldProfilePicture ? 'Profile picture updated successfully' : 'Profile picture added successfully',
    images: user.images,
    imageUrl: newImageUrl
  });
});

// @desc     Remove profile picture (first image only)
// @route    DELETE /api/v1/auth/users/:id/profile-picture
// @access   Private
exports.removeProfilePicture = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Check authorization - user can only remove their own profile picture
  if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to remove this user\'s profile picture', 403));
  }

  if (user.images.length === 0) {
    return next(new ErrorResponse('No profile picture to remove', 400));
  }

  const profilePictureUrl = user.images[0];
  
  // Remove first image
  user.images.shift();
  
  await user.save();
  
  // Delete from Spaces
  await deleteFromSpaces(profilePictureUrl);

  return res.status(200).json({
    success: true,
    message: 'Profile picture removed successfully',
    images: user.images
  });
});

// @desc     Upload additional user photo (Spaces)
// @route    PUT /api/v1/auth/users/:id/photo
// @access   Private
exports.userPhotoUpload = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  // Check authorization - user can only upload to their own profile
  if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to upload photos for this user', 403));
  }

  if (!req.file || !req.file.location) {
    return next(new ErrorResponse('Please upload a file', 400));
  }

  // Check image limit (maximum 10 images)
  if (user.images.length >= 10) {
    return next(new ErrorResponse('Maximum of 10 images already uploaded', 400));
  }

  user.images.push(req.file.location);
  await user.save();

  return res.status(200).json({
    success: true,
    message: 'Image added successfully',
    images: user.images
  });
});

// @desc     Delete user photo at specific index (Spaces)
// @route    DELETE /api/v1/auth/users/:userId/photo/:index
// @access   Private
exports.deleteUserPhoto = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.userId);
  
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Check authorization - user can only delete their own photos
  if (req.user._id.toString() !== req.params.userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to delete this user\'s photos', 403));
  }

  const index = parseInt(req.params.index);
  
  if (isNaN(index) || index < 0 || index >= user.images.length) {
    return next(new ErrorResponse('Invalid image index', 400));
  }

  const url = user.images[index];
  user.images.splice(index, 1);
  
  await user.save();
  await deleteFromSpaces(url);

  return res.status(200).json({
    success: true,
    message: 'Image deleted successfully',
    images: user.images
  });
});

// @desc     Follow a user
// @route    POST /api/v1/auth/users/:userId/follow/:targetUserId
// @access   Private
exports.followUser = asyncHandler(async (req, res, next) => {
  const { userId, targetUserId } = req.params;

  if (userId === targetUserId) {
    return next(new ErrorResponse('Cannot follow yourself', 400));
  }

  const [user, targetUser] = await Promise.all([
    User.findById(userId),
    User.findById(targetUserId)
  ]);

  if (!user || !targetUser) {
    return next(new ErrorResponse('User not found', 404));
  }

  if (user.following.includes(targetUserId)) {
    return next(new ErrorResponse('Already following this user', 400));
  }

  user.following.push(targetUserId);
  targetUser.followers.push(userId);

  await Promise.all([user.save(), targetUser.save()]);

  // Send new-follower notification. Task 9 (Workstream E-core, audit fix
  // #6): a follow used to route through sendFriendRequest, so users saw
  // "New Friend Request" for a plain follow. Use the dedicated
  // new_follower type instead; sendFriendRequest is reserved for real
  // friend requests elsewhere.
  const notificationService = require('../services/notificationService');
  notificationService.sendNewFollower(
    targetUserId,
    userId
  ).catch(err => console.error('New follower notification failed:', err));

  res.status(200).json({
    success: true,
    message: `Now following ${targetUser.name}`,
    data: {
      targetUser: {
        followersCount: targetUser.followers.length,
        followers: targetUser.followers
      },
      currentUser: {
        followingCount: user.following.length,
        following: user.following
      }
    }
  });
});

// @desc     Unfollow a user
// @route    POST /api/v1/auth/users/:userId/unfollow/:targetUserId
// @access   Private
exports.unfollowUser = asyncHandler(async (req, res, next) => {
  const { userId, targetUserId } = req.params;

  const [user, targetUser] = await Promise.all([
    User.findById(userId),
    User.findById(targetUserId)
  ]);

  if (!user || !targetUser) {
    return next(new ErrorResponse('User not found', 404));
  }

  if (!user.following.includes(targetUserId)) {
    return next(new ErrorResponse('Not following this user', 400));
  }

  user.following = user.following.filter(id => id.toString() !== targetUserId);
  targetUser.followers = targetUser.followers.filter(id => id.toString() !== userId);

  await Promise.all([user.save(), targetUser.save()]);

  res.status(200).json({
    success: true,
    message: `Unfollowed ${targetUser.name}`,
    data: {
      targetUser: {
        followersCount: targetUser.followers.length,
        followers: targetUser.followers
      },
      currentUser: {
        followingCount: user.following.length,
        following: user.following
      }
    }
  });
});

// @desc     Get user followers
// @route    GET /api/v1/auth/users/:userId/followers
// @access   Private
exports.getFollowers = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.userId)
    .populate('followers', 'name images bio gender mbti location language_to_learn native_language');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Get blocked users if authenticated
  let blockedUserIds = [];
  if (req.user) {
    blockedUserIds = Array.from(await getBlockedUserIds(req.user._id));
  }

  // Filter out blocked users from followers list
  let followers = user.followers || [];
  if (blockedUserIds.length > 0) {
    followers = followers.filter(follower => 
      !blockedUserIds.includes(follower._id.toString())
    );
  }

  const followersWithImages = followers.map(follower => ({
    ...follower.toObject(),
    imageUrls: follower.images.map(image => 
      image
    )
  }));

  res.status(200).json({
    success: true,
    count: followersWithImages.length,
    data: followersWithImages
  });
});

// @desc     Get user following
// @route    GET /api/v1/auth/users/:userId/following
// @access   Private
exports.getFollowing = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.userId)
     .populate('following', 'name images bio gender mbti location language_to_learn native_language');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Get blocked users if authenticated
  let blockedUserIds = [];
  if (req.user) {
    blockedUserIds = Array.from(await getBlockedUserIds(req.user._id));
  }

  // Filter out blocked users from following list
  let following = user.following || [];
  if (blockedUserIds.length > 0) {
    following = following.filter(followedUser => 
      !blockedUserIds.includes(followedUser._id.toString())
    );
  }

  const followingWithImages = following.map(followedUser => ({
    ...followedUser.toObject(),
    imageUrls: followedUser.images.map(image => 
      image
    )
  }));

  res.status(200).json({
    success: true,
    count: followingWithImages.length,
    data: followingWithImages
  });
});

/**
 * @desc     Update user privacy settings
 * @route    PUT /api/v1/auth/users/:userId/privacy
 * @access   Private
 */
exports.updatePrivacySettings = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { privacySettings } = req.body;

  // Check if user is updating their own privacy settings
  if (req.user._id.toString() !== userId) {
    return next(new ErrorResponse('Not authorized to update this user\'s privacy settings', 403));
  }

  // Find user
  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Validate privacy settings object
  if (!privacySettings || typeof privacySettings !== 'object') {
    return next(new ErrorResponse('Privacy settings must be an object', 400));
  }

  // Update privacy settings (merge with existing settings)
  user.privacySettings = {
    ...user.privacySettings,
    ...privacySettings
  };

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Privacy settings updated successfully',
    data: {
      _id: user._id,
      privacySettings: user.privacySettings
    }
  });
});

/**
 * @desc     Get user privacy settings
 * @route    GET /api/v1/auth/users/:userId/privacy
 * @access   Private
 */
exports.getPrivacySettings = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  // Users can only view their own privacy settings
  if (req.user._id.toString() !== userId) {
    return next(new ErrorResponse('Not authorized to view this user\'s privacy settings', 403));
  }

  const user = await User.findById(userId).select('privacySettings');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      _id: user._id,
      privacySettings: user.privacySettings || {}
    }
  });
});

// @desc     Activate VIP subscription for user
// @route    POST /api/v1/auth/users/:userId/vip/activate
// @access   Private
exports.activateVIPSubscription = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { plan, paymentMethod } = req.body;

  // Check if user is updating their own subscription or is admin
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to activate VIP for this user', 403));
  }

  // Validate plan
  if (!['monthly', 'quarterly', 'yearly'].includes(plan)) {
    return next(new ErrorResponse('Invalid subscription plan', 400));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Activate VIP
  await user.activateVIP(plan, paymentMethod);

  res.status(200).json({
    success: true,
    message: 'VIP subscription activated successfully',
    data: {
      userMode: user.userMode,
      vipSubscription: user.vipSubscription,
      vipFeatures: user.vipFeatures
    }
  });
});

// @desc     Deactivate VIP subscription for user
// @route    POST /api/v1/auth/users/:userId/vip/deactivate
// @access   Private
exports.deactivateVIPSubscription = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  // Check if user is updating their own subscription or is admin
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to deactivate VIP for this user', 403));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  if (!user.isVIP()) {
    return next(new ErrorResponse('User does not have an active VIP subscription', 400));
  }

  // Deactivate VIP
  await user.deactivateVIP();

  res.status(200).json({
    success: true,
    message: 'VIP subscription deactivated successfully',
    data: {
      userMode: user.userMode,
      vipSubscription: user.vipSubscription
    }
  });
});

// @desc     Get VIP subscription status
// @route    GET /api/v1/auth/users/:userId/vip/status
// @access   Private
exports.getVIPStatus = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  // Users can view their own VIP status, or admins can view any user's status
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to view VIP status for this user', 403));
  }

  const user = await User.findById(userId).select('userMode vipSubscription vipFeatures');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      isVIP: user.isVIP(),
      userMode: user.userMode,
      vipSubscription: user.vipSubscription,
      vipFeatures: user.vipFeatures
    }
  });
});

// @desc     Upgrade visitor to regular user
// @route    POST /api/v1/auth/users/:userId/upgrade-visitor
// @access   Private
exports.upgradeVisitor = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  // Users can upgrade themselves, or admins can upgrade any user
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to upgrade this user', 403));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  if (!user.isVisitor()) {
    return next(new ErrorResponse('User is not in visitor mode', 400));
  }

  // Upgrade from visitor
  await user.upgradeFromVisitor();

  res.status(200).json({
    success: true,
    message: 'User upgraded from visitor to regular successfully',
    data: {
      userMode: user.userMode
    }
  });
});

// @desc     Check visitor limitations
// @route    GET /api/v1/auth/users/:userId/visitor/limits
// @access   Private
exports.checkVisitorLimits = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  // Users can check their own limits, or admins can check any user's limits
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to view visitor limits for this user', 403));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  if (!user.isVisitor()) {
    return next(new ErrorResponse('User is not in visitor mode', 400));
  }

  res.status(200).json({
    success: true,
    data: {
      canSendMessage: user.canSendMessage(),
      canViewProfile: user.canViewProfile(),
      visitorLimitations: user.visitorLimitations,
      limits: {
        messagesPerDay: 10,
        profileViewsPerDay: 20
      }
    }
  });
});

// @desc     Change user mode (admin only)
// @route    PUT /api/v1/auth/users/:userId/mode
// @access   Private/Admin
exports.changeUserMode = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { userMode } = req.body;

  // Validate userMode
  if (!['visitor', 'regular', 'vip'].includes(userMode)) {
    return next(new ErrorResponse('Invalid user mode', 400));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  user.userMode = userMode;
  await user.save();

  res.status(200).json({
    success: true,
    message: `User mode changed to ${userMode} successfully`,
    data: {
      userMode: user.userMode
    }
  });
});

// @desc     Get user limitations status
// @route    GET /api/v1/auth/users/:userId/limits
// @access   Private
exports.getUserLimits = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  // Users can view their own limits, or admins can view any user's limits
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to view limits for this user', 403));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Reset counters if new day
  const { resetDailyCounters, getUserLimits } = require('../utils/limitations');
  await resetDailyCounters(user);
  await user.save();

  // Get limit information
  const limitsInfo = getUserLimits(user);

  res.status(200).json({
    success: true,
    data: limitsInfo
  });
});

// @desc    Check whether a username is available for registration
// @route   GET /api/v1/users/check-username?value=<username>
// @access  Public (rate-limited via generalLimiter)
exports.checkUsernameAvailability = asyncHandler(async (req, res) => {
  const { ok, normalized, reason } = validateUsername(req.query.value);
  if (!ok) {
    return res.status(200).json({ success: true, data: { available: false, reason } });
  }
  const exists = await User.exists({ username: normalized });
  return res.status(200).json({
    success: true,
    data: { available: !exists, reason: exists ? 'taken' : null },
  });
});

// @desc     Get current user's notification preferences
// @route    GET /api/v1/auth/users/me/notification-preferences
// @access   Private
exports.getNotificationPreferences = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('notificationPreferences');
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }
  return res.status(200).json({
    success: true,
    data: { prefs: user.notificationPreferences || {} },
  });
});

// @desc     Update current user's notification preferences
// @route    PUT /api/v1/auth/users/me/notification-preferences
// @access   Private
exports.updateNotificationPreferences = asyncHandler(async (req, res, next) => {
  const { prefs } = req.body;
  if (!prefs || typeof prefs !== 'object') {
    return next(new ErrorResponse('prefs body required', 400));
  }
  const allowed = [
    'chat', 'wave', 'voiceRoomStart', 'scheduledRoomReminder',
    'followerMoment', 'visitorAlert', 'matchAlert',
  ];
  const update = {};
  for (const key of allowed) {
    if (key in prefs) {
      update[`notificationPreferences.${key}`] = !!prefs[key];
    }
  }
  if (Object.keys(update).length === 0) {
    return next(new ErrorResponse('no valid prefs in body', 400));
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: update },
    { new: true, select: 'notificationPreferences' },
  );
  return res.status(200).json({
    success: true,
    data: { prefs: user.notificationPreferences || {} },
  });
});

const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();
  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };
  // Securing Cookie in https
  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }
  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    token: token,
    option: options,
    user: user
  });
};
