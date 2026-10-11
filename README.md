# 🚀 AirShare — Local Wi-Fi File Sharing Server

A fast, private, and modern file-sharing website hosted directly from your laptop. Anyone connected to the same home or office Wi-Fi can upload, download, and preview files without installing any apps or cables.

![AirShare Preview](public/css/style.css)

---

## ✨ Features

- ⚡ **Direct Wi-Fi Transfer:** Blazing fast transfer speeds powered directly by your local network.
- 📱 **QR Code Quick Connect:** Tap "Connect Phone" to scan a QR code from any smartphone camera and immediately open the site.
- 👁️ **In-Browser File Previews:**
  - 🖼️ **Images:** Instant high-res previews with thumbnails (PNG, JPG, SVG, WebP, GIF).
  - 🎥 **Videos:** Stream and scrub videos with native playback (MP4, WebM).
  - 🎵 **Audio:** Built-in audio player for MP3, WAV, AAC, etc.
  - 📄 **PDFs:** In-browser document viewer.
  - 💻 **Code & Text:** Syntax and formatted text viewer (TXT, JS, PY, JSON, MD, etc.).
- 📦 **Download All (.zip):** One-click download of all uploaded files bundled into a ZIP archive.
- 🔍 **Instant Search & Category Filters:** Quickly filter files by Photos, Videos, Audio, PDFs, Docs, Code, or Archives.
- 📊 **Live Storage Tracker:** View total uploaded files and used disk storage in real-time.
- 🛡️ **Private & Local:** All files stay on your laptop in the `uploads/` folder—no cloud servers or third parties involved.

---

## 🚀 Quick Start

### 1. Start the Server
Make sure you are in the project folder and run:
```bash
npm start
```

For auto-reloading during development:
```bash
npm run dev
```

### 2. Accessing from your Laptop
Open your browser and navigate to:
```
http://localhost:3000
```

### 3. Accessing from Mobile Phones & Other Devices
1. Ensure your phone or tablet is connected to the **same Wi-Fi network** as your laptop.
2. In the web interface on your laptop, click **"Connect Phone"** to display the QR code.
3. Open your phone's camera and scan the QR code, or type the Wi-Fi address shown on your screen (e.g. `http://192.168.1.X:3000`).

---

## ⚙️ Configuration

- **Change Port:** By default, AirShare runs on port `3000`. You can change it with the `PORT` environment variable:
  ```powershell
  $env:PORT="8080"; npm start
  ```
- **Storage Location:** All uploaded files are saved in the [uploads/](file:///c:/Users/Ayush/file-sharing/uploads) folder in this repository.

---

## 🛠️ Tech Stack
- **Backend:** Node.js, Express 5, Multer, Archiver, QRCode, Mime-Types
- **Frontend:** Vanilla HTML5, Modern CSS (Glassmorphism, Dark Mode), Vanilla JavaScript
- **Icons & Fonts:** Phosphor Icons, Google Fonts (Outfit, Plus Jakarta Sans, JetBrains Mono)
