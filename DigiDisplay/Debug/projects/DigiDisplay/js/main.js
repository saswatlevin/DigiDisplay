/**
 * DigiDisplay Video Manager - Tizen Web App
 * Comprehensive video management system for Samsung TVs
 */

class VideoManager {
    constructor() {
        this.videoStorage = null;
        this.downloadedVideos = new Map();
        this.currentVideo = null;
        this.isDownloading = false;
        this.supportedFormats = ['mp4', 'avi', 'mkv', 'webm', 'mov'];
        this.maxFileSize = 500 * 1024 * 1024; // 500MB limit for TV storage
        
        this.initializeApp();
    }

    /**
     * Initialize the application
     */
    async initializeApp() {
        try {
            this.showLoadingOverlay('Initializing...');
            
            // Initialize Tizen filesystem
            await this.initializeStorage();
            
            // Load existing videos
            await this.loadVideoLibrary();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Check storage status
            await this.updateStorageStatus();
            
            this.hideLoadingOverlay();
            this.showNotification('Application initialized successfully', 'success');
            
        } catch (error) {
            this.hideLoadingOverlay();
            this.showNotification(`Initialization failed: ${error.message}`, 'error');
            console.error('Initialization error:', error);
        }
    }

    /**
     * Initialize Tizen filesystem storage
     */
    async initializeStorage() {
        return new Promise((resolve, reject) => {
            try {
                // Request filesystem access
                tizen.filesystem.resolve('documents', (dir) => {
                    this.videoStorage = dir;
                    console.log('Storage initialized:', dir.fullPath);
                    resolve();
                }, (error) => {
                    reject(new Error(`Storage initialization failed: ${error.message}`));
                }, 'rw');
            } catch (error) {
                reject(new Error(`Filesystem access denied: ${error.message}`));
            }
        });
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

        // Download functionality
        const downloadBtn = document.getElementById('download-btn');
        const videoUrlInput = document.getElementById('video-url');
        
        downloadBtn.addEventListener('click', () => this.handleDownload());
        videoUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleDownload();
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

        // Library controls
        const refreshBtn = document.getElementById('refresh-library');
        const clearAllBtn = document.getElementById('clear-all');
        
        refreshBtn.addEventListener('click', () => this.loadVideoLibrary());
        clearAllBtn.addEventListener('click', () => this.clearAllVideos());

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
     * Handle video download
     */
    async handleDownload() {
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

        if (!this.isSupportedFormat(url)) {
            this.showNotification('Unsupported video format. Supported: MP4, AVI, MKV, WebM, MOV', 'warning');
            return;
        }

        if (this.isDownloading) {
            this.showNotification('Download already in progress', 'warning');
            return;
        }

        try {
            await this.downloadVideo(url);
        } catch (error) {
            this.showNotification(`Download failed: ${error.message}`, 'error');
            console.error('Download error:', error);
        }
    }

    /**
     * Download video from URL
     */
    async downloadVideo(url) {
        this.isDownloading = true;
        const downloadBtn = document.getElementById('download-btn');
        const progressContainer = document.getElementById('download-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const statusElement = document.getElementById('download-status');

        try {
            downloadBtn.disabled = true;
            progressContainer.style.display = 'flex';
            this.updateDownloadStatus('Starting download...', 'info');

            // Create filename from URL
            const filename = this.generateFilename(url);
            const filePath = `videos/${filename}`;

            // Check if file already exists
            if (await this.fileExists(filePath)) {
                throw new Error('Video already exists in library');
            }

            // Create videos directory if it doesn't exist
            await this.ensureVideosDirectory();

            // Download with progress tracking
            const response = await this.downloadWithProgress(url, (progress) => {
                const percentage = Math.round(progress);
                progressFill.style.width = `${percentage}%`;
                progressText.textContent = `${percentage}%`;
                this.updateDownloadStatus(`Downloading... ${percentage}%`, 'info');
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Save to local storage
            await this.saveVideoToStorage(response, filePath);
            
            // Update library
            await this.loadVideoLibrary();
            
            // Clear form
            document.getElementById('video-url').value = '';
            
            this.showNotification('Video downloaded successfully!', 'success');
            this.updateDownloadStatus('Download completed', 'success');

        } catch (error) {
            this.updateDownloadStatus(`Download failed: ${error.message}`, 'error');
            throw error;
        } finally {
            this.isDownloading = false;
            downloadBtn.disabled = false;
            setTimeout(() => {
                progressContainer.style.display = 'none';
                progressFill.style.width = '0%';
                progressText.textContent = '0%';
            }, 3000);
        }
    }

    /**
     * Download with progress tracking
     */
    async downloadWithProgress(url, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.open('GET', url, true);
            xhr.responseType = 'blob';
            
            xhr.onprogress = (event) => {
                if (event.lengthComputable) {
                    const progress = (event.loaded / event.total) * 100;
                    onProgress(progress);
                }
            };
            
            xhr.onload = () => {
                if (xhr.status === 200) {
                    resolve(xhr);
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            };
            
            xhr.onerror = () => {
                reject(new Error('Network error occurred'));
            };
            
            xhr.ontimeout = () => {
                reject(new Error('Download timeout'));
            };
            
            xhr.timeout = 300000; // 5 minutes timeout
            
            xhr.send();
        });
    }

    /**
     * Save video to Tizen filesystem
     */
    async saveVideoToStorage(response, filePath) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = () => {
                const arrayBuffer = reader.result;
                
                this.videoStorage.createFile(filePath, (file) => {
                    file.openStream('w', (fileStream) => {
                        fileStream.write(arrayBuffer);
                        fileStream.close();
                        console.log('Video saved to:', file.fullPath);
                        resolve();
                    }, (error) => {
                        reject(new Error(`Failed to write file: ${error.message}`));
                    });
                }, (error) => {
                    reject(new Error(`Failed to create file: ${error.message}`));
                });
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read video data'));
            };
            
            reader.readAsArrayBuffer(response.response);
        });
    }

    /**
     * Ensure videos directory exists
     */
    async ensureVideosDirectory() {
        return new Promise((resolve, reject) => {
            this.videoStorage.createDirectory('videos', (dir) => {
                console.log('Videos directory ready');
                resolve();
            }, (error) => {
                if (error.name === 'InvalidValuesError') {
                    // Directory already exists
                    resolve();
                } else {
                    reject(new Error(`Failed to create videos directory: ${error.message}`));
                }
            });
        });
    }

    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        return new Promise((resolve) => {
            this.videoStorage.resolve(filePath, (file) => {
                resolve(true);
            }, () => {
                resolve(false);
            });
        });
    }

    /**
     * Load video library from storage
     */
    async loadVideoLibrary() {
        try {
            this.showLoadingOverlay('Loading video library...');
            
            const videoList = document.getElementById('video-list');
            videoList.innerHTML = '<div class="no-videos">Loading videos...</div>';

            await this.ensureVideosDirectory();
            
            this.videoStorage.listFiles((files) => {
                const videoFiles = files.filter(file => 
                    this.supportedFormats.some(format => 
                        file.name.toLowerCase().endsWith(`.${format}`)
                    )
                );

                if (videoFiles.length === 0) {
                    videoList.innerHTML = '<div class="no-videos">No videos downloaded yet</div>';
                } else {
                    videoList.innerHTML = '';
                    videoFiles.forEach(file => {
                        this.addVideoToList(file);
                    });
                }
                
                this.hideLoadingOverlay();
            }, (error) => {
                console.error('Failed to list files:', error);
                videoList.innerHTML = '<div class="no-videos">Failed to load videos</div>';
                this.hideLoadingOverlay();
            }, 'videos');
            
        } catch (error) {
            this.hideLoadingOverlay();
            this.showNotification(`Failed to load library: ${error.message}`, 'error');
            console.error('Library load error:', error);
        }
    }

    /**
     * Add video item to library list
     */
    addVideoToList(file) {
        const videoList = document.getElementById('video-list');
        const videoItem = document.createElement('div');
        videoItem.className = 'video-item';
        videoItem.tabIndex = 0;
        
        const fileSize = this.formatFileSize(file.size);
        const fileName = file.name;
        
        videoItem.innerHTML = `
            <div class="video-item-header">
                <div class="video-name">${fileName}</div>
                <div class="video-size">${fileSize}</div>
            </div>
            <div class="video-actions">
                <button class="btn btn-control btn-small" onclick="videoManager.playVideoFromLibrary('${file.fullPath}')">Play</button>
                <button class="btn btn-secondary btn-small" onclick="videoManager.deleteVideo('${file.fullPath}', '${fileName}')">Delete</button>
            </div>
        `;
        
        videoItem.addEventListener('click', () => {
            this.playVideoFromLibrary(file.fullPath);
        });
        
        videoList.appendChild(videoItem);
    }

    /**
     * Play video from library
     */
    playVideoFromLibrary(filePath) {
        try {
            const videoPlayer = document.getElementById('video-player');
            const videoSource = document.getElementById('video-source');
            
            // Convert Tizen file path to file:// URL
            const fileUrl = `file://${filePath}`;
            
            videoSource.src = fileUrl;
            videoPlayer.load();
            
            this.currentVideo = filePath;
            this.updatePlaybackStatus('Loading video from library...', 'info');
            this.showNotification('Video loaded from library', 'success');
            
        } catch (error) {
            this.showNotification(`Failed to play video: ${error.message}`, 'error');
            console.error('Playback error:', error);
        }
    }

    /**
     * Delete video from storage
     */
    async deleteVideo(filePath, fileName) {
        if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
            return;
        }

        try {
            this.showLoadingOverlay('Deleting video...');
            
            this.videoStorage.resolve(filePath, (file) => {
                file.deleteFile(() => {
                    this.showNotification('Video deleted successfully', 'success');
                    this.loadVideoLibrary();
                }, (error) => {
                    this.hideLoadingOverlay();
                    this.showNotification(`Failed to delete video: ${error.message}`, 'error');
                });
            }, (error) => {
                this.hideLoadingOverlay();
                this.showNotification(`Video not found: ${error.message}`, 'error');
            });
            
        } catch (error) {
            this.hideLoadingOverlay();
            this.showNotification(`Delete failed: ${error.message}`, 'error');
            console.error('Delete error:', error);
        }
    }

    /**
     * Clear all videos
     */
    async clearAllVideos() {
        if (!confirm('Are you sure you want to delete ALL videos? This action cannot be undone.')) {
            return;
        }

        try {
            this.showLoadingOverlay('Clearing all videos...');
            
            this.videoStorage.listFiles((files) => {
                const videoFiles = files.filter(file => 
                    this.supportedFormats.some(format => 
                        file.name.toLowerCase().endsWith(`.${format}`)
                    )
                );

                if (videoFiles.length === 0) {
                    this.hideLoadingOverlay();
                    this.showNotification('No videos to delete', 'info');
                    return;
                }

                let deletedCount = 0;
                const totalVideos = videoFiles.length;

                const deleteNext = () => {
                    if (deletedCount >= totalVideos) {
                        this.hideLoadingOverlay();
                        this.showNotification(`Deleted ${totalVideos} videos`, 'success');
                        this.loadVideoLibrary();
                        return;
                    }

                    const file = videoFiles[deletedCount];
                    file.deleteFile(() => {
                        deletedCount++;
                        deleteNext();
                    }, (error) => {
                        console.error(`Failed to delete ${file.name}:`, error);
                        deletedCount++;
                        deleteNext();
                    });
                };

                deleteNext();
                
            }, (error) => {
                this.hideLoadingOverlay();
                this.showNotification(`Failed to clear videos: ${error.message}`, 'error');
            }, 'videos');
            
        } catch (error) {
            this.hideLoadingOverlay();
            this.showNotification(`Clear failed: ${error.message}`, 'error');
            console.error('Clear error:', error);
        }
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
            });
        } else {
            this.showNotification('No video loaded', 'warning');
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
                    errorMessage = 'Video format not supported';
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
     * Update storage status
     */
    async updateStorageStatus() {
        try {
            // Get available storage space (simplified for Tizen)
            const statusElement = document.getElementById('storage-status');
            statusElement.textContent = 'Storage: Available';
        } catch (error) {
            const statusElement = document.getElementById('storage-status');
            statusElement.textContent = 'Storage: Unknown';
            console.error('Storage status error:', error);
        }
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

    isSupportedFormat(url) {
        const extension = url.split('.').pop().toLowerCase();
        return this.supportedFormats.includes(extension);
    }

    generateFilename(url) {
        const urlParts = url.split('/');
        let filename = urlParts[urlParts.length - 1];
        
        // Remove query parameters
        filename = filename.split('?')[0];
        
        // Add timestamp if no extension
        if (!filename.includes('.')) {
            filename = `video_${Date.now()}.mp4`;
        }
        
        // Ensure unique filename
        const timestamp = Date.now();
        const nameParts = filename.split('.');
        const extension = nameParts.pop();
        const name = nameParts.join('.');
        
        return `${name}_${timestamp}.${extension}`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

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

    updateDownloadStatus(message, type) {
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
let videoManager;

window.onload = function() {
    try {
        videoManager = new VideoManager();
    } catch (error) {
        console.error('Failed to initialize VideoManager:', error);
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; color: white; text-align: center;">
                <div>
                    <h1>Initialization Error</h1>
                    <p>Failed to initialize the video manager.</p>
                    <p>Error: ${error.message}</p>
                </div>
            </div>
        `;
    }
};

