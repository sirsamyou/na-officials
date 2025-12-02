let levels = [], profiles = {}, currentLevelIndex = -1;

const views = {
  list: document.getElementById('list-view'),
  detail: document.getElementById('detail-view'),
  profile: document.getElementById('profile-view')
};

document.getElementById('back-to-levels').onclick = () => showView('list');
document.getElementById('back-to-leaderboard').onclick = () => showView('detail');

function showView(view) {
  Object.values(views).forEach(v => v.classList.add('hidden'));
  views[view].classList.remove('hidden');
}

function formatTime(s) {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return mins > 0 ? `${mins}:${secs.toString().padStart(2,'0')}.${ms.toString().padStart(3,'0')}` : `${secs}.${ms.toString().padStart(3,'0')}`;
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
    card.innerHTML = `<img src="${lvl.thumbnail}" onerror="this.src='thumbs/placeholder.png'">
                      <h3>${lvl.name}</h3>
                      <p>${lvl.creator ? 'by ' + lvl.creator : 'Official'}</p>`;
    card.onclick = () => showLevel(i);
    grid.appendChild(card);
  });
}

async function showLevel(i) {
  currentLevelIndex = i;
  const lvl = levels[i];
  document.getElementById('detail-name').textContent = lvl.name;
  document.getElementById('detail-creator').textContent = lvl.creator ? `by ${lvl.creator}` : 'Official Level';
  document.getElementById('detail-thumb').src = lvl.thumbnail;

  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;">Loading the leaderboard…</td></tr>';

  showView('detail');

  const proxy = "https://corsproxy.io/?" + encodeURIComponent(lvl.api);
  try {
    const res = await fetch(proxy);
    if (!res.ok) throw new Error();
    const data = await res.json();
    data.sort((a,b) => a.completion_time - b.completion_time);

    tbody.innerHTML = '';
    data.slice(0, 500).forEach((run, idx) => {
      const tr = document.createElement('tr');
      const rank = idx + 1;
      tr.innerHTML = `
        <td>${rank <= 3 ? `<strong class="gold">${rank}</strong>` : rank}</td>
        <td><img src="${getArrowImg(run.arrow_name)}" class="arrow-img"></td>
        <td><a href="#" class="player-link" data-user="${run.username}">${run.username}</a></td>
        <td><strong>${formatTime(run.completion_time)}</strong></td>
      `;
      tr.querySelector('.player-link').onclick = (e) => {
        e.preventDefault();
        showProfile(run.username, data);
      };
      tbody.appendChild(tr);
    });
  } catch {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#fca5a5">Failed to load leaderboard</td></tr>';
  }
}

function showProfile(username, currentLeaderboardData) {
  const p = profiles[username] || {};
  document.getElementById('profile-name').textContent = username;
  document.getElementById('profile-pfp').src = p.pfp || "assets/defaultpfp.png";
  document.getElementById('profile-banner').style.backgroundImage = `url(${p.banner || "assets/defaultbanner.jpg"})`;

  // Calculate stats
  let records = [];
  let totalRank = 0, count = 0, best = Infinity, wrCount = 0;

  levels.forEach(lvl => {
    const entry = currentLeaderboardData?.find(r => r.username === username) || 
                   (lvl.runs ? lvl.runs.find(r => r.username === username) : null);
    if (entry) {
      const rank = currentLeaderboardData ? currentLeaderboardData.indexOf(entry) + 1 : entry.rank || 999;
      records.push({ level: lvl.name, time: entry.completion_time, rank, arrow: entry.arrow_name });
      if (rank <= best) best = rank;
      if (rank === 1) wrCount++;
      totalRank += rank;
      count++;
    }
  });

  const avgRank = count ? (totalRank / count).toFixed(2) : "-";
  const avgTime = count ? formatTime(records.reduce((a,b)=>a+b.time,0)/count) : "-";

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat"><strong>${count}</strong><small>Maps on LB</small></div>
    <div class="stat"><strong>${avgRank}</strong><small>Avg Rank</small></div>
    <div class="stat"><strong>${avgTime}</strong><small>Avg Time</small></div>
    <div class="stat"><strong>${wrCount > 0 ? wrCount + ' World Records' : best}</strong><small>Best Rank</small></div>
  `;

  const tbody = document.getElementById('profile-records');
  tbody.innerHTML = '';
  records.sort((a,b) => a.rank - b.rank).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="#" class="level-link" data-level="${r.level}">${r.level}</a></td>
      <td>${r.rank <= 3 ? `<strong class="gold">${r.rank}</strong>` : r.rank}</td>
      <td>${formatTime(r.time)}</td>
      <td><img src="${getArrowImg(r.arrow)}" class="arrow-img"></td>
    `;
    tr.querySelector('.level-link').onclick = e => {
      e.preventDefault();
      const idx = levels.findIndex(l => l.name === r.level);
      if (idx !== -1) showLevel(idx);
    };
    tbody.appendChild(tr);
  });

  showView('profile');
}

// Load data
Promise.all([
  fetch('levels.json').then(r => r.ok ? r.json() : []),
  fetch('profiles.json').then(r => r.ok ? r.json() : {}).then(data => {
    Object.keys(data).forEach(k => profiles[k] = data[k]);
  })
]).then(([lvlData]) => {
  levels = lvlData;
  renderLevels();
}).catch(() => {
  document.body.innerHTML = "<h1 style='text-align:center;color:#fca5a5;padding:5rem'>Failed to load data</h1>";
});
