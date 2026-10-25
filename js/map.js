/**
 * @file map.js
 * @description Map visualization module using Leaflet.js and MarkerCluster for the Nostalgic Map PWA.
 * Note: Leaflet (L) and MarkerCluster are loaded globally via CDN in index.html.
 */

/**
 * @typedef {Object} Memory
 * @property {string|number} id - Unique identifier for the memory.
 * @property {number} lat - Latitude coordinate.
 * @property {number} lng - Longitude coordinate.
 * @property {string} [photoDataUrl] - Base64 image data URL or image path.
 * @property {string} [locationName] - Name or address of the location.
 * @property {number|string|Date} [timestamp] - Timestamp when the memory occurred or was recorded.
 * @property {string} [description] - Textual description or caption of the memory.
 */

/**
 * Manages the Leaflet map, tile layers, marker clustering, and memory popups.
 */
export class MapManager {
  /**
   * Initializes the MapManager instance with default properties.
   */
  constructor() {
    /** @type {L.Map|null} */
    this.map = null;

    /** @type {L.MarkerClusterGroup|null} */
    this.clusterGroup = null;

    /** @type {Array<{memory: Memory, marker: L.Marker}>} */
    this.markerRecords = [];

    /** @type {boolean} */
    this._hasClickDelegate = false;
  }

  /**
   * Initializes the Leaflet map within the specified container.
   * Configures CartoDB Dark Matter tile layer and creates a MarkerCluster group.
   *
   * @param {string|HTMLElement} containerId - The ID or DOM element of the map container.
   * @returns {L.Map} The initialized Leaflet map instance.
   */
  init(containerId) {
    if (typeof L === 'undefined') {
      throw new Error('Leaflet library (L) is not loaded. Ensure Leaflet CDN is included in index.html.');
    }

    // Clean up existing map instance if already initialized
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.clusterGroup = null;
      this.markerRecords = [];
    }

    // Create Leaflet map centered at India [20.5937, 78.9629] with zoom 5
    this.map = L.map(containerId, {
      zoomControl: true,
      maxZoom: 19
    }).setView([20.5937, 78.9629], 5);

    // OpenStreetMap CartoDB Dark Matter tiles
    const darkTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    const tileAttribution =
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors ' +
      '&copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

    L.tileLayer(darkTileUrl, {
      attribution: tileAttribution,
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(this.map);

    // Initialize MarkerCluster group
    if (typeof L.markerClusterGroup === 'function') {
      this.clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 50
      });
      this.map.addLayer(this.clusterGroup);
    } else {
      console.warn('Leaflet.markercluster is not available. Falling back to standard LayerGroup.');
      this.clusterGroup = L.layerGroup();
      this.map.addLayer(this.clusterGroup);
    }

    // Attach event delegation for popup 'View' button clicks
    this._setupEventDelegation();

    return this.map;
  }

  /**
   * Loads an array of memories, clears existing markers, creates clustered markers with popups,
   * and adjusts the map view to fit all markers.
   *
   * @param {Memory[]} memories - Array of memory objects to display.
   * @returns {Promise<void>}
   */
  async loadMemories(memories) {
    if (!this.clusterGroup) {
      console.error('Map is not initialized. Call init(containerId) first.');
      return;
    }

    // Clear existing markers
    this.clusterGroup.clearLayers();
    this.markerRecords = [];

    if (!Array.isArray(memories) || memories.length === 0) {
      return;
    }

    const markersToAdd = [];

    for (const memory of memories) {
      const marker = this._createMarker(memory);
      if (marker) {
        this.markerRecords.push({ memory, marker });
        markersToAdd.push(marker);
      }
    }

    if (markersToAdd.length > 0) {
      if (typeof this.clusterGroup.addLayers === 'function') {
        this.clusterGroup.addLayers(markersToAdd);
      } else {
        markersToAdd.forEach((m) => this.clusterGroup.addLayer(m));
      }

      // Fit bounds to show all markers
      if (this.map && typeof this.clusterGroup.getBounds === 'function') {
        const bounds = this.clusterGroup.getBounds();
        if (bounds && bounds.isValid()) {
          this.map.invalidateSize();
          this.map.fitBounds(bounds.pad(0.1));
        }
      }
    }
  }

  /**
   * Filters visible markers by date range [startTimestamp, endTimestamp].
   * Temporarily removes non-matching markers from the cluster group.
   *
   * @param {number} startTimestamp - Earliest timestamp in milliseconds.
   * @param {number} endTimestamp - Latest timestamp in milliseconds.
   */
  filterByDate(startTimestamp, endTimestamp) {
    if (!this.clusterGroup) return;

    this.clusterGroup.clearLayers();

    const matchingMarkers = this.markerRecords
      .filter((record) => {
        const ts = Number(new Date(record.memory.timestamp).getTime());
        return !isNaN(ts) && ts >= startTimestamp && ts <= endTimestamp;
      })
      .map((record) => record.marker);

    if (matchingMarkers.length > 0) {
      if (typeof this.clusterGroup.addLayers === 'function') {
        this.clusterGroup.addLayers(matchingMarkers);
      } else {
        matchingMarkers.forEach((m) => this.clusterGroup.addLayer(m));
      }
    }
  }

  /**
   * Re-adds all markers to the cluster group, removing any active date filtering.
   */
  showAllMarkers() {
    if (!this.clusterGroup) return;

    this.clusterGroup.clearLayers();
    const allMarkers = this.markerRecords.map((record) => record.marker);

    if (allMarkers.length > 0) {
      if (typeof this.clusterGroup.addLayers === 'function') {
        this.clusterGroup.addLayers(allMarkers);
      } else {
        allMarkers.forEach((m) => this.clusterGroup.addLayer(m));
      }
    }
  }

  /**
   * Adds a single memory marker to the existing cluster group without clearing other markers.
   *
   * @param {Memory} memory - Memory object to add.
   * @returns {L.Marker|null} The created Leaflet marker or null if invalid coordinates.
   */
  addSingleMarker(memory) {
    if (!this.clusterGroup) {
      console.error('Map is not initialized. Call init(containerId) first.');
      return null;
    }

    const marker = this._createMarker(memory);
    if (marker) {
      this.markerRecords.push({ memory, marker });
      this.clusterGroup.addLayer(marker);
    }
    return marker;
  }

  /**
   * Smoothly pans and zooms the map to focus on the specified memory at zoom level 16.
   *
   * @param {Memory} memory - The memory object containing lat and lng coordinates.
   */
  flyToMemory(memory) {
    if (!this.map || !memory || typeof memory.lat !== 'number' || typeof memory.lng !== 'number') {
      console.warn('Cannot fly to memory: invalid map or coordinates', memory);
      return;
    }

    this.map.flyTo([memory.lat, memory.lng], 16, {
      duration: 1.5
    });

    // Automatically open popup if marker exists
    const record = this.markerRecords.find((r) => r.memory.id === memory.id);
    if (record && record.marker) {
      setTimeout(() => {
        record.marker.openPopup();
      }, 1500);
    }
  }

  /**
   * Re-calculates the map container size and redraws tiles.
   * Must be called whenever the map container transitions from hidden to visible.
   */
  invalidateSize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }

  /**
   * Creates a custom purple Leaflet DivIcon with the 📍 emoji pin.
   *
   * @returns {L.DivIcon} Custom marker icon.
   */
  createCustomIcon() {
    return L.divIcon({
      className: 'nostalgic-marker-wrapper',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background-color: #6c5ce7;
          border: 2px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        ">
          <span style="
            transform: rotate(45deg);
            font-size: 15px;
            line-height: 1;
            user-select: none;
            display: inline-block;
          ">📍</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
  }

  /**
   * Builds the HTML content for a memory popup.
   *
   * @private
   * @param {Memory} memory - The memory object.
   * @returns {string} Safe HTML string for the popup.
   */
  _createPopupHtml(memory) {
    const location = this._escapeHtml(memory.locationName || 'Unknown Location');

    let dateText = 'Unknown date';
    if (memory.timestamp) {
      const date = new Date(memory.timestamp);
      if (!isNaN(date.getTime())) {
        dateText = date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    }

    const photoHtml = memory.photoDataUrl
      ? `<img src="${memory.photoDataUrl}" alt="${location}" style="width: 100px; height: 75px; object-fit: cover; border-radius: 6px; display: block; margin: 0 auto 8px auto; box-shadow: 0 2px 5px rgba(0,0,0,0.25);" />`
      : '';

    return `
      <div class="nostalgic-map-popup" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #2d3436; text-align: center; min-width: 110px;">
        ${photoHtml}
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px; color: #1e272e; word-break: break-word;">${location}</div>
        <div style="font-size: 11px; color: #636e72; margin-bottom: 8px;">${dateText}</div>
        <button type="button" class="view-memory-btn" data-id="${this._escapeHtml(String(memory.id))}" style="
          background-color: #6c5ce7;
          color: #ffffff;
          border: none;
          border-radius: 4px;
          padding: 5px 14px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s ease, transform 0.1s ease;
          outline: none;
          box-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
        ">View</button>
      </div>
    `;
  }

  /**
   * Creates an L.Marker instance with custom icon and popup for a given memory.
   *
   * @private
   * @param {Memory} memory - Memory data.
   * @returns {L.Marker|null} Configured Leaflet marker or null if coordinates are invalid.
   */
  _createMarker(memory) {
    const lat = Number(memory.lat);
    const lng = Number(memory.lng);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('Invalid coordinates for memory:', memory);
      return null;
    }

    const marker = L.marker([lat, lng], {
      icon: this.createCustomIcon()
    });

    const popupContent = this._createPopupHtml(memory);
    marker.bindPopup(popupContent, {
      maxWidth: 240,
      className: 'nostalgic-leaflet-popup'
    });

    // Attach direct click handler when popup DOM element opens
    marker.on('popupopen', () => {
      const popupEl = marker.getPopup()?.getElement();
      if (popupEl) {
        const viewBtn = popupEl.querySelector('.view-memory-btn');
        if (viewBtn) {
          viewBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._dispatchMemorySelect(memory.id, memory);
          };
        }
      }
    });

    return marker;
  }

  /**
   * Sets up global event delegation for popup 'View' button clicks.
   *
   * @private
   */
  _setupEventDelegation() {
    if (this._hasClickDelegate) return;

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target && target.classList && target.classList.contains('view-memory-btn')) {
        const memoryId = target.getAttribute('data-id');
        if (memoryId) {
          const record = this.markerRecords.find((r) => String(r.memory.id) === String(memoryId));
          this._dispatchMemorySelect(memoryId, record ? record.memory : null);
        }
      }
    });

    this._hasClickDelegate = true;
  }

  /**
   * Dispatches the custom 'memory-select' event on the document.
   *
   * @private
   * @param {string|number} id - Memory ID.
   * @param {Memory|null} [memory] - Associated memory object if available.
   */
  _dispatchMemorySelect(id, memory = null) {
    const event = new CustomEvent('memory-select', {
      bubbles: true,
      detail: { id, memory }
    });
    document.dispatchEvent(event);
  }

  /**
   * Safely escapes HTML special characters to prevent XSS.
   *
   * @private
   * @param {string} str - Raw input string.
   * @returns {string} Escaped string.
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

/**
 * Singleton instance of MapManager.
 */
export const mapManager = new MapManager();
