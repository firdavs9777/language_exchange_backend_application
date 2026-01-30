/**
 * Pagination Utilities
 *
 * Standardized pagination helpers to reduce code duplication
 * and ensure consistent pagination behavior across controllers.
 */

/**
 * Default pagination configuration
 */
const PAGINATION_DEFAULTS = {
  defaultLimit: 10,
  maxLimit: 100,      // Prevent abuse with very large page sizes
  minLimit: 1,
  defaultPage: 1
};

/**
 * Extract and validate pagination parameters from request query
 *
 * @param {Object} query - req.query object
 * @param {Object} options - Override default pagination settings
 * @returns {Object} Validated pagination params { page, limit, skip }
 *
 * @example
 * const { page, limit, skip } = getPaginationParams(req.query);
 * const { page, limit, skip } = getPaginationParams(req.query, { defaultLimit: 20, maxLimit: 50 });
 */
exports.getPaginationParams = (query, options = {}) => {
  const {
    defaultLimit = PAGINATION_DEFAULTS.defaultLimit,
    maxLimit = PAGINATION_DEFAULTS.maxLimit,
    minLimit = PAGINATION_DEFAULTS.minLimit,
    defaultPage = PAGINATION_DEFAULTS.defaultPage
  } = options;

  // Parse page number
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = defaultPage;
  }

  // Parse and clamp limit
  let limit = parseInt(query.limit, 10);
  if (isNaN(limit)) {
    limit = defaultLimit;
  }
  limit = Math.max(minLimit, Math.min(limit, maxLimit));

  // Calculate skip
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Build standardized pagination response object
 *
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total items count
 * @returns {Object} Pagination metadata object
 *
 * @example
 * res.json({
 *   success: true,
 *   data: items,
 *   ...buildPaginationResponse(page, limit, total)
 * });
 */
exports.buildPaginationResponse = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit) || 0;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null
    }
  };
};

/**
 * Build pagination response with count summary (for list endpoints)
 *
 * @param {Array} data - Array of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total items count
 * @returns {Object} Full paginated response
 */
exports.buildPaginatedResponse = (data, page, limit, total) => {
  const paginationMeta = exports.buildPaginationResponse(page, limit, total);

  return {
    success: true,
    count: data.length,
    total,
    ...paginationMeta,
    data
  };
};

/**
 * Cursor-based pagination for feeds (more efficient for large datasets)
 * Used for infinite scroll implementations
 *
 * @param {Object} query - req.query object
 * @param {Object} options - Configuration options
 * @returns {Object} Cursor params { cursor, limit, cursorField }
 *
 * @example
 * const { cursor, limit, cursorField } = getCursorParams(req.query);
 * const query = cursor ? { _id: { $lt: cursor } } : {};
 * const items = await Model.find(query).sort({ _id: -1 }).limit(limit + 1);
 *
 * const hasMore = items.length > limit;
 * if (hasMore) items.pop();
 * const nextCursor = hasMore ? items[items.length - 1]._id : null;
 */
exports.getCursorParams = (query, options = {}) => {
  const {
    defaultLimit = PAGINATION_DEFAULTS.defaultLimit,
    maxLimit = PAGINATION_DEFAULTS.maxLimit,
    cursorField = '_id'
  } = options;

  // Parse cursor (typically ObjectId or timestamp)
  const cursor = query.cursor || query.after || null;

  // Parse and clamp limit
  let limit = parseInt(query.limit, 10);
  if (isNaN(limit)) {
    limit = defaultLimit;
  }
  limit = Math.max(1, Math.min(limit, maxLimit));

  return { cursor, limit, cursorField };
};

/**
 * Build cursor-based pagination response
 *
 * @param {Array} items - Array of items (fetch limit + 1 to check hasMore)
 * @param {number} limit - Requested limit
 * @param {string} cursorField - Field to use for cursor (default: '_id')
 * @returns {Object} Cursor pagination response
 */
exports.buildCursorResponse = (items, limit, cursorField = '_id') => {
  const hasMore = items.length > limit;

  // Remove extra item used for hasMore check
  if (hasMore) {
    items.pop();
  }

  // Get next cursor from last item
  const nextCursor = hasMore && items.length > 0
    ? items[items.length - 1][cursorField]
    : null;

  return {
    success: true,
    count: items.length,
    hasMore,
    nextCursor,
    data: items
  };
};

/**
 * Apply pagination to a Mongoose query
 *
 * @param {Object} query - Mongoose query object
 * @param {Object} paginationParams - Output from getPaginationParams
 * @returns {Object} Modified query with skip and limit
 *
 * @example
 * const params = getPaginationParams(req.query);
 * const items = await applyPagination(Model.find(filter), params);
 */
exports.applyPagination = (query, { skip, limit }) => {
  return query.skip(skip).limit(limit);
};

/**
 * Parse sort parameters from request
 *
 * @param {Object} query - req.query object
 * @param {string} defaultSort - Default sort string (e.g., '-createdAt')
 * @param {Array} allowedFields - Fields allowed for sorting
 * @returns {string} Mongoose sort string
 *
 * @example
 * const sort = getSortParams(req.query, '-createdAt', ['createdAt', 'name', 'updatedAt']);
 * const items = await Model.find().sort(sort);
 */
exports.getSortParams = (query, defaultSort = '-createdAt', allowedFields = []) => {
  if (!query.sort) {
    return defaultSort;
  }

  // If no whitelist, use default sort for security
  if (allowedFields.length === 0) {
    return defaultSort;
  }

  // Parse and validate sort fields
  const sortFields = query.sort.split(',');
  const validSorts = [];

  for (const field of sortFields) {
    const isDescending = field.startsWith('-');
    const fieldName = isDescending ? field.slice(1) : field;

    if (allowedFields.includes(fieldName)) {
      validSorts.push(field);
    }
  }

  return validSorts.length > 0 ? validSorts.join(' ') : defaultSort;
};

/**
 * Pagination defaults for export/configuration
 */
exports.PAGINATION_DEFAULTS = PAGINATION_DEFAULTS;
