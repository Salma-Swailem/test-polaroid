// Initialize QR code when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Get current URL for camera
  const protocol = window.location.protocol;
  const host = window.location.host;
  const cameraUrl = `${protocol}//${host}/camera`;

  // Update URL display
  document.getElementById('cameraUrl').textContent = cameraUrl;

  // Generate QR code using qrcode.js
  new QRCode(document.getElementById('qrCanvas'), {
    text: cameraUrl,
    width: 250,
    height: 250,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  // Hide loading spinner
  document.getElementById('qrLoading').style.display = 'none';

  // Copy button
  document.getElementById('copyBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(cameraUrl);
      const toast = document.getElementById('toast');
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  });

  // Download QR code
  document.getElementById('downloadQrBtn').addEventListener('click', () => {
    const canvas = document.querySelector('#qrCanvas canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'camera-qr.png';
      link.href = canvas.toDataURL();
      link.click();
    }
  });
});
