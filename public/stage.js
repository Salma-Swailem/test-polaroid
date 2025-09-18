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
    document.getElementById('cameraBtn').addEventListener('click', () => {
      window.location.href = '/camera.html';
    });
    document.getElementById('exportBtn').addEventListener('click', () => this.exportWall());
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
      }
      this.loading.style.display = 'none';
    } catch (err) {
      console.error(err);
      this.loading.style.display = 'none';
    }
  }

  addPhoto(data, isNew = false) {
    if (this.photos.has(data.key)) return;

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
    if (numPhotos === 0) return;

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

    const exportScale = 2; // For high quality
    const basePhotoWidth = 220 * exportScale;
    const basePhotoHeight = 280 * exportScale;
    const basePadding = 15 * exportScale;
    const baseImgWidth = basePhotoWidth - 2 * basePadding;
    const baseImgHeight = 200 * exportScale;
    const baseCaptionMargin = 12 * exportScale;
    const baseFontSize = 16 * exportScale; // Approx 1rem
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

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw each polaroid
    photosData.forEach((data, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const baseX = col * cellSize + (cellSize - basePhotoWidth) / 2;
      const baseY = row * cellSize + (cellSize - basePhotoHeight) / 2;

      ctx.save();
      ctx.translate(baseX, baseY);

      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 20 * exportScale;
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

      // Caption (no shadow for text)
      ctx.shadowColor = 'transparent'; // Disable shadow for text
      ctx.font = `600 ${baseFontSize}px sans-serif`;
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      const captionY = basePadding + baseImgHeight + baseCaptionMargin + (baseCaptionHeight / 2);
      ctx.fillText(data.caption || 'No caption', basePhotoWidth / 2, captionY);

      ctx.restore();
    });

    // Download
    const link = document.createElement('a');
    link.download = 'polaroid_wall.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
}

document.addEventListener('DOMContentLoaded', () => { new StageWall(); });