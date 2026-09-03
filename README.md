<div align="center">

# ⚾ KBO 경기 일정

KBO 경기 일정 · 실시간 스코어 · 투수 전력분석 · 팀 순위 · 구장 날씨

[![Live](https://img.shields.io/badge/Live-Railway-0B0D0E?style=flat-square&logo=railway)](https://kbo-schedule-production.up.railway.app/)
[![Node](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://kbo-schedule-production.up.railway.app/)

**→ [kbo-schedule-production.up.railway.app](https://kbo-schedule-production.up.railway.app/)**

</div>

---

## 무엇을 푸는 프로젝트인가

KBO는 공개 REST API를 제공하지 않는다. 데이터를 얻으려면 **내부 ASMX 엔드포인트 호출**과
**GameCenter 렌더링 결과 크롤링**을 병행해야 하고, Puppeteer 크롤링은 요청당 수 초가 걸린다.

따라서 이 프로젝트의 핵심 과제는 화면 구현이 아니라 **크롤링 비용을 어떻게 통제하느냐**다.

- 경기 결과는 확정되면 불변 → 영구 캐싱 가능
- 오늘 경기는 이닝·주자 상황이 분 단위로 변동 → 짧은 주기 필요
- 미래 일정은 편성이 조정될 수 있음 → 하루 단위 갱신

이 세 성질을 **시점별 차등 캐싱 정책**으로 분리한 것이 아래 구조다.

---

## 캐싱 전략

### 시점별 갱신 주기

캐시는 서버에 존재한다. **최초 1명이 받아온 데이터를 이후 모든 사용자가 공유**한다.

| 구분 | 갱신 주기 | 파일 저장 | 근거 |
|---|:---:|:---:|---|
| 과거 경기 | 없음 | ✅ | 결과 확정 · 불변 |
| 오늘 · 오전 | 30분 | — | 편성 변경 가능성 낮음 |
| 오늘 · 정오 이후 | 10분 | — | 우천 취소 · 시간 변경 발생 |
| 오늘 · 경기 중 | 1분 | — | 이닝 · 주자 · 키플레이어 변동 |
| 오늘 · 전 경기 종료 | 자정까지 정지 | ✅ | 과거로 확정 |
| 미래 경기 | 하루 1회 (자정) | — | 일정 조정 여지 |

```js
function currentMonthTtl(schedule, now) {
  const todayGames = getTodayGames(schedule, now);
  if (hasLiveGame(todayGames))     return 1 * MINUTE;        // 실시간 변동
  if (allTodayGamesDone(todayGames)) return msUntilMidnight(now); // 확정
  return now.getHours() >= 12 ? 10 * MINUTE : 30 * MINUTE;
}
```

### 3단 캐시

```
요청 ──▶ ① 메모리 (responseCache)
         ↓ miss
       ② 디스크 JSON (data/schedule/)
         ↓ miss
       ③ KBO 크롤링 ──▶ 결과를 ①②에 적재
```

**콜드 스타트 대응** — Railway는 배포마다 파일시스템이 초기화되지만, 재시작 시에는 유지된다.
과거 달은 메모리가 비어도 디스크에서 즉시 응답한다.

```
과거 달  : 0.22s  (파일 히트, 크롤링 없음)
이번 달  : 1.24s → 0.21s  (첫 요청 크롤링 → 이후 메모리 히트)
```

### 종료 시점 확정 저장

오늘 경기의 `status`가 전부 `종료`/`취소`가 되면 그 시점에 JSON으로 굳혀 과거 데이터로 전환한다.
경기가 없는 날(빈 배열)을 확정 저장하지 않도록 가드를 둔다.

```js
const isSettled = monthKind === 'past' ||
  (isCurrentMonth && allTodayGamesDone(getTodayGames(schedule, now)));
```

### 포스트시즌 키 분리

포스트시즌과 정규시즌이 같은 캐시 키를 공유하면 **포스트시즌 화면에 정규시즌 경기가 노출된다.**
시리즈별로 키와 파일을 분리한다.

```
2025-10.json       정규시즌 10월   9경기 (10.01~)
2025-10-ks.json    한국시리즈      5경기 (10.26~)
```

클라이언트 `localStorage` 캐시도 동일 기준으로 만료시킨다.
이번 달을 하루 종일 유효 처리하면 서버를 아무리 갱신해도 브라우저가 과거 데이터를 계속 사용하게 된다.

---

## 배포 후 자동 반영

정적 자산 캐시로 인해 배포 후에도 사용자가 구버전을 유지하는 문제를 해결한다.

```
서버 기동 ──▶ BUILD_ID = Date.now()
                 │
프론트 5분 주기 ──▶ GET /api/version
                 │
         값 변경 감지 ──▶ Cache Storage 삭제 ──▶ location.reload()
```

- 프로세스 시작 시각을 배포 식별자로 사용 — 배포 시에만 변경되고 동일 프로세스 내에서는 고정
- **모달·시트가 열려 있으면 보류** 후 닫힌 시점에 갱신 (조작 중단 방지)
- `index.html` · `service-worker.js`에 `no-cache` 적용 → Service Worker 버전 수동 관리 불필요

```js
function isSafeToReload() {
  return !document.querySelector(
    '.modal.show, .team-sheet-overlay.show, .calendar-sheet-overlay.show, .onboarding.show'
  );
}
```

---

## 크롤링 구조

### Axios + Cheerio — 정적

| 대상 | 엔드포인트 |
|---|---|
| 경기 일정 | `Schedule.asmx/GetScheduleList` (`srIdList`로 정규/포스트시즌 구분) |
| 경기 결과 | `Main.asmx/GetKboGameList` |
| 팀 순위 | `TeamRankDaily.aspx` HTML 파싱 |
| 투수 WPA | 기록실 페이지 파싱 |

### Puppeteer — 동적

GameCenter는 JS 렌더링 이후에야 데이터가 노출되어 헤드리스 브라우저가 필요하다.

- 투수 통계(ERA · WAR · WHIP · QS) 및 라인업 추출
- **브라우저 인스턴스 싱글톤 재사용** — 요청마다 실행하면 수 초의 부팅 비용 발생
- 연결 끊김 감지 후 재생성 (`browserInstance.connected`)
- 경기 상세는 별도 캐시로 재크롤링 억제

---

## API

| Method | Endpoint | 설명 |
|:---:|---|---|
| `GET` | `/api/schedule` | 월별 일정 · `year` `month` `team` `series` |
| `GET` | `/api/postseason` | 시리즈 목록 및 경기 유무 |
| `GET` | `/api/game-detail/:gameId` | 경기 상세 |
| `GET` | `/api/team-rank` | 팀 순위 |
| `GET` | `/api/weather` | 구장 날씨 (Open-Meteo) |
| `GET` | `/api/pitcher-stats` | 선발 투수 전력분석 |
| `GET` | `/api/key-players` | 키플레이어 |
| `GET` | `/api/game-review` · `/api/game-highlight` | 종료 경기 리뷰 · 하이라이트 |
| `GET` | `/api/today-games-status` | 오늘 경기 실시간 상태 |
| `GET` | `/api/version` | 배포 식별자 |

---

## 기능

경기 일정 조회 · 포스트시즌(와일드카드 ~ 한국시리즈, 우승팀 배너) · 구단별 필터 ·
선발 투수 전력분석 · 팀 순위 · 구장 날씨 · 실시간 이닝/스코어 · 종료 후 리뷰/하이라이트 ·
PWA 설치 · 반응형(데스크톱 · 태블릿 · 모바일)

---

## 기술 스택

**Backend** Node.js · Express · Puppeteer · Axios · Cheerio
**Frontend** Vanilla JavaScript (ES6+) · Service Worker · Flatpickr
**External** KBO 공식 API · Open-Meteo
**Infra** Railway (`main` push 시 자동 배포)
**AI** Claude (Anthropic) — 개발 지원

---

## 구조

```
kbo-schedule/
├── server.js              # API · 크롤링 · 캐시 정책
├── data/schedule/         # 확정 일정 JSON
└── public/
    ├── service-worker.js  # 오프라인 캐시 (network-first)
    ├── js/
    │   ├── main.js        # 진입점 · 배포 감지
    │   ├── schedule.js    # 일정 렌더링 · 클라이언트 캐시
    │   ├── modal.js       # 상세 · 순위 · 날씨
    │   ├── ui.js          # 헤더 · 네비게이션 · TODAY
    │   ├── calendar.js    # 날짜 선택
    │   └── onboarding.js  # 첫 방문 안내
    └── styles/
```

---

## 팀 코드

| 코드 | 팀 | 코드 | 팀 |
|:---:|---|:---:|---|
| `LG` | LG 트윈스 | `KT` | KT 위즈 |
| `OB` | 두산 베어스 | `LT` | 롯데 자이언츠 |
| `HH` | 한화 이글스 | `HT` | KIA 타이거즈 |
| `SK` | SSG 랜더스 | `NC` | NC 다이노스 |
| `SS` | 삼성 라이온즈 | `WO` | 키움 히어로즈 |

---

## 실행

```bash
npm install
npm start
```

`http://localhost:5000`

---

<div align="center">

KBO 공개 데이터 기반 **비공식 서비스**

</div>
