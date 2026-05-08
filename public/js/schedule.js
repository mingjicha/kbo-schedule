let loadedMonths = new Set();

function renderSkeletonLoader(cardCount = 5) {
  const skeletonCard = `
    <div class="schedule__game schedule__game--scheduled">
      <div class="schedule__info">
        <div class="schedule__skeleton--time"></div>
        <div class="schedule__skeleton--stadium"></div>
        <div class="schedule__teams">
          <div class="schedule__team">
            <span class="schedule__skeleton--team-name"></span>
            <div class="schedule__skeleton--pitcher"></div>
          </div>
          <div class="schedule__skeleton--logo"></div>
          <div class="schedule__skeleton--score"></div>
          <div class="schedule__skeleton--logo"></div>
          <div class="schedule__team">
            <span class="schedule__skeleton--team-name"></span>
            <div class="schedule__skeleton--pitcher"></div>
          </div>
        </div>
      </div>
      <div class="schedule__skeleton--status"></div>
    </div>
  `;

  const cardsHTML = skeletonCard.repeat(cardCount);

  const skeletonDay = `
    <div class="schedule__day">
      <h3 class="schedule__date-header schedule__date-header--skeleton"></h3>
      ${cardsHTML}
    </div>
  `;

  const skeletonHTML = `
    <div class="loading">
      <div class="schedule__list">
        ${skeletonDay}
        ${skeletonDay}
        ${skeletonDay}
        ${skeletonDay}
      </div>
    </div>
  `;
  return skeletonHTML;
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
      scheduleContainer.innerHTML = '<div class="schedule__no-games">경기 일정이 없습니다.</div>';
      return;
    }

    scheduleContainer.innerHTML = '';
    const gameList = renderGamesByMonth(defaultSchedule, scrollToDate, currentYear);
    scheduleContainer.appendChild(gameList);

    updateCalendarDisabledDates(defaultSchedule);
  } catch (error) {
    console.error('Error loading schedule:', error);
    scheduleContainer.innerHTML = '<div class="schedule__no-games">일정을 불러올 수 없습니다.</div>';
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

  const noteText = game.note ? game.note.replace(/<[^>]*>/g, '').trim() : '';
  if (noteText === '취소' || noteText === '우천취소' || noteText === '기타' ||
      noteText.includes('취소') || noteText.includes('우천')) {
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

function renderGamesByMonth(games, scrollToDate = null, year = currentYear) {
  const scheduleContainer = document.getElementById('scheduleContainer');
  const grouped = groupByDate(games);
  const gameList = document.createElement('div');
  gameList.className = 'schedule__list';

  Object.keys(grouped).forEach(date => {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'schedule__day';

    const dateOnly = date.split('(')[0].trim();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dateParts = dateOnly.split('.');
    const gameMonth = parseInt(dateParts[0]);
    const gameDay = parseInt(dateParts[1]);
    const gameDate = new Date(year, gameMonth - 1, gameDay);
    const isToday = gameDate.getTime() === today.getTime();

    if (isToday) {
      dayDiv.classList.add('schedule__day--today');
    }

    const header = document.createElement('div');
    header.className = 'schedule__date-header';
    header.setAttribute('data-date', dateOnly);

    const formattedDate = formatDateDisplay(date);
    if (isToday) {
      header.classList.add('schedule__date-header--today');
      header.innerHTML = `${formattedDate} <span class="schedule__today-badge">today</span>`;
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

      const gameCard = createGameCard(game, date, isToday);
      dayDiv.appendChild(gameCard);
    });

    gameList.appendChild(dayDiv);
  });

  if (scrollToDate) {
    setTimeout(() => {
      const dateHeader = gameList.querySelector(`[data-date="${scrollToDate}"]`);
      if (dateHeader) {
        dateHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }

  return gameList;
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
    homePitcherText.textContent = `선 ${game.homePitcher}`;
    homePitcher.appendChild(homePitcherText);

    homeTeamContainer.appendChild(homePitcher);
  }

  teamsDiv.appendChild(homeTeamContainer);

  const homeLogo = document.createElement('img');
  homeLogo.className = 'schedule__logo';
  homeLogo.src = teamLogos[game.homeTeam] || '';
  homeLogo.alt = game.homeTeam;
  teamsDiv.appendChild(homeLogo);

  const scoreContainer = document.createElement('div');
  scoreContainer.className = 'schedule__score-container';

  const scoreDiv = document.createElement('div');
  scoreDiv.className = 'schedule__score ' + statusClass;
  scoreDiv.id = `score-${game.awayTeam}-${game.homeTeam}-${game.time}`;
  if ((statusClass === 'schedule__game--live' || statusClass === 'schedule__game--finished') && game.awayScore !== null && game.homeScore !== null) {
    scoreDiv.textContent = `${game.homeScore} : ${game.awayScore}`;
  } else {
    scoreDiv.textContent = 'vs';
  }
  scoreContainer.appendChild(scoreDiv);

  if (statusClass === 'schedule__game--live' && game.gameId) {
    const inningDiv = document.createElement('div');
    inningDiv.className = 'schedule__inning-info';
    inningDiv.id = `inning-${game.gameId}`;
    inningDiv.textContent = '로딩 중이다냥! †';
    scoreContainer.appendChild(inningDiv);

    fetchGameDetail(game.gameId).then(data => {
      if (data) {
        if (data.awayScore !== undefined && data.homeScore !== undefined) {
          scoreDiv.textContent = `${data.homeScore} : ${data.awayScore}`;
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

  const awayLogo = document.createElement('img');
  awayLogo.className = 'schedule__logo';
  awayLogo.src = teamLogos[game.awayTeam] || '';
  awayLogo.alt = game.awayTeam;
  teamsDiv.appendChild(awayLogo);

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
    awayPitcherText.textContent = `선 ${game.awayPitcher}`;
    awayPitcher.appendChild(awayPitcherText);

    awayTeamContainer.appendChild(awayPitcher);
  }

  teamsDiv.appendChild(awayTeamContainer);

  gameInfo.appendChild(teamsDiv);

  const statusBadge = document.createElement('div');
  statusBadge.className = 'schedule__status ' + statusClass;

  let statusText = finalStatus;
  if (finalStatus === '종료') {
    statusText += ' ♤';
  } else if (finalStatus === '예정') {
    statusText += ' ¢';
  } else if (finalStatus === '취소') {
    statusText += ' £';
  } else if (finalStatus === '진행중') {
    statusText += ' †';
  }

  statusBadge.innerHTML = statusText;

  gameInfo.appendChild(statusBadge);

  gameCard.appendChild(gameInfo);

  gameCard.addEventListener('click', async (e) => {
    if (finalStatus === '취소') return;

    const gameDetailModal = document.getElementById('gameDetailModal');
    const gameDetailContainer = document.getElementById('gameDetailContainer');
    const gameDetailTitle = document.getElementById('gameDetailTitle');

    const dateStr = date.split('(')[0].trim();
    const [month, day] = dateStr.split('.');
    const gameDateTime = new Date(currentYear, parseInt(month) - 1, parseInt(day));
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isTodayGame = gameDateTime.getTime() === today.getTime();

    if (!isTodayGame) return;

    gameDetailContainer.innerHTML = '<div class="modal__no-data">로딩 중이다냥! †</div>';
    gameDetailModal.classList.add('show');

    try {
      gameDetailTitle.innerHTML = '<h3><span class="modal__badge">Preview</span></h3>';
      gameDetailContainer.innerHTML = '';

      if (isTodayGame) {
        const tabContainer = document.createElement('div');
        tabContainer.className = 'game-detail__tabs';

        const pitcherTab = document.createElement('button');
        pitcherTab.className = 'game-detail__tab active';
        pitcherTab.textContent = '선발투수';

        const lineupTab = document.createElement('button');
        lineupTab.className = 'game-detail__tab';
        lineupTab.textContent = '라인업';

        tabContainer.appendChild(pitcherTab);
        tabContainer.appendChild(lineupTab);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'game-detail__tab-content';

        const pitcherContent = document.createElement('div');
        pitcherContent.className = 'game-detail__tab-pane active';

        const lineupContent = document.createElement('div');
        lineupContent.className = 'game-detail__tab-pane';
        lineupContent.innerHTML = '<div class="modal__no-data">라인업 정보는 준비 중이다냥! †</div>';

        contentContainer.appendChild(pitcherContent);
        contentContainer.appendChild(lineupContent);

        gameDetailContainer.appendChild(tabContainer);
        gameDetailContainer.appendChild(contentContainer);

        pitcherTab.addEventListener('click', () => {
          pitcherTab.classList.add('active');
          lineupTab.classList.remove('active');
          pitcherContent.classList.add('active');
          lineupContent.classList.remove('active');
        });

        lineupTab.addEventListener('click', () => {
          lineupTab.classList.add('active');
          pitcherTab.classList.remove('active');
          lineupContent.classList.add('active');
          pitcherContent.classList.remove('active');
        });

        pitcherContent.innerHTML = '<div class="loading"><div class="spinner-border" role="status"><span class="visually-hidden">로딩 중이다냥! †</span></div></div>';
        await loadPitcherComparison(game, pitcherContent);
      }
    } catch (error) {
      console.error('Error loading game detail:', error);
      gameDetailContainer.innerHTML = '<div class="modal__no-data">정보를 불러올 수 없다냥! †</div>';
    }
  });

  return gameCard;
}

async function applyTeamFilter() {
  const scheduleContainer = document.getElementById('scheduleContainer');
  try {
    scheduleContainer.innerHTML = renderSkeletonLoader(1);
    const defaultSchedule = await loadMonthData(currentMonth);
    window.currentScheduleData = defaultSchedule;

    if (defaultSchedule.length === 0) {
      scheduleContainer.innerHTML = '<div class="schedule__no-games">경기 일정이 없습니다.</div>';
      return;
    }

    scheduleContainer.innerHTML = '';
    const gameList = renderGamesByMonth(defaultSchedule, null, currentYear);
    scheduleContainer.appendChild(gameList);

    await initializeMonthTabsWithLazyLoad();
    updateCalendarDisabledDates(defaultSchedule);
  } catch (error) {
    console.error('Error loading schedule:', error);
    scheduleContainer.innerHTML = '<div class="schedule__no-games">일정을 불러올 수 없습니다.</div>';
  }
}

async function loadMonthData(month, year = null) {
  const monthStr = String(month).padStart(2, '0');
  const yearToUse = year !== null ? year : currentYear;
  const apiUrl = `/api/schedule?year=${yearToUse}&month=${monthStr}&team=${currentTeam}`;
  const response = await fetch(apiUrl);

  if (response.ok) {
    const schedule = await response.json();
    if (Array.isArray(schedule)) {
      return schedule;
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
        scheduleContainer.innerHTML = '<div class="schedule__no-games">경기 일정이 없습니다.</div>';
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
      if (!statusBadge.textContent.includes('£')) {
        statusBadge.textContent = '취소 £';
      }
      return;
    }

    const [hours, minutes] = timeText.split(':');
    const [month, day] = dateStr.split('.');
    const gameDateTime = new Date(now.getFullYear(), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
    const gameEndTime = new Date(gameDateTime.getTime() + 4 * 60 * 60 * 1000);

    let newStatus = statusBadge.textContent.replace(' ♤', '').replace(' ¢', '').replace(' £', '');
    let newClass = card.className.replace('schedule__game ', '').trim();

    if (statusBadge.textContent.includes('종료')) {
      newStatus = '종료 ♤';
      newClass = 'schedule__game--finished';
    } else if (now >= gameDateTime && now < gameEndTime) {
      newStatus = '진행중 ♧';
      newClass = 'schedule__game--live';
    } else if (now < gameDateTime) {
      newStatus = '예정 ¢';
      newClass = 'schedule__game--scheduled';
    }

    if (statusBadge.textContent !== newStatus) {
      statusBadge.textContent = newStatus;
      card.className = 'schedule__game ' + newClass;

      const scoreDiv = card.querySelector('.schedule__score');
      if (scoreDiv) {
        scoreDiv.className = 'schedule__score ' + newClass;
      }
    }
  });
}

setInterval(updateGameStatuses, 1000);
