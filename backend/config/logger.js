const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");

// Define log format with corrected order
const logFormat = winston.format.combine(
  winston.format.colorize(), // Apply colorization first
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level}]: ${message}`; // Color is already applied to `level`
  })
);

// Create transport for all logs
const fileTransport = new DailyRotateFile({
  filename: "logs/application-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
});

// Create console transport for important events
const consoleTransport = new winston.transports.Console({
  level: "info", // Only show info and above in console
});

// Create the logger
const logger = winston.createLogger({
  level: "debug",
  format: logFormat,
  transports: [fileTransport, consoleTransport],
  exceptionHandlers: [
    new DailyRotateFile({ filename: "logs/exceptions-%DATE%.log" }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({ filename: "logs/rejections-%DATE%.log" }),
  ],
});

module.exports = logger;
