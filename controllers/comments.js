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
    // Pagination (backward compatible - defaults to all if not specified)
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100); // Max 100
    const skip = (page - 1) * limit;

    // Get blocked users if authenticated
    let blockedUserIds = [];
    if (req.user) {
        blockedUserIds = await getBlockedUserIds(req.user._id);
    }

    let query = {};
    if (req.params.momentId) {
        query.moment = req.params.momentId;
    }

    // Only return top-level comments (not replies) unless explicitly requested
    if (req.query.includeReplies !== 'true') {
        query.parentComment = null;
    }

    // Add blocking filter to exclude comments from blocked users
    if (blockedUserIds.length > 0) {
        query = addBlockingFilter(query, 'user', blockedUserIds);
    }

    // Run count and find in parallel
    const [total, comments] = await Promise.all([
        Comment.countDocuments(query),
        Comment.find(query)
            .populate('user', 'name images') // Only essential fields for list view
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
    ]);

    // Extract user images and map them to URLs
    const processedComments = comments.map(comment => {
        const userImages = comment.user?.images || [];
        return {
            ...comment,
            user: {
                ...comment.user,
                imageUrls: userImages
            }
        };
    });

    res.status(200).json({
        success: true,
        count: processedComments.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: processedComments
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

        // Handle reply to parent comment
        if (req.body.parentComment) {
            const parentComment = await Comment.findById(req.body.parentComment);
            if (!parentComment) {
                return next(new ErrorResponse('Parent comment not found', 404));
            }
            // Ensure parent belongs to same moment
            if (parentComment.moment.toString() !== req.params.momentId) {
                return next(new ErrorResponse('Parent comment does not belong to this moment', 400));
            }
        }

        const comment = await Comment.create(req.body);

        // If this is a reply, increment parent's reply count
        if (req.body.parentComment) {
            await Comment.findByIdAndUpdate(req.body.parentComment, {
                $inc: { replyCount: 1 }
            });
        }

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

        // Send notification to parent comment author (if replying)
        if (req.body.parentComment) {
            const parentCommentDoc = await Comment.findById(req.body.parentComment);
            if (parentCommentDoc && parentCommentDoc.user.toString() !== req.user.id) {
                const notificationService = require('../services/notificationService');
                if (notificationService.sendCommentReply) {
                    notificationService.sendCommentReply(
                        parentCommentDoc.user.toString(),
                        req.user.id,
                        moment._id,
                        comment.text
                    ).catch(err => console.error('Reply notification failed:', err));
                }
            }
        }

        // Send notifications to mentioned users
        if (req.body.mentions && req.body.mentions.length > 0) {
            const notificationService = require('../services/notificationService');
            for (const mention of req.body.mentions) {
                if (mention.user && mention.user.toString() !== req.user.id) {
                    if (notificationService.sendCommentMention) {
                        notificationService.sendCommentMention(
                            mention.user.toString(),
                            req.user.id,
                            moment._id,
                            comment.text
                        ).catch(err => console.error('Mention notification failed:', err));
                    }
                }
            }
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


// @desc    Update/edit comment
// @route   PUT /api/v1/moments/:momentId/comments/:id
// @access  Private (owner only)
exports.updateComment = asyncHandler(async (req, res, next) => {
    const commentId = req.params.id || req.params.commentId;
    const comment = await Comment.findById(commentId);

    if (!comment) {
        return next(new ErrorResponse('Comment not found', 404));
    }

    // Only the comment owner can edit
    if (comment.user.toString() !== req.user._id.toString()) {
        return next(new ErrorResponse('Not authorized to edit this comment', 403));
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
        return next(new ErrorResponse('Comment text is required', 400));
    }

    if (text.length > 500) {
        return next(new ErrorResponse('Comment text cannot exceed 500 characters', 400));
    }

    comment.text = text.trim();
    comment.isEdited = true;
    comment.updatedAt = new Date();
    await comment.save();

    // Populate user for response
    await comment.populate('user', 'name images');

    const userImages = comment.user?.images || [];
    const responseComment = {
        ...comment._doc,
        user: {
            ...comment.user._doc,
            imageUrls: userImages
        }
    };

    res.status(200).json({
        success: true,
        data: responseComment
    });
});

// @desc    Like/unlike a comment
// @route   POST /api/v1/moments/:momentId/comments/:id/like
// @access  Private
exports.likeComment = asyncHandler(async (req, res, next) => {
    const commentId = req.params.id || req.params.commentId;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
        return next(new ErrorResponse('Comment not found', 404));
    }

    const alreadyLiked = comment.likedUsers.some(
        id => id.toString() === userId.toString()
    );

    if (alreadyLiked) {
        // Unlike
        comment.likedUsers = comment.likedUsers.filter(
            id => id.toString() !== userId.toString()
        );
        comment.likeCount = Math.max(0, comment.likedUsers.length);
    } else {
        // Like
        comment.likedUsers.push(userId);
        comment.likeCount = comment.likedUsers.length;
    }

    await comment.save();

    res.status(200).json({
        success: true,
        data: {
            isLiked: !alreadyLiked,
            likeCount: comment.likeCount,
        }
    });
});

// @desc    React to a comment with emoji
// @route   POST /api/v1/moments/:momentId/comments/:id/react
// @access  Private
exports.reactToComment = asyncHandler(async (req, res, next) => {
    const commentId = req.params.id || req.params.commentId;
    const userId = req.user._id;
    const { emoji } = req.body;

    if (!emoji) {
        return next(new ErrorResponse('Emoji is required', 400));
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
        return next(new ErrorResponse('Comment not found', 404));
    }

    if (!comment.reactions) comment.reactions = [];

    const existingIndex = comment.reactions.findIndex(
        r => r.user.toString() === userId.toString()
    );

    if (existingIndex !== -1) {
        if (comment.reactions[existingIndex].emoji === emoji) {
            comment.reactions.splice(existingIndex, 1);
        } else {
            comment.reactions[existingIndex].emoji = emoji;
            comment.reactions[existingIndex].createdAt = new Date();
        }
    } else {
        comment.reactions.push({ user: userId, emoji, createdAt: new Date() });
    }

    comment.reactionCount = comment.reactions.length;
    await comment.save();

    // Send notification (if not self-reaction)
    const commentOwnerId = comment.user.toString();
    if (userId.toString() !== commentOwnerId) {
        const notificationService = require('../services/notificationService');
        if (notificationService.sendCommentReaction) {
            notificationService.sendCommentReaction(
                commentOwnerId, userId.toString(), comment.moment, emoji
            ).catch(err => console.error('Comment reaction notification failed:', err));
        }
    }

    res.status(200).json({
        success: true,
        data: {
            reactions: comment.reactions,
            reactionCount: comment.reactionCount
        }
    });
});

// @desc    Remove reaction from comment
// @route   DELETE /api/v1/moments/:momentId/comments/:id/react
// @access  Private
exports.unreactToComment = asyncHandler(async (req, res, next) => {
    const commentId = req.params.id || req.params.commentId;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
        return next(new ErrorResponse('Comment not found', 404));
    }

    if (!comment.reactions) comment.reactions = [];

    comment.reactions = comment.reactions.filter(
        r => r.user.toString() !== userId.toString()
    );
    comment.reactionCount = comment.reactions.length;
    await comment.save();

    res.status(200).json({
        success: true,
        data: {
            reactions: comment.reactions,
            reactionCount: comment.reactionCount
        }
    });
});

// @desc    Upload image to comment
// @route   PUT /api/v1/moments/:momentId/comments/:id/image
// @access  Private
exports.uploadCommentImage = asyncHandler(async (req, res, next) => {
    const commentId = req.params.id || req.params.commentId;
    const comment = await Comment.findById(commentId);

    if (!comment) {
        return next(new ErrorResponse('Comment not found', 404));
    }

    if (comment.user.toString() !== req.user._id.toString()) {
        return next(new ErrorResponse('Not authorized', 403));
    }

    if (!req.file) {
        return next(new ErrorResponse('Please upload an image', 400));
    }

    comment.imageUrl = req.file.location;
    await comment.save();

    res.status(200).json({
        success: true,
        data: { imageUrl: comment.imageUrl }
    });
});

// @desc    Get replies for a comment
// @route   GET /api/v1/moments/:momentId/comments/:id/replies
// @access  Public
exports.getReplies = asyncHandler(async (req, res, next) => {
    const parentId = req.params.id || req.params.commentId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    // Get blocked users if authenticated
    let blockedUserIds = [];
    if (req.user) {
        blockedUserIds = await getBlockedUserIds(req.user._id);
    }

    let query = { parentComment: parentId };
    if (blockedUserIds.length > 0) {
        query = addBlockingFilter(query, 'user', blockedUserIds);
    }

    const [total, replies] = await Promise.all([
        Comment.countDocuments(query),
        Comment.find(query)
            .populate('user', 'name images')
            .sort({ createdAt: 1 }) // oldest first for replies
            .skip(skip)
            .limit(limit)
            .lean()
    ]);

    const processedReplies = replies.map(reply => {
        const userImages = reply.user?.images || [];
        return {
            ...reply,
            user: { ...reply.user, imageUrls: userImages }
        };
    });

    res.status(200).json({
        success: true,
        count: processedReplies.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: processedReplies
    });
});

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