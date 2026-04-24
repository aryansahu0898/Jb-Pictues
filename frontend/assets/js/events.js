/**
 * events.js
 * ---------
 * Public event gallery rendering with client-side search and date filters.
 */

const eventsState = {
  events: []
};

window.addEventListener('DOMContentLoaded', initEventsPage);

/**
 * Initializes the event gallery page.
 * @returns {void}
 */
function initEventsPage() {
  if (!window.location.pathname.includes('/pages/events.html')) {
    return;
  }

  bindFilters();
  loadEvents().catch(function onError(error) {
    window.JBApp.showToast(error.message, 'error');
    renderEvents([]);
  });
}

/**
 * Loads public event data.
 * @returns {Promise<void>}
 */
async function loadEvents() {
  const response = await window.JBApp.request('/events?page=1&limit=100');
  eventsState.events = response.events || [];
  applyFilters();
}

/**
 * Binds event filter controls.
 * @returns {void}
 */
function bindFilters() {
  document.getElementById('event-search').addEventListener('input', applyFilters);
  document.getElementById('event-date-filter').addEventListener('change', applyFilters);
}

/**
 * Applies search and date filters to the full event list.
 * @returns {void}
 */
function applyFilters() {
  const searchValue = document.getElementById('event-search').value.trim().toLowerCase();
  const dateValue = document.getElementById('event-date-filter').value;

  const filteredEvents = eventsState.events.filter(function matchesEvent(event) {
    const matchesSearch = !searchValue || `${event.name} ${event.description || ''}`.toLowerCase().includes(searchValue);
    const matchesDate = !dateValue || new Date(event.date).toISOString().split('T')[0] === dateValue;
    return matchesSearch && matchesDate;
  });

  renderEvents(filteredEvents);
}

/**
 * Renders the filtered event list.
 * @param {Array<any>} events
 * @returns {void}
 */
function renderEvents(events) {
  const grid = document.getElementById('events-grid');
  const emptyState = document.getElementById('events-empty');

  if (events.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  grid.innerHTML = events.map(function createCard(event) {
    return `
      <article class="event-card" data-event-id="${event._id}" data-event-name="${window.JBApp.escapeHtml(event.name)}">
        <div class="event-cover">
          ${event.coverImage
            ? `<img src="${event.coverImage}" alt="${window.JBApp.escapeHtml(event.name)} cover image" loading="lazy">`
            : '<div class="event-cover-fallback"></div>'}
        </div>
        <div class="event-content">
          <span class="status-pill">${event.imageCount || 0} photos</span>
          <h3>${window.JBApp.escapeHtml(event.name)}</h3>
          <p>${window.JBApp.escapeHtml(event.description || 'AI-powered photo discovery for this event.')}</p>
          <div class="event-meta">
            <span>${window.JBApp.formatDate(event.date)}</span>
            <span>Scan now</span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('.event-card').forEach(function bindCard(card) {
    card.addEventListener('click', function onClick() {
      const eventId = card.dataset.eventId;
      const eventName = card.dataset.eventName;
      window.location.href = `/pages/face-scan.html?eventId=${encodeURIComponent(eventId)}&eventName=${encodeURIComponent(eventName)}`;
    });
  });
}
