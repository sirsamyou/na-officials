// Global state
let levels = [];
let profiles = {};
let playerCache = new Map();
let allPlayerStats = [];
let currentLevelIndex = null;

// DOM elements
const views = {
  officials: document.getElementById('officials-view'),
  list: document.getElementById('list-view'),
  detail: document.getElementById('detail-view'),
  profile: document.getElementById('profile-view'),
  leaderboards: document.getElementById('leaderboards-view')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadData();
});

function setupEventListeners() {
  // Tab switching
  document.getElementById('tab-officials').onclick = () => switchTab('officials');
  document.getElementById('tab-leaderboards').onclick = () => switchTab('leaderboards');
  
  // Back buttons
  document.getElementById('back-to-levels').onclick = () => showView('list');
  document.getElementById('back-to-leaderboard').onclick = () => showView('detail');
  
  // Leaderboard tabs
  document.getElementById('lb-worldrecords').onclick = () => switchLeaderboardTab('worldrecords');
  document.getElementById('lb-totaltime').onclick = () => switchLeaderboardTab('totaltime');
  document.getElementById('lb-avgtime').onclick = () => switchLeaderboardTab('avgtime');
  document.getElementById('lb-avgrank').onclick = () => switchLeaderboardTab('avgrank');
  
  // Search
  document.getElementById('player-search').oninput = (e) => {
    renderLeaderboardTable(e.target.value);
  };
}

function switchTab(tab) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  
  if (tab === 'officials') {
    document.getElementById('tab-officials').classList.add('active');
    views.officials.classList.remove('hidden');
    views.leaderboards.classList.add('hidden');
    showView('list');
  } else if (tab === 'leaderboards') {
    document.getElementById('tab-leaderboards').classList.add('active');
    views.officials.classList.add('hidden');
    views.leaderboards.classList.remove('hidden');
    
    if (allPlayerStats.length === 0 && levels.length > 0) {
      calculateAllPlayerStats();
    } else {
      renderLeaderboardTable();
    }
  }
}

function showView(name) {
  views.list.classList.add('hidden');
  views.detail.classList.add('hidden');
  views.profile.classList.add('hidden');
  
  if (name === 'list') {
    views.list.classList.remove('hidden');
    window.scrollTo(0, 0);
  } else if (name === 'detail') {
    views.detail.classList.remove('hidden');
  } else if (name === 'profile') {
    views.profile.classList.remove('hidden');
  }
}

// Utility functions
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

async function fetchWithCache(url) {
  if (playerCache.has(url)) return playerCache.get(url);
  const proxy = "https://corsproxy.io/?" + encodeURIComponent(url);
  const res = await fetch(proxy);
  if (!res.ok) throw new Error("Failed to fetch");
  const data = await res.json();
  playerCache.set(url, data);
  return data;
}

function getRankClass(rank) {
  if (rank === 1) return 'rank-1';
  if (rank === 2) return 'rank-2';
  if (rank === 3) return 'rank-3';
  return '';
}

// Load data
async function loadData() {
  try {
    const [lvl, prof] = await Promise.all([
      fetch('levels.json').then(r => r.ok ? r.json() : []),
      fetch('profiles.json').then(r => r.ok ? r.json() : {})
    ]);
    
    levels = lvl;
    profiles = prof;
    renderLevels();
  } catch (err) {
    console.error('Failed to load data:', err);
    document.body.innerHTML = `<h1 style="text-align:center;color:#fca5a5;padding:5rem">Failed to load data: ${err.message}</h1>`;
  }
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

// Show level detail
async function showLevel(index) {
  currentLevelIndex = index;
  const lvl = levels[index];
  
  document.getElementById('detail-name').textContent = lvl.name;
  document.getElementById('detail-creator').textContent = lvl.creator ? `by ${lvl.creator}` : 'Official Level';
  document.getElementById('detail-thumb').src = lvl.thumbnail;

  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '<tr><td colspan="4" class="loading">Loading leaderboard...</td></tr>';

  showView('detail');

  try {
    const data = await fetchWithCache(lvl.api);
    data.sort((a, b) => a.completion_time - b.completion_time);

    tbody.innerHTML = '';
    data.slice(0, 500).forEach((run, i) => {
      const rank = i + 1;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong class="${getRankClass(rank)}">${rank}</strong></td>
        <td><img src="${getArrowImg(run.arrow_name)}" class="arrow-img" alt=""></td>
        <td><a href="#" class="player-link">${run.username}</a></td>
        <td><strong>${formatTime(run.completion_time)}</strong></td>
      `;
      
      tr.querySelector('.player-link').onclick = (e) => {
        e.preventDefault();
        loadPlayerProfile(run.username);
      };
      
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('Failed to load leaderboard:', e);
    tbody.innerHTML = '<tr><td colspan="4" style="color:#fca5a5;text-align:center;padding:2rem">Failed to load leaderboard</td></tr>';
  }
}

// Load player profile
async function loadPlayerProfile(username) {
  try {
    document.getElementById('profile-name').textContent = username;
    
    const p = profiles[username] || {};
    document.getElementById('profile-pfp').src = p.pfp || "assets/defaultpfp.png";
    document.getElementById('profile-banner').style.backgroundImage = `url(${p.banner || "assets/defaultbanner.jpg"})`;

    const records = [];
    let totalTime = 0, totalRank = 0, count = 0, bestRank = Infinity, wr = 0;

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
    const totalTimeFormatted = count ? formatTime(totalTime) : "-";
    const bestText = wr > 0 ? `${wr} WR${wr > 1 ? 's' : ''}` : bestRank;

    // Render stats in correct order: Maps on LB, Best Rank, Average Rank, Average Time, Total Time
    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-box"><strong>${count}</strong><small>Maps on LB</small></div>
      <div class="stat-box"><strong>${bestText}</strong><small>Best Rank</small></div>
      <div class="stat-box"><strong>${avgRank}</strong><small>Average Rank</small></div>
      <div class="stat-box"><strong>${avgTime}</strong><small>Average Time</small></div>
      <div class="stat-box"><strong>${totalTimeFormatted}</strong><small>Total Time</small></div>
    `;

    const tbody = document.getElementById('profile-table');
    tbody.innerHTML = '';
    
    records.sort((a, b) => a.rank - b.rank).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><a href="#" class="level-link">${r.name}</a></td>
        <td><strong class="${getRankClass(r.rank)}">${r.rank}</strong></td>
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

// Calculate all player stats for leaderboards
async function calculateAllPlayerStats() {
  const tbody = document.getElementById('lb-table-body');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Calculating leaderboards...</td></tr>';
  
  const playerStatsMap = new Map();

  try {
    const promises = levels.map(lvl => fetchWithCache(lvl.api));
    const allLeaderboards = await Promise.allSettled(promises);

    allLeaderboards.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      const lb = result.value;
      
      lb.forEach((entry, index) => {
        const rank = index + 1;
        const username = entry.username;
        
        if (!playerStatsMap.has(username)) {
          playerStatsMap.set(username, {
            username,
            totalTime: 0,
            totalRank: 0,
            count: 0,
            bestRank: Infinity,
            worldRecords: 0
          });
        }
        
        const stats = playerStatsMap.get(username);
        stats.totalTime += entry.completion_time;
        stats.totalRank += rank;
        stats.count++;
        if (rank < stats.bestRank) stats.bestRank = rank;
        if (rank === 1) stats.worldRecords++;
      });
    });

    allPlayerStats = Array.from(playerStatsMap.values()).map(stats => ({
      ...stats,
      avgRank: stats.totalRank / stats.count,
      avgTime: stats.totalTime / stats.count
    }));

    renderLeaderboardTable();
  } catch (err) {
    console.error("Failed to calculate stats:", err);
    tbody.innerHTML = '<tr><td colspan="6" style="color:#fca5a5;text-align:center;padding:2rem">Failed to load leaderboard data</td></tr>';
  }
}

// Switch leaderboard tab
function switchLeaderboardTab(tab) {
  document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`lb-${tab}`).classList.add('active');
  renderLeaderboardTable();
}

// Render leaderboard table
function renderLeaderboardTable(searchQuery = '') {
  const activeTab = document.querySelector('.lb-tab.active').id.replace('lb-', '');
  const thead = document.getElementById('lb-table-header');
  const tbody = document.getElementById('lb-table-body');
  
  // Filter players by search
  let filteredPlayers = allPlayerStats;
  if (searchQuery) {
    filteredPlayers = allPlayerStats.filter(p => 
      p.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  
  // Sort based on active tab
  let sorted = [...filteredPlayers];
  
  switch (activeTab) {
    case 'worldrecords':
      sorted.sort((a, b) => {
        if (b.worldRecords !== a.worldRecords) return b.worldRecords - a.worldRecords;
        return a.bestRank - b.bestRank;
      });
      thead.innerHTML = `
        <th>Rank</th>
        <th>Player</th>
        <th>World Records</th>
        <th>Best Rank</th>
        <th>Maps on LB</th>
      `;
      break;
      
    case 'totaltime':
      sorted.sort((a, b) => a.totalTime - b.totalTime);
      thead.innerHTML = `
        <th>Rank</th>
        <th>Player</th>
        <th>Total Time</th>
        <th>Maps on LB</th>
      `;
      break;
      
    case 'avgtime':
      sorted.sort((a, b) => a.avgTime - b.avgTime);
      thead.innerHTML = `
        <th>Rank</th>
        <th>Player</th>
        <th>Average Time</th>
        <th>Maps on LB</th>
      `;
      break;
      
    case 'avgrank':
      sorted.sort((a, b) => a.avgRank - b.avgRank);
      thead.innerHTML = `
        <th>Rank</th>
        <th>Player</th>
        <th>Average Rank</th>
        <th>Maps on LB</th>
      `;
      break;
  }
  
  // Render rows
  tbody.innerHTML = '';
  
  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#64748b">No players found</td></tr>';
    return;
  }
  
  sorted.forEach((player, i) => {
    const rank = i + 1;
    const tr = document.createElement('tr');
    
    let rankClass = '';
    if (rank === 1) rankClass = 'rank-1';
    else if (rank === 2) rankClass = 'rank-2';
    else if (rank === 3) rankClass = 'rank-3';
    
    let content = `
      <td><strong class="${rankClass}">${rank}</strong></td>
      <td><a href="#" class="player-link">${player.username}</a></td>
    `;
    
    switch (activeTab) {
      case 'worldrecords':
        content += `
          <td><strong>${player.worldRecords}</strong></td>
          <td><strong>${player.worldRecords > 0 ? `${player.worldRecords} WR${player.worldRecords > 1 ? 's' : ''}` : player.bestRank}</strong></td>
          <td>${player.count}</td>
        `;
        break;
        
      case 'totaltime':
        content += `
          <td><strong>${formatTime(player.totalTime)}</strong></td>
          <td>${player.count}</td>
        `;
        break;
        
      case 'avgtime':
        content += `
          <td><strong>${formatTime(player.avgTime)}</strong></td>
          <td>${player.count}</td>
        `;
        break;
        
      case 'avgrank':
        content += `
          <td><strong>${player.avgRank.toFixed(2)}</strong></td>
          <td>${player.count}</td>
        `;
        break;
    }
    
    tr.innerHTML = content;
    
    tr.querySelector('.player-link').onclick = (e) => {
      e.preventDefault();
      switchTab('officials');
      loadPlayerProfile(player.username);
    };
    
    tbody.appendChild(tr);
  });
}
