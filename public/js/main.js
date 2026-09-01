// Global state
let currentTeam = '';
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let currentDay = null;
let selectedDate = null;

window.currentScheduleData = [];

const scheduleContainer = document.getElementById('scheduleContainer');
const yearDisplay = document.getElementById('yearDisplay');

async function initializeApp() {
  yearDisplay.textContent = currentYear;
  initializeFlatpickr();

  try {
    await initializeMonthTabsWithLazyLoad();

    let schedule = await loadMonthData(currentMonth);

    // 이번 달에 남은 경기가 없으면 다음 달로 넘어간다
    if (!hasUpcomingGame(schedule, currentYear) && currentMonth < 10) {
      const nextMonth = currentMonth + 1;
      const nextSchedule = await loadMonthData(nextMonth, currentYear);
      if (nextSchedule.length > 0) {
        currentMonth = nextMonth;
        schedule = nextSchedule;
        setActiveMonthTab(currentMonth);
      }
    }

    window.currentScheduleData = schedule;
    loadedMonths.add(String(currentMonth).padStart(2, '0'));

    const focus = findFocusDate(groupByDate(schedule), currentYear);
    setFocusDateInfo(focus, currentYear);
    const focusDate = focus ? focus.date : null;

    // 온보딩이 뜰 때는 좌표가 흔들리지 않도록 스크롤을 온보딩 이후로 미룬다
    const willShowOnboarding = shouldShowOnboarding();
    const gameList = renderGamesByMonth(
      schedule,
      willShowOnboarding ? null : focusDate,
      currentYear,
      true
    );
    scheduleContainer.innerHTML = '';
    scheduleContainer.appendChild(gameList);

    // 경기 카드가 그려졌으면 온보딩을 바로 띄운다 (날씨 로딩을 기다리지 않는다)
    maybeStartOnboarding(willShowOnboarding ? () => scrollToDateHeader(focusDate, true) : null);

    // 나머지는 백그라운드에서 진행
    // 달력의 경기일 표시를 미리 채워둔다 (달력을 열 때 기다리지 않게)
    updateCalendarDisabledDates(schedule);
    prefetchNeighborMonths(currentYear, currentMonth);

    warmupPreviews(schedule, focusDate);
    loadWeather();
  } catch (error) {
    console.error('Error initializing app:', error);
    scheduleContainer.innerHTML = '<div class="schedule__no-games">일정을 불러올 수 없어요<span class="symbol-font">♤</span></div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  initNavSwipe();
});

// Navigation swipe function
function initNavSwipe() {
  const navTabs = document.querySelector('.nav__tabs');
  if (!navTabs) return;

  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;

  navTabs.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = true;
  }, { passive: true });

  navTabs.addEventListener('touchmove', (e) => {
    if (!isSwiping) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = Math.abs(touchStartX - currentX);
    const diffY = Math.abs(touchStartY - currentY);

    if (diffX > diffY) {
      e.preventDefault();
    }
  }, { passive: false });

  navTabs.addEventListener('touchend', (e) => {
    if (!isSwiping) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;
    const threshold = 30;

    if (Math.abs(diffX) > threshold) {
      if (diffX > 0) {
        navTabs.scrollBy({ left: 100, behavior: 'smooth' });
      } else {
        navTabs.scrollBy({ left: -100, behavior: 'smooth' });
      }
    }

    isSwiping = false;
  }, { passive: true });
}
