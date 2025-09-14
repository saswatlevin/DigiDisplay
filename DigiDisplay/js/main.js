// Global debug function - accessible everywhere
function debug(msg) {
    let el = document.getElementById("debug");
    if (!el) {
        // If debug console doesn't exist, create a temporary one
        el = document.createElement("div");
        el.id = "debug";
        el.style.cssText = "position:fixed;bottom:0;left:0;width:100%;height:90px;overflow-y:auto;background:black;color:lime;font-size:14px;z-index:9999;padding:4px;border-top:2px solid lime;";
        document.body.appendChild(el);
    }
    
    // Create new debug message div
    const msgDiv = document.createElement("div");
    msgDiv.textContent = String(msg);
    msgDiv.style.marginBottom = "2px";
    el.appendChild(msgDiv);
    
    // Limit to maximum 200 debug messages to prevent memory issues
    const maxMessages = 200;
    while (el.children.length > maxMessages) {
        el.removeChild(el.firstChild);
    }
    
    // Auto-scroll to bottom to show latest message
    el.scrollTop = el.scrollHeight;
    
    // Update scroll button states if they exist
    if (window.videoPlayer && typeof window.videoPlayer.updateDebugScrollButtons === 'function') {
        window.videoPlayer.updateDebugScrollButtons();
    }
}

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
     * Debug function accessible within the class
     */
    debug(msg) {
        debug(msg); // Call the global debug function
    }

    /**
     * Initialize the application
     */
    async initializeApp() {
        try {
            this.showLoadingOverlay('Initializing...');
            
            // Setup event listeners
            this.setupEventListeners();
            this.debug("Set up event listeners");
            
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
        videoPlayer.addEventListener('loadstart', () => {
            this.debug("Video loadstart event");
            this.updatePlaybackStatus('Loading video...', 'info');
        });
        videoPlayer.addEventListener('loadedmetadata', () => {
            this.debug("Video loadedmetadata event");
            this.debug("Video duration: " + videoPlayer.duration + " seconds");
        });
        videoPlayer.addEventListener('loadeddata', () => {
            this.debug("Video loadeddata event");
        });
        videoPlayer.addEventListener('canplay', () => {
            this.debug("Video canplay event - ready to play");
            this.updatePlaybackStatus('Ready to play', 'success');
        });
        videoPlayer.addEventListener('canplaythrough', () => {
            this.debug("Video canplaythrough event - can play without buffering");
        });
        videoPlayer.addEventListener('error', (e) => {
            this.debug("Video error event: " + JSON.stringify(e));
            this.handleVideoError(e);
        });
        videoPlayer.addEventListener('ended', () => {
            this.debug("Video ended event");
            this.updatePlaybackStatus('Video ended', 'info');
        });
        videoPlayer.addEventListener('playing', () => {
            this.debug("Video playing event");
            this.updatePlaybackStatus('Playing', 'success');
        });
        videoPlayer.addEventListener('pause', () => {
            this.debug("Video pause event");
            this.updatePlaybackStatus('Paused', 'info');
        });
        videoPlayer.addEventListener('waiting', () => {
            this.debug("Video waiting event - buffering");
            this.updatePlaybackStatus('Buffering...', 'info');
        });
        videoPlayer.addEventListener('stalled', () => {
            this.debug("Video stalled event - network issue");
            this.updatePlaybackStatus('Network issue - stalled', 'warning');
        });

        // Debug console scroll buttons
        this.setupDebugScrollButtons();

        // Focus management for TV remote
        this.setupFocusManagement();
    }

    /**
     * Setup debug console scroll buttons
     */
    setupDebugScrollButtons() {
        const debugConsole = document.getElementById('debug');
        const scrollUpBtn = document.getElementById('debug-scroll-up');
        const scrollDownBtn = document.getElementById('debug-scroll-down');

        if (scrollUpBtn && scrollDownBtn && debugConsole) {
            scrollUpBtn.addEventListener('click', () => {
                debugConsole.scrollTop -= 30; // Scroll up by 30px
                this.updateDebugScrollButtons();
            });

            scrollDownBtn.addEventListener('click', () => {
                debugConsole.scrollTop += 30; // Scroll down by 30px
                this.updateDebugScrollButtons();
            });

            // Update button states when scrolling with mouse
            debugConsole.addEventListener('scroll', () => {
                this.updateDebugScrollButtons();
            });

            // Initial button state update
            this.updateDebugScrollButtons();
        }
    }

    /**
     * Update debug scroll button states
     */
    updateDebugScrollButtons() {
        const debugConsole = document.getElementById('debug');
        const scrollUpBtn = document.getElementById('debug-scroll-up');
        const scrollDownBtn = document.getElementById('debug-scroll-down');

        if (debugConsole && scrollUpBtn && scrollDownBtn) {
            const isAtTop = debugConsole.scrollTop <= 0;
            const isAtBottom = debugConsole.scrollTop >= (debugConsole.scrollHeight - debugConsole.clientHeight);

            scrollUpBtn.disabled = isAtTop;
            scrollDownBtn.disabled = isAtBottom;
        }
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
        this.debug("In handleLoadVideo");
        const urlInput = document.getElementById('video-url');
        const url = urlInput.value.trim();

        if (!url) {
            this.debug("handleLoadVideo - Please enter a video URL");
            this.showNotification('Please enter a video URL', 'warning');
            return;
        }

        if (!this.isValidUrl(url)) {
             this.debug("handleLoadVideo - Please enter a valid URL");
            this.showNotification('Please enter a valid URL', 'error');
            return;
        }

        // Format validation removed to support streaming URLs and URLs without extensions

        if (this.isLoading) {
            this.showNotification('Video loading already in progress', 'warning');
            return;
        }

        try {
            this.debug("handleLoadVideo - Loading video from URL: " + url);
            await this.loadVideo(url);
        } catch (error) {
            this.debug("handleLoadVideo - Failed to load video " + error.message);
            this.showNotification(`Failed to load video: ${error.message}`, 'error');
            // console.error('Load error:', error);
        }
    }

    /**
     * Load video from URL
     */
    async loadVideo(url) {
        this.debug("In loadVideo. URL is " + url);
        this.isLoading = true;
        const loadBtn = document.getElementById('load-btn');
        const progressContainer = document.getElementById('download-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        try {
            loadBtn.disabled = true;
            progressContainer.style.display = 'flex';
            this.updateLoadStatus('Loading video...', 'info');
            this.debug("loadVideo - Loading video... ");

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
            
            // Clear any existing source first
            videoSource.src = '';
            videoPlayer.load();
            
            // Set the new video source
            videoSource.src = url;
            this.debug("loadVideo - video source set to URL " + url);
            
            // Wait for the video to be ready to load
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Video loading timeout'));
                }, 10000); // 10 second timeout
                
                const onCanPlay = () => {
                    clearTimeout(timeout);
                    videoPlayer.removeEventListener('canplay', onCanPlay);
                    videoPlayer.removeEventListener('error', onError);
                    resolve();
                };
                
                const onError = (e) => {
                    clearTimeout(timeout);
                    videoPlayer.removeEventListener('canplay', onCanPlay);
                    videoPlayer.removeEventListener('error', onError);
                    reject(new Error(`Video load error: ${e.target.error ? e.target.error.message : 'Unknown error'}`));
                };
                
                videoPlayer.addEventListener('canplay', onCanPlay);
                videoPlayer.addEventListener('error', onError);
                
                // Trigger the load
                videoPlayer.load();
            });
            
            this.currentVideo = url;
            this.updateAppStatus('Video loaded successfully');
            this.showNotification('Video loaded successfully!', 'success');
            this.updateLoadStatus('Video loaded', 'success');
            this.debug("loadVideo - Video loaded successfully. URL is " + url);


        } catch (error) {
            this.debug("loadVideo - Video load failed. URL is " + url);
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

    /*
     * Video playback controls
     */
    playVideo() {
        console.log("In playVideo");
        this.debug("In playVideo");
        const videoPlayer = document.getElementById('video-player');
        const videoSource = document.getElementById('video-source');
        
        // Check if video has a source and is ready to play
        if (videoSource.src || this.currentVideo) {
            console.log("playVideo true - Video source available");
            this.debug("playVideo - Video source available. Source: " + (videoSource.src || this.currentVideo));
            
            // Check if video is ready to play
            if (videoPlayer.readyState >= 3) { // HAVE_FUTURE_DATA or higher
                this.debug("playVideo - Video ready state: " + videoPlayer.readyState);
                
                // For Tizen 7, we need to handle autoplay policy
                const playPromise = videoPlayer.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        console.log("playVideo - playing video");
                        this.debug("playVideo - Playing video successfully. Source: " + (videoSource.src || this.currentVideo));
                        this.updatePlaybackStatus('Playing', 'success');
                    }).catch(error => {
                        console.log("playVideo - error");
                        this.debug("playVideo - Video playing failed. Error: " + error.message);
                        
                        // Handle specific autoplay policy errors
                        if (error.name === 'NotAllowedError') {
                            this.debug("playVideo - Autoplay blocked, trying to play after user interaction");
                            this.showNotification('Please click Play again - autoplay was blocked', 'warning');
                            this.updatePlaybackStatus('Autoplay blocked - click Play again', 'warning');
                        } else {
                            this.updatePlaybackStatus(`Play failed: ${error.message}`, 'error');
                            this.showNotification(`Playback error: ${error.message}`, 'error');
                        }
                    });
                }
            } else {
                this.debug("playVideo - Video not ready. Ready state: " + videoPlayer.readyState);
                this.showNotification('Video is still loading, please wait...', 'warning');
                this.updatePlaybackStatus('Video loading...', 'info');
            }
        } else {
            console.log("playVideo false - No video loaded");
            this.debug("playVideo - No video loaded. Please load a video first.");
            this.showNotification('No video loaded. Please load a video first.', 'warning');
        }
    }

    pauseVideo() {
        this.debug("In pauseVideo");
        console.log("In pauseVideo");
        const videoPlayer = document.getElementById('video-player');
        videoPlayer.pause();
        this.updatePlaybackStatus('Paused', 'info');
    }

    stopVideo() {
        this.debug("In stopVideo");
        console.log("In stopVideo");
        const videoPlayer = document.getElementById('video-player');
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
        this.updatePlaybackStatus('Stopped', 'info');
    }

    setVolume(volume) {
        this.debug("In setVolume");
        console.log("In setVolume");
        const videoPlayer = document.getElementById('video-player');
        videoPlayer.volume = volume / 100;
    }

    /**
     * Handle video playback errors
     */
    handleVideoError(event) {
        const video = event.target;
        let errorMessage = 'Unknown video error';
        let errorCode = 'UNKNOWN';
        
        this.debug("handleVideoError called");
        this.debug("Video error object: " + JSON.stringify(video.error));
        
        if (video.error) {
            switch (video.error.code) {
                case video.error.MEDIA_ERR_ABORTED:
                    errorMessage = 'Video playback was aborted';
                    errorCode = 'MEDIA_ERR_ABORTED';
                    break;
                case video.error.MEDIA_ERR_NETWORK:
                    errorMessage = 'Network error occurred - check internet connection';
                    errorCode = 'MEDIA_ERR_NETWORK';
                    break;
                case video.error.MEDIA_ERR_DECODE:
                    errorMessage = 'Video format not supported or corrupted';
                    errorCode = 'MEDIA_ERR_DECODE';
                    break;
                case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMessage = 'Video source not supported - check URL and format';
                    errorCode = 'MEDIA_ERR_SRC_NOT_SUPPORTED';
                    break;
                default:
                    errorMessage = `Unknown video error (code: ${video.error.code})`;
                    errorCode = `UNKNOWN_${video.error.code}`;
            }
            
            this.debug("Video error details:");
            this.debug("- Code: " + errorCode);
            this.debug("- Message: " + errorMessage);
            this.debug("- Network state: " + video.networkState);
            this.debug("- Ready state: " + video.readyState);
            this.debug("- Current source: " + (video.src || 'none'));
        } else {
            this.debug("Video error object is null/undefined");
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
        this.debug("In isValidUrl.");
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
        window.videoPlayer = videoPlayer; // Make globally accessible for debug function
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