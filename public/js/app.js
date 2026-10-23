'use strict';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
  token: localStorage.getItem('reeltime_token') || '',
  user: JSON.parse(localStorage.getItem('reeltime_user') || 'null'),
  movies: [],
  movie: null,
  shows: [],
  show: null,
  seats: [],
  selected: new Set(),
};

/* ---------- Helpers ---------- */
let toastTimer;
function toast(text, type = 'info') {
  const t = $('toast');
  t.textContent = text;
  t.className = 'toast ' + type;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4000);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;

  const res = await fetch('/api' + path, { ...options, headers });
  let data = {};
  try { data = await res.json(); } catch (e) { /* ignore */ }

  if (res.status === 401 && state.token) clearSession();
  if (!res.ok || data.success === false) throw new Error(data.message || 'Request failed');
  return data;
}

function fmtDate(d) {
  return new Date(d).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}
const rupee = (n) => '₹' + Number(n).toFixed(0);

function showView(name) {
  ['movies', 'shows', 'seats', 'bookings', 'auth'].forEach((v) => ($('view-' + v).hidden = v !== name));
  window.scrollTo(0, 0);
}

/* ---------- Session / Nav ---------- */
function saveSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('reeltime_token', token);
  localStorage.setItem('reeltime_user', JSON.stringify(user));
  renderNav();
}

function clearSession() {
  state.token = '';
  state.user = null;
  localStorage.removeItem('reeltime_token');
  localStorage.removeItem('reeltime_user');
  renderNav();
}

function renderNav() {
  const loggedIn = !!state.token && !!state.user;
  $('navLogin').hidden = loggedIn;
  $('navLogout').hidden = !loggedIn;
  $('navUser').hidden = !loggedIn;
  $('navAdmin').hidden = !(loggedIn && state.user.role === 'admin');
  if (loggedIn) $('navUser').textContent = 'Hi, ' + state.user.name;
}

/* ---------- Movies ---------- */
function posterHtml(m) {
  const initial = esc((m.title || '?').trim().charAt(0).toUpperCase());
  if (m.poster_url) {
    return `<img class="poster-img" src="${esc(m.poster_url)}" alt="${esc(m.title)}" data-initial="${initial}" />`;
  }
  return `<div class="poster-fallback">${initial}</div>`;
}

function renderMovies() {
  const grid = $('movieGrid');
  if (!state.movies.length) {
    grid.innerHTML = '<p class="empty">No movies found.</p>';
    return;
  }
  grid.innerHTML = state.movies.map((m) => `
    <div class="movie-card" data-id="${m.id}">
      ${posterHtml(m)}
      <div class="movie-info">
        <h3>${esc(m.title)}</h3>
        <span class="badge">${esc(m.genre)}</span>
        ${m.duration_min ? `<div class="muted" style="font-size:.85rem">${m.duration_min} min</div>` : ''}
      </div>
    </div>`).join('');

  // Poster load na ho to fallback design
  grid.querySelectorAll('img.poster-img').forEach((img) => {
    img.addEventListener('error', () => {
      const div = document.createElement('div');
      div.className = 'poster-fallback';
      div.textContent = img.dataset.initial || '?';
      img.replaceWith(div);
    });
  });
}

async function loadMovies() {
  const params = new URLSearchParams();
  const q = $('searchInput').value.trim();
  const genre = $('genreSelect').value;
  if (q) params.set('q', q);
  if (genre) params.set('genre', genre);

  try {
    const data = await api('/movies?' + params.toString());
    state.movies = data.movies;
    renderMovies();
  } catch (err) {
    $('movieGrid').innerHTML = '<p class="empty">Unable to load movies.</p>';
    toast(err.message, 'error');
  }
}

/* ---------- Shows ---------- */
async function openShows(movie) {
  state.movie = movie;
  $('showsTitle').textContent = movie.title;
  $('showsInfo').textContent = `${movie.genre}${movie.duration_min ? ' • ' + movie.duration_min + ' min' : ''}${movie.description ? ' • ' + movie.description : ''}`;
  $('showList').innerHTML = '<p class="empty">Loading shows...</p>';
  showView('shows');

  try {
    const data = await api('/shows?movieId=' + movie.id);
    state.shows = data.shows;
    if (!state.shows.length) {
      $('showList').innerHTML = '<p class="empty">No upcoming shows for this movie.</p>';
      return;
    }
    $('showList').innerHTML = state.shows.map((s) => `
      <div class="show-card" data-id="${s.id}">
        <strong>${esc(fmtDate(s.show_time))}</strong>
        <span class="muted">Regular ${rupee(s.regular_price)} • Premium ${rupee(s.premium_price)}</span>
      </div>`).join('');
  } catch (err) {
    $('showList').innerHTML = '<p class="empty">Unable to load shows.</p>';
    toast(err.message, 'error');
  }
}

/* ---------- Seats ---------- */
async function openSeats(showId) {
  state.selected = new Set();
  $('confirmBox').hidden = true;
  showView('seats');
  $('seatMap').innerHTML = '<p class="muted">Loading seats...</p>';
  await loadSeats(showId);
}

async function loadSeats(showId) {
  try {
    const data = await api(`/shows/${showId}/seats`);
    state.show = data.show;
    state.seats = data.seats;
    $('seatsTitle').textContent = data.show.title;
    $('seatsInfo').textContent = `${fmtDate(data.show.show_time)} • Regular ${rupee(data.show.regular_price)} • Premium ${rupee(data.show.premium_price)}`;
    renderSeats();
  } catch (err) {
    $('seatMap').innerHTML = '<p class="empty">Unable to load seats.</p>';
    toast(err.message, 'error');
  }
}

function renderSeats() {
  const rows = {};
  state.seats.forEach((s) => {
    const letter = s.seat_label.charAt(0);
    (rows[letter] = rows[letter] || []).push(s);
  });

  $('seatMap').innerHTML = Object.keys(rows).sort().map((letter) => `
    <div class="seat-row">
      <span class="row-label">${letter}</span>
      ${rows[letter].map((s) => `
        <button class="seat ${s.seat_type} ${s.is_booked ? 'booked' : ''} ${state.selected.has(s.id) ? 'selected' : ''}"
                data-id="${s.id}" ${s.is_booked ? 'disabled' : ''}
                title="${esc(s.seat_label)} (${s.seat_type})">${esc(s.seat_label.slice(1))}</button>`).join('')}
    </div>`).join('');

  updateSummary();
}

function updateSummary() {
  const chosen = state.seats.filter((s) => state.selected.has(s.id));
  const total = chosen.reduce((sum, s) =>
    sum + Number(s.seat_type === 'premium' ? state.show.premium_price : state.show.regular_price), 0);
  $('selSeats').textContent = chosen.length ? chosen.map((s) => s.seat_label).join(', ') : '-';
  $('selTotal').textContent = rupee(total);
  $('bookBtn').disabled = chosen.length === 0;
}

async function bookSeats() {
  if (!state.token) {
    toast('Please login to book tickets', 'error');
    setAuthTab('login');
    showView('auth');
    return;
  }

  $('bookBtn').disabled = true;
  try {
    const data = await api('/bookings', {
      method: 'POST',
      body: JSON.stringify({ showId: state.show.id, seatIds: [...state.selected] }),
    });
    const b = data.booking;
    state.selected = new Set();
    toast('Booking confirmed!', 'success');
    await loadSeats(state.show.id);

    const box = $('confirmBox');
    box.innerHTML = `
      <h3>🎉 Booking Confirmed</h3>
      <div class="code">${esc(b.confirmation_code)}</div>
      <p>Movie: <strong>${esc(state.show.title)}</strong></p>
      <p>Seats: <strong>${esc(b.seat_labels)}</strong></p>
      <p>Total paid (demo): <strong>${rupee(b.total_price)}</strong></p>`;
    box.hidden = false;
  } catch (err) {
    toast(err.message, 'error');
    if (state.show) await loadSeats(state.show.id); // taken seats refresh ho jayengi
    if (!state.token) { setAuthTab('login'); showView('auth'); }
  } finally {
    updateSummary();
  }
}

/* ---------- My Bookings ---------- */
async function openBookings() {
  if (!state.token) {
    toast('Please login to see your bookings', 'error');
    setAuthTab('login');
    showView('auth');
    return;
  }
  showView('bookings');
  $('bookingList').innerHTML = '<p class="empty">Loading...</p>';
  try {
    const data = await api('/bookings/mine');
    if (!data.bookings.length) {
      $('bookingList').innerHTML = '<p class="empty">You have no bookings yet.</p>';
      return;
    }
    $('bookingList').innerHTML = data.bookings.map((b) => `
      <div class="booking-item">
        <div>
          <h3>${esc(b.title)}</h3>
          <div class="muted">${esc(fmtDate(b.show_time))}</div>
          <div>Seats: <strong>${esc(b.seat_labels)}</strong></div>
        </div>
        <div style="text-align:right">
          <div class="code">${esc(b.confirmation_code)}</div>
          <div>${rupee(b.total_price)}</div>
        </div>
      </div>`).join('');
  } catch (err) {
    $('bookingList').innerHTML = '<p class="empty">Unable to load bookings.</p>';
    toast(err.message, 'error');
  }
}

/* ---------- Auth forms ---------- */
function setAuthTab(tab) {
  const login = tab === 'login';
  $('loginForm').hidden = !login;
  $('registerForm').hidden = login;
  $('tabLogin').classList.toggle('active', login);
  $('tabRegister').classList.toggle('active', !login);
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('loginEmail').value, password: $('loginPassword').value }),
    });
    saveSession(data.token, data.user);
    $('loginForm').reset();
    toast('Welcome, ' + data.user.name, 'success');
    showView('movies');
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: $('regName').value,
        email: $('regEmail').value,
        password: $('regPassword').value,
      }),
    });
    toast(data.message, 'success');
    $('registerForm').reset();
    setAuthTab('login');
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ---------- Events ---------- */
$('tabLogin').addEventListener('click', () => setAuthTab('login'));
$('tabRegister').addEventListener('click', () => setAuthTab('register'));
$('navLogin').addEventListener('click', () => { setAuthTab('login'); showView('auth'); });
$('navLogout').addEventListener('click', () => { clearSession(); toast('Logged out'); showView('movies'); });
$('navMovies').addEventListener('click', () => showView('movies'));
$('brand').addEventListener('click', () => showView('movies'));
$('navBookings').addEventListener('click', openBookings);
$('backToMovies').addEventListener('click', () => showView('movies'));
$('backToShows').addEventListener('click', () => showView('shows'));
$('bookBtn').addEventListener('click', bookSeats);

$('searchForm').addEventListener('submit', (e) => { e.preventDefault(); loadMovies(); });
$('genreSelect').addEventListener('change', loadMovies);

$('movieGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.movie-card');
  if (!card) return;
  const movie = state.movies.find((m) => m.id === Number(card.dataset.id));
  if (movie) openShows(movie);
});

$('showList').addEventListener('click', (e) => {
  const card = e.target.closest('.show-card');
  if (card) openSeats(Number(card.dataset.id));
});

$('seatMap').addEventListener('click', (e) => {
  const btn = e.target.closest('.seat');
  if (!btn || btn.disabled) return;
  const id = Number(btn.dataset.id);
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  renderSeats();
});

/* ---------- Init ---------- */
(async function init() {
  renderNav();
  if (state.token) {
    try {
      const data = await api('/auth/me');
      saveSession(state.token, data.user);
    } catch (e) {
      clearSession();
    }
  }
  loadMovies();
})();