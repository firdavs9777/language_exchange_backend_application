/**
 * FitBowl Seed Script
 * Creates a demo admin account + sample categories + sample menu items
 *
 * Usage: node migrations/seedFitBowlData.js
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

const FitBowlUser = require('../models/fitbowl/FitBowlUser');
const Category = require('../models/fitbowl/Category');
const MenuItem = require('../models/fitbowl/MenuItem');
const PromoCode = require('../models/fitbowl/PromoCode');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // ──────────────────────────────────────────────
    // 1. ADMIN ACCOUNT
    // ──────────────────────────────────────────────
    const existingAdmin = await FitBowlUser.findOne({ email: 'admin@fitbowl.uz' });
    let admin;
    if (existingAdmin) {
      console.log('Admin account already exists, skipping...');
      admin = existingAdmin;
    } else {
      admin = await FitBowlUser.create({
        name: 'FitBowl Admin',
        email: 'admin@fitbowl.uz',
        password: 'admin123456',
        phone: '+998901234567',
        role: 'kitchen_admin',
        dietaryPreferences: ['high-protein'],
        allergies: [],
        calorieTarget: 2200,
        proteinTarget: 180,
        carbTarget: 220,
        fatTarget: 70
      });
      console.log('✅ Admin account created');
      console.log('   Email:    admin@fitbowl.uz');
      console.log('   Password: admin123456');
      console.log('   Role:     kitchen_admin');
    }

    // Also create a regular test user
    const existingUser = await FitBowlUser.findOne({ email: 'user@fitbowl.uz' });
    if (!existingUser) {
      await FitBowlUser.create({
        name: 'Test User',
        email: 'user@fitbowl.uz',
        password: 'user123456',
        phone: '+998909876543',
        role: 'user',
        dietaryPreferences: ['high-protein', 'low-carb'],
        allergies: ['nuts'],
        calorieTarget: 2000,
        proteinTarget: 150,
        carbTarget: 150,
        fatTarget: 65
      });
      console.log('✅ Test user account created');
      console.log('   Email:    user@fitbowl.uz');
      console.log('   Password: user123456');
    }

    // ──────────────────────────────────────────────
    // 2. CATEGORIES
    // ──────────────────────────────────────────────
    const existingCategories = await Category.countDocuments();
    if (existingCategories > 0) {
      console.log(`Categories already exist (${existingCategories}), skipping...`);
    } else {
      const categoryData = [
        { name: 'Bowls', description: 'Healthy grain and protein bowls', displayOrder: 1, isActive: true },
        { name: 'Salads', description: 'Fresh garden salads', displayOrder: 2, isActive: true },
        { name: 'Smoothies', description: 'Fresh fruit and protein smoothies', displayOrder: 3, isActive: true },
        { name: 'Wraps', description: 'Protein-packed wraps', displayOrder: 4, isActive: true },
        { name: 'Soups', description: 'Warm and nutritious soups', displayOrder: 5, isActive: true },
        { name: 'Snacks', description: 'Healthy bites and sides', displayOrder: 6, isActive: true },
        { name: 'Desserts', description: 'Guilt-free sweet treats', displayOrder: 7, isActive: true },
        { name: 'Drinks', description: 'Fresh juices and teas', displayOrder: 8, isActive: true },
      ];
      const categories = [];
      for (const cat of categoryData) {
        categories.push(await Category.create(cat));
      }
      console.log(`✅ ${categories.length} categories created`);

      // ──────────────────────────────────────────────
      // 3. MENU ITEMS
      // ──────────────────────────────────────────────
      const catMap = {};
      categories.forEach(c => { catMap[c.name] = c._id; });

      const menuItems = await MenuItem.insertMany([
        // === BOWLS ===
        {
          name: 'Chicken Teriyaki Bowl',
          description: 'Grilled chicken with teriyaki sauce, brown rice, edamame, avocado, and sesame seeds',
          category: catMap['Bowls'],
          basePrice: 45000,
          sizes: [
            { name: 'small', priceModifier: -8000 },
            { name: 'medium', priceModifier: 0 },
            { name: 'large', priceModifier: 12000 }
          ],
          nutrition: { calories: 520, protein: 42, carbs: 55, fat: 14, fiber: 6 },
          dietaryTags: ['high-protein'],
          allergens: ['soy'],
          ingredients: [
            { name: 'Brown Rice', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Grilled Chicken', isCustomizable: false, isDefault: true, extraPrice: 0 },
            { name: 'Edamame', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Avocado', isCustomizable: true, isDefault: true, extraPrice: 5000 },
            { name: 'Sesame Seeds', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Extra Chicken', isCustomizable: true, isDefault: false, extraPrice: 12000 }
          ],
          isAvailable: true,
          isFeatured: true,
          preparationTime: 15,
          averageRating: 4.7,
          totalReviews: 23,
          totalOrders: 156
        },
        {
          name: 'Salmon Poke Bowl',
          description: 'Fresh salmon, sushi rice, cucumber, mango, seaweed, and spicy mayo',
          category: catMap['Bowls'],
          basePrice: 55000,
          sizes: [
            { name: 'small', priceModifier: -10000 },
            { name: 'medium', priceModifier: 0 },
            { name: 'large', priceModifier: 15000 }
          ],
          nutrition: { calories: 480, protein: 38, carbs: 48, fat: 16, fiber: 4 },
          dietaryTags: ['high-protein'],
          allergens: ['fish', 'soy'],
          ingredients: [
            { name: 'Sushi Rice', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Fresh Salmon', isCustomizable: false, isDefault: true, extraPrice: 0 },
            { name: 'Cucumber', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Mango', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Seaweed', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Extra Salmon', isCustomizable: true, isDefault: false, extraPrice: 18000 }
          ],
          isAvailable: true,
          isFeatured: true,
          preparationTime: 12,
          averageRating: 4.8,
          totalReviews: 31,
          totalOrders: 198
        },
        {
          name: 'Vegan Buddha Bowl',
          description: 'Quinoa, roasted sweet potato, chickpeas, kale, tahini dressing',
          category: catMap['Bowls'],
          basePrice: 42000,
          sizes: [
            { name: 'small', priceModifier: -7000 },
            { name: 'medium', priceModifier: 0 },
            { name: 'large', priceModifier: 10000 }
          ],
          nutrition: { calories: 420, protein: 18, carbs: 62, fat: 12, fiber: 11 },
          dietaryTags: ['vegan', 'gluten-free'],
          allergens: [],
          ingredients: [
            { name: 'Quinoa', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Sweet Potato', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Chickpeas', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Kale', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Tahini', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Avocado', isCustomizable: true, isDefault: false, extraPrice: 5000 }
          ],
          isAvailable: true,
          isFeatured: false,
          preparationTime: 15,
          averageRating: 4.5,
          totalReviews: 14,
          totalOrders: 89
        },
        {
          name: 'Keto Power Bowl',
          description: 'Grilled steak, cauliflower rice, avocado, cheese, sour cream',
          category: catMap['Bowls'],
          basePrice: 52000,
          sizes: [
            { name: 'small', priceModifier: -9000 },
            { name: 'medium', priceModifier: 0 },
            { name: 'large', priceModifier: 14000 }
          ],
          nutrition: { calories: 560, protein: 45, carbs: 12, fat: 38, fiber: 5 },
          dietaryTags: ['keto', 'low-carb', 'high-protein', 'gluten-free'],
          allergens: ['dairy'],
          ingredients: [
            { name: 'Cauliflower Rice', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Grilled Steak', isCustomizable: false, isDefault: true, extraPrice: 0 },
            { name: 'Avocado', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Cheddar Cheese', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Sour Cream', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Extra Steak', isCustomizable: true, isDefault: false, extraPrice: 15000 }
          ],
          isAvailable: true,
          isFeatured: true,
          preparationTime: 18,
          averageRating: 4.6,
          totalReviews: 19,
          totalOrders: 112
        },

        // === SALADS ===
        {
          name: 'Caesar Salad',
          description: 'Romaine lettuce, grilled chicken, parmesan, croutons, caesar dressing',
          category: catMap['Salads'],
          basePrice: 38000,
          sizes: [
            { name: 'small', priceModifier: -6000 },
            { name: 'medium', priceModifier: 0 },
            { name: 'large', priceModifier: 8000 }
          ],
          nutrition: { calories: 380, protein: 32, carbs: 18, fat: 22, fiber: 4 },
          dietaryTags: ['high-protein'],
          allergens: ['dairy', 'gluten'],
          ingredients: [
            { name: 'Romaine Lettuce', isCustomizable: false, isDefault: true, extraPrice: 0 },
            { name: 'Grilled Chicken', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Parmesan', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Croutons', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Extra Chicken', isCustomizable: true, isDefault: false, extraPrice: 12000 }
          ],
          isAvailable: true,
          isFeatured: false,
          preparationTime: 10,
          averageRating: 4.4,
          totalReviews: 17,
          totalOrders: 95
        },
        {
          name: 'Greek Salad',
          description: 'Tomatoes, cucumbers, olives, feta cheese, red onion, olive oil dressing',
          category: catMap['Salads'],
          basePrice: 35000,
          sizes: [
            { name: 'small', priceModifier: -5000 },
            { name: 'medium', priceModifier: 0 },
            { name: 'large', priceModifier: 7000 }
          ],
          nutrition: { calories: 280, protein: 12, carbs: 16, fat: 20, fiber: 5 },
          dietaryTags: ['vegetarian', 'gluten-free', 'low-carb'],
          allergens: ['dairy'],
          ingredients: [
            { name: 'Tomatoes', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Cucumbers', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Olives', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Feta Cheese', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Red Onion', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Grilled Chicken', isCustomizable: true, isDefault: false, extraPrice: 12000 }
          ],
          isAvailable: true,
          isFeatured: false,
          preparationTime: 8,
          averageRating: 4.3,
          totalReviews: 11,
          totalOrders: 67
        },

        // === SMOOTHIES ===
        {
          name: 'Green Protein Smoothie',
          description: 'Spinach, banana, protein powder, almond milk, chia seeds',
          category: catMap['Smoothies'],
          basePrice: 28000,
          sizes: [
            { name: 'small', priceModifier: -5000 },
            { name: 'medium', priceModifier: 0 },
            { name: 'large', priceModifier: 7000 }
          ],
          nutrition: { calories: 280, protein: 25, carbs: 32, fat: 8, fiber: 6 },
          dietaryTags: ['vegan', 'high-protein', 'gluten-free'],
          allergens: ['nuts'],
          ingredients: [
            { name: 'Spinach', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Banana', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Protein Powder', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Almond Milk', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Chia Seeds', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Peanut Butter', isCustomizable: true, isDefault: false, extraPrice: 4000 }
          ],
          isAvailable: true,
          isFeatured: true,
          preparationTime: 5,
          averageRating: 4.6,
          totalReviews: 28,
          totalOrders: 210
        },
        {
          name: 'Berry Blast Smoothie',
          description: 'Mixed berries, Greek yogurt, honey, oats',
          category: catMap['Smoothies'],
          basePrice: 25000,
          sizes: [
            { name: 'small', priceModifier: -4000 },
            { name: 'medium', priceModifier: 0 },
            { name: 'large', priceModifier: 6000 }
          ],
          nutrition: { calories: 220, protein: 15, carbs: 38, fat: 4, fiber: 5 },
          dietaryTags: ['vegetarian', 'high-protein'],
          allergens: ['dairy', 'gluten'],
          ingredients: [
            { name: 'Mixed Berries', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Greek Yogurt', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Honey', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Oats', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Protein Powder', isCustomizable: true, isDefault: false, extraPrice: 5000 }
          ],
          isAvailable: true,
          isFeatured: false,
          preparationTime: 5,
          averageRating: 4.5,
          totalReviews: 15,
          totalOrders: 130
        },

        // === WRAPS ===
        {
          name: 'Chicken Avocado Wrap',
          description: 'Whole wheat wrap with grilled chicken, avocado, lettuce, tomato, ranch',
          category: catMap['Wraps'],
          basePrice: 40000,
          sizes: [
            { name: 'small', priceModifier: -7000 },
            { name: 'medium', priceModifier: 0 },
            { name: 'large', priceModifier: 10000 }
          ],
          nutrition: { calories: 450, protein: 35, carbs: 38, fat: 18, fiber: 7 },
          dietaryTags: ['high-protein'],
          allergens: ['gluten', 'dairy'],
          ingredients: [
            { name: 'Whole Wheat Wrap', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Grilled Chicken', isCustomizable: false, isDefault: true, extraPrice: 0 },
            { name: 'Avocado', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Lettuce', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Ranch Dressing', isCustomizable: true, isDefault: true, extraPrice: 0 }
          ],
          isAvailable: true,
          isFeatured: false,
          preparationTime: 10,
          averageRating: 4.4,
          totalReviews: 9,
          totalOrders: 75
        },

        // === SOUPS ===
        {
          name: 'Tom Yum Soup',
          description: 'Spicy Thai soup with shrimp, mushrooms, lemongrass, lime',
          category: catMap['Soups'],
          basePrice: 32000,
          sizes: [
            { name: 'small', priceModifier: -5000 },
            { name: 'medium', priceModifier: 0 },
            { name: 'large', priceModifier: 8000 }
          ],
          nutrition: { calories: 180, protein: 22, carbs: 12, fat: 6, fiber: 2 },
          dietaryTags: ['low-carb', 'high-protein', 'gluten-free'],
          allergens: ['shellfish'],
          ingredients: [
            { name: 'Shrimp', isCustomizable: false, isDefault: true, extraPrice: 0 },
            { name: 'Mushrooms', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Lemongrass', isCustomizable: false, isDefault: true, extraPrice: 0 },
            { name: 'Extra Shrimp', isCustomizable: true, isDefault: false, extraPrice: 10000 }
          ],
          isAvailable: true,
          isFeatured: false,
          preparationTime: 15,
          averageRating: 4.7,
          totalReviews: 12,
          totalOrders: 58
        },

        // === SNACKS ===
        {
          name: 'Protein Energy Balls',
          description: 'Oats, peanut butter, dark chocolate chips, honey (6 pieces)',
          category: catMap['Snacks'],
          basePrice: 18000,
          sizes: [],
          nutrition: { calories: 240, protein: 12, carbs: 28, fat: 10, fiber: 3 },
          dietaryTags: ['vegetarian', 'high-protein'],
          allergens: ['nuts', 'gluten'],
          ingredients: [
            { name: 'Oats', isCustomizable: false, isDefault: true, extraPrice: 0 },
            { name: 'Peanut Butter', isCustomizable: false, isDefault: true, extraPrice: 0 },
            { name: 'Dark Chocolate', isCustomizable: true, isDefault: true, extraPrice: 0 }
          ],
          isAvailable: true,
          isFeatured: false,
          preparationTime: 5,
          averageRating: 4.3,
          totalReviews: 8,
          totalOrders: 45
        },

        // === DESSERTS ===
        {
          name: 'Acai Bowl',
          description: 'Acai blend topped with granola, banana, berries, coconut flakes, honey',
          category: catMap['Desserts'],
          basePrice: 38000,
          sizes: [
            { name: 'small', priceModifier: -6000 },
            { name: 'medium', priceModifier: 0 },
            { name: 'large', priceModifier: 8000 }
          ],
          nutrition: { calories: 350, protein: 8, carbs: 58, fat: 12, fiber: 8 },
          dietaryTags: ['vegan', 'gluten-free'],
          allergens: ['nuts'],
          ingredients: [
            { name: 'Acai Blend', isCustomizable: false, isDefault: true, extraPrice: 0 },
            { name: 'Granola', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Banana', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Mixed Berries', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Coconut Flakes', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Protein Powder', isCustomizable: true, isDefault: false, extraPrice: 5000 }
          ],
          isAvailable: true,
          isFeatured: true,
          preparationTime: 8,
          averageRating: 4.9,
          totalReviews: 35,
          totalOrders: 245
        },

        // === DRINKS ===
        {
          name: 'Fresh Orange Juice',
          description: 'Freshly squeezed orange juice, no sugar added',
          category: catMap['Drinks'],
          basePrice: 15000,
          sizes: [
            { name: 'small', priceModifier: -3000 },
            { name: 'medium', priceModifier: 0 },
            { name: 'large', priceModifier: 5000 }
          ],
          nutrition: { calories: 110, protein: 2, carbs: 26, fat: 0, fiber: 0 },
          dietaryTags: ['vegan', 'gluten-free', 'paleo'],
          allergens: [],
          ingredients: [
            { name: 'Fresh Oranges', isCustomizable: false, isDefault: true, extraPrice: 0 },
            { name: 'Ginger Shot', isCustomizable: true, isDefault: false, extraPrice: 3000 }
          ],
          isAvailable: true,
          isFeatured: false,
          preparationTime: 5,
          averageRating: 4.4,
          totalReviews: 20,
          totalOrders: 180
        },
        {
          name: 'Matcha Latte',
          description: 'Ceremonial grade matcha with oat milk',
          category: catMap['Drinks'],
          basePrice: 22000,
          sizes: [
            { name: 'small', priceModifier: -4000 },
            { name: 'medium', priceModifier: 0 },
            { name: 'large', priceModifier: 5000 }
          ],
          nutrition: { calories: 150, protein: 4, carbs: 22, fat: 5, fiber: 1 },
          dietaryTags: ['vegan', 'vegetarian'],
          allergens: [],
          ingredients: [
            { name: 'Matcha Powder', isCustomizable: false, isDefault: true, extraPrice: 0 },
            { name: 'Oat Milk', isCustomizable: true, isDefault: true, extraPrice: 0 },
            { name: 'Honey', isCustomizable: true, isDefault: false, extraPrice: 2000 }
          ],
          isAvailable: true,
          isFeatured: false,
          preparationTime: 5,
          averageRating: 4.6,
          totalReviews: 16,
          totalOrders: 120
        },
      ]);
      console.log(`✅ ${menuItems.length} menu items created`);
    }

    // ──────────────────────────────────────────────
    // 4. PROMO CODES
    // ──────────────────────────────────────────────
    const existingPromos = await PromoCode.countDocuments();
    if (existingPromos > 0) {
      console.log(`Promo codes already exist (${existingPromos}), skipping...`);
    } else {
      const promos = await PromoCode.insertMany([
        {
          code: 'WELCOME20',
          description: '20% off your first order',
          discountType: 'percentage',
          discountValue: 20,
          minOrderAmount: 30000,
          maxDiscount: 25000,
          usageLimit: 1000,
          usedCount: 0,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          isActive: true
        },
        {
          code: 'FITBOWL10',
          description: '10,000 sum off orders above 50,000',
          discountType: 'fixed',
          discountValue: 10000,
          minOrderAmount: 50000,
          usageLimit: 500,
          usedCount: 0,
          startDate: new Date(),
          endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          isActive: true
        },
        {
          code: 'FREESHIP',
          description: 'Free delivery on any order',
          discountType: 'fixed',
          discountValue: 15000,
          minOrderAmount: 0,
          usageLimit: 200,
          usedCount: 0,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isActive: true
        }
      ]);
      console.log(`✅ ${promos.length} promo codes created`);
    }

    // ──────────────────────────────────────────────
    // SUMMARY
    // ──────────────────────────────────────────────
    const stats = {
      users: await FitBowlUser.countDocuments(),
      categories: await Category.countDocuments(),
      menuItems: await MenuItem.countDocuments(),
      promoCodes: await PromoCode.countDocuments()
    };

    console.log('\n════════════════════════════════════');
    console.log('  FitBowl Seed Complete!');
    console.log('════════════════════════════════════');
    console.log(`  Users:       ${stats.users}`);
    console.log(`  Categories:  ${stats.categories}`);
    console.log(`  Menu Items:  ${stats.menuItems}`);
    console.log(`  Promo Codes: ${stats.promoCodes}`);
    console.log('════════════════════════════════════');
    console.log('\n  Admin login:');
    console.log('  Email:    admin@fitbowl.uz');
    console.log('  Password: admin123456');
    console.log('\n  User login:');
    console.log('  Email:    user@fitbowl.uz');
    console.log('  Password: user123456');
    console.log('════════════════════════════════════\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seed();
