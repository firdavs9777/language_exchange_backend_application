const asyncHandler = require('../../middleware/async');
const Order = require('../../models/fitbowl/Order');
const Cart = require('../../models/fitbowl/Cart');
const MenuItem = require('../../models/fitbowl/MenuItem');
const ErrorResponse = require('../../utils/errorResponse');
const { emitNewKitchenOrder, emitOrderUpdate, emitOrderCancelled } = require('../../socket/fitbowlHandler');

// @desc    Place a new order
// @route   POST /api/v1/fitbowl/orders
// @access  Private
exports.placeOrder = asyncHandler(async (req, res, next) => {
  const { deliveryAddress, paymentMethod, notes } = req.body;

  // Get user's cart (populated)
  const cart = await Cart.findOne({ user: req.user.id }).populate(
    'items.menuItem',
    'name images basePrice sizes nutrition'
  );

  if (!cart || cart.items.length === 0) {
    return next(new ErrorResponse('Your cart is empty', 400));
  }

  // Calculate subtotal from cart items
  let subtotal = 0;
  const orderItems = cart.items.map((item) => {
    const itemTotal = item.itemPrice * item.quantity;
    subtotal += itemTotal;

    return {
      menuItem: item.menuItem._id,
      name: item.menuItem.name,
      unitPrice: item.itemPrice,
      quantity: item.quantity,
      size: item.size,
      customizations: item.customizations,
      totalPrice: itemTotal
    };
  });

  // Calculate delivery fee
  const deliveryFee = req.body.deliveryFee || 0;

  // Apply discount from cart
  const discount = cart.discount || 0;

  // Calculate total
  const totalAmount = subtotal + deliveryFee - discount;

  // Generate order number
  const orderNumber = `FB-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  // Create order
  const order = await Order.create({
    user: req.user.id,
    orderNumber,
    items: orderItems,
    subtotal,
    deliveryFee,
    discount,
    totalAmount,
    deliveryAddress,
    paymentMethod: paymentMethod || 'cash',
    notes,
    status: 'pending',
    statusHistory: [
      {
        status: 'pending',
        timestamp: new Date(),
        note: 'Order placed'
      }
    ]
  });

  // Clear the cart
  cart.items = [];
  cart.discount = 0;
  cart.promoCode = null;
  await cart.save();

  // Emit socket event for kitchen (via /fitbowl namespace)
  const io = req.app.get('io');
  if (io) {
    emitNewKitchenOrder(io, order);
    emitOrderUpdate(io, req.user.id, order);
  }

  res.status(201).json({
    success: true,
    data: order
  });
});

// @desc    Get user's orders (paginated)
// @route   GET /api/v1/fitbowl/orders
// @access  Private
exports.getOrders = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const query = { user: req.user.id };

  const [total, orders] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query)
      .populate('items.menuItem', 'name images basePrice')
      .sort('-createdAt')
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

// @desc    Get user's active orders
// @route   GET /api/v1/fitbowl/orders/active
// @access  Private
exports.getActiveOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({
    user: req.user.id,
    status: { $nin: ['delivered', 'cancelled'] }
  })
    .populate('items.menuItem', 'name images basePrice')
    .sort('-createdAt')
    .lean();

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Get single order
// @route   GET /api/v1/fitbowl/orders/:id
// @access  Private
exports.getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('items.menuItem', 'name images basePrice')
    .populate('user', 'name email phone');

  if (!order) {
    return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
  }

  // Verify the order belongs to the user or user is admin
  if (
    order.user._id.toString() !== req.user.id &&
    req.user.role !== 'admin' &&
    req.user.role !== 'kitchen_admin'
  ) {
    return next(new ErrorResponse('Not authorized to access this order', 403));
  }

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Cancel order
// @route   PUT /api/v1/fitbowl/orders/:id/cancel
// @access  Private
exports.cancelOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
  }

  // Verify belongs to user
  if (order.user.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to cancel this order', 403));
  }

  // Verify status allows cancellation
  if (!['pending', 'confirmed'].includes(order.status)) {
    return next(
      new ErrorResponse(
        `Order cannot be cancelled when status is ${order.status}`,
        400
      )
    );
  }

  order.status = 'cancelled';
  order.cancelReason = req.body.reason || 'Cancelled by user';
  order.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    note: order.cancelReason
  });

  await order.save();

  // Emit socket event via /fitbowl namespace
  const io = req.app.get('io');
  if (io) {
    emitOrderCancelled(io, order);
    emitOrderUpdate(io, order.user.toString(), order);
  }

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Reorder from a previous order
// @route   POST /api/v1/fitbowl/orders/:id/reorder
// @access  Private
exports.reorder = asyncHandler(async (req, res, next) => {
  const oldOrder = await Order.findById(req.params.id);

  if (!oldOrder) {
    return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
  }

  if (oldOrder.user.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to reorder this order', 403));
  }

  // Find or create cart
  let cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    cart = await Cart.create({ user: req.user.id, items: [] });
  }

  // Create new cart items from old order items
  for (const item of oldOrder.items) {
    // Verify menu item still exists and is available
    const menuItem = await MenuItem.findById(item.menuItem);

    if (menuItem && menuItem.isAvailable) {
      cart.items.push({
        menuItem: item.menuItem,
        quantity: item.quantity,
        size: item.size,
        customizations: item.customizations,
        itemPrice: item.unitPrice
      });
    }
  }

  await cart.save();

  cart = await Cart.findById(cart._id).populate(
    'items.menuItem',
    'name images basePrice sizes nutrition'
  );

  res.status(200).json({
    success: true,
    data: cart
  });
});

// @desc    Rate an order
// @route   POST /api/v1/fitbowl/orders/:id/rate
// @access  Private
exports.rateOrder = asyncHandler(async (req, res, next) => {
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return next(new ErrorResponse('Please provide a rating between 1 and 5', 400));
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
  }

  // Verify belongs to user
  if (order.user.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to rate this order', 403));
  }

  // Verify order is delivered
  if (order.status !== 'delivered') {
    return next(new ErrorResponse('Can only rate delivered orders', 400));
  }

  // Verify not already rated
  if (order.rating) {
    return next(new ErrorResponse('Order has already been rated', 400));
  }

  order.rating = {
    value: rating,
    comment: comment || '',
    createdAt: new Date()
  };

  await order.save();

  // Update average rating for each menu item in the order
  for (const item of order.items) {
    const orders = await Order.find({
      'items.menuItem': item.menuItem,
      'rating.value': { $exists: true }
    });

    if (orders.length > 0) {
      const totalRating = orders.reduce((sum, o) => sum + o.rating.value, 0);
      const avgRating = totalRating / orders.length;

      await MenuItem.findByIdAndUpdate(item.menuItem, {
        averageRating: Math.round(avgRating * 10) / 10
      });
    }
  }

  res.status(200).json({
    success: true,
    data: order
  });
});
