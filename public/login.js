class LoginManager {
  constructor() {
    this.userEmail = "";
    this.otpAttempts = 0;
    this.maxOtpAttempts = 3;
    this.initializeElements();
    this.bindEvents();
  }

  initializeElements() {
    this.emailInput = document.getElementById('email');
    this.sendOtpBtn = document.getElementById('sendOtpBtn');
    this.verifyOtpBtn = document.getElementById('verifyOtpBtn');
    this.resendOtpBtn = document.getElementById('resendOtpBtn');
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

    this.setLoading(this.sendOtpBtn, this.sendOtpText, this.sendOtpLoading, true);
    this.sendOtpBtn.disabled = true;

    try {
      const response = await fetch('/api/auth/register-or-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.userEmail })
      });

      const data = await response.json();

      if (response.ok && data.status === 'OK') {
        this.showStatus('OTP sent! Check your email.', 'success');
        this.otpSection.style.display = 'block';
        this.emailInput.disabled = true;
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
      this.setLoading(this.sendOtpBtn, this.sendOtpText, this.sendOtpLoading, false);
      this.sendOtpBtn.disabled = false;
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
    this.verifyOtpBtn.disabled = true;

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
        this.showStatus('Login successful! Redirecting...', 'success');

        // Clear OTP inputs
        this.otpInputs.forEach(input => input.value = '');

        setTimeout(() => {
          window.location.href = '/camera.html';
        }, 1500);
      } else {
        this.showStatus(data.error || 'OTP verification failed', 'error');

        if (this.otpAttempts >= this.maxOtpAttempts) {
          this.showStatus('Too many failed attempts. Please request a new OTP.', 'error');
          this.otpSection.style.display = 'none';
          this.emailInput.disabled = false;
          this.resendOtpBtn.style.display = 'none';
          this.otpAttempts = 0;
        }
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      this.showStatus('Network error. Please try again.', 'error');
    } finally {
      this.setLoading(this.verifyOtpBtn, this.verifyOtpText, this.verifyOtpLoading, false);
      this.verifyOtpBtn.disabled = false;
    }
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
      loadingElement.style.display = 'inline-block';
      button.disabled = true;
    } else {
      textElement.style.display = 'inline';
      loadingElement.style.display = 'none';
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
  new LoginManager();
  // Show logout button if logged in
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    if (localStorage.getItem('jwtToken')) {
      logoutBtn.style.display = 'block';
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('jwtToken');
        window.location.href = '/login.html';
      });
    } else {
      logoutBtn.style.display = 'none';
    }
  }
});