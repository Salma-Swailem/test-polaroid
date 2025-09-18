class NavigationManager {
  constructor() {
    this.currentPage = this.getCurrentPage();
    this.token = localStorage.getItem('jwtToken');
    console.log('Current Page:', this.currentPage, 'Token present:', !!this.token);
    this.isExpanded = false;
    this.userRole = null;
    this.navContainer = null;
    this.initializeNavigation();
  }

  getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('camera')) return 'camera';
    if (path.includes('login')) return 'login';
    if (path.includes('qr')) return 'qr';
    if (path.includes('stage')) return 'stage';
    if (path.includes('admin')) return 'admin';
    if (path.includes('index') || path === '/' || path.includes('gallery')) return 'wall';
    return 'wall';
  }

  async initializeNavigation() {
    if (this.token) {
      await this.fetchUserRole();
    }
    this.addGlobalNav();
    this.setupAccessibility();
  }

  // Helper method to decode JWT token
  decodeJWT(token) {
    try {
      const base64Url = token.split('.')[1]; // Get payload part
      if (!base64Url) {
        throw new Error('Invalid JWT token: missing payload');
      }
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT token:', error);
      return null;
    }
  }

  async fetchUserRole() {
    if (!this.token) {
      this.userRole = 'user';
      return;
    }
    const payload = this.decodeJWT(this.token);
    if (payload && payload.role) {
      this.userRole = payload.role;
    } else {
      this.userRole = 'user';
      console.error('Failed to extract role from JWT token');
    }
  }

  addGlobalNav() {
    this.navContainer = document.createElement('nav');
    this.navContainer.className = 'global-nav';
    this.navContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #0ff0fc, #00ff7f, #8a2be2, #00ff00);
      background-size: 400% 400%;
      animation: aurora 15s ease infinite;
      backdrop-filter: blur(10px);
      border-radius: 50%;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
    `;

    const toggleButton = document.createElement('button');
    toggleButton.className = 'nav-toggle';
    toggleButton.innerHTML = '☰';
    toggleButton.setAttribute('aria-label', 'Toggle navigation menu');
    toggleButton.style.cssText = `
      background: none;
      border: none;
      font-size: 1.8rem;
      color: white;
      cursor: pointer;
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    `;

    const navItems = document.createElement('div');
    navItems.className = 'nav-items';
    navItems.style.cssText = `
      position: absolute;
      top: 70px;
      right: 0;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(5px);
      border-radius: 10px;
      padding: 10px;
      display: none;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
      transform: scale(0);
      transform-origin: top right;
      transition: transform 0.3s ease, opacity 0.3s ease;
      opacity: 0;
    `;

    const pages = this.getNavPages();

    pages.forEach(page => {
      const link = document.createElement('a');
      link.href = page.url;
      link.className = `nav-link ${page.active ? 'active' : ''}`;
      link.innerHTML = page.icon;
      link.title = page.name.charAt(0).toUpperCase() + page.name.slice(1);
      link.setAttribute('aria-label', `Navigate to ${page.name}`);
      link.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        text-decoration: none;
        font-size: 1.2rem;
        transition: all 0.3s ease;
        background: transparent;
        color: white;
        backdrop-filter: none;
      `;

      link.addEventListener('mouseenter', () => {
        if (!page.active) {
          link.style.background = 'rgba(255, 255, 255, 0.2)';
          link.style.transform = 'scale(1.2)';
          link.style.color = '#ffffff';
          link.style.textShadow = '0 0 10px rgba(255, 255, 255, 0.5)';
        }
      });

      link.addEventListener('mouseleave', () => {
        if (!page.active) {
          link.style.background = 'transparent';
          link.style.transform = 'scale(1)';
          link.style.color = 'white';
          link.style.textShadow = 'none';
        }
      });

      navItems.appendChild(link);
    });

    toggleButton.addEventListener('click', () => {
      console.log('Toggle clicked, current isExpanded:', this.isExpanded);
      this.toggleNav();
    });

    this.navContainer.appendChild(toggleButton);
    this.navContainer.appendChild(navItems);
    document.body.appendChild(this.navContainer);
  }

  getNavPages() {
    const basePages = [
      { name: 'wall', icon: '🏠', url: '/index.html', active: this.currentPage === 'wall' },
      { name: 'camera', icon: '📷', url: '/camera.html', active: this.currentPage === 'camera' },
      { name: 'qr', icon: '🔳', url: '/qr.html', active: this.currentPage === 'qr' },
      { name: 'login', icon: '🔐', url: '/login.html', active: this.currentPage === 'login' }
    ];

    if (!this.token) {
      return [{ name: 'login', icon: '🔐', url: '/login.html', active: this.currentPage === 'login' }];
    }

    if (this.userRole === 'admin') {
      basePages.push(
        { name: 'stage', icon: '🎤', url: '/stage.html', active: this.currentPage === 'stage' },
        { name: 'admin', icon: '🛠️', url: '/admin.html', active: this.currentPage === 'admin' }
      );
    }

    return basePages;
  }

  toggleNav() {
    this.isExpanded = !this.isExpanded;
    const navItems = this.navContainer.querySelector('.nav-items');
    const toggleButton = this.navContainer.querySelector('.nav-toggle');

    console.log('Toggling nav, isExpanded:', this.isExpanded);

    if (this.isExpanded) {
      navItems.style.display = 'flex';
      setTimeout(() => {
        navItems.style.opacity = '1';
        navItems.style.transform = 'scale(1)';
      }, 10);
      toggleButton.innerHTML = '✕';
      toggleButton.setAttribute('aria-label', 'Close navigation menu');
      this.navContainer.style.borderRadius = '15px 15px 50% 50%';
      this.navContainer.style.width = 'auto';
      this.navContainer.style.padding = '10px';
    } else {
      navItems.style.opacity = '0';
      navItems.style.transform = 'scale(0)';
      setTimeout(() => {
        navItems.style.display = 'none';
      }, 300);
      toggleButton.innerHTML = '☰';
      toggleButton.setAttribute('aria-label', 'Open navigation menu');
      this.navContainer.style.borderRadius = '50%';
      this.navContainer.style.width = '60px';
      this.navContainer.style.padding = '0';
    }
  }

  setupAccessibility() {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes aurora {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .nav-link:focus {
        outline: 2px solid #ffffff;
        outline-offset: 2px;
      }
      .nav-toggle:focus {
        outline: 2px solid #ffffff;
        outline-offset: 2px;
      }
      .global-nav.expanded {
        width: auto;
        padding: 10px;
      }
      .nav-link.active {
        background: transparent;
        color: white;
        text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
      }
      .nav-link {
        background: transparent;
        color: white;
      }
    `;
    document.head.appendChild(style);
  }

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

    setTimeout(() => notification.style.transform = 'translateX(0)', 100);
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

document.addEventListener('DOMContentLoaded', () => {
  new NavigationManager();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NavigationManager;
}