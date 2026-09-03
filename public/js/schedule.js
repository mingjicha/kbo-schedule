let loadedMonths = new Set();

const STATUS_SYMBOLS = {
  '종료': '¢',
  '예정': '¢',
  '취소': '£',
  '진행중': '♤'
};

// 캐시 관리
const CACHE_KEYS = {
  SCHEDULE: 'kbo-schedule-',
  CACHE_DATE: 'kbo-cache-date-'
};

function isCacheValid(month, year) {
  try {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const gameDate = new Date(year, month - 1, 1);
    const isCurrentOrPastMonth = gameDate <= today;

    // 현재 달 이전: 오늘 날짜로 검증
    // 미래 달: 무제한 유효
    if (isCurrentOrPastMonth && gameDate.getMonth() === today.getMonth()) {
      const cacheDate = localStorage.getItem(`${CACHE_KEYS.CACHE_DATE}${year}-${String(month).padStart(2, '0')}`);
      return cacheDate === todayStr;
    }

    return !!localStorage.getItem(`${CACHE_KEYS.SCHEDULE}${year}-${String(month).padStart(2, '0')}`);
  } catch (e) {
    return false;
  }
}

function getScheduleFromCache(month, year) {
  try {
    const key = `${CACHE_KEYS.SCHEDULE}${year}-${String(month).padStart(2, '0')}`;
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    return null;
  }
}

function saveScheduleToCache(month, year, schedule) {
  try {
    const key = `${CACHE_KEYS.SCHEDULE}${year}-${String(month).padStart(2, '0')}`;
    const dateKey = `${CACHE_KEYS.CACHE_DATE}${year}-${String(month).padStart(2, '0')}`;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    localStorage.setItem(key, JSON.stringify(schedule));
    localStorage.setItem(dateKey, todayStr);
  } catch (e) {
    // 용량 초과 등의 에러 무시
  }
}

// 당일 경기가 있으면 실시간 갱신 타이머 시작
let todayRefreshTimer = null;

function startTodayRefreshTimer() {
  if (todayRefreshTimer) clearInterval(todayRefreshTimer);

  const checkAndRefreshToday = async () => {
    const today = new Date();
    const currentMonthNum = today.getMonth() + 1;
    const currentYearNum = today.getFullYear();

    // 당일 경기가 있는지 확인
    const todayGames = window.currentScheduleData?.filter(g => {
      const m = g.date.match(/(\d{2})\.(\d{2})/);
      if (!m) return false;
      return parseInt(m[1]) === currentMonthNum && parseInt(m[2]) === today.getDate();
    }) || [];

    if (todayGames.length === 0) return;

    // 가장 빠른 경기 시간 확인
    const earliestGameTime = todayGames.reduce((earliest, game) => {
      const [hours, minutes] = game.time.split(':');
      const gameTime = new Date(currentYearNum, currentMonthNum - 1, today.getDate(), parseInt(hours), parseInt(minutes));
      return gameTime < earliest ? gameTime : earliest;
    }, new Date(currentYearNum, currentMonthNum - 1, today.getDate(), 23, 59));

    // 경기 시작 후 6시간 내: TODAY 경기만 실시간 갱신
    const gameEndTime = new Date(earliestGameTime.getTime() + 6 * 60 * 60 * 1000);
    if (today >= earliestGameTime && today < gameEndTime) {
      try {
        const response = await fetch('/api/today-games-status');
        if (response.ok) {
          const freshTodayGames = await response.json();
          // TODAY 경기만 업데이트
          window.currentScheduleData = window.currentScheduleData.map(game => {
            const m = game.date?.match(/(\d{2})\.(\d{2})/);
            const isTodayGame = m && parseInt(m[1]) === currentMonthNum && parseInt(m[2]) === today.getDate();
            if (!isTodayGame) return game;

            // TODAY 경기 상태 업데이트
            const updated = freshTodayGames.find(fresh =>
              fresh.gameId === game.gameId || fresh.gameDate === game.gameDate && fresh.awayTeamCode === game.awayTeamCode
            );
            return updated || game;
          });
          updateGameStatuses();
        }
      } catch (error) {
        console.error('Error refreshing today games status:', error);
      }
    }
  };

  // 2분마다 확인
  todayRefreshTimer = setInterval(checkAndRefreshToday, 2 * 60 * 1000);
  // 초기 한 번 실행
  checkAndRefreshToday();
}

function buildStatusHTML(status, symbol) {
  return symbol
    ? `${status} <span class="schedule__status-symbol">${symbol}</span>`
    : status;
}

function renderSkeletonLoader() {
  return `
    <div class="loading">
      <div class="spinner-border" role="status"></div>
      <p>경기 일정을 불러오는 중이에요<span class="symbol-font">♤</span></p>
    </div>
  `;
}

async function loadSchedule(scrollToDate = null) {
  const scheduleContainer = document.getElementById('scheduleContainer');
  loadedMonths.clear();

  await initializeMonthTabsWithLazyLoad();
  scheduleContainer.innerHTML = renderSkeletonLoader();

  try {
    const defaultMonthStr = String(currentMonth).padStart(2, '0');
    const defaultSchedule = await loadMonthData(currentMonth);

    window.currentScheduleData = defaultSchedule;
    loadedMonths.add(defaultMonthStr);

    if (defaultSchedule.length === 0) {
      scheduleContainer.innerHTML = '<div class="schedule__no-games">경기 일정이 없어요<span class="symbol-font">♤</span></div>';
      return;
    }

    scheduleContainer.innerHTML = '';
    const gameList = renderGamesByMonth(defaultSchedule, scrollToDate, currentYear);
    scheduleContainer.appendChild(gameList);

    updateCalendarDisabledDates(defaultSchedule);
  } catch (error) {
    console.error('Error loading schedule:', error);
    scheduleContainer.innerHTML = '<div class="schedule__no-games">일정을 불러올 수 없어요<span class="symbol-font">♤</span></div>';
  }
}

function groupByDate(games) {
  const groups = {};
  games.forEach(game => {
    if (!groups[game.date]) {
      groups[game.date] = [];
    }
    groups[game.date].push(game);
  });
  return groups;
}

function formatDateDisplay(dateStr) {
  const match = dateStr.match(/(\d{2})\.(\d{2})\((.)\)/);
  if (!match) return dateStr;

  const month = parseInt(match[1]);
  const day = parseInt(match[2]);
  const dayName = match[3];

  return `${month}월 ${day}일 (${dayName})`;
}

function getGameStatus(game) {
  if (game.status === '취소') {
    return '취소';
  }

  // 비고란에 사유가 적혀 있으면 취소 (우천취소/폭염취소/그라운드사정 등)
  const noteText = game.note ? game.note.replace(/<[^>]*>/g, '').trim() : '';
  if (noteText && noteText !== '-') {
    return '취소';
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const gameDate = game.date.split('(')[0];
  const [month, day] = gameDate.split('.');
  const [hours, minutes] = game.time.split(':');

  const gameDateTime = new Date(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
  const gameDateOnly = new Date(currentYear, parseInt(month) - 1, parseInt(day));

  if (gameDateOnly.getTime() < today.getTime()) {
    if (game.awayScore === null && game.homeScore === null) {
      return '취소';
    }
    return '종료';
  }

  if (gameDateOnly.getTime() === today.getTime()) {
    const gameEndTime = new Date(gameDateTime.getTime() + 4 * 60 * 60 * 1000);
    if (now >= gameDateTime && now < gameEndTime) {
      return '진행중';
    }
    if (now >= gameEndTime) {
      return '종료';
    }
    return '예정';
  }

  if (gameDateOnly.getTime() > today.getTime()) {
    return '예정';
  }

  return '종료';
}

// 오늘 이후(오늘 포함) 경기가 하나라도 있는지
function hasUpcomingGame(games, year) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return games.some(game => {
    const dateOnly = game.date.split('(')[0].trim();
    const [m, d] = dateOnly.split('.');
    return new Date(year, parseInt(m) - 1, parseInt(d)).getTime() >= today;
  });
}

function setActiveMonthTab(month) {
  const monthStr = String(month).padStart(2, '0');
  document.querySelectorAll('.nav__tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.month === monthStr);
  });
}

// 앱 진입 시 한 번 정해지는 기준일 (오늘 또는 다음 경기일)
// 다른 달을 열어도 이 날짜에만 배지를 붙인다
let focusDateInfo = null;

function setFocusDateInfo(focus, year) {
  focusDateInfo = focus ? { date: focus.date, type: focus.type, year } : null;
}

// 오늘 경기가 있으면 오늘, 없으면 앞으로 가장 가까운 경기일을 찾는다
function findFocusDate(grouped, year) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let todayKey = null;
  let nextKey = null;
  let nextTime = Infinity;

  Object.keys(grouped).forEach(date => {
    const dateOnly = date.split('(')[0].trim();
    const [m, d] = dateOnly.split('.');
    const time = new Date(year, parseInt(m) - 1, parseInt(d)).getTime();

    if (time === today.getTime()) {
      todayKey = dateOnly;
    } else if (time > today.getTime() && time < nextTime) {
      nextTime = time;
      nextKey = dateOnly;
    }
  });

  if (todayKey) return { date: todayKey, type: 'today' };
  if (nextKey) return { date: nextKey, type: 'next' };
  return null;
}

function renderGamesByMonth(games, scrollToDate = null, year = currentYear, instantScroll = false) {
  const scheduleContainer = document.getElementById('scheduleContainer');
  const grouped = groupByDate(games);
  const gameList = document.createElement('div');
  gameList.className = 'schedule__list';

  // 배지는 앱 진입 시 정해진 기준일에만 붙인다 (다른 달을 열어도 새로 생기지 않음)
  const focus = focusDateInfo && focusDateInfo.year === year ? focusDateInfo : null;

  Object.keys(grouped).forEach(date => {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'schedule__day';

    const dateOnly = date.split('(')[0].trim();
    const isToday = focus && focus.type === 'today' && focus.date === dateOnly;
    const isNext = focus && focus.type === 'next' && focus.date === dateOnly;

    if (isToday || isNext) {
      dayDiv.classList.add('schedule__day--today');
    }

    const header = document.createElement('div');
    header.className = 'schedule__date-header';
    header.setAttribute('data-date', dateOnly);

    const formattedDate = formatDateDisplay(date);
    if (isToday) {
      header.classList.add('schedule__date-header--today');
      header.innerHTML = `${formattedDate} <span class="schedule__today-badge">today</span>`;
    } else if (isNext) {
      header.classList.add('schedule__date-header--today');
      header.innerHTML = `${formattedDate} <span class="schedule__today-badge">next</span>`;
    } else {
      header.textContent = formattedDate;
    }
    dayDiv.appendChild(header);

    grouped[date].forEach(game => {
      if (currentTeam) {
        const teamCodeToName = {
          'LG': 'LG',
          'HH': '한화',
          'SK': 'SSG',
          'SS': '삼성',
          'NC': 'NC',
          'KT': 'KT',
          'LT': '롯데',
          'HT': 'KIA',
          'OB': '두산',
          'WO': '키움'
        };
        const selectedTeamName = teamCodeToName[currentTeam];
        if (game.awayTeam !== selectedTeamName && game.homeTeam !== selectedTeamName) {
          return;
        }
      }

      const clickable = isToday || isNext || game.status === '종료';
      const gameCard = createGameCard(game, date, clickable);
      dayDiv.appendChild(gameCard);
    });

    gameList.appendChild(dayDiv);
  });

  if (scrollToDate) {
    setTimeout(() => scrollToDateHeader(scrollToDate, instantScroll), 150);
  }

  return gameList;
}

// 프리뷰를 열 수 있는 경기(today/next)의 데이터를 서버가 미리 준비하도록 요청한다
function warmupPreviews(schedule, focusDate) {
  if (!focusDate) return;

  const games = schedule
    .filter(g => g.date.startsWith(focusDate) && g.gameId && g.awayPitcher && g.homePitcher)
    .map(g => ({ gameId: g.gameId, awayPitcher: g.awayPitcher, homePitcher: g.homePitcher }));

  if (games.length === 0) return;

  fetch('/api/preview-warmup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ games })
  }).catch(() => {});
}

function scrollToDateHeader(dateStr, instant = false) {
  if (!dateStr) return;
  const dateHeader = document.querySelector(`#scheduleContainer [data-date="${dateStr}"]`);
  if (dateHeader) {
    dateHeader.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' });
  }
}

function createGameCard(game, date, isToday) {
  const gameCard = document.createElement('div');
  gameCard.className = 'schedule__game';

  const finalStatus = getGameStatus(game);
  const statusClass =
    finalStatus === '종료' ? 'schedule__game--finished' :
    finalStatus === '취소' ? 'schedule__game--cancelled' :
    finalStatus === '진행중' ? 'schedule__game--live' : 'schedule__game--scheduled';
  gameCard.classList.add(statusClass);

  const gameInfo = document.createElement('div');
  gameInfo.className = 'schedule__info';

  const timeDiv = document.createElement('div');
  timeDiv.className = 'schedule__time';
  timeDiv.textContent = game.time || '시간미정';
  gameInfo.appendChild(timeDiv);

  const stadiumDiv = document.createElement('div');
  stadiumDiv.className = 'schedule__stadium';
  stadiumDiv.textContent = game.stadium || '';
  gameInfo.appendChild(stadiumDiv);

  const teamsDiv = document.createElement('div');
  teamsDiv.className = 'schedule__teams';

  const awayTeamContainer = document.createElement('div');
  awayTeamContainer.className = 'schedule__team';

  const awayTeam = document.createElement('span');
  awayTeam.className = 'schedule__team-name';
  awayTeam.textContent = game.awayTeam;
  awayTeamContainer.appendChild(awayTeam);

  if (game.awayPitcher && game.awayPitcher !== 'N/A') {
    const awayPitcher = document.createElement('div');
    awayPitcher.className = 'schedule__pitcher';

    if (statusClass === 'schedule__game--finished') {
      awayPitcher.classList.add(game.winner === 'away' ? 'schedule__pitcher--win' : 'schedule__pitcher--loss');
      if (game.winner === 'away') {
        const awaysvgIcon = document.createElement('span');
        awaysvgIcon.className = 'schedule__pitcher-icon';
        awaysvgIcon.textContent = '🏅';
        awayPitcher.appendChild(awaysvgIcon);
      }
    }

    const awayPitcherText = document.createElement('span');
    awayPitcherText.textContent = game.awayPitcher;
    awayPitcher.appendChild(awayPitcherText);

    awayTeamContainer.appendChild(awayPitcher);
  }

  teamsDiv.appendChild(awayTeamContainer);

  const awayLogo = document.createElement('img');
  awayLogo.className = 'schedule__logo';
  awayLogo.src = teamLogos[game.awayTeam] || '';
  awayLogo.alt = game.awayTeam;
  teamsDiv.appendChild(awayLogo);

  const scoreContainer = document.createElement('div');
  scoreContainer.className = 'schedule__score-container';

  const scoreDiv = document.createElement('div');
  scoreDiv.className = 'schedule__score ' + statusClass;
  scoreDiv.id = `score-${game.awayTeam}-${game.homeTeam}-${game.time}`;
  if ((statusClass === 'schedule__game--live' || statusClass === 'schedule__game--finished') && game.awayScore !== null && game.homeScore !== null) {
    scoreDiv.textContent = `${game.awayScore} : ${game.homeScore}`;
  } else {
    scoreDiv.textContent = 'vs';
  }
  scoreContainer.appendChild(scoreDiv);

  if (statusClass === 'schedule__game--live' && game.gameId) {
    const inningDiv = document.createElement('div');
    inningDiv.className = 'schedule__inning-info';
    inningDiv.id = `inning-${game.gameId}`;
    inningDiv.innerHTML = '로딩 중이에요<span class="symbol-font">♤</span>';
    scoreContainer.appendChild(inningDiv);

    fetchGameDetail(game.gameId).then(data => {
      if (data) {
        if (data.awayScore !== undefined && data.homeScore !== undefined) {
          scoreDiv.textContent = `${data.awayScore} : ${data.homeScore}`;
        }
        if (data.inning) {
          const inningText = `${data.inning}${data.inningSide === '초' ? '회초' : '회말'}`;
          inningDiv.textContent = inningText;
        } else {
          inningDiv.textContent = '경기 정보 없음';
        }
      }
    });
  }

  teamsDiv.appendChild(scoreContainer);

  const homeLogo = document.createElement('img');
  homeLogo.className = 'schedule__logo';
  homeLogo.src = teamLogos[game.homeTeam] || '';
  homeLogo.alt = game.homeTeam;
  teamsDiv.appendChild(homeLogo);

  const homeTeamContainer = document.createElement('div');
  homeTeamContainer.className = 'schedule__team';

  const homeTeam = document.createElement('span');
  homeTeam.className = 'schedule__team-name';
  homeTeam.textContent = game.homeTeam;
  homeTeamContainer.appendChild(homeTeam);

  if (game.homePitcher && game.homePitcher !== 'N/A') {
    const homePitcher = document.createElement('div');
    homePitcher.className = 'schedule__pitcher';

    if (statusClass === 'schedule__game--finished') {
      homePitcher.classList.add(game.winner === 'home' ? 'schedule__pitcher--win' : 'schedule__pitcher--loss');
      if (game.winner === 'home') {
        const homesvgIcon = document.createElement('span');
        homesvgIcon.className = 'schedule__pitcher-icon';
        homesvgIcon.textContent = '🏅';
        homePitcher.appendChild(homesvgIcon);
      }
    }

    const homePitcherText = document.createElement('span');
    homePitcherText.textContent = game.homePitcher;
    homePitcher.appendChild(homePitcherText);

    homeTeamContainer.appendChild(homePitcher);
  }

  teamsDiv.appendChild(homeTeamContainer);

  gameInfo.appendChild(teamsDiv);

  const statusBadge = document.createElement('div');
  statusBadge.className = 'schedule__status ' + statusClass;

  const statusSymbol = STATUS_SYMBOLS[finalStatus] || '';

  statusBadge.innerHTML = buildStatusHTML(finalStatus, statusSymbol);

  gameInfo.appendChild(statusBadge);

  gameCard.appendChild(gameInfo);

  gameCard.addEventListener('click', async (e) => {
    if (finalStatus === '취소') return;

    const gameDetailModal = document.getElementById('gameDetailModal');
    const gameDetailContainer = document.getElementById('gameDetailContainer');
    const gameDetailTitle = document.getElementById('gameDetailTitle');

    if (!isToday) return;

    const badgeText = finalStatus === '진행중' ? 'Live'
      : finalStatus === '종료' ? 'Review'
      : 'Preview';
    const badgeClass = finalStatus === '종료' ? ' modal__badge--review' : '';

    gameDetailModal.classList.add('show');
    gameDetailTitle.innerHTML = `<h3><span class="modal__badge${badgeClass}">${badgeText}</span></h3>`;

    if (finalStatus === '진행중') {
      const tabContainer = document.createElement('div');
      tabContainer.className = 'game-detail__tabs';

      const keyPlayerTab = document.createElement('button');
      keyPlayerTab.className = 'game-detail__tab active';
      keyPlayerTab.innerHTML = buildStatusHTML('키플레이어', '♤');
      tabContainer.appendChild(keyPlayerTab);

      const contentContainer = document.createElement('div');
      contentContainer.className = 'game-detail__tab-content';

      const keyPlayerContent = document.createElement('div');
      keyPlayerContent.className = 'game-detail__tab-pane active';
      keyPlayerContent.innerHTML = '<div class="loading"><div class="spinner-border" role="status"></div><p>로딩 중이에요<span class="symbol-font">♤</span></p></div>';
      contentContainer.appendChild(keyPlayerContent);

      gameDetailContainer.innerHTML = '';
      gameDetailContainer.appendChild(tabContainer);
      gameDetailContainer.appendChild(contentContainer);

      loadKeyPlayers(game, keyPlayerContent).catch(error => {
        console.error('Error loading key players:', error);
        keyPlayerContent.innerHTML = '<div class="modal__no-data">정보를 불러올 수 없어요<span class="symbol-font">♤</span></div>';
      });
      return;
    }

    if (finalStatus === '종료') {
      const tabContainer = document.createElement('div');
      tabContainer.className = 'game-detail__tabs';

      const reviewTab = document.createElement('button');
      reviewTab.className = 'game-detail__tab active';
      reviewTab.innerHTML = buildStatusHTML('리뷰', '¢');

      const highlightTab = document.createElement('button');
      highlightTab.className = 'game-detail__tab';
      highlightTab.innerHTML = buildStatusHTML('하이라이트', '');

      tabContainer.appendChild(reviewTab);
      tabContainer.appendChild(highlightTab);

      const contentContainer = document.createElement('div');
      contentContainer.className = 'game-detail__tab-content';

      const loadingHtml = '<div class="loading"><div class="spinner-border" role="status"></div><p>로딩 중이에요<span class="symbol-font">♤</span></p></div>';

      const reviewContent = document.createElement('div');
      reviewContent.className = 'game-detail__tab-pane active';
      reviewContent.innerHTML = loadingHtml;

      const highlightContent = document.createElement('div');
      highlightContent.className = 'game-detail__tab-pane';
      highlightContent.innerHTML = loadingHtml;

      contentContainer.appendChild(reviewContent);
      contentContainer.appendChild(highlightContent);

      gameDetailContainer.innerHTML = '';
      gameDetailContainer.appendChild(tabContainer);
      gameDetailContainer.appendChild(contentContainer);

      reviewTab.addEventListener('click', () => {
        reviewTab.classList.add('active');
        highlightTab.classList.remove('active');
        reviewContent.classList.add('active');
        highlightContent.classList.remove('active');
        reviewTab.innerHTML = buildStatusHTML('리뷰', '¢');
        highlightTab.innerHTML = buildStatusHTML('하이라이트', '');
      });

      highlightTab.addEventListener('click', () => {
        highlightTab.classList.add('active');
        reviewTab.classList.remove('active');
        highlightContent.classList.add('active');
        reviewContent.classList.remove('active');
        highlightTab.innerHTML = buildStatusHTML('하이라이트', '¢');
        reviewTab.innerHTML = buildStatusHTML('리뷰', '');
      });

      loadGameReview(game, reviewContent).catch(error => {
        console.error('Error loading game review:', error);
        reviewContent.innerHTML = '<div class="modal__no-data">정보를 불러올 수 없어요<span class="symbol-font">♤</span></div>';
      });

      loadGameHighlight(game, highlightContent).catch(error => {
        console.error('Error loading game highlight:', error);
        highlightContent.innerHTML = '<div class="modal__no-data">하이라이트가 없어요<span class="symbol-font">♤</span></div>';
      });
      return;
    }

    if (isToday) {
      const tabContainer = document.createElement('div');
      tabContainer.className = 'game-detail__tabs';

      const pitcherTab = document.createElement('button');
      pitcherTab.className = 'game-detail__tab active';
      pitcherTab.innerHTML = buildStatusHTML('선발투수 전력분석', '♤');

      const lineupTab = document.createElement('button');
      lineupTab.className = 'game-detail__tab';
      lineupTab.innerHTML = buildStatusHTML('라인업 분석', '');

      tabContainer.appendChild(pitcherTab);
      tabContainer.appendChild(lineupTab);

      const contentContainer = document.createElement('div');
      contentContainer.className = 'game-detail__tab-content';

      const pitcherContent = document.createElement('div');
      pitcherContent.className = 'game-detail__tab-pane active';
      pitcherContent.innerHTML = '<div class="loading"><div class="spinner-border" role="status"></div><p>로딩 중이에요<span class="symbol-font">♤</span></p></div>';

      const lineupContent = document.createElement('div');
      lineupContent.className = 'game-detail__tab-pane';
      lineupContent.innerHTML = '<div class="loading"><div class="spinner-border" role="status"></div></div>';

      contentContainer.appendChild(pitcherContent);
      contentContainer.appendChild(lineupContent);

      gameDetailContainer.innerHTML = '';
      gameDetailContainer.appendChild(tabContainer);
      gameDetailContainer.appendChild(contentContainer);

      pitcherTab.addEventListener('click', () => {
        pitcherTab.classList.add('active');
        lineupTab.classList.remove('active');
        pitcherContent.classList.add('active');
        lineupContent.classList.remove('active');
        pitcherTab.innerHTML = buildStatusHTML('선발투수 전력분석', '♤');
        lineupTab.innerHTML = buildStatusHTML('라인업 분석', '');
      });

      lineupTab.addEventListener('click', () => {
        lineupTab.classList.add('active');
        pitcherTab.classList.remove('active');
        lineupContent.classList.add('active');
        pitcherContent.classList.remove('active');
        lineupTab.innerHTML = buildStatusHTML('라인업 분석', '♤');
        pitcherTab.innerHTML = buildStatusHTML('선발투수 전력분석', '');
      });

      loadPitcherComparison(game, pitcherContent).catch(error => {
        console.error('Error loading game detail:', error);
        gameDetailContainer.innerHTML = '<div class="modal__no-data">정보를 불러올 수 없어요<span class="symbol-font">♤</span></div>';
      });

      loadLineup(game, lineupContent).catch(error => {
        console.error('Error loading lineup:', error);
      });
    }
  });

  return gameCard;
}

async function applyTeamFilter() {
  const scheduleContainer = document.getElementById('scheduleContainer');

  // 포스트시즌 보는 중이면 그 시리즈를 다시 그린다
  if (postseasonMode && postseasonSeries) {
    await renderSeries(postseasonSeries);
    return;
  }

  try {
    scheduleContainer.innerHTML = renderSkeletonLoader(1);
    const defaultSchedule = await loadMonthData(currentMonth);
    window.currentScheduleData = defaultSchedule;

    if (defaultSchedule.length === 0) {
      scheduleContainer.innerHTML = '<div class="schedule__no-games">경기 일정이 없어요<span class="symbol-font">♤</span></div>';
      return;
    }

    scheduleContainer.innerHTML = '';
    const gameList = renderGamesByMonth(defaultSchedule, null, currentYear);
    scheduleContainer.appendChild(gameList);

    await initializeMonthTabsWithLazyLoad();
    updateCalendarDisabledDates(defaultSchedule);
  } catch (error) {
    console.error('Error loading schedule:', error);
    scheduleContainer.innerHTML = '<div class="schedule__no-games">일정을 불러올 수 없어요<span class="symbol-font">♤</span></div>';
  }
}

async function loadMonthData(month, year = null) {
  const monthStr = String(month).padStart(2, '0');
  const yearToUse = year !== null ? year : currentYear;

  // 캐시 확인
  if (isCacheValid(month, yearToUse)) {
    const cached = getScheduleFromCache(month, yearToUse);
    if (cached) {
      return cached;
    }
  }

  // season.json 전체 로드 (첫 요청만 느림, 이후는 파일에서 로드)
  const seasonJsonUrl = `/api/season-json?year=${yearToUse}`;
  const response = await fetch(seasonJsonUrl);

  if (response.ok) {
    const allSchedules = await response.json();
    if (Array.isArray(allSchedules)) {
      // 요청한 월의 데이터만 필터링
      const filteredSchedules = allSchedules.filter(game => {
        const gameMonth = game.gameDate ? game.gameDate.substring(5, 7) : monthStr;
        return gameMonth === monthStr;
      });

      // 팀 필터 적용
      let finalSchedules = filteredSchedules;
      if (currentTeam) {
        finalSchedules = filteredSchedules.filter(game => {
          return (game.awayTeamCode === currentTeam || game.homeTeamCode === currentTeam);
        });
      }

      // 캐시 저장
      saveScheduleToCache(month, yearToUse, finalSchedules);
      return finalSchedules;
    }
  }
  return [];
}

async function initializeMonthTabsWithLazyLoad() {
  const monthTabsContainer = document.getElementById('monthTabsContainer');
  const tabContainer = document.createElement('div');
  tabContainer.className = 'nav__tabs-list';

  for (let month = 3; month <= 10; month++) {
    const tab = document.createElement('button');
    tab.className = 'nav__tab';
    tab.textContent = month + '월';
    tab.dataset.month = String(month).padStart(2, '0');

    if (month === currentMonth) {
      tab.classList.add('active');
    }

    tab.addEventListener('click', async (e) => {
      document.querySelectorAll('.nav__tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedDate = null;
      currentMonth = month;

      const monthNum = String(month).padStart(2, '0');
      let gamesForMonth = [];

      const scheduleContainer = document.getElementById('scheduleContainer');
      scheduleContainer.innerHTML = renderSkeletonLoader(currentTeam ? 1 : 5);
      gamesForMonth = await loadMonthData(month, currentYear);
      window.currentScheduleData = gamesForMonth;

      if (gamesForMonth.length > 0) {
        scheduleContainer.innerHTML = '';
        const gameList = renderGamesByMonth(gamesForMonth, null, currentYear);
        scheduleContainer.appendChild(gameList);
      } else {
        scheduleContainer.innerHTML = '<div class="schedule__no-games">경기 일정이 없어요<span class="symbol-font">♤</span></div>';
      }
    });

    tabContainer.appendChild(tab);
  }

  monthTabsContainer.innerHTML = '';
  monthTabsContainer.appendChild(tabContainer);
}

async function fetchGameDetail(gameId) {
  try {
    const apiUrl = `/api/game-detail/${gameId}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching game detail:', error);
    return null;
  }
}

function updateGameStatuses() {
  const gameCards = document.querySelectorAll('.schedule__game');
  const now = new Date();

  gameCards.forEach(card => {
    const timeElement = card.querySelector('.schedule__time');
    if (!timeElement) return;
    const timeText = timeElement.textContent;
    const statusBadge = card.querySelector('.schedule__status');
    const dayHeader = card.closest('.schedule__day').querySelector('.schedule__date-header');
    const dateStr = dayHeader.getAttribute('data-date');

    if (!timeText || timeText === '시간미정') return;

    if (statusBadge.textContent.includes('취소')) {
      if (!statusBadge.textContent.includes(STATUS_SYMBOLS['취소'])) {
        statusBadge.innerHTML = buildStatusHTML('취소', STATUS_SYMBOLS['취소']);
      }
      return;
    }

    const [hours, minutes] = timeText.split(':');
    const [month, day] = dateStr.split('.');
    const gameDateTime = new Date(now.getFullYear(), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
    const gameEndTime = new Date(gameDateTime.getTime() + 4 * 60 * 60 * 1000);

    let newStatus = statusBadge.textContent
      .replace(/[♤♧¢£]/g, '')
      .trim();
    let newSymbol = '';
    let newClass = card.className.replace('schedule__game ', '').trim();

    if (statusBadge.textContent.includes('종료')) {
      newStatus = '종료';
      newSymbol = STATUS_SYMBOLS['종료'];
      newClass = 'schedule__game--finished';
    } else if (now >= gameDateTime && now < gameEndTime) {
      newStatus = '진행중';
      newSymbol = STATUS_SYMBOLS['진행중'];
      newClass = 'schedule__game--live';
    } else if (now < gameDateTime) {
      newStatus = '예정';
      newSymbol = STATUS_SYMBOLS['예정'];
      newClass = 'schedule__game--scheduled';
    }

    if (statusBadge.textContent.trim() !== `${newStatus} ${newSymbol}`.trim()) {
      statusBadge.innerHTML = buildStatusHTML(newStatus, newSymbol);
      card.className = 'schedule__game ' + newClass;

      const scoreDiv = card.querySelector('.schedule__score');
      if (scoreDiv) {
        scoreDiv.className = 'schedule__score ' + newClass;
      }
    }
  });
}

setInterval(updateGameStatuses, 1000);

// 한국시리즈 MVP 는 KBO 일정 API 에 없어 직접 채워야 한다.
// 값이 없는 해는 우승팀과 전적만 표시된다
const KS_MVP = {};

// ==================== 포스트시즌 ====================
// 켜면 월 탭이 와일드카드/준PO/PO/한국시리즈로 바뀐다
let postseasonMode = false;
let postseasonSeries = null;
let savedMonthBeforePostseason = null;

async function loadSeriesData(seriesKey, year = currentYear) {
  // 캐시 확인 (9월 기준으로 포스트시즌 전체 캐싱)
  if (isCacheValid(9, year)) {
    const cached = getScheduleFromCache(9, year);
    if (cached) {
      return cached;
    }
  }

  // postseason.json 전체 로드
  const postseasonJsonUrl = `/api/postseason-json?year=${year}`;
  const response = await fetch(postseasonJsonUrl);

  if (response.ok) {
    const allSchedules = await response.json();
    if (Array.isArray(allSchedules)) {
      // 시리즈별 필터링
      const seriesMap = { 'wc': '4', 'sp': '3', 'pl': '5', 'ks': '7' };
      const srId = seriesMap[seriesKey];
      const filteredSchedules = allSchedules.filter(game => game.srId === srId);

      // 팀 필터 적용
      let finalSchedules = filteredSchedules;
      if (currentTeam) {
        finalSchedules = filteredSchedules.filter(game => {
          return (game.awayTeamCode === currentTeam || game.homeTeamCode === currentTeam);
        });
      }

      // 캐시 저장
      if (finalSchedules.length > 0) {
        saveScheduleToCache(9, year, finalSchedules);
      }
      return finalSchedules;
    }
  }
  return [];
}

async function renderSeries(seriesKey) {
  postseasonSeries = seriesKey;
  const scheduleContainer = document.getElementById('scheduleContainer');
  const postseasonAlert = document.getElementById('postseasonAlert');
  scheduleContainer.innerHTML = renderSkeletonLoader();

  const games = await loadSeriesData(seriesKey);
  window.currentScheduleData = games;

  if (games.length === 0) {
    scheduleContainer.innerHTML = '<div class="schedule__no-games">포스트시즌 일정이 아직 안 나왔어요<span class="symbol-font">♤</span></div>';
    return;
  }

  scheduleContainer.innerHTML = '';

  // 한국시리즈가 끝난 해라면 우승팀을 맨 위에 보여준다
  const champ = seriesKey === 'ks' ? getChampionInfo(games) : null;
  if (champ) scheduleContainer.appendChild(renderChampionBanner(champ));

  scheduleContainer.appendChild(renderGamesByMonth(games, null, currentYear));
}

// 일정으로 우승팀을 계산한다. 4승을 먼저 채운 팀이 우승
function getChampionInfo(games) {
  const wins = {};
  games.forEach(game => {
    if (game.status !== '종료' || !game.winner) return;
    const team = game.winner === 'away' ? game.awayTeam : game.homeTeam;
    wins[team] = (wins[team] || 0) + 1;
  });

  const ranked = Object.entries(wins).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return null;

  const [team, won] = ranked[0];
  // 아직 시리즈가 끝나지 않았으면 표시하지 않는다
  if (won < 4) return null;

  const lost = ranked[1] ? ranked[1][1] : 0;
  return { team, won, lost, mvp: KS_MVP[String(currentYear)] || null };
}

function renderChampionBanner({ team, mvp }) {
  const banner = document.createElement('div');
  banner.className = 'champion';

  const trophy = document.createElement('span');
  trophy.className = 'champion__ico';
  trophy.textContent = '\u{1F3C6}';
  banner.appendChild(trophy);

  const body = document.createElement('div');
  body.className = 'champion__body';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'champion__eyebrow';
  eyebrow.textContent = `${currentYear} \ud55c\uad6d\uc2dc\ub9ac\uc988 \uc6b0\uc2b9`;
  body.appendChild(eyebrow);

  const name = document.createElement('div');
  name.className = 'champion__team';
  name.textContent = teamFullNames[team] || team;
  body.appendChild(name);

  // \uc804\uc801\uc740 \ubc14\ub85c \uc544\ub798 \uacbd\uae30 \ubaa9\ub85d\uc5d0\uc11c \ubcf4\uc774\ubbc0\ub85c \uc0dd\ub7b5\ud558\uace0,
  // MVP \uac00 \uc788\uc744 \ub54c\ub9cc \ud55c \uc904 \ub354 \ubcf4\uc5ec\uc900\ub2e4
  if (mvp) {
    const meta = document.createElement('div');
    meta.className = 'champion__meta';
    meta.textContent = `MVP ${mvp}`;
    body.appendChild(meta);
  }

  banner.appendChild(body);

  return banner;
}

async function renderPostseasonTabs() {
  const monthTabsContainer = document.getElementById('monthTabsContainer');
  const list = document.createElement('div');
  list.className = 'nav__tabs-list';

  let seriesList;
  try {
    const res = await fetch(`/api/postseason?year=${currentYear}`);
    seriesList = res.ok ? await res.json() : [];
  } catch (e) {
    seriesList = [];
  }

  if (seriesList.length === 0) {
    seriesList = [
      { key: 'wc', name: '와일드카드', hasGames: false },
      { key: 'sp', name: '준플레이오프', hasGames: false },
      { key: 'pl', name: '플레이오프', hasGames: false },
      { key: 'ks', name: '한국시리즈', hasGames: false }
    ];
  }

  // 보던 시리즈가 있으면 연도를 바꿔도 그대로 유지한다.
  // 없으면 경기가 있는 첫 시리즈를 연다
  const keptSeries = postseasonSeries &&
    seriesList.some(s => s.key === postseasonSeries) ? postseasonSeries : null;
  const firstWithGames = seriesList.find(s => s.hasGames);
  const defaultKey = keptSeries || (firstWithGames ? firstWithGames.key : seriesList[0].key);

  seriesList.forEach(series => {
    const tab = document.createElement('button');
    tab.className = 'nav__tab';
    tab.textContent = series.name;
    tab.dataset.series = series.key;
    if (series.key === defaultKey) tab.classList.add('active');

    tab.addEventListener('click', async () => {
      document.querySelectorAll('.nav__tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      await renderSeries(series.key);
    });

    list.appendChild(tab);
  });

  monthTabsContainer.innerHTML = '';
  monthTabsContainer.appendChild(list);

  await renderSeries(defaultKey);
}

async function setPostseasonMode(on) {
  postseasonMode = on;

  document.querySelectorAll('.filter__postseason').forEach(btn => {
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
  });

  // 포스트시즌에서는 팀이 이미 대진으로 정해져 있어 팀 선택이 필요 없다
  const filterSummaryBtn = document.getElementById('filterSummaryBtn');
  const filterTeams = document.getElementById('filterTeams');
  if (filterSummaryBtn) filterSummaryBtn.style.display = on ? 'none' : '';
  if (filterTeams) filterTeams.style.display = on ? 'none' : '';

  if (on) {
    savedMonthBeforePostseason = currentMonth;
    await renderPostseasonTabs();
    return;
  }

  // 정규시즌으로 복귀
  postseasonSeries = null;
  if (savedMonthBeforePostseason) currentMonth = savedMonthBeforePostseason;
  await initializeMonthTabsWithLazyLoad();
  await loadSchedule();
}

document.querySelectorAll('.filter__postseason').forEach(btn => {
  btn.addEventListener('click', () => setPostseasonMode(!postseasonMode));
});
