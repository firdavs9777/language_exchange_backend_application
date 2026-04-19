const FitBowlOrder = require('../../models/fitbowl/Order');
const FitBowlCart = require('../../models/fitbowl/Cart');
const ErrorResponse = require('../../utils/errorResponse');

/**
 * Generate a unique order number in format FB-YYYYMMDD-NNN
 * @returns {Promise<string>} The generated order number
 */
exports.generateOrderNumber = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Get start and end of today
  const startOfDay = new Date(year, now.getMonth(), now.getDate());
  const endOfDay = new Date(year, now.getMonth(), now.getDate() + 1);

  // Count today's orders
  const todayOrderCount = await FitBowlOrder.countDocuments({
    createdAt: {
      $gte: startOfDay,
      $lt: endOfDay
    }
  });

  const orderNumber = String(todayOrderCount + 1).padStart(3, '0');

  return `FB-${dateStr}-${orderNumber}`;
};

/**
 * Process an order from the user's cart
 * @param {Object} cart - The user's cart document
 * @param {Object} user - The authenticated user
 * @param {Object} deliveryAddress - The delivery address object
 * @param {string} paymentMethod - The payment method (cash, card, click, payme)
 * @returns {Promise<Object>} The created order
 */
exports.processOrder = async (cart, user, deliveryAddress, paymentMethod) => {
  // Validate cart is not empty
  if (!cart || !cart.items || cart.items.length === 0) {
    throw new ErrorResponse('Cart is empty. Add items before placing an order', 400);
  }

  // Calculate subtotal from cart items
  let subtotal = 0;
  const orderItems = cart.items.map(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;

    return {
      menuItem: item.menuItem,
      name: item.name,
      quantity: item.quantity,
      size: item.size || 'medium',
      price: item.price,
      customizations: item.customizations || [],
      total: itemTotal
    };
  });

  // Apply promo discount if exists
  let discount = 0;
  if (cart.promoCode && cart.discount) {
    discount = cart.discount;
  }

  // Calculate delivery fee
  const deliveryFee = subtotal >= 100000 ? 0 : 15000;

  // Calculate total
  const total = subtotal - discount + deliveryFee;

  // Generate order number
  const orderNumber = await exports.generateOrderNumber();

  // Create order
  const order = await FitBowlOrder.create({
    orderNumber,
    user: user._id,
    items: orderItems,
    subtotal,
    discount,
    deliveryFee,
    total,
    deliveryAddress,
    paymentMethod,
    status: 'pending',
    promoCode: cart.promoCode || null
  });

  // Clear the cart after successful order creation
  cart.items = [];
  cart.promoCode = undefined;
  cart.discount = 0;
  await cart.save();

  return order;
};
