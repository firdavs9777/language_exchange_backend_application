const asyncHandler = require('../middleware/async');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Moment = require('../models/Moment')
const ErrorResponse = require('../utils/errorResponse');
const { getBlockedUserIds, checkBlockStatus, addBlockingFilter } = require('../utils/blockingUtils');

//@desc Get all comments
//@route Get /api/v1/:momentId/comments
//@access Public

exports.getComments = asyncHandler(async (req, res, next) => {
    // Get blocked users if authenticated
    let blockedUserIds = [];
    if (req.user) {
        blockedUserIds = await getBlockedUserIds(req.user._id);
    }

    let query = {};
    if (req.params.momentId) {
        query.moment = req.params.momentId;
    }

    // Add blocking filter to exclude comments from blocked users
    if (blockedUserIds.length > 0) {
        query = addBlockingFilter(query, 'user', blockedUserIds);
    }

    let comments = await Comment.find(query)
        .populate('user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v')
        .sort({ createdAt: -1 });

    // Extract user images and map them to URLs
    comments = comments.map(comment => {
        const userImages = comment.user?.images || [];
        const imageUrls = userImages.map(image => image);

        return {
            ...comment._doc,
            user: {
                ...comment.user?._doc,
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
        image
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

        // Add DigitalOcean Spaces image if uploaded
        if (req.file && req.file.location) {
            req.body.imageUrl = req.file.location;
        }

        // Check comment creation limit
        const { resetDailyCounters, formatLimitError } = require('../utils/limitations');
        const LIMITS = require('../config/limitations');

        const user = req.limitationUser || await User.findById(req.user.id);
        if (!user) {
            return next(new ErrorResponse('User not found', 404));
        }

        // Visitors cannot create comments
        if (user.userMode === 'visitor') {
            return next(new ErrorResponse('Visitors cannot create comments. Please upgrade to regular user.', 403));
        }

        // Reset counters if new day
        await resetDailyCounters(user);
        await user.save();

        // Check if user can create comment
        const canCreate = await user.canCreateComment();
        if (!canCreate) {
            const current = user.regularUserLimitations.commentsCreatedToday || 0;
            const max = LIMITS.regular.commentsPerDay;
            const now = new Date();
            const nextReset = new Date(now);
            nextReset.setHours(24, 0, 0, 0);
            return next(formatLimitError('comments', current, max, nextReset));
        }

        const moment = await Moment.findById(req.params.momentId);
        if (!moment) {
            return next(new ErrorResponse(`No moment with the id of ${req.params.momentId}`))
        }

        // Check if user is blocked by moment owner or vice versa
        const momentOwnerId = moment.user.toString();
        if (req.user.id !== momentOwnerId) {
            const blockStatus = await checkBlockStatus(req.user.id, momentOwnerId);
            if (blockStatus.isBlocked) {
                return next(new ErrorResponse('Cannot comment on this content', 403));
            }
        }

        const comment = await Comment.create(req.body);

        // Increment comment count after successful creation
        await user.incrementCommentCount();
        moment.comments.push(comment);
        // Update the comment count
        if (moment.commentCount < 0) {
            moment.commentCount = 0;
        }
        else {
            moment.commentCount += 1;
            await moment.save();
        }

        // Send notification to moment owner (if not commenting on own moment)
        if (req.user.id !== momentOwnerId) {
            const notificationService = require('../services/notificationService');
            notificationService.sendMomentComment(
                momentOwnerId,
                req.user.id,
                moment._id,
                comment
            ).catch(err => console.error('Comment notification failed:', err));
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
// @access Private (owner or moment owner or admin)

exports.deleteComment = asyncHandler(async (req, res, next) => {
    const commentId = req.params.id || req.params.commentId;

    const comment = await Comment.findById(commentId);

    if (!comment) {
        return next(new ErrorResponse('Comment not found', 404));
    }

    // Get the moment to check if user is moment owner
    const moment = await Moment.findById(comment.moment);

    // Authorization: user must be comment owner, moment owner, or admin
    const isCommentOwner = comment.user.toString() === req.user._id.toString();
    const isMomentOwner = moment && moment.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCommentOwner && !isMomentOwner && !isAdmin) {
        return next(new ErrorResponse('Not authorized to delete this comment', 403));
    }

    // Remove comment from moment's comments array and decrement count
    if (moment) {
        moment.comments = moment.comments.filter(c => c.toString() !== commentId);
        moment.commentCount = Math.max(0, (moment.commentCount || 0) - 1);
        await moment.save();
    }

    await comment.deleteOne();

    res.status(200).json({
        success: true,
        data: {}
    });
});

/**
 * @desc    Translate a comment
 * @route   POST /api/v1/comments/:commentId/translate
 * @access  Private
 */
exports.translateComment = asyncHandler(async (req, res, next) => {
    const commentId = req.params.id || req.params.commentId; // Support both :id and :commentId
    const { targetLanguage } = req.body;

    if (!targetLanguage) {
        return next(new ErrorResponse('Target language is required', 400));
    }

    // Validate language code
    const translationService = require('../services/translationService');
    if (!translationService.isValidLanguageCode(targetLanguage)) {
        return next(new ErrorResponse(`Unsupported language code: ${targetLanguage}`, 400));
    }

    // Get comment
    const comment = await Comment.findById(commentId).populate('user', 'native_language');
    if (!comment) {
        return next(new ErrorResponse(`Comment not found with id of ${commentId}`, 404));
    }

    // Get source text
    const sourceText = comment.text || '';
    if (!sourceText.trim()) {
        return next(new ErrorResponse('Comment has no text to translate', 400));
    }

    // Get source language from comment author's native language or auto-detect
    const sourceLanguage = comment.user?.native_language || null;

    try {
        // Get or create translation
        const translation = await translationService.getOrCreateTranslation(
            commentId,
            'comment',
            sourceText,
            targetLanguage,
            sourceLanguage
        );

        res.status(200).json({
            success: true,
            data: {
                language: translation.language,
                translatedText: translation.translatedText,
                translatedAt: translation.translatedAt
            },
            cached: translation.cached
        });
    } catch (error) {
        console.error('Translation error:', error);
        return next(new ErrorResponse(`Translation failed: ${error.message}`, 500));
    }
});

/**
 * @desc    Get all translations for a comment
 * @route   GET /api/v1/comments/:commentId/translations
 * @access  Private
 */
exports.getCommentTranslations = asyncHandler(async (req, res, next) => {
    const commentId = req.params.id || req.params.commentId; // Support both :id and :commentId

    // Get comment
    const comment = await Comment.findById(commentId);
    if (!comment) {
        return next(new ErrorResponse(`Comment not found with id of ${commentId}`, 404));
    }

    try {
        const translationService = require('../services/translationService');
        const translations = await translationService.getTranslations(commentId, 'comment');

        res.status(200).json({
            success: true,
            data: translations
        });
    } catch (error) {
        console.error('Get translations error:', error);
        return next(new ErrorResponse(`Failed to get translations: ${error.message}`, 500));
    }
});