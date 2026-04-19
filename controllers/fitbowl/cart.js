const asyncHandler = require('../../middleware/async');
const Cart = require('../../models/fitbowl/Cart');
const MenuItem = require('../../models/fitbowl/MenuItem');
const PromoCode = require('../../models/fitbowl/PromoCode');
const ErrorResponse = require('../../utils/errorResponse');

// @desc    Get user's cart
// @route   GET /api/v1/fitbowl/cart
// @access  Private
exports.getCart = asyncHandler(async (req, res, next) => {
  let cart = await Cart.findOne({ user: req.user.id }).populate(
    'items.menuItem',
    'name images basePrice sizes nutrition'
  );

  if (!cart) {
    cart = await Cart.create({ user: req.user.id, items: [] });
  }

  res.status(200).json({
    success: true,
    data: cart
  });
});

// @desc    Add item to cart
// @route   POST /api/v1/fitbowl/cart/items
// @access  Private
exports.addToCart = asyncHandler(async (req, res, next) => {
  const { menuItem: menuItemId, quantity, size, customizations } = req.body;

  // Find or create cart
  let cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    cart = await Cart.create({ user: req.user.id, items: [] });
  }

  // Find and validate menu item
  const menuItem = await MenuItem.findById(menuItemId);

  if (!menuItem) {
    return next(new ErrorResponse(`Menu item not found with id of ${menuItemId}`, 404));
  }

  if (!menuItem.isAvailable) {
    return next(new ErrorResponse('This menu item is currently unavailable', 400));
  }

  // Calculate item price
  let itemPrice = menuItem.basePrice;

  // Apply size price modifier
  if (size && menuItem.sizes && menuItem.sizes.length > 0) {
    const selectedSize = menuItem.sizes.find((s) => s.name === size);
    if (selectedSize && selectedSize.priceModifier) {
      itemPrice += selectedSize.priceModifier;
    }
  }

  // Apply customization extras
  if (customizations && customizations.extras && customizations.extras.length > 0) {
    customizations.extras.forEach((extra) => {
      if (extra.price) {
        itemPrice += extra.price;
      }
    });
  }

  // Add item to cart
  cart.items.push({
    menuItem: menuItemId,
    quantity: quantity || 1,
    size: size || 'regular',
    customizations: customizations || {},
    itemPrice
  });

  await cart.save();

  // Return populated cart
  cart = await Cart.findById(cart._id).populate(
    'items.menuItem',
    'name images basePrice sizes nutrition'
  );

  res.status(200).json({
    success: true,
    data: cart
  });
});

// @desc    Update cart item
// @route   PUT /api/v1/fitbowl/cart/items/:itemId
// @access  Private
exports.updateCartItem = asyncHandler(async (req, res, next) => {
  const { quantity, size, customizations } = req.body;

  let cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    return next(new ErrorResponse('Cart not found', 404));
  }

  const itemIndex = cart.items.findIndex(
    (item) => item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    return next(new ErrorResponse('Item not found in cart', 404));
  }

  const cartItem = cart.items[itemIndex];

  // Get the menu item to recalculate price
  const menuItem = await MenuItem.findById(cartItem.menuItem);

  if (!menuItem) {
    return next(new ErrorResponse('Associated menu item no longer exists', 404));
  }

  // Update fields
  if (quantity !== undefined) {
    cartItem.quantity = quantity;
  }

  if (size !== undefined) {
    cartItem.size = size;
  }

  if (customizations !== undefined) {
    cartItem.customizations = customizations;
  }

  // Recalculate price
  let itemPrice = menuItem.basePrice;

  if (cartItem.size && menuItem.sizes && menuItem.sizes.length > 0) {
    const selectedSize = menuItem.sizes.find((s) => s.name === cartItem.size);
    if (selectedSize && selectedSize.priceModifier) {
      itemPrice += selectedSize.priceModifier;
    }
  }

  if (
    cartItem.customizations &&
    cartItem.customizations.extras &&
    cartItem.customizations.extras.length > 0
  ) {
    cartItem.customizations.extras.forEach((extra) => {
      if (extra.price) {
        itemPrice += extra.price;
      }
    });
  }

  cartItem.itemPrice = itemPrice;
  cart.items[itemIndex] = cartItem;

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

// @desc    Remove item from cart
// @route   DELETE /api/v1/fitbowl/cart/items/:itemId
// @access  Private
exports.removeCartItem = asyncHandler(async (req, res, next) => {
  let cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    return next(new ErrorResponse('Cart not found', 404));
  }

  cart.items.pull({ _id: req.params.itemId });

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

// @desc    Clear cart
// @route   DELETE /api/v1/fitbowl/cart
// @access  Private
exports.clearCart = asyncHandler(async (req, res, next) => {
  let cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    return next(new ErrorResponse('Cart not found', 404));
  }

  cart.items = [];
  cart.discount = 0;
  cart.promoCode = null;

  await cart.save();

  res.status(200).json({
    success: true,
    data: cart
  });
});

// @desc    Apply promo code to cart
// @route   POST /api/v1/fitbowl/cart/promo
// @access  Private
exports.applyPromoCode = asyncHandler(async (req, res, next) => {
  const { code } = req.body;

  if (!code) {
    return next(new ErrorResponse('Please provide a promo code', 400));
  }

  const promo = await PromoCode.findOne({ code: code.toUpperCase() });

  if (!promo) {
    return next(new ErrorResponse('Invalid promo code', 404));
  }

  // Validate promo is active
  if (!promo.isActive) {
    return next(new ErrorResponse('This promo code is no longer active', 400));
  }

  // Validate date range
  const now = new Date();
  if (promo.startDate && now < promo.startDate) {
    return next(new ErrorResponse('This promo code is not yet active', 400));
  }

  if (promo.endDate && now > promo.endDate) {
    return next(new ErrorResponse('This promo code has expired', 400));
  }

  // Validate usage limit
  if (promo.maxUses && promo.currentUses >= promo.maxUses) {
    return next(new ErrorResponse('This promo code has reached its usage limit', 400));
  }

  // Check if user already used this promo
  if (promo.usedBy && promo.usedBy.includes(req.user.id)) {
    return next(new ErrorResponse('You have already used this promo code', 400));
  }

  // Get cart
  let cart = await Cart.findOne({ user: req.user.id }).populate(
    'items.menuItem',
    'name images basePrice sizes nutrition'
  );

  if (!cart || cart.items.length === 0) {
    return next(new ErrorResponse('Your cart is empty', 400));
  }

  // Calculate subtotal
  const subtotal = cart.items.reduce((sum, item) => {
    return sum + item.itemPrice * item.quantity;
  }, 0);

  // Validate minimum order amount
  if (promo.minOrderAmount && subtotal < promo.minOrderAmount) {
    return next(
      new ErrorResponse(
        `Minimum order amount of ${promo.minOrderAmount} required for this promo code`,
        400
      )
    );
  }

  // Calculate discount
  let discount = 0;
  if (promo.discountType === 'percentage') {
    discount = (subtotal * promo.discountValue) / 100;
    if (promo.maxDiscount && discount > promo.maxDiscount) {
      discount = promo.maxDiscount;
    }
  } else {
    // Fixed amount
    discount = promo.discountValue;
  }

  // Ensure discount doesn't exceed subtotal
  discount = Math.min(discount, subtotal);

  cart.discount = discount;
  cart.promoCode = promo._id;

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
