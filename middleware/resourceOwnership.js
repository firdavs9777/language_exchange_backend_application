/**
 * Resource Ownership Middleware
 *
 * Generic middleware for checking resource ownership authorization.
 * Supports multiple models and flexible ownership checks.
 */

const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const mongoose = require('mongoose');

/**
 * Model registry - import models on demand to avoid circular dependencies
 */
const getModel = (modelName) => {
  const models = {
    user: () => require('../models/User'),
    moment: () => require('../models/Moment'),
    comment: () => require('../models/Comment'),
    story: () => require('../models/Story'),
    message: () => require('../models/Message'),
    lesson: () => require('../models/Lesson'),
    report: () => require('../models/Report'),
    notification: () => require('../models/Notification'),
    vocabulary: () => require('../models/Vocabulary'),
    highlight: () => require('../models/StoryHighlight'),
    conversation: () => require('../models/Conversation')
  };

  const modelLoader = models[modelName.toLowerCase()];
  if (!modelLoader) {
    throw new Error(`Unknown model: ${modelName}`);
  }
  return modelLoader();
};

/**
 * Check resource ownership
 *
 * Middleware factory that creates ownership check middleware.
 * The resource is fetched and attached to req for later use.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.model - Model name (e.g., 'moment', 'comment')
 * @param {string} options.ownerField - Field containing owner ID (default: 'user')
 * @param {string} options.idParam - Request param for resource ID (default: 'id')
 * @param {boolean} options.allowAdmin - Allow admins to bypass (default: true)
 * @param {Array} options.additionalOwners - Additional fields that grant ownership
 * @param {string} options.resourceKey - Key to store resource on req (default: 'resource')
 *
 * @example
 * // Basic usage
 * router.delete('/:id', protect, checkOwnership({ model: 'moment' }), deleteMoment);
 *
 * // Custom owner field
 * router.delete('/:id', protect, checkOwnership({ model: 'message', ownerField: 'sender' }), deleteMessage);
 *
 * // Multiple owners (comment owner OR moment owner)
 * router.delete('/:commentId', protect, checkOwnership({
 *   model: 'comment',
 *   idParam: 'commentId',
 *   additionalOwners: ['momentOwner']
 * }), deleteComment);
 */
exports.checkOwnership = (options = {}) => {
  const {
    model,
    ownerField = 'user',
    idParam = 'id',
    allowAdmin = true,
    additionalOwners = [],
    resourceKey = 'resource'
  } = options;

  if (!model) {
    throw new Error('Model name is required for checkOwnership middleware');
  }

  return asyncHandler(async (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return next(new ErrorResponse('Authentication required', 401));
    }

    // Get resource ID from params
    const resourceId = req.params[idParam];
    if (!resourceId) {
      return next(new ErrorResponse(`Missing ${idParam} parameter`, 400));
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(resourceId)) {
      return next(new ErrorResponse('Invalid resource ID format', 400));
    }

    // Fetch resource
    const Model = getModel(model);
    const resource = await Model.findById(resourceId);

    if (!resource) {
      return next(new ErrorResponse(`${model} not found`, 404));
    }

    // Admin bypass
    if (allowAdmin && req.user.role === 'admin') {
      req[resourceKey] = resource;
      return next();
    }

    // Check primary ownership
    const userId = req.user._id.toString();
    const ownerId = resource[ownerField]?.toString();

    if (ownerId === userId) {
      req[resourceKey] = resource;
      return next();
    }

    // Check additional owner fields
    for (const field of additionalOwners) {
      const additionalOwnerId = resource[field]?.toString();
      if (additionalOwnerId === userId) {
        req[resourceKey] = resource;
        return next();
      }
    }

    // Not authorized
    return next(new ErrorResponse(`Not authorized to access this ${model}`, 403));
  });
};

/**
 * Check if user is participant in a conversation/message
 *
 * @param {Object} options - Configuration options
 * @param {string} options.senderField - Field for sender ID (default: 'sender')
 * @param {string} options.receiverField - Field for receiver ID (default: 'receiver')
 *
 * @example
 * router.get('/:id', protect, checkParticipant({ model: 'message' }), getMessage);
 */
exports.checkParticipant = (options = {}) => {
  const {
    model = 'message',
    senderField = 'sender',
    receiverField = 'receiver',
    idParam = 'id',
    allowAdmin = true,
    resourceKey = 'resource'
  } = options;

  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return next(new ErrorResponse('Authentication required', 401));
    }

    const resourceId = req.params[idParam];
    if (!resourceId) {
      return next(new ErrorResponse(`Missing ${idParam} parameter`, 400));
    }

    if (!mongoose.Types.ObjectId.isValid(resourceId)) {
      return next(new ErrorResponse('Invalid resource ID format', 400));
    }

    const Model = getModel(model);
    const resource = await Model.findById(resourceId);

    if (!resource) {
      return next(new ErrorResponse(`${model} not found`, 404));
    }

    // Admin bypass
    if (allowAdmin && req.user.role === 'admin') {
      req[resourceKey] = resource;
      return next();
    }

    // Check if user is sender or receiver
    const userId = req.user._id.toString();
    const senderId = resource[senderField]?.toString();
    const receiverId = resource[receiverField]?.toString();

    if (userId === senderId || userId === receiverId) {
      req[resourceKey] = resource;
      return next();
    }

    return next(new ErrorResponse(`Not authorized to access this ${model}`, 403));
  });
};

/**
 * Check ownership or specific role
 *
 * @param {Object} options - Configuration options
 * @param {Array} options.roles - Roles that can bypass ownership check
 *
 * @example
 * // Owner or moderator can delete
 * router.delete('/:id', protect, checkOwnershipOrRole({
 *   model: 'moment',
 *   roles: ['admin', 'moderator']
 * }), deleteMoment);
 */
exports.checkOwnershipOrRole = (options = {}) => {
  const {
    model,
    ownerField = 'user',
    idParam = 'id',
    roles = ['admin'],
    resourceKey = 'resource'
  } = options;

  if (!model) {
    throw new Error('Model name is required');
  }

  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return next(new ErrorResponse('Authentication required', 401));
    }

    // Check if user has allowed role
    if (roles.includes(req.user.role)) {
      // Still fetch resource for controller use
      const resourceId = req.params[idParam];
      if (resourceId && mongoose.Types.ObjectId.isValid(resourceId)) {
        const Model = getModel(model);
        const resource = await Model.findById(resourceId);
        if (resource) {
          req[resourceKey] = resource;
        }
      }
      return next();
    }

    // Fall back to ownership check
    const resourceId = req.params[idParam];
    if (!resourceId) {
      return next(new ErrorResponse(`Missing ${idParam} parameter`, 400));
    }

    if (!mongoose.Types.ObjectId.isValid(resourceId)) {
      return next(new ErrorResponse('Invalid resource ID format', 400));
    }

    const Model = getModel(model);
    const resource = await Model.findById(resourceId);

    if (!resource) {
      return next(new ErrorResponse(`${model} not found`, 404));
    }

    const userId = req.user._id.toString();
    const ownerId = resource[ownerField]?.toString();

    if (ownerId === userId) {
      req[resourceKey] = resource;
      return next();
    }

    return next(new ErrorResponse(`Not authorized to access this ${model}`, 403));
  });
};

/**
 * Verify self or admin
 *
 * Used for user routes where users can only access their own data
 *
 * @param {Object} options - Configuration options
 * @param {string} options.userIdParam - Request param for user ID (default: 'id')
 *
 * @example
 * router.put('/:id', protect, checkSelfOrAdmin(), updateUser);
 */
exports.checkSelfOrAdmin = (options = {}) => {
  const { userIdParam = 'id' } = options;

  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return next(new ErrorResponse('Authentication required', 401));
    }

    const targetUserId = req.params[userIdParam];
    if (!targetUserId) {
      return next(new ErrorResponse(`Missing ${userIdParam} parameter`, 400));
    }

    const userId = req.user._id.toString();

    // Allow if self or admin
    if (userId === targetUserId || req.user.role === 'admin') {
      return next();
    }

    return next(new ErrorResponse('Not authorized to access this resource', 403));
  });
};

/**
 * Attach resource to request without authorization check
 *
 * Useful when you just want to load the resource for the controller
 *
 * @param {Object} options - Configuration options
 */
exports.loadResource = (options = {}) => {
  const {
    model,
    idParam = 'id',
    resourceKey = 'resource',
    required = true
  } = options;

  if (!model) {
    throw new Error('Model name is required');
  }

  return asyncHandler(async (req, res, next) => {
    const resourceId = req.params[idParam];

    if (!resourceId) {
      if (required) {
        return next(new ErrorResponse(`Missing ${idParam} parameter`, 400));
      }
      return next();
    }

    if (!mongoose.Types.ObjectId.isValid(resourceId)) {
      return next(new ErrorResponse('Invalid resource ID format', 400));
    }

    const Model = getModel(model);
    const resource = await Model.findById(resourceId);

    if (!resource && required) {
      return next(new ErrorResponse(`${model} not found`, 404));
    }

    req[resourceKey] = resource;
    next();
  });
};
