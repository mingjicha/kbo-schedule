// Scroll To Top Button
const scrollTopBtn = document.getElementById('scrollTopBtn');

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

teamTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    teamTabs.forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    currentTeam = e.target.dataset.team;
    applyTeamFilter();
  });
});

// Quick Menu
const quickMenuItems = document.querySelectorAll('.quick-menu__item');

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

// Today Button
const todayBtn = document.getElementById('todayBtn');

async function goToToday() {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  currentYear = todayYear;
  currentMonth = todayMonth;
  yearDisplay.textContent = currentYear;
  currentTeam = '';

  document.querySelectorAll('.nav__tab').forEach(t => t.classList.remove('active'));
  const monthStr = String(todayMonth).padStart(2, '0');
  const activeTab = document.querySelector(`.nav__tab[data-month="${monthStr}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  document.querySelectorAll('.filter__btn').forEach(btn => btn.classList.remove('active'));
  const allTeamBtn = document.querySelector('.filter__btn[data-team=""]');
  if (allTeamBtn) {
    allTeamBtn.classList.add('active');
  }

  const scheduleContainer = document.getElementById('scheduleContainer');
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
