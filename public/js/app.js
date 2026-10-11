/**
 * AirShare - Local Wi-Fi File Sharing Web App
 */

// Application State
const state = {
  files: [],
  filteredFiles: [],
  currentCategory: 'all',
  currentSort: 'newest',
  viewMode: 'grid', // 'grid' | 'list'
  searchQuery: '',
  serverInfo: null
};

// DOM Elements
const networkBadge = document.getElementById('networkBadge');
const networkUrlDisplay = document.getElementById('networkUrlDisplay');
const storageStats = document.getElementById('storageStats');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const uploadProgressContainer = document.getElementById('uploadProgressContainer');
const progressTitle = document.getElementById('progressTitle');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');
const progressDetails = document.getElementById('progressDetails');

const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const categoryFilters = document.getElementById('categoryFilters');
const sortSelect = document.getElementById('sortSelect');
const viewGridBtn = document.getElementById('viewGridBtn');
const viewListBtn = document.getElementById('viewListBtn');
const refreshBtn = document.getElementById('refreshBtn');
const filesContainer = document.getElementById('filesContainer');
const emptyState = document.getElementById('emptyState');
const noSearchResults = document.getElementById('noSearchResults');
const downloadAllBtn = document.getElementById('downloadAllBtn');

// Modals
const qrBtn = document.getElementById('qrBtn');
const qrModal = document.getElementById('qrModal');
const closeQrModalBtn = document.getElementById('closeQrModalBtn');
const qrCodeImg = document.getElementById('qrCodeImg');
const qrModalUrl = document.getElementById('qrModalUrl');
const copyQrUrlBtn = document.getElementById('copyQrUrlBtn');
const networkInterfacesList = document.getElementById('networkInterfacesList');

const previewModal = document.getElementById('previewModal');
const closePreviewModalBtn = document.getElementById('closePreviewModalBtn');
const previewFileName = document.getElementById('previewFileName');
const previewFileMeta = document.getElementById('previewFileMeta');
const previewTypeIcon = document.getElementById('previewTypeIcon');
const previewDownloadBtn = document.getElementById('previewDownloadBtn');
const previewBody = document.getElementById('previewBody');
const toastContainer = document.getElementById('toastContainer');
const footerHostInfo = document.getElementById('footerHostInfo');

// Category icons map
const categoryIcons = {
  image: 'ph-fill ph-image',
  video: 'ph-fill ph-film-strip',
  audio: 'ph-fill ph-music-note',
  pdf: 'ph-fill ph-file-pdf',
  document: 'ph-fill ph-file-text',
  code: 'ph-fill ph-code',
  archive: 'ph-fill ph-file-zip',
  other: 'ph-fill ph-file'
};

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  fetchServerInfo();
  fetchFiles();
  setupEventListeners();
});

function setupEventListeners() {
  // Drag and Drop
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-active');
    });
  });

  dropZone.addEventListener('drop', e => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleUpload(files);
    }
  });

  browseBtn.addEventListener('click', e => {
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener('click', e => {
    if (!uploadProgressContainer.contains(e.target)) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleUpload(fileInput.files);
    }
  });

  // Search
  searchInput.addEventListener('input', e => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
    applyFiltersAndSort();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.style.display = 'none';
    applyFiltersAndSort();
    searchInput.focus();
  });

  // Category Filter
  categoryFilters.addEventListener('click', e => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    state.currentCategory = pill.dataset.category;
    applyFiltersAndSort();
  });

  // Sorting
  sortSelect.addEventListener('change', e => {
    state.currentSort = e.target.value;
    applyFiltersAndSort();
  });

  // View switch
  viewGridBtn.addEventListener('click', () => {
    state.viewMode = 'grid';
    viewGridBtn.classList.add('active');
    viewListBtn.classList.remove('active');
    filesContainer.className = 'files-container view-grid';
    renderFiles();
  });

  viewListBtn.addEventListener('click', () => {
    state.viewMode = 'list';
    viewListBtn.classList.add('active');
    viewGridBtn.classList.remove('active');
    filesContainer.className = 'files-container view-list';
    renderFiles();
  });

  refreshBtn.addEventListener('click', () => {
    refreshBtn.classList.add('spinning');
    fetchFiles(() => {
      showToast('Files list updated', 'info');
      refreshBtn.classList.remove('spinning');
    });
  });

  // Download All
  downloadAllBtn.addEventListener('click', () => {
    if (state.files.length === 0) {
      showToast('No files to download', 'info');
      return;
    }
    showToast('Starting ZIP download of all files...', 'info');
    window.location.href = '/api/download-all';
  });

  // Network badge click to copy
  networkBadge.addEventListener('click', () => {
    if (state.serverInfo && state.serverInfo.primaryUrl) {
      copyToClipboard(state.serverInfo.primaryUrl, 'Sharing URL copied to clipboard!');
    }
  });

  // QR Modal
  qrBtn.addEventListener('click', () => {
    qrModal.style.display = 'flex';
  });

  closeQrModalBtn.addEventListener('click', () => {
    qrModal.style.display = 'none';
  });

  qrModal.addEventListener('click', e => {
    if (e.target === qrModal) qrModal.style.display = 'none';
  });

  copyQrUrlBtn.addEventListener('click', () => {
    if (state.serverInfo && state.serverInfo.primaryUrl) {
      copyToClipboard(state.serverInfo.primaryUrl, 'Link copied!');
    }
  });

  // Preview Modal
  closePreviewModalBtn.addEventListener('click', closePreviewModal);
  previewModal.addEventListener('click', e => {
    if (e.target === previewModal) closePreviewModal();
  });

  // Global escape key handler
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      qrModal.style.display = 'none';
      closePreviewModal();
    }
  });
}

// ==========================================================================
// API Requests
// ==========================================================================
async function fetchServerInfo() {
  try {
    const res = await fetch('/api/info');
    if (!res.ok) throw new Error('Failed to fetch server info');
    const data = await res.json();
    state.serverInfo = data;

    // Update UI
    networkUrlDisplay.textContent = data.primaryUrl.replace('http://', '');
    qrCodeImg.src = data.qrCode;
    qrModalUrl.textContent = data.primaryUrl;
    footerHostInfo.textContent = `Host: ${data.hostname} • ${data.primaryIp}:${data.port}`;

    // Render other interfaces if multiple exist
    if (data.interfaces && data.interfaces.length > 1) {
      networkInterfacesList.innerHTML = `<span style="font-weight: 600; margin-bottom: 2px;">Other Available Network Addresses:</span>` +
        data.interfaces.map(iface => `
          <div class="network-iface-item">
            <span>${iface.interface}</span>
            <span style="font-family: var(--font-mono); color: var(--accent-cyan);">http://${iface.ip}:${data.port}</span>
          </div>
        `).join('');
    } else {
      networkInterfacesList.innerHTML = '';
    }

    updateStoragePill(data.stats);
  } catch (err) {
    console.error('Error fetching server info:', err);
    networkUrlDisplay.textContent = 'Offline';
  }
}

async function fetchFiles(callback) {
  try {
    const res = await fetch('/api/files');
    if (!res.ok) throw new Error('Failed to load files');
    const files = await res.json();
    state.files = files;
    updateCategoryCounts();
    applyFiltersAndSort();
    if (callback) callback();
  } catch (err) {
    console.error('Error loading files:', err);
    showToast('Failed to load files list', 'error');
  }
}

// ==========================================================================
// Upload Logic (with Progress tracking)
// ==========================================================================
function handleUpload(files) {
  if (!files || files.length === 0) return;

  const formData = new FormData();
  let totalBytes = 0;
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
    totalBytes += files[i].size;
  }

  // Show upload progress UI
  uploadProgressContainer.style.display = 'block';
  progressTitle.textContent = `Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`;
  progressBar.style.width = '0%';
  progressPercent.textContent = '0%';
  progressDetails.textContent = `0 B / ${formatBytes(totalBytes)}`;

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload', true);

  xhr.upload.onprogress = e => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = `${percent}%`;
      progressPercent.textContent = `${percent}%`;
      progressDetails.textContent = `${formatBytes(e.loaded)} / ${formatBytes(e.total)}`;
    }
  };

  xhr.onload = () => {
    // Reset file input
    fileInput.value = '';
    if (xhr.status >= 200 && xhr.status < 300) {
      progressBar.style.width = '100%';
      progressPercent.textContent = '100%';
      progressTitle.textContent = 'Upload complete!';
      showToast(`Successfully uploaded ${files.length} file(s)!`, 'success');
      setTimeout(() => {
        uploadProgressContainer.style.display = 'none';
      }, 1400);

      fetchFiles();
      fetchServerInfo();
    } else {
      showToast('Upload failed. Check file size and network.', 'error');
      uploadProgressContainer.style.display = 'none';
    }
  };

  xhr.onerror = () => {
    fileInput.value = '';
    showToast('Network error during file upload', 'error');
    uploadProgressContainer.style.display = 'none';
  };

  xhr.send(formData);
}

// ==========================================================================
// Filtering and Sorting
// ==========================================================================
function applyFiltersAndSort() {
  let list = [...state.files];

  // Category Filter
  if (state.currentCategory !== 'all') {
    list = list.filter(f => f.category === state.currentCategory);
  }

  // Search Query
  if (state.searchQuery) {
    list = list.filter(f =>
      f.originalName.toLowerCase().includes(state.searchQuery) ||
      (f.extension && f.extension.toLowerCase().includes(state.searchQuery))
    );
  }

  // Sorting
  switch (state.currentSort) {
    case 'newest':
      list.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      break;
    case 'oldest':
      list.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
      break;
    case 'name':
      list.sort((a, b) => a.originalName.localeCompare(b.originalName));
      break;
    case 'size-desc':
      list.sort((a, b) => b.size - a.size);
      break;
    case 'size-asc':
      list.sort((a, b) => a.size - b.size);
      break;
  }

  state.filteredFiles = list;
  renderFiles();
}

function updateCategoryCounts() {
  const counts = {
    all: state.files.length,
    image: 0,
    video: 0,
    audio: 0,
    pdf: 0,
    document: 0,
    code: 0,
    archive: 0
  };

  state.files.forEach(f => {
    if (counts[f.category] !== undefined) {
      counts[f.category]++;
    }
  });

  document.getElementById('countAll').textContent = counts.all;
  document.getElementById('countImage').textContent = counts.image;
  document.getElementById('countVideo').textContent = counts.video;
  document.getElementById('countAudio').textContent = counts.audio;
  document.getElementById('countPdf').textContent = counts.pdf;
  document.getElementById('countDocument').textContent = counts.document;
  document.getElementById('countCode').textContent = counts.code;
  document.getElementById('countArchive').textContent = counts.archive;
}

function updateStoragePill(stats) {
  if (!stats) return;
  storageStats.textContent = `${stats.totalFiles} file${stats.totalFiles === 1 ? '' : 's'} (${stats.formattedTotalSize})`;
}

// ==========================================================================
// Rendering Files List
// ==========================================================================
function renderFiles() {
  filesContainer.innerHTML = '';

  if (state.files.length === 0) {
    emptyState.style.display = 'block';
    noSearchResults.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';

  if (state.filteredFiles.length === 0) {
    noSearchResults.style.display = 'block';
    return;
  }

  noSearchResults.style.display = 'none';

  state.filteredFiles.forEach(file => {
    const card = createFileCard(file);
    filesContainer.appendChild(card);
  });
}

function createFileCard(file) {
  const card = document.createElement('div');
  card.className = `file-card cat-${file.category}`;
  card.dataset.id = file.id;

  const iconClass = categoryIcons[file.category] || categoryIcons.other;
  const timeAgo = formatTimeAgo(file.uploadedAt);

  // Thumbnail area
  let thumbnailHtml = '';
  if (file.category === 'image') {
    thumbnailHtml = `
      <div class="file-thumbnail-container" onclick="openPreview('${file.id}')">
        <img src="/api/files/${file.id}/view" alt="${escapeHtml(file.originalName)}" class="file-thumbnail-img" loading="lazy">
      </div>
    `;
  } else {
    thumbnailHtml = `
      <div class="file-thumbnail-container" onclick="openPreview('${file.id}')">
        <i class="${iconClass} thumbnail-icon-placeholder"></i>
      </div>
    `;
  }

  card.innerHTML = `
    ${thumbnailHtml}
    <div class="file-header-row">
      <div class="file-meta-content">
        <div class="file-name" title="${escapeHtml(file.originalName)}" onclick="openPreview('${file.id}')">
          ${escapeHtml(file.originalName)}
        </div>
        <div class="file-submeta">
          <span>${file.formattedSize}</span>
          <span class="meta-dot">•</span>
          <span>${timeAgo}</span>
        </div>
      </div>
    </div>
    <div class="file-card-actions">
      <button class="action-btn btn-preview" title="Preview" onclick="openPreview('${file.id}')">
        <i class="ph ph-eye"></i>
      </button>
      <a href="/api/files/${file.id}/download" class="action-btn btn-download" title="Download" download="${escapeHtml(file.originalName)}">
        <i class="ph ph-download-simple"></i>
      </a>
      <button class="action-btn btn-delete" title="Delete" onclick="deleteFile('${file.id}', '${escapeHtml(file.originalName)}')">
        <i class="ph ph-trash"></i>
      </button>
    </div>
  `;

  return card;
}

// ==========================================================================
// File Actions (Preview, Delete, Download)
// ==========================================================================
window.openPreview = function(fileId) {
  const file = state.files.find(f => f.id === fileId);
  if (!file) return;

  previewFileName.textContent = file.originalName;
  previewFileMeta.textContent = `${file.formattedSize} • Uploaded ${formatTimeAgo(file.uploadedAt)}`;
  previewTypeIcon.innerHTML = `<i class="${categoryIcons[file.category] || categoryIcons.other}"></i>`;
  previewDownloadBtn.href = `/api/files/${file.id}/download`;
  previewDownloadBtn.setAttribute('download', file.originalName);

  const viewUrl = `/api/files/${file.id}/view`;
  previewBody.innerHTML = '';

  // Render appropriate preview element
  if (file.category === 'image') {
    const img = document.createElement('img');
    img.src = viewUrl;
    img.alt = file.originalName;
    img.className = 'preview-image';
    previewBody.appendChild(img);
  } else if (file.category === 'video') {
    const video = document.createElement('video');
    video.src = viewUrl;
    video.controls = true;
    video.autoplay = true;
    video.className = 'preview-video';
    previewBody.appendChild(video);
  } else if (file.category === 'audio') {
    const container = document.createElement('div');
    container.className = 'preview-audio-container';
    container.innerHTML = `
      <i class="ph-fill ph-disc audio-vinyl-icon"></i>
      <h4 style="text-align: center; word-break: break-all;">${escapeHtml(file.originalName)}</h4>
      <audio controls autoplay class="preview-audio" src="${viewUrl}"></audio>
    `;
    previewBody.appendChild(container);
  } else if (file.category === 'pdf') {
    const iframe = document.createElement('iframe');
    iframe.src = viewUrl;
    iframe.className = 'preview-pdf-frame';
    previewBody.appendChild(iframe);
  } else if (file.category === 'code' || file.mimeType.startsWith('text/')) {
    // Show spinner while fetching code text
    previewBody.innerHTML = `
      <div style="color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem;">
        <i class="ph ph-circle-notch spinner-icon"></i> Loading document content...
      </div>
    `;
    fetch(viewUrl)
      .then(r => r.text())
      .then(text => {
        previewBody.innerHTML = `
          <div class="preview-code-container">
            <pre class="preview-code-content"><code>${escapeHtml(text)}</code></pre>
          </div>
        `;
      })
      .catch(err => {
        previewBody.innerHTML = `<div class="preview-fallback"><p>Could not load text content.</p></div>`;
      });
  } else {
    previewBody.innerHTML = `
      <div class="preview-fallback">
        <i class="${categoryIcons[file.category] || categoryIcons.other} fallback-icon"></i>
        <h3>Preview not available for this file type</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem;">You can download the file directly to your device.</p>
        <a href="/api/files/${file.id}/download" class="btn btn-primary" download="${escapeHtml(file.originalName)}">
          <i class="ph ph-download-simple"></i> Download File (${file.formattedSize})
        </a>
      </div>
    `;
  }

  previewModal.style.display = 'flex';
};

function closePreviewModal() {
  previewModal.style.display = 'none';
  // Pause any playing media
  const media = previewBody.querySelector('video, audio');
  if (media) {
    media.pause();
  }
  previewBody.innerHTML = '';
}

window.deleteFile = async function(fileId, fileName) {
  if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showToast(`"${fileName}" deleted`, 'info');
      fetchFiles();
      fetchServerInfo();
    } else {
      showToast(data.error || 'Failed to delete file', 'error');
    }
  } catch (err) {
    showToast('Network error while deleting', 'error');
  }
};

// ==========================================================================
// Utilities
// ==========================================================================
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTimeAgo(isoDate) {
  const date = new Date(isoDate);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'ph-info';
  if (type === 'success') icon = 'ph-check-circle';
  if (type === 'error') icon = 'ph-warning-circle';

  toast.innerHTML = `
    <i class="ph-fill ${icon}" style="font-size: 1.25rem;"></i>
    <span>${escapeHtml(message)}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function copyToClipboard(text, successMsg = 'Copied to clipboard!') {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg, 'success');
    }).catch(() => {
      fallbackCopy(text, successMsg);
    });
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast(successMsg, 'success');
  } catch (err) {
    showToast('Failed to copy', 'error');
  }
  document.body.removeChild(ta);
}
