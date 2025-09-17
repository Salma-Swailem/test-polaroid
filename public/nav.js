// Shared Navigation Component for Polaroid Wall
class NavigationManager {
  constructor() {
    this.currentPage = this.getCurrentPage();
    this.token = localStorage.getItem('jwtToken');
    this.initializeNavigation();
    this.setupAccessibility();
  }

  getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('camera')) return 'camera';
    if (path.includes('login')) return 'login';
    if (path.includes('qr')) return 'qr';
    if (path.includes('stage')) return 'stage';
    if (path.includes('index') || path === '/' || path.includes('gallery')) return 'wall';
    return 'wall';
  }

  initializeNavigation() {
    // Add navigation to pages that don't have it
    if (this.currentPage === 'wall') {
      this.addWallNavigation();
    } else if (this.currentPage === 'camera') {
      this.addCameraNavigation();
    } else if (this.currentPage === 'login') {
      this.addLoginNavigation();
    }

    // Add global navigation bar
    this.addGlobalNav();

  }

  addGlobalNav() {
    const nav = document.createElement('nav');
    nav.className = 'global-nav';
    nav.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 25px;
      padding: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      display: flex;
      gap: 5px;
    `;

    const pages = [
      { name: 'wall', icon: '🏠', url: '/index.html', active: this.currentPage === 'wall' },
      { name: 'camera', icon: '📷', url: '/camera.html', active: this.currentPage === 'camera' },
      { name: 'qr', icon: '🔳', url: '/qr.html', active: this.currentPage === 'qr' },
      { name: 'stage', icon: '🎤', url: '/stage.html', active: this.currentPage === 'stage' },

      { name: 'login', icon: '🔐', url: '/login.html', active: this.currentPage === 'login' }
    ];

    pages.forEach(page => {
      const link = document.createElement('a');
      link.href = page.url;
      link.className = `nav-link ${page.active ? 'active' : ''}`;
      link.innerHTML = page.icon;
      link.title = page.name.charAt(0).toUpperCase() + page.name.slice(1);
      link.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        text-decoration: none;
        font-size: 1.2rem;
        transition: all 0.3s ease;
        background: ${page.active ? '#667eea' : 'transparent'};
        color: ${page.active ? 'white' : '#666'};
      `;

      link.addEventListener('mouseenter', () => {
        if (!page.active) {
          link.style.background = '#f0f0f0';
          link.style.transform = 'scale(1.1)';
        }
      });

      link.addEventListener('mouseleave', () => {
        if (!page.active) {
          link.style.background = 'transparent';
          link.style.transform = 'scale(1)';
        }
      });

      nav.appendChild(link);
    });

    document.body.appendChild(nav);
  }

  setupAccessibility() {
    // Add focus style for nav links
    const style = document.createElement('style');
    style.innerHTML = `
      .nav-link:focus {
        outline: 2px solid #764ba2;
        outline-offset: 2px;
      }
      .global-nav {
        font-size: 1.5rem;
      }
      .nav-link.active {
        background: #764ba2;
        color: #fff;
        border-radius: 15px;
        padding: 4px 12px;
        box-shadow: 0 2px 8px rgba(118,75,162,0.15);
      }
      .nav-link {
        text-decoration: none;
        color: #333;
        padding: 4px 12px;
        border-radius: 15px;
        transition: background 0.2s, color 0.2s;
      }
      .nav-link:hover {
        background: #e1e5e9;
        color: #764ba2;
      }
    `;
    document.head.appendChild(style);
  }



  addQRNavigation() {
    // Optionally add QR-specific nav or actions
  }

  addStageNavigation() {
    // Optionally add stage-specific nav or actions
  }

  addWallNavigation() {
    // Wall page already has navigation
  }

  addCameraNavigation() {
    // Camera page already has navigation
  }

  addLoginNavigation() {
    // Login page already has navigation
  }

  // Utility methods
  static checkAuth() {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  }

  static logout() {
    localStorage.removeItem('jwtToken');
    window.location.href = '/login.html';
  }

  static showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `global-notification ${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 15px 20px;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      z-index: 3000;
      transform: translateX(400px);
      transition: transform 0.3s ease;
      max-width: 300px;
      border-left: 4px solid ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
    `;

    const title = document.createElement('div');
    title.style.cssText = 'font-weight: 600; margin-bottom: 5px; color: #333;';
    title.textContent = type.charAt(0).toUpperCase() + type.slice(1);

    const msg = document.createElement('div');
    msg.style.cssText = 'color: #666; font-size: 0.9rem;';
    msg.textContent = message;

    notification.appendChild(title);
    notification.appendChild(msg);
    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => notification.style.transform = 'translateX(0)', 100);

    // Hide and remove
    setTimeout(() => {
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  static addLoadingIndicator() {
    const loading = document.createElement('div');
    loading.id = 'globalLoading';
    loading.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 50px;
      height: 50px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    `;

    const text = document.createElement('p');
    text.textContent = 'Loading...';
    text.style.cssText = 'color: white; margin-top: 20px; font-size: 1.1rem;';

    const container = document.createElement('div');
    container.style.cssText = 'text-align: center;';
    container.appendChild(spinner);
    container.appendChild(text);

    loading.appendChild(container);
    document.body.appendChild(loading);

    // Add spin animation if not exists
    if (!document.querySelector('#globalSpinStyle')) {
      const style = document.createElement('style');
      style.id = 'globalSpinStyle';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  static hideLoadingIndicator() {
    const loading = document.getElementById('globalLoading');
    if (loading) {
      loading.remove();
    }
  }
}

// Auto-initialize navigation on all pages
document.addEventListener('DOMContentLoaded', () => {
  new NavigationManager();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NavigationManager;
}
