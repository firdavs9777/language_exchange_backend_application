const asyncHandler = require('../middleware/async');
const Comment = require('../models/Comment');

const Moment = require('../models/Moment')
const ErrorResponse = require('../utils/errorResponse');

//@desc Get all comments
//@route Get /api/v1/:momentId/comments
//@access Public

exports.getComments = asyncHandler(async (req, res, next) => {
    if (req.params.momentId) {
        const comments = await Comment.find({ moment: req.params.momentId });
       
        return res.status(200).json({
            success: true,
            count: comments.length,
            data: comments
        });
    }
    else {
        const comments = await Comment.find()
        console.log(comments)
        res.status(200).json({
            success: true,
            data: comments,
            count: comments.length
        });
    }
});

//@desc Get single comment
//@route Get /api/v1/:momentId/comments
//@access Public

exports.getComment = asyncHandler(async (req, res, next) => {
    const comment = await Comment.findById(req.params.id).populate({
        path: 'moment',
        select: 'title description location'
    });
    if (!comment) {
        return next(
            new ErrorResponse(`Comment not found with id of ${req.params.id}`, 404)
        );
    }
    res.status(200).json({ success: true, data: comment });
});
//@desc POST Add comment
//@route POST /api/v1/moments/:momentId/comments
//@access Private

exports.createComment = asyncHandler(async (req, res, next) => {
    req.body.moment = req.params.momentId;
    req.body.user = req.user.id;
    console.log('Show user id', req.user.id)
    console.log('Show me moment Id', req.params.momentId)

    const moment = await Moment.findById(req.params.momentId);
    console.log('Moment', moment)
    if (!moment) {
        return next(new ErrorResponse(`No moment with the id of ${req.params.momentId}`))
    }


    const comment = await Comment.create(req.body);
    console.log('Comment:', comment)
    res.status(200).json({
        success: true,
        data: comment
    });
});


//@desc PUT UPDATE comment
//@route PUT /api/v1/moments/:momentId/comments/:id
//@access Private
// exports.updateComment = asyncHandler(async (req, res, next) => {
//     const comment = await Comment.create(req.body);
//     res.status(200).json({
//       success: true,
//       data: comment
//     });
//   });
//@desc DELETE Delete comment
//@route DELETE /api/v1/moments/:momentId/comments/:id
//@access Public

// exports.deleteComment = asyncHandler(async (req, res, next) => {
//     const comment = await Comment.remove(req.body);
//     res.status(200).json({
//       success: true,
//       data: comment
//     });
//   });