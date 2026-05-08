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
        currentMonth = parseInt(month);
        currentYear = date.getFullYear();
        currentDay = date.getDate();
        document.getElementById('yearDisplay').textContent = currentYear;
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

  fpInstance.set('disable', [
    function(date) {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return !gameDates.has(dateStr);
    }
  ]);
}
