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

### `GET /api/weather`
경기장의 당일 날씨 조회 (Open-Meteo API 사용)

| 파라미터 | 설명 | 예시 |
|---|---|---|
| `stadium` | 경기장명 | `잠실`, `고척`, `수원` ... |

**응답 필드**
- `stadium` — 경기장명
- `temperature` — 현재 기온 (°C)
- `temperatureMax` — 최고 기온 (°C)
- `temperatureMin` — 최저 기온 (°C)
- `weatherCode` — WMO 날씨 코드
- `weatherDesc` — 날씨 설명 (맑음, 흐림, 비 등)
- `windspeed` — 풍속 (m/s)
- `humidity` — 습도 (%)
- `precipitation` — 강수량 (mm)

---

## 주요 기능

- 연도 / 월별 경기 일정 조회
- 팀별 필터링 (10개 KBO 팀)
- 경기 상태 구분: 예정 / 진행중 / 종료 / 취소
- 선발 투수 및 승패 표시
- 달력 UI — 경기가 있는 날짜만 선택 가능, 월 단위로 데이터 로드
- 진행중인 경기 이닝 및 실시간 스코어 표시
- 팀 순위 조회 — RANK 퀵메뉴로 현재 순위 확인
- **날씨 조회** — WEATHER 퀵메뉴로 오늘 경기장의 당일 날씨 정보 표시 (기온, 풍속, 습도, 강수량)
- 상단으로 스크롤 버튼

---

## 최근 UI 개선사항 (2026-05-07)

### 선발투수 전력분석 모달

**오늘 경기만 미리보기 활성화**
- 지난 경기는 클릭 불가능 (today 경기만 `.schedule__game` 커서 포인터 활성화)
- 게임 디테일 모달에 탭 인터페이스 추가

**탭 디자인 (Pill-shaped)**
- 컨테이너: 반투명 회색 배경(`rgba(51, 51, 51, 0.15)`) + 둥근 모서리(border-radius: 20px)
- 비활성 탭: 투명 배경, 반투명 텍스트(`rgba(51, 51, 51, 0.6)`)
- 활성 탭: 흰색 배경, 진회색 텍스트(#333), 활성 표시 기호(♧) 추가

**탭 콘텐츠**
- 선발투수 전력분석: 투수 통계 비교 테이블
  - 추출 데이터: 경기, 평균자책점(ERA), 선발평균이닝, QS, WAR, WHIP
  - 비교 방식: 더 나은 통계값을 빨간색(#a92424)으로 강조
  - 투수 정보: 로고, 이름, 스타일(우투/좌투), 시즌 기록
- 라인업분석: 준비 중 메시지 (기능 미구현)

**투수 정보 카드 스타일**
- border-radius 제거
- border를 위아래(top/bottom)만으로 변경

### 투수 데이터 추출 최적화
- Puppeteer 기반 KBO GameCenter 크롤링
- 네트워크 대기 모드: `networkidle0` (기존: networkidle2)
- 페이지 로드 타임아웃: 15초 (기존: 30초)
- 요소 대기: 1.5초 (기존: 3초)
- 결과: 예상 대기 시간 감소 (3-4초 범위)

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
