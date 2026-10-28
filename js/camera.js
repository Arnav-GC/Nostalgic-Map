/**
 * @file camera.js
 * @description Camera access, photo capture, GPS location, and reverse geocoding.
 */

export class CameraManager {
  constructor() {
    /** @type {MediaStream|null} */
    this.stream = null;
    /** @type {'environment'|'user'} */
    this.facingMode = 'environment';
  }

  /**
   * Starts the camera and attaches the stream to a <video> element.
   * @param {HTMLVideoElement} videoElement
   */
  async startCamera(videoElement) {
    // Stop any existing stream
    this.stopCamera();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
    } catch (err) {
      // Fallback: try without facingMode constraint
      console.warn(`Camera with ${this.facingMode} failed, trying default:`, err);
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
    }

    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.srcObject = this.stream;
    try {
      await videoElement.play();
    } catch (e) {
      console.warn('Video play warning:', e);
    }
  }

  /**
   * Flips between front and back camera.
   * @param {HTMLVideoElement} videoElement
   */
  async flipCamera(videoElement) {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    await this.startCamera(videoElement);
  }

  /**
   * Captures the current video frame as a JPEG blob + data URL.
   * @param {HTMLVideoElement} videoElement
   * @param {HTMLCanvasElement} canvasElement
   * @returns {Promise<{blob: Blob, dataUrl: string}>}
   */
  capturePhoto(videoElement, canvasElement) {
    return new Promise((resolve, reject) => {
      try {
        const width = videoElement.videoWidth;
        const height = videoElement.videoHeight;

        if (!width || !height) {
          return reject(new Error('Camera stream is still starting. Please wait a moment.'));
        }

        canvasElement.width = width;
        canvasElement.height = height;

        const ctx = canvasElement.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, width, height);

        const dataUrl = canvasElement.toDataURL('image/jpeg', 0.85);

        canvasElement.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              reject(new Error('Failed to create image blob'));
            }
          },
          'image/jpeg',
          0.85
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Stops all camera tracks.
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  /**
   * Gets the user's current GPS coordinates with automatic fallback.
   * @returns {Promise<{lat: number, lng: number, accuracy: number}>}
   */
  async getLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by your browser'));
      }

      const optionsHigh = { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 };
      const optionsLow = { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          // If high-accuracy timed out, retry with low accuracy (WiFi/cell triangulation)
          if (error.code === 3) {
            navigator.geolocation.getCurrentPosition(
              (pos2) => {
                resolve({
                  lat: pos2.coords.latitude,
                  lng: pos2.coords.longitude,
                  accuracy: pos2.coords.accuracy,
                });
              },
              (err2) => {
                reject(new Error('Location request timed out. Make sure GPS or Location is enabled.'));
              },
              optionsLow
            );
            return;
          }

          const messages = {
            1: 'Location permission denied. Please allow location access in your browser settings.',
            2: 'Location unavailable. Make sure GPS or Location is enabled on your device.',
            3: 'Location request timed out. Please try again.',
          };
          reject(new Error(messages[error.code] || 'Failed to get location'));
        },
        optionsHigh
      );
    });
  }

  /**
   * Reverse geocodes coordinates to a human-readable place name.
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<string>}
   */
  async reverseGeocode(lat, lng) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`
      );

      if (!response.ok) throw new Error('Geocoding failed');

      const data = await response.json();

      if (data.address) {
        // Build a short, readable name
        const parts = [];
        const a = data.address;

        if (a.neighbourhood || a.suburb || a.hamlet) {
          parts.push(a.neighbourhood || a.suburb || a.hamlet);
        }
        if (a.city || a.town || a.village) {
          parts.push(a.city || a.town || a.village);
        }
        if (a.state) {
          parts.push(a.state);
        }

        if (parts.length > 0) return parts.join(', ');
        if (data.display_name) {
          // Shorten to first 3 parts
          return data.display_name.split(',').slice(0, 3).join(',').trim();
        }
      }

      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (err) {
      console.warn('Reverse geocoding failed:', err);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  /**
   * Attempts to parse GPS latitude and longitude from a JPEG image blob/file.
   * @param {Blob|File} file
   * @returns {Promise<{lat: number, lng: number}|null>}
   */
  async extractExifGps(file) {
    try {
      const buffer = await file.slice(0, 131072).arrayBuffer();
      const view = new DataView(buffer);

      if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) return null;

      let offset = 2;
      const length = view.byteLength;

      while (offset < length - 4) {
        if (view.getUint8(offset) !== 0xFF) break;
        const marker = view.getUint8(offset + 1);

        if (marker === 0xE1) {
          const exifOffset = offset + 4;
          if (
            view.getUint32(exifOffset, false) === 0x45786966 &&
            view.getUint16(exifOffset + 4, false) === 0x0000
          ) {
            const tiffOffset = exifOffset + 6;
            const isLittle = view.getUint16(tiffOffset, false) === 0x4949;

            const ifd0Offset = tiffOffset + view.getUint32(tiffOffset + 4, isLittle);
            const numEntries = view.getUint16(ifd0Offset, isLittle);

            let gpsOffset = 0;
            for (let i = 0; i < numEntries; i++) {
              const entryOffset = ifd0Offset + 2 + (i * 12);
              const tag = view.getUint16(entryOffset, isLittle);
              if (tag === 0x8825) {
                gpsOffset = tiffOffset + view.getUint32(entryOffset + 8, isLittle);
                break;
              }
            }

            if (gpsOffset && gpsOffset + 2 < length) {
              const numGpsEntries = view.getUint16(gpsOffset, isLittle);
              let latRef = 'N', lngRef = 'E';
              let latParts = null, lngParts = null;

              for (let i = 0; i < numGpsEntries; i++) {
                const entryOffset = gpsOffset + 2 + (i * 12);
                if (entryOffset + 12 > length) break;
                const tag = view.getUint16(entryOffset, isLittle);
                const valOffset = tiffOffset + view.getUint32(entryOffset + 8, isLittle);

                if (tag === 1) {
                  latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
                } else if (tag === 2 && valOffset + 24 <= length) {
                  latParts = [
                    view.getUint32(valOffset, isLittle) / (view.getUint32(valOffset + 4, isLittle) || 1),
                    view.getUint32(valOffset + 8, isLittle) / (view.getUint32(valOffset + 12, isLittle) || 1),
                    view.getUint32(valOffset + 16, isLittle) / (view.getUint32(valOffset + 20, isLittle) || 1),
                  ];
                } else if (tag === 3) {
                  lngRef = String.fromCharCode(view.getUint8(entryOffset + 8));
                } else if (tag === 4 && valOffset + 24 <= length) {
                  lngParts = [
                    view.getUint32(valOffset, isLittle) / (view.getUint32(valOffset + 4, isLittle) || 1),
                    view.getUint32(valOffset + 8, isLittle) / (view.getUint32(valOffset + 12, isLittle) || 1),
                    view.getUint32(valOffset + 16, isLittle) / (view.getUint32(valOffset + 20, isLittle) || 1),
                  ];
                }
              }

              if (latParts && lngParts) {
                let lat = latParts[0] + (latParts[1] / 60) + (latParts[2] / 3600);
                let lng = lngParts[0] + (lngParts[1] / 60) + (lngParts[2] / 3600);
                if (latRef === 'S') lat = -lat;
                if (lngRef === 'W') lng = -lng;
                return { lat, lng };
              }
            }
          }
          break;
        } else {
          const markerLength = view.getUint16(offset + 2, false);
          offset += 2 + markerLength;
        }
      }
      return null;
    } catch (e) {
      console.warn('EXIF parsing skipped:', e);
      return null;
    }
  }

  /**
   * Processes uploaded image files — reads them as data URLs and extracts EXIF GPS if available.
   * @param {FileList} files
   * @returns {Promise<Array<{dataUrl: string, blob: Blob, exifLocation: {lat: number, lng: number}|null}>>}
   */
  async processUploadedFiles(files) {
    const results = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const exifLocation = await this.extractExifGps(file);

      results.push({ dataUrl, blob: file, exifLocation });
    }

    return results;
  }
}

export const cameraManager = new CameraManager();
