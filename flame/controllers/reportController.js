const Report = require('../models/Report');
const { ValidationError } = require('../utils/errors');

async function createReport(req, res) {
  const reportedUser = req.body.user_id;
  if (reportedUser === req.user.id) {
    throw new ValidationError('cannot report yourself');
  }

  await Report.create({
    reportedBy: req.user.id,
    reportedUser,
    reason: req.body.reason,
    description: req.body.details || null,
  });

  res.status(201).json({ success: true, data: { reported: true } });
}

module.exports = { createReport };
