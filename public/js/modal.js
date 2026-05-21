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

    weatherContainer.innerHTML = '<div class="loading"><div class="spinner-border" role="status"><span class="visually-hidden">로딩 중이다냥! †</span></div></div>';

    const today = new Date();
    const todayStr = String(today.getMonth() + 1).padStart(2, '0') + '.' + String(today.getDate()).padStart(2, '0');
    const todayYear = today.getFullYear();

    const stadiums = new Set();
    if (window.currentScheduleData && Array.isArray(window.currentScheduleData)) {
      window.currentScheduleData.forEach(game => {
        const gameDate = game.date.split('(')[0];
        if (gameDate === todayStr) {
          if (game.stadium) {
            const stadiumKey = Object.keys(stadiumNames).find(key => game.stadium.includes(key));
            if (stadiumKey) stadiums.add(stadiumKey);
          }
        }
      });
    }

    const month = today.getMonth() + 1;
    const day = today.getDate();
    weatherDate.textContent = `${todayYear}년 ${month}월 ${day}일 기준`;

    if (stadiums.size === 0) {
      weatherContainer.innerHTML = '<div class="modal__no-weather-data">오늘 예정된 경기가 없습니다.</div>';
      return;
    }

    const weatherDataList = [];
    for (const stadium of stadiums) {
      try {
        const response = await fetch(`/api/weather?stadium=${encodeURIComponent(stadium)}`);
        const data = await response.json();
        weatherDataList.push(data);
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`날씨 조회 실패: ${stadium}`, error);
      }
    }

    if (weatherDataList.length === 0) {
      weatherContainer.innerHTML = '<div class="modal__no-weather-data">날씨 정보를 불러올 수 없습니다.</div>';
      return;
    }

    weatherCache = weatherDataList;
    renderWeatherCards(weatherDataList);
  } catch (error) {
    console.error('Error loading weather:', error);
    weatherContainer.innerHTML = '<div class="modal__no-weather-data">날씨 정보를 불러올 수 없습니다.</div>';
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
          <div class="modal__weather-detail-label">최고</div>
          <div class="modal__weather-detail-value">${Math.round(data.temperatureMax)}°C</div>
        </div>
        <div class="modal__weather-detail-item">
          <div class="modal__weather-detail-label">최저</div>
          <div class="modal__weather-detail-value">${Math.round(data.temperatureMin)}°C</div>
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

  weatherContainer.innerHTML = `<div class="modal__weather-cards">${cardsHtml}</div>`;
}

async function loadTeamRank() {
  const rankTableContainer = document.getElementById('rankTableContainer');
  const rankDate = document.getElementById('rankDate');

  try {
    rankTableContainer.innerHTML = '<div class="loading"><div class="spinner-border" role="status"><span class="visually-hidden">로딩 중이다냥! †</span></div></div>';

    const response = await fetch('/api/team-rank');
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
          <td>-</td>
          <td class="modal__recent-games">${rank.recent10 || '-'}</td>
        `;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      rankTableContainer.innerHTML = '';
      rankTableContainer.appendChild(table);
    } else {
      rankTableContainer.innerHTML = '<div class="modal__no-rank-data">순위 데이터를 불러올 수 없습니다.</div>';
    }
  } catch (error) {
    console.error('Error loading team rank:', error);
    rankTableContainer.innerHTML = '<div class="modal__no-rank-data">순위 정보를 불러올 수 없습니다.</div>';
  }
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
    const winsClass = getBetterStatClass(data.awayData.wins, data.homeData.wins);

    const html = `
      <div class="game-detail__pitchers">
        ${data.awayData ? `
          <div class="game-detail__pitcher-card">
            <div class="game-detail__pitcher-header">
              <table class="game-detail__stats-table">
                <thead>
                  <tr>
                    <th class="pitcher-info-col">
                      <div>
                        <img src="${teamLogosDetail[game.awayTeam] || ''}" alt="${game.awayTeam}" class="pitcher-info-logo ${game.awayTeam === '롯데' ? 'small-logo' : ''} ${game.awayTeam === 'NC' ? 'large-logo' : ''}">
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
                            <span class="name">${game.awayPitcher}</span>
                            ${data.awayData.style ? `<span class="style">${data.awayData.style}</span>` : ''}
                          </div>
                          <div class="record">${data.awayData.record ? data.awayData.record.replace(/VS/g, ' VS') : '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td class="${eraClass.away}">${data.awayData.era || '-'}</td>
                    <td class="${warClass.away}">${data.awayData.war || '-'}</td>
                    <td class="${gamesClass.away}">${data.awayData.games || '-'}</td>
                    <td class="${inningClass.away}">${data.awayData.startAvgInning || '-'}</td>
                    <td class="${qsClass.away}">${data.awayData.qs || '-'}</td>
                    <td class="${whipClass.away}">${data.awayData.whip || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
        ${data.homeData ? `
          <div class="game-detail__pitcher-card">
            <div class="game-detail__pitcher-header">
              <table class="game-detail__stats-table">
                <thead>
                  <tr>
                    <th class="pitcher-info-col">
                      <div>
                        <img src="${teamLogosDetail[game.homeTeam] || ''}" alt="${game.homeTeam}" class="pitcher-info-logo ${game.homeTeam === '롯데' ? 'small-logo' : ''} ${game.homeTeam === 'NC' ? 'large-logo' : ''}">
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
                            <span class="name">${game.homePitcher}</span>
                            ${data.homeData.style ? `<span class="style">${data.homeData.style}</span>` : ''}
                          </div>
                          <div class="record">${data.homeData.record ? data.homeData.record.replace(/VS/g, ' VS') : '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td class="${eraClass.home}">${data.homeData.era || '-'}</td>
                    <td class="${warClass.home}">${data.homeData.war || '-'}</td>
                    <td class="${gamesClass.home}">${data.homeData.games || '-'}</td>
                    <td class="${inningClass.home}">${data.homeData.startAvgInning || '-'}</td>
                    <td class="${qsClass.home}">${data.homeData.qs || '-'}</td>
                    <td class="${whipClass.home}">${data.homeData.whip || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    `;
    container.innerHTML = html;
  } else {
    container.innerHTML = '<div class="modal__no-data">투수 정보를 찾을 수 없다냥! †</div>';
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
    container.innerHTML = '<div class="modal__no-data">투수 정보를 불러올 수 없다냥! †</div>';
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
      container.innerHTML = '<div class="modal__no-data">라인업 정보를 불러올 수 없다냥! †</div>';
    }
  } catch (error) {
    console.error('Error loading lineup:', error);
    container.innerHTML = '<div class="modal__no-data">라인업 정보를 불러올 수 없다냥! †</div>';
  }
}

function renderLineup(lineup, game, container) {
  if (!lineup) {
    container.innerHTML = '<div class="modal__no-data">라인업 정보를 불러올 수 없다냥! †</div>';
    return;
  }

  const html = `
    <div class="game-detail__lineup">
      <div class="lineup__war-summary">
        <h4>WAR 합산</h4>
        <ul class="lineup-data">
          <li>
            <div class="graph away">
              <span class="away-value">${lineup.warSummary.tableSetter.away.toFixed(2)}&nbsp;&nbsp;</span>
              <span class="bar-bg away" style="width: ${(lineup.warSummary.tableSetter.away / 5 * 100).toFixed(2)}%"></span>
            </div>
            <span class="label">테이블세터</span>
            <div class="graph home">
              <span class="bar-bg home" style="width: ${(lineup.warSummary.tableSetter.home / 5 * 100).toFixed(2)}%"></span>
              <span class="home-value">&nbsp;&nbsp;${lineup.warSummary.tableSetter.home.toFixed(2)}</span>
            </div>
          </li>
          <li>
            <div class="graph away">
              <span class="away-value">${lineup.warSummary.cleanUp.away.toFixed(2)}&nbsp;&nbsp;</span>
              <span class="bar-bg away" style="width: ${(lineup.warSummary.cleanUp.away / 5 * 100).toFixed(2)}%"></span>
            </div>
            <span class="label">중심타선</span>
            <div class="graph home">
              <span class="bar-bg home" style="width: ${(lineup.warSummary.cleanUp.home / 5 * 100).toFixed(2)}%"></span>
              <span class="home-value">&nbsp;&nbsp;${lineup.warSummary.cleanUp.home.toFixed(2)}</span>
            </div>
          </li>
          <li>
            <div class="graph away">
              <span class="away-value">${lineup.warSummary.bottom.away.toFixed(2)}&nbsp;&nbsp;</span>
              <span class="bar-bg away" style="width: ${(lineup.warSummary.bottom.away / 5 * 100).toFixed(2)}%"></span>
            </div>
            <span class="label">하위타선</span>
            <div class="graph home">
              <span class="bar-bg home" style="width: ${(lineup.warSummary.bottom.home / 5 * 100).toFixed(2)}%"></span>
              <span class="home-value">&nbsp;&nbsp;${lineup.warSummary.bottom.home.toFixed(2)}</span>
            </div>
          </li>
        </ul>
      </div>

      <div class="lineup__players">
        <div class="lineup__team away">
          <div class="lineup__team-header">
            <img src="${teamLogosDetail[game.awayTeam] || ''}" alt="${game.awayTeam}" class="lineup__team-logo ${game.awayTeam === '롯데' ? 'small-logo' : ''} ${game.awayTeam === 'NC' ? 'large-logo' : ''}">
            <span>${game.awayTeam}</span>
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
              ${lineup.awayLineup.map(player => `
                <tr>
                  <td>${player.order}</td>
                  <td>${player.position}</td>
                  <td>${player.name}</td>
                  <td>${player.war.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="lineup__team home">
          <div class="lineup__team-header">
            <img src="${teamLogosDetail[game.homeTeam] || ''}" alt="${game.homeTeam}" class="lineup__team-logo ${game.homeTeam === '롯데' ? 'small-logo' : ''} ${game.homeTeam === 'NC' ? 'large-logo' : ''}">
            <span>${game.homeTeam}</span>
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
              ${lineup.homeLineup.map(player => `
                <tr>
                  <td>${player.order}</td>
                  <td>${player.position}</td>
                  <td>${player.name}</td>
                  <td>${player.war.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// Modal controls
document.addEventListener('DOMContentLoaded', () => {
  const refreshRankBtn = document.getElementById('refreshRankBtn');
  const closeRankBtn = document.getElementById('closeRankBtn');
  const rankModal = document.getElementById('rankModal');

  if (refreshRankBtn) {
    refreshRankBtn.addEventListener('click', loadTeamRank);
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
