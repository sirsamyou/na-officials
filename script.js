const listView = document.getElementById('list-view');
const detailView = document.getElementById('detail-view');
const grid = document.getElementById('levels-grid');
const backBtn = document.getElementById('back-btn');

let levels = [];

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return mins > 0 
    ? `${mins}:${secs.toString().padStart(2,'0')}.${ms.toString().padStart(3,'0')}`
    : `${secs}.${ms.toString().padStart(3,'0')}`;
}

function getArrowImage(arrowName) {
  if (!arrowName) return "assets/narrow.png";
  const lower = arrowName.toLowerCase();
  if (lower.includes("speedy")) return "assets/speedy.png";
  if (lower.includes("energy")) return "assets/energy.png";
  return "assets/narrow.png";
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function renderLevels() {
  grid.innerHTML = '';
  levels.forEach((level, index) => {
    const card = document.createElement('div');
    card.className = 'level-card';
    card.innerHTML = `
      <img src="${level.thumbnail}" alt="${level.name}" onerror="this.src='thumbs/placeholder.png'">
      <h3>${escapeHtml(level.name)}</h3>
      <p>${level.creator ? 'by ' + escapeHtml(level.creator) : 'Official Level'}</p>
    `;
    card.onclick = () => showLevel(index);
    grid.appendChild(card);
  });
}

async function showLevel(index) {
  const level = levels[index];
  
  document.getElementById('detail-name').textContent = level.name;
  document.getElementById('detail-creator').textContent = level.creator ? `Creator: ${level.creator}` : 'Official Level';
  document.getElementById('detail-thumb').src = level.thumbnail;

  listView.classList.add('hidden');
  detailView.classList.remove('hidden');

  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '<tr><td colspan="4" class="loading">Loading leaderboard...</td></tr>';

  // This line fixes CORS on GitHub Pages
  const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(level.api);
  
  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    data.sort((a, b) => a.completion_time - b.completion_time);

    tbody.innerHTML = '';
    data.slice(0, 500).forEach((entry, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${i < 3 ? ' style="color:#ffd700"' : ''}>#${i + 1}</strong></td>
        <td><img src="${getArrowImage(entry.arrow_name)}" alt="${entry.arrow_name || 'Narrow'}" class="arrow-img"></td>
        <td>${escapeHtml(entry.username)}</td>
        <td><strong>${formatTime(entry.completion_time)}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#ff6b6b;">Failed to load leaderboard<br><small>Try refreshing</small></td></tr>';
    console.error("Leaderboard fetch failed:", err);
  }
}

backBtn.onclick = () => {
  detailView.classList.add('hidden');
  listView.classList.remove('hidden');
};

// Load levels.json
fetch('levels.json')
  .then(r => r.ok ? r.json() : Promise.reject('levels.json not found'))
  .then(data => {
    levels = data;
    renderLevels();
  })
  .catch(err => {
    grid.innerHTML = `<p style="color:#ff6b6b;text-align:center;padding:60px;font-size:1.2rem">
      Error loading levels.json<br><small>${err}</small>
    </p>`;
  });
