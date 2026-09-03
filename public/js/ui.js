// Toast
const toastEl = document.getElementById('toast');
let toastTimer = null;

function showToast(message, symbol = '', glyph = '') {
  if (!toastEl) return;

  const text = symbol
    ? `${message}<span class="symbol-font">${symbol}</span>`
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

// 포스트시즌을 보는 중이면 연도를 바꿔도 포스트시즌을 유지한다
async function changeYear(delta) {
  currentYear += delta;
  document.getElementById('yearDisplay').textContent = currentYear;

  if (postseasonMode) {
    await renderPostseasonTabs();
    return;
  }

  await loadSchedule();
}

prevYearBtn.addEventListener('click', () => changeYear(-1));
nextYearBtn.addEventListener('click', () => changeYear(1));

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

  // 포스트시즌 화면이면 정규시즌 월 탭으로 되돌린다.
  // setPostseasonMode 가 currentMonth 를 이전 달로 되돌리므로, 그 다음에 다시 오늘로 맞춘다
  if (typeof postseasonMode !== 'undefined' && postseasonMode) {
    await setPostseasonMode(false);
    currentMonth = todayMonth;
    setActiveMonthTab(todayMonth);
  }

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
      scheduleContainer.innerHTML = '<div class="schedule__no-games">오늘은 예정된 경기가 없어요<span class="symbol-font">♤</span></div>';
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
          scrollElementBelowHeader(dayDiv);
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
    scheduleContainer.innerHTML = '<div class="schedule__no-games">일정을 불러올 수 없어요<span class="symbol-font">♤</span></div>';
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

// Move year/calendar controls into the header, on one line next to the title.
// Same element for both breakpoints — no duplicate IDs.
const controlsEl = document.getElementById('controls');
const controlsMountDesktop = document.getElementById('controlsMountDesktop');

function placeControls() {
  if (!controlsEl || !controlsMountDesktop) return;
  // PC·모바일 모두 헤더 오른쪽(제목 옆)에 둔다
  controlsMountDesktop.appendChild(controlsEl);
  // 자리를 잡은 뒤에야 보이게 한다 (CSS 에서 기본 숨김)
  controlsEl.classList.add('controls--placed');
}

placeControls();

// PC 에서만 포스트시즌 버튼을 월 탭 줄 오른쪽으로 옮긴다.
// 시즌 구분(정규시즌 월 vs 포스트시즌)이라 월 탭과 같은 줄이 맞다.
// 모바일은 별도 버튼(#postseasonBtnMobile)을 쓰므로 원위치 그대로 둔다.
const postseasonNavEl = document.querySelector('.app__header-section .nav');
const postseasonMountDesktop = document.getElementById('postseasonMountDesktop');
const headerSectionForNav = document.querySelector('.app__header-section');
const pcMql = window.matchMedia('(min-width: 769px)');

function placePostseason() {
  if (!postseasonNavEl || !postseasonMountDesktop || !headerSectionForNav) return;
  if (pcMql.matches) {
    postseasonMountDesktop.appendChild(postseasonNavEl);
  } else if (postseasonNavEl.parentElement !== headerSectionForNav) {
    // 모바일에서는 원래 자리(팀 필터 위)로 되돌린다
    headerSectionForNav.insertBefore(postseasonNavEl, headerSectionForNav.querySelector('.filter'));
  }
}

placePostseason();
pcMql.addEventListener('change', placePostseason);

// 진행중 경기가 있으면 하단 TODAY 버튼을 가리키는 말풍선을 띄운다.
// 하루에 한 번 닫으면 그 날은 다시 안 뜨고, 날짜가 바뀌면 다시 뜬다
const LIVE_BUBBLE_DISMISS_KEY = 'kbo-live-bubble-dismissed-date';

function todayDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isLiveBubbleDismissedToday() {
  try {
    return localStorage.getItem(LIVE_BUBBLE_DISMISS_KEY) === todayDateKey();
  } catch (e) {
    return false;
  }
}

function dismissLiveBubbleForToday() {
  try {
    localStorage.setItem(LIVE_BUBBLE_DISMISS_KEY, todayDateKey());
  } catch (e) {
    // 저장소 접근이 막혀도 이번 세션에서는 다시 뜨지 않음
  }
}

function positionLiveBubble() {
  const bubble = document.getElementById('liveBubble');
  const target = document.getElementById('todayMenuBtn');
  if (!bubble || !target) return;

  const rect = target.getBoundingClientRect();

  if (isMobileCalendar()) {
    // 모바일: TODAY 버튼 바로 위, 버튼 중앙에 화살표가 오도록
    const bubbleWidth = bubble.offsetWidth || 240;
    let left = rect.left + rect.width / 2 - bubbleWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - bubbleWidth - 12));
    bubble.style.left = `${left}px`;
    bubble.style.right = 'auto';
    bubble.style.top = 'auto';
    const arrow = bubble.querySelector('.live-bubble__arrow');
    if (arrow) arrow.style.left = `${rect.left + rect.width / 2 - left - 7}px`;
  } else {
    // 데스크톱: TODAY 버튼 왼쪽, 세로 중앙을 맞춘다
    bubble.style.top = `${rect.top + rect.height / 2}px`;
    bubble.style.transform = 'translateY(-50%)';
    bubble.style.right = `${window.innerWidth - rect.left + 14}px`;
    bubble.style.left = 'auto';
  }
}

function showLiveBubble() {
  const bubble = document.getElementById('liveBubble');
  if (!bubble) return;
  bubble.classList.add('show');
  positionLiveBubble();
}

function hideLiveBubble() {
  const bubble = document.getElementById('liveBubble');
  if (bubble) bubble.classList.remove('show');
}

// 오늘 일정 중 진행중 경기가 있으면 말풍선을 띄운다
function maybeShowLiveBubble(todaySchedule) {
  if (isLiveBubbleDismissedToday()) return;
  const hasLive = (todaySchedule || []).some(game => getGameStatus(game) === '진행중');
  if (hasLive) showLiveBubble();
}

const liveBubbleClose = document.getElementById('liveBubbleClose');
if (liveBubbleClose) {
  liveBubbleClose.addEventListener('click', () => {
    hideLiveBubble();
    dismissLiveBubbleForToday();
  });
}

const liveBubbleText = document.querySelector('#liveBubble .live-bubble__text');
if (liveBubbleText) {
  liveBubbleText.addEventListener('click', async () => {
    hideLiveBubble();
    await goToToday();
  });
}

window.addEventListener('resize', () => {
  const bubble = document.getElementById('liveBubble');
  if (bubble && bubble.classList.contains('show')) positionLiveBubble();
});
