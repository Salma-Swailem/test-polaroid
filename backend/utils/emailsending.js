const nodemailer = require("nodemailer");
const { userEmail, userPassword } = require("../config/email");

// Create transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: userEmail,
    pass: userPassword, // Gmail App Password
  },
  tls: {
    rejectUnauthorized: false,
  },

});

async function sendEmail(to, subject, text, html = null) {
  try {
    const mailOptions = {
      from: `"NASA Space Apps Cairo" <${userEmail}>`,
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw new Error("Failed to send email.");
  }
}

module.exports = sendEmail;
