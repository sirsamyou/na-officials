let levels = [], profiles = {}, cache = new Map();

const tabs = document.querySelectorAll('.tab');
tabs.forEach(t => t.onclick = () => {
  tabs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + t.dataset.tab).classList.add('active');
});

document.getElementById('back-to-officials').onclick = () => showTab('officials');
document.getElementById('back-to-detail').onclick = () => showView('detail');

function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelectorAll('.hidden').forEach(v => v.classList.add('hidden'));
}

function formatTime(s) {
  if (!s) return "-";
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return m > 0 ? `${m}:${String(sec).padStart(6,'0')}` : sec;
}

function getArrow(name) {
  if (!name) return "assets/narrow.png";
  name = name.toLowerCase();
  if (name.includes("speedy")) return "assets/speedy.png";
  if (name.includes("energy")) return "assets/energy.png";
  return "assets/narrow.png";
}

async function fetchLB(url) {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch("https://corsproxy.io/?" + encodeURIComponent(url));
  if (!res.ok) throw new Error();
  const data = await res.json();
  cache.set(url, data);
  return data;
}

function renderLevels() {
  const grid = document.getElementById('levels-grid');
  grid.innerHTML = '';
  levels.forEach((l, i) => {
    const card = document.createElement('div');
    card.className = 'level-card';
    card.innerHTML = `<img src="${l.thumbnail}" onerror="this.src='thumbs/placeholder.png'"><h3>${l.name}</h3><p>${l.creator ? 'by ' + l.creator : 'Official'}</p>`;
    card.onclick = () => showLevel(i);
    grid.appendChild(card);
  });
}

async function showLevel(i) {
  const l = levels[i];
  document.getElementById('detail-name').textContent = l.name;
  document.getElementById('detail-creator').textContent = l.creator ? `by ${l.creator}` : 'Official';
  document.getElementById('detail-thumb').src = l.thumbnail;

  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:#64748b">Loading…</td></tr>';

  document.querySelectorAll('.hidden').forEach(v => v.classList.add('hidden'));
  document.getElementById('detail-view').classList.remove('hidden');

  try {
    const data = await fetchLB(l.api);
    data.sort((a,b) => a.completion_time - b.completion_time);
    tbody.innerHTML = '';
    data.slice(0,500).forEach((r,j) => {
      const rank = j+1;
      const cls = rank===1?'rank-1':rank===2?'rank-2':rank===3?'rank-3':'';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong class="${cls}">${rank}</strong></td>
        <td><img src="${getArrow(r.arrow_name)}" class="arrow-img"></td>
        <td><a href="#" class="player-link" data-user="${r.username}">${r.username}</a></td>
        <td><strong>${formatTime(r.completion_time)}</strong></td>`;
      tr.querySelector('.player-link').onclick = e => { e.preventDefault(); showProfile(r.username); };
      tbody.appendChild(tr);
    });
  } catch { tbody.innerHTML = '<tr><td colspan="4" style="color:#fca5a5">Failed to load</td></tr>'; }
}

async function showProfile(user) {
  document.getElementById('profile-name').textContent = user;
  const p = profiles[user] || {};
  document.getElementById('profile-pfp').src = p.pfp || "assets/defaultpfp.png";

  const stats = { maps:0, wr:0, best:Infinity, total:0, ranks:[] };
  const records = [];

  await Promise.all(levels.map(async l => {
    try {
      const lb = await fetchLB(l.api);
      const e = lb.find(x => x.username === user);
      if (e) {
        const rank = lb.indexOf(e)+1;
        stats.maps++;
        stats.total += e.completion_time;
        stats.ranks.push(rank);
        if (rank === 1) stats.wr++;
        if (rank < stats.best) stats.best = rank;
        records.push({ name: l.name, rank, time: e.completion_time, arrow: e.arrow_name });
      }
    } catch {}
  }));

  const avgRank = stats.maps ? (stats.ranks.reduce((a,b)=>a+b,0)/stats.maps).toFixed(2) : "-";
  const avgTime = stats.maps ? formatTime(stats.total / stats.maps) : "-";
  const totalTime = formatTime(stats.total);
  const bestText = stats.wr > 0 ? `${stats.wr} WR${stats.wr>1?'s':''}` : stats.best;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat"><strong>${stats.maps}</strong><small>Maps on LB</small></div>
    <div class="stat"><strong>${bestText}</strong><small>Best Rank</small></div>
    <div class="stat"><strong>${avgRank}</strong><small>Avg Rank</small></div>
    <div class="stat"><strong>${avgTime}</strong><small>Avg Time</small></div>
    <div class="stat"><strong>${totalTime}</strong><small>Total Time</small></div>
  `;

  const tbody = document.getElementById('profile-table');
  tbody.innerHTML = '';
  records.sort((a,b)=>a.rank-b.rank).forEach(r => {
    const cls = r.rank===1?'rank-1':r.rank===2?'rank-2':r.rank===3?'rank-3':'';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><a href="#" class="level-link" data-level="${r.name}">${r.name}</a></td>
      <td><strong class="${cls}">${r.rank}</strong></td>
      <td><img src="${getArrow(r.arrow)}" class="arrow-img"></td>
      <td><strong>${formatTime(r.time)}</strong></td>`;
    tr.querySelector('.level-link').onclick = e => { e.preventDefault(); const i = levels.findIndex(x=>x.name===r.name); if(i>-1) showLevel(i); };
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.hidden').forEach(v => v.classList.add('hidden'));
  document.getElementById('profile-view').classList.remove('hidden');
}

// Global Leaderboards
async function renderGlobalLBs() {
  const playerStats = {};
  await Promise.all(levels.map(async l => {
    try {
      const lb = await fetchLB(l.api);
      lb.forEach((e,j) => {
        if (!playerStats[e.username]) playerStats[e.username] = { wr:0, best:Infinity, total:0, count:0, ranks:[] };
        const rank = j+1;
        playerStats[e.username].count++;
        playerStats[e.username].total += e.completion_time;
        playerStats[e.username].ranks.push(rank);
        if (rank === 1) playerStats[e.username].wr++;
        if (rank < playerStats[e.username].best) playerStats[e.username].best = rank;
      });
    } catch {}
  }));

  const list = Object.entries(playerStats).map(([name, s]) => ({
    name,
    wr: s.wr,
    best: s.best,
    total: s.total,
    avgTime: s.total / s.count,
    avgRank: s.ranks.reduce((a,b)=>a+b,0)/s.count,
    maps: s.count
  }));

  // World Records
  list.sort((a,b) => b.wr - a.wr || a.best - b.best);
  document.getElementById('wr-lb').innerHTML = list.slice(0,50).map((p,i) => `
    <tr><td><strong class="${i<3?'rank-'+(i+1):''}">${i+1}</strong></td>
    <td><a href="#" class="player-link" onclick="event.preventDefault();showProfile('${p.name}')">${p.name}</a></td>
    <td><strong>${p.wr}</strong></td><td>${p.best}</td></tr>`).join('');

  // Total Time
  const totalSorted = [...list].sort((a,b) => a.total - b.total);
  document.getElementById('total-lb').innerHTML = totalSorted.slice(0,50).map((p,i) => `
    <tr><td><strong class="${i<3?'rank-'+(i+1):''}">${i+1}</strong></td>
    <td><a href="#" class="player-link" onclick="event.preventDefault();showProfile('${p.name}')">${p.name}</a></td>
    <td><strong>${formatTime(p.total)}</strong></td><td>${p.maps}</td></tr>`).join('');

  // Avg Time
  const avgTimeSorted = [...list].filter(p=>p.maps>=3).sort((a,b) => a.avgTime - b.avgTime);
  document.getElementById('avgtime-lb').innerHTML = avgTimeSorted.slice(0,50).map((p,i) => `
    <tr><td><strong class="${i<3?'rank-'+(i+1):''}">${i+1}</strong></td>
    <td><a href="#" class="player-link" onclick="event.preventDefault();showProfile('${p.name}')">${p.name}</a></td>
    <td><strong>${formatTime(p.avgTime)}</strong></td><td>${p.maps}</td></tr>`).join('');

  // Avg Rank
  const avgRankSorted = [...list].filter(p=>p.maps>=3).sort((a,b) => a.avgRank - b.avgRank);
  document.getElementById('avgrank-lb').innerHTML = avgRankSorted.slice(0,50).map((p,i) => `
    <tr><td><strong class="${i<3?'rank-'+(i+1):''}">${i+1}</strong></td>
    <td><a href="#" class="player-link" onclick="event.preventDefault();showProfile('${p.name}')">${p.name}</a></td>
    <td><strong>${p.avgRank.toFixed(2)}</strong></td><td>${p.maps}</td></tr>`).join('');
}

// Search
document.getElementById('player-search').oninput = e => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('#tab-leaderboards td a').forEach(a => {
    a.parentElement.parentElement.style.display = a.textContent.toLowerCase().includes(term) ? '' : 'none';
  });
};

// Load
Promise.all([
  fetch('levels.json').then(r => r.json()),
  fetch('profiles.json').then(r => r.json())
]).then(([lvls, profs]) => {
  levels = lvls;
  profiles = profs;
  renderLevels();
  renderGlobalLBs();
});
