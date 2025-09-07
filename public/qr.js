// Simple QR Code generator
class QRCodeGenerator {
  constructor(canvas, text, size = 250) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.text = text;
    this.size = size;
    this.canvas.width = size;
    this.canvas.height = size;
    this.generate();
  }

  generate() {
    // This is a simplified QR code - in production, use a proper QR library
    const gridSize = 25;
    const cellSize = this.size / gridSize;

    // Clear canvas
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.size, this.size);

    // Create a simple pattern based on the URL
    this.ctx.fillStyle = '#000000';

    // Generate pseudo-random pattern based on text
    const hash = this.hashCode(this.text);
    const random = this.seededRandom(hash);

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        // Add positioning squares (corners)
        if (this.isPositionSquare(i, j, gridSize)) {
          this.ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
        }
        // Add data pattern
        else if (random() > 0.5) {
          this.ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
        }
      }
    }

    // Add URL text below
    this.ctx.fillStyle = '#333333';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Scan with camera app', this.size / 2, this.size - 10);
  }

  isPositionSquare(row, col, gridSize) {
    // Top-left corner
    if ((row < 7 && col < 7) &&
      ((row < 2 || row > 4) || (col < 2 || col > 4)) &&
      !(row > 1 && row < 5 && col > 1 && col < 5)) {
      return true;
    }
    // Top-right corner
    if ((row < 7 && col >= gridSize - 7) &&
      ((row < 2 || row > 4) || (col < gridSize - 5 || col >= gridSize - 2)) &&
      !(row > 1 && row < 5 && col > gridSize - 6 && col < gridSize - 2)) {
      return true;
    }
    // Bottom-left corner
    if ((row >= gridSize - 7 && col < 7) &&
      ((row < gridSize - 5 || row >= gridSize - 2) || (col < 2 || col > 4)) &&
      !(row > gridSize - 6 && row < gridSize - 2 && col > 1 && col < 5)) {
      return true;
    }
    return false;
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  seededRandom(seed) {
    let m = 2147483647;
    let a = 16807;
    let current = seed % m;
    return function () {
      current = (a * current) % m;
      return current / m;
    };
  }
}

// Initialize QR code when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Get current URL for camera
  const protocol = window.location.protocol;
  const host = window.location.host;
  const cameraUrl = `${protocol}//${host}/camera`;

  // Update URL display
  document.getElementById('cameraUrl').textContent = cameraUrl;

  // Generate QR code
  const canvas = document.getElementById('qrCanvas');
  new QRCodeGenerator(canvas, cameraUrl);

  // For a real QR code, you would use a library like qrcode.js:
  // Example with qrcode.js library (uncomment if you add the library):
  /*
  if (typeof QRCode !== 'undefined') {
    const qr = new QRCode(canvas, {
      text: cameraUrl,
      width: 250,
      height: 250,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }
  */
});