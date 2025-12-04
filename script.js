let levels = [], profiles = {}, playerCache = new Map(); 

const views = {
  list: document.getElementById('list-view'),
  detail: document.getElementById('detail-view'),
  profile: document.getElementById('profile-view')
};

document.getElementById('back-to-levels').onclick = () => showView('list');
document.getElementById('back-to-leaderboard').onclick = () => showView('detail');

function showView(name) {
  Object.values(views).forEach(v => v.classList.add('hidden'));
  views[name].classList.remove('hidden');
  if (name === 'list') window.scrollTo(0, 0);
}

function formatTime(seconds) {
  if (!seconds) return "-";
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

async function fetchWithCache(url) {
  if (playerCache.has(url)) return playerCache.get(url);
  const proxy = "https://corsproxy.io/?" + encodeURIComponent(url);
  const res = await fetch(proxy);
  if (!res.ok) throw new Error("Failed");
  const data = await res.json();
  playerCache.set(url, data);
  return data;
}

async function showLevel(index) {
  const lvl = levels[index];
  document.getElementById('detail-name').textContent = lvl.name;
  document.getElementById('detail-creator').textContent = lvl.creator ? `by ${lvl.creator}` : 'Official Level';
  document.getElementById('detail-thumb').src = lvl.thumbnail;

  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:#64748b">Loading…</td></tr>';

  showView('detail');

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

async function loadPlayerProfile(username) {
  try {
    document.getElementById('profile-name').textContent = username;
    const p = profiles[username] || {};
    document.getElementById('profile-pfp').src = p.pfp || "assets/defaultpfp.png";
    // Fixed ID from 'banner' → 'profile-banner'
    document.getElementById('profile-banner').style.backgroundImage = `url(${p.banner || "assets/defaultbanner.jpg"})`;

    const records = [];
    let totalTime = 0, totalRank = 0, count = 0, bestRank = Infinity, wr = 0;

    // Fetch ALL level leaderboards in parallel
    const promises = levels.map(lvl => fetchWithCache(lvl.api));
    const allLeaderboards = await Promise.allSettled(promises);

    allLeaderboards.forEach((result, i) => {
      if (result.status !== 'fulfilled') return;
      const lb = result.value;
      const entry = lb.find(e => e.username === username);
      if (entry) {
        const rank = lb.indexOf(entry) + 1;
        records.push({
          name: levels[i].name,
          rank,
          time: entry.completion_time,
          arrow: entry.arrow_name
        });
        totalTime += entry.completion_time;
        totalRank += rank;
        count++;
        if (rank < bestRank) bestRank = rank;
        if (rank === 1) wr++;
      }
    });

    const avgRank = count ? (totalRank / count).toFixed(2) : "-";
    const avgTime = count ? formatTime(totalTime / count) : "-";
    const bestText = wr > 0 ? `${wr} World Record${wr > 1 ? 's' : ''}` : bestRank;

    document.getElementById('stats-row').innerHTML = `
      <div class="stat-box"><strong>${count}</strong><small>Maps on LB</small></div>
      <div class="stat-box"><strong>${avgRank}</strong><small>Avg Rank</small></div>
      <div class="stat-box"><strong>${avgTime}</strong><small>Avg Time</small></div>
      <div class="stat-box"><strong>${bestText}</strong><small>Best Rank</small></div>
    `;

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
        if (idx !== -1) showLevel(idx);
      };
      tbody.appendChild(tr);
    });

    showView('profile');
  } catch (err) {
    console.error("Failed to load profile:", err);
    alert("Failed to load profile. Check console for details.");
  }
}

// Load data
Promise.all([
  fetch('levels.json').then(r => r.ok ? r.json() : []),
  fetch('profiles.json').then(r => r.ok ? r.json() : {})
]).then(([lvl, prof]) => {
  levels = lvl;
  profiles = prof;
  renderLevels();
}).catch(err => {
  document.body.innerHTML = `<h1 style="text-align:center;color:#fca5a5;padding:5rem">Failed to load data: ${err.message}</h1>`;
});
