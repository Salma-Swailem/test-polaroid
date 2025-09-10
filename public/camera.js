function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

class CameraManager {
  constructor() {
    this.currentFilter = 'normal';
    this.capturedImage = null;
    this.currentLimit = 0;
    this.currentPhotoCount = 0;
    this.socket = io({
      reconnectionAttempts: 5,
      timeout: 10000
    });
    this.stream = null;

    if (this.initializeElements()) {
      this.bindEvents();
      this.setupSocketEvents();
      this.checkAuth();
      this.initializeCamera();
      this.fetchUserInfo();
    }
  }

  initializeElements() {
    try {
      this.video = document.querySelector('#video');
      this.snapBtn = document.querySelector('#snapBtn');
      this.snapText = document.querySelector('#snapText');
      this.snapLoading = document.querySelector('#snapLoading');
      this.uploadBtn = document.querySelector('#uploadBtn');
      this.uploadText = document.querySelector('#uploadText');
      this.uploadLoading = document.querySelector('#uploadLoading');
      this.retakeBtn = document.querySelector('#retakeBtn');
      this.previewImage = document.querySelector('#preview');
      this.previewPlaceholder = document.querySelector('#previewPlaceholder');
      this.captionInput = document.querySelector('#caption');
      this.filterOptions = document.querySelectorAll('.filter-option');
      this.cameraOverlay = document.querySelector('#cameraOverlay');
      this.shotsCount = document.querySelector('#shotsCount');
      this.shotsText = document.querySelector('#shotsText');
      this.uploadProgress = document.querySelector('#uploadProgress');
      this.progressBar = document.querySelector('#progressBar');
      this.statusMessage = document.querySelector('#status');

      if (!this.video || !this.snapBtn || !this.uploadBtn || !this.shotsCount || !this.shotsText) {
        console.error('Required elements not found!');
        this.showStatus?.('Required elements not found!', 'error');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error initializing elements:', error);
      return false;
    }
  }

  bindEvents() {
    try {
      this.eventListeners = [
        { element: this.snapBtn, event: 'click', handler: () => this.capturePhoto() },
        { element: this.retakeBtn, event: 'click', handler: () => this.retakePhoto() },
        { element: this.uploadBtn, event: 'click', handler: () => this.uploadPhoto() }
      ];

      this.eventListeners.forEach(({ element, event, handler }) => {
        if (element) element.addEventListener(event, handler);
      });

      this.filterOptions.forEach(option => {
        const handler = () => this.selectFilter(option);
        option.addEventListener('click', handler);
        this.eventListeners.push({ element: option, event: 'click', handler });
      });
      this.switchCameraBtn = document.querySelector('#switchCameraBtn');
      this.isBackCamera = false;

      if (this.switchCameraBtn) {
        const handler = () => {
          this.isBackCamera = !this.isBackCamera;
          this.initializeCamera(this.isBackCamera);
        };
        this.switchCameraBtn.addEventListener('click', handler);
        this.eventListeners.push({ element: this.switchCameraBtn, event: 'click', handler });
      } 
    } catch (error) {
      console.error('Error binding events:', error);
      this.showStatus?.('Error setting up camera controls', 'error');
    }
  }

  setupSocketEvents() {
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.showStatus?.('Failed to connect to server', 'error');
    });

    this.socket.on('disconnect', () => {
      this.showStatus?.('Disconnected from server', 'warning');
    });

    this.socket.on('connect', () => {
      this.hideStatus?.();
    });
  }

  async checkAuth() {
    try {
      const token = localStorage.getItem('jwtToken');
      if (!token) {
        window.location.href = '/login.html';
        return false;
      }
      const payload = parseJwt(token);
      if (!payload || payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('jwtToken');
        window.location.href = '/login.html';
        return false;
      }
      return true;
    } catch (error) {
      console.error('Auth check failed:', error);
      window.location.href = '/login.html';
      return false;
    }
  }

  async initializeCamera(useBackCamera = false) {
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // Stop previous stream if exists
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: useBackCamera ? { exact: "environment" } : "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      this.video.srcObject = this.stream;
      this.video.play();
    } else {
      throw new Error('Camera not supported');
    }
  } catch (error) {
    console.error('Error initializing camera:', error);
    this.showStatus?.('Failed to access camera', 'error');
    this.snapBtn.disabled = true;
  }
  }


  async fetchUserInfo() {
    try {
      if (!(await this.checkAuth())) return;

      const token = localStorage.getItem('jwtToken');
      const response = await fetch('/api/user', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.data.user) {
        const { limit, photoCount } = data.data.user;
        this.currentLimit = limit || 0;
        this.currentPhotoCount = photoCount || 0;

        const debugDiv = document.getElementById('debugPhotoCounter') ||
          Object.assign(document.createElement('div'), {
            id: 'debugPhotoCounter',
            style: 'background:#fffbe6;color:#333;padding:8px;border-radius:8px;margin:10px 0;font-size:1rem;box-shadow:0 2px 8px #ffe58f;'
          });

        // document.body.prepend(debugDiv);
        // debugDiv.textContent = `DEBUG: limit = ${this.currentLimit}, photoCount = ${this.currentPhotoCount}`;

        this.updateShotsDisplay(this.currentLimit, this.currentPhotoCount);

        this.uploadBtn.disabled = this.currentLimit <= 0;
        this.snapBtn.disabled = this.currentLimit <= 0;

        if (this.currentLimit <= 0) {
          this.showStatus?.('You have reached your photo upload limit.', 'error');
        }
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      this.showStatus?.('Failed to load user data', 'error');
    }
  }

  selectFilter(selectedOption) {
    try {
      this.filterOptions.forEach(option => option.classList.remove('active'));
      selectedOption.classList.add('active');
      this.currentFilter = selectedOption.dataset.filter || 'normal';
      this.applyFilter();
    } catch (error) {
      console.error('Error selecting filter:', error);
      this.showStatus?.('Error applying filter', 'error');
    }
  }

  applyFilter() {
    const filters = {
      normal: 'none',
      vintage: 'sepia(0.8) contrast(1.2) brightness(0.9)',
      blackwhite: 'grayscale(1) contrast(1.2)',
      sepia: 'sepia(0.8)',
      blur: 'blur(2px)'
    };
    if (this.video) {
      this.video.style.filter = filters[this.currentFilter] || 'none';
    }
  }

  capturePhoto() {
    if (this.currentLimit <= 0) {
      this.showStatus?.('No shots remaining!', 'error');
      this.snapBtn?.classList.add('shake');
      setTimeout(() => this.snapBtn?.classList.remove('shake'), 500);
      return;
    }

    try {
      this.setLoading(this.snapBtn, this.snapText, this.snapLoading, true);
      this.snapBtn.disabled = true;

      const canvas = document.createElement('canvas');
      canvas.width = this.video.videoWidth;
      canvas.height = this.video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.filter = this.video.style.filter || 'none';
      ctx.drawImage(this.video, 0, 0);

      canvas.toBlob((blob) => {
        this.capturedImage = blob;
        this.showPreview(canvas.toDataURL('image/jpeg'));
        this.setLoading(this.snapBtn, this.snapText, this.snapLoading, false);
        this.snapBtn.disabled = true;
        this.snapBtn.textContent = '📸 Photo Captured!';
        if (this.retakeBtn) this.retakeBtn.style.display = 'block';
        if (this.uploadBtn) this.uploadBtn.style.display = 'block';
      }, 'image/jpeg', 0.9);
    } catch (error) {
      console.error('Error capturing photo:', error);
      this.showStatus?.('Error capturing photo. Please try again.', 'error');
      this.setLoading(this.snapBtn, this.snapText, this.snapLoading, false);
      this.snapBtn.disabled = false;
    }
  }

  showPreview(dataUrl) {
    if (this.previewImage && this.previewPlaceholder) {
      this.previewImage.src = dataUrl;
      this.previewImage.style.display = 'block';
      this.previewPlaceholder.style.display = 'none';
    }
  }

  retakePhoto() {
    try {
      this.capturedImage = null;
      if (this.previewImage) this.previewImage.style.display = 'none';
      if (this.previewPlaceholder) this.previewPlaceholder.style.display = 'flex';
      if (this.retakeBtn) this.retakeBtn.style.display = 'none';
      if (this.uploadBtn) this.uploadBtn.style.display = 'none';
      if (this.snapBtn) {
        this.snapBtn.disabled = false;
        this.snapBtn.textContent = '📸 Take Photo';
      }
      this.hideStatus?.();
      this.hideProgress?.();
    } catch (error) {
      console.error('Error retaking photo:', error);
      this.showStatus?.('Error resetting camera', 'error');
    }
  }

  async uploadPhoto() {
    if (!this.capturedImage) {
      this.showStatus?.('No photo to upload!', 'error');
      return;
    }

    try {
      this.setLoading(this.uploadBtn, this.uploadText, this.uploadLoading, true);
      this.uploadBtn.disabled = true;
      this.showProgress?.();

      const formData = new FormData();
      formData.append('file', this.capturedImage, `photo_${Date.now()}.jpg`);
      formData.append('caption', this.captionInput?.value.trim() || '');

      const token = localStorage.getItem('jwtToken');
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        this.showStatus?.('Photo uploaded successfully! Broadcasting to wall...', 'success');
        this.progressBar.style.width = '100%';
        this.socket.emit('new-photo', {
          img: `/api/photos/proxy/${data.photo.driveId}`,
          caption: data.photo.caption
        });
        await this.fetchUserInfo();
        setTimeout(() => {
          this.retakePhoto();
          if (this.captionInput) this.captionInput.value = '';
        }, 2000);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      this.showStatus?.(`Upload failed: ${error.message}`, 'error');
    } finally {
      this.setLoading(this.uploadBtn, this.uploadText, this.uploadLoading, false);
      this.uploadBtn.disabled = false;
      this.hideProgress?.();
    }
  }

  updateShotsDisplay(limit, photoCount) {
    if (this.shotsCount && this.shotsText) {
      this.shotsCount.textContent = limit;
      this.shotsText.textContent = limit <= 0 ? 'No shots left' : `Limit left: ${limit}, Uploaded: ${photoCount}`;
      this.shotsCount.style.color = limit <= 0 ? '#dc3545' : '';
    }
  }

  setLoading(button, textElement, loadingElement, isLoading) {
    if (button && textElement && loadingElement) {
      textElement.style.display = isLoading ? 'none' : 'inline';
      loadingElement.style.display = isLoading ? 'inline-block' : 'none';
      button.disabled = isLoading;
    }
  }

  showProgress() {
    if (this.uploadProgress && this.progressBar) {
      this.uploadProgress.style.display = 'block';
      this.progressBar.style.width = '0%';
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        this.progressBar.style.width = progress + '%';
        if (progress >= 90) clearInterval(interval);
      }, 200);
    }
  }

  hideProgress() {
    if (this.uploadProgress && this.progressBar) {
      this.uploadProgress.style.display = 'none';
      this.progressBar.style.width = '0%';
    }
  }

  showStatus(message, type = 'info') {
    if (this.statusMessage) {
      this.statusMessage.textContent = message;
      this.statusMessage.className = `status-message ${type}`;
      this.statusMessage.style.display = 'block';
    }
  }

  hideStatus() {
    if (this.statusMessage) {
      this.statusMessage.style.display = 'none';
    }
  }

  cleanup() {
    try {
      // Stop camera stream
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
      // Remove event listeners
      this.eventListeners?.forEach(({ element, event, handler }) => {
        if (element) element.removeEventListener(event, handler);
      });
      // Disconnect socket
      if (this.socket) {
        this.socket.disconnect();
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

function logout() {
  try {
    localStorage.removeItem('jwtToken');
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Logout error:', error);
    window.location.href = '/login.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const cameraManager = new CameraManager();
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => logout());
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    cameraManager.cleanup();
  });
});