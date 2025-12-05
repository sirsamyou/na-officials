// Global state
let levels = [];
let profiles = {};
let playerCache = new Map();
let allPlayerStats = [];
let currentLevelIndex = null;
let currentLevelData = [];
let navigationHistory = [];
let currentProfileUsername = null;

// DOM elements
const views = {
  officials: document.getElementById('officials-view'),
  list: document.getElementById('list-view'),
  detail: document.getElementById('detail-view'),
  profile: document.getElementById('profile-view'),
  compare: document.getElementById('compare-view'),
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
  document.getElementById('back-to-levels').onclick = () => {
    showView('list');
    navigationHistory = [];
  };
  
  document.getElementById('back-to-leaderboard').onclick = () => {
    if (navigationHistory.length > 0) {
      const lastView = navigationHistory.pop();
      if (lastView === 'detail') {
        showView('detail');
      } else if (lastView === 'leaderboards') {
        switchTab('leaderboards');
      } else if (lastView === 'list') {
        showView('list');
      }
    } else {
      showView('list');
    }
  };

  document.getElementById('back-to-profile').onclick = () => {
    showView('profile');
  };

  // Compare button
  document.getElementById('compare-btn').onclick = () => {
    document.getElementById('current-player-name').textContent = currentProfileUsername;
    document.getElementById('compare-player-input').value = '';
    document.getElementById('compare-results').classList.add('hidden');
    showView('compare');
  };

  document.getElementById('start-compare-btn').onclick = () => {
    const player2 = document.getElementById('compare-player-input').value.trim();
    if (player2) {
      startComparison(currentProfileUsername, player2);
    }
  };

  document.getElementById('compare-player-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('start-compare-btn').click();
    }
  });
  
  // Leaderboard tabs
  document.getElementById('lb-bestrank').onclick = () => switchLeaderboardTab('bestrank');
  document.getElementById('lb-totaltime').onclick = () => switchLeaderboardTab('totaltime');
  document.getElementById('lb-avgtime').onclick = () => switchLeaderboardTab('avgtime');
  document.getElementById('lb-avgrank').onclick = () => switchLeaderboardTab('avgrank');
  
  // Search
  document.getElementById('player-search').oninput = (e) => {
    renderLeaderboardTable(e.target.value);
  };
  
  document.getElementById('level-search').oninput = (e) => {
    renderLevelLeaderboard(e.target.value);
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
  views.compare.classList.add('hidden');
  
  if (name === 'list') {
    views.list.classList.remove('hidden');
    window.scrollTo(0, 0);
  } else if (name === 'detail') {
    views.detail.classList.remove('hidden');
    window.scrollTo(0, 0);
  } else if (name === 'profile') {
    views.profile.classList.remove('hidden');
    window.scrollTo(0, 0);
  } else if (name === 'compare') {
    views.compare.classList.remove('hidden');
    window.scrollTo(0, 0);
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

function getPlayerPfp(username) {
  const p = profiles[username];
  if (p && p.pfp && p.pfp !== "assets/defaultpfp.png") {
    return p.pfp;
  }
  return null;
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
  document.getElementById('level-search').value = '';

  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '<tr><td colspan="4" class="loading">Loading leaderboard...</td></tr>';

  showView('detail');

  try {
    const data = await fetchWithCache(lvl.api);
    data.sort((a, b) => a.completion_time - b.completion_time);
    currentLevelData = data;

    renderLevelLeaderboard();
  } catch (e) {
    console.error('Failed to load leaderboard:', e);
    tbody.innerHTML = '<tr><td colspan="4" style="color:#fca5a5;text-align:center;padding:2rem">Failed to load leaderboard</td></tr>';
  }
}

function renderLevelLeaderboard(searchQuery = '') {
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';
  
  let filteredData = currentLevelData;
  if (searchQuery) {
    filteredData = currentLevelData.filter(run => 
      run.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  
  filteredData.slice(0, 500).forEach((run) => {
    const rank = currentLevelData.indexOf(run) + 1;
    const tr = document.createElement('tr');
    
    const pfp = getPlayerPfp(run.username);
    const playerHTML = pfp 
      ? `<img src="${pfp}" class="player-pfp" alt="">${run.username}`
      : run.username;
    
    tr.innerHTML = `
      <td><strong class="${getRankClass(rank)}">${rank}</strong></td>
      <td><img src="${getArrowImg(run.arrow_name)}" class="arrow-img" alt=""></td>
      <td><a href="#" class="player-link">${playerHTML}</a></td>
      <td><strong>${formatTime(run.completion_time)}</strong></td>
    `;
    
    tr.querySelector('.player-link').onclick = (e) => {
      e.preventDefault();
      navigationHistory.push('detail');
      loadPlayerProfile(run.username);
    };
    
    tbody.appendChild(tr);
  });
  
  if (filteredData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:#64748b">No players found</td></tr>';
  }
}

// Load player profile
async function loadPlayerProfile(username) {
  try {
    currentProfileUsername = username;
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

    const allLevelsCompleted = count === levels.length;
    const asterisk = allLevelsCompleted ? '' : '*';
    
    const avgRank = count ? (totalRank / count).toFixed(2) + asterisk : "-";
    const avgTime = count ? formatTime(totalTime / count) + asterisk : "-";
    const totalTimeFormatted = count ? formatTime(totalTime) + asterisk : "-";
    const bestText = wr > 0 ? `${wr} WR${wr > 1 ? 's' : ''}` : bestRank;

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-box"><strong>${count}</strong><small>Levels on LB</small></div>
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
        if (idx !== -1) {
          navigationHistory = [];
          showLevel(idx);
        }
      };
      
      tbody.appendChild(tr);
    });

    showView('profile');
  } catch (err) {
    console.error("Failed to load profile:", err);
    alert("Failed to load profile. Check console for details.");
  }
}

// Compare feature
async function startComparison(player1, player2) {
  try {
    document.getElementById('compare-results').classList.remove('hidden');
    
    // Set player names and pfps
    document.getElementById('compare-name-1').textContent = player1;
    document.getElementById('compare-name-2').textContent = player2;
    
    const p1 = profiles[player1] || {};
    const p2 = profiles[player2] || {};
    document.getElementById('compare-pfp-1').src = p1.pfp || "assets/defaultpfp.png";
    document.getElementById('compare-pfp-2').src = p2.pfp || "assets/defaultpfp.png";
    
    // Set table headers
    document.getElementById('compare-th-1').textContent = player1;
    document.getElementById('compare-th-2').textContent = player2;
    
    // Fetch all leaderboards
    const promises = levels.map(lvl => fetchWithCache(lvl.api));
    const allLeaderboards = await Promise.allSettled(promises);
    
    // Calculate stats for both players
    const player1Stats = {
      records: [],
      totalTime: 0,
      totalRank: 0,
      count: 0,
      bestRank: Infinity,
      worldRecords: 0
    };
    
    const player2Stats = {
      records: [],
      totalTime: 0,
      totalRank: 0,
      count: 0,
      bestRank: Infinity,
      worldRecords: 0
    };
    
    let player1Points = 0;
    let player2Points = 0;
    
    allLeaderboards.forEach((result, i) => {
      if (result.status !== 'fulfilled') return;
      const lb = result.value;
      
      const entry1 = lb.find(e => e.username === player1);
      const entry2 = lb.find(e => e.username === player2);
      
      if (entry1) {
        const rank = lb.indexOf(entry1) + 1;
        player1Stats.records.push({
          levelName: levels[i].name,
          rank,
          time: entry1.completion_time,
          arrow: entry1.arrow_name
        });
        player1Stats.totalTime += entry1.completion_time;
        player1Stats.totalRank += rank;
        player1Stats.count++;
        if (rank < player1Stats.bestRank) player1Stats.bestRank = rank;
        if (rank === 1) player1Stats.worldRecords++;
      }
      
      if (entry2) {
        const rank = lb.indexOf(entry2) + 1;
        player2Stats.records.push({
          levelName: levels[i].name,
          rank,
          time: entry2.completion_time,
          arrow: entry2.arrow_name
        });
        player2Stats.totalTime += rank;
        player2Stats.totalRank += rank;
        player2Stats.count++;
        if (rank < player2Stats.bestRank) player2Stats.bestRank = rank;
        if (rank === 1) player2Stats.worldRecords++;
      }
      
      // Calculate points for this level
      if (entry1 && entry2) {
        const rank1 = lb.indexOf(entry1) + 1;
        const rank2 = lb.indexOf(entry2) + 1;
        if (rank1 < rank2) {
          player1Points++;
        } else if (rank2 < rank1) {
          player2Points++;
        }
      } else if (entry1 && !entry2) {
        player1Points++;
      } else if (entry2 && !entry1) {
        player2Points++;
      }
    });
    
    // Calculate averages
    player1Stats.avgRank = player1Stats.count ? player1Stats.totalRank / player1Stats.count : null;
    player1Stats.avgTime = player1Stats.count ? player1Stats.totalTime / player1Stats.count : null;
    player2Stats.avgRank = player2Stats.count ? player2Stats.totalRank / player2Stats.count : null;
    player2Stats.avgTime = player2Stats.count ? player2Stats.totalTime / player2Stats.count : null;
    
    // Update scores
    document.getElementById('compare-score-1').textContent = player1Points;
    document.getElementById('compare-score-2').textContent = player2Points;
    
    // Render stats comparison
    renderStatsComparison(player1Stats, player2Stats);
    
    // Render level comparison table
    renderLevelComparison(player1Stats, player2Stats, player1, player2);
    
  } catch (err) {
    console.error("Failed to compare players:", err);
    alert("Failed to compare players. Make sure both player names are correct.");
  }
}

function renderStatsComparison(stats1, stats2) {
  const grid = document.getElementById('stats-comparison-grid');
  grid.innerHTML = '';
  
  const stats = [
    {
      label: 'Levels on Leaderboard',
      val1: stats1.count,
      val2: stats2.count,
      format: v => v
    },
    {
      label: 'Best Rank',
      val1: stats1.worldRecords > 0 ? `${stats1.worldRecords} WR${stats1.worldRecords > 1 ? 's' : ''}` : stats1.bestRank,
      val2: stats2.worldRecords > 0 ? `${stats2.worldRecords} WR${stats2.worldRecords > 1 ? 's' : ''}` : stats2.bestRank,
      compare: (v1, v2) => {
        const r1 = typeof v1 === 'number' ? v1 : 1;
        const r2 = typeof v2 === 'number' ? v2 : 1;
        return r1 - r2;
      }
    },
    {
      label: 'Average Rank',
      val1: stats1.avgRank,
      val2: stats2.avgRank,
      format: v => v ? v.toFixed(2) : 'N/A',
      compare: (v1, v2) => (v1 || Infinity) - (v2 || Infinity)
    },
    {
      label: 'Average Time',
      val1: stats1.avgTime,
      val2: stats2.avgTime,
      format: v => v ? formatTime(v) : 'N/A',
      compare: (v1, v2) => (v1 || Infinity) - (v2 || Infinity)
    },
    {
      label: 'Total Time',
      val1: stats1.totalTime,
      val2: stats2.totalTime,
      format: v => v ? formatTime(v) : 'N/A',
      compare: (v1, v2) => v1 - v2
    }
  ];
  
  stats.forEach(stat => {
    const item = document.createElement('div');
    item.className = 'stat-comparison-item';
    
    const formatted1 = stat.format ? stat.format(stat.val1) : stat.val1;
    const formatted2 = stat.format ? stat.format(stat.val2) : stat.val2;
    
    let winner1 = false;
    let winner2 = false;
    
    if (stat.compare) {
      const comparison = stat.compare(stat.val1, stat.val2);
      if (comparison < 0) winner1 = true;
      else if (comparison > 0) winner2 = true;
    }
    
    item.innerHTML = `
      <div class="stat-comparison-label">${stat.label}</div>
      <div class="stat-comparison-values">
        <div class="stat-value ${winner1 ? 'winner' : winner2 ? 'loser' : ''}">${formatted1}</div>
        <div class="stat-separator">VS</div>
        <div class="stat-value ${winner2 ? 'winner' : winner1 ? 'loser' : ''}">${formatted2}</div>
      </div>
    `;
    
    grid.appendChild(item);
  });
}

function renderLevelComparison(stats1, stats2, player1, player2) {
  const tbody = document.getElementById('compare-table-body');
  tbody.innerHTML = '';
  
  levels.forEach(level => {
    const record1 = stats1.records.find(r => r.levelName === level.name);
    const record2 = stats2.records.find(r => r.levelName === level.name);
    
    const tr = document.createElement('tr');
    
    let winner = '';
    if (record1 && record2) {
      if (record1.rank < record2.rank) {
        winner = `<span class="winner-badge">${player1}</span>`;
      } else if (record2.rank < record1.rank) {
        winner = `<span class="winner-badge">${player2}</span>`;
      } else {
        winner = '<span style="color:#64748b">Tie</span>';
      }
    } else if (record1) {
      winner = `<span class="winner-badge">${player1}</span>`;
    } else if (record2) {
      winner = `<span class="winner-badge">${player2}</span>`;
    } else {
      winner = '<span style="color:#64748b">-</span>';
    }
    
    const player1Cell = record1 
      ? `<strong class="${getRankClass(record1.rank)}">#${record1.rank}</strong> - ${formatTime(record1.time)}`
      : '<span style="color:#64748b">N/A</span>';
      
    const player2Cell = record2 
      ? `<strong class="${getRankClass(record2.rank)}">#${record2.rank}</strong> - ${formatTime(record2.time)}`
      : '<span style="color:#64748b">N/A</span>';
    
    tr.innerHTML = `
      <td><strong>${level.name}</strong></td>
      <td>${player1Cell}</td>
      <td>${player2Cell}</td>
      <td>${winner}</td>
    `;
    
    tbody.appendChild(tr);
  });
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
      avgTime: stats.totalTime / stats.count,
      allLevelsCompleted: stats.count === levels.length
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
  
  const note = document.getElementById('leaderboard-note');
  if (tab === 'bestrank') {
    note.classList.add('hidden');
  } else {
    note.classList.remove('hidden');
  }
  
  renderLeaderboardTable();
}

// Render leaderboard table
function renderLeaderboardTable(searchQuery = '') {
  const activeTab = document.querySelector('.lb-tab.active').id.replace('lb-', '');
  const thead = document.getElementById('lb-table-header');
  const tbody = document.getElementById('lb-table-body');
  
  // Filter players
  let filteredPlayers = allPlayerStats;
  
  // For tabs other than bestrank, only show players who completed all levels
  if (activeTab !== 'bestrank') {
    filteredPlayers = filteredPlayers.filter(p => p.allLevelsCompleted);
  }
  
  if (searchQuery) {
    filteredPlayers = filteredPlayers.filter(p => 
      p.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  
  // Sort based on active tab
  let sorted = [...filteredPlayers];
  
  switch (activeTab) {
    case 'bestrank':
      sorted.sort((a, b) => {
        if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank;
        return b.count - a.count;
      });
      thead.innerHTML = `
        <th>Rank</th>
        <th>Player</th>
        <th>Best Rank</th>
        <th>Levels on LB</th>
      `;
      break;
      
    case 'totaltime':
      sorted.sort((a, b) => a.totalTime - b.totalTime);
      thead.innerHTML = `
        <th>Rank</th>
        <th>Player</th>
        <th>Total Time</th>
      `;
      break;
      
    case 'avgtime':
      sorted.sort((a, b) => a.avgTime - b.avgTime);
      thead.innerHTML = `
        <th>Rank</th>
        <th>Player</th>
        <th>Average Time</th>
      `;
      break;
      
    case 'avgrank':
      sorted.sort((a, b) => a.avgRank - b.avgRank);
      thead.innerHTML = `
        <th>Rank</th>
        <th>Player</th>
        <th>Average Rank</th>
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
    
    const pfp = getPlayerPfp(player.username);
    const playerHTML = pfp 
      ? `<img src="${pfp}" class="player-pfp" alt="">${player.username}`
      : player.username;
    
    let content = `
      <td><strong class="${rankClass}">${rank}</strong></td>
      <td><a href="#" class="player-link">${playerHTML}</a></td>
    `;
    
    switch (activeTab) {
      case 'bestrank':
        const bestText = player.worldRecords > 0 ? `${player.worldRecords} WR${player.worldRecords > 1 ? 's' : ''}` : player.bestRank;
        content += `
          <td><strong>${bestText}</strong></td>
          <td>${player.count}</td>
        `;
        break;
        
      case 'totaltime':
        content += `
          <td><strong>${formatTime(player.totalTime)}</strong></td>
        `;
        break;
        
      case 'avgtime':
        content += `
          <td><strong>${formatTime(player.avgTime)}</strong></td>
        `;
        break;
        
      case 'avgrank':
        content += `
          <td><strong>${player.avgRank.toFixed(2)}</strong></td>
        `;
        break;
    }
    
    tr.innerHTML = content;
    
    tr.querySelector('.player-link').onclick = (e) => {
      e.preventDefault();
      navigationHistory.push('leaderboards');
      switchTab('officials');
      loadPlayerProfile(player.username);
    };
    
    tbody.appendChild(tr);
  });
}
