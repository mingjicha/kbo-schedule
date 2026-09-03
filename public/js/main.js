// Global state
let currentTeam = '';
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let currentDay = null;

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
    // 포스트시즌 모드에서는 온보딩을 표시하지 않는다
    const isPostseason = typeof postseasonMode !== 'undefined' && postseasonMode;
    const willShowOnboarding = !isPostseason && shouldShowOnboarding();
    const gameList = renderGamesByMonth(
      schedule,
      willShowOnboarding ? null : focusDate,
      currentYear,
      true
    );
    scheduleContainer.innerHTML = '';
    scheduleContainer.appendChild(gameList);

    // 오늘 진행중 경기가 있으면 온보딩이 끝난 뒤 TODAY 버튼을 가리키는 말풍선을 띄운다
    const todayGames = schedule.filter(g => {
      const m = g.date.match(/(\d{2})\.(\d{2})/);
      if (!m) return false;
      const today = new Date();
      return parseInt(m[1]) === today.getMonth() + 1 && parseInt(m[2]) === today.getDate();
    });
    const afterOnboarding = () => {
      if (willShowOnboarding) scrollToDateHeader(focusDate, true);
      maybeShowLiveBubble(todayGames);
    };

    // 경기 카드가 그려졌으면 온보딩을 바로 띄운다 (날씨 로딩을 기다리지 않는다)
    // 포스트시즌 모드에서는 온보딩을 스킵한다
    if (!isPostseason) {
      maybeStartOnboarding(afterOnboarding);
    } else {
      afterOnboarding();
    }

    // 나머지는 백그라운드에서 진행
    // 달력의 경기일 표시를 미리 채워둔다 (달력을 열 때 기다리지 않게)
    updateCalendarDisabledDates(schedule);
    prefetchNeighborMonths(currentYear, currentMonth);

    // 당일 경기 실시간 갱신 시작
    startTodayRefreshTimer();
    // 미래 경기 갱신 시작 (1시간마다 시간/취소 변경 감지)
    startFutureRefreshTimer();

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

// ==================== 배포 감지 후 자동 새로고침 ====================
// 배포되면 서버의 buildId 가 바뀐다. 그걸 감지해 오래된 화면을 자동으로 갱신한다.
// 사용자가 보고 있는 도중에 새로고침하면 흐름이 끊기므로,
// 모달이 열려 있지 않고 탭이 백그라운드일 때(또는 다시 돌아왔을 때)만 새로고침한다
(function watchDeploy() {
  let knownBuildId = null;
  let pendingReload = false;

  async function fetchBuildId() {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.buildId || null;
    } catch (e) {
      return null; // 오프라인 등은 조용히 넘어간다
    }
  }

  // 지금 새로고침해도 사용자를 방해하지 않는지.
  // 모달·시트가 열려 있으면 조작 중이므로 절대 새로고침하지 않는다
  function isSafeToReload() {
    return !document.querySelector('.modal.show, .team-sheet-overlay.show, .calendar-sheet-overlay.show, .onboarding.show');
  }

  function reloadNow() {
    // service worker 캐시까지 버려야 새 파일을 확실히 받는다
    if ('caches' in window) {
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .catch(() => {})
        .finally(() => location.reload());
    } else {
      location.reload();
    }
  }

  async function check() {
    const buildId = await fetchBuildId();
    if (!buildId) return;

    if (knownBuildId === null) {
      knownBuildId = buildId; // 최초 진입 시 기준값만 기억
      return;
    }

    if (buildId !== knownBuildId) {
      pendingReload = true;
      // 탭이 가려져 있으면 눈에 안 띄게 바로 갱신하고,
      // 보고 있는 중이면 모달이 없을 때만 갱신한다
      if (isSafeToReload()) reloadNow();
    }
  }

  // 새 배포를 감지해 둔 상태라면 탭을 다시 열 때 확실히 갱신한다
  document.addEventListener('visibilitychange', () => {
    if (pendingReload && isSafeToReload()) reloadNow();
  });

  check();
  setInterval(check, 5 * 60 * 1000);
})();
