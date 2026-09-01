const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.static('public'));

const TEAM_MAP = {
  '': '전체',
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

const TEAM_CODES = ['', 'LG', 'HH', 'SK', 'SS', 'NC', 'KT', 'LT', 'HT', 'OB', 'WO'];

// Puppeteer 인스턴스 관리
let browserInstance = null;
const gameDataCache = {};

async function getBrowser() {
  // 브라우저가 죽은 채로 남아 있으면 이후 요청이 모두 실패하므로 상태를 확인하고 다시 띄운다
  if (browserInstance && !browserInstance.connected) {
    try {
      await browserInstance.close();
    } catch (e) {
      // 이미 죽은 프로세스면 무시
    }
    browserInstance = null;
  }

  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });
    browserInstance.on('disconnected', () => {
      browserInstance = null;
    });
  }
  return browserInstance;
}

function getCachedData(gameId) {
  return gameDataCache[gameId];
}

function cacheData(gameId, data) {
  gameDataCache[gameId] = data;
  // 캐시 2시간 유지 (Puppeteer 크롤링이 무거워 오래 재사용한다)
  setTimeout(() => {
    delete gameDataCache[gameId];
  }, 2 * 60 * 60 * 1000);
}

// 범용 응답 캐시 (schedule / team-rank / weather 용)
const responseCache = {};

function getResponseCache(key) {
  const entry = responseCache[key];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    delete responseCache[key];
    return null;
  }
  return entry.data;
}

function setResponseCache(key, data, ttlMs) {
  responseCache[key] = { data, expiresAt: Date.now() + ttlMs };
}

function parseGameInfo(playHtml, gameId = '') {
  if (!playHtml) return {
    awayTeam: 'N/A',
    homeTeam: 'N/A',
    awayScore: null,
    homeScore: null,
    status: '예정',
    winner: null,
    awayPitcher: 'N/A',
    homePitcher: 'N/A',
    awayPitcherId: '',
    homePitcherId: ''
  };

  const $ = cheerio.load(playHtml);

  // Check if this is a link (no teams shown directly)
  const hasLink = $('a').length > 0;

  const spans = $('span');
  const spanTexts = spans.map((i, el) => ({
    text: $(el).text(),
    class: $(el).attr('class')
  })).get();

  const hasWinLose = spanTexts.some(s => s.class === 'win' || s.class === 'lose');
  const hasSame = spanTexts.some(s => s.class === 'same');

  let awayTeam = 'N/A';
  let homeTeam = 'N/A';
  let awayScore = null;
  let homeScore = null;
  let status = '예정';
  let winner = null;

  // Only extract team names from spans if they exist (not just a link)
  if (!hasLink && spanTexts.length >= 2) {
    awayTeam = spanTexts[0].text || 'N/A';
    homeTeam = spanTexts[spanTexts.length - 1].text || 'N/A';
  }

  // 모든 span에서 숫자를 찾아서 점수로 사용
  const allNumbers = spanTexts.filter(s => /^\d+$/.test(s.text.trim().replace(/\s/g, '')));
  if (allNumbers.length >= 2) {
    const away = parseInt(allNumbers[0].text, 10);
    const home = parseInt(allNumbers[allNumbers.length - 1].text, 10);
    if (!isNaN(away) && !isNaN(home)) {
      awayScore = away;
      homeScore = home;
    }
  }

  // Determine status based on scores (only if not both 0)
  if (awayScore !== null && homeScore !== null && (awayScore !== 0 || homeScore !== 0)) {
    status = '종료';
    // Check for winner based on win/lose classes
    if (hasWinLose) {
      const winIdx = spanTexts.findIndex(s => s.class === 'win');
      const loseIdx = spanTexts.findIndex(s => s.class === 'lose');
      if (winIdx !== -1 && loseIdx !== -1) {
        if (winIdx < loseIdx) {
          winner = 'away';
        } else {
          winner = 'home';
        }
      }
    } else if (awayScore > homeScore) {
      winner = 'away';
    } else if (homeScore > awayScore) {
      winner = 'home';
    }
  } else {
    status = '예정';
  }

  // If team names not found, extract from gameId (format: YYYYMMDDAWAY0HOME0)
  if (awayTeam === 'N/A' && homeTeam === 'N/A' && gameId) {
    // Try different patterns
    let match = gameId.match(/(\d{8})([A-Z]{2})(\d+)([A-Z]{2})/);
    if (!match) {
      match = gameId.match(/(\d{8})([A-Z]{2})([A-Z]{2})/);
    }

    if (match && match.length >= 4) {
      const awayCode = match[2];
      const homeCode = match[match.length - 1];
      const localTeamMap = {
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
      awayTeam = localTeamMap[awayCode] || 'N/A';
      homeTeam = localTeamMap[homeCode] || 'N/A';
    }
  }

  // Extract pitcher names from HTML structure
  // Look for pattern: 선발 "pitcherName" or <div class="today-pitcher"> with pitcher name
  let awayPitcher = 'N/A';
  let homePitcher = 'N/A';

  // Try finding pitcher divs first
  const pitcherDivs = $('div.today-pitcher');

  if (pitcherDivs.length >= 1) {
    const awayPitcherDiv = pitcherDivs.eq(0);
    const awayPitcherText = awayPitcherDiv.text().trim();
    const awayMatch = awayPitcherText.replace(/^선발/, '').trim().match(/"([^"]+)"/);
    if (awayMatch && awayMatch[1]) {
      awayPitcher = awayMatch[1].trim();
    }
  }

  if (pitcherDivs.length >= 2) {
    const homePitcherDiv = pitcherDivs.eq(1);
    const homePitcherText = homePitcherDiv.text().trim();
    const homeMatch = homePitcherText.replace(/^선발/, '').trim().match(/"([^"]+)"/);
    if (homeMatch && homeMatch[1]) {
      homePitcher = homeMatch[1].trim();
    }
  }

  // If pitchers not found via divs, try regex on the whole HTML
  if (awayPitcher === 'N/A' && playHtml) {
    const awayRegex = /선발[^"]*"([^"]+)"/g;
    const matches = [...playHtml.matchAll(awayRegex)];
    if (matches.length > 0 && matches[0][1]) {
      awayPitcher = matches[0][1].trim();
    }
    if (matches.length > 1 && matches[1][1]) {
      homePitcher = matches[1][1].trim();
    }
  }

  return {
    awayTeam,
    homeTeam,
    awayScore,
    homeScore,
    status,
    winner,
    awayPitcher,
    homePitcher
  };
}

app.get('/api/schedule', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const month = String(req.query.month || new Date().getMonth() + 1).padStart(2, '0');
    const team = req.query.team || '';

    const cacheKey = `schedule:${year}:${month}:${team}`;
    const cached = getResponseCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const postData = new URLSearchParams({
      leId: '1',
      srIdList: '0',
      seasonId: year,
      gameMonth: month,
      teamId: team
    });

    const response = await axios.post(
      'https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList',
      postData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.koreabaseball.com/Schedule/Schedule.aspx',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    const data = response.data;
    const schedule = [];
    let currentDate = '';
    const pitcherCache = {};

    if (data.rows && Array.isArray(data.rows)) {
      for (let i = 0; i < data.rows.length; i++) {
        const rowItem = data.rows[i];
        if (rowItem.row && Array.isArray(rowItem.row)) {
          const cells = rowItem.row;

          if (cells.length === 0) continue;

          // Check if first cell contains date (dd.dd(day) format)
          const firstCellText = (cells[0].Text || '').replace(/<[^>]*>/g, '').trim();
          if (firstCellText && firstCellText.match(/^\d{2}\.\d{2}\(/)) {
            currentDate = firstCellText;
          }

          // Determine cell structure based on whether first cell has date
          let timeCell, playCell, stadiumCell, noteCell, date;
          const firstCellIsDate = firstCellText && firstCellText.match(/^\d{2}\.\d{2}\(/);

          if (firstCellIsDate) {
            // First row: date, time, play, ..., stadium, note
            timeCell = cells[1];
            playCell = cells[2];
            stadiumCell = cells[cells.length - 2];
            noteCell = cells[cells.length - 1];
            date = currentDate;
          } else if (cells[0].Text && cells[0].Text.includes('<b>')) {
            // Subsequent rows: time, play, link, link, ..., stadium, note
            timeCell = cells[0];
            playCell = cells[1];
            stadiumCell = cells[cells.length - 2];
            noteCell = cells[cells.length - 1];
            date = currentDate;
          } else {
            continue;
          }

          // Extract time from HTML
          let time = '';
          if (timeCell && timeCell.Text) {
            const $time = cheerio.load(timeCell.Text);
            time = $time('b').text().trim();
            if (!time) {
              time = timeCell.Text.replace(/<[^>]*>/g, '').trim();
            }
          }

          const stadium = stadiumCell ? (stadiumCell.Text || '') : '';
          const note = noteCell ? (noteCell.Text || '') : '';

          // Extract gameId from relay/review/highlight cells
          let gameId = '';
          for (let j = 3; j < cells.length && !gameId; j++) {
            if (cells[j] && cells[j].Text) {
              const $cell = cheerio.load(cells[j].Text);
              const gameLink = $cell('a').attr('href') || '';
              if (gameLink) {
                const gameIdMatch = gameLink.match(/gameId=([^&]+)/);
                gameId = gameIdMatch ? gameIdMatch[1] : '';
              }
            }
          }

          // Parse game info (team names, scores, status)
          const gameInfo = parseGameInfo(playCell ? (playCell.Text || '') : '', gameId);

          if (gameInfo) {

            // Determine final status based on note and scores
            let finalStatus = gameInfo.status;
            let awayScore = gameInfo.awayScore;
            let homeScore = gameInfo.homeScore;
            let winner = gameInfo.winner;

            // 취소 경기는 최우선 - note 필드 완벽하게 정제
            let noteText = note ? note.replace(/<[^>]*>/g, '').trim() : '';
            noteText = noteText.replace(/&nbsp;/g, ' ').trim();

            // 비고란에 사유가 적혀 있으면 취소 (우천취소/폭염취소/그라운드사정 등)
            if (noteText && noteText !== '-') {
              finalStatus = '취소';
              awayScore = null;
              homeScore = null;
              winner = null;
            }
            // gameInfo의 status를 우선 사용 (0:0은 예정으로 처리됨)
            else {
              finalStatus = gameInfo.status;
            }

            schedule.push({
              date,
              time,
              awayTeam: gameInfo.awayTeam,
              homeTeam: gameInfo.homeTeam,
              awayScore,
              homeScore,
              status: finalStatus,
              stadium,
              note: noteText,
              winner,
              gameId,
              awayPitcher: gameInfo.awayPitcher || '',
              homePitcher: gameInfo.homePitcher || ''
            });
          }
        }
      }
    }

    // 각 경기의 투수 정보를 비동기로 가져오기
    // 1. gameId가 있는 경기용 (종료된 경기)
    const gamesByDate = {};
    // 2. gameId가 없는 경기용 (오늘 경기 또는 예정 경기)
    const todayGames = [];

    const today = new Date();
    const todayStr = String(today.getFullYear()) +
                     String(today.getMonth() + 1).padStart(2, '0') +
                     String(today.getDate()).padStart(2, '0');

    schedule.forEach(game => {
      if (game.gameId) {
        // gameId가 있으면 날짜별로 그룹화
        const gameDate = game.gameId.substring(0, 8);
        if (!gamesByDate[gameDate]) {
          gamesByDate[gameDate] = [];
        }
        gamesByDate[gameDate].push(game);
      } else {
        // gameId가 없으면 오늘 경기로 처리
        todayGames.push(game);
      }
    });

    // 1. 종료된 경기 (gameId가 있는 경우) - GetKboGameList API 호출
    await Promise.all(
      Object.keys(gamesByDate).map(gameDate =>
        axios.post(
          'https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList',
          new URLSearchParams({
            leId: '1',
            srId: '0',
            date: gameDate
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx'
            }
          }
        )
          .then(pitcherRes => {
            if (pitcherRes.data && pitcherRes.data.game) {
              pitcherRes.data.game.forEach(apiGame => {
                const gameId = apiGame.G_ID;
                const awayStartPitcher = (apiGame.T_PIT_P_NM || '').trim() || 'N/A';
                const homeStartPitcher = (apiGame.B_PIT_P_NM || '').trim() || 'N/A';
                const winnerPitcher = (apiGame.W_PIT_P_NM || '').trim();
                const savePitcher = (apiGame.SV_PIT_P_NM || '').trim();
                const awayScore = parseInt(apiGame.T_SCORE_CN) || 0;
                const homeScore = parseInt(apiGame.B_SCORE_CN) || 0;
                const awayStartPitcherId = apiGame.T_PIT_P_ID;
                const homeStartPitcherId = apiGame.B_PIT_P_ID;
                const winnerPitcherId = apiGame.W_PIT_P_ID;

                let finalAwayPitcher = awayStartPitcher;
                let finalHomePitcher = homeStartPitcher;

                // 승리투수가 있으면 승리투수 사용 (세이브 상관없이)
                if (winnerPitcher && winnerPitcherId) {
                  if (awayScore > homeScore) {
                    // 어웨이팀 승리: 승리투수가 선발투수와 다르면 승리투수 이름 사용
                    if (awayStartPitcherId && winnerPitcherId !== awayStartPitcherId) {
                      finalAwayPitcher = winnerPitcher;
                    }
                  } else if (homeScore > awayScore) {
                    // 홈팀 승리: 승리투수가 선발투수와 다르면 승리투수 이름 사용
                    if (homeStartPitcherId && winnerPitcherId !== homeStartPitcherId) {
                      finalHomePitcher = winnerPitcher;
                    }
                  }
                }

                if (gameId) {
                  pitcherCache[gameId] = {
                    awayPitcher: finalAwayPitcher,
                    homePitcher: finalHomePitcher
                  };
                }
              });
            }
          })
          .catch(error => {
            console.error(`Error fetching pitcher info for date ${gameDate}:`, error.message);
          })
      )
    );

    // 2. 오늘 경기 (gameId가 없는 경우) - 날짜별로 분류해서 처리
    if (todayGames.length > 0) {
      // 날짜별로 그룹화
      const gamesByScheduleDate = {};
      todayGames.forEach(game => {
        const dateMatch = game.date.match(/(\d{2})\.(\d{2})/);
        if (dateMatch) {
          const gameDate = year + dateMatch[1] + dateMatch[2];
          if (!gamesByScheduleDate[gameDate]) {
            gamesByScheduleDate[gameDate] = [];
          }
          gamesByScheduleDate[gameDate].push(game);
        }
      });

      // 각 날짜별로 API 호출
      for (const [gameDate, gamesForDate] of Object.entries(gamesByScheduleDate)) {
        try {
          const todayPitcherRes = await axios.post(
            'https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList',
            new URLSearchParams({
              leId: '1',
              srId: '0',
              date: gameDate
            }).toString(),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx'
              }
            }
          );

          if (todayPitcherRes.data && todayPitcherRes.data.game) {
            const todayGameMap = {};
            todayPitcherRes.data.game.forEach(apiGame => {
              const key = `${apiGame.AWAY_NM}_${apiGame.HOME_NM}`;

              const awayStartPitcher = (apiGame.T_PIT_P_NM || '').trim() || 'N/A';
              const homeStartPitcher = (apiGame.B_PIT_P_NM || '').trim() || 'N/A';
              const winnerPitcher = (apiGame.W_PIT_P_NM || '').trim();
              const savePitcher = (apiGame.SV_PIT_P_NM || '').trim();
              const awayScore = parseInt(apiGame.T_SCORE_CN) || 0;
              const homeScore = parseInt(apiGame.B_SCORE_CN) || 0;
              const awayStartPitcherId = apiGame.T_PIT_P_ID;
              const homeStartPitcherId = apiGame.B_PIT_P_ID;
              const winnerPitcherId = apiGame.W_PIT_P_ID;

              // 최종 투수 결정: 승리투수가 있으면 승리투수 사용 (세이브 상관없이)
              let finalAwayPitcher = awayStartPitcher;
              let finalHomePitcher = homeStartPitcher;

              if (winnerPitcher && winnerPitcherId) {
                if (awayScore > homeScore) {
                  // 어웨이팀 승리: 승리투수가 선발투수와 다르면 승리투수 이름 사용
                  if (awayStartPitcherId && winnerPitcherId !== awayStartPitcherId) {
                    finalAwayPitcher = winnerPitcher;
                  }
                } else if (homeScore > awayScore) {
                  // 홈팀 승리: 승리투수가 선발투수와 다르면 승리투수 이름 사용
                  if (homeStartPitcherId && winnerPitcherId !== homeStartPitcherId) {
                    finalHomePitcher = winnerPitcher;
                  }
                }
              }

              todayGameMap[key] = {
                gameId: apiGame.G_ID || '',
                awayPitcher: finalAwayPitcher,
                homePitcher: finalHomePitcher,
                awayScore: awayScore,
                homeScore: homeScore
              };
            });

            gamesForDate.forEach(game => {
              const key = `${game.awayTeam}_${game.homeTeam}`;
              if (todayGameMap[key]) {
                game.gameId = todayGameMap[key].gameId;
                game.awayPitcher = todayGameMap[key].awayPitcher;
                game.homePitcher = todayGameMap[key].homePitcher;
                game.awayScore = todayGameMap[key].awayScore;
                game.homeScore = todayGameMap[key].homeScore;
              }
            });
          }
        } catch (error) {
          console.error(`Error fetching pitcher info for date ${gameDate}:`, error.message);
        }
      }
    }

    // 3. gameId가 있는 경기에 투수 정보 적용
    schedule.forEach(game => {
      if (game.gameId && pitcherCache[game.gameId]) {
        game.awayPitcher = pitcherCache[game.gameId].awayPitcher;
        game.homePitcher = pitcherCache[game.gameId].homePitcher;
      }
    });

    // 조회한 달이 이번 달이면 경기가 진행 중일 수 있으므로 짧게, 아니면 길게 캐시
    const now = new Date();
    const isCurrentMonth = String(now.getFullYear()) === String(year) &&
      String(now.getMonth() + 1).padStart(2, '0') === month;
    const ttlMs = isCurrentMonth ? 3 * 60 * 1000 : 60 * 60 * 1000;
    setResponseCache(cacheKey, schedule, ttlMs);

    res.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error.message);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Debug: 승리투수 변환된 경기 목록
app.get('/api/debug/pitcher-conversions/:month/:year', async (req, res) => {
  const { month, year } = req.params;
  const monthStr = String(month).padStart(2, '0');

  const conversions = [];

  try {
    const postData = new URLSearchParams({
      leId: '1',
      seasonId: year,
      month: monthStr,
      teamId: ''
    });

    const response = await axios.post(
      'https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList',
      postData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.koreabaseball.com/Schedule/Schedule.aspx',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    const data = response.data;
    const gameIds = new Set();

    if (data.rows && Array.isArray(data.rows)) {
      for (let row of data.rows) {
        if (row.row && Array.isArray(row.row)) {
          const cells = row.row;
          for (let j = 3; j < cells.length && cells.length > 5; j++) {
            if (cells[j] && cells[j].Text) {
              const $cell = cheerio.load(cells[j].Text);
              const gameLink = $cell('a').attr('href') || '';
              if (gameLink) {
                const gameIdMatch = gameLink.match(/gameId=([^&]+)/);
                if (gameIdMatch) gameIds.add(gameIdMatch[1]);
              }
            }
          }
        }
      }
    }

    // 추출한 gameId들에 대해 pitcher 정보 조회
    const dateGroups = {};
    for (const gameId of gameIds) {
      const gameDate = gameId.substring(0, 8);
      if (!dateGroups[gameDate]) dateGroups[gameDate] = [];
      dateGroups[gameDate].push(gameId);
    }

    for (const [gameDate, gameIdsForDate] of Object.entries(dateGroups)) {
      try {
        const pitcherRes = await axios.post(
          'https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList',
          new URLSearchParams({
            leId: '1',
            srId: '0',
            date: gameDate
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx'
            }
          }
        );

        if (pitcherRes.data && pitcherRes.data.game) {
          pitcherRes.data.game.forEach(apiGame => {
            const gameId = apiGame.G_ID;
            if (gameIdsForDate.includes(gameId)) {
              const awayStartPitcher = (apiGame.T_PIT_P_NM || '').trim();
              const homeStartPitcher = (apiGame.B_PIT_P_NM || '').trim();
              const winnerPitcher = (apiGame.W_PIT_P_NM || '').trim();
              const awayScore = parseInt(apiGame.T_SCORE_CN) || 0;
              const homeScore = parseInt(apiGame.B_SCORE_CN) || 0;
              const awayStartPitcherId = apiGame.T_PIT_P_ID;
              const homeStartPitcherId = apiGame.B_PIT_P_ID;
              const winnerPitcherId = apiGame.W_PIT_P_ID;

              // 승리투수가 있고, 선발투수와 다른 경우
              if (winnerPitcher && winnerPitcherId) {
                if (awayScore > homeScore && awayStartPitcherId && winnerPitcherId !== awayStartPitcherId) {
                  conversions.push({
                    gameId,
                    date: gameDate.slice(0, 4) + '-' + gameDate.slice(4, 6) + '-' + gameDate.slice(6),
                    away: apiGame.AWAY_NM,
                    home: apiGame.HOME_NM,
                    score: `${awayScore}-${homeScore}`,
                    from: awayStartPitcher,
                    to: winnerPitcher,
                    team: 'away'
                  });
                } else if (homeScore > awayScore && homeStartPitcherId && winnerPitcherId !== homeStartPitcherId) {
                  conversions.push({
                    gameId,
                    date: gameDate.slice(0, 4) + '-' + gameDate.slice(4, 6) + '-' + gameDate.slice(6),
                    away: apiGame.AWAY_NM,
                    home: apiGame.HOME_NM,
                    score: `${awayScore}-${homeScore}`,
                    from: homeStartPitcher,
                    to: winnerPitcher,
                    team: 'home'
                  });
                }
              }
            }
          });
        }
      } catch (error) {
        console.error(`Error fetching pitcher info for date ${gameDate}:`, error.message);
      }
    }

    res.json(conversions);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversions' });
  }
});

app.get('/api/game-detail/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;

    const response = await axios.post(
      'https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList',
      new URLSearchParams({
        leId: '1',
        srId: '0',
        date: gameId.substring(0, 8)
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx'
        }
      }
    );

    if (response.data && response.data.game) {
      const game = response.data.game.find(g => g.G_ID === gameId);
      if (game) {
        res.json({
          gameId: game.G_ID,
          awayTeam: game.AWAY_NM,
          homeTeam: game.HOME_NM,
          awayScore: parseInt(game.T_SCORE_CN) || 0,
          homeScore: parseInt(game.B_SCORE_CN) || 0,
          inning: game.GAME_INN_NO || 0,
          inningSide: game.GAME_TB_SC_NM || '',
          gameStatus: game.GAME_STATE_SC
        });
      } else {
        res.status(404).json({ error: 'Game not found' });
      }
    } else {
      res.status(404).json({ error: 'No game data' });
    }
  } catch (error) {
    console.error('Error fetching game detail:', error.message);
    res.status(500).json({ error: 'Failed to fetch game detail' });
  }
});

// 팀 순위 조회
app.get('/api/team-rank', async (req, res) => {
  try {
    const cacheKey = 'team-rank';
    if (!req.query.refresh) {
      const cached = getResponseCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const url = 'https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    });

    const $ = cheerio.load(response.data);

    // 오늘 날짜 기준
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateText = `${year}년 ${parseInt(month)}월${parseInt(day)}일 기준`;

    // 순위 테이블 데이터 추출 - 모든 table 검색
    const ranks = [];

    // 테이블 찾기 - 일반적인 순위 테이블 구조
    $('table').each((tableIdx, table) => {
      const rows = $(table).find('tbody tr, tr');

      rows.each((rowIdx, row) => {
        const cells = $(row).find('td, th');
        if (cells.length >= 8) {
          const rank = $(cells[0]).text().trim();
          const teamName = $(cells[1]).text().trim();
          const games = $(cells[2]).text().trim();
          const wins = $(cells[3]).text().trim();
          const losses = $(cells[4]).text().trim();
          const draws = $(cells[5]).text().trim();
          const winRate = $(cells[6]).text().trim();
          const gameDiff = $(cells[7]).text().trim();

          // 최근 10경기 연속 기록 추출
          let recent10 = '';
          if (cells.length >= 9) {
            const recentCell = $(cells[8]);
            const images = recentCell.find('img');

            if (images.length > 0) {
              // 이미지 alt/title에서 승패 추출
              recent10 = images.map((idx, img) => {
                const alt = $(img).attr('alt') || '';
                const title = $(img).attr('title') || '';
                const combined = (alt + title).toLowerCase();

                if (combined.includes('승')) return 'W';
                if (combined.includes('패')) return 'L';
                if (combined.includes('무') || combined.includes('draw')) return 'D';
                return '';
              }).get().join('');
            }

            // 이미지가 없거나 실패하면 텍스트에서 추출
            if (!recent10 || recent10.replace(/W|L|D/g, '').length > 0) {
              const cellText = recentCell.text().trim();
              if (cellText && cellText !== '-') {
                recent10 = cellText;
              } else if (!recent10) {
                recent10 = '-';
              }
            }
          }

          // 연속 기록 추출 (예: "2승", "1패")
          const streak = cells.length >= 10 ? $(cells[9]).text().trim() : '-';

          // 순위가 숫자이고 팀명이 있을 때만 추가
          if (rank && /^\d+$/.test(rank.trim())) {
            ranks.push({
              rank: rank.trim(),
              teamName,
              games,
              wins,
              losses,
              draws,
              winRate,
              gameDiff,
              recent10: recent10 || '-',
              streak: streak || '-'
            });
          }
        }
      });

      // 순위 데이터를 찾으면 더 이상 찾지 않음
      if (ranks.length > 5) {
        return false;
      }
    });

    const rankResult = {
      date: dateText,
      ranks: ranks
    };
    setResponseCache(cacheKey, rankResult, 30 * 60 * 1000);
    res.json(rankResult);

  } catch (error) {
    console.error('Error fetching team rank:', error.message);
    res.status(500).json({
      error: 'Failed to fetch team rank',
      message: error.message
    });
  }
});

// 경기장 좌표
const stadiumCoords = {
  '잠실': { lat: 37.5122, lon: 127.0719 },
  '고척': { lat: 37.4989, lon: 126.8672 },
  '수원': { lat: 37.2997, lon: 127.0100 },
  '대전': { lat: 36.3172, lon: 127.4290 },
  '창원': { lat: 35.2226, lon: 128.5822 },
  '광주': { lat: 35.1683, lon: 126.7894 },
  '사직': { lat: 35.1940, lon: 129.0614 },
  '대구': { lat: 35.8408, lon: 128.6813 },
  '문학': { lat: 37.4370, lon: 126.6931 },
  '청주': { lat: 36.6404, lon: 127.4849 },
  '포항': { lat: 36.0198, lon: 129.3434 }
};

// WMO 날씨 코드 → 한국어 설명
function getWeatherDescription(code) {
  const codeMap = {
    0: '맑음',
    1: '대체로 맑음',
    2: '구름 조금',
    3: '흐림',
    45: '안개',
    48: '서리',
    51: '이슬비',
    53: '이슬비',
    55: '이슬비',
    61: '비',
    63: '중간 정도 비',
    65: '강한 비',
    71: '눈',
    73: '중간 정도 눈',
    75: '강한 눈',
    77: '싸락눈',
    80: '소나기',
    81: '중간 소나기',
    82: '강한 소나기',
    85: '눈소나기',
    86: '강한 눈소나기',
    95: '뇌우',
    96: '우박',
    99: '강한 우박'
  };
  return codeMap[code] || '데이터 없음';
}

// 날씨 조회
app.get('/api/weather', async (req, res) => {
  try {
    const { stadium } = req.query;

    if (!stadium || !stadiumCoords[stadium]) {
      return res.status(400).json({ error: '유효하지 않은 경기장명' });
    }

    // date=YYYY-MM-DD 가 오면 그날 예보를, 없으면 현재 날씨를 돌려준다
    const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : null;

    const cacheKey = `weather:${stadium}:${requestedDate || 'today'}`;
    if (!req.query.refresh) {
      const cached = getResponseCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const { lat, lon } = stadiumCoords[stadium];
    let url = `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weathercode,windspeed_10m,precipitation,relative_humidity_2m` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&hourly=temperature_2m,weathercode,windspeed_10m,precipitation,relative_humidity_2m` +
      `&timezone=Asia/Seoul`;

    url += requestedDate
      ? `&start_date=${requestedDate}&end_date=${requestedDate}`
      : `&forecast_days=1`;

    const response = await axios.get(url);
    const daily = response.data.daily;

    // 미래 날짜는 경기 시각(18시)에 가까운 시간대 예보를 사용한다
    let snapshot;
    if (requestedDate && response.data.hourly) {
      const hourly = response.data.hourly;
      const idx = hourly.time.findIndex(t => t.endsWith('T18:00'));
      const i = idx >= 0 ? idx : 0;
      snapshot = {
        temperature_2m: hourly.temperature_2m[i],
        weathercode: hourly.weathercode[i],
        windspeed_10m: hourly.windspeed_10m[i],
        precipitation: hourly.precipitation[i],
        relative_humidity_2m: hourly.relative_humidity_2m[i]
      };
    } else {
      snapshot = response.data.current;
    }

    const weatherResult = {
      stadium,
      temperature: Math.round(snapshot.temperature_2m),
      temperatureMax: daily.temperature_2m_max[0],
      temperatureMin: daily.temperature_2m_min[0],
      weatherCode: snapshot.weathercode,
      weatherDesc: getWeatherDescription(snapshot.weathercode),
      windspeed: snapshot.windspeed_10m,
      humidity: snapshot.relative_humidity_2m,
      precipitation: snapshot.precipitation,
      precipitationSum: daily.precipitation_sum[0]
    };
    setResponseCache(cacheKey, weatherResult, 10 * 60 * 1000);
    res.json(weatherResult);
  } catch (error) {
    const upstream = error.response
      ? `HTTP ${error.response.status} ${JSON.stringify(error.response.data).slice(0, 200)}`
      : error.code || error.message;
    console.error('Error fetching weather:', upstream);
    res.status(500).json({ error: 'Failed to fetch weather', detail: upstream });
  }
});

// 투수 통계 및 라인업 조회
// 같은 경기를 동시에 여러 번 크롤링하지 않도록 진행 중인 작업을 공유한다
const pendingPreviews = {};

async function fetchGamePreview(awayPitcher, homePitcher, gameId) {
  const cached = getCachedData(gameId);
  if (cached) return cached;

  if (pendingPreviews[gameId]) return pendingPreviews[gameId];

  const task = (async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      console.log(`Fetching pitcher stats and lineup for: ${awayPitcher} vs ${homePitcher}`);

      // KBO GameCenter 페이지 로드
      // networkidle0은 광고·트래킹까지 기다려 느리므로, 필요한 요소가 나타나면 바로 진행한다
      await page.goto('https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      await page.waitForSelector('li[g_id]', { timeout: 10000 });

      // 게임 클릭
      if (gameId) {
        await page.evaluate((gId) => {
          const gameItem = document.querySelector(`li[g_id="${gId}"]`);
          if (gameItem) gameItem.click();
        }, gameId);

        // 투수 기록 테이블이 채워질 때까지 기다린다
        // 아직 발표 전인 경기는 끝내 나타나지 않으므로 오래 기다리지 않는다
        await page.waitForFunction(() => {
          const tables = document.querySelectorAll('table');
          for (const t of tables) {
            if (t.querySelectorAll('tbody tr').length > 0) return true;
          }
          return false;
        }, { timeout: 4000 }).catch(() => {});
      }

      // 병렬로 투수 통계와 라인업 데이터 추출
      const [pitcherData, lineupData] = await Promise.all([
        extractPitcherStats(page, awayPitcher, homePitcher),
        extractLineup(page)
      ]);

      const responseData = {
        awayData: pitcherData.awayData || null,
        homeData: pitcherData.homeData || null,
        lineup: lineupData
      };

      cacheData(gameId, responseData);
      return responseData;
    } finally {
      // 브라우저가 죽은 뒤라면 page.close()도 실패하므로 정리는 항상 진행되게 한다
      try {
        await page.close();
      } catch (e) {
        // 이미 닫힌 페이지면 무시
      }
      delete pendingPreviews[gameId];
    }
  })();

  pendingPreviews[gameId] = task;
  return task;
}

app.get('/api/pitcher-stats', async (req, res) => {
  try {
    const { awayPitcher, homePitcher, gameId } = req.query;

    if (!awayPitcher || !homePitcher) {
      return res.status(400).json({ awayData: null, homeData: null, lineup: null });
    }

    const data = await fetchGamePreview(awayPitcher, homePitcher, gameId);
    res.json(data);
  } catch (error) {
    console.error('Error in /api/pitcher-stats:', error.message);
    res.json({ awayData: null, homeData: null, lineup: null });
  }
});

// 프리뷰 미리 채우기 — 응답을 기다리지 않고 백그라운드에서 순차적으로 캐시를 채운다
app.post('/api/preview-warmup', express.json(), (req, res) => {
  const games = Array.isArray(req.body && req.body.games) ? req.body.games.slice(0, 6) : [];

  // 요청은 즉시 끝내고 수집은 뒤에서 진행한다
  res.json({ accepted: games.length });

  (async () => {
    for (const g of games) {
      if (!g || !g.gameId || !g.awayPitcher || !g.homePitcher) continue;
      if (getCachedData(g.gameId)) continue;
      try {
        await fetchGamePreview(g.awayPitcher, g.homePitcher, g.gameId);
      } catch (e) {
        console.error('Warmup failed for', g.gameId, e.message);
      }
    }
  })();
});

async function extractPitcherStats(page, awayPitcher, homePitcher) {
  return page.evaluate((awayName, homeName) => {
    const result = { awayData: null, homeData: null };
    const allTables = document.querySelectorAll('table');

    for (let table of allTables) {
      const rows = table.querySelectorAll('tbody tr');

      for (let row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) continue;

        const pitcherCell = cells[0];
        let pitcherName = '';
        let style = '';
        let record = '';

        const nameSpan = pitcherCell.querySelector('span.name');
        if (nameSpan) {
          pitcherName = nameSpan.textContent.trim();
        } else {
          pitcherName = pitcherCell.childNodes[0]?.textContent?.trim() || '';
        }

        const styleSpan = pitcherCell.querySelector('span.style');
        if (styleSpan) {
          style = styleSpan.textContent.trim();
        }

        const recordDiv = pitcherCell.querySelector('div.record');
        if (recordDiv) {
          record = recordDiv.textContent.trim();
        }

        let era = '', war = '', games = '', startAvgInning = '', qs = '', whip = '';
        if (cells.length >= 2) era = cells[1].textContent.trim();
        if (cells.length >= 3) war = cells[2].textContent.trim();
        if (cells.length >= 4) games = cells[3].textContent.trim();
        if (cells.length >= 5) startAvgInning = cells[4].textContent.trim();
        if (cells.length >= 6) qs = cells[5].textContent.trim();
        if (cells.length >= 7) whip = cells[6].textContent.trim();

        if (!result.awayData && (pitcherName.includes(awayName) || awayName.includes(pitcherName))) {
          result.awayData = { pitcherName, style, record, era, war, games, startAvgInning, qs, whip };
        }

        if (!result.homeData && (pitcherName.includes(homeName) || homeName.includes(pitcherName))) {
          result.homeData = { pitcherName, style, record, era, war, games, startAvgInning, qs, whip };
        }

        if (result.awayData && result.homeData) return result;
      }
    }

    return result;
  }, awayPitcher, homePitcher);
}

async function extractLineup(page) {
  // 라인업 탭 클릭 (javascript:setGameDetailSection('LINEUP') 방식)
  await page.evaluate(() => {
    // setGameDetailSection 함수 직접 호출
    if (typeof setGameDetailSection === 'function') {
      setGameDetailSection('LINEUP');
      return true;
    }

    // 또는 라인업 분석 링크 찾기
    const links = document.querySelectorAll('a');
    for (let link of links) {
      if (link.textContent.includes('라인업')) {
        link.click();
        return true;
      }
    }

    return false;
  });

  // WAR 합산 값이 채워지면 라인업 렌더링이 끝난 것으로 본다
  // 라인업 미발표 경기는 값이 오지 않으므로 짧게 끊는다
  await page.waitForFunction(() => {
    const el = document.querySelector('#txtLeftTableSetter');
    return el && el.textContent.trim() !== '';
  }, { timeout: 4000 }).catch(() => {});

  // 라인업 데이터 추출
  return page.evaluate(() => {
    const result = {
      warSummary: {},
      awayLineup: [],
      homeLineup: []
    };

    // WAR 합산 데이터 추출
    const warElements = {
      tableSetter: { away: null, home: null },
      cleanUp: { away: null, home: null },
      bottom: { away: null, home: null }
    };

    const txtElements = document.querySelectorAll('[id^="txt"]');
    for (let el of txtElements) {
      const id = el.id;
      const text = el.textContent.trim();

      if (id === 'txtLeftTableSetter') warElements.tableSetter.away = parseFloat(text) || 0;
      if (id === 'txtRightTableSetter') warElements.tableSetter.home = parseFloat(text) || 0;
      if (id === 'txtLeftCleanUp') warElements.cleanUp.away = parseFloat(text) || 0;
      if (id === 'txtRightCleanUp') warElements.cleanUp.home = parseFloat(text) || 0;
      if (id === 'txtLeftBottom') warElements.bottom.away = parseFloat(text) || 0;
      if (id === 'txtRightBottom') warElements.bottom.home = parseFloat(text) || 0;
    }

    result.warSummary = warElements;

    // 선수 라인업 테이블 추출
    const tables = document.querySelectorAll('.tbl-type04 table');

    if (tables.length >= 1) {
      const awayTable = tables[0];
      const awayRows = awayTable.querySelectorAll('tbody tr');
      awayRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 4) {
          result.awayLineup.push({
            order: parseInt(cells[0].textContent.trim()),
            position: cells[1].textContent.trim(),
            name: cells[2].textContent.trim(),
            war: parseFloat(cells[3].textContent.trim()) || 0
          });
        }
      });
    }

    if (tables.length >= 2) {
      const homeTable = tables[1];
      const homeRows = homeTable.querySelectorAll('tbody tr');
      homeRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 4) {
          result.homeLineup.push({
            order: parseInt(cells[0].textContent.trim()),
            position: cells[1].textContent.trim(),
            name: cells[2].textContent.trim(),
            war: parseFloat(cells[3].textContent.trim()) || 0
          });
        }
      });
    }

    return result;
  });
}


// 투수 WPA 조회
app.get('/api/pitcher-wpa', async (req, res) => {
  try {
    const { gameId, awayTeam, homeTeam } = req.query;

    if (!gameId) {
      return res.status(400).json({ awayWPA: [], homeWPA: [] });
    }

    const awayWPA = await getPitcherWPA(gameId, awayTeam);
    const homeWPA = await getPitcherWPA(gameId, homeTeam);

    res.json({
      awayWPA: awayWPA || [],
      homeWPA: homeWPA || []
    });
  } catch (error) {
    console.error('Error fetching pitcher WPA:', error.message);
    res.json({ awayWPA: [], homeWPA: [] });
  }
});

// 투수 통계 조회
async function getPitcherStats(pitcherName, gameId, year) {
  try {
    const gameDate = gameId.substring(0, 8);

    // KBO GameCenter API에서 경기 정보 조회
    const gameListResponse = await axios.post(
      'https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList',
      new URLSearchParams({
        leId: '1',
        srId: '0',
        date: gameDate
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    console.log(`Looking for pitcher: ${pitcherName}, gameId: ${gameId}`);
    console.log('Game list response:', JSON.stringify(gameListResponse.data).substring(0, 500));

    if (gameListResponse.data && gameListResponse.data.game && Array.isArray(gameListResponse.data.game)) {
      const gameData = gameListResponse.data.game.find(g => g.G_ID === gameId);

      if (gameData) {
        console.log('Found game data:', JSON.stringify(gameData).substring(0, 1000));

        // 투수 이름과 매칭되는지 확인
        const isPitcherHome = gameData.T_PIT_P_NM === pitcherName || (gameData.T_PIT_P_NM && gameData.T_PIT_P_NM.includes(pitcherName));
        const isPitcherAway = gameData.B_PIT_P_NM === pitcherName || (gameData.B_PIT_P_NM && gameData.B_PIT_P_NM.includes(pitcherName));

        console.log(`Is pitcher home: ${isPitcherHome}, Is pitcher away: ${isPitcherAway}`);
        console.log(`Home pitcher: ${gameData.T_PIT_P_NM}, Away pitcher: ${gameData.B_PIT_P_NM}`);

        if (isPitcherHome) {
          return {
            games: gameData.T_PIT_P_G || '-',
            wins: gameData.T_PIT_P_W || '-',
            losses: gameData.T_PIT_P_L || '-',
            era: gameData.T_PIT_P_ERA || '-',
            innings: gameData.T_PIT_P_IP || '-',
            strikeouts: gameData.T_PIT_P_SO || '-',
            qs: gameData.T_PIT_P_QS || '-',
            war: gameData.T_PIT_P_WAR || '-',
            whip: gameData.T_PIT_P_WHIP || '-',
            startAvgInning: gameData.T_PIT_P_STARTIP || '-'
          };
        }

        if (isPitcherAway) {
          return {
            games: gameData.B_PIT_P_G || '-',
            wins: gameData.B_PIT_P_W || '-',
            losses: gameData.B_PIT_P_L || '-',
            era: gameData.B_PIT_P_ERA || '-',
            innings: gameData.B_PIT_P_IP || '-',
            strikeouts: gameData.B_PIT_P_SO || '-',
            qs: gameData.B_PIT_P_QS || '-',
            war: gameData.B_PIT_P_WAR || '-',
            whip: gameData.B_PIT_P_WHIP || '-',
            startAvgInning: gameData.B_PIT_P_STARTIP || '-'
          };
        }
      } else {
        console.log('Game not found in list');
      }
    } else {
      console.log('No game array in response');
    }

    return null;
  } catch (error) {
    console.error('Error fetching pitcher stats:', error.message);
    return null;
  }
}

// 투수 WPA 조회
async function getPitcherWPA(gameId, teamName) {
  try {
    const response = await axios.get(
      `https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameId=${gameId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    const $ = cheerio.load(response.data);
    const wpaData = [];

    // WPA 테이블 찾기
    const tables = $('table');
    let teamFound = false;

    tables.each((idx, table) => {
      const headerText = $(table).find('thead tr:first th:first').text();
      if (headerText && headerText.includes(teamName)) {
        teamFound = true;
      }

      if (teamFound) {
        $(table).find('tbody tr').each((rowIdx, tr) => {
          if (wpaData.length >= 5) return;

          const cells = $(tr).find('td');
          if (cells.length >= 3) {
            const pitcherName = $(cells[0]).text().trim();
            const wpa = $(cells[cells.length - 1]).text().trim();

            if (pitcherName && wpa) {
              wpaData.push({
                name: pitcherName,
                wpa: wpa
              });
            }
          }
        });
      }
    });

    return wpaData.length > 0 ? wpaData : null;
  } catch (error) {
    console.error('Error fetching pitcher WPA:', error.message);
    return null;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at https://localhost:${PORT}`);
});
