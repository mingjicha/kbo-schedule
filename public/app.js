const scheduleContainer = document.getElementById('scheduleContainer');
const monthTabsContainer = document.getElementById('monthTabsContainer');
const teamTabs = document.querySelectorAll('.team-tab');
const yearDisplay = document.getElementById('yearDisplay');
const calendarBtn = document.getElementById('calendarBtn');
const calendarInput = document.getElementById('calendarInput');
const prevYearBtn = document.getElementById('prevYearBtn');
const nextYearBtn = document.getElementById('nextYearBtn');
const todayBtn = document.getElementById('todayBtn');

let currentTeam = '';
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let currentDay = null;
let calendarYear = currentYear;
let calendarMonth = currentMonth;
let selectedDate = null;
let loadedMonths = new Set();

const teamLogos = {
  'LG': '/team/LG.png',
  '한화': '/team/HH.png',
  'SSG': '/team/SK.png',
  '삼성': '/team/SS.png',
  'NC': '/team/NC.png',
  'KT': '/team/KT.png',
  '롯데': '/team/LT.png',
  'KIA': '/team/HT.png',
  '두산': '/team/OB.png',
  '키움': '/team/WO.png'
};

const today = new Date();
const todayStr = String(today.getMonth() + 1).padStart(2, '0') + '.' + String(today.getDate()).padStart(2, '0');
const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
const todayDayName = dayNames[today.getDay()];
const todayDateDisplay = `${todayStr}(${todayDayName})`;

let fpInstance = null;

function initializeFlatpickr() {
  if (!window.flatpickr) {
    console.error('Flatpickr not loaded');
    return;
  }

  const today = new Date();
  fpInstance = window.flatpickr(calendarInput, {
    mode: 'single',
    locale: 'ko',
    dateFormat: 'Y-m-d',
    defaultDate: today,
    position: 'below center',
    onChange: (selectedDates) => {
      if (selectedDates.length > 0) {
        const date = selectedDates[0];
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        currentMonth = parseInt(month);
        currentYear = date.getFullYear();
        currentDay = date.getDate();
        yearDisplay.textContent = currentYear;
        const dateStr = month + '.' + day;
        loadScheduleWithScroll(dateStr);
        fpInstance.close();
      }
    }
  });

  calendarBtn.addEventListener('click', (e) => {
    e.preventDefault();

    // 달력 열 때마다 현재 데이터로 disabled dates 업데이트
    if (window.currentScheduleData) {
      updateCalendarDisabledDates(window.currentScheduleData);
    }

    fpInstance.open();

    setTimeout(() => {
      const calendar = document.querySelector('.flatpickr-calendar');
      if (calendar) {
        const btnRect = calendarBtn.getBoundingClientRect();
        calendar.style.position = 'fixed';
        calendar.style.left = (btnRect.left - (calendar.offsetWidth - btnRect.width) / 2) + 'px';
        calendar.style.top = (btnRect.bottom + 8) + 'px';
      }
    }, 0);
  });
}

prevYearBtn.addEventListener('click', () => {
  currentYear--;
  calendarYear = currentYear;
  yearDisplay.textContent = currentYear;
  loadSchedule();
});

nextYearBtn.addEventListener('click', () => {
  currentYear++;
  calendarYear = currentYear;
  yearDisplay.textContent = currentYear;
  loadSchedule();
});

todayBtn.addEventListener('click', () => {
  const today = new Date();
  currentYear = today.getFullYear();
  currentMonth = today.getMonth() + 1;
  calendarYear = currentYear;
  calendarMonth = currentMonth;
  yearDisplay.textContent = currentYear;
  loadSchedule();
});

function renderSkeletonLoader() {
  const skeletonCard = `
    <div class="game-card scheduled">
      <div class="game-info">
        <div class="skeleton-time"></div>
        <div class="skeleton-stadium"></div>
        <div class="game-teams">
          <div class="team-container">
            <span class="skeleton-team-name"></span>
            <div class="skeleton-pitcher"></div>
          </div>
          <div class="skeleton-logo"></div>
          <div class="skeleton-score"></div>
          <div class="skeleton-logo"></div>
          <div class="team-container">
            <span class="skeleton-team-name"></span>
            <div class="skeleton-pitcher"></div>
          </div>
        </div>
      </div>
      <div class="skeleton-status"></div>
    </div>
  `;

  const skeletonDay = `
    <div class="day-group">
      <h3 class="skeleton-date"></h3>
      ${skeletonCard}
      ${skeletonCard}
      ${skeletonCard}
      ${skeletonCard}
      ${skeletonCard}
    </div>
  `;

  const skeletonHTML = `
    <div class="loading">
      <div class="game-list">
        ${skeletonDay}
        ${skeletonDay}
        ${skeletonDay}
        ${skeletonDay}
        ${skeletonDay}
      </div>
      <div class="loading-message">불러온다냥£ <span class="dots"></span></div>
    </div>
  `;
  return skeletonHTML;
}

async function loadScheduleWithScroll(scrollToDate) {
  loadedMonths.clear();

  await initializeMonthTabsWithLazyLoad();
  scheduleContainer.innerHTML = renderSkeletonLoader();

  try {
    const defaultMonthStr = String(currentMonth).padStart(2, '0');
    const defaultSchedule = await loadMonthData(currentMonth);

    window.currentScheduleData = defaultSchedule;
    loadedMonths.add(defaultMonthStr);

    if (defaultSchedule.length === 0) {
      scheduleContainer.innerHTML = '<div class="no-games">경기 일정이 없습니다.</div>';
      return;
    }

    scheduleContainer.innerHTML = '';
    const gameList = renderGamesByMonth(defaultSchedule, scrollToDate);
    scheduleContainer.appendChild(gameList);

    updateCalendarDisabledDates(defaultSchedule);
  } catch (error) {
    console.error('Error loading schedule:', error);
    scheduleContainer.innerHTML = '<div class="no-games">일정을 불러올 수 없습니다.</div>';
  }
}

async function loadSchedule() {
  loadedMonths.clear();

  await initializeMonthTabsWithLazyLoad();
  scheduleContainer.innerHTML = renderSkeletonLoader();

  try {
    const defaultMonthStr = String(currentMonth).padStart(2, '0');
    const defaultSchedule = await loadMonthData(currentMonth);

    window.currentScheduleData = defaultSchedule;
    loadedMonths.add(defaultMonthStr);

    if (defaultSchedule.length === 0) {
      scheduleContainer.innerHTML = '<div class="no-games">경기 일정이 없습니다.</div>';
      return;
    }

    scheduleContainer.innerHTML = '';
    const gameList = renderGamesByMonth(defaultSchedule);
    scheduleContainer.appendChild(gameList);

    updateCalendarDisabledDates(defaultSchedule);
  } catch (error) {
    console.error('Error loading schedule:', error);
    scheduleContainer.innerHTML = '<div class="no-games">일정을 불러올 수 없습니다.</div>';
  }
}

function updateCalendarDisabledDates(schedule) {
  if (!fpInstance) return;

  // 경기가 있는 날짜 추출
  const gameDates = new Set();
  schedule.forEach(game => {
    const dateMatch = game.date.match(/(\d{2})\.(\d{2})/);
    if (dateMatch) {
      const month = dateMatch[1];
      const day = dateMatch[2];
      gameDates.add(`${currentYear}-${month}-${day}`);
    }
  });

  // 달력 disable 설정 업데이트
  fpInstance.set('disable', [
    function(date) {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return !gameDates.has(dateStr);
    }
  ]);
}

function groupByMonth(schedule) {
  const groups = {};
  schedule.forEach(game => {
    const date = game.date;
    const month = date.split('.')[0];
    if (!groups[month]) {
      groups[month] = [];
    }
    groups[month].push(game);
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

function renderMonthTabs(schedule) {
  const grouped = groupByMonth(schedule);
  const months = Object.keys(grouped).sort();

  const tabContainer = document.createElement('div');
  tabContainer.className = 'month-tabs';

  months.forEach(month => {
    const tab = document.createElement('button');
    tab.className = 'month-tab';
    const monthNum = parseInt(month);
    tab.textContent = monthNum + '월';
    tab.dataset.month = month;

    if (month === String(currentMonth).padStart(2, '0')) {
      tab.classList.add('active');
    }

    tab.addEventListener('click', () => {
      document.querySelectorAll('.month-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedDate = null;
      renderGamesByMonth(grouped[month]);
    });

    tabContainer.appendChild(tab);
  });

  return tabContainer;
}

async function fetchGameDetail(gameId) {
  try {
    const apiUrl = `http://${window.location.hostname}:5000/api/game-detail/${gameId}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching game detail:', error);
    return null;
  }
}

function getGameStatus(game) {
  // 1. 서버에서 이미 취소로 설정된 경기 - 최우선
  if (game.status === '취소') {
    return '취소';
  }

  // 2. note에 취소 관련 문구가 있으면 취소 (우천취소, 기타 등) - 두 번째 우선
  const noteText = game.note ? game.note.replace(/<[^>]*>/g, '').trim() : '';
  if (noteText === '취소' || noteText === '우천취소' || noteText === '기타' ||
      noteText.includes('취소') || noteText.includes('우천')) {
    return '취소';
  }

  // 점수가 없는 경우만 시간 기반 판정
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const gameDate = game.date.split('(')[0];
  const [month, day] = gameDate.split('.');
  const [hours, minutes] = game.time.split(':');

  // 현재 시스템 연도와 비교 (경기가 어느 연도인지 고려)
  const gameDateTime = new Date(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
  const gameDateOnly = new Date(currentYear, parseInt(month) - 1, parseInt(day));

  // 게임 날짜(연도 포함)가 오늘보다 전이면 과거 경기
  if (gameDateOnly.getTime() < today.getTime()) {
    if (game.awayScore === null && game.homeScore === null) {
      return '취소';
    }
    return '종료';
  }

  // 게임 날짜(연도 포함)가 오늘과 같으면 시간으로 비교
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

  // 게임 날짜(연도 포함)가 미래면 예정
  if (gameDateOnly.getTime() > today.getTime()) {
    return '예정';
  }

  return '종료';
}

function renderGamesByMonth(games, scrollToDate = null) {
  const grouped = groupByDate(games);
  const gameList = document.createElement('div');
  gameList.className = 'game-list';
  gameList.style.marginTop = '1.5rem';

  Object.keys(grouped).forEach(date => {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'day-group';

    const dateOnly = date.split('(')[0];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const gameDate = new Date(currentYear, parseInt(dateOnly.split('.')[0]) - 1, parseInt(dateOnly.split('.')[1]));
    const isToday = gameDate.getTime() === today.getTime();

    if (isToday) {
      dayDiv.classList.add('today');
    }

    const header = document.createElement('div');
    header.className = 'day-header';
    header.setAttribute('data-date', dateOnly);

    const formattedDate = formatDateDisplay(date);
    if (isToday) {
      header.classList.add('today');
      header.innerHTML = `${formattedDate} <span class="today-badge">오늘</span>`;
    } else {
      header.textContent = formattedDate;
    }
    dayDiv.appendChild(header);

    grouped[date].forEach(game => {
      const gameCard = document.createElement('div');
      gameCard.className = 'game-card';

      const finalStatus = getGameStatus(game);
      const statusClass =
        finalStatus === '종료' ? 'finished' :
        finalStatus === '취소' ? 'cancelled' :
        finalStatus === '진행중' ? 'live' : 'scheduled';
      gameCard.classList.add(statusClass);

      const gameInfo = document.createElement('div');
      gameInfo.className = 'game-info';

      const timeDiv = document.createElement('div');
      timeDiv.className = 'game-time';
      timeDiv.textContent = game.time || '시간미정';
      gameInfo.appendChild(timeDiv);

      const stadiumDiv = document.createElement('div');
      stadiumDiv.className = 'stadium';
      stadiumDiv.textContent = game.stadium || '';
      gameInfo.appendChild(stadiumDiv);

      const teamsDiv = document.createElement('div');
      teamsDiv.className = 'game-teams';

      // Away team container
      const awayTeamContainer = document.createElement('div');
      awayTeamContainer.className = 'team-container';

      const awayTeam = document.createElement('span');
      awayTeam.className = 'team-name';
      awayTeam.textContent = game.awayTeam;
      awayTeamContainer.appendChild(awayTeam);

      if (game.awayPitcher && game.awayPitcher !== 'N/A') {
        const awayPitcher = document.createElement('div');
        awayPitcher.className = 'pitcher';

        const awayPitcherText = document.createElement('span');
        awayPitcherText.textContent = `선 ${game.awayPitcher}`;
        awayPitcher.appendChild(awayPitcherText);

        if (statusClass === 'finished') {
          awayPitcher.classList.add(game.winner === 'away' ? 'win' : 'loss');
          if (game.winner === 'away') {
            const awaysvgIcon = document.createElement('span');
            awaysvgIcon.className = 'pitcher-icon';
            awaysvgIcon.textContent = '🏅';
            awayPitcher.appendChild(awaysvgIcon);
          }
        }

        awayTeamContainer.appendChild(awayPitcher);
      }

      teamsDiv.appendChild(awayTeamContainer);

      // Away team logo
      const awayLogo = document.createElement('img');
      awayLogo.className = 'team-logo';
      awayLogo.src = teamLogos[game.awayTeam] || '';
      awayLogo.alt = game.awayTeam;
      teamsDiv.appendChild(awayLogo);

      const scoreContainer = document.createElement('div');
      scoreContainer.className = 'score-container';

      const scoreDiv = document.createElement('div');
      scoreDiv.className = 'score ' + statusClass;
      scoreDiv.id = `score-${game.awayTeam}-${game.homeTeam}-${game.time}`;
      if (game.awayScore !== null && game.homeScore !== null) {
        scoreDiv.textContent = `${game.awayScore} : ${game.homeScore}`;
      } else {
        scoreDiv.textContent = 'vs';
      }
      scoreContainer.appendChild(scoreDiv);

      // 진행중일 때 이닝 정보 표시
      if (statusClass === 'live' && game.gameId) {
        const inningDiv = document.createElement('div');
        inningDiv.className = 'inning-info';
        inningDiv.id = `inning-${game.gameId}`;
        inningDiv.textContent = '로딩중...';
        scoreContainer.appendChild(inningDiv);

        // 진행중인 경기 정보 조회 (한 번만)
        fetchGameDetail(game.gameId).then(data => {
          if (data && data.inning) {
            const inningText = `${data.inning}${data.inningSide === '초' ? '회초' : '회말'}`;
            inningDiv.textContent = inningText;
          } else {
            inningDiv.textContent = '경기 정보 없음';
          }
        });
      }

      teamsDiv.appendChild(scoreContainer);

      // Home team logo
      const homeLogo = document.createElement('img');
      homeLogo.className = 'team-logo';
      homeLogo.src = teamLogos[game.homeTeam] || '';
      homeLogo.alt = game.homeTeam;
      teamsDiv.appendChild(homeLogo);

      // Home team container
      const homeTeamContainer = document.createElement('div');
      homeTeamContainer.className = 'team-container';

      const homeTeam = document.createElement('span');
      homeTeam.className = 'team-name';
      homeTeam.textContent = game.homeTeam;
      homeTeamContainer.appendChild(homeTeam);

      if (game.homePitcher && game.homePitcher !== 'N/A') {
        const homePitcher = document.createElement('div');
        homePitcher.className = 'pitcher';

        const homePitcherText = document.createElement('span');
        homePitcherText.textContent = `선 ${game.homePitcher}`;
        homePitcher.appendChild(homePitcherText);

        if (statusClass === 'finished') {
          homePitcher.classList.add(game.winner === 'home' ? 'win' : 'loss');
          if (game.winner === 'home') {
            const homesvgIcon = document.createElement('span');
            homesvgIcon.className = 'pitcher-icon';
            homesvgIcon.textContent = '🏅';
            homePitcher.appendChild(homesvgIcon);
          }
        }

        homeTeamContainer.appendChild(homePitcher);
      }

      teamsDiv.appendChild(homeTeamContainer);

      gameInfo.appendChild(teamsDiv);

      gameCard.appendChild(gameInfo);

      const statusBadge = document.createElement('div');
      statusBadge.className = 'status-badge ' + statusClass;

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

      gameCard.appendChild(statusBadge);

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

function renderSchedule(schedule) {
  scheduleContainer.innerHTML = '';

  let gamesToRender = schedule;

  if (selectedDate) {
    gamesToRender = schedule.filter(game => game.date.startsWith(selectedDate));
  }

  if (gamesToRender.length === 0) {
    scheduleContainer.innerHTML = '<div class="no-games">해당 날짜에 경기가 없습니다.</div>';
    return;
  }

  const grouped = groupByMonth(gamesToRender);
  const defaultMonth = String(currentMonth).padStart(2, '0');
  const defaultGames = grouped[defaultMonth] || Object.values(grouped)[0] || [];

  const gameList = renderGamesByMonth(defaultGames);
  scheduleContainer.appendChild(gameList);
}

function initializeMonthTabs(months) {
  const tabContainer = document.createElement('div');
  tabContainer.className = 'month-tabs';

  months.forEach(month => {
    const tab = document.createElement('button');
    tab.className = 'month-tab';
    const monthNum = parseInt(month);
    tab.textContent = monthNum + '월';
    tab.dataset.month = month;

    if (month === String(currentMonth).padStart(2, '0')) {
      tab.classList.add('active');
    }

    tab.addEventListener('click', () => {
      document.querySelectorAll('.month-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedDate = null;
      const allMonthTabs = document.querySelectorAll('.month-tab');
      let gamesForMonth = [];
      allMonthTabs.forEach(t => {
        if (t.dataset.month === month) {
          const grouped = groupByMonth(window.currentScheduleData || []);
          gamesForMonth = grouped[month] || [];
        }
      });
      if (gamesForMonth.length > 0) {
        scheduleContainer.innerHTML = '';
        const gameList = renderGamesByMonth(gamesForMonth);
        scheduleContainer.appendChild(gameList);
      }
    });

    tabContainer.appendChild(tab);
  });

  monthTabsContainer.innerHTML = '';
  monthTabsContainer.appendChild(tabContainer);
}

teamTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    teamTabs.forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    currentTeam = e.target.dataset.team;
    loadSchedule();
  });
});

function updateGameStatuses() {
  const gameCards = document.querySelectorAll('.game-card');
  const now = new Date();

  gameCards.forEach(card => {
    const timeText = card.querySelector('.game-time').textContent;
    const statusBadge = card.querySelector('.status-badge');
    const dayHeader = card.closest('.day-group').querySelector('.day-header');
    const dateStr = dayHeader.getAttribute('data-date');

    if (!timeText || timeText === '시간미정') return;

    // 취소 상태는 절대로 변경하지 않음, 심볼만 추가
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
    let newClass = card.className.replace('game-card ', '').trim();

    if (statusBadge.textContent.includes('종료')) {
      newStatus = '종료 ♤';
      newClass = 'finished';
    } else if (now >= gameDateTime && now < gameEndTime) {
      newStatus = '진행중 ♧';
      newClass = 'live';
    } else if (now < gameDateTime) {
      newStatus = '예정 ¢';
      newClass = 'scheduled';
    }

    if (statusBadge.textContent !== newStatus) {
      statusBadge.textContent = newStatus;
      card.className = 'game-card ' + newClass;

      const scoreDiv = card.querySelector('.score');
      if (scoreDiv) {
        scoreDiv.className = 'score ' + newClass;
      }
    }
  });
}

setInterval(updateGameStatuses, 1000);

window.currentScheduleData = [];

async function loadMonthData(month) {
  const monthStr = String(month).padStart(2, '0');
  const apiUrl = `http://${window.location.hostname}:5000/api/schedule?year=${currentYear}&month=${monthStr}&team=${currentTeam}`;
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
  const tabContainer = document.createElement('div');
  tabContainer.className = 'month-tabs';

  for (let month = 3; month <= 10; month++) {
    const tab = document.createElement('button');
    tab.className = 'month-tab';
    tab.textContent = month + '월';
    tab.dataset.month = String(month).padStart(2, '0');

    if (month === currentMonth) {
      tab.classList.add('active');
    }

    tab.addEventListener('click', async (e) => {
      document.querySelectorAll('.month-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedDate = null;

      const monthNum = String(month).padStart(2, '0');
      let gamesForMonth = [];

      if (!loadedMonths.has(monthNum)) {
        scheduleContainer.innerHTML = renderSkeletonLoader();
        gamesForMonth = await loadMonthData(month);
        if (!window.currentScheduleData) {
          window.currentScheduleData = [];
        }
        window.currentScheduleData = window.currentScheduleData.concat(gamesForMonth);
        loadedMonths.add(monthNum);
      } else {
        const grouped = groupByMonth(window.currentScheduleData || []);
        gamesForMonth = grouped[monthNum] || [];
      }

      if (gamesForMonth.length > 0) {
        scheduleContainer.innerHTML = '';
        const gameList = renderGamesByMonth(gamesForMonth);
        scheduleContainer.appendChild(gameList);
      } else {
        scheduleContainer.innerHTML = '<div class="no-games">경기 일정이 없습니다.</div>';
      }
    });

    tabContainer.appendChild(tab);
  }

  monthTabsContainer.innerHTML = '';
  monthTabsContainer.appendChild(tabContainer);
}

async function initializeApp() {
  yearDisplay.textContent = currentYear;
  initializeFlatpickr();

  try {
    const defaultMonthStr = String(currentMonth).padStart(2, '0');

    await initializeMonthTabsWithLazyLoad();
    scheduleContainer.innerHTML = renderSkeletonLoader();

    const defaultSchedule = await loadMonthData(currentMonth);
    window.currentScheduleData = defaultSchedule;
    loadedMonths.add(defaultMonthStr);

    const gameList = renderGamesByMonth(defaultSchedule);
    scheduleContainer.innerHTML = '';
    scheduleContainer.appendChild(gameList);
  } catch (error) {
    console.error('Error initializing app:', error);
    scheduleContainer.innerHTML = '<div class="no-games">일정을 불러올 수 없습니다.</div>';
  }
}

initializeApp();
