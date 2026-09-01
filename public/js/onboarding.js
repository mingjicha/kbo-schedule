// Onboarding Coachmark
const ONBOARDING_KEY = 'kbo-onboarding-done';
const ONBOARDING_PREVIEW_KEY = 'kbo-onboarding-preview-done';

const onboardingEl = document.getElementById('onboarding');
const spotlightEl = document.getElementById('onboardingSpotlight');
const coachEl = document.getElementById('onboardingCoach');
const arrowEl = document.getElementById('onboardingArrow');
const stepEl = document.getElementById('onboardingStep');
const titleEl = document.getElementById('onboardingTitle');
const descEl = document.getElementById('onboardingDesc');
const skipBtn = document.getElementById('onboardingSkip');
const nextBtn = document.getElementById('onboardingNext');

function isVisible(el) {
  return !!el && el.getBoundingClientRect().height > 0;
}

// 모바일은 팀 선택 버튼, 데스크톱은 팀 버튼 목록을 가리킨다
function getTeamFilterTarget() {
  const summary = document.getElementById('filterSummaryBtn');
  if (isVisible(summary)) return summary;
  const teams = document.getElementById('filterTeams');
  return isVisible(teams) ? teams : null;
}

const basicSteps = [
  {
    target: getTeamFilterTarget,
    title: '보고 싶은 팀만 골라보세요',
    desc: '응원하는 팀 경기만 모아서 볼 수 있어요.'
  },
  {
    target: () => document.getElementById('calendarBtn'),
    title: '날짜로 바로 이동해요',
    desc: '경기가 있는 날짜를 골라 그날 일정으로 이동할 수 있어요.'
  },
  {
    target: () => document.getElementById('todayMenuBtn'),
    title: '오늘 경기로 바로 이동',
    desc: '언제든 눌러서 오늘 경기 일정으로 돌아올 수 있어요.',
    key: ONBOARDING_KEY
  }
];

const previewStep = {
  target: () => document.querySelector('.schedule__day--today .schedule__game'),
  title: '예정된 경기는 눌러보세요',
  desc: '선발투수 기록과 라인업을 미리 확인할 수 있어요.',
  key: ONBOARDING_PREVIEW_KEY
};

let currentStep = 0;
let activeSteps = [];
let onFinishCallback = null;

function positionCoachmark(target) {
  const rect = target.getBoundingClientRect();
  const pad = 6;

  spotlightEl.style.left = (rect.left - pad) + 'px';
  spotlightEl.style.top = (rect.top - pad) + 'px';
  spotlightEl.style.width = (rect.width + pad * 2) + 'px';
  spotlightEl.style.height = (rect.height + pad * 2) + 'px';
  spotlightEl.style.borderRadius = rect.height > 56 ? '16px' : '100px';

  const gap = 14;
  const coachWidth = Math.min(250, window.innerWidth - 24);
  coachEl.style.maxWidth = coachWidth + 'px';

  let left = rect.left + rect.width / 2 - coachWidth / 2;
  left = Math.max(12, Math.min(left, window.innerWidth - coachWidth - 12));
  coachEl.style.left = left + 'px';

  const spaceBelow = window.innerHeight - rect.bottom;
  const showBelow = spaceBelow > 190;

  if (showBelow) {
    coachEl.style.top = (rect.bottom + pad + gap) + 'px';
    coachEl.style.bottom = 'auto';
    arrowEl.style.top = '-6px';
    arrowEl.style.bottom = 'auto';
  } else {
    coachEl.style.bottom = (window.innerHeight - rect.top + pad + gap) + 'px';
    coachEl.style.top = 'auto';
    arrowEl.style.bottom = '-6px';
    arrowEl.style.top = 'auto';
  }

  const arrowLeft = rect.left + rect.width / 2 - left - 6;
  arrowEl.style.left = Math.max(14, Math.min(arrowLeft, coachWidth - 26)) + 'px';
}

function renderStep() {
  const step = activeSteps[currentStep];
  const target = step.target();
  if (!target) {
    finishOnboarding();
    return;
  }

  const rect = target.getBoundingClientRect();
  if (rect.top < 0 || rect.bottom > window.innerHeight) {
    const body = document.body;
    const wasLocked = body.classList.contains('body--no-scroll');
    if (wasLocked) body.style.overflow = 'visible';
    target.scrollIntoView({ block: 'center' });
    if (wasLocked) body.style.overflow = '';
  }

  stepEl.textContent = `${currentStep + 1} / ${activeSteps.length}`;
  titleEl.textContent = step.title;
  descEl.textContent = step.desc;

  const isLast = currentStep === activeSteps.length - 1;
  nextBtn.textContent = isLast ? '확인했어요' : '다음';
  skipBtn.style.visibility = isLast ? 'hidden' : 'visible';

  positionCoachmark(target);
}

function markDone(key) {
  try {
    localStorage.setItem(key, '1');
  } catch (e) {
    // 저장소 접근이 막혀도 이번 세션에서는 다시 뜨지 않음
  }
}

function isDone(key) {
  try {
    return !!localStorage.getItem(key);
  } catch (e) {
    return true;
  }
}

function finishOnboarding() {
  onboardingEl.classList.remove('show');
  document.body.classList.remove('body--no-scroll');

  activeSteps.forEach(step => {
    if (step.key) markDone(step.key);
  });

  if (onFinishCallback) {
    const cb = onFinishCallback;
    onFinishCallback = null;
    setTimeout(cb, 100);
  }
}

function startOnboarding(steps, onFinish) {
  activeSteps = steps.filter(step => step.target());
  if (activeSteps.length === 0) {
    if (onFinish) onFinish();
    return;
  }

  onFinishCallback = onFinish || null;
  currentStep = 0;
  onboardingEl.classList.add('show');
  document.body.classList.add('body--no-scroll');
  renderStep();
}

if (onboardingEl) {
  nextBtn.addEventListener('click', () => {
    if (currentStep < activeSteps.length - 1) {
      currentStep++;
      renderStep();
    } else {
      finishOnboarding();
    }
  });

  skipBtn.addEventListener('click', finishOnboarding);

  window.addEventListener('resize', () => {
    if (!onboardingEl.classList.contains('show')) return;
    const target = activeSteps[currentStep].target();
    if (target) positionCoachmark(target);
  });
}

function shouldShowOnboarding() {
  return !(isDone(ONBOARDING_KEY) && isDone(ONBOARDING_PREVIEW_KEY));
}

function maybeStartOnboarding(onFinish) {
  if (!shouldShowOnboarding()) {
    if (onFinish) onFinish();
    return;
  }

  const basicDone = isDone(ONBOARDING_KEY);
  // 기본 안내를 아직 못 봤으면 전체를, 봤으면 남은 프리뷰 안내만 보여준다
  const steps = basicDone ? [previewStep] : basicSteps.concat(previewStep);

  // 카드가 그려진 직후라 레이아웃이 잡힐 만큼만 기다린다
  setTimeout(() => startOnboarding(steps, onFinish), 200);
}
