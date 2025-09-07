const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDatabase = require("./db");
const logger = require("./logger");
const { ApiError } = require("../utils/apiResponse");
const { registerOrLogin, verifyOtp, userInfo } = require("../routes/auth.controller");
const {
  upload,
  uploadPhotoController,
  getAllPhotos,
  proxyTelegramPhoto,
} = require("../routes/photo.controller");
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
// Swagger docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// Auth routes
app.use("/api/auth", registerOrLogin);
app.use("/api/verify", verifyOtp);
app.use("/api/user", isAuthenticated, userInfo);

// Photo upload route
app.post("/api/upload", isAuthenticated, upload.single("file"), uploadPhotoController);

// Get all photos (HTTP)
app.get("/api/photos", async (req, res) => {
  const photos = await getAllPhotos();
  res.json({ success: true, photos });
});

// Proxy Telegram photo
app.get("/api/photos/proxy/:id", proxyTelegramPhoto);

// 404 handler
app.all("/*splat", (req, res) => ApiError(res, "Route not found", 404));

// Create HTTP server & Socket.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Socket.IO connections
io.on("connection", async (socket) => {
  logger.info("A user connected via Socket.IO");

  // Removed initial broadcast of existing photos to prevent duplicates on clients

  // Listen for new photo broadcasts from clients
  socket.on("new-photo", (data) => io.emit("broadcast-photo", data));

  socket.on("disconnect", () => logger.info("A user disconnected"));
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
