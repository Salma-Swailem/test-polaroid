const logger = require("./logger");
const prisma = require("./prismaClient");
require("dotenv").config();

const connect_database = async () => {
  try {
    await prisma.$connect();

    logger.info(`Database connected successfully`);
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
  }
};

module.exports = connect_database;
