let levels = [], profiles = {}, cache = new Map(), lastView = 'officials';

const views = {
  officials: document.getElementById('officials-view'),
  leaderboards: document.getElementById('leaderboards-view'),
  detail: document.getElementById('detail-view'),
  profile: document.getElementById('profile-view')
};

document.querySelectorAll('.tab').forEach(t => t.onclick = () => switchTab(t.dataset.view));
document.querySelectorAll('.lb-tab').forEach(t => t.onclick = () => switchLbTab(t.dataset.lb));
document.getElementById('back-to-officials').onclick = () => switchTab('officials');
document.getElementById('back-to-prev').onclick = () => switchTab(lastView);

function switchTab(view) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[view].classList.add('active');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  lastView = view === 'detail' || view === 'profile' ? lastView : view;
  if (view === 'leaderboards') renderGlobalLb('wr');
}

function switchLbTab(type) {
  document.querySelectorAll('.lb-tab').forEach(t => t.classList.toggle('active', t.dataset.lb === type));
  renderGlobalLb(type);
}

function formatTime(s) {
  if (!s) return "-";
  const m = Math.floor(s / 60);
  const secs = (s % 60).toFixed(3);
  return m > 0 ? `${m}:${String(secs).padStart(6,'0')}` : secs;
}

function getArrowImg(n) {
  if (!n) return "assets/narrow.png";
  n = n.toLowerCase();
  return n.includes("speedy") ? "assets/speedy.png" : n.includes("energy") ? "assets/energy.png" : "assets/narrow.png";
}

function renderLevels() {
  const grid = document.getElementById('levels-grid');
  grid.innerHTML = '';
  levels.forEach((lvl, i) => {
    const card = document.createElement('div');
    card.className = 'level-card';
    card.innerHTML = `<img src="${lvl.thumbnail}" onerror="this.src='thumbs/placeholder.png'"><h3>${lvl.name}</h3><p>${lvl.creator ? 'by ' + lvl.creator : 'Official'}</p>`;
    card.onclick = () => showLevel(i);
    grid.appendChild(card);
  });
}

async function fetchLb(url) {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch("https://corsproxy.io/?" + encodeURIComponent(url));
  if (!res.ok) throw new Error();
  const data = await res.json();
  cache.set(url, data);
  return data;
}

async function showLevel(i) {
  const lvl = levels[i];
  document.getElementById('detail-name').textContent = lvl.name;
  document.getElementById('detail-creator').textContent = lvl.creator ? `by ${lvl.creator}` : 'Official';
  document.getElementById('detail-thumb').src = lvl.thumbnail;

  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:#64748b">Loading…</td></tr>';

  switchTab('detail');

  try {
    const data = await fetchLb(lvl.api);
    data.sort((a,b) => a.completion_time - b.completion_time);
    tbody.innerHTML = '';
    data.slice(0,500).forEach((r,j) => {
      const rank = j+1;
      const cls = rank===1 ? 'rank-1' : rank===2 ? 'rank-2' : rank===3 ? 'rank-3' : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong class="${cls}">${rank}</strong></td>
                      <td><img src="${getArrowImg(r.arrow_name)}" class="arrow-img"></td>
                      <td><a href="#" class="player-link" data-user="${r.username}">${r.username}</a></td>
                      <td><strong>${formatTime(r.completion_time)}</strong></td>`;
      tr.querySelector('.player-link').onclick = e => { e.preventDefault(); loadProfile(r.username); };
      tbody.appendChild(tr);
    });
  } catch { tbody.innerHTML = '<tr><td colspan="4" style="color:#fca5a5">Failed to load</td></tr>'; }
}

async function loadProfile(name) {
  document.getElementById('profile-name').textContent = name;
  const p = profiles[name] || {};
  document.getElementById('profile-pfp').src = p.pfp || "assets/defaultpfp.png";

  const stats = { maps:0, wr:0, best:Infinity, total:0, ranks:[], times:[] };

  const all = await Promise.allSettled(levels.map(l => fetchLb(l.api)));
  all.forEach((res, i) => {
    if (res.status !== 'fulfilled') return;
    const entry = res.value.find(e => e.username === name);
    if (entry) {
      const rank = res.value.indexOf(entry) + 1;
      stats.maps++;
      stats.total += entry.completion_time;
      stats.ranks.push(rank);
      stats.times.push(entry.completion_time);
      if (rank === 1) stats.wr++;
      if (rank < stats.best) stats.best = rank;
    }
  });

  const avgRank = stats.maps ? (stats.ranks.reduce((a,b)=>a+b,0)/stats.maps).toFixed(2) : "-";
  const avgTime = stats.maps ? formatTime(stats.times.reduce((a,b)=>a+b,0)/stats.maps) : "-";
  const bestText = stats.wr > 0 ? `${stats.wr} WR${stats.wr>1?'s':''}` : stats.best;

  document.getElementById('stats-row').innerHTML = `
    <div class="stat-box"><strong>${stats.maps}</strong><small>Maps on LB</small></div>
    <div class="stat-box"><strong>${bestText}</strong><small>Best Rank</small></div>
    <div class="stat-box"><strong>${avgRank}</strong><small>Avg Rank</small></div>
    <div class="stat-box"><strong>${avgTime}</strong><small>Avg Time</small></div>
    <div class="stat-box"><strong>${formatTime(stats.total)}</strong><small>Total Time</small></div>
  `;

  const tbody = document.getElementById('profile-table');
  tbody.innerHTML = '';
  all.forEach((res, i) => {
    if (res.status !== 'fulfilled') return;
    const entry = res.value.find(e => e.username === name);
    if (entry) {
      const rank = res.value.indexOf(entry) + 1;
      const cls = rank===1 ? 'rank-1' : rank===2 ? 'rank-2' : rank===3 ? 'rank-3' : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><a href="#" class="level-link" data-lvl="${i}">${levels[i].name}</a></td>
                      <td><strong class="${cls}">${rank}</strong></td>
                      <td><img src="${getArrowImg(entry.arrow_name)}" class="arrow-img"></td>
                      <td><strong>${formatTime(entry.completion_time)}</strong></td>`;
      tr.querySelector('.level-link').onclick = e => { e.preventDefault(); showLevel(i); };
      tbody.appendChild(tr);
    }
  });

  switchTab('profile');
}

async function renderGlobalLb(type) {
  const tbody = document.getElementById('global-lb-body');
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:2rem;color:#64748b">Loading…</td></tr>';

  const players = {};
  const all = await Promise.allSettled(levels.map(l => fetchLb(l.api)));
  all.forEach(res => {
    if (res.status !== 'fulfilled') return;
    res.value.forEach(r => {
      if (!players[r.username]) players[r.username] = { wr:0, best:Infinity, total:0, count:0, times:[], ranks:[] };
      const p = players[r.username];
      const rank = res.value.indexOf(r) + 1;
      p.total += r.completion_time;
      p.count++;
      p.times.push(r.completion_time);
      p.ranks.push(rank);
      if (rank === 1) p.wr++;
      if (rank < p.best) p.best = rank;
    });
  });

  const list = Object.entries(players).map(([name, s]) => ({
    name,
    wr: s.wr,
    best: s.best,
    total: s.total,
    avgTime: s.count ? s.times.reduce((a,b)=>a+b,0)/s.count : Infinity,
    avgRank: s.count ? s.ranks.reduce((a,b)=>a+b,0)/s.count : Infinity
  }));

  if (type === 'wr') list.sort((a,b) => b.wr - a.wr || a.best - b.best);
  if (type === 'total') list.sort((a,b) => a.total - b.total);
  if (type === 'avgtime') list.sort((a,b) => a.avgTime - b.avgTime);
  if (type === 'avgrank') list.sort((a,b) => a.avgRank - b.avgRank);

  const search = document.getElementById('player-search').value.toLowerCase();
  const filtered = search ? list.filter(p => p.name.toLowerCase().includes(search)) : list;

  tbody.innerHTML = '';
  filtered.forEach((p,i) => {
    const val = type==='wr' ? `${p.wr} WR${p.wr>1?'s':''}` :
                type==='total' ? formatTime(p.total) :
                type==='avgtime' ? formatTime(p.avgTime) :
                p.avgRank.toFixed(2);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${i+1}</strong></td>
                    <td><a href="#" class="player-link" data-user="${p.name}">${p.name}</a></td>
                    <td><strong>${val}</strong></td>`;
    tr.querySelector('.player-link').onclick = e => { e.preventDefault(); loadProfile(p.name); };
    tbody.appendChild(tr);
  });
}

document.getElementById('player-search').oninput = () => renderGlobalLb(document.querySelector('.lb-tab.active').dataset.lb);

Promise.all([
  fetch('levels.json').then(r => r.ok ? r.json() : []),
  fetch('profiles.json').then(r => r.ok ? r.json() : {})
]).then(([l,p]) => {
  levels = l; profiles = p;
  renderLevels();
  switchTab('officials');
});
