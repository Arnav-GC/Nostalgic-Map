# 🗺️ Nostalgic Map — Your Life, Pinned on a Map

> **Take a photo. Track your GPS. Pin memories geographically across time. AI-powered scene understanding.**

A Progressive Web App (PWA) built for hackathons that transforms everyday moments into an interactive geographic memory journal. All photos and coordinates stay **100% on your device** via IndexedDB.

---

## ✨ Features

- 📸 **Smart Camera & Geotagging**:
  - Live camera stream with front/back camera flipping.
  - Automatic GPS coordinate capture with high accuracy (`navigator.geolocation`).
  - Automatic reverse geocoding via OpenStreetMap Nominatim (neighborhood, city, state).
  - Gallery / file upload support for existing photos.

- 🗺️ **Interactive Leaflet Map**:
  - Custom CartoDB Dark Matter map tiles for high-contrast aesthetic.
  - Marker clustering (`Leaflet.markercluster`) for smooth performance with hundreds of photos.
  - Interactive memory cards inside pins with quick-view actions.
  - **Timeline Slider**: Slide across time to watch memories appear chronologically.

- 🤖 **Gemini 2.0 Flash Vision AI**:
  - Analyzes captured images to describe the setting, mood, objects, and text in warm diary-like prose.
  - One-click AI re-analysis directly inside the memory detail modal.
  - Multi-memory location story generation.

- 🔒 **Privacy-First & Offline Ready**:
  - Full client-side IndexedDB database (`NostalgicMapDB`). No photos or data are uploaded to private servers.
  - Service worker precaching (`sw.js`) and PWA manifest for offline installation on Android, iOS, and Desktop.
  - Export full memory database as JSON at any time.

---

## 🚀 How to Run Locally

Because the app uses browser ES Modules and Service Workers, it should be served over HTTP/HTTPS rather than opened directly as `file://`.

### Option 1: 1-Click Launch (Recommended - Zero Dependencies)
Simply double-click **`start.bat`** in this folder (or run `.\start.bat` from PowerShell).
- Automatically starts a local HTTP server using Windows PowerShell's built-in listener.
- No Python or Node.js required.
- Automatically launches your default web browser to **`http://localhost:8080`**.

### Option 2: Python (If installed)
```powershell
python -m http.server 8080
```
Then visit: **`http://localhost:8080`**

### Option 2: VS Code Live Server
- Open `C:\Users\Arnav\Desktop\Nostalgic Map` in VS Code.
- Right click `index.html` $\rightarrow$ **"Open with Live Server"**.

### Option 3: PowerShell Built-in Web Server
You can also launch a quick PowerShell or Node `npx serve` server.

---

## 📱 Installing on Phone (PWA)
1. Ensure your computer and phone are on the same Wi-Fi network.
2. Run the local server.
3. On your phone's browser (Chrome or Safari), visit `http://<your-pc-ip>:8080`.
4. Tap **"Add to Home Screen"** or **"Install App"**.
5. Grant camera and location permissions when prompted.

---

## ⚙️ Setting up Google Gemini AI
1. Get a free API key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Open the **Settings** tab (⚙️) inside the app.
3. Paste your key and click **Save**.
4. The key is verified and stored in your browser's `localStorage`.

---

## 📂 Architecture

```
Nostalgic Map/
├── index.html            # Main PWA shell (Camera, Map, Memories, Settings views)
├── manifest.json         # PWA configuration
├── sw.js                 # Service worker with offline precaching & cache strategies
├── css/
│   └── styles.css        # Responsive dark theme, glassmorphism, animations
├── js/
│   ├── app.js            # Main application controller & event coordinator
│   ├── camera.js         # Camera stream, capture, GPS tracking & reverse geocoding
│   ├── storage.js        # IndexedDB storage layer for memories & photos
│   ├── map.js            # Leaflet map manager, clustering & timeline filtering
│   └── ai.js             # Google Gemini 2.0 Flash vision analysis & story generator
├── icons/
│   ├── icon-192.png      # PWA app icon (192x192)
│   └── icon-512.png      # PWA app icon (512x512)
└── scripts/
    └── generate_icons.ps1# Icon generation utility
```
