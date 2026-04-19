const mongoose = require('mongoose');

const FitBowlOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FitBowlUser',
    required: true
  },
  items: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FitBowlMenuItem'
    },
    name: {
      type: String
    },
    quantity: {
      type: Number
    },
    size: {
      type: String
    },
    customizations: {
      type: Array,
      default: []
    },
    unitPrice: {
      type: Number
    },
    totalPrice: {
      type: Number
    }
  }],

  // Pricing
  subtotal: {
    type: Number,
    default: 0
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  },

  // Delivery
  deliveryAddress: {
    label: { type: String },
    address: { type: String },
    apartment: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    instructions: { type: String }
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivering', 'delivered', 'cancelled'],
    default: 'pending'
  },
  statusHistory: [{
    status: {
      type: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String
    }
  }],
  estimatedDeliveryTime: {
    type: Date
  },

  // Payment
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'click', 'payme'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },

  cancelReason: {
    type: String
  },

  // Rating
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String
    },
    createdAt: {
      type: Date
    }
  },

  // Driver assignment
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FitBowlUser'
  }
}, {
  timestamps: true,
  collection: 'fitbowl_orders'
});

// Indexes
FitBowlOrderSchema.index({ user: 1 });
FitBowlOrderSchema.index({ status: 1 });
FitBowlOrderSchema.index({ orderNumber: 1 });
FitBowlOrderSchema.index({ createdAt: -1 });

// Auto-generate order number: FB-YYYYMMDD-NNN
FitBowlOrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Count today's orders
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const todayCount = await mongoose.model('FitBowlOrder').countDocuments({
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });

    const orderNum = String(todayCount + 1).padStart(3, '0');
    this.orderNumber = `FB-${dateStr}-${orderNum}`;
  }

  // Push initial status to history if new
  if (this.isNew && this.statusHistory.length === 0) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });
  }

  next();
});

module.exports = mongoose.model('FitBowlOrder', FitBowlOrderSchema);
