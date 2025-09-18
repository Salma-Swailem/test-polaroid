class StageWall {
  static zIndexCounter = 1000;
  constructor() {
    this.wall = document.getElementById('wall');
    this.loading = document.getElementById('loading');
    this.photos = new Map(); // unique key -> element
    this.photoDatas = new Map(); // unique key -> data
    this.photoKeys = []; // array of keys in order
    this.baseCellSize = 250;
    this.scale = 1;
    this.cellSize = this.baseCellSize * this.scale;
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
      // After resize, check if we need to optimize zoom
      this.optimizeZoomForAllPhotos();
    });
  }

  bindEvents() {
    document.getElementById('cameraBtn').addEventListener('click', () => {
      window.location.href = '/camera.html';
    });
    document.getElementById('exportBtn').addEventListener('click', () => this.exportWall());
  }

  initializeSocket() {
    if (typeof io === 'undefined') {
      console.log('Socket.IO not available, stage will work in polling mode');
      return;
    }

    this.socket = io();
    console.log('Initializing stage socket connection...');

    this.socket.on('connect', () => {
      console.log('Stage connected with socket ID:', this.socket.id);
    });

    this.socket.on('broadcast-photo', (data) => {
      console.log('Received new photo on stage:', data);
      this.addPhoto({
        img: `/api/photos/proxy/${data.driveId}`,
        caption: data.caption || '',
        key: data.id
      }, true);
    });

    this.socket.on('delete-photo', (data) => {
      console.log('Photo deleted on stage:', data.id);
      this.removePhoto(data.id);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Stage socket connection error:', error);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Stage disconnected. Reason:', reason);
    });
  }

  async loadExistingPhotos() {
    try {
      const res = await fetch('/api/photos');
      const data = await res.json();
      if (data.success && data.photos) {
        data.photos.forEach(photo => {
          this.addPhoto({
            img: `/api/photos/proxy/${photo.driveId}`,
            caption: photo.caption || '',
            key: photo.id // use unique DB ID
          }, false);
        });

        // After loading all photos, check if we need to zoom out to fit everything
        this.optimizeZoomForAllPhotos();
      }
      this.loading.style.display = 'none';
    } catch (err) {
      console.error(err);
      this.loading.style.display = 'none';
    }
  }

  optimizeZoomForAllPhotos() {
    const photoCount = this.photos.size;
    const totalSlots = this.rows * this.cols;

    // If we have more photos than 60% of available slots, zoom out to fit better
    while (photoCount > totalSlots * 0.6 && this.scale > 0.4) {
      console.log(`Optimizing zoom: ${photoCount} photos need more space than ${totalSlots} slots allow`);
      this.zoomOut();
    }
  }

  addPhoto(data, isNew = false) {
    if (this.photos.has(data.key)) return;

    // Check if we need to zoom out based on total photo count
    this.autoZoomIfNeeded();

    let position = this.findRandomPosition();
    if (!position) {
      this.zoomOut();
      position = this.findRandomPosition();
      if (!position) return;
    }

    this.photoDatas.set(data.key, data);
    const polaroid = this.createPolaroid(data, position, isNew);
    this.wall.appendChild(polaroid);
    this.photos.set(data.key, polaroid);
    this.photoKeys.push(data.key);
    this.occupiedSlots.add(`${position.row}:${position.col}`);
    this.limitPhotos();
  }

  autoZoomIfNeeded() {
    const totalSlots = this.rows * this.cols;
    const photoCount = this.photos.size;
    const occupancyRate = photoCount / totalSlots;

    // If we're at 70% capacity or more, zoom out proactively
    if (occupancyRate >= 0.7 && this.scale > 0.4) {
      console.log(`Auto-zooming: ${photoCount} photos in ${totalSlots} slots (${(occupancyRate * 100).toFixed(1)}% full)`);
      this.zoomOut();
    }
  }

  removePhoto(photoKey) {
    if (!this.photos.has(photoKey)) return;

    const element = this.photos.get(photoKey);
    if (element) {
      // Get position to free up the slot
      const left = parseInt(element.style.left) || 0;
      const top = parseInt(element.style.top) || 0;
      const col = Math.floor(left / this.cellSize);
      const row = Math.floor(top / this.cellSize);
      this.occupiedSlots.delete(`${row}:${col}`);

      // Remove from DOM and maps
      element.remove();
      this.photos.delete(photoKey);
      this.photoDatas.delete(photoKey);

      // Remove from keys array
      const index = this.photoKeys.indexOf(photoKey);
      if (index > -1) {
        this.photoKeys.splice(index, 1);
      }
    }
  }

  findRandomPosition() {
    const availableSlots = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const key = `${r}:${c}`;
        if (!this.occupiedSlots.has(key)) availableSlots.push({ row: r, col: c });
      }
    }
    if (!availableSlots.length) return null;
    return availableSlots[Math.floor(Math.random() * availableSlots.length)];
  }

  createPolaroid(data, position, isNew) {
    const polaroid = document.createElement('div');
    polaroid.className = 'polaroid';
    if (isNew) polaroid.classList.add('new');

    const photoWidth = 220 * this.scale;
    const photoHeight = 280 * this.scale;
    const padding = 15 * this.scale;
    const imgHeight = 200 * this.scale;
    const captionMargin = 12 * this.scale;
    const minCaptionHeight = 40 * this.scale;
    const offsetRange = 40 * this.scale;

    polaroid.style.width = `${photoWidth}px`;
    polaroid.style.height = `${photoHeight}px`;
    polaroid.style.padding = `${padding}px`;
    polaroid.style.borderRadius = `${12 * this.scale}px`;
    polaroid.style.boxShadow = `0 ${20 * this.scale}px ${40 * this.scale}px rgba(0, 0, 0, 0.3)`;

    const baseX = position.col * this.cellSize + (this.cellSize - photoWidth) / 2;
    const baseY = position.row * this.cellSize + (this.cellSize - photoHeight) / 2;
    const offsetX = (Math.random() - 0.5) * offsetRange;
    const offsetY = (Math.random() - 0.5) * offsetRange;
    polaroid.style.left = `${baseX + offsetX}px`;
    polaroid.style.top = `${baseY + offsetY}px`;

    // random rotation between -10° and +10°
    const angle = (Math.random() * 20 - 10).toFixed(2);
    polaroid.style.transform = `rotate(${angle}deg)`;

    const img = document.createElement('img');
    img.src = data.img;
    img.alt = 'Polaroid photo';
    img.style.height = `${imgHeight}px`;
    img.style.borderRadius = `${8 * this.scale}px`;

    const caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = data.caption || 'No caption';
    caption.style.marginTop = `${captionMargin}px`;
    caption.style.fontSize = `${this.scale}rem`;
    caption.style.minHeight = `${minCaptionHeight}px`;

    polaroid.appendChild(img);
    polaroid.appendChild(caption);

    // Store grid position for later removal
    polaroid.dataset.row = position.row;
    polaroid.dataset.col = position.col;

    // Click = full view
    polaroid.addEventListener('click', (e) => {
      // prevent click while dragging
      if (polaroid.dragging) return;
      this.showFullView(data);
    });

    // Make draggable
    this.makeDraggable(polaroid);

    return polaroid;
  }

  zoomOut() {
    this.scale *= 0.9;
    if (this.scale < 0.4) this.scale = 0.4; // Prevent too small
    this.cellSize = this.baseCellSize * this.scale;
    this.initializeGrid();

    // Reposition all photos
    const oldDatas = Array.from(this.photoDatas.values());
    this.wall.innerHTML = '';
    this.occupiedSlots.clear();
    this.photos.clear();
    this.photoDatas.clear();
    this.photoKeys = [];
    oldDatas.forEach(data => this.addPhoto(data, false));
  }

  makeDraggable(el) {
    let offsetX, offsetY;
    let isDragging = false;

    el.addEventListener('mousedown', (e) => {
      isDragging = true;
      el.dragging = true;
      el.style.cursor = "grabbing";
      el.style.zIndex = ++StageWall.zIndexCounter || 1000; // bring to front
      offsetX = e.clientX - el.offsetLeft;
      offsetY = e.clientY - el.offsetTop;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      el.style.left = `${e.clientX - offsetX}px`;
      el.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        el.style.cursor = "grab";
        setTimeout(() => el.dragging = false, 100); // allow click after drag
      }
    });
  }

  showFullView(data) {
    const modal = document.createElement('div');
    modal.style = `position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:5000;cursor:pointer;`;
    const content = document.createElement('div');
    content.style = `max-width:90vw; max-height:90vh; text-align:center; color:white;`;
    const img = document.createElement('img');
    img.src = data.img;
    img.style = `max-width:100%; max-height:80vh; border-radius:15px; box-shadow:0 25px 60px rgba(0,0,0,0.5);`;
    const caption = document.createElement('p');
    caption.textContent = data.caption || 'No caption';
    caption.style = `margin-top:25px; font-size:1.5rem; font-weight:600; max-width:700px; margin-left:auto;margin-right:auto; line-height:1.4;`;
    content.appendChild(img);
    content.appendChild(caption);
    modal.appendChild(content);
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
  }

  limitPhotos() {
    const maxPhotos = Math.floor(this.rows * this.cols * 0.8);
    while (this.photos.size > maxPhotos) {
      const key = this.photoKeys.shift();
      if (!key) break;
      const el = this.photos.get(key);
      if (el) {
        const row = parseInt(el.dataset.row);
        const col = parseInt(el.dataset.col);
        this.occupiedSlots.delete(`${row}:${col}`);
        el.remove();
        this.photos.delete(key);
        this.photoDatas.delete(key);
      }
    }
  }

  async exportWall() {
    const photosData = Array.from(this.photoDatas.values());
    const numPhotos = photosData.length;
    if (numPhotos === 0) {
      alert('No photos to export!');
      return;
    }

    // Show export options
    const quality = await this.showExportOptions();
    if (!quality) return; // User cancelled

    const settings = this.getExportSettings(quality);

    // Load all images
    const loadedImages = await Promise.all(
      photosData.map(
        (data) =>
          new Promise((resolve) => {
            const i = new Image();
            i.src = data.img;
            i.onload = () => resolve(i);
            i.onerror = () => resolve(null);
          })
      )
    );

    const exportScale = settings.scale;
    const basePhotoWidth = 220 * exportScale;
    const basePhotoHeight = 280 * exportScale;
    const basePadding = 15 * exportScale;
    const baseImgWidth = basePhotoWidth - 2 * basePadding;
    const baseImgHeight = 200 * exportScale;
    const baseCaptionMargin = 12 * exportScale;
    const baseFontSize = 16 * exportScale;
    const baseBorderRadius = 12 * exportScale;
    const imgBorderRadius = 8 * exportScale;
    const baseCaptionHeight = 40 * exportScale;

    // Grid layout for clean export
    const cols = Math.ceil(Math.sqrt(numPhotos));
    const rows = Math.ceil(numPhotos / cols);
    const cellSize = Math.max(basePhotoWidth, basePhotoHeight) + 50 * exportScale; // Margin

    const canvas = document.createElement('canvas');
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
    const ctx = canvas.getContext('2d');

    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Enhanced gradient background instead of white
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw each polaroid
    photosData.forEach((data, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const baseX = col * cellSize + (cellSize - basePhotoWidth) / 2;
      const baseY = row * cellSize + (cellSize - basePhotoHeight) / 2;

      ctx.save();
      ctx.translate(baseX, baseY);

      // Enhanced shadow
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 25 * exportScale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 20 * exportScale;

      // Rounded rect for background
      const roundedRect = (cx, cy, cw, ch, cr) => {
        ctx.beginPath();
        ctx.moveTo(cx + cr, cy);
        ctx.lineTo(cx + cw - cr, cy);
        ctx.quadraticCurveTo(cx + cw, cy, cx + cw, cy + cr);
        ctx.lineTo(cx + cw, cy + ch - cr);
        ctx.quadraticCurveTo(cx + cw, cy + ch, cx + cw - cr, cy + ch);
        ctx.lineTo(cx + cr, cy + ch);
        ctx.quadraticCurveTo(cx, cy + ch, cx, cy + ch - cr);
        ctx.lineTo(cx, cy + cr);
        ctx.quadraticCurveTo(cx, cy, cx + cr, cy);
        ctx.closePath();
        ctx.fill();
      };

      ctx.fillStyle = 'white';
      roundedRect(0, 0, basePhotoWidth, basePhotoHeight, baseBorderRadius);

      // Image with clip for rounded corners and object-fit: cover
      const img = loadedImages[index];
      if (img) {
        const targetW = baseImgWidth;
        const targetH = baseImgHeight;
        let srcX = 0;
        let srcY = 0;
        let srcW = img.naturalWidth;
        let srcH = img.naturalHeight;
        const targetRatio = targetW / targetH;
        const imgRatio = img.naturalWidth / img.naturalHeight;

        if (targetRatio > imgRatio) {
          // Crop height
          srcH = img.naturalHeight * (imgRatio / targetRatio);
          srcY = (img.naturalHeight - srcH) / 2;
        } else {
          // Crop width
          srcW = img.naturalWidth * (targetRatio / imgRatio);
          srcX = (img.naturalWidth - srcW) / 2;
        }

        // Clip path for rounded image
        const roundedRectPath = (cx, cy, cw, ch, cr) => {
          ctx.beginPath();
          ctx.moveTo(cx + cr, cy);
          ctx.lineTo(cx + cw - cr, cy);
          ctx.quadraticCurveTo(cx + cw, cy, cx + cw, cy + cr);
          ctx.lineTo(cx + cw, cy + ch - cr);
          ctx.quadraticCurveTo(cx + cw, cy + ch, cx + cw - cr, cy + ch);
          ctx.lineTo(cx + cr, cy + ch);
          ctx.quadraticCurveTo(cx, cy + ch, cx, cy + ch - cr);
          ctx.lineTo(cx, cy + cr);
          ctx.quadraticCurveTo(cx, cy, cx + cr, cy);
          ctx.closePath();
        };

        ctx.save();
        roundedRectPath(basePadding, basePadding, targetW, targetH, imgBorderRadius);
        ctx.clip();
        ctx.drawImage(img, srcX, srcY, srcW, srcH, basePadding, basePadding, targetW, targetH);
        ctx.restore();
      }

      // Enhanced caption rendering
      ctx.shadowColor = 'transparent'; // Disable shadow for text
      ctx.font = `600 ${baseFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      ctx.fillStyle = '#2c3e50'; // Darker text for better readability
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const captionText = data.caption || 'No caption';
      const maxWidth = baseImgWidth - 20; // Leave some padding

      // Word wrap for long captions
      const words = captionText.split(' ');
      let line = '';
      const lines = [];

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
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

      // Draw each line
      const lineHeight = baseFontSize * 1.2;
      const startY = basePadding + baseImgHeight + baseCaptionMargin + (lineHeight / 2);

      lines.forEach((textLine, lineIndex) => {
        const y = startY + (lineIndex * lineHeight);
        ctx.fillText(textLine.trim(), basePhotoWidth / 2, y);
      });

      ctx.restore();
    });

    // Enhanced download with multiple formats
    this.downloadCanvas(canvas, settings);
  }

  showExportOptions() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:6000;`;

      const content = document.createElement('div');
      content.style.cssText = `background:white;padding:30px;border-radius:15px;text-align:center;max-width:400px;box-shadow:0 25px 50px rgba(0,0,0,0.3);`;

      content.innerHTML = `
        <h2 style="margin:0 0 20px 0;color:#2c3e50;">Export Options</h2>
        <div style="margin:20px 0;">
          <label style="display:block;margin:10px 0;cursor:pointer;">
            <input type="radio" name="quality" value="standard" checked style="margin-right:8px;">
            Standard Quality (2x scale)
          </label>
          <label style="display:block;margin:10px 0;cursor:pointer;">
            <input type="radio" name="quality" value="high" style="margin-right:8px;">
            High Quality (3x scale)
          </label>
          <label style="display:block;margin:10px 0;cursor:pointer;">
            <input type="radio" name="quality" value="ultra" style="margin-right:8px;">
            Ultra Quality (4x scale)
          </label>
        </div>
        <div style="margin:20px 0;">
          <label style="display:block;margin:10px 0;cursor:pointer;">
            <input type="radio" name="format" value="png" checked style="margin-right:8px;">
            PNG (Best Quality)
          </label>
          <label style="display:block;margin:10px 0;cursor:pointer;">
            <input type="radio" name="format" value="jpeg" style="margin-right:8px;">
            JPEG (Smaller Size)
          </label>
        </div>
        <div style="margin-top:25px;">
          <button id="exportConfirm" style="background:#667eea;color:white;border:none;padding:12px 24px;border-radius:8px;margin-right:10px;cursor:pointer;font-weight:600;">Export</button>
          <button id="exportCancel" style="background:#95a5a6;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;">Cancel</button>
        </div>
      `;

      modal.appendChild(content);
      document.body.appendChild(modal);

      document.getElementById('exportConfirm').onclick = () => {
        const quality = document.querySelector('input[name="quality"]:checked').value;
        const format = document.querySelector('input[name="format"]:checked').value;
        modal.remove();
        resolve({ quality, format });
      };

      document.getElementById('exportCancel').onclick = () => {
        modal.remove();
        resolve(null);
      };

      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(null);
        }
      };
    });
  }

  getExportSettings(options) {
    const scaleMap = {
      standard: 2,
      high: 3,
      ultra: 4
    };

    return {
      scale: scaleMap[options.quality] || 2,
      format: options.format || 'png'
    };
  }

  downloadCanvas(canvas, settings) {
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const qualityName = Object.keys(this.getExportSettings({ quality: 'standard' }))
      .find(key => this.getExportSettings({ quality: key }).scale === settings.scale) || 'custom';

    link.download = `polaroid-wall-${qualityName}-${timestamp}.${settings.format}`;

    if (settings.format === 'jpeg') {
      link.href = canvas.toDataURL('image/jpeg', 0.95);
    } else {
      link.href = canvas.toDataURL('image/png');
    }

    link.click();

    // Show success message
    this.showExportSuccess(settings);
  }

  showExportSuccess(settings) {
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;top:20px;right:20px;background:#27ae60;color:white;padding:15px 25px;border-radius:8px;z-index:7000;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-weight:600;`;
    toast.textContent = `Exported successfully as ${settings.format.toUpperCase()}!`;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => { new StageWall(); });