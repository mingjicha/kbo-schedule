let fpInstance = null;
let calendarGameDatesCache = {};
let calendarDisplayMonth = null;
let calendarDisplayYear = null;

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

// 이웃 달을 백그라운드로 미리 받아둔다 (화살표를 눌렀을 때 기다리지 않게)
function prefetchNeighborMonths(year, month) {
  [month - 1, month + 1].forEach(m => {
    if (m < 3 || m > 10) return;
    const key = `${year}-${String(m).padStart(2, '0')}`;
    if (calendarGameDatesCache[key]) return;
    loadCalendarGameDates(year, m).catch(() => {});
  });
}

// 포스트시즌을 보는 중이면 해당 시리즈 경기일만 고를 수 있게 한다
async function loadPostseasonGameDates(year) {
  const cacheKey = `ps-${year}`;
  if (calendarGameDatesCache[cacheKey]) return calendarGameDatesCache[cacheKey];

  // 선택된 시리즈만이 아니라 와일드카드~한국시리즈 전체 날짜를 모은다
  const dates = new Set();
  const seriesKeys = ['wc', 'sp', 'pl', 'ks'];
  try {
    const all = await Promise.all(seriesKeys.map(k => loadSeriesData(k, year).catch(() => [])));
    all.flat().forEach(game => {
      const m = game.date.match(/(\d{2})\.(\d{2})/);
      if (m) dates.add(`${year}-${m[1]}-${m[2]}`);
    });
  } catch (e) {
    // 실패하면 빈 집합을 돌려 달력을 그대로 둔다
  }
  calendarGameDatesCache[cacheKey] = dates;
  return dates;
}

function isMobileCalendar() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function initializeFlatpickr() {
  if (!window.flatpickr) {
    console.error('Flatpickr not loaded');
    return;
  }

  const today = new Date();
  calendarDisplayYear = today.getFullYear();
  calendarDisplayMonth = today.getMonth() + 1;

  const calendarBtn = document.getElementById('calendarBtn');
  const calendarInput = document.getElementById('calendarInput');
  const calendarSheetOverlay = document.getElementById('calendarSheetOverlay');
  const calendarSheetMount = document.getElementById('calendarSheetMount');

  function closeCalendarSheet() {
    if (calendarSheetOverlay) calendarSheetOverlay.classList.remove('show');
    if (fpInstance) fpInstance.close();
  }

  fpInstance = window.flatpickr(calendarInput, {
    mode: 'single',
    locale: 'ko',
    dateFormat: 'Y-m-d',
    position: 'below center',
    disableMobile: true,
    monthSelectorType: 'static',
    onChange: async (selectedDates) => {
      if (selectedDates.length > 0) {
        const date = selectedDates[0];
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        currentMonth = parseInt(month);
        currentYear = date.getFullYear();
        currentDay = date.getDate();
        document.getElementById('yearDisplay').textContent = currentYear;
        closeCalendarSheet();

        // 포스트시즌을 보는 중이면 정규시즌으로 돌아가지 않는다
        if (typeof postseasonMode !== 'undefined' && postseasonMode) {
          scrollToDateHeader(month + '.' + day, true);
          return;
        }

        const dateStr = month + '.' + day;
        await loadSchedule(dateStr);
      }
    },
    onOpen: async () => {
      if (typeof postseasonMode !== 'undefined' && postseasonMode) {
        applyGameDateMarks(await loadPostseasonGameDates(currentYear));
        return;
      }
      // 캐시가 있으면 기다리지 않고 바로 칠한다
      const key = `${calendarDisplayYear}-${String(calendarDisplayMonth).padStart(2, '0')}`;
      if (calendarGameDatesCache[key]) {
        applyGameDateMarks(calendarGameDatesCache[key]);
        return;
      }
      applyGameDateMarks(await loadCalendarGameDates(calendarDisplayYear, calendarDisplayMonth));
    },
    onMonthChange: async (selectedDates, dateStr, instance) => {
      const newMonth = instance.currentMonth + 1;
      const newYear = instance.currentYear;

      calendarDisplayMonth = newMonth;
      calendarDisplayYear = newYear;

      if (typeof postseasonMode !== 'undefined' && postseasonMode) {
        applyGameDateMarks(await loadPostseasonGameDates(newYear));
        return;
      }

      const key = `${newYear}-${String(newMonth).padStart(2, '0')}`;
      if (calendarGameDatesCache[key]) {
        applyGameDateMarks(calendarGameDatesCache[key]);
        return;
      }
      applyGameDateMarks(await loadCalendarGameDates(newYear, newMonth));

      // 이웃 달을 미리 받아둑다
      prefetchNeighborMonths(newYear, newMonth);
    }
  });

  calendarBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    calendarDisplayYear = currentYear;
    calendarDisplayMonth = currentMonth;

    // 포스트시즌은 경기가 실제로 있는 첫 달로 열어준다
    if (typeof postseasonMode !== 'undefined' && postseasonMode) {
      const dates = await loadPostseasonGameDates(currentYear);
      const months = [...dates].map(d => parseInt(d.split('-')[1], 10));
      if (months.length > 0) calendarDisplayMonth = Math.min(...months);
    }

    // 아직 고른 날이 없으면 오늘을 선택된 상태로 연다.
    // 선택 표시(배경 채움)와 오늘 표시(테두리)가 구분되도록
    if (fpInstance.selectedDates.length === 0) {
      fpInstance.setDate(new Date(), false);
    }

    fpInstance.jumpToDate(new Date(calendarDisplayYear, calendarDisplayMonth - 1, 1));
    prefetchNeighborMonths(calendarDisplayYear, calendarDisplayMonth);

    if (isMobileCalendar()) {
      if (calendarSheetOverlay) calendarSheetOverlay.classList.add('show');
      fpInstance.open();
      if (calendarSheetMount && fpInstance.calendarContainer) {
        calendarSheetMount.appendChild(fpInstance.calendarContainer);
      }
      return;
    }

    fpInstance.open();

    setTimeout(() => {
      const calendar = document.querySelector('.flatpickr-calendar');
      if (!calendar) return;

      const btnRect = calendarBtn.getBoundingClientRect();

      // 화면 밖으로 나가지 않게 좌우를 잡아준다
      const left = btnRect.left - (calendar.offsetWidth - btnRect.width) / 2;
      const maxLeft = window.innerWidth - calendar.offsetWidth - 8;

      // flatpickr 가 스스로 위치를 다시 잡으므로 !important 로 덮어쓴다.
      // 달력이 헤더보다 위(z-index)에 있어서 버튼 바로 아래에 붙일 수 있다
      calendar.style.setProperty('position', 'fixed', 'important');
      calendar.style.setProperty('top', (btnRect.bottom + 8) + 'px', 'important');
      calendar.style.setProperty('left', Math.min(Math.max(8, left), maxLeft) + 'px', 'important');
    }, 0);
  });

  if (calendarSheetOverlay) {
    calendarSheetOverlay.addEventListener('click', (e) => {
      if (e.target === calendarSheetOverlay) closeCalendarSheet();
    });
  }

  // 앱을 백그라운드에 뒀다 돌아오면 flatpickr가 스스로 닫혀 시트가 비어 보인다
  function restoreCalendarSheet() {
    if (!calendarSheetOverlay || !calendarSheetOverlay.classList.contains('show')) return;
    if (!fpInstance || fpInstance.isOpen) return;

    fpInstance.open();
    if (calendarSheetMount && fpInstance.calendarContainer) {
      calendarSheetMount.appendChild(fpInstance.calendarContainer);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') restoreCalendarSheet();
  });

  window.addEventListener('pageshow', restoreCalendarSheet);
}

function updateCalendarDisabledDates(schedule) {
  if (!fpInstance) return;

  const gameDates = new Set();
  schedule.forEach(game => {
    const dateMatch = game.date.match(/(\d{2})\.(\d{2})/);
    if (dateMatch) {
      const month = dateMatch[1];
      const day = dateMatch[2];
      gameDates.add(`${currentYear}-${month}-${day}`);
    }
  });

  // 이미 받아둔 일정을 달력 캐시에도 넣어둔다.
  // 그래야 달력을 열 때 같은 달을 다시 받아오지 않고 바로 표시된다
  cacheGameDatesByMonth(currentYear, gameDates);

  applyGameDateMarks(gameDates);
}

// 날짜 집합을 월별로 쪼개 캐시에 저장한다
function cacheGameDatesByMonth(year, gameDates) {
  const byMonth = {};
  gameDates.forEach(d => {
    const m = d.split('-')[1];
    if (!byMonth[m]) byMonth[m] = new Set();
    byMonth[m].add(d);
  });
  Object.keys(byMonth).forEach(m => {
    calendarGameDatesCache[`${year}-${m}`] = byMonth[m];
  });
}

function applyGameDateMarks(gameDates) {
  if (!fpInstance || !gameDates) return;

  // 포스트시즌 모드에서 데이터가 없으면 모든 날짜 비활성화
  if (gameDates.size === 0 && typeof postseasonMode !== 'undefined' && postseasonMode) {
    fpInstance.set('disable', [() => true]);
    return;
  }

  // 정규시즌: 경기 있는 날만 활성화
  if (gameDates.size === 0) return;

  fpInstance.set('disable', [
    function(date) {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return !gameDates.has(dateStr);
    }
  ]);
}
