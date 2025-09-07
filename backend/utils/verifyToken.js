const jwt = require("jsonwebtoken");
const logger = require("../config/logger");

const verifyToken = async (token, secret) => {
  try {
    const payload = jwt.verify(token, secret);
    return payload;
  } catch (error) {
    logger.error(`Token verification error: ${error.message}`);
    return null;
  }
};

module.exports = verifyToken;
