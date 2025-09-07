require("dotenv").config();

const { PrismaClient } = require("../../node_modules/@prisma/client");

const prisma =
  global.prisma ||
  (global.prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  }));

module.exports = prisma;
