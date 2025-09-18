class LoginManager {
  constructor() {
    this.userEmail = "";
    this.otpAttempts = 0;
    this.maxOtpAttempts = 3;
    this.isLoggedIn = false;
    this.initializeElements();
    this.bindEvents();
  }

  initializeElements() {
    this.emailInput = document.getElementById('email');
    this.sendOtpBtn = document.getElementById('sendOtpBtn');
    this.verifyOtpBtn = document.getElementById('verifyOtpBtn');
    this.resendOtpBtn = document.getElementById('resendOtpBtn');
    this.logoutBtn = document.getElementById('logoutBtn');
    this.otpSection = document.getElementById('otpSection');
    this.status = document.getElementById('status');
    this.otpInputs = document.querySelectorAll('.otp-digit');

    // Loading states
    this.sendOtpText = document.getElementById('sendOtpText');
    this.sendOtpLoading = document.getElementById('sendOtpLoading');
    this.verifyOtpText = document.getElementById('verifyOtpText');
    this.verifyOtpLoading = document.getElementById('verifyOtpLoading');
  }

  bindEvents() {
    this.sendOtpBtn.addEventListener('click', () => this.sendOtp());
    this.verifyOtpBtn.addEventListener('click', () => this.verifyOtp());
    this.resendOtpBtn.addEventListener('click', () => this.sendOtp());
    this.logoutBtn.addEventListener('click', () => this.logout());

    // OTP input handling
    this.otpInputs.forEach((input, index) => {
      input.addEventListener('input', (e) => this.handleOtpInput(e, index));
      input.addEventListener('keydown', (e) => this.handleOtpKeydown(e, index));
      input.addEventListener('paste', (e) => this.handleOtpPaste(e));
    });

    // Enter key on email input
    this.emailInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendOtp();
    });
  }

  async sendOtp() {
    this.userEmail = this.emailInput.value.trim();
    if (!this.userEmail) {
      this.showStatus('Please enter your email', 'error');
      this.emailInput.focus();
      return;
    }

    if (!this.isValidEmail(this.userEmail)) {
      this.showStatus('Please enter a valid email address', 'error');
      this.emailInput.focus();
      return;
    }

    // Set loading state
    this.setLoading(this.sendOtpBtn, this.sendOtpText, this.sendOtpLoading, true);

    try {
      const response = await fetch('/api/auth/register-or-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.userEmail })
      });

      const data = await response.json();
      console.log('API Response:', data); // Debug log to inspect response

      if (response.ok && data.status === 'OK') {
        // Reset OTP attempts and clear inputs
        this.otpAttempts = 0;
        this.otpInputs.forEach(input => input.value = '');
        this.showStatus('OTP sent! Check your email.', 'success');

        // Hide email section and show OTP section
        this.emailInput.parentElement.classList.add('hidden');
        this.sendOtpBtn.classList.add('hidden');
        this.otpSection.classList.remove('hidden');
        this.otpSection.style.display = 'block';
        this.resendOtpBtn.classList.remove('hidden');
        this.resendOtpBtn.style.display = 'block';
        this.otpInputs[0].focus();

        // Start resend countdown
        this.startResendCountdown();
      } else {
        this.showStatus(data.error || 'Failed to send OTP', 'error');
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      this.showStatus('Network error. Please try again.', 'error');
    } finally {
      // Always reset loading state
      this.setLoading(this.sendOtpBtn, this.sendOtpText, this.sendOtpLoading, false);
    }
  }

  async verifyOtp() {
    const otp = Array.from(this.otpInputs).map(input => input.value).join('');

    if (otp.length !== 6) {
      this.showStatus('Please enter the complete 6-digit OTP', 'error');
      return;
    }

    this.otpAttempts++;
    this.setLoading(this.verifyOtpBtn, this.verifyOtpText, this.verifyOtpLoading, true);

    try {
      const response = await fetch('/api/verify/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.userEmail, otp })
      });

      const data = await response.json();

      if (response.ok && data.status === 'OK' && data.data.token) {
        const token = data.data.token;
        localStorage.setItem('jwtToken', token);
        this.isLoggedIn = true;
        this.showStatus('Login successful! Redirecting...', 'success');

        // Show logout button after successful login
        this.logoutBtn.classList.remove('hidden');
        this.logoutBtn.style.display = 'block';

        // Clear OTP inputs
        this.otpInputs.forEach(input => input.value = '');

        setTimeout(() => {
          window.location.href = '/camera.html';
        }, 1500);
      } else {
        this.showStatus(data.error || 'OTP verification failed', 'error');

        if (this.otpAttempts >= this.maxOtpAttempts) {
          this.showStatus('Too many failed attempts. Please request a new OTP.', 'error');
          this.resetToEmail();
        }
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      this.showStatus('Network error. Please try again.', 'error');
    } finally {
      this.setLoading(this.verifyOtpBtn, this.verifyOtpText, this.verifyOtpLoading, false);
    }
  }

  logout() {
    localStorage.removeItem('jwtToken');
    this.isLoggedIn = false;
    this.showStatus('Logged out successfully', 'success');
    this.resetToEmail();
  }

  resetToEmail() {
    // Reset UI to show email section
    this.emailInput.parentElement.classList.remove('hidden');
    this.sendOtpBtn.classList.remove('hidden');
    this.otpSection.classList.add('hidden');
    this.otpSection.style.display = 'none';
    this.emailInput.disabled = false;
    this.emailInput.value = '';
    this.otpInputs.forEach(input => input.value = '');
    this.resendOtpBtn.classList.add('hidden');
    this.resendOtpBtn.style.display = 'none';
    this.logoutBtn.classList.add('hidden');
    this.logoutBtn.style.display = 'none';
    this.otpAttempts = 0;
    this.emailInput.focus();
  }

  handleOtpInput(e, index) {
    const input = e.target;
    const value = input.value;

    if (value.length === 1 && index < 5) {
      this.otpInputs[index + 1].focus();
    }

    // Auto-verify when all digits are entered
    if (index === 5 && value.length === 1) {
      const otp = Array.from(this.otpInputs).map(input => input.value).join('');
      if (otp.length === 6) {
        setTimeout(() => this.verifyOtp(), 300);
      }
    }
  }

  handleOtpKeydown(e, index) {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      this.otpInputs[index - 1].focus();
    }
  }

  handleOtpPaste(e) {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);

    this.otpInputs.forEach((input, index) => {
      input.value = digits[index] || '';
    });

    if (digits.length === 6) {
      setTimeout(() => this.verifyOtp(), 300);
    }
  }

  startResendCountdown() {
    let countdown = 60;
    this.resendOtpBtn.disabled = true;
    this.resendOtpBtn.textContent = `Resend OTP (${countdown}s)`;

    const timer = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        this.resendOtpBtn.textContent = `Resend OTP (${countdown}s)`;
      } else {
        clearInterval(timer);
        this.resendOtpBtn.disabled = false;
        this.resendOtpBtn.textContent = 'Resend OTP';
      }
    }, 1000);
  }

  setLoading(button, textElement, loadingElement, isLoading) {
    if (isLoading) {
      textElement.style.display = 'none';
      loadingElement.classList.add('active');
      button.disabled = true;
    } else {
      textElement.style.display = 'inline';
      loadingElement.classList.remove('active');
      button.disabled = false;
    }
  }

  showStatus(message, type = 'info') {
    this.status.textContent = message;
    this.status.className = `status ${type}`;

    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        this.status.textContent = '';
        this.status.className = 'status';
      }, 5000);
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Initialize the login manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Auto-redirect if already logged in
  if (localStorage.getItem('jwtToken')) {
    const loginManager = new LoginManager();
    loginManager.isLoggedIn = true;
    loginManager.logoutBtn.classList.remove('hidden');
    loginManager.logoutBtn.style.display = 'block';
    // Optionally hide login form if already logged in
    loginManager.emailInput.parentElement.classList.add('hidden');
    loginManager.sendOtpBtn.classList.add('hidden');
    loginManager.otpSection.classList.add('hidden');
    return;
  }

  new LoginManager();
});