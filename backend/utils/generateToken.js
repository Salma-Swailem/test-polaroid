const jwt = require("jsonwebtoken");
const getAuthPayload = require("./getAuthPayload");

const generateToken = async (user, secret, period = "1d") => {
  const payload = await getAuthPayload(user);
  return jwt.sign(payload, secret, { expiresIn: period });
};

module.exports = generateToken;
