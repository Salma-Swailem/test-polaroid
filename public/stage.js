class StageWall {
  constructor() {
    this.wall = document.getElementById('wall');
    this.loading = document.getElementById('loading');
    this.photos = new Map(); // unique key -> element
    this.cellSize = 250;
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

    const position = this.findRandomPosition();
    if (!position) return;

    const polaroid = this.createPolaroid(data, position, isNew);
    this.wall.appendChild(polaroid);
    this.photos.set(data.key, polaroid);
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

    const baseX = position.col * this.cellSize + (this.cellSize - 220) / 2;
    const baseY = position.row * this.cellSize + (this.cellSize - 280) / 2;
    const offsetX = (Math.random() - 0.5) * 40;
    const offsetY = (Math.random() - 0.5) * 40;
    polaroid.style.left = `${baseX + offsetX}px`;
    polaroid.style.top = `${baseY + offsetY}px`;

    const img = document.createElement('img');
    img.src = data.img;
    img.alt = 'Polaroid photo';

    const caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = data.caption || 'No caption';

    polaroid.appendChild(img);
    polaroid.appendChild(caption);

    polaroid.addEventListener('click', () => this.showFullView(data));
    return polaroid;
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
    const photos = Array.from(this.wall.children);
    while (photos.length > maxPhotos) {
      const oldest = photos.shift();
      if (oldest) {
        const left = parseInt(oldest.style.left) || 0;
        const top = parseInt(oldest.style.top) || 0;
        const col = Math.floor(left / this.cellSize);
        const row = Math.floor(top / this.cellSize);
        this.occupiedSlots.delete(`${row}:${col}`);
        oldest.remove();
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => { new StageWall(); });