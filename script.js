let levels = [], profiles = {}, playerCache = new Map();
let allPlayerStats = new Map(); // username → stats object

const views = {
  officials: document.getElementById('officials-view'),
  detail: document.getElementById('detail-view'),
  profile: document.getElementById('profile-view'),
  leaderboards: document.getElementById('leaderboards-view')
};

const tabBtns = document.querySelectorAll('.tab-btn');
const lbTabs = document.querySelectorAll('.lb-tab');
const searchInput = document.getElementById('player-search');

// Navigation
tabBtns.forEach(btn => {
  btn.onclick = () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[tab].classList.add('active');
    if (tab === 'leaderboards') renderGlobalLeaderboard();
  };
});

document.getElementById('back-to-levels').onclick = () => switchTab('officials');
document.getElementById('back-from-profile').onclick = () => {
  if (views.leaderboards.classList.contains('active')) switchTab('leaderboards');
  else switchTab('detail');
};
document.getElementById('back-to-officials').onclick = () => switchTab('officials');

function switchTab(name) {
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  Object.values(views).forEach(v => v.classList.toggle('active', v.id === name + '-view'));
}

// Format time
function formatTime(seconds) {
  if (!seconds && seconds !== 0) return "-";
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3);
  return m > 0 ? `${m}:${String(s).padStart(6, '0')}` : s;
}

function getArrowImg(name) {
  if (!name) return "assets/narrow.png";
  const n = name.toLowerCase();
  if (n.includes("speedy")) return "assets/speedy.png";
  if (n.includes("energy")) return "assets/energy.png";
  return "assets/narrow.png";
}

// Fetch with CORS + cache
async function fetchWithCache(url) {
  if (playerCache.has(url)) return playerCache.get(url);
  const proxy = "https://corsproxy.io/?" + encodeURIComponent(url);
  const res = await fetch(proxy);
  if (!res.ok) throw new Error("Failed");
  const data = await res.json();
  playerCache.set(url, data);
  return data;
}

// Render levels grid
function renderLevels() {
  const grid = document.getElementById('levels-grid');
  grid.innerHTML = '';
  levels.forEach((lvl, i) => {
    const card = document.createElement('div');
    card.className = 'level-card';
    card.innerHTML = `
      <img src="${lvl.thumbnail}" onerror="this.src='thumbs/placeholder.png'" alt="${lvl.name}">
      <h3>${lvl.name}</h3>
      <p>${lvl.creator ? 'by ' + lvl.creator : 'Official'}</p>
    `;
    card.onclick = () => showLevel(i);
    grid.appendChild(card);
  });
}

// Show individual level
async function showLevel(index) {
  const lvl = levels[index];
  document.getElementById('detail-name').textContent = lvl.name;
  document.getElementById('detail-creator').textContent = lvl.creator ? `by ${lvl.creator}` : 'Official Level';
  document.getElementById('detail-thumb').src = lvl.thumbnail;

  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:3rem;color:#94a3b8">Loading…</td></tr>';

  switchTab('detail');

  try {
    const data = await fetchWithCache(lvl.api);
    data.sort((a, b) => a.completion_time - b.completion_time);

    tbody.innerHTML = '';
    data.slice(0, 500).forEach((run, i) => {
      const rank = i + 1;
      const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong class="${rankClass}">${rank}</strong></td>
        <td><img src="${getArrowImg(run.arrow_name)}" class="arrow-img" alt=""></td>
        <td><a href="#" class="player-link" data-user="${run.username}">${run.username}</a></td>
        <td><strong>${formatTime(run.completion_time)}</strong></td>
      `;
      tr.querySelector('.player-link').onclick = (e) => {
        e.preventDefault();
        loadPlayerProfile(run.username);
      };
      tbody.appendChild(tr);
    });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#fca5a5">Failed to load leaderboard</td></tr>';
  }
}

// Load player profile + compute global stats
async function loadPlayerProfile(username) {
  document.getElementById('profile-name').textContent = username;
  const p = profiles[username] || {};
  document.getElementById('profile-pfp').src = p.pfp || "assets/defaultpfp.png";
  document.getElementById('profile-banner').style.backgroundImage = `url(${p.banner || "assets/defaultbanner.jpg"})`;

  const records = [];
  let totalTime = 0, totalRank = 0, count = 0, bestRank = Infinity, wrCount = 0;

  const promises = levels.map(lvl => fetchWithCache(lvl.api));
  const results = await Promise.allSettled(promises);

  results.forEach((res, i) => {
    if (res.status !== 'fulfilled') return;
    const lb = res.value;
    const entry = lb.find(e => e.username === username);
    if (entry) {
      const rank = lb.findIndex(e => e.username === username) + 1;
      records.push({
        name: levels[i].name,
        rank,
        time: entry.completion_time,
        arrow: entry.arrow_name
      });
      totalTime += entry.completion_time;
      totalRank += rank;
      count++;
      if (rank === 1) wrCount++;
      if (rank < bestRank) bestRank = rank;
    }
  });

  const avgRank = count ? (totalRank / count).toFixed(2) : "-";
  const avgTime = count ? totalTime / count : 0;
  const formattedAvgTime = count ? formatTime(avgTime) : "-";
  const totalTimeFormatted = formatTime(totalTime);

  // Save to global stats
  allPlayerStats.set(username, {
    maps: count,
    bestRank: bestRank === Infinity ? "-" : (wrCount > 0 ? `${wrCount} WR` : bestRank),
    avgRank,
    avgTime,
    totalTime,
    wrCount
  });

  // Render stats in new order
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-box"><strong>${count}</strong><small>Maps on LB</small></div>
    <div class="stat-box"><strong>${bestRank === Infinity ? "-" : (wrCount > 0 ? `${wrCount} WR` : bestRank)}</strong><small>Best Rank</small></div>
    <div class="stat-box"><strong>${avgRank}</strong><small>Average Rank</small></div>
    <div class="stat-box"><strong>${formattedAvgTime}</strong><small>Average Time</small></div>
    <div class="stat-box"><strong>${totalTimeFormatted}</strong><small>Total Time</small></div>
  `;

  // Render personal records
  const tbody = document.getElementById('profile-table');
  tbody.innerHTML = '';
  records.sort((a, b) => a.rank - b.rank).forEach(r => {
    const rankClass = r.rank === 1 ? 'rank-1' : r.rank === 2 ? 'rank-2' : r.rank === 3 ? 'rank-3' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="#" class="level-link" data-level="${r.name}">${r.name}</a></td>
      <td><strong class="${rankClass}">${r.rank}</strong></td>
      <td><img src="${getArrowImg(r.arrow)}" class="arrow-img" alt=""></td>
      <td><strong>${formatTime(r.time)}</strong></td>
    `;
    tr.querySelector('.level-link').onclick = e => {
      e.preventDefault();
      const idx = levels.findIndex(l => l.name === r.name);
      if (idx !== -1) {
        showLevel(idx);
        switchTab('detail');
      }
    };
    tbody.appendChild(tr);
  });

  switchTab('profile');
}

// Global Leaderboard Rendering
async function renderGlobalLeaderboard() {
  if (allPlayerStats.size === 0) {
    // Preload all stats if not done
    const promises = levels.map(lvl => fetchWithCache(lvl.api));
    const results = await Promise.allSettled(promises);

    results.forEach((res, i) => {
      if (res.status !== 'fulfilled') return;
      res.value.forEach(entry => {
        const user = entry.username;
        if (!allPlayerStats.has(user)) allPlayerStats.set(user, { maps: 0, bestRank: Infinity, totalTime: 0, totalRank: 0, wrCount: 0 });
        const stats = allPlayerStats.get(user);
        stats.maps++;
        const rank = res.value.findIndex(e => e.username === user) + 1;
        stats.totalTime += entry.completion_time;
        stats.totalRank += rank;
        if (rank === 1) stats.wrCount++;
        if (rank < stats.bestRank) stats.bestRank = rank;
      });
    });

    // Compute averages
    allPlayerStats.forEach(stats => {
      if (stats.maps > 0) {
        stats.avgRank = (stats.totalRank / stats.maps).toFixed(2);
        stats.avgTime = stats.totalTime / stats.maps;
      }
    });
  }

  const tbody = document.getElementById('global-lb-body');
  const thead = document.getElementById('global-lb-head');
  const search = searchInput.value.toLowerCase();

  let players = Array.from(allPlayerStats.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .filter(p => p.name.toLowerCase().includes(search));

  // Sorting logic
  const activeTab = document.querySelector('.lb-tab.active').dataset.lb;

  if (activeTab === 'wr') {
    players.sort((a, b) => b.wrCount - a.wrCount || a.bestRank - b.bestRank);
    thead.innerHTML = `<tr><th>Rank</th><th>Player</th><th>WRs</th><th>Best Rank</th><th>Maps</th></tr>`;
  } else if (activeTab === 'total') {
    players.sort((a, b) => a.totalTime - b.totalTime || a.maps - b.maps);
    thead.innerHTML = `<tr><th>Rank</th><th>Player</th><th>Total Time</th><th>Maps</th><th>Avg Time</th></tr>`;
  } else if (activeTab === 'avg-time') {
    players.sort((a, b) => a.avgTime - b.avgTime || a.maps - b.maps);
    thead.innerHTML = `<tr><th>Rank</th><th>Player</th><th>Avg Time</th><th>Total Time</th><th>Maps</th></tr>`;
  } else if (activeTab === 'avg-rank') {
    players.sort((a, b) => a.avgRank - b.avgRank || a.maps - b.maps);
    thead.innerHTML = `<tr><th>Rank</th><th>Player</th><th>Avg Rank</th><th>Best Rank</th><th>Maps</th></tr>`;
  }

  tbody.innerHTML = '';
  players.slice(0, 200).forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = activeTab === 'wr' ? `
      <td><strong>${i+1}</strong></td>
      <td><a href="#" class="player-link" data-user="${p.name}">${p.name}</a></td>
      <td><strong>${p.wrCount}</strong></td>
      <td>${p.bestRank === Infinity ? "-" : p.bestRank}</td>
      <td>${p.maps}</td>
    ` : activeTab === 'total' ? `
      <td><strong>${i+1}</strong></td>
      <td><a href="#" class="player-link" data-user="${p.name}">${p.name}</a></td>
      <td><strong>${formatTime(p.totalTime)}</strong></td>
      <td>${p.maps}</td>
      <td>${formatTime(p.avgTime)}</td>
    ` : activeTab === 'avg-time' ? `
      <td><strong>${i+1}</strong></td>
      <td><a href="#" class="player-link" data-user="${p.name}">${p.name}</a></td>
      <td><strong>${formatTime(p.avgTime)}</strong></td>
      <td>${formatTime(p.totalTime)}</td>
      <td>${p.maps}</td>
    ` : `
      <td><strong>${i+1}</strong></td>
      <td><a href="#" class="player-link" data-user="${p.name}">${p.name}</a></td>
      <td><strong>${p.avgRank}</strong></td>
      <td>${p.bestRank === Infinity ? "-" : p.bestRank}</td>
      <td>${p.maps}</td>
    `;

    tr.querySelector('.player-link')?.addEventListener('click', e => {
      e.preventDefault();
      loadPlayerProfile(p.name);
    });
    tbody.appendChild(tr);
  });
}

// Live search
searchInput.addEventListener('input', () => renderGlobalLeaderboard());

// LB Tab switching
lbTabs.forEach(tab => {
  tab.onclick = () => {
    lbTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderGlobalLeaderboard();
  };
});

// Load initial data
Promise.all([
  fetch('levels.json').then(r => r.json()),
  fetch('profiles.json').then(r => r.json())
]).then(([lvl, prof]) => {
  levels = lvl;
  profiles = prof;
  renderLevels();
}).catch(err => {
  document.body.innerHTML = `<h1 style="text-align:center;color:#fca5a5;padding:10rem">Failed to load data: ${err.message}</h1>`;
});
