const prisma = require("../config/prismaClient");
const sendEmail = require("../utils/emailsending");
const { generateOTP } = require("../utils/otpGeneration");
const { ApiSuccess, ApiError } = require("../utils/apiResponse");
const {
  HTTP_200_SUCCESS,
  HTTP_400_BAD_REQUEST,
  HTTP_500_INTERNAL_SERVER_ERROR,
} = require("../utils/statusCodes");
const generateToken = require("../utils/generateToken");

const OTP_EXPIRATION_MINUTES = 5;

async function registerOrLogin(req, res) {
  try {
    const { email } = req.body;
    if (!email) return ApiError(res, "Email is required", HTTP_400_BAD_REQUEST);

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email } });

    // If user doesn't exist, create
    if (!user) {
      user = await prisma.user.create({ data: { email } });
    }

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60000);

    // Save OTP in DB 
    const userOTP = await prisma.oTP.findUnique({ where: { email } });
    if (userOTP) {
      // Update existing OTP
      await prisma.oTP.update({
        where: { email },
        data: { otp: otpCode, expiresAt },
      });
    } else {

      await prisma.oTP.create({
        data: { email, otp: otpCode, expiresAt },
      });
    }
    // Send OTP via email
    await sendEmail(
      email,
      "Your OTP Code",
      `Your OTP code is: ${otpCode}. It is valid for ${OTP_EXPIRATION_MINUTES} minutes.`
    );

    return ApiSuccess(
      res,
      `OTP sent to ${email}. Valid for ${OTP_EXPIRATION_MINUTES} minutes.`,
      HTTP_200_SUCCESS
    );
  } catch (err) {
    console.error("registerOrLogin error:", err);
    return ApiError(res, "Something went wrong", HTTP_500_INTERNAL_SERVER_ERROR);
  }
}

async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return ApiError(res, "Email and OTP required", HTTP_400_BAD_REQUEST);

    const otpRecord = await prisma.oTP.findFirst({
      where: { email, otp },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return ApiError(res, "Invalid or expired OTP", HTTP_400_BAD_REQUEST);
    }

    // Fetch the full user object
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return ApiError(res, "User not found", HTTP_400_BAD_REQUEST);

    // Generate JWT token with user id and role only
    const tokenPayload = { id: user.id, role: user.role };
    const token = await generateToken(tokenPayload, process.env.JWT_SECRET, "1d");
    console.log("Generated Token:", token);
    // Return user info including limit
    return ApiSuccess(res, { message: "Login successful", token, user: { id: user.id, email: user.email, role: user.role, limit: user.limit, photoCount: user.photoCount } }, HTTP_200_SUCCESS);
  } catch (err) {
    console.error("verifyOtp error:", err);
    return ApiError(res, "Something went wrong", HTTP_500_INTERNAL_SERVER_ERROR);
  }
}
async function userInfo(req, res) {
  try {
    // Fetch user from DB to get up-to-date counter
    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return ApiError(res, "User not found", HTTP_400_BAD_REQUEST);
    return ApiSuccess(res, { user: { id: user.id, email: user.email, role: user.role, limit: user.limit, photoCount: user.photoCount } }, HTTP_200_SUCCESS);
  }
  catch (err) {
    console.error("userInfo error:", err);
    return ApiError(res, "Something went wrong", HTTP_500_INTERNAL_SERVER_ERROR);
  }
}
module.exports = { registerOrLogin, verifyOtp, userInfo };
