/**
 * @file proximity.js
 * @description Geofencing and proximity detection module for Nostalgic Map.
 * Monitors device position and triggers notifications when approaching saved memory locations.
 */

export class ProximityManager {
  constructor() {
    /** @type {number|null} */
    this.watchId = null;

    /** @type {Array<Object>} */
    this.memories = [];

    /** @type {boolean} */
    this.enabled = true;

    /** @type {number} Detection threshold in meters */
    this.radiusMeters = 200;

    /** @type {number} 20 minutes cooldown per memory location */
    this.cooldownMs = 20 * 60 * 1000;

    /** @type {Map<string|number, number>} memoryId -> timestamp of last notification */
    this.lastNotified = new Map();

    /** @type {Function|null} */
    this.onNearbyMemoryCallback = null;

    /** @type {{lat: number, lng: number, accuracy: number}|null} */
    this.currentPosition = null;
  }

  /**
   * Initializes proximity tracking with memory list and alert callback.
   * @param {Array<Object>} memories
   * @param {Function} onNearbyMemory
   */
  init(memories = [], onNearbyMemory = null) {
    this.memories = memories;
    this.onNearbyMemoryCallback = onNearbyMemory;

    // Load saved preferences
    const savedEnabled = localStorage.getItem('nostalgic_proximity_enabled');
    if (savedEnabled !== null) {
      this.enabled = savedEnabled === 'true';
    }

    const savedRadius = localStorage.getItem('nostalgic_proximity_radius');
    if (savedRadius) {
      const parsed = parseInt(savedRadius, 10);
      if (!isNaN(parsed) && parsed >= 50 && parsed <= 2000) {
        this.radiusMeters = parsed;
      }
    }

    if (this.enabled) {
      this.startTracking();
    }
  }

  /**
   * Updates the memory list being tracked (e.g. after add/delete).
   * @param {Array<Object>} memories
   */
  updateMemories(memories) {
    this.memories = memories;
    if (this.currentPosition && this.enabled) {
      this.checkProximity(this.currentPosition.lat, this.currentPosition.lng);
    }
  }

  /**
   * Enables or disables proximity tracking.
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    localStorage.setItem('nostalgic_proximity_enabled', String(this.enabled));
    if (this.enabled) {
      this.startTracking();
    } else {
      this.stopTracking();
    }
  }

  /**
   * Sets the detection radius in meters.
   * @param {number} meters
   */
  setRadius(meters) {
    this.radiusMeters = Math.max(50, Math.min(2000, Number(meters) || 200));
    localStorage.setItem('nostalgic_proximity_radius', String(this.radiusMeters));
    if (this.currentPosition && this.enabled) {
      this.checkProximity(this.currentPosition.lat, this.currentPosition.lng);
    }
  }

  /**
   * Starts geolocation watchPosition.
   */
  startTracking() {
    if (this.watchId !== null || !navigator.geolocation) return;

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.currentPosition = {
          lat,
          lng,
          accuracy: position.coords.accuracy,
        };
        this.checkProximity(lat, lng);
      },
      (err) => {
        console.warn('[ProximityManager] watchPosition notice:', err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 25000,
      }
    );
  }

  /**
   * Stops geolocation watchPosition.
   */
  stopTracking() {
    if (this.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Calculates distance in meters between two lat/lng coordinates using the Haversine formula.
   * @param {number} lat1
   * @param {number} lon1
   * @param {number} lat2
   * @param {number} lon2
   * @returns {number} Distance in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const rad = Math.PI / 180;
    const phi1 = lat1 * rad;
    const phi2 = lat2 * rad;
    const deltaPhi = (lat2 - lat1) * rad;
    const deltaLambda = (lon2 - lon1) * rad;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Checks current coordinates against all saved memories and triggers alerts if within radius.
   * @param {number} userLat
   * @param {number} userLng
   */
  checkProximity(userLat, userLng) {
    if (!this.enabled || !Array.isArray(this.memories) || this.memories.length === 0) return;

    const now = Date.now();
    const nearby = [];

    for (const memory of this.memories) {
      const lat = Number(memory.lat);
      const lng = Number(memory.lng);
      if (isNaN(lat) || isNaN(lng)) continue;

      const dist = this.calculateDistance(userLat, userLng, lat, lng);
      if (dist <= this.radiusMeters) {
        nearby.push({ memory, distance: Math.round(dist) });
      }
    }

    if (nearby.length === 0) return;

    // Closest memory first
    nearby.sort((a, b) => a.distance - b.distance);
    const closest = nearby[0];

    // Check cooldown for this specific memory
    const lastTime = this.lastNotified.get(closest.memory.id) || 0;
    if (now - lastTime < this.cooldownMs) {
      return; // Already alerted recently
    }

    this.lastNotified.set(closest.memory.id, now);

    // Fire notifications
    this.notify(closest.memory, closest.distance, nearby.length);
  }

  /**
   * Dispatches system and in-app proximity notifications.
   * @param {Object} memory
   * @param {number} distance
   * @param {number} totalNearby
   */
  async notify(memory, distance, totalNearby) {
    const locName = memory.locationName || 'a saved place';
    const title = '📍 Nostalgic Map: Memory Nearby!';
    const distText = distance < 1000 ? `${distance}m away` : `${(distance / 1000).toFixed(1)}km away`;
    const countText = totalNearby > 1 ? ` (and ${totalNearby - 1} other memories)` : '';
    const body = `You are near ${locName} (${distText})${countText}. Tap to view this memory.`;

    // 1. Mobile Vibration if supported
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (e) {
        // Safe ignore
      }
    }

    // 2. System / Web Push Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(title, {
            body,
            icon: memory.photoDataUrl || 'icons/icon-192.png',
            badge: 'icons/icon-192.png',
            tag: `memory-proximity-${memory.id}`,
            data: { memoryId: memory.id },
          });
        } else {
          new Notification(title, {
            body,
            icon: memory.photoDataUrl || 'icons/icon-192.png',
            tag: `memory-proximity-${memory.id}`,
          });
        }
      } catch (err) {
        console.warn('[ProximityManager] Notification error:', err);
      }
    }

    // 3. In-App Banner callback
    if (typeof this.onNearbyMemoryCallback === 'function') {
      this.onNearbyMemoryCallback(memory, distance, totalNearby);
    }
  }

  /**
   * Requests permission for system web notifications.
   * @returns {Promise<NotificationPermission|string>}
   */
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (err) {
      return 'denied';
    }
  }
}

export const proximityManager = new ProximityManager();
