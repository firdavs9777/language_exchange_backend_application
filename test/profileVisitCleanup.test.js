const mongoose = require('mongoose');
const User = require('../models/User');
const ProfileVisit = require('../models/ProfileVisit');
require('dotenv').config({ path: './config/config.env' });

describe('ProfileVisit Cleanup on User Deletion', () => {

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI, {
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await ProfileVisit.deleteMany({});
    await User.deleteMany({ email: { $regex: '^test-' } });
  });

  test('should delete ProfileVisit records where deleted user is profileOwner', async () => {
    // Create test users
    const visitor = await User.create({
      name: 'Visitor User',
      email: 'test-visitor@example.com',
      password: 'password123',
    });

    const profileOwner = await User.create({
      name: 'Profile Owner',
      email: 'test-owner@example.com',
      password: 'password123',
    });

    // Create a profile visit record
    const visit = await ProfileVisit.create({
      profileOwner: profileOwner._id,
      visitor: visitor._id,
      source: 'direct',
      deviceType: 'ios',
    });

    // Verify visit was created
    let visitCount = await ProfileVisit.countDocuments({ profileOwner: profileOwner._id });
    expect(visitCount).toBe(1);

    // Delete the profile owner - this should cascade delete the visit
    await User.findByIdAndDelete(profileOwner._id);

    // Verify visit was deleted
    visitCount = await ProfileVisit.countDocuments({ profileOwner: profileOwner._id });
    expect(visitCount).toBe(0);
  });

  test('should delete ProfileVisit records where deleted user is visitor', async () => {
    // Create test users
    const visitor = await User.create({
      name: 'Visitor User',
      email: 'test-visitor2@example.com',
      password: 'password123',
    });

    const profileOwner = await User.create({
      name: 'Profile Owner',
      email: 'test-owner2@example.com',
      password: 'password123',
    });

    // Create a profile visit record
    const visit = await ProfileVisit.create({
      profileOwner: profileOwner._id,
      visitor: visitor._id,
      source: 'direct',
      deviceType: 'ios',
    });

    // Verify visit was created
    let visitCount = await ProfileVisit.countDocuments({ visitor: visitor._id });
    expect(visitCount).toBe(1);

    // Delete the visitor - this should cascade delete the visit
    await User.findByIdAndDelete(visitor._id);

    // Verify visit was deleted
    visitCount = await ProfileVisit.countDocuments({ visitor: visitor._id });
    expect(visitCount).toBe(0);
  });

  test('should not delete visits when only one party is deleted', async () => {
    // Create 3 users
    const visitor1 = await User.create({
      name: 'Visitor 1',
      email: 'test-visitor3@example.com',
      password: 'password123',
    });

    const visitor2 = await User.create({
      name: 'Visitor 2',
      email: 'test-visitor4@example.com',
      password: 'password123',
    });

    const profileOwner = await User.create({
      name: 'Profile Owner',
      email: 'test-owner3@example.com',
      password: 'password123',
    });

    // Create two visits to same profile
    await ProfileVisit.create({
      profileOwner: profileOwner._id,
      visitor: visitor1._id,
      source: 'direct',
    });

    await ProfileVisit.create({
      profileOwner: profileOwner._id,
      visitor: visitor2._id,
      source: 'direct',
    });

    // Delete visitor1
    await User.findByIdAndDelete(visitor1._id);

    // visitor2's visit should remain
    const remainingVisits = await ProfileVisit.countDocuments({ profileOwner: profileOwner._id });
    expect(remainingVisits).toBe(1);
    const remaining = await ProfileVisit.findOne({ profileOwner: profileOwner._id });
    expect(remaining.visitor.toString()).toBe(visitor2._id.toString());
  });
});
