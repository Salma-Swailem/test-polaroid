const prisma = require("../config/prismaClient");
const { ApiError } = require("../utils/apiResponse");
const { HTTP_401_UNAUTHORIZED } = require("../utils/statusCodes");
const verifyToken = require("../utils/verifyToken");

const isAuthenticated = async (req, res, next) => {
  try {
    console.log("Auth middleware - headers:", req.headers);

    if (!req.headers.authorization) {
      console.log("Auth middleware - No authorization header");
      return ApiError(
        res,
        "Unauthorized: token is not provided",
        HTTP_401_UNAUTHORIZED
      );
    }

    const token = req.headers.authorization.split(" ")[1];
    console.log("Auth middleware - Token extracted:", token ? "Present" : "Missing");

    if (!process.env.JWT_SECRET) {
      console.error("Auth middleware - JWT_SECRET not set");
      return ApiError(
        res,
        "Server configuration error",
        500
      );
    }

    const payload = await verifyToken(token, process.env.JWT_SECRET);
    console.log("Auth middleware - Token payload:", payload ? "Valid" : "Invalid");

    if (!payload) {
      console.log("Auth middleware - Invalid token");
      return ApiError(
        res,
        "Unauthorized: token is invalid",
        HTTP_401_UNAUTHORIZED
      );
    }

    const user_id = payload.id;
    console.log("Auth middleware - User ID from token:", user_id);

    const user = await prisma.user.findUnique({
      where: { id: user_id },
    });

    console.log("Auth middleware - User found:", user ? "Yes" : "No");

    if (!user) {
      console.log("Auth middleware - User does not exist");
      return ApiError(
        res,
        "Unauthorized: user does not exist",
        HTTP_401_UNAUTHORIZED
      );
    }

    if (user.is_active === false) {
      console.log("Auth middleware - User is not active");
      return ApiError(
        res,
        "Unauthorized: user is not active",
        HTTP_401_UNAUTHORIZED
      );
    }

    req.user = user;
    console.log("Auth middleware - User authenticated successfully:", user.email);

    next();
  } catch (error) {
    console.error("Auth middleware - Unexpected error:", error);
    return ApiError(
      res,
      "Authentication error",
      500
    );
  }
};

module.exports = isAuthenticated;
