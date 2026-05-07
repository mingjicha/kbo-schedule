const scheduleContainer = document.getElementById('scheduleContainer');
const monthTabsContainer = document.getElementById('monthTabsContainer');
const teamTabs = document.querySelectorAll('.filter__btn');
const yearDisplay = document.getElementById('yearDisplay');
const calendarBtn = document.getElementById('calendarBtn');
const calendarInput = document.getElementById('calendarInput');
const prevYearBtn = document.getElementById('prevYearBtn');
const nextYearBtn = document.getElementById('nextYearBtn');
const todayBtn = document.getElementById('todayBtn');
const scrollTopBtn = document.getElementById('scrollTopBtn');
const quickMenuItems = document.querySelectorAll('.quick-menu__item');

let currentTeam = '';
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let currentDay = null;
let selectedDate = null;
let loadedMonths = new Set();

const teamLogos = {
  'LG': '/images/team/LG.png',
  '한화': '/images/team/HH.png',
  'SSG': '/images/team/SK.png',
  '삼성': '/images/team/SS.png',
  'NC': '/images/team/NC.png',
  'KT': '/images/team/KT.png',
  '롯데': '/images/team/LT.png',
  'KIA': '/images/team/HT.png',
  '두산': '/images/team/OB.png',
  '키움': '/images/team/WO.png'
};

const teamLogosDetail = {
  'LG': '/images/logos/initial_LG_s.png',
  '한화': '/images/logos/initial_HH_s.png',
  'SSG': '/images/logos/initial_SK_s.png',
  '삼성': '/images/logos/initial_SS_s.png',
  'NC': '/images/logos/initial_NC_s.png',
  'KT': '/images/logos/initial_KT_s.png',
  '롯데': '/images/logos/initial_LT_s.png',
  'KIA': '/images/logos/initial_HT_s.png',
  '두산': '/images/logos/initial_OB_s.png',
  '키움': '/images/logos/initial_WO_s.png'
};

const teamColors = {
  'LG': '#C8102E',
  '한화': '#F37222',
  'SSG': '#E50021',
  '삼성': '#0066B3',
  'NC': '#00275A',
  'KT': '#000000',
  '롯데': '#00295F',
  'KIA': '#00205B',
  '두산': '#131F43',
  '키움': '#A60134'
};

const today = new Date();
const todayStr = String(today.getMonth() + 1).padStart(2, '0') + '.' + String(today.getDate()).padStart(2, '0');
const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
const todayDayName = dayNames[today.getDay()];
const todayDateDisplay = `${todayStr}(${todayDayName})`;

let fpInstance = null;
let calendarGameDatesCache = {};
let calendarDisplayMonth = currentMonth;
let calendarDisplayYear = currentYear;

async function loadCalendarGameDates(year, month) {
  const cacheKey = `${year}-${String(month).padStart(2, '0')}`;
  if (calendarGameDatesCache[cacheKey]) {
    return calendarGameDatesCache[cacheKey];
  }

  const gameDates = new Set();
  try {
    const monthData = await loadMonthData(month, year);
    monthData.forEach(game => {
      const dateMatch = game.date.match(/(\d{2})\.(\d{2})/);
      if (dateMatch) {
        const gameMonth = dateMatch[1];
        const day = dateMatch[2];
        gameDates.add(`${year}-${gameMonth}-${day}`);
      }
    });
  } catch (error) {
    console.error(`Error loading data for month ${month}:`, error);
  }
  calendarGameDatesCache[cacheKey] = gameDates;
  return gameDates;
}

function initializeFlatpickr() {
  if (!window.flatpickr) {
    console.error('Flatpickr not loaded');
    return;
  }

  const today = new Date();
  calendarDisplayYear = today.getFullYear();
  calendarDisplayMonth = today.getMonth() + 1;

  fpInstance = window.flatpickr(calendarInput, {
    mode: 'single',
    locale: 'ko',
    dateFormat: 'Y-m-d',
    defaultDate: today,
    position: 'below center',
    onChange: async (selectedDates) => {
      if (selectedDates.length > 0) {
        const date = selectedDates[0];
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        // 달력에서 선택한 날짜의 연도 사용
        currentMonth = parseInt(month);
        currentYear = date.getFullYear();
        currentDay = date.getDate();
        yearDisplay.textContent = currentYear;
        const dateStr = month + '.' + day;
        loadSchedule(dateStr);
        fpInstance.close();
      }
    },
    onOpen: async () => {
      const gameDates = await loadCalendarGameDates(calendarDisplayYear, calendarDisplayMonth);
      if (fpInstance && gameDates.size > 0) {
        fpInstance.set('disable', [
          function(date) {
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return !gameDates.has(dateStr);
          }
        ]);
      }
    },
    onMonthChange: async (selectedDates, dateStr, instance) => {
      const newMonth = instance.currentMonth + 1;
      const newYear = instance.currentYear;

      calendarDisplayMonth = newMonth;
      calendarDisplayYear = newYear;

      const gameDates = await loadCalendarGameDates(newYear, newMonth);
      if (fpInstance && gameDates.size > 0) {
        fpInstance.set('disable', [
          function(date) {
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return !gameDates.has(dateStr);
          }
        ]);
      }
    }
  });

  calendarBtn.addEventListener('click', (e) => {
    e.preventDefault();

    // 달력 표시를 현재 연도로 초기화
    calendarDisplayYear = currentYear;
    calendarDisplayMonth = currentMonth;
    fpInstance.setDate(today);
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
  yearDisplay.textContent = currentYear;
  loadSchedule();
});

nextYearBtn.addEventListener('click', () => {
  currentYear++;
  yearDisplay.textContent = currentYear;
  loadSchedule();
});

async function goToToday() {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  currentYear = todayYear;
  currentMonth = todayMonth;
  yearDisplay.textContent = currentYear;
  currentTeam = '';

  // 월 탭 활성화
  document.querySelectorAll('.nav__tab').forEach(t => t.classList.remove('active'));
  const monthStr = String(todayMonth).padStart(2, '0');
  const activeTab = document.querySelector(`.nav__tab[data-month="${monthStr}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  // 팀 필터 초기화
  document.querySelectorAll('.filter__btn').forEach(btn => btn.classList.remove('active'));
  const allTeamBtn = document.querySelector('.filter__btn[data-team=""]');
  if (allTeamBtn) {
    allTeamBtn.classList.add('active');
  }

  // 로딩 표시
  scheduleContainer.innerHTML = renderSkeletonLoader();

  try {
    const todaySchedule = await loadMonthData(todayMonth, todayYear);

    if (todaySchedule.length === 0) {
      scheduleContainer.innerHTML = '<div class="schedule__no-games">오늘 경기 일정이 없습니다.</div>';
      return;
    }

    window.currentScheduleData = todaySchedule;
    scheduleContainer.innerHTML = '';
    const gameList = renderGamesByMonth(todaySchedule, null, todayYear);
    scheduleContainer.appendChild(gameList);

    // 오늘 날짜로 스크롤
    setTimeout(() => {
      const todayDateStr = `${String(todayMonth).padStart(2, '0')}.${String(todayDay).padStart(2, '0')}`;
      const allDays = document.querySelectorAll('.schedule__day');
      for (let dayDiv of allDays) {
        const header = dayDiv.querySelector('.schedule__date-header');
        if (header && header.getAttribute('data-date').startsWith(todayDateStr)) {
          dayDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        }
      }
    }, 100);
  } catch (error) {
    console.error('Error loading today schedule:', error);
    scheduleContainer.innerHTML = '<div class="schedule__no-games">일정을 불러올 수 없습니다.</div>';
  }
}

todayBtn.addEventListener('click', goToToday);

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

function renderGamesByMonth(games, scrollToDate = null, year = currentYear) {
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
      // 팀 필터 적용
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

      // Home team container
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

      // Home team logo
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

      // 진행중일 때 이닝 정보 표시
      if (statusClass === 'schedule__game--live' && game.gameId) {
        const inningDiv = document.createElement('div');
        inningDiv.className = 'schedule__inning-info';
        inningDiv.id = `inning-${game.gameId}`;
        inningDiv.textContent = '로딩 중이다냥! †';
        scoreContainer.appendChild(inningDiv);

        // 진행중인 경기 정보 조회
        fetchGameDetail(game.gameId).then(data => {
          if (data) {
            // 점수 업데이트
            if (data.awayScore !== undefined && data.homeScore !== undefined) {
              scoreDiv.textContent = `${data.homeScore} : ${data.awayScore}`;
            }
            // 이닝 정보 업데이트
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

      // Away team logo
      const awayLogo = document.createElement('img');
      awayLogo.className = 'schedule__logo';
      awayLogo.src = teamLogos[game.awayTeam] || '';
      awayLogo.alt = game.awayTeam;
      teamsDiv.appendChild(awayLogo);

      // Away team container
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
        const isToday = gameDateTime.getTime() === today.getTime();

        // 오늘 경기가 아니면 모달을 열지 않음
        if (!isToday) return;

        gameDetailContainer.innerHTML = '<div class="modal__no-data">로딩 중이다냥! †</div>';
        gameDetailModal.classList.add('show');

        try {
          gameDetailTitle.innerHTML = '<h3><span class="modal__badge">Preview</span></h3>';
          gameDetailContainer.innerHTML = ''; // 기존 내용 삭제

          if (isToday) {
            // 탭 구조 생성
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

            // 탭 전환 이벤트
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



async function applyTeamFilter() {
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

teamTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    teamTabs.forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    currentTeam = e.target.dataset.team;
    applyTeamFilter();
  });
});

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

// Scroll To Top Button
window.addEventListener('scroll', () => {
  if (window.scrollY > 300) {
    scrollTopBtn.classList.add('show');
  } else {
    scrollTopBtn.classList.remove('show');
  }
});

scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
});

async function handleQuickMenuAction(action) {
  if (action === 'today') {
    await goToToday();
  } else if (action === 'rank') {
    const rankModal = document.getElementById('rankModal');
    if (!rankModal.classList.contains('show')) {
      await loadTeamRank();
    }
    rankModal.classList.toggle('show');
  } else if (action === 'weather') {
    const weatherModal = document.getElementById('weatherModal');
    if (!weatherModal.classList.contains('show')) {
      await loadWeather();
    }
    weatherModal.classList.toggle('show');
  }
}

quickMenuItems.forEach(item => {
  item.addEventListener('click', () => {
    const action = item.dataset.action;
    handleQuickMenuAction(action);
  });
});

window.currentScheduleData = [];

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

// 경기장명 → 표시 이름 매핑
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
  '청주': '청주'
};

// WMO 코드 → 아이콘 매핑
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

let weatherCache = null;

async function loadWeather(forceRefresh = false) {
  const weatherContainer = document.getElementById('weatherContainer');
  const weatherDate = document.getElementById('weatherDate');

  try {
    // 캐시가 있고 강제 새로고침이 아니면 캐시된 데이터 사용
    if (weatherCache && !forceRefresh) {
      renderWeatherCards(weatherCache);
      return;
    }

    // 로딩 스피너 표시 (강제 새로고침 시에도 표시)
    weatherContainer.innerHTML = '<div class="loading"><div class="spinner-border" role="status"><span class="visually-hidden">로딩 중이다냥! †</span></div></div>';

    // 오늘 경기가 있는 경기장 추출
    const today = new Date();
    const todayStr = String(today.getMonth() + 1).padStart(2, '0') + '.' + String(today.getDate()).padStart(2, '0');
    const todayYear = today.getFullYear();

    // currentScheduleData에서 오늘 경기장 찾기
    const stadiums = new Set();
    if (window.currentScheduleData && Array.isArray(window.currentScheduleData)) {
      window.currentScheduleData.forEach(game => {
        // 경기 날짜가 오늘인지 확인 (연도 고려)
        const gameDate = game.date.split('(')[0]; // "04.30(화)" → "04.30"
        if (gameDate === todayStr) {
          // stadium 필드에서 경기장명 추출 (예: "잠실야구장" → "잠실")
          if (game.stadium) {
            const stadiumKey = Object.keys(stadiumNames).find(key => game.stadium.includes(key));
            if (stadiumKey) stadiums.add(stadiumKey);
          }
        }
      });
    }

    // 기준 날짜 표시 (0 제거)
    const month = today.getMonth() + 1;
    const day = today.getDate();
    weatherDate.textContent = `${todayYear}년 ${month}월 ${day}일 기준`;

    if (stadiums.size === 0) {
      weatherContainer.innerHTML = '<div class="modal__no-weather-data">오늘 예정된 경기가 없습니다.</div>';
      return;
    }

    // 각 경기장의 날씨 데이터 가져오기
    const weatherDataList = [];
    for (const stadium of stadiums) {
      try {
        const response = await fetch(`/api/weather?stadium=${encodeURIComponent(stadium)}`);
        const data = await response.json();
        weatherDataList.push(data);
      } catch (error) {
        console.error(`날씨 조회 실패: ${stadium}`, error);
      }
    }

    if (weatherDataList.length === 0) {
      weatherContainer.innerHTML = '<div class="modal__no-weather-data">날씨 정보를 불러올 수 없습니다.</div>';
      return;
    }

    // 캐시에 저장
    weatherCache = weatherDataList;

    // 날씨 카드 렌더링
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
  const refreshRankBtn = document.getElementById('refreshRankBtn');

  try {
    rankTableContainer.innerHTML = '<div class="loading"><div class="spinner-border" role="status"><span class="visually-hidden">로딩 중이다냥! †</span></div></div>';

    const response = await fetch('/api/team-rank');
    const data = await response.json();

    // 날짜 형식 변환: "2026년 0505월05일 기준" → "2026년 5월 5일 기준"
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

async function initializeApp() {
  yearDisplay.textContent = currentYear;
  initializeFlatpickr();

  try {
    const defaultMonthStr = String(currentMonth).padStart(2, '0');

    await initializeMonthTabsWithLazyLoad();

    const defaultSchedule = await loadMonthData(currentMonth);
    window.currentScheduleData = defaultSchedule;
    loadedMonths.add(defaultMonthStr);

    const gameList = renderGamesByMonth(defaultSchedule, null, currentYear);
    scheduleContainer.innerHTML = '';
    scheduleContainer.appendChild(gameList);

    // 페이지 로드 시 날씨 데이터 사전 로드
    await loadWeather();
  } catch (error) {
    console.error('Error initializing app:', error);
    scheduleContainer.innerHTML = '<div class="schedule__no-games">일정을 불러올 수 없습니다.</div>';
  }
}

initializeApp();

async function loadPitcherComparison(game, container) {
  try {
    // 테스트 데이터 (비활성화 - Puppeteer API 사용)
    if (false && game.gameId === '20260507OBLG0') {
      const html = `
        <div class="game-detail__pitchers">
          <div class="game-detail__pitcher-card">
            <div class="game-detail__pitcher-header">
              <table class="game-detail__stats-table">
                <thead>
                  <tr>
                    <th class="pitcher-info-col">선발투수</th>
                    <th>경기</th>
                    <th>평균자책점</th>
                    <th>선발평균이닝</th>
                    <th>QS</th>
                    <th>WAR</th>
                    <th>WHIP</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="pitcher-info-col">
                      <div class="pitcher-info-with-logo">
                        <img src="${teamLogosDetail[game.awayTeam] || ''}" alt="${game.awayTeam}" class="pitcher-info-logo">
                        <div class="game-detail__pitcher-info">
                          <div class="game-detail__pitcher-name">
                            <div class="name-wrap">
                              <span class="name">최민석</span>
                              <span class="style">우투우타</span>
                            </div>
                            <div class="record">시즌 3승 0패<br></div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>6</td>
                    <td class="stat-highlight">2.67</td>
                    <td class="stat-highlight">5.2</td>
                    <td>4</td>
                    <td class="stat-highlight">0.69</td>
                    <td>1.37</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="game-detail__pitcher-card">
            <div class="game-detail__pitcher-header">
              <table class="game-detail__stats-table">
                <thead>
                  <tr>
                    <th class="pitcher-info-col">선발투수</th>
                    <th>경기</th>
                    <th>평균자책점</th>
                    <th>선발평균이닝</th>
                    <th>QS</th>
                    <th>WAR</th>
                    <th>WHIP</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="pitcher-info-col">
                      <div class="pitcher-info-with-logo">
                        <img src="${teamLogosDetail[game.homeTeam] || ''}" alt="${game.homeTeam}" class="pitcher-info-logo">
                        <div class="game-detail__pitcher-info">
                          <div class="game-detail__pitcher-name">
                            <div class="name-wrap">
                              <span class="name">톨허스트</span>
                              <span class="style">우투우타</span>
                            </div>
                            <div class="record">시즌 4승 1패<br></div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>6</td>
                    <td>3.90</td>
                    <td>5.1</td>
                    <td>4</td>
                    <td>0.47</td>
                    <td class="stat-highlight">1.33</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
      container.innerHTML = html;
      return;
    }

    // API에서 Puppeteer로 크롤링한 데이터 가져오기
    const response = await fetch(`/api/pitcher-stats?awayPitcher=${encodeURIComponent(game.awayPitcher)}&homePitcher=${encodeURIComponent(game.homePitcher)}&awayTeam=${encodeURIComponent(game.awayTeam)}&homeTeam=${encodeURIComponent(game.homeTeam)}&gameId=${encodeURIComponent(game.gameId)}&year=${currentYear}`);
    const data = await response.json();

    if (data.awayData || data.homeData) {
      // 통계 비교 함수
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
                          <img src="${teamLogosDetail[game.awayTeam] || ''}" alt="${game.awayTeam}" class="pitcher-info-logo">
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
                              <span class="style">${data.awayData.pitcherName.substring(data.awayData.pitcherName.indexOf(game.awayPitcher) + game.awayPitcher.length, data.awayData.pitcherName.indexOf('시즌') !== -1 ? data.awayData.pitcherName.indexOf('시즌') : data.awayData.pitcherName.length) || ''}</span>
                            </div>
                            <div class="record">${data.awayData.pitcherName.substring(data.awayData.pitcherName.indexOf('시즌') !== -1 ? data.awayData.pitcherName.indexOf('시즌') : data.awayData.pitcherName.length) || ''}</div>
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
                          <img src="${teamLogosDetail[game.homeTeam] || ''}" alt="${game.homeTeam}" class="pitcher-info-logo">
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
                              <span class="style">${data.homeData.pitcherName.substring(data.homeData.pitcherName.indexOf(game.homePitcher) + game.homePitcher.length, data.homeData.pitcherName.indexOf('시즌') !== -1 ? data.homeData.pitcherName.indexOf('시즌') : data.homeData.pitcherName.length) || ''}</span>
                            </div>
                            <div class="record">${data.homeData.pitcherName.substring(data.homeData.pitcherName.indexOf('시즌') !== -1 ? data.homeData.pitcherName.indexOf('시즌') : data.homeData.pitcherName.length) || ''}</div>
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
  } catch (error) {
    console.error('Error loading pitcher comparison:', error);
    container.innerHTML = '<div class="modal__no-data">투수 정보를 불러올 수 없다냥! †</div>';
  }
}

async function loadPitcherWPA(game, container) {
  try {
    const response = await fetch(`/api/pitcher-wpa?gameId=${encodeURIComponent(game.gameId)}&awayTeam=${encodeURIComponent(game.awayTeam)}&homeTeam=${encodeURIComponent(game.homeTeam)}`);
    const data = await response.json();

    if (data.awayWPA || data.homeWPA) {
      const html = `
        <div class="game-detail__wpa-container">
          ${data.awayWPA && data.awayWPA.length > 0 ? `
            <div class="game-detail__wpa-section">
              <div class="game-detail__team-section-header">
                <img src="${teamLogos[game.awayTeam] || ''}" alt="${game.awayTeam}" class="game-detail__team-logo-small">
                <span class="game-detail__team-name-small">${game.awayTeam}</span>
              </div>
              <table class="game-detail__wpa-table">
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>투수</th>
                    <th>WPA</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.awayWPA.slice(0, 5).map((pitcher, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${pitcher.name}</td>
                      <td>${pitcher.wpa}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          ${data.homeWPA && data.homeWPA.length > 0 ? `
            <div class="game-detail__wpa-section">
              <div class="game-detail__team-section-header">
                <img src="${teamLogos[game.homeTeam] || ''}" alt="${game.homeTeam}" class="game-detail__team-logo-small">
                <span class="game-detail__team-name-small">${game.homeTeam}</span>
              </div>
              <table class="game-detail__wpa-table">
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>투수</th>
                    <th>WPA</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.homeWPA.slice(0, 5).map((pitcher, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${pitcher.name}</td>
                      <td>${pitcher.wpa}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      `;
      container.innerHTML = html;
    } else {
      container.innerHTML = '<div class="modal__no-data">WPA 데이터를 찾을 수 없습니다.</div>';
    }
  } catch (error) {
    console.error('Error loading pitcher WPA:', error);
    container.innerHTML = '<div class="modal__no-data">WPA 정보를 불러올 수 없습니다.</div>';
  }
}

// 팀 순위 및 날씨 모달 컨트롤
document.addEventListener('DOMContentLoaded', () => {
  // 팀 순위 모달
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

  // 날씨 모달
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
