class FeedManager {
  constructor() {
    this.followingPhotos = [];
    this.suggestedUsers = [];
    this.currentPhotoModal = null;

    this.initializeElements();
    this.bindEvents();
    this.checkAuth();
  }

  initializeElements() {
    // Social feed elements
    this.socialFeed = document.getElementById('socialFeed');
    this.socialFeedLoading = document.getElementById('socialFeedLoading');
    this.socialFeedEmpty = document.getElementById('socialFeedEmpty');

    this.suggestedUsersGrid = document.getElementById('suggestedUsers');
    this.suggestedUsersLoading = document.getElementById('suggestedUsersLoading');
    this.suggestedUsersSection = document.getElementById('suggestedUsersSection');

    this.feedCount = document.getElementById('feedCount');
    this.statusMessage = document.getElementById('statusMessage');

    // Follow by email elements
    this.followEmailInput = document.getElementById('followEmailInput');
    this.followEmailBtn = document.getElementById('followEmailBtn');
    this.followEmailStatus = document.getElementById('followEmailStatus');
    this.followingList = document.getElementById('followingList');
    this.followingListLoading = document.getElementById('followingListLoading');
    this.followingListEmpty = document.getElementById('followingListEmpty');

    this.photoModal = document.getElementById('photoModal');
    this.modalImage = document.getElementById('modalImage');
    this.modalCaption = document.getElementById('modalCaption');
    this.modalUser = document.getElementById('modalUser');
    this.modalLikeBtn = document.getElementById('modalLikeBtn');
    this.modalLikeCount = document.getElementById('modalLikeCount');
  }

  bindEvents() {
    // Close modal
    document.querySelector('.close').addEventListener('click', () => {
      this.closeModal();
    });

    this.photoModal.addEventListener('click', (e) => {
      if (e.target === this.photoModal) {
        this.closeModal();
      }
    });

    // Show suggested users
    document.getElementById('findPeopleBtn')?.addEventListener('click', () => {
      this.loadSuggestedUsers();
      this.suggestedUsersSection.style.display = 'block';
    });

    // Modal like button
    this.modalLikeBtn.addEventListener('click', () => {
      if (this.currentPhotoModal) {
        this.toggleLike(this.currentPhotoModal.id);
      }
    });

    // Follow by email events
    this.followEmailBtn.addEventListener('click', () => {
      this.followByEmail();
    });

    this.followEmailInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.followByEmail();
      }
    });
  }

  async checkAuth() {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
      this.showStatus('Please log in to view your feed', 'error');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 2000);
      return false;
    }

    // Load social feed (combines user photos and following photos)
    this.loadSocialFeed();
    this.loadFollowingList();
    return true;
  }

  getAuthHeaders() {
    const token = localStorage.getItem('jwtToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async loadSocialFeed() {
    try {
      // Load both user's photos and following photos for the social feed
      const [userResponse, feedResponse] = await Promise.all([
        fetch('/api/photos', { headers: this.getAuthHeaders() }),
        fetch('/api/feed?limit=20', { headers: this.getAuthHeaders() })
      ]);

      const userData = await userResponse.json();
      const feedData = await feedResponse.json();

      let allPosts = [];

      // Add user's own photos
      if (userData.success && userData.photos) {
        const currentUser = await this.getCurrentUser();
        if (currentUser) {
          const userPosts = userData.photos
            .filter(photo => photo.userId === currentUser.id)
            .map(photo => ({
              ...photo,
              username: currentUser.email,
              isOwn: true,
              user: { email: currentUser.email }
            }));
          allPosts.push(...userPosts);
        }
      }

      // Add following photos
      if (feedData.success && feedData.photos) {
        allPosts.push(...feedData.photos);
      }

      // Sort by creation date (newest first)
      allPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      this.renderSocialFeed(allPosts);
      this.socialFeedLoading.style.display = 'none';
    } catch (error) {
      console.error('Error loading social feed:', error);
      this.socialFeedLoading.style.display = 'none';
      this.showStatus('Error loading social feed', 'error');
    }
  }

  renderSocialFeed(posts) {
    this.socialFeed.innerHTML = '';

    if (posts.length === 0) {
      this.socialFeedEmpty.style.display = 'block';
      return;
    }

    this.socialFeedEmpty.style.display = 'none';

    posts.forEach(post => {
      const postElement = this.createSocialPost(post);
      this.socialFeed.appendChild(postElement);
    });

    this.updateFeedCount(posts.length);
  }

  createSocialPost(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'social-post';

    // Post header
    const header = document.createElement('div');
    header.className = 'post-header';

    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.textContent = (post.user?.email || post.username || 'U')[0].toUpperCase();

    const userInfo = document.createElement('div');
    userInfo.className = 'post-user-info';

    const username = document.createElement('div');
    username.className = 'post-username';
    username.textContent = post.user?.email || post.username || 'Unknown User';

    const time = document.createElement('div');
    time.className = 'post-time';
    time.textContent = this.formatDate(post.createdAt);

    userInfo.appendChild(username);
    userInfo.appendChild(time);
    header.appendChild(avatar);
    header.appendChild(userInfo);

    // Post image
    const imageContainer = document.createElement('div');
    imageContainer.className = 'post-image-container';

    const img = document.createElement('img');
    img.className = 'post-image';
    img.src = `/api/photos/proxy/${post.driveId}`;
    img.alt = post.caption || 'Photo';
    img.loading = 'lazy';

    imageContainer.appendChild(img);

    // Post content
    const content = document.createElement('div');
    content.className = 'post-content';

    if (post.caption) {
      const caption = document.createElement('div');
      caption.className = 'post-caption';
      caption.textContent = post.caption;
      content.appendChild(caption);
    }

    // Post actions
    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const likeBtn = document.createElement('button');
    likeBtn.className = `action-btn ${post.isLiked ? 'liked' : ''}`;
    likeBtn.innerHTML = `${post.isLiked ? '❤️' : '🤍'} <span>${post.likes || 0}</span>`;
    likeBtn.addEventListener('click', () => {
      this.toggleLike(post.id);
    });

    actions.appendChild(likeBtn);
    content.appendChild(actions);

    // Open modal on image click
    imageContainer.addEventListener('click', () => {
      this.openModal(post);
    });

    postDiv.appendChild(header);
    postDiv.appendChild(imageContainer);
    postDiv.appendChild(content);

    return postDiv;
  }

  async getCurrentUser() {
    try {
      const response = await fetch('/api/user', {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch user info');

      const data = await response.json();
      return data.data.user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  updateFeedCount(count) {
    const feedTitle = document.querySelector('.feed-title');
    if (feedTitle) {
      feedTitle.textContent = `Social Feed (${count})`;
    }
  }

  async toggleLike(photoId) {
    try {
      const response = await fetch(`/api/photos/${photoId}/like`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (response.ok) {
        // Reload the social feed to update like counts
        await this.loadSocialFeed();
        this.showStatus('Photo liked!', 'success');
      } else {
        this.showStatus('Error updating like', 'error');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      this.showStatus('Error updating like', 'error');
    }
  }

  async loadFollowingPhotos() {
    try {
      const response = await fetch('/api/feed?limit=20', {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch feed');

      const data = await response.json();

      if (data.success && data.photos) {
        this.followingPhotos = data.photos;
        this.renderFollowingPhotos();
      }

      this.followingPhotosLoading.style.display = 'none';
    } catch (error) {
      console.error('Error loading following photos:', error);
      this.followingPhotosLoading.style.display = 'none';
      this.showStatus('Error loading feed', 'error');
    }
  }

  async loadSuggestedUsers() {
    try {
      this.suggestedUsersLoading.style.display = 'block';

      const response = await fetch('/api/users/suggested?limit=5', {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch suggested users');

      const data = await response.json();

      if (data.success && data.data) {
        this.suggestedUsers = data.data;
        this.renderSuggestedUsers();
      }

      this.suggestedUsersLoading.style.display = 'none';
    } catch (error) {
      console.error('Error loading suggested users:', error);
      this.suggestedUsersLoading.style.display = 'none';
      this.showStatus('Error loading suggestions', 'error');
    }
  }



  renderFollowingPhotos() {
    this.followingPhotosGrid.innerHTML = '';

    if (this.followingPhotos.length === 0) {
      this.followingPhotosEmpty.style.display = 'block';
      return;
    }

    this.followingPhotosEmpty.style.display = 'none';

    this.followingPhotos.forEach(photo => {
      const photoCard = this.createPhotoCard(photo, false);
      this.followingPhotosGrid.appendChild(photoCard);
    });

    this.updateFeedCount();
  }

  renderSuggestedUsers() {
    this.suggestedUsersGrid.innerHTML = '';

    this.suggestedUsers.forEach(user => {
      const userCard = this.createUserCard(user);
      this.suggestedUsersGrid.appendChild(userCard);
    });
  }

  createPhotoCard(photo, isUserPhoto = false) {
    const card = document.createElement('div');
    card.className = 'photo-card';

    const img = document.createElement('img');
    img.src = `/api/photos/proxy/${photo.driveId}`;
    img.alt = photo.caption || 'Photo';
    img.loading = 'lazy';

    const info = document.createElement('div');
    info.className = 'photo-info';

    const caption = document.createElement('div');
    caption.className = 'photo-caption';
    caption.textContent = photo.caption || 'No caption';

    const meta = document.createElement('div');
    meta.className = 'photo-meta';

    const user = document.createElement('span');
    user.className = 'photo-user';
    user.textContent = photo.username || 'Unknown user';

    const date = document.createElement('span');
    date.className = 'photo-date';
    date.textContent = this.formatDate(photo.createdAt);

    meta.appendChild(user);
    meta.appendChild(date);

    const actions = document.createElement('div');
    actions.className = 'photo-actions';

    const likeBtn = document.createElement('button');
    likeBtn.className = `like-btn ${photo.isLiked ? 'liked' : ''}`;
    likeBtn.innerHTML = photo.isLiked ? '❤️ Unlike' : '🤍 Like';
    likeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLike(photo.id);
    });

    const likeCount = document.createElement('span');
    likeCount.className = 'like-count';
    likeCount.textContent = `${photo.likes || 0} likes`;

    actions.appendChild(likeBtn);
    actions.appendChild(likeCount);

    info.appendChild(caption);
    info.appendChild(meta);
    info.appendChild(actions);

    card.appendChild(img);
    card.appendChild(info);

    // Open modal on card click
    card.addEventListener('click', () => {
      this.openModal(photo);
    });

    return card;
  }

  createUserCard(user) {
    const card = document.createElement('div');
    card.className = 'user-card';

    const email = document.createElement('div');
    email.className = 'user-email';
    email.textContent = user.email;

    const stats = document.createElement('div');
    stats.className = 'user-stats';
    stats.textContent = `${user.photoCount} photos • ${user._count.followers} followers`;

    const followBtn = document.createElement('button');
    followBtn.className = 'follow-btn';
    followBtn.textContent = 'Follow';
    followBtn.addEventListener('click', () => {
      this.followUser(user.id, followBtn);
    });

    card.appendChild(email);
    card.appendChild(stats);
    card.appendChild(followBtn);

    return card;
  }

  async followUser(userId, button) {
    try {
      button.disabled = true;
      button.textContent = 'Following...';

      const response = await fetch(`/api/users/${userId}/follow`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to follow user');

      const data = await response.json();

      if (data.success) {
        button.textContent = 'Followed!';
        button.style.background = '#27ae60';
        this.showStatus('Successfully followed user', 'success');

        // Remove from suggested users
        this.suggestedUsers = this.suggestedUsers.filter(u => u.id !== userId);
        this.renderSuggestedUsers();
      }
    } catch (error) {
      console.error('Error following user:', error);
      button.disabled = false;
      button.textContent = 'Follow';
      this.showStatus('Error following user', 'error');
    }
  }

  async toggleLike(photoId) {
    try {
      const response = await fetch(`/api/photos/${photoId}/like`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to toggle like');

      const data = await response.json();

      if (data.success) {
        // Update photo in arrays
        this.updatePhotoLikeStatus(photoId, data.action === 'liked');

        // Update modal if open
        if (this.currentPhotoModal && this.currentPhotoModal.id === photoId) {
          this.updateModalLikeButton(data.action === 'liked');
        }

        // Re-render photos
        this.renderFollowingPhotos();

        this.showStatus(data.message, 'success');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      this.showStatus('Error updating like', 'error');
    }
  }

  updatePhotoLikeStatus(photoId, isLiked) {
    // Update in following photos
    const followingPhoto = this.followingPhotos.find(p => p.id === photoId);
    if (followingPhoto) {
      followingPhoto.isLiked = isLiked;
      followingPhoto.likes = (followingPhoto.likes || 0) + (isLiked ? 1 : -1);
    }
  }

  openModal(photo) {
    this.currentPhotoModal = photo;
    this.modalImage.src = `/api/photos/proxy/${photo.driveId}`;
    this.modalCaption.textContent = photo.caption || 'No caption';
    this.modalUser.textContent = `By ${photo.username || 'Unknown user'}`;
    this.modalLikeCount.textContent = `${photo.likes || 0} likes`;
    this.updateModalLikeButton(photo.isLiked);
    this.photoModal.style.display = 'block';
  }

  updateModalLikeButton(isLiked) {
    this.modalLikeBtn.innerHTML = isLiked ? '❤️ Unlike' : '🤍 Like';
    this.modalLikeBtn.className = `like-btn ${isLiked ? 'liked' : ''}`;
  }

  closeModal() {
    this.photoModal.style.display = 'none';
    this.currentPhotoModal = null;
  }

  updateFeedCount() {
    const totalPhotos = this.followingPhotos.length;
    this.feedCount.textContent = `${totalPhotos} photos`;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  }

  async loadFollowingList() {
    try {
      this.followingListLoading.style.display = 'block';
      this.followingListEmpty.style.display = 'none';

      const response = await fetch('/api/users/following', {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch following list');

      const data = await response.json();

      if (data.success && data.data) {
        this.renderFollowingList(data.data);
      }

      this.followingListLoading.style.display = 'none';
    } catch (error) {
      console.error('Error loading following list:', error);
      this.followingListLoading.style.display = 'none';
      this.showFollowEmailStatus('Error loading following list', 'error');
    }
  }

  renderFollowingList(followingUsers) {
    this.followingList.innerHTML = '';

    if (followingUsers.length === 0) {
      this.followingListEmpty.style.display = 'block';
      return;
    }

    this.followingListEmpty.style.display = 'none';

    followingUsers.forEach(user => {
      const userCard = this.createFollowingUserCard(user);
      this.followingList.appendChild(userCard);
    });
  }

  createFollowingUserCard(user) {
    const card = document.createElement('div');
    card.className = 'following-user-card';

    const email = document.createElement('div');
    email.className = 'following-user-email';
    email.textContent = user.email;

    const stats = document.createElement('div');
    stats.className = 'following-user-stats';
    stats.textContent = `${user.photoCount} photos • ${user._count.followers} followers`;

    const actions = document.createElement('div');
    actions.className = 'following-user-actions';

    const unfollowBtn = document.createElement('button');
    unfollowBtn.className = 'unfollow-btn';
    unfollowBtn.textContent = 'Unfollow';
    unfollowBtn.addEventListener('click', () => {
      this.unfollowUser(user.id, unfollowBtn);
    });

    actions.appendChild(unfollowBtn);

    card.appendChild(email);
    card.appendChild(stats);
    card.appendChild(actions);

    return card;
  }

  async followByEmail() {
    const email = this.followEmailInput.value.trim();

    if (!email) {
      this.showFollowEmailStatus('Please enter an email address', 'error');
      return;
    }

    if (!email.includes('@')) {
      this.showFollowEmailStatus('Please enter a valid email address', 'error');
      return;
    }

    try {
      this.followEmailBtn.disabled = true;
      this.followEmailBtn.textContent = 'Following...';

      const response = await fetch('/api/users/follow-email', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.success) {
        this.followEmailInput.value = '';
        this.showFollowEmailStatus(data.message, 'success');
        // Reload the following list and feed
        this.loadFollowingList();
        this.loadFollowingPhotos();
      } else {
        this.showFollowEmailStatus(data.message || 'Failed to follow user', 'error');
      }
    } catch (error) {
      console.error('Error following by email:', error);
      this.showFollowEmailStatus('Error following user', 'error');
    } finally {
      this.followEmailBtn.disabled = false;
      this.followEmailBtn.textContent = 'Follow';
    }
  }

  async unfollowUser(userId, button) {
    try {
      button.disabled = true;
      button.textContent = 'Unfollowing...';

      const response = await fetch(`/api/users/${userId}/follow`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to unfollow user');

      const data = await response.json();

      if (data.success) {
        this.showFollowEmailStatus('Successfully unfollowed user', 'success');
        // Reload the following list and feed
        this.loadFollowingList();
        this.loadFollowingPhotos();
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
      button.disabled = false;
      button.textContent = 'Unfollow';
      this.showFollowEmailStatus('Error unfollowing user', 'error');
    }
  }

  showFollowEmailStatus(message, type = 'success') {
    this.followEmailStatus.textContent = message;
    this.followEmailStatus.className = `follow-status ${type} show`;

    setTimeout(() => {
      this.followEmailStatus.classList.remove('show');
    }, 4000);
  }

  showStatus(message, type = 'success') {
    this.statusMessage.textContent = message;
    this.statusMessage.className = `status-message ${type} show`;

    setTimeout(() => {
      this.statusMessage.classList.remove('show');
    }, 3000);
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new FeedManager();
});