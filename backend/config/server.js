const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDatabase = require("./db");
const logger = require("./logger");
const { ApiError } = require("../utils/apiResponse");
const { blockUser, registerOrLogin, verifyOtp, userInfo } = require("../routes/auth.controller");
const {
  upload,
  uploadPhotoController,
  getAllPhotos,
  proxyTelegramPhoto,
  deletePhotoController,
  toggleLikeController,
} = require("../routes/photo.controller");
const {
  getFeed,
  getSuggestedUsers,
  followUser,
  unfollowUser,
  getFollowingUsers,
  followUserByEmail,
} = require("../routes/feed.controller");
const { specs, swaggerUi } = require("./swagger");
const isAuthenticated = require('../middlewares/isAuthenticated');
const app = express();
const path = require("path");

// Middleware
// Permissive CORS with credentials and preflight support
const corsOptions = {
  origin: (origin, cb) => cb(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.options('/*splat', cors(corsOptions));
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // allow inline scripts
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
// app.use(
//   rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 100,
//     message: "Too many requests",
//   })
// );
console.log(__dirname)
// Serve all files in public/
app.use(express.static(path.join(__dirname, "../../public")));

// Routes for different views
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/stage.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/admin.html"));
});

app.get("/camera", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/camera.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/login.html"));
});

app.get("/qr", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/qr.html"));
});

app.get("/feed", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/feed.html"));
});
// Swagger docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// Auth routes
app.use("/api/auth", registerOrLogin);
app.use("/api/verify", verifyOtp);
app.use("/api/user", isAuthenticated, userInfo);
app.use("/api/block-user", isAuthenticated, blockUser);
app.use("/api/delete-photo", isAuthenticated, deletePhotoController);
// Photo upload route
app.post("/api/upload", isAuthenticated, upload.single("file"), uploadPhotoController);

// Get all photos (HTTP)
app.get("/api/photos", async (req, res) => {
  const photos = await getAllPhotos();
  res.json({ success: true, photos });
});

// Proxy Telegram photo
app.get("/api/photos/proxy/:id", proxyTelegramPhoto);

// Photo like route
app.post("/api/photos/:photoId/like", isAuthenticated, toggleLikeController);

// Feed routes
app.get("/api/feed", isAuthenticated, getFeed);
app.get("/api/users/suggested", isAuthenticated, getSuggestedUsers);
app.get("/api/users/following", isAuthenticated, getFollowingUsers);
app.post("/api/users/follow-email", isAuthenticated, followUserByEmail);
app.post("/api/users/:userId/follow", isAuthenticated, followUser);
app.delete("/api/users/:userId/follow", isAuthenticated, unfollowUser);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    socketConnected: io.sockets.sockets.size > 0,
    connectedClients: io.sockets.sockets.size,
    uptime: process.uptime()
  });
});

// 404 handler
app.all("/*splat", (req, res) => ApiError(res, "Route not found", 404));

// Create HTTP server & Socket.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Attach Socket.IO to Express app so controllers can access it
app.set("io", io);

// Track connected users with a Set to avoid counting duplicates
const connectedSockets = new Set();
let connectedUsers = 0;

// Socket.IO connections
io.on("connection", async (socket) => {
  // Add socket to connected set if not already present
  if (!connectedSockets.has(socket.id)) {
    connectedSockets.add(socket.id);
    connectedUsers = connectedSockets.size;
    logger.info(`User connected. Socket ID: ${socket.id}, Total users: ${connectedUsers}`);

    // Send updated user count to all connected clients
    logger.info(`Sending user count update to all: ${connectedUsers}`);
    io.emit('user-count-update', { count: connectedUsers });
  }

  // Log all events for this socket
  const originalEmit = socket.emit;
  socket.emit = function () {
    logger.info(`Emitting event '${arguments[0]}' to socket ${socket.id}`, arguments[1] || '');
    return originalEmit.apply(this, arguments);
  };

  // Listen for new photo broadcasts from clients
  socket.on("new-photo", (data) => {
    logger.info(`Received new-photo from ${socket.id}`);
    io.emit("broadcast-photo", data);
  });

  // Handle request for current user count
  socket.on("request-user-count", () => {
    logger.info(`Sending user count (${connectedUsers}) to socket ${socket.id}`);
    socket.emit('user-count-update', { count: connectedUsers });
  });

  socket.on("disconnect", (reason) => {
    // Remove socket from connected set
    if (connectedSockets.delete(socket.id)) {
      connectedUsers = connectedSockets.size;
      logger.info(`User disconnected. Socket ID: ${socket.id}, Reason: ${reason}, Total users: ${connectedUsers}`);

      // Send updated user count to all connected clients
      io.emit('user-count-update', { count: connectedUsers });
    }
    // Send updated user count to all connected admins
    io.emit('user-count-update', { count: connectedUsers });
  });

  // Log all events received on this socket
  const originalOn = socket.on;
  socket.on = function (event, callback) {
    return originalOn.call(this, event, function () {
      logger.info(`Event '${event}' received from socket ${socket.id}`, arguments);
      return callback.apply(this, arguments);
    });
  };
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", async () => {
  logger.info(`Server running on port ${PORT}`);
  await connectDatabase();
});

// Global error handlers
process.on("unhandledRejection", (err) => {
  logger.error(err.message);
});

process.on("uncaughtException", (err) => {
  logger.error(err.message);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;
