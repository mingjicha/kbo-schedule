// Toast
const toastEl = document.getElementById('toast');
let toastTimer = null;

function showToast(message, symbol = '', glyph = '') {
  if (!toastEl) return;

  const text = symbol
    ? `${message} <span class="symbol-font">${symbol}</span>`
    : message;
  const glyphHtml = glyph ? `<span class="toast__glyph">${glyph}</span>` : '';
  toastEl.innerHTML = `${glyphHtml}<span>${text}</span>`;
  toastEl.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2200);
}

// Scroll To Top Button
const scrollTopBtn = document.getElementById('scrollTopBtn');
const scrollTopMenuBtn = document.getElementById('scrollTopMenuBtn');

window.addEventListener('scroll', () => {
  const shouldShow = window.scrollY > 300;
  scrollTopBtn.classList.toggle('show', shouldShow);
  if (scrollTopMenuBtn) scrollTopMenuBtn.classList.toggle('show', shouldShow);
});

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

scrollTopBtn.addEventListener('click', scrollToTop);
if (scrollTopMenuBtn) scrollTopMenuBtn.addEventListener('click', scrollToTop);

// Year Navigation
const prevYearBtn = document.getElementById('prevYearBtn');
const nextYearBtn = document.getElementById('nextYearBtn');

prevYearBtn.addEventListener('click', () => {
  currentYear--;
  document.getElementById('yearDisplay').textContent = currentYear;
  loadSchedule();
});

nextYearBtn.addEventListener('click', () => {
  currentYear++;
  document.getElementById('yearDisplay').textContent = currentYear;
  loadSchedule();
});

// Team Filter
const teamTabs = document.querySelectorAll('.filter__btn');
const filterSummaryBtn = document.getElementById('filterSummaryBtn');
const filterSummaryText = document.getElementById('filterSummaryText');
const filterSummaryDot = document.getElementById('filterSummaryDot');
const teamSheetOverlay = document.getElementById('teamSheetOverlay');
const teamSheetList = document.getElementById('teamSheetList');

function updateFilterSummary() {
  const activeBtn = document.querySelector('.filter__btn.active');
  if (!activeBtn) return;

  if (filterSummaryText) {
    filterSummaryText.textContent = activeBtn.dataset.team ? activeBtn.textContent : '전체';
  }
  if (filterSummaryDot) {
    const logoSrc = teamLogos[activeBtn.textContent];
    if (activeBtn.dataset.team && logoSrc) {
      filterSummaryDot.style.display = 'block';
      filterSummaryDot.style.backgroundColor = 'transparent';
      filterSummaryDot.style.backgroundImage = `url(${logoSrc})`;
    } else {
      filterSummaryDot.style.display = 'none';
      filterSummaryDot.style.backgroundImage = 'none';
      filterSummaryDot.style.backgroundColor = '#333';
    }
  }
  document.querySelectorAll('.team-sheet__item').forEach(item => {
    item.classList.toggle('active', item.dataset.team === activeBtn.dataset.team);
  });
}

function selectTeam(team) {
  teamTabs.forEach(t => t.classList.toggle('active', t.dataset.team === team));
  currentTeam = team;
  applyTeamFilter();
  updateFilterSummary();
  closeTeamSheet();
}

teamTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    selectTeam(e.target.dataset.team);
  });
});

function renderTeamSheet() {
  if (!teamSheetList) return;
  teamSheetList.innerHTML = '';

  teamTabs.forEach(tab => {
    const team = tab.dataset.team;
    const name = tab.textContent;

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'team-sheet__item' + (tab.classList.contains('active') ? ' active' : '');
    item.dataset.team = team;

    const logoSrc = teamLogos[name];

    const nameSpan = document.createElement('span');
    nameSpan.className = 'team-sheet__item-name' + (logoSrc ? '' : ' team-sheet__item-name--all');
    nameSpan.textContent = name;

    const check = document.createElement('i');
    check.className = 'bi bi-check-lg';

    if (logoSrc) {
      const logo = document.createElement('img');
      logo.className = 'team-sheet__item-logo';
      logo.src = logoSrc;
      logo.alt = name;
      item.appendChild(logo);
    }
    item.appendChild(nameSpan);
    item.appendChild(check);

    item.addEventListener('click', () => selectTeam(team));

    teamSheetList.appendChild(item);
  });
}

function openTeamSheet() {
  renderTeamSheet();
  if (teamSheetOverlay) teamSheetOverlay.classList.add('show');
  if (filterSummaryBtn) filterSummaryBtn.setAttribute('aria-expanded', 'true');
}

function closeTeamSheet() {
  if (teamSheetOverlay) teamSheetOverlay.classList.remove('show');
  if (filterSummaryBtn) filterSummaryBtn.setAttribute('aria-expanded', 'false');
}

if (filterSummaryBtn) {
  filterSummaryBtn.addEventListener('click', openTeamSheet);
}

if (teamSheetOverlay) {
  teamSheetOverlay.addEventListener('click', (e) => {
    if (e.target === teamSheetOverlay) closeTeamSheet();
  });
}

// Quick Menu
const quickMenuItems = document.querySelectorAll('.quick-menu__item');

// 모달이 막 열렸을 때는 연속 탭을 무시해 바로 닫히지 않게 한다
const REOPEN_GUARD_MS = 400;
const modalOpenedAt = {};

async function toggleQuickMenuModal(action, modalId, loadData) {
  const modal = document.getElementById(modalId);

  if (modal.classList.contains('show')) {
    if (Date.now() - (modalOpenedAt[action] || 0) < REOPEN_GUARD_MS) return;
    modal.classList.remove('show');
    return;
  }

  // 모달을 먼저 띄워 로딩 상태를 보여주고, 데이터는 그 뒤에 채운다
  modalOpenedAt[action] = Date.now();
  modal.classList.add('show');
  await loadData();
}

async function handleQuickMenuAction(action) {
  if (action === 'today') {
    await goToToday();
  } else if (action === 'rank') {
    await toggleQuickMenuModal(action, 'rankModal', loadTeamRank);
  } else if (action === 'weather') {
    await toggleQuickMenuModal(action, 'weatherModal', loadWeather);
  }
}

quickMenuItems.forEach(item => {
  item.addEventListener('click', () => {
    const action = item.dataset.action;
    handleQuickMenuAction(action);
  });
});

// Today (quick menu)
async function goToToday() {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  currentYear = todayYear;
  currentMonth = todayMonth;
  yearDisplay.textContent = currentYear;

  document.querySelectorAll('.nav__tab').forEach(t => t.classList.remove('active'));
  const monthStr = String(todayMonth).padStart(2, '0');
  const activeTab = document.querySelector(`.nav__tab[data-month="${monthStr}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  closeTeamSheet();

  const scheduleContainer = document.getElementById('scheduleContainer');
  scheduleContainer.innerHTML = renderSkeletonLoader();

  try {
    const todaySchedule = await loadMonthData(todayMonth, todayYear);

    if (todaySchedule.length === 0) {
      scheduleContainer.innerHTML = '<div class="schedule__no-games">오늘은 예정된 경기가 없어요 <span class="symbol-font">♤</span></div>';
      showToast('오늘은 예정된 경기가 없어요', '', '😿');
      return;
    }

    window.currentScheduleData = todaySchedule;
    // 오늘 경기가 실제로 있을 때만 기준일을 갱신한다
    // (없으면 앱 진입 시 정해진 next 기준일을 그대로 유지)
    const todayFocus = findFocusDate(groupByDate(todaySchedule), todayYear);
    if (todayFocus && todayFocus.type === 'today') {
      setFocusDateInfo(todayFocus, todayYear);
    }
    scheduleContainer.innerHTML = '';
    const gameList = renderGamesByMonth(todaySchedule, null, todayYear);
    scheduleContainer.appendChild(gameList);

    setTimeout(() => {
      const todayDateStr = `${String(todayMonth).padStart(2, '0')}.${String(todayDay).padStart(2, '0')}`;
      const allDays = document.querySelectorAll('.schedule__day');
      let found = false;
      for (let dayDiv of allDays) {
        const header = dayDiv.querySelector('.schedule__date-header');
        if (header && header.getAttribute('data-date').startsWith(todayDateStr)) {
          dayDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
          found = true;
          break;
        }
      }
      if (!found) {
        showToast('오늘은 예정된 경기가 없어요', '', '😿');
      }
    }, 100);
  } catch (error) {
    console.error('Error loading today schedule:', error);
    scheduleContainer.innerHTML = '<div class="schedule__no-games">일정을 불러올 수 없어요 <span class="symbol-font">♤</span></div>';
  }
}

// Lock body scroll while any modal/overlay is open
const openOverlaySelector = '.modal.show, .team-sheet-overlay.show, .calendar-sheet-overlay.show, .onboarding.show';

function syncBodyScrollLock() {
  document.body.classList.toggle('body--no-scroll', !!document.querySelector(openOverlaySelector));
}

// Highlight the quick-menu item whose modal is currently open
const quickMenuActionModals = {
  rank: document.getElementById('rankModal'),
  weather: document.getElementById('weatherModal')
};

function syncQuickMenuActive() {
  quickMenuItems.forEach(item => {
    const action = item.dataset.action;
    const modal = quickMenuActionModals[action];
    item.classList.toggle('active', !!(modal && modal.classList.contains('show')));
  });
}

new MutationObserver(() => {
  syncBodyScrollLock();
  syncQuickMenuActive();
}).observe(document.body, {
  attributes: true,
  attributeFilter: ['class'],
  subtree: true
});

// Move year/calendar controls into the header on mobile (one line next to
// the title), back into the header section (above month tabs) on desktop
// — same element, no duplicate IDs.
const controlsEl = document.getElementById('controls');
const controlsMountDesktop = document.getElementById('controlsMountDesktop');
const headerSectionEl = document.querySelector('.app__header-section');
const mobileMql = window.matchMedia('(max-width: 768px)');

function placeControls() {
  if (!controlsEl || !controlsMountDesktop || !headerSectionEl) return;
  if (mobileMql.matches) {
    controlsMountDesktop.appendChild(controlsEl);
  } else {
    headerSectionEl.insertBefore(controlsEl, headerSectionEl.firstChild);
  }
}

placeControls();
mobileMql.addEventListener('change', placeControls);
