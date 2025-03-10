const asyncHandler = require('../middleware/async');
const Comment = require('../models/Comment');

const Moment = require('../models/Moment')
const ErrorResponse = require('../utils/errorResponse');

//@desc Get all comments
//@route Get /api/v1/:momentId/comments
//@access Public

exports.getComments = asyncHandler(async (req, res, next) => {
    let comments;
    console.log(req.params)
    if (req.params.momentId) {
        comments = await Comment.find({ moment: req.params.momentId })
            .populate('user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v');
    } else {
        comments = await Comment.find()
            .populate('user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v');
    }

    // Extract user images and map them to URLs
    comments = comments.map(comment => {
        const userImages = comment.user.images || [];
        const imageUrls = userImages.map(image =>
            `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
        );

        return {
            ...comment._doc,
            user: {
                ...comment.user._doc,
                imageUrls
            }
        };
    });

    res.status(200).json({
        success: true,
        count: comments.length,
        data: comments
    });
});


//@desc Get single comment
//@route Get /api/v1/:momentId/comments/:id
//@access Public

exports.getComment = asyncHandler(async (req, res, next) => {
    const comment = await Comment.findById(req.params.id)
        .populate('user', 'name email images bio birth_day birth_month gender birth_year native_language language_to_learn createdAt __v');

    if (!comment) {
        return next(
            new ErrorResponse(`Comment not found with id of ${req.params.id}`, 404)
        );
    }

    // Extract user images and map them to URLs
    const userImages = comment.user.images || [];
    const imageUrls = userImages.map(image =>
        `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
    );

    // Construct the response object
    const commentWithImages = {
        ...comment._doc,
        user: {
            ...comment.user._doc,
            imageUrls
        }
    };

    res.status(200).json({
        success: true,
        data: commentWithImages
    });
});

//@desc POST Add comment
//@route POST /api/v1/moments/:momentId/comments
//@access Private

exports.createComment = asyncHandler(async (req, res, next) => {
    try {
        req.body.moment = req.params.momentId;
        req.body.user = req.user.id;
        const moment = await Moment.findById(req.params.momentId);
        if (!moment) {
            return next(new ErrorResponse(`No moment with the id of ${req.params.momentId}`))
        }
        const comment = await Comment.create(req.body);
        moment.comments.push(comment);
        // Update the comment count
        if (moment.commentCount < 0) {
            moment.commentCount = 0;
        }
        else {
            moment.commentCount += 1;
            await moment.save();
        }
        res.status(200).json({
            success: true,
            data: comment,
            message: 'Success'
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' | `${error}` });
    }
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

// @desc DELETE Delete comment
// @route DELETE /api/v1/moments/:momentId/comments/:id
// @access Public

exports.deleteComment = asyncHandler(async (req, res, next) => {
    const comment = await Comment.remove(req.body);
    res.status(200).json({
        success: true,
        data: comment
    });
});