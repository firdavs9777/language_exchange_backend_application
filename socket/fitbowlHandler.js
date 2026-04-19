const jwt = require('jsonwebtoken');
const FitBowlUser = require('../models/fitbowl/FitBowlUser');

const initializeFitBowlSocket = (io) => {
  const fitbowlNamespace = io.of('/fitbowl');

  // Authentication middleware
  fitbowlNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await FitBowlUser.findById(decoded.id);
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  fitbowlNamespace.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    console.log(`FitBowl: User ${userId} connected`);

    // Join personal room
    socket.join(`fitbowl_user_${userId}`);

    // Kitchen admins join kitchen room
    if (socket.user.role === 'kitchen_admin') {
      socket.join('fitbowl_kitchen');
    }

    // Driver joins driver room
    if (socket.user.role === 'delivery_driver') {
      socket.join('fitbowl_drivers');
    }

    socket.on('disconnect', () => {
      console.log(`FitBowl: User ${userId} disconnected`);
    });
  });

  return fitbowlNamespace;
};

// Helper to emit order updates
const emitOrderUpdate = (io, userId, order) => {
  io.of('/fitbowl').to(`fitbowl_user_${userId}`).emit('order:status_update', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status
  });
};

const emitNewKitchenOrder = (io, order) => {
  io.of('/fitbowl').to('fitbowl_kitchen').emit('kitchen:new_order', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    items: order.items,
    total: order.total,
    createdAt: order.createdAt
  });
};

const emitOrderCancelled = (io, order) => {
  io.of('/fitbowl').to('fitbowl_kitchen').emit('kitchen:order_cancelled', {
    orderId: order._id,
    orderNumber: order.orderNumber
  });
};

module.exports = { initializeFitBowlSocket, emitOrderUpdate, emitNewKitchenOrder, emitOrderCancelled };
