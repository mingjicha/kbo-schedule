const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 5000;

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
    homePitcher: 'N/A'
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

async function getPitcherInfo(gameId) {
  try {
    // gameId에서 게임 날짜 추출 (YYYYMMDD 형식)
    const gameDate = gameId.substring(0, 8);

    const response = await axios.post(
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

    if (response.data && response.data.game && Array.isArray(response.data.game)) {
      const game = response.data.game.find(g => g.G_ID === gameId);
      if (game) {
        const cleanPitcherName = (name) => {
          if (!name) return 'N/A';
          return name.trim().replace(/\s+/g, ' ');
        };
        return {
          awayPitcher: cleanPitcherName(game.T_PIT_P_NM),
          homePitcher: cleanPitcherName(game.B_PIT_P_NM)
        };
      }
    }

    return {
      awayPitcher: 'N/A',
      homePitcher: 'N/A'
    };
  } catch (error) {
    console.error('Error fetching pitcher info:', error.message);
    return {
      awayPitcher: 'N/A',
      homePitcher: 'N/A'
    };
  }
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

app.get('/api/pitcher/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const pitcherInfo = await getPitcherInfo(gameId);
    res.json(pitcherInfo);
  } catch (error) {
    console.error('Error fetching pitcher info:', error.message);
    res.status(500).json({ error: 'Failed to fetch pitcher info' });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
