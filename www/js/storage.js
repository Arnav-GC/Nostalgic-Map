/**
 * @file storage.js
 * @description IndexedDB wrapper for storing photo memories locally.
 */

export class MemoryStore {
  constructor() {
    this.db = null;
    this.dbName = 'NostalgicMapDB';
    this.dbVersion = 1;
    this.storeName = 'memories';
  }

  /**
   * Opens/creates the IndexedDB database.
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('lat', 'lat', { unique: false });
          store.createIndex('lng', 'lng', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(new Error(`Failed to open database: ${event.target.error}`));
      };
    });
  }

  /**
   * Saves a memory to the store.
   * @param {Object} memory - { photoDataUrl, lat, lng, locationName, timestamp, description }
   * @returns {Promise<number>} The generated ID
   */
  async saveMemory(memory) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);

      const record = {
        photoDataUrl: memory.photoDataUrl,
        lat: memory.lat,
        lng: memory.lng,
        locationName: memory.locationName || '',
        timestamp: memory.timestamp || Date.now(),
        description: memory.description || '',
        createdAt: Date.now(),
      };

      const request = store.add(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to save memory'));
    });
  }

  /**
   * Returns all memories sorted by timestamp descending (newest first).
   * @returns {Promise<Array>}
   */
  async getAllMemories() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const memories = request.result || [];
        memories.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(memories);
      };
      request.onerror = () => reject(new Error('Failed to get memories'));
    });
  }

  /**
   * Returns a single memory by ID.
   * @param {number} id
   * @returns {Promise<Object|undefined>}
   */
  async getMemory(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get memory'));
    });
  }

  /**
   * Deletes a memory by ID.
   * @param {number} id
   */
  async deleteMemory(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete memory'));
    });
  }

  /**
   * Updates the description of a memory.
   * @param {number} id
   * @param {string} description
   */
  async updateDescription(id, description) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) return reject(new Error('Memory not found'));
        record.description = description;
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(new Error('Failed to update'));
      };
      getReq.onerror = () => reject(new Error('Failed to get memory'));
    });
  }

  /**
   * Returns the total number of stored memories.
   * @returns {Promise<number>}
   */
  async getCount() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to count'));
    });
  }

  /**
   * Deletes all memories.
   */
  async clearAll() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear'));
    });
  }

  /**
   * Exports all memories as JSON-serializable array.
   * @returns {Promise<Array>}
   */
  async exportAll() {
    const memories = await this.getAllMemories();
    return memories.map(({ id, photoDataUrl, lat, lng, locationName, timestamp, description, createdAt }) => ({
      id, photoDataUrl, lat, lng, locationName, timestamp, description, createdAt,
    }));
  }
}

export const memoryStore = new MemoryStore();
