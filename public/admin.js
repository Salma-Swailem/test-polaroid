class AdminWall {
  constructor() {
    this.wall = document.getElementById('wall');
    this.loading = document.getElementById('loading');
    this.socket = io();
    this.photos = new Map(); // driveId -> element
    this.cellSize = 220; // spacing between photos
    this.occupiedSlots = new Set();

    this.initializeGrid();
    this.bindEvents();
    this.initializeSocket();
    this.loadExistingPhotos();
  }

  initializeGrid() {
    this.cols = Math.floor(window.innerWidth / this.cellSize);
    this.rows = Math.floor(window.innerHeight / this.cellSize);

    window.addEventListener('resize', () => {
      this.cols = Math.floor(window.innerWidth / this.cellSize);
      this.rows = Math.floor(window.innerHeight / this.cellSize);
    });
  }

  bindEvents() {
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportHighResImage();
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.refreshWall();
    });

    document.getElementById('stageBtn').addEventListener('click', () => {
      window.open('/', '_blank');
    });
  }

  initializeSocket() {
    console.log('Initializing socket connection...');
    
    this.socket.on('connect', () => {
      console.log('Admin connected to live wall with socket ID:', this.socket.id);
      this.updateStats();
    });

    this.socket.on('broadcast-photo', (data) => {
      console.log('Received new photo:', data);
      this.addPhoto(data, true);
    });

    this.socket.on('user-count-update', (data) => {
      console.log('User count updated:', data.count);
      document.getElementById('activeUsers').textContent = data.count;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Admin disconnected from wall. Reason:', reason);
      this.updateStats();
    });
    
    // Log all socket events for debugging
    const originalEmit = this.socket.emit;
    this.socket.emit = function() {
      console.log('Emitting event:', arguments[0], arguments[1]);
      return originalEmit.apply(this, arguments);
    };
  }

  async loadExistingPhotos() {
    try {
      const response = await fetch('/api/photos');
      const data = await response.json();

      if (data.success && data.photos) {
        // Sort by newest first
        const sortedPhotos = data.photos.sort((a, b) =>
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );

        sortedPhotos.forEach(photo => {
          this.addPhoto({
            img: `/api/photos/proxy/${photo.driveId}`,
            caption: photo.caption || '',
            driveId: photo.driveId,
            createdAt: photo.createdAt
          }, false);
        });
      }

      this.loading.style.display = 'none';
      this.updateStats();
    } catch (error) {
      console.error('Error loading photos:', error);
      this.loading.style.display = 'none';
      this.showStatus('Error loading photos', 'error');
    }
  }

  addPhoto(data, isNew = false) {
    const driveId = data.driveId || this.extractDriveId(data.img);

    // Prevent duplicates
    if (driveId && this.photos.has(driveId)) {
      return;
    }

    const position = this.findRandomPosition();
    if (!position) {
      return; // No space available
    }

    const polaroid = this.createPolaroid(data, position, isNew);
    this.wall.appendChild(polaroid);

    if (driveId) {
      this.photos.set(driveId, polaroid);
    }

    // Mark position as occupied
    this.occupiedSlots.add(`${position.row}:${position.col}`);

    // Limit total photos
    this.limitPhotos();
    this.updateStats();

    if (isNew) {
      this.showStatus('New photo added to wall!', 'success');
    }
  }

  extractDriveId(imgUrl) {
    if (typeof imgUrl === 'string') {
      const parts = imgUrl.split('/');
      return parts[parts.length - 1];
    }
    return null;
  }

  findRandomPosition() {
    const availableSlots = [];

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const key = `${row}:${col}`;
        if (!this.occupiedSlots.has(key)) {
          availableSlots.push({ row, col });
        }
      }
    }

    if (availableSlots.length === 0) {
      return null;
    }

    // Return random available slot
    return availableSlots[Math.floor(Math.random() * availableSlots.length)];
  }

  createPolaroid(data, position, isNew) {
    const polaroid = document.createElement('div');
    polaroid.className = 'polaroid';
    if (isNew) polaroid.classList.add('new');

    // Calculate position with some random offset for natural look
    const baseX = position.col * this.cellSize + (this.cellSize - 200) / 2;
    const baseY = position.row * this.cellSize + (this.cellSize - 250) / 2;
    const offsetX = (Math.random() - 0.5) * 30; // ±15px
    const offsetY = (Math.random() - 0.5) * 30; // ±15px

    polaroid.style.left = `${baseX + offsetX}px`;
    polaroid.style.top = `${baseY + offsetY}px`;
    polaroid.style.setProperty('--rot', (Math.random() * 10 - 5).toFixed(1));

    // Create image
    const img = document.createElement('img');
    img.src = data.img;
    img.alt = 'Polaroid photo';
    img.loading = 'lazy';

    // Create caption
    const caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = data.caption || 'No caption';

    polaroid.appendChild(img);
    polaroid.appendChild(caption);

    // Add click event for full view
    polaroid.addEventListener('click', () => this.showFullView(data));

    return polaroid;
  }

  showFullView(data) {
    const modal = document.createElement('div');
    modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5000;
          cursor: pointer;
        `;

    const content = document.createElement('div');
    content.style.cssText = `
          max-width: 90vw;
          max-height: 90vh;
          text-align: center;
          color: white;
        `;

    const img = document.createElement('img');
    img.src = data.img;
    img.style.cssText = `
          max-width: 100%;
          max-height: 80vh;
          border-radius: 15px;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
        `;

    const caption = document.createElement('p');
    caption.textContent = data.caption || 'No caption';
    caption.style.cssText = `
          margin-top: 25px;
          font-size: 1.3rem;
          font-weight: 600;
          max-width: 700px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.4;
        `;

    content.appendChild(img);
    content.appendChild(caption);
    modal.appendChild(content);

    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
  }

  limitPhotos() {
    const maxPhotos = Math.floor((this.rows * this.cols) * 0.9); // 90% capacity for admin
    const photos = Array.from(this.wall.children);

    while (photos.length > maxPhotos) {
      const oldest = photos.shift();
      if (oldest) {
        // Free up the slot
        const left = parseInt(oldest.style.left) || 0;
        const top = parseInt(oldest.style.top) || 0;
        const col = Math.floor(left / this.cellSize);
        const row = Math.floor(top / this.cellSize);
        this.occupiedSlots.delete(`${row}:${col}`);

        oldest.remove();
      }
    }
  }

  updateStats() {
    const totalPhotos = this.wall.children.length;
    // Don't update active users here - it will be updated via socket events
    const todayPhotos = totalPhotos; // Simplified - photos in current session

    document.getElementById('totalPhotos').textContent = totalPhotos;
    document.getElementById('todayPhotos').textContent = todayPhotos;
    
    // Request current user count from server
    if (this.socket.connected) {
      this.socket.emit('request-user-count');
    }
  }

  refreshWall() {
    this.showStatus('Refreshing wall...', 'success');
    this.wall.innerHTML = '';
    this.photos.clear();
    this.occupiedSlots.clear();
    this.loadExistingPhotos();
  }

  async exportHighResImage() {
    try {
      this.showStatus('Preparing high-resolution export...', 'success');

      // Create high-resolution canvas
      const canvas = document.createElement('canvas');
      const targetWidth = 3840; // 4K width
      const targetHeight = 2160; // 4K height

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      // Fill with gradient background
      const gradient = ctx.createLinearGradient(0, 0, targetWidth, targetHeight);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Scale factors
      const scaleX = targetWidth / window.innerWidth;
      const scaleY = targetHeight / window.innerHeight;

      // Draw each photo
      const photos = Array.from(this.wall.children);
      let loadedCount = 0;
      const totalPhotos = photos.length;

      for (const photo of photos) {
        const img = photo.querySelector('img');
        const caption = photo.querySelector('.caption');

        if (!img || !img.complete) continue;

        // Get position and rotation
        const left = parseInt(photo.style.left || '0') * scaleX;
        const top = parseInt(photo.style.top || '0') * scaleY;
        const rotation = parseFloat(photo.style.getPropertyValue('--rot') || '0');

        // Scale dimensions
        const photoWidth = 200 * scaleX;
        const photoHeight = 250 * scaleY;
        const imgHeight = 170 * scaleY;
        const padding = 12 * scaleX;

        try {
          ctx.save();

          // Apply rotation
          const centerX = left + photoWidth / 2;
          const centerY = top + photoHeight / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.translate(-centerX, -centerY);

          // Draw white background (polaroid frame)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(left, top, photoWidth, photoHeight);

          // Draw image
          const iw = img.naturalWidth || img.width;
          const ih = img.naturalHeight || img.height;

          if (iw && ih) {
            const scale = Math.max((photoWidth - padding * 2) / iw, imgHeight / ih);
            const dw = iw * scale;
            const dh = ih * scale;
            const dx = left + padding + (photoWidth - padding * 2 - dw) / 2;
            const dy = top + padding;

            ctx.drawImage(img, dx, dy, dw, Math.min(dh, imgHeight));
          }

          // Draw caption
          if (caption && caption.textContent.trim()) {
            ctx.fillStyle = '#333333';
            ctx.font = `600 ${Math.floor(16 * scaleX)}px 'Segoe UI', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const captionY = top + imgHeight + padding + (photoHeight - imgHeight - padding * 2) / 2;
            const maxWidth = photoWidth - padding * 2;

            this.wrapText(ctx, caption.textContent, left + photoWidth / 2, captionY, maxWidth, Math.floor(20 * scaleY));
          }

          ctx.restore();
          loadedCount++;
        } catch (error) {
          console.error('Error drawing photo:', error);
        }
      }

      // Create download link
      const link = document.createElement('a');
      link.download = `polaroid-wall-export-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.showStatus(`Successfully exported ${loadedCount} photos in 4K resolution!`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      this.showStatus('Error exporting image. Please try again.', 'error');
    }
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let testLine = '';
    const lines = [];

    for (let n = 0; n < words.length; n++) {
      testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    // Draw lines (max 2 lines)
    const maxLines = Math.min(lines.length, 2);
    const startY = y - ((maxLines - 1) * lineHeight) / 2;

    for (let i = 0; i < maxLines; i++) {
      ctx.fillText(lines[i].trim(), x, startY + i * lineHeight);
    }
  }

  showStatus(message, type = 'success') {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';

    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 3000);
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new AdminWall();
});