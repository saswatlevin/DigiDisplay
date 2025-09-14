/**
 * DigiDisplay Video Player - Tizen Web App
 * Simple video player that loads and plays videos directly from URLs
 */

class VideoPlayer {
    constructor() {
        this.currentVideo = null;
        this.isLoading = false;
        
        this.initializeApp();
    }

    /**
     * Initialize the application
     */
    async initializeApp() {
        try {
            this.showLoadingOverlay('Initializing...');
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Update app status
            this.updateAppStatus('Ready to play videos');
            
            this.hideLoadingOverlay();
            this.showNotification('Application initialized successfully', 'success');
            
        } catch (error) {
            this.hideLoadingOverlay();
            this.showNotification(`Initialization failed: ${error.message}`, 'error');
            // console.error('Initialization error:', error);
        }
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Tizen hardware key handling
        document.addEventListener('tizenhwkey', (e) => {
        if (e.keyName === "back") {
            try {
                tizen.application.getCurrentApplication().exit();
            } catch (ignore) {}
        }
    });

        // Video loading functionality
        const loadBtn = document.getElementById('load-btn');
        const videoUrlInput = document.getElementById('video-url');
        
        loadBtn.addEventListener('click', () => this.handleLoadVideo());
        videoUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleLoadVideo();
            }
        });

        // Video playback controls
        const playBtn = document.getElementById('play-btn');
        const pauseBtn = document.getElementById('pause-btn');
        const stopBtn = document.getElementById('stop-btn');
        const volumeSlider = document.getElementById('volume-slider');
        const videoPlayer = document.getElementById('video-player');

        playBtn.addEventListener('click', () => this.playVideo());
        pauseBtn.addEventListener('click', () => this.pauseVideo());
        stopBtn.addEventListener('click', () => this.stopVideo());
        volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));

        // Video player events
        videoPlayer.addEventListener('loadstart', () => this.updatePlaybackStatus('Loading video...', 'info'));
        videoPlayer.addEventListener('canplay', () => this.updatePlaybackStatus('Ready to play', 'success'));
        videoPlayer.addEventListener('error', (e) => this.handleVideoError(e));
        videoPlayer.addEventListener('ended', () => this.updatePlaybackStatus('Video ended', 'info'));
        videoPlayer.addEventListener('playing', () => this.updatePlaybackStatus('Playing', 'success'));
        videoPlayer.addEventListener('pause', () => this.updatePlaybackStatus('Paused', 'info'));

        // Focus management for TV remote
        this.setupFocusManagement();
    }

    /**
     * Setup focus management for TV remote navigation
     */
    setupFocusManagement() {
        const focusableElements = document.querySelectorAll('button, input, [tabindex]');
        let currentFocusIndex = 0;

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                currentFocusIndex = (currentFocusIndex + 1) % focusableElements.length;
                focusableElements[currentFocusIndex].focus();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                currentFocusIndex = currentFocusIndex === 0 ? focusableElements.length - 1 : currentFocusIndex - 1;
                focusableElements[currentFocusIndex].focus();
            }
        });
    }

    /**
     * Handle video loading
     */
    async handleLoadVideo() {
        const urlInput = document.getElementById('video-url');
        const url = urlInput.value.trim();

        if (!url) {
            this.showNotification('Please enter a video URL', 'warning');
            return;
        }

        if (!this.isValidUrl(url)) {
            this.showNotification('Please enter a valid URL', 'error');
            return;
        }

        // Format validation removed to support streaming URLs and URLs without extensions

        if (this.isLoading) {
            this.showNotification('Video loading already in progress', 'warning');
            return;
        }

        try {
            await this.loadVideo(url);
        } catch (error) {
            this.showNotification(`Failed to load video: ${error.message}`, 'error');
            // console.error('Load error:', error);
        }
    }

    /**
     * Load video from URL
     */
    async loadVideo(url) {
        this.isLoading = true;
        const loadBtn = document.getElementById('load-btn');
        const progressContainer = document.getElementById('download-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        try {
            loadBtn.disabled = true;
            progressContainer.style.display = 'flex';
            this.updateLoadStatus('Loading video...', 'info');

            // Show progress (simplified for direct URL loading)
            this.simulateProgress((progress) => {
                const percentage = Math.round(progress);
                progressFill.style.width = `${percentage}%`;
                progressText.textContent = `${percentage}%`;
                this.updateLoadStatus(`Loading... ${percentage}%`, 'info');
            });

            // Load video directly into the player
            const videoPlayer = document.getElementById('video-player');
            const videoSource = document.getElementById('video-source');
            
            // Set the video source
            videoSource.src = url;
            videoPlayer.load();
            
            this.currentVideo = url;
            this.updateAppStatus('Video loaded successfully');
            this.showNotification('Video loaded successfully!', 'success');
            this.updateLoadStatus('Video loaded', 'success');

        } catch (error) {
            this.updateLoadStatus(`Load failed: ${error.message}`, 'error');
            throw error;
        } finally {
            this.isLoading = false;
            loadBtn.disabled = false;
            setTimeout(() => {
                progressContainer.style.display = 'none';
                progressFill.style.width = '0%';
                progressText.textContent = '0%';
            }, 2000);
        }
    }

    /**
     * Simulate loading progress for better UX
     */
    simulateProgress(onProgress) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
            }
            onProgress(progress);
        }, 200);
    }

    /**
     * Video playback controls
     */
    playVideo() {
        const videoPlayer = document.getElementById('video-player');
        if (videoPlayer.src) {
            videoPlayer.play().then(() => {
                this.updatePlaybackStatus('Playing', 'success');
            }).catch(error => {
                this.updatePlaybackStatus(`Play failed: ${error.message}`, 'error');
                this.showNotification(`Playback error: ${error.message}`, 'error');
            });
        } else {
            this.showNotification('No video loaded. Please load a video first.', 'warning');
        }
    }

    pauseVideo() {
        const videoPlayer = document.getElementById('video-player');
        videoPlayer.pause();
        this.updatePlaybackStatus('Paused', 'info');
    }

    stopVideo() {
        const videoPlayer = document.getElementById('video-player');
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
        this.updatePlaybackStatus('Stopped', 'info');
    }

    setVolume(volume) {
        const videoPlayer = document.getElementById('video-player');
        videoPlayer.volume = volume / 100;
    }

    /**
     * Handle video playback errors
     */
    handleVideoError(event) {
        const video = event.target;
        let errorMessage = 'Unknown video error';
        
        if (video.error) {
            switch (video.error.code) {
                case video.error.MEDIA_ERR_ABORTED:
                    errorMessage = 'Video playback was aborted';
                    break;
                case video.error.MEDIA_ERR_NETWORK:
                    errorMessage = 'Network error occurred';
                    break;
                case video.error.MEDIA_ERR_DECODE:
                    errorMessage = 'Video format not supported or corrupted';
                    break;
                case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMessage = 'Video source not supported';
                    break;
            }
        }
        
        this.updatePlaybackStatus(errorMessage, 'error');
        this.showNotification(errorMessage, 'error');
    }

    /**
     * Update app status
     */
    updateAppStatus(message) {
        const statusElement = document.getElementById('app-status');
        statusElement.textContent = message;
    }

    /**
     * Utility functions
     */
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // Format validation removed to support all video URLs including streaming URLs

    /**
     * UI Helper functions
     */
    showLoadingOverlay(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = document.querySelector('.loading-text');
        text.textContent = message;
        overlay.style.display = 'flex';
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = 'none';
    }

    showNotification(message, type = 'info') {
        const notificationArea = document.getElementById('notification-area');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notificationArea.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    updateLoadStatus(message, type) {
        const statusElement = document.getElementById('download-status');
        statusElement.textContent = message;
        statusElement.className = `status-message status-${type}`;
    }

    updatePlaybackStatus(message, type) {
        const statusElement = document.getElementById('playback-status');
        statusElement.textContent = message;
        statusElement.className = `status-message status-${type}`;
    }
}

// Initialize the application when DOM is loaded
let videoPlayer;

window.onload = function() {
    try {
        videoPlayer = new VideoPlayer();
    } catch (error) {
        // console.error('Failed to initialize VideoPlayer:', error);
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; color: white; text-align: center;">
                <div>
                    <h1>Initialization Error</h1>
                    <p>Failed to initialize the video player.</p>
                    <p>Error: ${error.message}</p>
                </div>
            </div>
        `;
    }
};