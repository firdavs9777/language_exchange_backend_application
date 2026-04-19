const asyncHandler = require('../../middleware/async');
const Order = require('../../models/fitbowl/Order');
const ErrorResponse = require('../../utils/errorResponse');
const { emitOrderUpdate } = require('../../socket/fitbowlHandler');

// Valid status transitions
const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

// @desc    Get kitchen orders
// @route   GET /api/v1/fitbowl/kitchen/orders
// @access  Private (kitchen_admin)
exports.getKitchenOrders = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const skip = (page - 1) * limit;

  const query = {};

  // Filter by status (default: exclude delivered and cancelled)
  if (req.query.status) {
    query.status = req.query.status;
  } else {
    query.status = { $nin: ['delivered', 'cancelled'] };
  }

  const [total, orders] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query)
      .populate('user', 'name phone')
      .sort('createdAt')
      .skip(skip)
      .limit(limit)
      .lean()
  ]);

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: orders
  });
});

// @desc    Update order status
// @route   PUT /api/v1/fitbowl/kitchen/orders/:id/status
// @access  Private (kitchen_admin)
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status, note } = req.body;

  if (!status) {
    return next(new ErrorResponse('Please provide a status', 400));
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
  }

  // Validate status transition
  if (status === 'cancelled') {
    // Cancellation is always allowed (except for already delivered/cancelled)
    if (['delivered', 'cancelled'].includes(order.status)) {
      return next(
        new ErrorResponse(`Cannot cancel an order that is already ${order.status}`, 400)
      );
    }
  } else {
    const currentIndex = STATUS_FLOW.indexOf(order.status);
    const newIndex = STATUS_FLOW.indexOf(status);

    if (newIndex === -1) {
      return next(new ErrorResponse(`Invalid status: ${status}`, 400));
    }

    // Can only move forward in the status sequence
    if (newIndex <= currentIndex) {
      return next(
        new ErrorResponse(
          `Cannot transition from ${order.status} to ${status}. Status can only move forward.`,
          400
        )
      );
    }
  }

  order.status = status;
  order.statusHistory.push({
    status,
    timestamp: new Date(),
    note: note || `Status updated to ${status}`
  });

  // If delivered and payment is cash, mark as paid
  if (status === 'delivered' && order.paymentMethod === 'cash') {
    order.paymentStatus = 'paid';
  }

  await order.save();

  // Emit socket event to user via /fitbowl namespace
  const io = req.app.get('io');
  if (io) {
    emitOrderUpdate(io, order.user.toString(), order);
  }

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Get kitchen stats for today
// @route   GET /api/v1/fitbowl/kitchen/stats
// @access  Private (kitchen_admin)
exports.getKitchenStats = asyncHandler(async (req, res, next) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const stats = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: todayStart, $lte: todayEnd }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        revenue: { $sum: '$totalAmount' }
      }
    }
  ]);

  // Format stats
  const statusCounts = {};
  let totalRevenue = 0;
  let totalOrders = 0;

  stats.forEach((stat) => {
    statusCounts[stat._id] = stat.count;
    totalOrders += stat.count;
    if (stat._id !== 'cancelled') {
      totalRevenue += stat.revenue;
    }
  });

  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  res.status(200).json({
    success: true,
    data: {
      totalOrders,
      statusCounts,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100
    }
  });
});
