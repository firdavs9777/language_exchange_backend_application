const path = require('path');
const asyncHandler = require('../middleware/async');
const Message = require('../models/Message');
const ErrorResponse = require('../utils/errorResponse');

//@desc Get all message
//@route Get /api/v1/messages
//@access Private

exports.getMessages = asyncHandler(async (req, res, next) => {
  const messages = await Message.find();
  res.status(200).json({
    success: true,
    data: messages
  });
});
//@desc Get Single Message
//@route GET /api/v1/messages/:id
//@access Private
exports.getMessage = asyncHandler(async (req, res, next) => {
  const message = await Message.findById(req.params.id);
  if (!message) {
    return next(
      new ErrorResponse(`Message not found with id of ${req.params.id}`, 404)
    );
  }
  res.status(200).json({ success: true, data: message });
});

//@desc POST create Message
//@route POST /api/v1/messages
//@access Private

exports.createMessage = asyncHandler(async (req, res, next) => {
  const message = await Message.create(req.body);
  res.status(200).json({
    success: true,
    data: message
  });
  res.status(200).json({ success: true, data: message });
});

//@desc Update Moment
//@route PUT /api/v1/messages/:id
//@access Private

exports.updateMessage = asyncHandler(async (req, res, next) => {
  let message = await Message.findById(req.params.id);
  if (!message) {
    return next(
      new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404)
    );
  }
  message = await Message.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  res.status(200).json({ success: true, data: message });
});

//@desc Delete Message
//@route DELETE /api/v1/messages/:id
//@access Private

exports.deleteMessage = asyncHandler(async (req, res, next) => {
  const message = await Message.findByIdAndDelete(req.params.id);
  if (!message) {
    return next(
      new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404)
    );
  }
  message.remove();
  res.status(200).json({ success: true, data: {}, message: 'Message Deleted' });
});
