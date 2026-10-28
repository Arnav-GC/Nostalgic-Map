/**
 * @file app.js
 * @description Main application controller for Nostalgic Map PWA.
 * Connects camera, storage, map, and AI modules.
 */

import { memoryStore } from './storage.js';
import { cameraManager } from './camera.js';
import { mapManager } from './map.js';
import { aiAnalyzer } from './ai.js';
import { proximityManager } from './proximity.js';

class NostalgicMapApp {
  constructor() {
    // State
    this.currentView = 'camera';
    this.isMapInitialized = false;
    this.activeModalMemory = null;
    this.activeProximityMemory = null;
    this.pendingCapture = null;
    this.allMemories = [];

    // DOM Elements Cache
    this.dom = {};
  }

  /**
   * Initializes the application.
   */
  async init() {
    this._cacheDom();
    this._initApiKey();
    this._initProximity();
    this._bindEvents();

    // Start with Camera view
    this.switchView('camera');

    // Pre-initialize storage
    try {
      await memoryStore.init();
      await this.refreshMemories();
    } catch (err) {
      console.error('Storage initialization failed:', err);
      this.showToast('⚠️ Storage initialization failed');
    }
  }

  /**
   * Caches frequently accessed DOM elements.
   * @private
   */
  _cacheDom() {
    this.dom = {
      // Views
      views: {
        camera: document.getElementById('view-camera'),
        map: document.getElementById('view-map'),
        memories: document.getElementById('view-memories'),
        settings: document.getElementById('view-settings'),
      },
      navButtons: document.querySelectorAll('#bottom-nav .nav-btn'),

      // Camera view
      videoPreview: document.getElementById('camera-preview'),
      cameraCanvas: document.getElementById('camera-canvas'),
      btnFlipCamera: document.getElementById('btn-flip-camera'),
      btnCapture: document.getElementById('btn-capture'),
      btnUpload: document.getElementById('btn-upload'),
      fileInput: document.getElementById('file-input'),

      // Capture preview overlay
      capturePreview: document.getElementById('capture-preview'),
      capturedImage: document.getElementById('captured-image'),
      captureLocation: document.getElementById('capture-location'),
      captureAiDesc: document.getElementById('capture-ai-desc'),
      btnSaveMemory: document.getElementById('btn-save-memory'),
      btnRetake: document.getElementById('btn-retake'),

      // Map view
      mapContainer: document.getElementById('map-container'),
      timelineSlider: document.getElementById('timeline-slider'),
      timelineLabel: document.getElementById('timeline-label'),

      // Memories view
      memoriesGrid: document.getElementById('memories-grid'),
      noMemories: document.getElementById('no-memories'),
      sortMemories: document.getElementById('sort-memories'),

      // Settings view
      apiKeyInput: document.getElementById('api-key-input'),
      btnSaveKey: document.getElementById('btn-save-key'),
      keyStatus: document.getElementById('key-status'),
      btnExport: document.getElementById('btn-export'),
      btnClearData: document.getElementById('btn-clear-data'),
      statsInfo: document.getElementById('stats-info'),

      // Modal
      modal: document.getElementById('memory-modal'),
      btnCloseModal: document.getElementById('btn-close-modal'),
      modalImage: document.getElementById('modal-image'),
      modalLocation: document.getElementById('modal-location'),
      modalDate: document.getElementById('modal-date'),
      modalDescription: document.getElementById('modal-description'),
      btnAnalyzeModal: document.getElementById('btn-analyze-modal'),
      btnDeleteMemory: document.getElementById('btn-delete-memory'),

      // Toast
      toast: document.getElementById('toast'),

      // Proximity Alert Banner
      proximityBanner: document.getElementById('proximity-banner'),
      proximityBannerTitle: document.getElementById('proximity-banner-title'),
      proximityBannerDesc: document.getElementById('proximity-banner-desc'),
      proximityBannerImg: document.getElementById('proximity-banner-img'),
      btnViewProximity: document.getElementById('btn-view-proximity'),
      btnDismissProximity: document.getElementById('btn-dismiss-proximity'),

      // Proximity Settings
      toggleProximity: document.getElementById('toggle-proximity'),
      proximityStatusText: document.getElementById('proximity-status-text'),
      proximitySubSettings: document.getElementById('proximity-sub-settings'),
      proximityRadius: document.getElementById('proximity-radius'),
      proximityRadiusLabel: document.getElementById('proximity-radius-label'),
      btnRequestNotification: document.getElementById('btn-request-notification'),
      notificationPermStatus: document.getElementById('notification-perm-status'),
    };
  }

  /**
   * Loads saved API key from localStorage into the AI analyzer.
   * @private
   */
  _initApiKey() {
    const savedKey = localStorage.getItem('nostalgic_gemini_api_key') || '';
    if (savedKey) {
      aiAnalyzer.setApiKey(savedKey);
      if (this.dom.apiKeyInput) {
        this.dom.apiKeyInput.value = savedKey;
      }
      this._setKeyStatus('API key loaded and active', 'success');
    }
  }

  /**
   * Initializes proximity tracking and syncs settings controls.
   * @private
   */
  _initProximity() {
    proximityManager.init(this.allMemories, (memory, distance, totalNearby) => {
      this.showProximityBanner(memory, distance, totalNearby);
    });

    if (this.dom.toggleProximity) {
      this.dom.toggleProximity.checked = proximityManager.enabled;
    }
    if (this.dom.proximityStatusText) {
      this.dom.proximityStatusText.textContent = proximityManager.enabled ? 'Enabled' : 'Disabled';
    }
    if (this.dom.proximitySubSettings) {
      this.dom.proximitySubSettings.style.display = proximityManager.enabled ? 'flex' : 'none';
    }
    if (this.dom.proximityRadius) {
      this.dom.proximityRadius.value = proximityManager.radiusMeters;
    }
    if (this.dom.proximityRadiusLabel) {
      this.dom.proximityRadiusLabel.textContent = `${proximityManager.radiusMeters}m`;
    }
    this._updateNotificationPermStatus();
  }

  /**
   * Updates notification permission status message in settings.
   * @private
   */
  _updateNotificationPermStatus() {
    if (!this.dom.notificationPermStatus) return;
    if (!('Notification' in window)) {
      this.dom.notificationPermStatus.textContent = 'Web notifications are not supported in this browser.';
      if (this.dom.btnRequestNotification) this.dom.btnRequestNotification.style.display = 'none';
      return;
    }

    const perm = Notification.permission;
    if (perm === 'granted') {
      this.dom.notificationPermStatus.textContent = '✅ System notifications enabled! You will be alerted even if the tab is in background.';
      if (this.dom.btnRequestNotification) {
        this.dom.btnRequestNotification.textContent = '🔔 Notifications Active';
        this.dom.btnRequestNotification.disabled = true;
      }
    } else if (perm === 'denied') {
      this.dom.notificationPermStatus.textContent = '❌ Notifications blocked. Allow notifications in browser address bar to receive alerts.';
      if (this.dom.btnRequestNotification) {
        this.dom.btnRequestNotification.disabled = true;
      }
    } else {
      this.dom.notificationPermStatus.textContent = 'Click below to allow system alerts when near a memory location.';
      if (this.dom.btnRequestNotification) {
        this.dom.btnRequestNotification.disabled = false;
      }
    }
  }

  /**
   * Shows the in-app proximity banner for an approaching memory.
   * @param {Object} memory
   * @param {number} distance
   * @param {number} totalNearby
   */
  showProximityBanner(memory, distance, totalNearby) {
    if (!this.dom.proximityBanner) return;

    this.activeProximityMemory = memory;

    if (this.dom.proximityBannerTitle) {
      this.dom.proximityBannerTitle.textContent = totalNearby > 1
        ? `📍 ${totalNearby} Memories Nearby!`
        : '📍 Memory Nearby!';
    }

    if (this.dom.proximityBannerDesc) {
      const distText = distance < 1000 ? `${distance}m away` : `${(distance / 1000).toFixed(1)}km away`;
      const locationText = memory.locationName || 'Saved Location';
      this.dom.proximityBannerDesc.textContent = `${locationText} (${distText})`;
    }

    if (this.dom.proximityBannerImg) {
      if (memory.photoDataUrl) {
        this.dom.proximityBannerImg.src = memory.photoDataUrl;
        this.dom.proximityBannerImg.classList.remove('hidden');
      } else {
        this.dom.proximityBannerImg.classList.add('hidden');
      }
    }

    this.dom.proximityBanner.classList.remove('hidden');
  }

  /**
   * Dismisses the in-app proximity banner.
   */
  dismissProximityBanner() {
    if (this.dom.proximityBanner) {
      this.dom.proximityBanner.classList.add('hidden');
    }
    this.activeProximityMemory = null;
  }

  /**
   * Binds user interaction event listeners.
   * @private
   */
  _bindEvents() {
    // Navigation tabs
    this.dom.navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        if (view) this.switchView(view);
      });
    });

    // Camera controls
    if (this.dom.btnCapture) {
      this.dom.btnCapture.addEventListener('click', () => this.handleCapturePhoto());
    }
    if (this.dom.btnFlipCamera) {
      this.dom.btnFlipCamera.addEventListener('click', () => this.handleFlipCamera());
    }
    if (this.dom.btnUpload) {
      this.dom.btnUpload.addEventListener('click', () => this.dom.fileInput?.click());
    }
    if (this.dom.fileInput) {
      this.dom.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    // Capture preview actions
    if (this.dom.btnSaveMemory) {
      this.dom.btnSaveMemory.addEventListener('click', () => this.savePendingMemory());
    }
    if (this.dom.btnRetake) {
      this.dom.btnRetake.addEventListener('click', () => this.discardPendingMemory());
    }

    // Map controls
    if (this.dom.timelineSlider) {
      this.dom.timelineSlider.addEventListener('input', (e) => this.handleTimelineChange(e));
    }

    // Custom event from map popups
    document.addEventListener('memory-select', (e) => {
      if (e.detail && e.detail.memory) {
        this.openMemoryModal(e.detail.memory);
      } else if (e.detail && e.detail.id) {
        this.openMemoryModalById(e.detail.id);
      }
    });

    // Memories sorting
    if (this.dom.sortMemories) {
      this.dom.sortMemories.addEventListener('change', () => this.renderMemoriesGrid());
    }

    // Modal controls
    if (this.dom.btnCloseModal) {
      this.dom.btnCloseModal.addEventListener('click', () => this.closeMemoryModal());
    }
    if (this.dom.modal) {
      this.dom.modal.addEventListener('click', (e) => {
        if (e.target === this.dom.modal) this.closeMemoryModal();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeMemoryModal();
      });
    }
    if (this.dom.btnAnalyzeModal) {
      this.dom.btnAnalyzeModal.addEventListener('click', () => this.reanalyzeModalMemory());
    }
    if (this.dom.btnDeleteMemory) {
      this.dom.btnDeleteMemory.addEventListener('click', () => this.deleteActiveMemory());
    }

    // Proximity banner actions
    if (this.dom.btnViewProximity) {
      this.dom.btnViewProximity.addEventListener('click', async () => {
        if (this.activeProximityMemory) {
          const mem = this.activeProximityMemory;
          this.dismissProximityBanner();
          await this.switchView('map');
          mapManager.flyToMemory(mem);
        }
      });
    }
    if (this.dom.btnDismissProximity) {
      this.dom.btnDismissProximity.addEventListener('click', () => this.dismissProximityBanner());
    }

    // Proximity settings controls
    if (this.dom.toggleProximity) {
      this.dom.toggleProximity.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        proximityManager.setEnabled(enabled);
        if (this.dom.proximityStatusText) {
          this.dom.proximityStatusText.textContent = enabled ? 'Enabled' : 'Disabled';
        }
        if (this.dom.proximitySubSettings) {
          this.dom.proximitySubSettings.style.display = enabled ? 'flex' : 'none';
        }
        this.showToast(enabled ? '📍 Nearby memory alerts active' : 'Nearby alerts paused');
      });
    }

    if (this.dom.proximityRadius) {
      this.dom.proximityRadius.addEventListener('input', (e) => {
        const radius = parseInt(e.target.value, 10);
        proximityManager.setRadius(radius);
        if (this.dom.proximityRadiusLabel) {
          this.dom.proximityRadiusLabel.textContent = `${radius}m`;
        }
      });
    }

    if (this.dom.btnRequestNotification) {
      this.dom.btnRequestNotification.addEventListener('click', async () => {
        const perm = await proximityManager.requestNotificationPermission();
        this._updateNotificationPermStatus();
        if (perm === 'granted') {
          this.showToast('🔔 System notifications enabled!');
        } else if (perm === 'denied') {
          this.showToast('⚠️ Notifications blocked in browser');
        }
      });
    }

    // Settings actions
    if (this.dom.btnSaveKey) {
      this.dom.btnSaveKey.addEventListener('click', () => this.handleSaveApiKey());
    }
    if (this.dom.btnExport) {
      this.dom.btnExport.addEventListener('click', () => this.handleExportMemories());
    }
    if (this.dom.btnClearData) {
      this.dom.btnClearData.addEventListener('click', () => this.handleClearData());
    }
  }

  /**
   * Switches the active view/tab.
   * @param {'camera'|'map'|'memories'|'settings'} viewName
   */
  async switchView(viewName) {
    if (!this.dom.views[viewName]) return;

    // Camera resource management: stop camera when leaving camera view
    if (this.currentView === 'camera' && viewName !== 'camera') {
      cameraManager.stopCamera();
    }

    this.currentView = viewName;

    // Update active view visibility
    Object.keys(this.dom.views).forEach((key) => {
      const el = this.dom.views[key];
      if (key === viewName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Update bottom nav state
    this.dom.navButtons.forEach((btn) => {
      if (btn.getAttribute('data-view') === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Handle view-specific activations
    if (viewName === 'camera') {
      if (!this.pendingCapture) {
        this.startLiveCamera();
      }
    } else if (viewName === 'map') {
      await this.activateMapView();
    } else if (viewName === 'memories') {
      await this.refreshMemories();
      this.renderMemoriesGrid();
    } else if (viewName === 'settings') {
      this.updateStatsView();
    }
  }

  /**
   * Starts the camera preview stream.
   */
  async startLiveCamera() {
    if (!this.dom.videoPreview) return;
    try {
      await cameraManager.startCamera(this.dom.videoPreview);
    } catch (err) {
      console.warn('Camera preview failed:', err);
      this.showToast('📷 Camera not accessible. Use upload button.');
    }
  }

  /**
   * Flips between front and back camera.
   */
  async handleFlipCamera() {
    if (!this.dom.videoPreview) return;
    try {
      await cameraManager.flipCamera(this.dom.videoPreview);
      this.showToast('🔄 Camera flipped');
    } catch (err) {
      console.warn('Flip camera error:', err);
      this.showToast('Could not flip camera');
    }
  }

  /**
   * Captures a photo from the live video feed and starts GPS + AI analysis.
   */
  async handleCapturePhoto() {
    if (!this.dom.videoPreview || !this.dom.cameraCanvas) return;

    try {
      const { dataUrl, blob } = await cameraManager.capturePhoto(
        this.dom.videoPreview,
        this.dom.cameraCanvas
      );

      // Stop camera while user inspects preview
      cameraManager.stopCamera();

      await this.showCapturePreview(dataUrl, blob);
    } catch (err) {
      console.error('Photo capture failed:', err);
      this.showToast('Failed to capture photo');
    }
  }

  /**
   * Handles photo file upload (e.g. from gallery or camera fallback).
   */
  async handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      this.showToast('Reading photo...');
      const uploaded = await cameraManager.processUploadedFiles(files);
      if (uploaded.length > 0) {
        const { dataUrl, blob, exifLocation } = uploaded[0];
        cameraManager.stopCamera();
        await this.showCapturePreview(dataUrl, blob, exifLocation);
      }
    } catch (err) {
      console.error('Upload processing failed:', err);
      this.showToast('Failed to read image file');
    } finally {
      if (event.target) event.target.value = '';
    }
  }

  /**
   * Shows the captured photo preview and kicks off location tracking + AI analysis.
   * @param {string} dataUrl
   * @param {Blob} blob
   * @param {{lat: number, lng: number}|null} [presetLocation]
   */
  async showCapturePreview(dataUrl, blob, presetLocation = null) {
    this.pendingCapture = {
      photoDataUrl: dataUrl,
      blob,
      lat: presetLocation ? presetLocation.lat : 20.5937, // default center
      lng: presetLocation ? presetLocation.lng : 78.9629,
      locationName: 'Fetching location...',
      timestamp: Date.now(),
      description: 'Analyzing with Gemini...',
    };

    if (this.dom.capturedImage) this.dom.capturedImage.src = dataUrl;
    if (this.dom.captureLocation) this.dom.captureLocation.textContent = '📍 Getting location...';
    if (this.dom.captureAiDesc) this.dom.captureAiDesc.textContent = '🤖 Analyzing image with AI...';

    if (this.dom.capturePreview) {
      this.dom.capturePreview.classList.remove('hidden');
    }

    // 1. Get GPS Location & Reverse Geocode
    const locationPromise = (async () => {
      try {
        let lat, lng;
        if (presetLocation && typeof presetLocation.lat === 'number' && typeof presetLocation.lng === 'number') {
          lat = presetLocation.lat;
          lng = presetLocation.lng;
        } else {
          const coords = await cameraManager.getLocation();
          lat = coords.lat;
          lng = coords.lng;
        }

        this.pendingCapture.lat = lat;
        this.pendingCapture.lng = lng;

        const placeName = await cameraManager.reverseGeocode(lat, lng);
        this.pendingCapture.locationName = placeName;
        if (this.dom.captureLocation) {
          this.dom.captureLocation.textContent = `📍 ${placeName}`;
        }
      } catch (locErr) {
        console.warn('Location lookup fallback:', locErr);
        this.pendingCapture.locationName = 'Unknown Location';
        if (this.dom.captureLocation) {
          this.dom.captureLocation.textContent = '📍 Location unavailable (GPS off or denied)';
        }
      }
    })();

    // 2. Run Gemini AI Vision Analysis
    const aiPromise = (async () => {
      try {
        const caption = await aiAnalyzer.analyzePhoto(dataUrl);
        this.pendingCapture.description = caption;
        if (this.dom.captureAiDesc) {
          this.dom.captureAiDesc.textContent = `✨ ${caption}`;
        }
      } catch (aiErr) {
        console.error('AI caption failed:', aiErr);
        this.pendingCapture.description = 'A captured personal memory.';
        if (this.dom.captureAiDesc) {
          this.dom.captureAiDesc.textContent = '✨ Memory captured';
        }
      }
    })();

    await Promise.allSettled([locationPromise, aiPromise]);
  }

  /**
   * Saves the pending capture to IndexedDB.
   */
  async savePendingMemory() {
    if (!this.pendingCapture) return;

    try {
      this.showToast('Saving memory...');
      const savedId = await memoryStore.saveMemory(this.pendingCapture);
      const savedMemory = { ...this.pendingCapture, id: savedId };

      this.showToast('✅ Memory saved to map!');
      this.discardPendingMemory();

      // Refresh cache and jump to Map tab
      await this.refreshMemories();
      await this.switchView('map');

      // Fly to newly saved marker once map is ready
      if (this.isMapInitialized && savedMemory) {
        mapManager.flyToMemory(savedMemory);
      }
    } catch (err) {
      console.error('Save memory error:', err);
      this.showToast('Failed to save memory');
    }
  }

  /**
   * Discards the pending capture and returns to the live camera.
   */
  discardPendingMemory() {
    this.pendingCapture = null;
    if (this.dom.capturePreview) {
      this.dom.capturePreview.classList.add('hidden');
    }
    if (this.currentView === 'camera') {
      this.startLiveCamera();
    }
  }

  /**
   * Activates and renders the Map view.
   */
  async activateMapView() {
    if (!this.dom.mapContainer) return;

    if (!this.isMapInitialized) {
      try {
        mapManager.init('map-container');
        this.isMapInitialized = true;
      } catch (err) {
        console.error('Map init error:', err);
        this.showToast('Failed to load map library');
        return;
      }
    }

    // Leaflet needs invalidateSize() after unhiding container
    setTimeout(() => {
      mapManager.invalidateSize();
    }, 150);

    await this.refreshMemories();
    await mapManager.loadMemories(this.allMemories);
  }

  /**
   * Refreshes memories list from storage.
   */
  async refreshMemories() {
    try {
      this.allMemories = await memoryStore.getAllMemories();
      proximityManager.updateMemories(this.allMemories);
    } catch (err) {
      console.error('Failed to get memories:', err);
      this.allMemories = [];
    }
  }

  /**
   * Handles timeline slider changes for filtering map markers.
   */
  handleTimelineChange(event) {
    const val = parseInt(event.target.value, 10);
    if (!this.allMemories || this.allMemories.length === 0) return;

    if (val >= 100) {
      if (this.dom.timelineLabel) this.dom.timelineLabel.textContent = 'All Time';
      mapManager.showAllMarkers();
      return;
    }

    // Find min and max dates
    const timestamps = this.allMemories
      .map((m) => Number(new Date(m.timestamp).getTime()))
      .filter((ts) => !isNaN(ts));

    if (timestamps.length === 0) return;

    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    const range = maxTs - minTs;

    // Filter up to fraction of time
    const cutoffTs = minTs + (range * (val / 100));
    mapManager.filterByDate(minTs, cutoffTs);

    const cutoffDate = new Date(cutoffTs).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric',
    });
    if (this.dom.timelineLabel) {
      this.dom.timelineLabel.textContent = `≤ ${cutoffDate}`;
    }
  }

  /**
   * Renders the Memories gallery view.
   */
  renderMemoriesGrid() {
    if (!this.dom.memoriesGrid || !this.dom.noMemories) return;

    const sortType = this.dom.sortMemories ? this.dom.sortMemories.value : 'newest';
    let memories = [...this.allMemories];

    if (memories.length === 0) {
      this.dom.memoriesGrid.innerHTML = '';
      this.dom.noMemories.style.display = 'flex';
      return;
    }

    this.dom.noMemories.style.display = 'none';

    // Sorting
    if (sortType === 'newest') {
      memories.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } else if (sortType === 'oldest') {
      memories.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    } else if (sortType === 'location') {
      memories.sort((a, b) => (a.locationName || '').localeCompare(b.locationName || ''));
    }

    this.dom.memoriesGrid.innerHTML = memories
      .map((m) => {
        const dateStr = new Date(m.timestamp || Date.now()).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        return `
          <div class="memory-card" data-id="${m.id}">
            <img class="memory-card-thumb" src="${m.photoDataUrl}" alt="${this._escapeHtml(m.locationName || 'Memory')}" loading="lazy" />
            <div class="memory-card-body">
              <div class="memory-card-location">📍 ${this._escapeHtml(m.locationName || 'Unknown')}</div>
              <div class="memory-card-date">🕒 ${dateStr}</div>
              <div class="memory-card-desc">${this._escapeHtml(m.description || 'No description')}</div>
            </div>
          </div>
        `;
      })
      .join('');

    // Attach click listener to each card
    this.dom.memoriesGrid.querySelectorAll('.memory-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        this.openMemoryModalById(id);
      });
    });
  }

  /**
   * Opens the memory modal given an ID.
   * @param {string|number} id
   */
  async openMemoryModalById(id) {
    const memory = this.allMemories.find((m) => String(m.id) === String(id));
    if (memory) {
      this.openMemoryModal(memory);
    } else {
      try {
        const fetched = await memoryStore.getMemory(Number(id));
        if (fetched) this.openMemoryModal(fetched);
      } catch (err) {
        console.error('Could not load memory for modal:', err);
      }
    }
  }

  /**
   * Displays details for a single memory in a modal.
   * @param {Object} memory
   */
  openMemoryModal(memory) {
    if (!this.dom.modal || !memory) return;
    this.activeModalMemory = memory;

    if (this.dom.modalImage) this.dom.modalImage.src = memory.photoDataUrl;
    if (this.dom.modalLocation) this.dom.modalLocation.textContent = `📍 ${memory.locationName || 'Unknown Location'}`;
    if (this.dom.modalDate) {
      const date = new Date(memory.timestamp || Date.now());
      this.dom.modalDate.textContent = `🕒 ${date.toLocaleString()}`;
    }
    if (this.dom.modalDescription) {
      this.dom.modalDescription.textContent = memory.description || 'No description yet.';
    }

    this.dom.modal.classList.remove('hidden');
  }

  /**
   * Closes the memory detail modal.
   */
  closeMemoryModal() {
    this.activeModalMemory = null;
    if (this.dom.modal) {
      this.dom.modal.classList.add('hidden');
    }
  }

  /**
   * Re-analyzes the active memory's photo using Gemini AI.
   */
  async reanalyzeModalMemory() {
    if (!this.activeModalMemory) return;

    const originalBtnText = this.dom.btnAnalyzeModal.textContent;
    try {
      this.dom.btnAnalyzeModal.textContent = '⏳ Analyzing...';
      this.dom.btnAnalyzeModal.disabled = true;

      const newDesc = await aiAnalyzer.analyzePhoto(this.activeModalMemory.photoDataUrl);
      this.activeModalMemory.description = newDesc;

      // Update in storage
      await memoryStore.updateDescription(this.activeModalMemory.id, newDesc);

      if (this.dom.modalDescription) {
        this.dom.modalDescription.textContent = newDesc;
      }

      this.showToast('✨ Updated with AI description!');
      await this.refreshMemories();
    } catch (err) {
      console.error('Re-analysis error:', err);
      this.showToast('AI analysis failed');
    } finally {
      this.dom.btnAnalyzeModal.textContent = originalBtnText;
      this.dom.btnAnalyzeModal.disabled = false;
    }
  }

  /**
   * Deletes the currently open memory.
   */
  async deleteActiveMemory() {
    if (!this.activeModalMemory) return;

    if (!confirm('Are you sure you want to delete this memory?')) return;

    try {
      await memoryStore.deleteMemory(this.activeModalMemory.id);
      this.showToast('🗑️ Memory deleted');
      this.closeMemoryModal();

      await this.refreshMemories();
      if (this.currentView === 'memories') {
        this.renderMemoriesGrid();
      } else if (this.currentView === 'map' && this.isMapInitialized) {
        await mapManager.loadMemories(this.allMemories);
      }
    } catch (err) {
      console.error('Delete error:', err);
      this.showToast('Failed to delete memory');
    }
  }

  /**
   * Saves and tests the Gemini API key in Settings.
   */
  async handleSaveApiKey() {
    const key = (this.dom.apiKeyInput?.value || '').trim();
    if (!key) {
      this._setKeyStatus('Please enter an API key', 'error');
      return;
    }

    this._setKeyStatus('Validating key with Google Gemini...', '');

    const test = await aiAnalyzer.testApiKey(key);
    if (test.valid) {
      localStorage.setItem('nostalgic_gemini_api_key', key);
      aiAnalyzer.setApiKey(key);
      this._setKeyStatus('✅ Valid Gemini API key saved!', 'success');
      this.showToast('Gemini API key connected!');
    } else {
      this._setKeyStatus(`❌ Invalid key: ${test.error || 'Failed'}`, 'error');
    }
  }

  /**
   * Helper to set status message in Settings.
   * @private
   */
  _setKeyStatus(msg, className) {
    if (!this.dom.keyStatus) return;
    this.dom.keyStatus.textContent = msg;
    this.dom.keyStatus.className = className;
  }

  /**
   * Exports all memories as a JSON file.
   */
  async handleExportMemories() {
    try {
      const data = await memoryStore.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nostalgic-map-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('📤 Memories exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      this.showToast('Failed to export memories');
    }
  }

  /**
   * Clears all stored memories.
   */
  async handleClearData() {
    if (!confirm('Are you sure you want to delete ALL memories? This cannot be undone.')) {
      return;
    }

    try {
      await memoryStore.clearAll();
      this.allMemories = [];
      this.showToast('All memories cleared');
      this.updateStatsView();
      if (this.isMapInitialized) {
        await mapManager.loadMemories([]);
      }
    } catch (err) {
      console.error('Clear error:', err);
      this.showToast('Failed to clear data');
    }
  }

  /**
   * Updates stats in Settings view.
   */
  async updateStatsView() {
    if (!this.dom.statsInfo) return;
    try {
      const count = await memoryStore.getCount();
      this.dom.statsInfo.innerHTML = `
        <strong>Total Memories:</strong> ${count}<br>
        <strong>Storage:</strong> IndexedDB (On-Device)<br>
        <strong>AI Vision:</strong> Gemini 2.0 Flash
      `;
    } catch (err) {
      this.dom.statsInfo.textContent = 'Could not load stats';
    }
  }

  /**
   * Displays a temporary toast notification.
   * @param {string} message
   */
  showToast(message) {
    if (!this.dom.toast) return;
    this.dom.toast.textContent = message;
    this.dom.toast.classList.remove('hidden');

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.dom.toast.classList.add('hidden');
    }, 3000);
  }

  /**
   * Safely escapes HTML special characters.
   * @private
   */
  _escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// Instantiate and start app on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  const app = new NostalgicMapApp();
  app.init();
  window.nostalgicMapApp = app; // Expose for debugging if needed
});
