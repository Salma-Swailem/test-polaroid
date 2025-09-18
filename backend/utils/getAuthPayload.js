const prisma = require("../config/prismaClient");

async function getAuthPayload(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

module.exports = getAuthPayload;
