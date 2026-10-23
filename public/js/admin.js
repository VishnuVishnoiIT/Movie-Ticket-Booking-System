'use strict';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let token = localStorage.getItem('reeltime_token') || '';

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
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch('/api' + path, { ...options, headers });
  let data = {};
  try { data = await res.json(); } catch (e) { /* ignore */ }
  if (!res.ok || data.success === false) throw new Error(data.message || 'Request failed');
  return data;
}

function logout() {
  token = '';
  localStorage.removeItem('reeltime_token');
  localStorage.removeItem('reeltime_user');
  showLogin();
}

function showLogin() {
  $('loginSection').hidden = false;
  $('dashboard').hidden = true;
  $('logoutBtn').hidden = true;
}

async function showDashboard() {
  $('loginSection').hidden = true;
  $('dashboard').hidden = false;
  $('logoutBtn').hidden = false;
  await Promise.all([loadSummary(), loadMovies()]);
}

async function loadSummary() {
  try {
    const { summary } = await api('/admin/summary');
    $('stats').innerHTML = `
      <div class="stat"><b>${esc(summary.users)}</b>Users</div>
      <div class="stat"><b>${esc(summary.movies)}</b>Movies</div>
      <div class="stat"><b>${esc(summary.shows)}</b>Shows</div>
      <div class="stat"><b>${esc(summary.bookings)}</b>Bookings</div>
      <div class="stat"><b>₹${Number(summary.revenue).toFixed(0)}</b>Revenue (demo)</div>`;
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function loadMovies() {
  try {
    const { movies } = await api('/movies');
    $('sMovie').innerHTML = movies.map((m) => `<option value="${m.id}">${esc(m.title)}</option>`).join('');
    $('movieRows').innerHTML = movies.length
      ? movies.map((m) => `
        <tr>
          <td>${m.id}</td>
          <td>${esc(m.title)}</td>
          <td>${esc(m.genre)}</td>
          <td><button class="btn-danger btn-sm" data-hide="${m.id}">Hide</button></td>
        </tr>`).join('')
      : '<tr><td colspan="4" class="muted">No movies.</td></tr>';
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* Admin login */
$('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('aEmail').value, password: $('aPassword').value }),
    });
    if (data.user.role !== 'admin') {
      toast('This account is not an administrator', 'error');
      return;
    }
    token = data.token;
    localStorage.setItem('reeltime_token', data.token);
    localStorage.setItem('reeltime_user', JSON.stringify(data.user));
    $('adminLoginForm').reset();
    showDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* Add movie */
$('movieForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/admin/movies', {
      method: 'POST',
      body: JSON.stringify({
        title: $('mTitle').value,
        genre: $('mGenre').value,
        durationMin: $('mDuration').value,
        posterUrl: $('mPoster').value,
        description: $('mDesc').value,
      }),
    });
    toast('Movie added', 'success');
    $('movieForm').reset();
    await Promise.all([loadSummary(), loadMovies()]);
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* Create show */
$('showForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/admin/shows', {
      method: 'POST',
      body: JSON.stringify({
        movieId: $('sMovie').value,
        showTime: $('sTime').value,
        regularPrice: $('sRegular').value,
        premiumPrice: $('sPremium').value,
      }),
    });
    toast('Show created with 48 seats', 'success');
    await loadSummary();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* Hide movie */
$('movieRows').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-hide]');
  if (!btn) return;
  if (!confirm('Hide this movie from the public list?')) return;
  try {
    await api('/admin/movies/' + btn.dataset.hide, { method: 'DELETE' });
    toast('Movie hidden', 'success');
    await Promise.all([loadSummary(), loadMovies()]);
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('logoutBtn').addEventListener('click', logout);

/* Init: token valid aur role admin hai to seedha dashboard */
(async function init() {
  if (!token) return showLogin();
  try {
    const { user } = await api('/auth/me');
    if (user.role === 'admin') showDashboard();
    else { toast('Admin access required', 'error'); showLogin(); }
  } catch (e) {
    showLogin();
  }
})();