let levels = [], profiles = {}, cache = new Map(), currentView = 'officials';

document.querySelectorAll('.tab').forEach(t => t.onclick = () => switchTab(t.dataset.tab));
document.querySelectorAll('.lb-tab').forEach(t => t.onclick = () => switchLB(t.dataset.lb));
document.getElementById('back-to-levels').onclick = () => switchTab('officials');
document.getElementById('back-to-prev').onclick = () => currentView === 'detail' ? switchTab('officials') : switchTab('leaderboards');
document.getElementById('player-search').oninput = filterPlayers;

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(tab + '-tab')?.classList.add('active');
  document.getElementById('detail-view').classList.toggle('active', tab === 'detail');
  document.getElementById('profile-view').classList.toggle('active', tab === 'profile');
  currentView = tab;
  if (tab === 'leaderboards') renderGlobalLB('wr');
}

function switchLB(type) {
  document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.lb-tab[data-lb="${type}"]`).classList.add('active');
  renderGlobalLB(type);
}

async function fetchLB(url) {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch("https://corsproxy.io/?" + encodeURIComponent(url));
  if (!res.ok) throw new Error();
  const data = await res.json();
  cache.set(url, data);
  return data;
}

function formatTime(s) {
  if (!s) return "-";
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return m > 0 ? `${m}:${sec.padStart(6,'0')}` : sec;
}

function getArrowImg(n) {
  if (!n) return "assets/narrow.png";
  const name = n.toLowerCase();
  if (name.includes("speedy")) return "assets/speedy.png";
  if (name.includes("energy")) return "assets/energy.png";
  return "assets/narrow.png";
}

// ... (rest of your previous functions: renderLevels, showLevel, loadPlayerProfile) ...

// Add this new global leaderboard function
async function renderGlobalLB(type) {
  const tbody = document.getElementById('global-lb-body');
  const thead = document.getElementById('global-lb-head');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:3rem;color:#64748b">Loading global stats...</td></tr>';

  const all = await Promise.allSettled(levels.map(l => fetchLB(l.api)));
  const players = {};

  all.forEach((res, i) => {
    if (res.status !== 'fulfilled') return;
    res.value.forEach(run => {
      if (!players[run.username]) players[run.username] = { wr: 0, best: Infinity, total: 0, avg: 0, count: 0, times: [] };
      const p = players[run.username];
      const rank = res.value.indexOf(run) + 1;
      p.best = Math.min(p.best, rank);
      p.total += run.completion_time;
      p.times.push({ level: levels[i].name, rank, time: run.completion_time, arrow: run.arrow_name });
      p.count++;
      if (rank === 1) p.wr++;
    });
  });

  const list = Object.entries(players).map(([name, s]) => ({
    name,
    wr: s.wr,
    best: s.best,
    total: s.total,
    avgTime: s.count ? s.total / s.count : Infinity,
    avgRank: s.times.reduce((a,b)=>a+b.rank,0)/s.count,
    count: s.count,
    times: s.times
  }));

  let sorted;
  if (type === 'wr') sorted = list.sort((a,b) => b.wr - a.wr || a.best - b.best);
  if (type === 'best') sorted = list.sort((a,b) => a.best - b.best || a.wr - b.wr);
  if (type === 'total') sorted = list.sort((a,b) => a.total - b.total);
  if (type === 'avg') sorted = list.sort((a,b) => a.avgTime - b.avgTime || a.avgRank - b.avgRank);

  thead.innerHTML = `<tr>
    <th>Rank</th>
    <th>Player</th>
    <th>${type === 'wr' ? 'WRs' : type === 'best' ? 'Best Rank' : type === 'total' ? 'Total Time' : 'Avg Time'}</th>
    <th>Maps</th>
    <th>Profile</th>
  </tr>`;

  tbody.innerHTML = '';
  sorted.slice(0, 100).forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong class="${i < 3 ? 'rank-'+(i+1) : ''}">${i+1}</strong></td>
      <td>${p.name}</td>
      <td><strong>${type === 'wr' ? p.wr : type === 'best' ? p.best : type === 'total' ? formatTime(p.total) : formatTime(p.avgTime)}</strong></td>
      <td>${p.count}</td>
      <td><a href="#" class="player-link" data-user="${p.name}">View →</a></td>
    `;
    tr.querySelector('.player-link').onclick = e => { e.preventDefault(); loadPlayerProfile(p.name); switchTab('profile'); };
    tbody.appendChild(tr);
  });
}

function filterPlayers() {
  const term = document.getElementById('player-search').value.toLowerCase();
  const rows = document.querySelectorAll('#global-lb-body tr');
  rows.forEach(row => {
    const name = row.cells[1]?.textContent.toLowerCase() || '';
    row.style.display = name.includes(term) ? '' : 'none';
  });
}

// Load data
Promise.all([
  fetch('levels.json').then(r => r.json()),
  fetch('profiles.json').then(r => r.json())
]).then(([lvl, prof]) => {
  levels = lvl;
  profiles = prof;
  renderLevels();
});
