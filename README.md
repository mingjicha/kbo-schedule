# ⚾ AI를 활용한 KBO 일정 및 정보 확인 사이트

KBO 공식 데이터와 AI 기반 분석을 결합하여 한국야구 경기 일정, 점수, 투수 정보, 팀 순위 및 날씨 정보를 제공하는 웹 서비스입니다.

---

## 주요 기능

- **경기 일정 조회**: 연도, 월별로 KBO 경기 일정 확인
- **팀별 필터링**: 10개 KBO 팀 중 선택하여 경기 일정 필터링
- **선발 투수 전력분석**: AI 기반 투수 데이터 비교 분석 (ERA, WAR, WHIP 등)
- **팀 순위 조회**: 실시간 팀 순위 정보 확인
- **날씨 정보**: 경기장별 당일 날씨 조회 (기온, 풍속, 습도, 강수량)
- **실시간 경기 정보**: 진행 중인 경기의 이닝 및 스코어 실시간 표시
- **반응형 디자인**: 데스크톱, 태블릿, 모바일 모든 기기 지원

---

## 기술 스택

### 백엔드
- **Node.js** / **Express** — 서버 구축 및 REST API 개발
- **Puppeteer** — KBO GameCenter 크롤링 및 투수 데이터 추출
- **Axios** — HTTP 요청 처리
- **Cheerio** — HTML 파싱

### 프론트엔드
- **HTML5 / CSS3** — 페이지 구조 및 반응형 스타일링
- **Vanilla JavaScript (ES6+)** — UI 동작 및 상태 관리
- **Bootstrap 5** — UI 컴포넌트
- **Flatpickr** — 날짜 선택기

### 외부 API
- **KBO 공식 사이트 API** — 경기 일정, 점수 데이터
- **Open-Meteo API** — 날씨 정보

### AI
- **Claude (Anthropic)** — 개발 및 코드 작성 지원

---

## 배포

- **Railway** — Node.js 서버 배포
- **배포 주소**: https://kbo-schedule-production.up.railway.app/
- 자동 빌드 및 배포 파이프라인 구성

---

## 팀 코드

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
npm start
```

서버 실행 후 `http://localhost:5000` 접속

---

> 본 서비스는 KBO 공개 데이터를 기반으로 한 비공식 서비스입니다.
