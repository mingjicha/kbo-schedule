let weatherCache = null;
let pitcherStatsCache = {};

// Stadium names
const stadiumNames = {
  '잠실': '잠실',
  '고척': '고척',
  '수원': '수원',
  '대전': '대전',
  '창원': '창원',
  '광주': '광주',
  '사직': '사직',
  '대구': '대구',
  '문학': '문학',
  '청주': '청주',
  '포항': '포항'
};

function getWeatherIcon(code) {
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if ([51, 53, 55].includes(code)) return '🌦️';
  if ([61, 63, 65].includes(code)) return '🌧️';
  if ([71, 73, 75, 77].includes(code)) return '❄️';
  if ([80, 81, 82, 85, 86].includes(code)) return '⛈️';
  if ([95, 96, 99].includes(code)) return '⚡';
  return '🌡️';
}

async function loadWeather(forceRefresh = false) {
  const weatherContainer = document.getElementById('weatherContainer');
  const weatherDate = document.getElementById('weatherDate');

  try {
    if (weatherCache && !forceRefresh) {
      renderWeatherCards(weatherCache);
      return;
    }

    weatherContainer.innerHTML = '<div class="loading"><div class="spinner-border" role="status"><span class="visually-hidden">로딩 중이에요<span class="symbol-font">♤</span></span></div></div>';

    const today = new Date();
    const todayStr = String(today.getMonth() + 1).padStart(2, '0') + '.' + String(today.getDate()).padStart(2, '0');
    const todayYear = today.getFullYear();

    // 오늘 경기가 없으면 다음 경기일(next) 구장의 날씨를 보여준다
    const focus = typeof focusDateInfo !== 'undefined' && focusDateInfo ? focusDateInfo : null;
    const targetDate = focus ? focus.date : todayStr;
    const isFutureDate = targetDate !== todayStr;

    const stadiums = new Set();
    if (window.currentScheduleData && Array.isArray(window.currentScheduleData)) {
      window.currentScheduleData.forEach(game => {
        const gameDate = game.date.split('(')[0];
        if (gameDate === targetDate) {
          if (game.stadium) {
            const stadiumKey = Object.keys(stadiumNames).find(key => game.stadium.includes(key));
            if (stadiumKey) stadiums.add(stadiumKey);
          }
        }
      });
    }

    const [targetMonth, targetDay] = targetDate.split('.');
    weatherDate.textContent = `${todayYear}년 ${parseInt(targetMonth)}월 ${parseInt(targetDay)}일 기준`;

    if (stadiums.size === 0) {
      weatherContainer.innerHTML = '<div class="modal__no-weather-data">예정된 경기가 없어요<span class="symbol-font">♤</span></div>';
      return;
    }

    // 미래 경기일이면 그날 예보를 요청한다
    const dateParam = isFutureDate
      ? `&date=${todayYear}-${targetMonth}-${targetDay}`
      : '';

    const weatherDataList = [];
    for (const stadium of stadiums) {
      try {
        const weatherUrl = `/api/weather?stadium=${encodeURIComponent(stadium)}${dateParam}` + (forceRefresh ? '&refresh=1' : '');
        const response = await fetch(weatherUrl);
        const data = await response.json();
        weatherDataList.push(data);
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`날씨 조회 실패: ${stadium}`, error);
      }
    }

    if (weatherDataList.length === 0) {
      weatherContainer.innerHTML = '<div class="modal__no-weather-data">날씨 정보를 불러올 수 없어요<span class="symbol-font">♤</span></div>';
      return;
    }

    weatherCache = weatherDataList;
    renderWeatherCards(weatherDataList);
  } catch (error) {
    console.error('Error loading weather:', error);
    weatherContainer.innerHTML = '<div class="modal__no-weather-data">날씨 정보를 불러올 수 없어요<span class="symbol-font">♤</span></div>';
  }
}

function renderWeatherCards(weatherDataList) {
  const weatherContainer = document.getElementById('weatherContainer');

  const cardsHtml = weatherDataList.map(data => `
    <div class="modal__weather-card">
      <div class="modal__weather-stadium">${data.stadium}</div>
      <div class="modal__weather-icon">${getWeatherIcon(data.weatherCode)}</div>
      <div class="modal__weather-temp">${data.temperature}°C</div>
      <div class="modal__weather-desc">${data.weatherDesc}</div>
      <div class="modal__weather-details">
        <div class="modal__weather-detail-item">
          <div class="modal__weather-detail-label">최고/최저</div>
          <div class="modal__weather-detail-value">${Math.round(data.temperatureMax)}°/${Math.round(data.temperatureMin)}°</div>
        </div>
        <div class="modal__weather-detail-item">
          <div class="modal__weather-detail-label">풍속</div>
          <div class="modal__weather-detail-value">${data.windspeed}m/s</div>
        </div>
        <div class="modal__weather-detail-item">
          <div class="modal__weather-detail-label">습도</div>
          <div class="modal__weather-detail-value">${data.humidity}%</div>
        </div>
        <div class="modal__weather-detail-item">
          <div class="modal__weather-detail-label">강수</div>
          <div class="modal__weather-detail-value">${data.precipitation}mm</div>
        </div>
      </div>
    </div>
  `).join('');

  const listHtml = weatherDataList.map(data => {
    const rainChip = data.precipitation > 0
      ? `<span class="modal__weather-chip modal__weather-chip--rain">${data.precipitation}mm</span>`
      : '';
    return `
    <div class="modal__weather-row">
      <span class="modal__weather-row-icon">${getWeatherIcon(data.weatherCode)}</span>
      <div class="modal__weather-row-main">
        <div class="modal__weather-row-stadium">${data.stadium}</div>
        <div class="modal__weather-row-desc">${data.weatherDesc}</div>
        <div class="modal__weather-row-meta">
          <span class="modal__weather-chip">습도 ${data.humidity}%</span>
          <span class="modal__weather-chip">${data.windspeed}m/s</span>
          ${rainChip}
        </div>
      </div>
      <div class="modal__weather-row-stats">
        <div class="modal__weather-row-temp">${data.temperature}°</div>
        <div class="modal__weather-row-range">${Math.round(data.temperatureMax)}° / ${Math.round(data.temperatureMin)}°</div>
      </div>
    </div>
  `;
  }).join('');

  weatherContainer.innerHTML = `
    <div class="modal__weather-cards">${cardsHtml}</div>
    <div class="modal__weather-list">${listHtml}</div>
  `;
}

async function loadTeamRank(forceRefresh = false) {
  const rankTableContainer = document.getElementById('rankTableContainer');
  const rankDate = document.getElementById('rankDate');

  try {
    rankTableContainer.innerHTML = '<div class="loading"><div class="spinner-border" role="status"><span class="visually-hidden">로딩 중이에요<span class="symbol-font">♤</span></span></div></div>';

    const response = await fetch(forceRefresh ? '/api/team-rank?refresh=1' : '/api/team-rank');
    const data = await response.json();

    const dateStr = data.date || '기준일 미정';
    const formattedDate = dateStr.replace(/(\d{4})년\s+0?(\d+)월0?(\d+)일/g, '$1년 $2월 $3일');
    rankDate.textContent = formattedDate;

    if (data.ranks && data.ranks.length > 0) {
      const table = document.createElement('table');
      table.className = 'modal__rank-table';

      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr>
          <th>순위</th>
          <th>팀명</th>
          <th>경기</th>
          <th>승</th>
          <th>패</th>
          <th>무</th>
          <th>승률</th>
          <th>게임차</th>
          <th>연속</th>
          <th>최근 10경기</th>
        </tr>
      `;
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      data.ranks.forEach((rank, index) => {
        const tr = document.createElement('tr');
        const teamColor = teamColors[rank.teamName] || '#333';
        const teamLogo = teamLogos[rank.teamName] || '';

        tr.innerHTML = `
          <td>${rank.rank}</td>
          <td class="modal__team-name">
            ${teamLogo ? `<img src="${teamLogo}" alt="${rank.teamName}" class="modal__team-logo">` : ''}
            <span style="color: ${teamColor};">${rank.teamName}</span>
          </td>
          <td>${rank.games}</td>
          <td>${rank.wins}</td>
          <td>${rank.losses}</td>
          <td>${rank.draws}</td>
          <td>${rank.winRate}</td>
          <td>${rank.gameDiff}</td>
          <td>${rank.streak || '-'}</td>
          <td class="modal__recent-games">${rank.recent10 || '-'}</td>
        `;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      const list = document.createElement('div');
      list.className = 'modal__rank-list';
      data.ranks.forEach(rank => {
        const teamLogo = teamLogos[rank.teamName] || '';
        const streakText = rank.streak || '-';
        const rankNum = parseInt(rank.rank, 10);
        const gameDiffText = rankNum === 1 ? '-' : `${rank.gameDiff} 게임차`;

        const item = document.createElement('div');
        item.className = 'modal__rank-item' + (rankNum <= 5 ? ' modal__rank-item--top' : '');
        item.innerHTML = `
          <div class="modal__rank-item-row">
            <span class="modal__rank-item-rank">${rank.rank}</span>
            ${teamLogo ? `<img src="${teamLogo}" alt="${rank.teamName}" class="modal__rank-item-logo">` : ''}
            <div class="modal__rank-item-team">
              <div class="modal__rank-item-name">${rank.teamName}</div>
              <div class="modal__rank-item-record">${rank.games}경기 ${rank.wins}승 ${rank.losses}패 ${rank.draws}무</div>
            </div>
            <span class="modal__rank-item-streak">${streakText}</span>
            <div class="modal__rank-item-stats">
              <div class="modal__rank-item-winrate">${rank.winRate}</div>
              <div class="modal__rank-item-gamediff">${gameDiffText}</div>
            </div>
          </div>
        `;
        list.appendChild(item);

        if (rankNum === 5) {
          const divider = document.createElement('div');
          divider.className = 'modal__rank-divider';
          divider.textContent = '가을야구 진출권';
          list.appendChild(divider);
        }
      });

      rankTableContainer.innerHTML = '';
      rankTableContainer.appendChild(table);
      rankTableContainer.appendChild(list);
    } else {
      rankTableContainer.innerHTML = '<div class="modal__no-rank-data">순위 데이터를 불러올 수 없어요<span class="symbol-font">♤</span></div>';
    }
  } catch (error) {
    console.error('Error loading team rank:', error);
    rankTableContainer.innerHTML = '<div class="modal__no-rank-data">순위 정보를 불러올 수 없어요<span class="symbol-font">♤</span></div>';
  }
}

function renderPitcherCard(pitcherName, teamName, pitcherData, statClasses) {
  const logo = teamLogosDetail[teamName] || '';
  const logoSizeClass = teamName === '롯데' ? 'small-logo' : (teamName === 'NC' ? 'large-logo' : '');
  const record = pitcherData.record ? pitcherData.record.replace(/VS/g, ' VS') : '-';

  return `
    <div class="game-detail__pitcher-card">
      <div class="game-detail__pitcher-header">
        <table class="game-detail__stats-table">
          <thead>
            <tr>
              <th class="pitcher-info-col">
                <div>
                  <img src="${logo}" alt="${teamName}" class="pitcher-info-logo ${logoSizeClass}">
                  <span>선발투수</span>
                </div>
              </th>
              <th>평균자책점</th>
              <th>WAR</th>
              <th>경기</th>
              <th>선발평균이닝</th>
              <th>QS</th>
              <th>WHIP</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="pitcher-info-col">
                <div class="game-detail__pitcher-info">
                  <div class="game-detail__pitcher-name">
                    <div class="name-wrap">
                      <span class="name">${pitcherName}</span>
                      ${pitcherData.style ? `<span class="style">${pitcherData.style}</span>` : ''}
                    </div>
                    <div class="record">${record}</div>
                  </div>
                </div>
              </td>
              <td class="${statClasses.era}">${pitcherData.era || '-'}</td>
              <td class="${statClasses.war}">${pitcherData.war || '-'}</td>
              <td class="${statClasses.games}">${pitcherData.games || '-'}</td>
              <td class="${statClasses.inning}">${pitcherData.startAvgInning || '-'}</td>
              <td class="${statClasses.qs}">${pitcherData.qs || '-'}</td>
              <td class="${statClasses.whip}">${pitcherData.whip || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="game-detail__pitcher-stat-cards">
        <div class="game-detail__pitcher-stat-header">
          <img src="${logo}" alt="${teamName}" class="pitcher-info-logo ${logoSizeClass}">
          <div>
            <div class="game-detail__pitcher-stat-name">${pitcherName}${pitcherData.style ? ` <span class="style">${pitcherData.style}</span>` : ''}</div>
            <div class="game-detail__pitcher-stat-record">${record}</div>
          </div>
        </div>
        <div class="game-detail__stat-grid">
          <div class="game-detail__stat-tile ${statClasses.era}">
            <span class="game-detail__stat-label">평균자책점</span>
            <span class="game-detail__stat-value">${pitcherData.era || '-'}</span>
          </div>
          <div class="game-detail__stat-tile ${statClasses.war}">
            <span class="game-detail__stat-label">WAR</span>
            <span class="game-detail__stat-value">${pitcherData.war || '-'}</span>
          </div>
          <div class="game-detail__stat-tile ${statClasses.whip}">
            <span class="game-detail__stat-label">WHIP</span>
            <span class="game-detail__stat-value">${pitcherData.whip || '-'}</span>
          </div>
          <div class="game-detail__stat-tile ${statClasses.games}">
            <span class="game-detail__stat-label">경기</span>
            <span class="game-detail__stat-value">${pitcherData.games || '-'}</span>
          </div>
          <div class="game-detail__stat-tile ${statClasses.inning}">
            <span class="game-detail__stat-label">선발평균이닝</span>
            <span class="game-detail__stat-value">${pitcherData.startAvgInning || '-'}</span>
          </div>
          <div class="game-detail__stat-tile ${statClasses.qs}">
            <span class="game-detail__stat-label">QS</span>
            <span class="game-detail__stat-value">${pitcherData.qs || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPitcherComparison(data, game, container) {
  if (data.awayData || data.homeData) {
    const getBetterStatClass = (awayVal, homeVal, lowerIsBetter = false) => {
      if (!awayVal || !homeVal || awayVal === '-' || homeVal === '-') return { away: '', home: '' };

      const awayNum = parseFloat(awayVal);
      const homeNum = parseFloat(homeVal);

      if (isNaN(awayNum) || isNaN(homeNum)) return { away: '', home: '' };

      if (lowerIsBetter) {
        if (awayNum < homeNum) return { away: 'stat-highlight', home: '' };
        if (awayNum > homeNum) return { away: '', home: 'stat-highlight' };
      } else {
        if (awayNum > homeNum) return { away: 'stat-highlight', home: '' };
        if (awayNum < homeNum) return { away: '', home: 'stat-highlight' };
      }
      return { away: '', home: '' };
    };

    const eraClass = getBetterStatClass(data.awayData.era, data.homeData.era, true);
    const warClass = getBetterStatClass(data.awayData.war, data.homeData.war);
    const gamesClass = getBetterStatClass(data.awayData.games, data.homeData.games);
    const inningClass = getBetterStatClass(data.awayData.startAvgInning, data.homeData.startAvgInning);
    const qsClass = getBetterStatClass(data.awayData.qs, data.homeData.qs);
    const whipClass = getBetterStatClass(data.awayData.whip, data.homeData.whip, true);

    const awayStatClasses = { era: eraClass.away, war: warClass.away, games: gamesClass.away, inning: inningClass.away, qs: qsClass.away, whip: whipClass.away };
    const homeStatClasses = { era: eraClass.home, war: warClass.home, games: gamesClass.home, inning: inningClass.home, qs: qsClass.home, whip: whipClass.home };

    const html = `
      <div class="game-detail__pitchers">
        ${data.awayData ? renderPitcherCard(game.awayPitcher, game.awayTeam, data.awayData, awayStatClasses) : ''}
        ${data.homeData ? renderPitcherCard(game.homePitcher, game.homeTeam, data.homeData, homeStatClasses) : ''}
      </div>
    `;
    container.innerHTML = html;
  } else {
    container.innerHTML = '<div class="modal__no-data">투수 정보를 찾을 수 없어요<span class="symbol-font">♤</span></div>';
  }
}

async function loadPitcherComparison(game, container) {
  try {
    const cacheKey = `${game.awayPitcher}_${game.homePitcher}_${game.gameId}`;

    if (pitcherStatsCache[cacheKey]) {
      renderPitcherComparison(pitcherStatsCache[cacheKey], game, container);
      return;
    }

    const response = await fetch(`/api/pitcher-stats?awayPitcher=${encodeURIComponent(game.awayPitcher)}&homePitcher=${encodeURIComponent(game.homePitcher)}&awayTeam=${encodeURIComponent(game.awayTeam)}&homeTeam=${encodeURIComponent(game.homeTeam)}&gameId=${encodeURIComponent(game.gameId)}&year=${currentYear}`);
    const data = await response.json();

    pitcherStatsCache[cacheKey] = data;
    renderPitcherComparison(data, game, container);
  } catch (error) {
    console.error('Error loading pitcher comparison:', error);
    container.innerHTML = '<div class="modal__no-data">투수 정보를 불러올 수 없어요<span class="symbol-font">♤</span></div>';
  }
}

async function loadLineup(game, container) {
  try {
    const cacheKey = `lineup_${game.gameId}`;

    if (pitcherStatsCache[cacheKey]) {
      renderLineup(pitcherStatsCache[cacheKey].lineup, game, container);
      return;
    }

    const response = await fetch(`/api/pitcher-stats?awayPitcher=${encodeURIComponent(game.awayPitcher)}&homePitcher=${encodeURIComponent(game.homePitcher)}&awayTeam=${encodeURIComponent(game.awayTeam)}&homeTeam=${encodeURIComponent(game.homeTeam)}&gameId=${encodeURIComponent(game.gameId)}&year=${currentYear}`);
    const data = await response.json();

    if (data.lineup) {
      renderLineup(data.lineup, game, container);
    } else {
      container.innerHTML = '<div class="modal__no-data">라인업 정보를 불러올 수 없어요<span class="symbol-font">♤</span></div>';
    }
  } catch (error) {
    console.error('Error loading lineup:', error);
    container.innerHTML = '<div class="modal__no-data">라인업 정보를 불러올 수 없어요<span class="symbol-font">♤</span></div>';
  }
}

function renderLineupTeamTable(teamName, players) {
  return `
    <div class="lineup__team-header">
      <img src="${teamLogos[teamName] || ''}" alt="${teamName}" class="lineup__team-logo">
      <span>${teamName}</span>
    </div>
    <table class="lineup-table">
      <thead>
        <tr>
          <th>타순</th>
          <th>포지션</th>
          <th>선수명</th>
          <th>WAR</th>
        </tr>
      </thead>
      <tbody>
        ${players.map(player => `
          <tr>
            <td>${player.order}</td>
            <td>${player.position}</td>
            <td>${player.name}</td>
            <td>${player.war.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <ul class="lineup__list">
      ${players.map(player => `
        <li class="lineup__list-item">
          <span class="lineup__list-order">${player.order}</span>
          <span class="lineup__list-position">${player.position}</span>
          <span class="lineup__list-name">${player.name}</span>
          <span class="lineup__list-war">${player.war.toFixed(2)}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function getLineupBarColor(teamName, opponentName, fallback) {
  // 두산(#1d1838)과 KT(#232323)는 둘 다 어두운 색이라 막대에서 구분이 안 되므로 두산만 밝은 남색으로 대체
  if (teamName === '두산' && opponentName === 'KT') {
    return '#3b5bdb';
  }
  return teamColors[teamName] || fallback;
}

function renderWarSummaryRow(label, away, home, awayTeam, homeTeam, maxWar) {
  const awayPct = (away / maxWar * 100).toFixed(2);
  const homePct = (home / maxWar * 100).toFixed(2);
  const awayColor = getLineupBarColor(awayTeam, homeTeam, '#4a90e2');
  const homeColor = getLineupBarColor(homeTeam, awayTeam, '#e24a4a');
  return `
    <li>
      <div class="graph away" style="color: ${awayColor};">
        <span class="away-value">${away.toFixed(2)}&nbsp;&nbsp;</span>
        <span class="bar-bg away" style="width: ${awayPct}%; background-color: ${awayColor};"></span>
      </div>
      <span class="label">${label}</span>
      <div class="graph home" style="color: ${homeColor};">
        <span class="bar-bg home" style="width: ${homePct}%; background-color: ${homeColor};"></span>
        <span class="home-value">&nbsp;&nbsp;${home.toFixed(2)}</span>
      </div>
      <div class="lineup__war-row">
        <span class="lineup__war-label">${label}</span>
        <div class="lineup__war-bar-wrap">
          <span class="lineup__war-value away" style="color: ${awayColor};">${away.toFixed(2)}</span>
          <div class="lineup__war-bar lineup__war-bar--away">
            <div class="lineup__war-bar-fill away" style="width: ${awayPct}%; background-color: ${awayColor};"></div>
          </div>
          <div class="lineup__war-bar lineup__war-bar--home">
            <div class="lineup__war-bar-fill home" style="width: ${homePct}%; background-color: ${homeColor};"></div>
          </div>
          <span class="lineup__war-value home" style="color: ${homeColor};">${home.toFixed(2)}</span>
        </div>
      </div>
    </li>
  `;
}

function renderLineup(lineup, game, container) {
  if (!lineup) {
    container.innerHTML = '<div class="modal__no-data">라인업 정보를 불러올 수 없어요<span class="symbol-font">♤</span></div>';
    return;
  }

  const maxWar = Math.max(
    lineup.warSummary.tableSetter.away,
    lineup.warSummary.tableSetter.home,
    lineup.warSummary.cleanUp.away,
    lineup.warSummary.cleanUp.home,
    lineup.warSummary.bottom.away,
    lineup.warSummary.bottom.home,
    0.01
  );

  const awayTabColor = getLineupBarColor(game.awayTeam, game.homeTeam, '#4a90e2');
  const homeTabColor = getLineupBarColor(game.homeTeam, game.awayTeam, '#e24a4a');

  const html = `
    <div class="game-detail__lineup">
      <p class="lineup__notice">라인업 발표 전으로 최근 라인업 기준이에요</p>
      <div class="lineup__war-summary">
        <h4>WAR 합산</h4>
        <ul class="lineup-data">
          ${renderWarSummaryRow('테이블세터', lineup.warSummary.tableSetter.away, lineup.warSummary.tableSetter.home, game.awayTeam, game.homeTeam, maxWar)}
          ${renderWarSummaryRow('중심타선', lineup.warSummary.cleanUp.away, lineup.warSummary.cleanUp.home, game.awayTeam, game.homeTeam, maxWar)}
          ${renderWarSummaryRow('하위타선', lineup.warSummary.bottom.away, lineup.warSummary.bottom.home, game.awayTeam, game.homeTeam, maxWar)}
        </ul>
      </div>

      <div class="lineup__team-tabs">
        <button type="button" class="lineup__team-tab active" data-team="away" style="--tab-color: ${awayTabColor};">${game.awayTeam}</button>
        <button type="button" class="lineup__team-tab" data-team="home" style="--tab-color: ${homeTabColor};">${game.homeTeam}</button>
      </div>

      <div class="lineup__players">
        <div class="lineup__team away active">
          ${renderLineupTeamTable(game.awayTeam, lineup.awayLineup)}
        </div>

        <div class="lineup__team home">
          ${renderLineupTeamTable(game.homeTeam, lineup.homeLineup)}
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  const teamTabs = container.querySelectorAll('.lineup__team-tab');
  const teamPanels = container.querySelectorAll('.lineup__team');
  teamTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      teamTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      teamPanels.forEach(p => p.classList.toggle('active', p.classList.contains(tab.dataset.team)));
    });
  });
}

// Modal controls
document.addEventListener('DOMContentLoaded', () => {
  const refreshRankBtn = document.getElementById('refreshRankBtn');
  const closeRankBtn = document.getElementById('closeRankBtn');
  const rankModal = document.getElementById('rankModal');

  if (refreshRankBtn) {
    refreshRankBtn.addEventListener('click', () => loadTeamRank(true));
  }

  if (closeRankBtn) {
    closeRankBtn.addEventListener('click', () => {
      rankModal.classList.remove('show');
    });
  }

  if (rankModal) {
    rankModal.addEventListener('click', (e) => {
      if (e.target === rankModal) {
        rankModal.classList.remove('show');
      }
    });
  }

  const refreshWeatherBtn = document.getElementById('refreshWeatherBtn');
  const closeWeatherBtn = document.getElementById('closeWeatherBtn');
  const weatherModal = document.getElementById('weatherModal');

  if (refreshWeatherBtn) {
    refreshWeatherBtn.addEventListener('click', () => loadWeather(true));
  }

  if (closeWeatherBtn) {
    closeWeatherBtn.addEventListener('click', () => {
      weatherModal.classList.remove('show');
    });
  }

  if (weatherModal) {
    weatherModal.addEventListener('click', (e) => {
      if (e.target === weatherModal) {
        weatherModal.classList.remove('show');
      }
    });
  }

  const closeGameDetailBtn = document.getElementById('closeGameDetailBtn');
  const gameDetailModal = document.getElementById('gameDetailModal');

  if (closeGameDetailBtn) {
    closeGameDetailBtn.addEventListener('click', () => {
      gameDetailModal.classList.remove('show');
    });
  }

  if (gameDetailModal) {
    gameDetailModal.addEventListener('click', (e) => {
      if (e.target === gameDetailModal) {
        gameDetailModal.classList.remove('show');
      }
    });
  }
});
