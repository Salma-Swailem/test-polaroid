const prisma = require("../config/prismaClient");
const { ApiSuccess, ApiError } = require("../utils/apiResponse");
const {
  HTTP_200_SUCCESS,
  HTTP_400_BAD_REQUEST,
  HTTP_500_INTERNAL_SERVER_ERROR,
} = require("../utils/statusCodes");

// Get feed of photos from users that the current user follows
const getFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get the list of users that the current user is following
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map(follow => follow.followingId);

    // If user is not following anyone, return empty array
    if (followingIds.length === 0) {
      return ApiSuccess(res, 'Feed retrieved successfully', {
        photos: [],
        total: 0,
        totalPages: 0,
        currentPage: parseInt(page),
      });
    }

    // Get photos from followed users
    const [photos, total] = await Promise.all([
      prisma.photo.findMany({
        where: {
          userId: { in: followingIds },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          likes: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.photo.count({
        where: {
          userId: { in: followingIds },
        },
      }),
    ]);

    // Add like status for the current user
    const photosWithLikeStatus = photos.map(photo => ({
      ...photo,
      isLiked: photo.likes.some(like => like.userId === userId),
      likes: photo.likes.length,
    }));

    return ApiSuccess(res, 'Feed retrieved successfully', {
      photos: photosWithLikeStatus,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error('Get feed error:', error);
    return ApiError(res, 'Error retrieving feed', HTTP_500_INTERNAL_SERVER_ERROR);
  }
};

// Get suggested users to follow
const getSuggestedUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;

    // Get users that the current user is not following
    const suggestedUsers = await prisma.user.findMany({
      where: {
        id: { not: userId },
        followers: {
          none: {
            followerId: userId,
          },
        },
      },
      select: {
        id: true,
        email: true,
        photoCount: true,
        _count: {
          select: {
            followers: true,
          },
        },
      },
      orderBy: {
        photoCount: 'desc',
      },
      take: limit,
    });

    return ApiSuccess(res, 'Suggested users retrieved successfully', suggestedUsers);
  } catch (error) {
    console.error('Get suggested users error:', error);
    return ApiError(res, 'Error retrieving suggested users', HTTP_500_INTERNAL_SERVER_ERROR);
  }
};

// Follow a user
const followUser = async (req, res) => {
  try {
    const { userId: followingId } = req.params;
    const followerId = req.user.id;

    // Prevent following yourself
    if (followerId === followingId) {
      return ApiError(res, 'You cannot follow yourself', HTTP_400_BAD_REQUEST);
    }

    // Check if user exists
    const userExists = await prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!userExists) {
      return ApiError(res, 'User not found', HTTP_404_NOT_FOUND);
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existingFollow) {
      return ApiError(res, 'Already following this user', HTTP_400_BAD_REQUEST);
    }

    // Create follow relationship
    await prisma.follow.create({
      data: {
        followerId,
        followingId,
      },
    });

    return ApiSuccess(res, 'Successfully followed user');
  } catch (error) {
    console.error('Follow user error:', error);
    return ApiError(res, 'Error following user', HTTP_500_INTERNAL_SERVER_ERROR);
  }
};

// Unfollow a user
const unfollowUser = async (req, res) => {
  try {
    const { userId: followingId } = req.params;
    const followerId = req.user.id;

    // Delete follow relationship if it exists
    await prisma.follow.deleteMany({
      where: {
        followerId,
        followingId,
      },
    });

    return ApiSuccess(res, 'Successfully unfollowed user');
  } catch (error) {
    console.error('Unfollow user error:', error);
    return ApiError(res, 'Error unfollowing user', HTTP_500_INTERNAL_SERVER_ERROR);
  }
};

module.exports = {
  getFeed,
  getSuggestedUsers,
  followUser,
  unfollowUser,
};