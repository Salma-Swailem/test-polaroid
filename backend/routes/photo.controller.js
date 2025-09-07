const prisma = require("../config/prismaClient");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

// configure multer
const upload = multer({ storage: multer.memoryStorage() });

// Telegram Bot API
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Upload Photo Controller
const uploadPhotoController = async (req, res) => {
  try {
    const { id: user_id } = req.user;
    const caption = req.body.caption || "";

    // Fetch user from DB to check limit
    const user = await prisma.user.findUnique({ where: { id: user_id } });
    if (!user) return res.status(400).json({ error: "User not found" });
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

    const fileId = telegramRes.data.result.photo.pop().file_id;

    // Save in DB
    const photo = await prisma.photo.create({
      data: {
        userId: user_id,
        driveId: fileId,
        caption: caption,
        link: `https://t.me/PhotoUploader2026_bot?start=${fileId}`,
      },
    });

    // Decrement user's limit
    await prisma.user.update({
      where: { id: user_id },
      data: { limit: { decrement: 1 }, photoCount: { increment: 1 } }
    });

    res.json({ success: true, photo });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload photo", details: err.message });
  }
};

// Fetch all photos
const getAllPhotos = async () => {
  try {
    const photos = await prisma.photo.findMany({ orderBy: { createdAt: 'desc' } });
    return photos.map(p => ({
      id: p.id, // unique ID for frontend
      driveId: p.driveId,
      userId: p.userId,
      caption: p.caption || "",
    }));
  } catch (err) {
    console.error("Failed to get photos:", err);
    return [];
  }
};

// Proxy Telegram photo
const proxyTelegramPhoto = async (req, res) => {
  try {
    const fileId = req.params.id;
    const fileRes = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
    );

    if (!fileRes.data.ok) return res.status(400).json({ error: "Invalid Telegram file ID" });

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

module.exports = { upload, uploadPhotoController, getAllPhotos, proxyTelegramPhoto };