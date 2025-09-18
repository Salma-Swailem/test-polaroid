const prisma = require("../config/prismaClient");
const { ApiError } = require("../utils/apiResponse");
const { HTTP_401_UNAUTHORIZED } = require("../utils/statusCodes");
const verifyToken = require("../utils/verifyToken");

const isAuthenticated = async (req, res, next) => {
  try {
    if (!req.headers.authorization) {
      return ApiError(res, "Unauthorized: token is not provided", HTTP_401_UNAUTHORIZED);
    }

    const token = req.headers.authorization.split(" ")[1];
    if (!process.env.JWT_SECRET) {
      return ApiError(res, "Server configuration error", 500);
    }

    const payload = await verifyToken(token, process.env.JWT_SECRET);
    if (!payload) {
      return ApiError(res, "Unauthorized: token is invalid", HTTP_401_UNAUTHORIZED);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user) {
      return ApiError(res, "Unauthorized: user does not exist", HTTP_401_UNAUTHORIZED);
    }

    // 🚫 Check if the user is blocked
    if (user.isBlocked) {
      return ApiError(res, "Unauthorized: user is blocked", HTTP_401_UNAUTHORIZED);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware - Unexpected error:", error);
    return ApiError(res, "Authentication error", 500);
  }
};

module.exports = isAuthenticated;
