/**
 * results.js
 * ----------
 * Matched photo rendering, lazy loading, lightbox interactions, downloads, and WhatsApp sharing.
 */

const resultsState = {
  eventId: '',
  eventName: 'Selected Event',
  matches: [],
  observer: null
};

window.addEventListener('DOMContentLoaded', initResultsPage);

/**
 * Initializes the results page.
 * @returns {void}
 */
function initResultsPage() {
  if (!window.location.pathname.includes('/pages/results.html')) {
    return;
  }

  bindResultActions();
  loadStoredResults();
}

/**
 * Binds page-level and lightbox actions.
 * @returns {void}
 */
function bindResultActions() {
  document.getElementById('download-all-btn').addEventListener('click', function onDownloadAll() {
    downloadAllMatches().catch(function onError(error) {
      window.JBApp.showToast(error.message, 'error');
    });
  });
  document.getElementById('share-all-btn').addEventListener('click', shareAllResults);
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', function onOverlayClick(event) {
    if (event.target.id === 'lightbox') {
      closeLightbox();
    }
  });
  document.getElementById('retry-search-btn').addEventListener('click', function onRetry() {
    const target = `/pages/face-scan.html?eventId=${encodeURIComponent(resultsState.eventId)}&eventName=${encodeURIComponent(resultsState.eventName)}`;
    window.location.href = target;
  });
  document.addEventListener('keydown', function onEscape(event) {
    if (event.key === 'Escape') {
      closeLightbox();
    }
  });
}

/**
 * Loads the previous match payload from session storage.
 * @returns {void}
 */
function loadStoredResults() {
  const storedValue = sessionStorage.getItem('faceMatchResults');
  const params = new URLSearchParams(window.location.search);

  if (!storedValue) {
    showEmptyState();
    return;
  }

  try {
    const parsed = JSON.parse(storedValue);
    const queryEventId = params.get('eventId');

    if (queryEventId && parsed.eventId && parsed.eventId !== queryEventId) {
      showEmptyState();
      return;
    }

    resultsState.eventId = parsed.eventId || queryEventId || '';
    resultsState.eventName = parsed.eventName || params.get('eventName') || 'Selected Event';
    resultsState.matches = parsed.matches || [];
    renderResults();
  } catch (error) {
    showEmptyState();
  }
}

/**
 * Renders the results header and image grid.
 * @returns {void}
 */
function renderResults() {
  document.getElementById('results-heading').textContent = `Found ${resultsState.matches.length} photo${resultsState.matches.length === 1 ? '' : 's'} of you in ${resultsState.eventName}`;

  if (resultsState.matches.length === 0) {
    showEmptyState();
    return;
  }

  document.getElementById('results-empty').classList.add('hidden');
  document.getElementById('results-actions').classList.remove('hidden');
  renderResultsGrid(resultsState.matches);
}

/**
 * Renders the masonry result cards.
 * @param {Array<any>} matches
 * @returns {void}
 */
function renderResultsGrid(matches) {
  const grid = document.getElementById('results-grid');

  grid.innerHTML = matches.map(function createCard(image, index) {
    return `
      <article class="result-card">
        <img
          class="result-image"
          data-src="${image.thumbnailUrl || image.url}"
          data-full-src="${image.url}"
          alt="Matched event photo ${index + 1}"
          loading="lazy"
        >
        <div class="result-actions">
          <button class="result-action" data-download="${index}">Download</button>
          <button class="result-action" data-share="${index}">Share</button>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('.result-image').forEach(function bindImage(image, index) {
    image.addEventListener('click', function onOpen() {
      openLightbox(resultsState.matches[index].url);
    });
  });
  grid.querySelectorAll('[data-download]').forEach(function bindDownload(button) {
    button.addEventListener('click', function onClick(event) {
      event.stopPropagation();
      const index = Number(button.dataset.download);
      downloadImage(resultsState.matches[index].url, `jb-photo-${index + 1}.jpg`).catch(function onError(error) {
        window.JBApp.showToast(error.message, 'error');
      });
    });
  });
  grid.querySelectorAll('[data-share]').forEach(function bindShare(button) {
    button.addEventListener('click', function onClick(event) {
      event.stopPropagation();
      const index = Number(button.dataset.share);
      shareSingleImage(resultsState.matches[index].url);
    });
  });

  initLazyLoading();
}

/**
 * Initializes lazy loading for result thumbnails.
 * @returns {void}
 */
function initLazyLoading() {
  if (resultsState.observer) {
    resultsState.observer.disconnect();
  }

  resultsState.observer = new IntersectionObserver(function onIntersect(entries, observer) {
    entries.forEach(function handleEntry(entry) {
      if (!entry.isIntersecting) {
        return;
      }

      const image = entry.target;
      image.src = image.dataset.src;
      observer.unobserve(image);
    });
  }, {
    rootMargin: '150px'
  });

  document.querySelectorAll('.result-image').forEach(function observeImage(image) {
    resultsState.observer.observe(image);
  });
}

/**
 * Opens the full-size lightbox.
 * @param {string} imageUrl
 * @returns {void}
 */
function openLightbox(imageUrl) {
  document.getElementById('lightbox-image').src = imageUrl;
  document.getElementById('lightbox').classList.add('open');
}

/**
 * Closes the lightbox.
 * @returns {void}
 */
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightbox-image').src = '';
}

/**
 * Downloads a single image by fetching it as a blob.
 * @param {string} url
 * @param {string} fileName
 * @returns {Promise<void>}
 */
async function downloadImage(url, fileName) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Unable to download this image.');
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

/**
 * Downloads all matched images as a ZIP file using JSZip.
 * @returns {Promise<void>}
 */
async function downloadAllMatches() {
  if (resultsState.matches.length === 0) {
    window.JBApp.showToast('There are no matched photos to download.', 'warning');
    return;
  }

  const button = document.getElementById('download-all-btn');
  const originalLabel = button.textContent;

  button.disabled = true;
  button.textContent = 'Preparing ZIP...';

  try {
    if (!window.JSZip) {
      for (let index = 0; index < resultsState.matches.length; index += 1) {
        await downloadImage(resultsState.matches[index].url, `jb-photo-${index + 1}.jpg`);
      }
      return;
    }

    const zip = new JSZip();

    for (let index = 0; index < resultsState.matches.length; index += 1) {
      button.textContent = `Downloading ${index + 1} of ${resultsState.matches.length}...`;

      const response = await fetch(resultsState.matches[index].url);
      const blob = await response.blob();
      zip.file(`jb-photo-${index + 1}.jpg`, blob);
    }

    const archive = await zip.generateAsync({ type: 'blob' });
    const blobUrl = URL.createObjectURL(archive);
    const link = document.createElement('a');

    link.href = blobUrl;
    link.download = `${resultsState.eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'jb-results'}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

/**
 * Shares the full results page on WhatsApp.
 * @returns {void}
 */
function shareAllResults() {
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(`Check out my photos from ${resultsState.eventName}! ${window.location.href}`)}`;
  window.open(shareUrl, '_blank', 'noopener');
}

/**
 * Shares a single image on WhatsApp.
 * @param {string} imageUrl
 * @returns {void}
 */
function shareSingleImage(imageUrl) {
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(`Check out my photos from ${resultsState.eventName}! ${imageUrl}`)}`;
  window.open(shareUrl, '_blank', 'noopener');
}

/**
 * Shows the empty results state.
 * @returns {void}
 */
function showEmptyState() {
  document.getElementById('results-grid').innerHTML = '';
  document.getElementById('results-heading').textContent = 'No matching photos found yet.';
  document.getElementById('results-empty').classList.remove('hidden');
  document.getElementById('results-actions').classList.add('hidden');
}
