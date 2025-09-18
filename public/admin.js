class AdminWall {
  constructor() {
    this.photoList = document.getElementById('photo-list');
    this.loading = document.getElementById('loading');
    this.photos = new Map(); // driveId -> element

    // Check if user is authenticated
    if (!this.getToken()) {
      this.showStatus('Please log in to access the admin panel.', 'error');
      // Redirect to login page after a delay
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 3000);
      return;
    }

    if (!this.photoList || !this.loading) {
      console.error('DOM elements missing:', { photoList: !!this.photoList, loading: !!this.loading });
      this.showStatus('Page initialization error', 'error');
      return;
    }
    this.bindEvents();
    this.initializeSocket();
    this.loadExistingPhotos();
  }

  getToken() {
    return localStorage.getItem('jwtToken');
  }

  getAuthHeaders() {
    const token = this.getToken();
    if (!token) {
      this.showStatus('No authentication token found. Please log in.', 'error');
      return null;
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  bindEvents() {
    const refreshBtn = document.getElementById('refreshBtn');

    if (!refreshBtn) {
      console.error('Admin control buttons missing:', { refreshBtn: !!refreshBtn });
    }

    refreshBtn?.addEventListener('click', () => {
      console.log('Refresh button clicked');
      this.refreshList();
    });
  }

  initializeSocket() {
    if (typeof io === 'undefined') {
      console.log('Socket.IO not available, admin will work in polling mode');
      return;
    }

    this.socket = io();
    console.log('Initializing admin socket connection...');

    this.socket.on('connect', () => {
      console.log('Admin connected with socket ID:', this.socket.id);
    });

    this.socket.on('broadcast-photo', (data) => {
      console.log('Received new photo via socket:', data);
      this.addPhoto({
        id: data.id,
        img: `/api/photos/proxy/${data.driveId}`,
        caption: data.caption || '',
        driveId: data.driveId,
        createdAt: data.createdAt,
        username: data.username || 'Unknown User',
        userId: data.userId
      }, true);
    });

    this.socket.on('delete-photo', (data) => {
      console.log('Photo deleted via socket:', data);
      const photoElement = this.photos.get(data.id);
      if (photoElement) {
        photoElement.remove();
        this.photos.delete(data.id);
        this.updateStats();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Admin disconnected. Reason:', reason);
    });
  }

  async loadExistingPhotos() {
    try {
      console.log('Fetching photos from /api/photos...');
      // Note: /api/photos doesn't require authentication
      const res = await fetch('/api/photos');
      const data = await res.json();
      console.log('API response:', data);

      if (data.success && data.photos) {
        console.log(`Processing ${data.photos.length} photos...`);
        data.photos.forEach((photo, index) => {
          console.log(`Photo ${index + 1}:`, photo);
          this.addPhoto({
            id: photo.id,
            img: `/api/photos/proxy/${photo.driveId}`,
            caption: photo.caption || '',
            driveId: photo.driveId,
            createdAt: photo.createdAt,
            username: photo.username || 'Unknown User',
            userId: photo.userId // Include userId for block/unblock
          }, false);
        });
      } else {
        console.warn('No photos or invalid response:', data);
        this.showStatus('No photos available', 'error');
      }
      this.loading.style.display = 'none';
      this.updateStats();
    } catch (err) {
      console.error('Error loading photos:', err);
      this.loading.style.display = 'none';
      this.showStatus('Error loading photos: ' + err.message, 'error');
    }
  }

  async deletePhoto(photoId, driveId) {
    try {
      const headers = this.getAuthHeaders();
      if (!headers) return;

      const res = await fetch('/api/delete-photo', {
        method: 'DELETE',
        headers: headers,
        body: JSON.stringify({ photoId })
      });
      const data = await res.json();
      if (data.success) {
        const photoElement = this.photos.get(driveId);
        if (photoElement) {
          photoElement.remove();
          this.photos.delete(driveId);
          this.updateStats();
          this.showStatus('Photo deleted successfully', 'success');
        }
      } else {
        this.showStatus(data.error || 'Failed to delete photo', 'error');
      }
    } catch (err) {
      console.error('Delete photo error:', err);
      this.showStatus('Error deleting photo: ' + err.message, 'error');
    }
  }

  async blockUser(userId, action) {
    try {
      const headers = this.getAuthHeaders();
      if (!headers) return;

      const res = await fetch('/api/block-user', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ userId, action })
      });
      const data = await res.json();
      if (data.success) {
        this.showStatus(data.message, 'success');
        // Optionally refresh the photo list to reflect any changes
        this.refreshList();
      } else {
        this.showStatus(data.error || `Failed to ${action} user`, 'error');
      }
    } catch (err) {
      console.error('Block user error:', err);
      this.showStatus(`Error ${action}ing user: ${err.message}`, 'error');
    }
  }

  addPhoto(data, isNew = false) {
    const driveId = data.driveId || this.extractDriveId(data.img);
    if (!driveId) {
      console.warn('Skipping photo with invalid driveId:', data);
      return;
    }

    if (this.photos.has(driveId)) {
      console.log(`Photo with driveId ${driveId} already exists, skipping.`);
      return;
    }

    console.log(`Adding photo with driveId ${driveId}, isNew: ${isNew}`);
    const photoItem = this.createPhotoItem(data, isNew);
    if (isNew) {
      this.photoList.prepend(photoItem);
    } else {
      this.photoList.appendChild(photoItem);
    }

    this.photos.set(driveId, photoItem);
    this.updateStats();

    if (isNew) {
      this.showStatus('New photo added to list!', 'success');
    }
  }

  createPhotoItem(data, isNew) {
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    if (isNew) photoItem.classList.add('new');

    const img = document.createElement('img');
    img.src = data.img;
    img.alt = 'User photo';
    img.loading = 'lazy';
    img.onerror = () => {
      console.error(`Failed to load image: ${data.img}`);
      img.src = '/placeholder.jpg';
      this.showStatus(`Failed to load image for ${data.username || 'user'}`, 'error');
    };

    const details = document.createElement('div');
    details.className = 'photo-details';

    const username = document.createElement('div');
    username.className = 'username';
    username.textContent = `By: ${data.username || 'Unknown User'}`;

    const caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = data.caption || 'No caption';

    const createdAt = document.createElement('div');
    createdAt.className = 'created-at';
    createdAt.textContent = data.createdAt ? new Date(data.createdAt).toLocaleString() : 'Unknown time';

    details.appendChild(username);
    details.appendChild(caption);
    details.appendChild(createdAt);

    // Add admin controls
    const adminControls = document.createElement('div');
    adminControls.className = 'admin-photo-controls';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'admin-btn danger';
    deleteBtn.textContent = 'Delete Photo';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent modal from opening
      if (confirm('Are you sure you want to delete this photo?')) {
        this.deletePhoto(data.id, data.driveId);
      }
    });

    const blockBtn = document.createElement('button');
    blockBtn.className = 'admin-btn warning';
    blockBtn.textContent = 'Block User';
    blockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to block this user?')) {
        this.blockUser(data.userId, 'block');
      }
    });

    const unblockBtn = document.createElement('button');
    unblockBtn.className = 'admin-btn success';
    unblockBtn.textContent = 'Unblock User';
    unblockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to unblock this user?')) {
        this.blockUser(data.userId, 'unblock');
      }
    });

    adminControls.appendChild(deleteBtn);
    adminControls.appendChild(blockBtn);
    adminControls.appendChild(unblockBtn);
    details.appendChild(adminControls);

    photoItem.appendChild(img);
    photoItem.appendChild(details);

    photoItem.addEventListener('click', () => this.showFullView(data));

    return photoItem;
  }

  showFullView(data) {
    const modal = document.createElement('div');
    modal.className = 'modal';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const img = document.createElement('img');
    img.src = data.img;
    img.onerror = () => {
      console.error(`Failed to load modal image: ${data.img}`);
      img.src = '/placeholder.jpg';
    };

    const details = document.createElement('div');
    details.className = 'modal-details';

    const username = document.createElement('p');
    username.textContent = `By: ${data.username || 'Unknown User'}`;

    const caption = document.createElement('p');
    caption.textContent = data.caption || 'No caption';

    const createdAt = document.createElement('p');
    createdAt.textContent = data.createdAt ? `Posted: ${new Date(data.createdAt).toLocaleString()}` : 'Posted: Unknown time';

    details.appendChild(username);
    details.appendChild(caption);
    details.appendChild(createdAt);

    // Add admin controls to modal
    const adminControls = document.createElement('div');
    adminControls.className = 'modal-admin-controls';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'admin-btn danger';
    deleteBtn.textContent = 'Delete Photo';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this photo?')) {
        this.deletePhoto(data.id, data.driveId);
        modal.remove();
      }
    });

    const blockBtn = document.createElement('button');
    blockBtn.className = 'admin-btn warning';
    blockBtn.textContent = 'Block User';
    blockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to block this user?')) {
        this.blockUser(data.userId, 'block');
        modal.remove();
      }
    });

    const unblockBtn = document.createElement('button');
    unblockBtn.className = 'admin-btn success';
    unblockBtn.textContent = 'Unblock User';
    unblockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to unblock this user?')) {
        this.blockUser(data.userId, 'unblock');
        modal.remove();
      }
    });

    adminControls.appendChild(deleteBtn);
    adminControls.appendChild(blockBtn);
    adminControls.appendChild(unblockBtn);
    details.appendChild(adminControls);

    content.appendChild(img);
    content.appendChild(details);
    modal.appendChild(content);

    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
  }

  updateStats() {
    const totalPhotos = this.photoList.children.length;
    const todayPhotos = totalPhotos; // Simplified - photos in current session
    document.getElementById('totalPhotos').textContent = totalPhotos;
    document.getElementById('todayPhotos').textContent = todayPhotos;
    document.getElementById('activeUsers').textContent = '0'; // No socket, so no active users count
  }

  refreshList() {
    console.log('Refreshing photo list...');
    this.showStatus('Refreshing list...', 'success');
    this.photoList.innerHTML = '';
    this.photos.clear();
    this.loadExistingPhotos();
  }

  extractDriveId(imgUrl) {
    // Extract driveId from image URL
    // Assuming URL format: /api/photos/proxy/{driveId}
    const match = imgUrl.match(/\/api\/photos\/proxy\/([^/?]+)/);
    return match ? match[1] : null;
  }

  async exportHighResImage() {
    // Placeholder for future high-res image export functionality
    console.log('High-res image export not implemented yet');
    this.showStatus('High-res export not available yet', 'error');
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    // Placeholder for text wrapping functionality
    console.log('Text wrapping not implemented yet');
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

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded, initializing AdminWall...');
  new AdminWall();
});