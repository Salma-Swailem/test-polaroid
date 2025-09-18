const prisma = require("../config/prismaClient");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

// configure multer
const upload = multer({ storage: multer.memoryStorage() });

// Telegram Bot API
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Upload Photo Controller
 */
const uploadPhotoController = async (req, res) => {
  try {
    const { id: user_id } = req.user;
    const caption = req.body.caption || "";

    // Fetch user
    const user = await prisma.user.findUnique({ where: { id: user_id } });
    if (!user) return res.status(400).json({ error: "User not found" });

    // 🚫 Blocked user check
    if (user.isBlocked) {
      return res.status(403).json({ error: "User is blocked" });
    }

    // 🚫 Limit check
    if (user.limit <= 0) {
      return res.status(403).json({ error: "Photo upload limit reached" });
    }

    const fileObject = req.file;
    if (!fileObject) return res.status(400).json({ error: "No file uploaded" });

    // Send photo to Telegram
    const formData = new FormData();
    formData.append("chat_id", TELEGRAM_CHAT_ID);
    formData.append("photo", fileObject.buffer, {
      filename: fileObject.originalname,
      contentType: fileObject.mimetype,
    });
    if (caption) formData.append("caption", caption);

    const telegramRes = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      formData,
      { headers: formData.getHeaders() }
    );

    if (!telegramRes.data.ok)
      throw new Error("Telegram API error: " + JSON.stringify(telegramRes.data));

    // Extract Telegram data
    const fileId = telegramRes.data.result.photo.pop().file_id;
    const messageId = telegramRes.data.result.message_id;

    // Save in DB
    const photo = await prisma.photo.create({
      data: {
        userId: user_id,
        driveId: fileId,
        messageId,
        caption,
        link: `https://t.me/PhotoUploader2026_bot?start=${fileId}`,
      },
      include: { user: { select: { email: true } } },
    });

    // Update user stats
    await prisma.user.update({
      where: { id: user_id },
      data: { limit: { decrement: 1 }, photoCount: { increment: 1 } },
    });

    // Emit Socket.IO event
    const io = req.app.get("io");
    io.emit("broadcast-photo", {
      id: photo.id,
      driveId: photo.driveId,
      userId: photo.userId,
      caption: photo.caption || "",
      createdAt: photo.createdAt,
      username: photo.user.email, // Use email as username
    });

    res.json({ success: true, photo });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload photo", details: err.message });
  }
};

/**
 * Delete Photo Controller
 */
const deletePhotoController = async (req, res) => {
  try {
    const { id: user_id, role } = req.user;
    const { photoId } = req.body;

    // Fetch user
    const user = await prisma.user.findUnique({ where: { id: user_id } });
    if (!user) return res.status(400).json({ error: "User not found" });

    // 🚫 Blocked user check
    if (user.isBlocked) {
      return res.status(403).json({ error: "User is blocked" });
    }

    // Find photo
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: { user: true },
    });
    if (!photo) return res.status(404).json({ error: "Photo not found" });

    // Only owner or admin can delete
    if (photo.userId !== user_id && role !== "admin") {
      return res.status(403).json({ error: "Not authorized to delete this photo" });
    }

    // Delete from Telegram (only if messageId exists)
    if (photo.messageId) {
      try {
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`,
          { chat_id: TELEGRAM_CHAT_ID, message_id: photo.messageId }
        );
      } catch (err) {
        console.warn("Telegram delete failed:", err.response?.data || err.message);
      }
    } else {
      console.warn("No messageId found for photo, skipping Telegram deletion");
    }

    // Delete from DB
    await prisma.photo.delete({ where: { id: photoId } });

    // Update user stats
    await prisma.user.update({
      where: { id: photo.userId },
      data: { limit: { increment: 1 }, photoCount: { decrement: 1 } },
    });

    // Emit Socket.IO event
    const io = req.app.get("io");
    io.emit("delete-photo", { id: photoId });

    res.json({ success: true, message: "Photo deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete photo", details: err.message });
  }
};

/**
 * Fetch All Photos
 */
const getAllPhotos = async () => {
  try {
    const photos = await prisma.photo.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
    });

    return photos.map((p) => ({
      id: p.id,
      driveId: p.driveId,
      messageId: p.messageId,
      userId: p.userId,
      caption: p.caption || "",
      createdAt: p.createdAt,
      username: p.user ? p.user.email : "Unknown User",
    }));
  } catch (err) {
    console.error("Failed to get photos:", err);
    return [];
  }
};

/**
 * Proxy Telegram Photo
 */
const proxyTelegramPhoto = async (req, res) => {
  try {
    const fileId = req.params.id;
    const fileRes = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
    );

    if (!fileRes.data.ok)
      return res.status(400).json({ error: "Invalid Telegram file ID" });

    const filePath = fileRes.data.result.file_path;
    const telegramFileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;

    const response = await axios.get(telegramFileUrl, { responseType: "stream" });
    res.setHeader("Content-Type", response.headers["content-type"]);
    response.data.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Failed to fetch photo" });
  }
};

/**
 * Like/Unlike Photo Controller
 */
const toggleLikeController = async (req, res) => {
  try {
    const { id: user_id } = req.user;
    const { photoId } = req.params;

    // Check if photo exists
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Check if user already liked this photo
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_photoId: {
          userId: user_id,
          photoId: photoId,
        },
      },
    });

    if (existingLike) {
      // Unlike: Remove the like
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      res.json({ success: true, action: "unliked", message: "Photo unliked" });
    } else {
      // Like: Add the like
      await prisma.like.create({
        data: {
          userId: user_id,
          photoId: photoId,
        },
      });
      res.json({ success: true, action: "liked", message: "Photo liked" });
    }
  } catch (err) {
    console.error("Toggle like error:", err);
    res.status(500).json({ error: "Failed to toggle like", details: err.message });
  }
};

module.exports = {
  upload,
  uploadPhotoController,
  deletePhotoController,
  toggleLikeController,
  getAllPhotos,
  proxyTelegramPhoto,
};
