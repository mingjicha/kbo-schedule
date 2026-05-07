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

            if (noteText === '취소' || noteText === '우천취소' || noteText === '기타' ||
                noteText.includes('취소') || noteText.includes('우천')) {
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
                const awayPitcherName = (apiGame.T_PIT_P_NM || '').trim();
                const homePitcherName = (apiGame.B_PIT_P_NM || '').trim();

                if (gameId) {
                  pitcherCache[gameId] = {
                    awayPitcher: awayPitcherName || 'N/A',
                    homePitcher: homePitcherName || 'N/A'
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
              todayGameMap[key] = {
                gameId: apiGame.G_ID || '',
                awayPitcher: (apiGame.T_PIT_P_NM || '').trim() || 'N/A',
                homePitcher: (apiGame.B_PIT_P_NM || '').trim() || 'N/A',
                awayScore: parseInt(apiGame.T_SCORE_CN) || 0,
                homeScore: parseInt(apiGame.B_SCORE_CN) || 0
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

    res.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error.message);
    res.status(500).json({ error: 'Failed to fetch schedule' });
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
              recent10: recent10 || '-'
            });
          }
        }
      });

      // 순위 데이터를 찾으면 더 이상 찾지 않음
      if (ranks.length > 5) {
        return false;
      }
    });

    res.json({
      date: dateText,
      ranks: ranks
    });

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
  '청주': { lat: 36.6404, lon: 127.4849 }
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

    const { lat, lon } = stadiumCoords[stadium];
    const url = `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weathercode,windspeed_10m,precipitation,relative_humidity_2m` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&timezone=Asia/Seoul&forecast_days=1`;

    const response = await axios.get(url);
    const current = response.data.current;
    const daily = response.data.daily;

    res.json({
      stadium,
      temperature: Math.round(current.temperature_2m),
      temperatureMax: daily.temperature_2m_max[0],
      temperatureMin: daily.temperature_2m_min[0],
      weatherCode: current.weathercode,
      weatherDesc: getWeatherDescription(current.weathercode),
      windspeed: current.windspeed_10m,
      humidity: current.relative_humidity_2m,
      precipitation: current.precipitation,
      precipitationSum: daily.precipitation_sum[0]
    });
  } catch (error) {
    console.error('Error fetching weather:', error.message);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

// 투수 통계 조회 - Puppeteer로 KBO GameCenter 페이지에서 테이블 데이터 크롤링
app.get('/api/pitcher-stats', async (req, res) => {
  let browser = null;
  try {
    const { awayPitcher, homePitcher, gameId } = req.query;

    if (!awayPitcher || !homePitcher) {
      return res.status(400).json({ awayData: null, homeData: null });
    }

    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    console.log(`Fetching pitcher stats for: ${awayPitcher} vs ${homePitcher}`);

    // KBO GameCenter 페이지 로드
    await page.goto('https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx', {
      waitUntil: 'networkidle0',
      timeout: 15000
    });

    // 페이지 로드 대기
    await new Promise(resolve => setTimeout(resolve, 1500));

    // gameId에 해당하는 게임 찾고 클릭해서 프리뷰 활성화
    if (gameId) {
      const activated = await page.evaluate((gId) => {
        const gameItem = document.querySelector(`li[g_id="${gId}"]`);
        if (gameItem) {
          gameItem.click();
          return true;
        }
        return false;
      }, gameId);

      console.log(`Game activated: ${activated}`);

      // 프리뷰 렌더링 대기
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // 페이지 HTML 캡처 (디버그)
    const pageHtml = await page.content();
    console.log('Page HTML length:', pageHtml.length);
    console.log('Contains preview:', pageHtml.includes('preview'));
    console.log('Contains table:', pageHtml.includes('<table'));

    // 프리뷰 테이블에서 데이터 추출
    const pitcherData = await page.evaluate((awayName, homeName) => {
      const result = { awayData: null, homeData: null };

      // 모든 가능한 컨테이너 찾기
      const allDivs = document.querySelectorAll('div[class*="preview"], div[class*="detail"], div[class*="info"]');
      console.log(`Found ${allDivs.length} potential containers`);

      // 모든 테이블 찾기
      const allTables = document.querySelectorAll('table');
      console.log(`Total tables in page: ${allTables.length}`);

      // 각 테이블 구조 확인
      for (let i = 0; i < allTables.length; i++) {
        const table = allTables[i];
        const rows = table.querySelectorAll('tbody tr');
        console.log(`Table ${i}: ${rows.length} rows`);

        for (let row of rows) {
          const cells = row.querySelectorAll('td');
          console.log(`Row has ${cells.length} cells`);

          if (cells.length < 2) continue;

          const pitcherCell = cells[0].textContent.trim();
          console.log(`Cell content: "${pitcherCell}"`);

          // 각 셀에서 필요한 정보 추출
          // KBO 테이블 순서: 평균자책점, WAR, 경기, 선발평균이닝, QS, WHIP
          let era = '', war = '', games = '', startAvgInning = '', qs = '', whip = '';

          if (cells.length >= 2) era = cells[1].textContent.trim();
          if (cells.length >= 3) war = cells[2].textContent.trim();
          if (cells.length >= 4) games = cells[3].textContent.trim();
          if (cells.length >= 5) startAvgInning = cells[4].textContent.trim();
          if (cells.length >= 6) qs = cells[5].textContent.trim();
          if (cells.length >= 7) whip = cells[6].textContent.trim();

          // 투수 이름으로 매칭
          if (!result.awayData && pitcherCell.includes(awayName)) {
            result.awayData = { pitcherName: pitcherCell, era, war, games, startAvgInning, qs, whip };
            console.log(`Matched away pitcher: ${awayName}`);
          }

          if (!result.homeData && pitcherCell.includes(homeName)) {
            result.homeData = { pitcherName: pitcherCell, era, war, games, startAvgInning, qs, whip };
            console.log(`Matched home pitcher: ${homeName}`);
          }

          if (result.awayData && result.homeData) return result;
        }
      }

      return result;
    }, awayPitcher, homePitcher);

    console.log('API Response received');
    console.log('Final data:', pitcherData);

    res.json({
      awayData: pitcherData.awayData || null,
      homeData: pitcherData.homeData || null
    });

  } catch (error) {
    console.error('Error in /api/pitcher-stats:', error.message);
    res.json({ awayData: null, homeData: null });
  } finally {
    if (browser) await browser.close();
  }
});


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
