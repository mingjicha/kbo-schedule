# ⚾ KBO 경기 일정 뷰어

KBO 공식 사이트의 데이터를 기반으로 경기 일정, 점수, 투수 정보를 확인할 수 있는 비공식 웹 서비스입니다.

---

## 기술 스택

### 백엔드
| 기술 | 용도 |
|---|---|
| Node.js | 런타임 |
| Express | HTTP 서버, REST API, 정적 파일 서빙 |
| axios | KBO 공식 사이트 API HTTP 요청 |
| cheerio | API 응답에 포함된 HTML 조각(팀명, 점수 등) 파싱 |

### 프론트엔드
| 기술 | 용도 |
|---|---|
| HTML / CSS | 페이지 구조 및 스타일링 |
| JavaScript (Vanilla ES6+) | UI 동작, API 호출, DOM 조작 |
| Bootstrap 5 | UI 컴포넌트, 레이아웃 |
| Bootstrap Icons | 아이콘 |
| Flatpickr | 날짜 달력 picker |

> 빌드 도구(Webpack, Vite 등) 및 프론트엔드 프레임워크(React, Vue 등) 미사용

---

## API

### `GET /api/schedule`
월별 경기 일정 조회

| 파라미터 | 설명 | 예시 |
|---|---|---|
| `year` | 연도 | `2026` |
| `month` | 월 (2자리) | `04` |
| `team` | 팀 코드 (전체: 빈값) | `LG`, `HH`, `SK` ... |

**응답 필드**
- `date` — 경기 날짜 (MM.DD(요일))
- `time` — 경기 시작 시간
- `awayTeam` / `homeTeam` — 원정/홈 팀명
- `awayScore` / `homeScore` — 원정/홈 점수 (예정 경기는 `null`)
- `status` — 경기 상태 (`예정` / `종료` / `취소`)
- `stadium` — 경기장
- `winner` — 승리 팀 (`away` / `home` / `null`)
- `gameId` — 경기 고유 ID
- `awayPitcher` / `homePitcher` — 선발 투수명

**투수 정보 처리 방식**
- 종료된 경기: `gameId` 기준으로 `GetKboGameList` API를 날짜별로 병렬 호출하여 캐시 후 적용
- 예정/오늘 경기(`gameId` 없음): 경기 날짜를 기준으로 API를 호출하여 팀명 매칭으로 투수 정보 및 `gameId` 보완

---

### `GET /api/pitcher/:gameId`
특정 경기의 선발 투수 정보 조회

**응답 필드**
- `awayPitcher` — 원정팀 선발 투수
- `homePitcher` — 홈팀 선발 투수

---

### `GET /api/game-detail/:gameId`
진행 중인 경기의 실시간 정보 조회

**응답 필드**
- `awayScore` / `homeScore` — 현재 점수
- `inning` — 현재 이닝
- `inningSide` — 초 / 말
- `gameStatus` — 경기 진행 상태 코드

---

## 주요 기능

- 연도 / 월별 경기 일정 조회
- 팀별 필터링 (10개 KBO 팀)
- 경기 상태 구분: 예정 / 진행중 / 종료 / 취소
- 선발 투수 및 승패 표시
- 달력 UI — 경기가 있는 날짜만 선택 가능, 월 단위로 데이터 로드
- 진행중인 경기 이닝 실시간 표시
- 상단으로 스크롤 버튼

---

## 팀 코드표

| 코드 | 팀명 |
|---|---|
| LG | LG |
| HH | 한화 |
| SK | SSG |
| SS | 삼성 |
| NC | NC |
| KT | KT |
| LT | 롯데 |
| HT | KIA |
| OB | 두산 |
| WO | 키움 |

---

## 실행 방법

```bash
npm install
node server.js
```

서버 실행 후 `http://localhost:5000` 접속

---

> 본 서비스는 KBO 공개 데이터를 기반으로 한 비공식 서비스입니다.  
> 데이터는 제공처 사정에 따라 지연되거나 부정확할 수 있습니다.
