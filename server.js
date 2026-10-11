const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const archiver = require('archiver');
const QRCode = require('qrcode');
const mime = require('mime-types');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const METADATA_FILE = path.join(UPLOADS_DIR, '.metadata.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Metadata storage helper functions
function loadMetadata() {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const data = fs.readFileSync(METADATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading metadata file, initializing empty:', err.message);
  }
  return {};
}

function saveMetadata(meta) {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(meta, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving metadata:', err.message);
  }
}

// Determine file category for icons and preview handling
function getFileCategory(mimeType, filename) {
  if (!mimeType) {
    mimeType = mime.lookup(filename) || 'application/octet-stream';
  }
  const ext = path.extname(filename).toLowerCase().replace('.', '');

  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (
    ['txt', 'md', 'json', 'js', 'html', 'css', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'sh', 'xml', 'yaml', 'yml', 'ts', 'jsx', 'tsx', 'sql', 'log', 'env'].includes(ext) ||
    mimeType.startsWith('text/')
  ) {
    return 'code';
  }
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'csv', 'rtf'].includes(ext)) {
    return 'document';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return 'archive';
  }
  return 'other';
}

// Format file size
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Get network IP addresses of this laptop
function getLocalNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // IPv4 and not localhost
      if (iface.family === 'IPv4' && !iface.internal) {
        // Classify interface type if possible
        const isWifi = /wi-?fi|wireless|wlan/i.test(name);
        addresses.push({
          interface: name,
          ip: iface.address,
          isWifi
        });
      }
    }
  }

  // Prioritize Wi-Fi interface if present, otherwise first available
  addresses.sort((a, b) => (b.isWifi ? 1 : 0) - (a.isWifi ? 1 : 0));
  const primaryIp = addresses.length > 0 ? addresses[0].ip : 'localhost';

  return { addresses, primaryIp };
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate safe unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Sanitize extension
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    cb(null, `${uniqueSuffix}-${baseName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    // 5GB max file size limit
    fileSize: 5 * 1024 * 1024 * 1024
  }
});

// Sync disk files with metadata in case files are added/removed outside the API
function syncFiles() {
  const metadata = loadMetadata();
  let modified = false;

  const diskFiles = fs.readdirSync(UPLOADS_DIR).filter(f => !f.startsWith('.'));
  const diskFileSet = new Set(diskFiles);

  // Remove deleted files from metadata
  for (const id of Object.keys(metadata)) {
    if (!diskFileSet.has(metadata[id].storedName)) {
      delete metadata[id];
      modified = true;
    }
  }

  // Add any unrecorded disk files
  for (const filename of diskFiles) {
    const existing = Object.values(metadata).find(m => m.storedName === filename);
    if (!existing) {
      const filePath = path.join(UPLOADS_DIR, filename);
      const stat = fs.statSync(filePath);
      const id = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      const detectedMime = mime.lookup(filename) || 'application/octet-stream';
      metadata[id] = {
        id,
        storedName: filename,
        originalName: filename,
        size: stat.size,
        mimeType: detectedMime,
        category: getFileCategory(detectedMime, filename),
        uploadedAt: stat.birthtime || stat.mtime
      };
      modified = true;
    }
  }

  if (modified) {
    saveMetadata(metadata);
  }

  return metadata;
}

// --- API ROUTES ---

// Server and network info
app.get('/api/info', async (req, res) => {
  try {
    const network = getLocalNetworkInfo();
    const primaryUrl = `http://${network.primaryIp}:${PORT}`;
    const qrDataUrl = await QRCode.toDataURL(primaryUrl, {
      margin: 2,
      width: 250,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    const metadata = syncFiles();
    const files = Object.values(metadata);
    const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

    res.json({
      hostname: os.hostname(),
      port: PORT,
      primaryIp: network.primaryIp,
      primaryUrl,
      interfaces: network.addresses,
      qrCode: qrDataUrl,
      stats: {
        totalFiles: files.length,
        totalBytes,
        formattedTotalSize: formatBytes(totalBytes)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all files
app.get('/api/files', (req, res) => {
  try {
    const metadata = syncFiles();
    const filesList = Object.values(metadata).map(f => ({
      ...f,
      formattedSize: formatBytes(f.size),
      extension: path.extname(f.originalName).toLowerCase().replace('.', '')
    }));

    // Sort newest first
    filesList.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.json(filesList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload multiple files
app.post('/api/upload', upload.array('files'), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files were uploaded.' });
    }

    const metadata = loadMetadata();
    const uploadedRecords = [];

    for (const file of req.files) {
      const id = path.parse(file.filename).name;
      const detectedMime = mime.lookup(file.originalname) || file.mimetype || 'application/octet-stream';
      const record = {
        id,
        storedName: file.filename,
        originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'), // fix utf8 filename encoding
        size: file.size,
        mimeType: detectedMime,
        category: getFileCategory(detectedMime, file.originalname),
        uploadedAt: new Date().toISOString()
      };

      metadata[id] = record;
      uploadedRecords.push({
        ...record,
        formattedSize: formatBytes(record.size)
      });
    }

    saveMetadata(metadata);
    res.json({
      message: `Successfully uploaded ${uploadedRecords.length} file(s).`,
      files: uploadedRecords
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// View file inline (for preview: images, audio, video, text, pdf)
app.get('/api/files/:id/view', (req, res) => {
  const metadata = syncFiles();
  const file = metadata[req.params.id];

  if (!file) {
    return res.status(404).send('File not found');
  }

  const filePath = path.join(UPLOADS_DIR, file.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File missing on disk');
  }

  const contentType = file.mimeType || mime.lookup(file.originalName) || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);

  // Express sendFile handles HTTP range requests (essential for audio/video seeking)
  res.sendFile(filePath);
});

// Download individual file
app.get('/api/files/:id/download', (req, res) => {
  const metadata = syncFiles();
  const file = metadata[req.params.id];

  if (!file) {
    return res.status(404).send('File not found');
  }

  const filePath = path.join(UPLOADS_DIR, file.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File missing on disk');
  }

  res.download(filePath, file.originalName, err => {
    if (err && !res.headersSent) {
      console.error('Download error:', err);
      res.status(500).send('Error downloading file');
    }
  });
});

// Delete file
app.delete('/api/files/:id', (req, res) => {
  try {
    const metadata = syncFiles();
    const file = metadata[req.params.id];

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(UPLOADS_DIR, file.storedName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    delete metadata[req.params.id];
    saveMetadata(metadata);

    res.json({ success: true, message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download all files as a ZIP archive
app.get('/api/download-all', (req, res) => {
  const metadata = syncFiles();
  const files = Object.values(metadata);

  if (files.length === 0) {
    return res.status(400).send('No files to download');
  }

  const archive = archiver('zip', { zlib: { level: 6 } });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const zipName = `files-archive-${timestamp}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  archive.on('error', err => {
    console.error('Archiver error:', err);
    if (!res.headersSent) res.status(500).send({ error: err.message });
  });

  archive.pipe(res);

  // Keep track of added names to avoid duplicate collisions in zip
  const usedNames = new Set();
  for (const file of files) {
    const filePath = path.join(UPLOADS_DIR, file.storedName);
    if (fs.existsSync(filePath)) {
      let entryName = file.originalName;
      let counter = 1;
      const ext = path.extname(entryName);
      const base = path.basename(entryName, ext);

      while (usedNames.has(entryName)) {
        entryName = `${base} (${counter})${ext}`;
        counter++;
      }
      usedNames.add(entryName);

      archive.file(filePath, { name: entryName });
    }
  }

  archive.finalize();
});

// Fallback to index.html for SPA behavior
app.use((req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Start Server on all interfaces (0.0.0.0)
const server = app.listen(PORT, '0.0.0.0', () => {
  const network = getLocalNetworkInfo();
  console.log('\n======================================================');
  console.log(`🚀 File Sharing Server is running!`);
  console.log(`💻 Local Laptop:   http://localhost:${PORT}`);
  if (network.addresses.length > 0) {
    console.log(`📱 Wi-Fi / LAN Devices:`);
    network.addresses.forEach(item => {
      console.log(`   👉 http://${item.ip}:${PORT}  (${item.interface})`);
    });
  } else {
    console.log(`⚠️  No external network interface detected. Ensure Wi-Fi is connected.`);
  }
  console.log('======================================================\n');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try running with PORT=3001 or another port.`);
  } else {
    console.error('Server error:', err);
  }
});
