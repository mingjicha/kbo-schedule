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
    const defaultMonthStr = String(currentMonth).padStart(2, '0');

    await initializeMonthTabsWithLazyLoad();

    const defaultSchedule = await loadMonthData(currentMonth);
    window.currentScheduleData = defaultSchedule;
    loadedMonths.add(defaultMonthStr);

    const gameList = renderGamesByMonth(defaultSchedule, null, currentYear);
    scheduleContainer.innerHTML = '';
    scheduleContainer.appendChild(gameList);

    await loadWeather();
  } catch (error) {
    console.error('Error initializing app:', error);
    scheduleContainer.innerHTML = '<div class="schedule__no-games">일정을 불러올 수 없습니다.</div>';
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
