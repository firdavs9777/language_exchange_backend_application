/**
 * Advanced Results Middleware
 *
 * Provides filtering, sorting, field selection, and pagination
 * for Mongoose queries via query string parameters.
 */

// Maximum limit to prevent abuse (requesting too many records)
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

const advancedResults = (model, populate) => async (req, res, next) => {
  let query;

  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit'];

  // Loop over removeFields and delete them from reqQuery
  removeFields.forEach((param) => delete reqQuery[param]);

  let queryStr = JSON.stringify(reqQuery);

  // Create operators (gt,gte,etc)
  queryStr = queryStr.replace(
    /\b(gt|gte|lt|lte|in)\b/g,
    (match) => `$${match}`
  );

  // Finding resource
  query = model.find(JSON.parse(queryStr));

  // Select Fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const requestedLimit = parseInt(req.query.limit, 10) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(1, requestedLimit), MAX_LIMIT);
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await model.countDocuments();
  query = query.skip(startIndex).limit(limit);

  if (populate) {
    query.populate(populate);
  }

  // Executing query
  const results = await query;

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  // Pagination Result
  const pagination = {
    currentPage: page,
    totalPages,
    itemsPerPage: limit,
    hasNextPage,
    hasPrevPage
  };

  if (hasNextPage) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }
  if (hasPrevPage) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.advancedResults = {
    success: true,
    count: results.length,
    total,
    pagination,
    data: results
  };
  next();
};
module.exports = advancedResults;
