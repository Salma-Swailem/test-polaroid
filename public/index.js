class SmartWall {
  constructor() {
    this.wall = document.getElementById('wall');
    this.socket = io();
    this.photoById = new Map();
    this.maxPhotos = 300;
    this.cellWidth = 240; // includes padding/margins
    this.cellHeight = 280;
    this.gridCols = Math.max(1, Math.floor(window.innerWidth / this.cellWidth));
    this.gridRows = Math.max(1, Math.floor(window.innerHeight / this.cellHeight));
    this.occupied = new Set(); // key = r:c
    this.bindResize();
    this.bindControls();
    this.initializeSocket();
    this.loadExistingPhotos();
    this.updateStats();
  }

  bindResize() {
    window.addEventListener('resize', () => {
      this.gridCols = Math.max(1, Math.floor(window.innerWidth / this.cellWidth));
      this.gridRows = Math.max(1, Math.floor(window.innerHeight / this.cellHeight));
      // We don't reflow existing, but future placements adapt
    });
  }

  bindControls() {
    const toggleUiBtn = document.getElementById('toggleUiBtn');
    const controls = document.getElementById('controls');
    const analytics = document.getElementById('analytics');
    toggleUiBtn.addEventListener('click', () => {
      const hidden = controls.classList.toggle('hidden-ui');
      analytics.classList.toggle('hidden-ui');
      toggleUiBtn.textContent = hidden ? 'Show UI' : 'Hide UI';
    });
    document.getElementById('exportBtn').addEventListener('click', () => this.exportImage());
  }

  initializeSocket() {
    console.log('Initializing socket connection in index...');
    
    this.socket.on('connect', () => {
      console.log('Connected to wall with socket ID:', this.socket.id);
      this.updateUsers(1);
      // Request current user count
      this.socket.emit('request-user-count');
    });

    this.socket.on('broadcast-photo', (data) => {
      console.log('Received new photo in index:', data);
      this.addPhoto(data);
    });

    // Listen for user count updates
    this.socket.on('user-count-update', (data) => {
      console.log('User count updated in index:', data.count);
      this.updateUsers(data.count);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error in index:', error);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from wall. Reason:', reason);
      this.updateUsers(0);
    });
  }

  async loadExistingPhotos() {
    try {
      const res = await fetch('/api/photos');
      const { success, photos } = await res.json();
      if (success && photos) {
        photos.forEach((p) => this.addPhoto({ img: `/api/photos/proxy/${p.driveId}`, caption: p.caption, driveId: p.driveId, isExisting: true }));
      }
    } catch { }
  }

  addPhoto(data) {
    const driveId = data.driveId || (typeof data.img === 'string' ? data.img.split('/').pop() : undefined);
    if (driveId && this.photoById.has(driveId)) return;

    const slot = this.findRandomFreeSlot();
    if (!slot) return; // no free slot; skip
    this.occupied.add(`${slot.r}:${slot.c}`);

    const x = slot.c * this.cellWidth + 10; // padding
    const y = slot.r * this.cellHeight + 10;

    const card = document.createElement('div');
    card.className = 'polaroid';
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.style.setProperty('--rot', (Math.random() * 10 - 5).toFixed(2));

    const img = document.createElement('img');
    img.src = data.img;
    img.alt = 'Polaroid photo';
    img.referrerPolicy = 'no-referrer';
    card.appendChild(img);

    card.onclick = () => this.showFullView(data);

    this.wall.appendChild(card);
    if (driveId) this.photoById.set(driveId, card);

    this.trimIfNeeded();
    this.updateStats();
  }

  findRandomFreeSlot() {
    const free = [];
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const key = `${r}:${c}`;
        if (!this.occupied.has(key)) free.push({ r, c });
      }
    }
    if (free.length === 0) return null;
    // Shuffle a bit to avoid linear bias
    const idx = Math.floor(Math.random() * free.length);
    return free[idx];
  }

  trimIfNeeded() {
    while (this.wall.children.length > this.maxPhotos) {
      const last = this.wall.lastElementChild;
      if (!last) break;
      // free its slot
      const left = parseInt(last.style.left || '0', 10);
      const top = parseInt(last.style.top || '0', 10);
      const c = Math.floor(left / this.cellWidth);
      const r = Math.floor(top / this.cellHeight);
      this.occupied.delete(`${r}:${c}`);
      this.wall.removeChild(last);
    }
  }

  updateStats() {
    document.getElementById('statTotal').textContent = this.wall.children.length;
    // Rough today count: equals current on session
    document.getElementById('statToday').textContent = this.wall.children.length;
  }

  updateUsers(count) {
    document.getElementById('statUsers').textContent = String(count);
  }

  showFullView(data) {
    const modal = document.createElement('div');
    modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;z-index:5000;cursor:pointer;`;
    const content = document.createElement('div');
    content.style.cssText = `max-width:90vw;max-height:90vh;text-align:center;color:white;`;
    const img = document.createElement('img');
    img.src = data.img;
    img.style.cssText = `max-width:100%;max-height:85vh;border-radius:10px;box-shadow:0 20px 40px rgba(0,0,0,.5);`;
    content.appendChild(img);
    modal.appendChild(content);
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
  }

  exportImage() {
    const canvas = document.createElement('canvas');
    const targetWidth = 3840;
    const targetHeight = 2160;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Draw each card at proportional position
    const scaleX = targetWidth / window.innerWidth;
    const scaleY = targetHeight / window.innerHeight;
    Array.from(this.wall.children).forEach(card => {
      const img = card.querySelector('img');
      if (!img || !img.complete) return;
      const left = parseInt(card.style.left || '0', 10) * scaleX;
      const top = parseInt(card.style.top || '0', 10) * scaleY;
      const w = this.cellWidth * scaleX - 20; // account for padding
      const h = this.cellHeight * scaleY - 20;
      try {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const s = Math.max(w / iw, h / ih);
        const dw = iw * s;
        const dh = ih * s;
        const dx = left + (w - dw) / 2;
        const dy = top + (h - dh) / 2;
        ctx.save();
        // Apply slight rotation similar to CSS
        const rot = parseFloat(getComputedStyle(card).getPropertyValue('--rot')) || 0;
        const cx = left + w / 2;
        const cy = top + h / 2;
        ctx.translate(cx, cy);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.translate(-cx, -cy);
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
      } catch { }
    });

    const link = document.createElement('a');
    link.download = `polaroid-wall-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
}

// Initialize the wall when page loads
document.addEventListener('DOMContentLoaded', () => {
  new SmartWall();
  // Add logout event listener for CSP compliance
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('jwtToken');
      window.location.href = '/login.html';
    });
  }
});