// --- Константы ---
const RATE = 0.20; // 20% годовых
const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 100000;
const TERMS = [3, 6, 9, 12];
const STORAGE_KEY = 'installment-completed';

// --- Состояние ---
let state = {
  amount: 100000,
  term: 12,
  payment: null,
  serviceFee: null
};

// Для возврата с инфо-баннера на нужный экран
let infoBackHash = '';

// --- Утилиты ---
function formatMoney(num) {
  return num.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
}
function formatMoneyPrecise(num) {
  return num.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 });
}

function calcPayment(amount, term) {
  const monthlyRate = RATE / 12;
  const n = term;
  const payment = amount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  return Math.round(payment);
}
function calcServiceFee(amount, term) {
  // Сумма всех процентов за год (если срок < 12 мес — пропорционально)
  const totalInterest = amount * RATE * (term / 12);
  return totalInterest;
}

// --- АНАЛИТИКА ---
const VARIANT = 'ghk_5639_var4';
const METRIKA_ID = 96171108;
// Флаги первого рендера для каждого экрана
let analyticsFlags = {
  chooseLoan: false,
  agreement: false,
  end: false,
  moreInfo: false,
};

function sendGA(event, params = {}) {
  if (typeof gtag === 'function') {
    gtag('event', event, params);
  }
}
function sendYM(event, params = {}) {
  if (typeof ym === 'function') {
    ym(METRIKA_ID, 'reachGoal', event, params);
  }
}

// --- Рендеринг ---
function render() {
  if (localStorage.getItem(STORAGE_KEY) === 'true') {
    renderSuccess();
    return;
  }
  const hash = location.hash.replace('#', '');
  if (hash === 'confirm') {
    renderConfirm();
  } else if (hash === 'success') {
    renderSuccess();
  } else if (hash === 'info') {
    renderInfo();
  } else {
    renderCalculator();
  }
}

function getInfoBlockHtml(amountNum) {
  if (amountNum >= 50000 && amountNum <= 100000) {
    return `
      <div class="info-block" id="infoBlock" style="margin-top:16px;margin-bottom:16px;">
        <span class="info-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.1362 17.3359V10.6745H10.8741V17.3359H13.1362Z" fill="#212124"/>
            <path d="M13.4541 7.88802C13.4541 8.69056 12.8035 9.34115 12.001 9.34115C11.1984 9.34115 10.5479 8.69056 10.5479 7.88802C10.5479 7.08548 11.1984 6.4349 12.001 6.4349C12.8035 6.4349 13.4541 7.08548 13.4541 7.88802Z" fill="#212124"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M22.001 12.0078C22.001 17.5307 17.5238 22.0078 12.001 22.0078C6.47813 22.0078 2.00098 17.5307 2.00098 12.0078C2.00098 6.48496 6.47813 2.00781 12.001 2.00781C17.5238 2.00781 22.001 6.48496 22.001 12.0078ZM20.001 12.0078C20.001 16.4261 16.4193 20.0078 12.001 20.0078C7.5827 20.0078 4.00098 16.4261 4.00098 12.0078C4.00098 7.58953 7.5827 4.00781 12.001 4.00781C16.4193 4.00781 20.001 7.58953 20.001 12.0078Z" fill="#212124"/>
          </svg>
        </span>
        <span class="info-text">Деньги могут прийти не сразу. Рассказываем, почему так</span>
        <span class="info-arrow" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clip-path="url(#clip0_7502_6226)">
              <path d="M20.999 12.0078L15.499 17.5078L16.999 19.0078C20.3185 15.8836 23.999 12.0078 23.999 12.0078C23.999 12.0078 20.3185 8.13201 16.999 5.00781L15.499 6.50781L20.999 12.0078Z" fill="#BABBC2"/>
            </g>
            <defs>
              <clipPath id="clip0_7502_6226">
                <rect width="24" height="24" fill="white" transform="translate(-0.000976562 0.0078125)"/>
              </clipPath>
            </defs>
          </svg>
        </span>
      </div>
    `;
  }
  return '';
}

// Рендерит только блок выбора срока
function renderTermButtons() {
  const termBtnsContainer = document.querySelector('.term-btns');
  if (!termBtnsContainer) return;
  termBtnsContainer.innerHTML = TERMS.map(term => `
    <button class="term-btn${state.term === term ? ' selected' : ''}" data-term="${term}">${term} мес</button>
  `).join('');
  // Навешиваем обработчики
  termBtnsContainer.querySelectorAll('.term-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      state.term = parseInt(btn.dataset.term);
      renderTermButtons();
      // Можно добавить обновление платежа и других зависимых значений:
      state.payment = calcPayment(state.amount, state.term);
      state.serviceFee = calcServiceFee(state.amount, state.term);
      document.querySelector('.card-title').textContent = formatMoney(state.payment) + ' в месяц';
    });
  });
}

function renderCalculator() {
  document.title = 'Рассрочка';
  const app = document.getElementById('app');
  // Первый рендер экрана выбора условий рассрочки — отправляем аналитику
  if (!analyticsFlags.chooseLoan) {
    sendGA('5639_page_view_choose_loan_var4');
    sendYM('5639_page_view_choose_loan_var4');
    analyticsFlags.chooseLoan = true;
  }
  // Если поле уже есть, не пересоздаём его, а только обновляем связанные части
  if (document.getElementById('amount')) {
    // Только обновляем связанные значения
    const amountNum = parseInt(state.amount, 10);
    const isAmountValid = amountNum >= MIN_AMOUNT && amountNum <= MAX_AMOUNT;
    state.payment = calcPayment(state.amount, state.term);
    state.serviceFee = calcServiceFee(state.amount, state.term);
    document.querySelector('.card-title').textContent = formatMoney(state.payment) + ' в месяц';
    document.querySelector('.card small').textContent = 'включая плату за услугу';
    document.getElementById('amount').className = isAmountValid ? '' : 'input-error';
    document.getElementById('nextBtn').disabled = !isAmountValid;
    // Динамически показываем/убираем инфоблок
    const infoBlockContainer = document.getElementById('infoBlockContainer');
    if (amountNum >= 50000) {
      if (!document.getElementById('infoBlock')) {
        infoBlockContainer.innerHTML = getInfoBlockHtml(amountNum);
        document.getElementById('infoBlock').addEventListener('click', () => {
          // Клик по info на экране выбора условий рассрочки
          sendGA('5639_click_choose_loan_more_info_var4');
          sendYM('5639_click_choose_loan_more_info_var4');
          infoBackHash = location.hash;
          location.hash = 'info';
        });
      }
    } else {
      infoBlockContainer.innerHTML = '';
    }
    // Ререндерим только блок выбора срока
    renderTermButtons();
    return;
  }
  // Первый рендер — создаём всю разметку
  const amountNum = parseInt(state.amount, 10);
  app.innerHTML = `
    <h2 class="screen-title">Получите до&nbsp;100&nbsp;000&nbsp;₽&nbsp;в&nbsp;рассрочку</h2>
    <p style="margin-bottom:24px;">Деньги придут на вашу карту. И не нужно идти в банк</p>
    <label for="amount" style="color:#888;font-size:1.1rem;">Введите сумму</label>
    <input id="amount" type="number" value="${state.amount}" autocomplete="off" class="" />
    <div style="color:#888;font-size:1rem;margin-bottom:16px;">от 1 000 ₽ до 100 000 ₽</div>
    <div style="color:#888;font-size:1.1rem;">Выберите срок</div>
    <div class="term-btns"></div>
    <div class="card">
      <div class="card-title">${formatMoney(calcPayment(state.amount, state.term))} в месяц</div>
      <small>включая плату за услугу</small>
    </div>
    <div id="infoBlockContainer">${amountNum >= 50000 ? getInfoBlockHtml(amountNum) : ''}</div>
    <button class="button" id="nextBtn">Продолжить</button>
  `;
  document.getElementById('amount').addEventListener('input', e => {
    state.amount = e.target.value;
    // Не делаем полный ререндер, только обновляем инфоблок и связанные значения
    renderCalculator();
  });
  renderTermButtons();
  document.getElementById('nextBtn').addEventListener('click', () => {
    // Клик по кнопке "Продолжить"
    sendGA('5639_click_continue_var4');
    sendYM('5639_click_continue_var4');
    location.hash = 'confirm';
  });
  if (amountNum >= 50000) {
    document.getElementById('infoBlock').addEventListener('click', () => {
      // Клик по info на экране выбора условий рассрочки
      sendGA('5639_click_choose_loan_more_info_var4');
      sendYM('5639_click_choose_loan_more_info_var4');
      infoBackHash = location.hash;
      location.hash = 'info';
    });
  }
}

function renderConfirm() {
  state.payment = calcPayment(state.amount, state.term);
  state.serviceFee = calcServiceFee(state.amount, state.term);
  document.title = 'Подтверждение';
  // Первый рендер экрана подтверждения — отправляем аналитику
  if (!analyticsFlags.agreement) {
    sendGA('5639_page_view_agreement_var4');
    sendYM('5639_page_view_agreement_var4');
    analyticsFlags.agreement = true;
  }
  const amountNum = parseInt(state.amount, 10);
  const infoBlockHtml = getInfoBlockHtml(amountNum);
  document.getElementById('app').innerHTML = `
    <div class="header-row">
      <button id="backBtn" aria-label="Назад">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M19.6799 11H7.96795L13.3439 5.4L11.9999 4L4.31995 12L11.9999 20L13.3439 18.6L7.96795 13H19.6799V11Z" fill="#030306" fill-opacity="0.88"/>
        </svg>
      </button>
    </div>
    <h1 class="screen-title-confirm">Всё проверьте, и можно оформлять</h1>
    <ul class="confirm-list">
      <li><span class="label">Всего в рассрочку</span><span class="value">${formatMoney(state.amount)}</span></li>
      <li><span class="label">Плата за услугу</span><span class="value">${formatMoneyPrecise(state.serviceFee)}</span></li>
      <li><span class="label">Платёж в месяц</span><span class="value">${formatMoney(state.payment)}</span></li>
      <li><span class="label">Срок</span><span class="value">${state.term} месяцев</span></li>
    </ul>
    <div style="color:#888;font-size:1.1rem;margin-bottom:8px;">Куда зачислить деньги</div>
    <div class="account-box"><span><span class="ruble">₽</span></span>Текущий счет</div>
    ${infoBlockHtml}
    <button class="button" id="submitBtn">Оформить рассрочку</button>
  `;
  document.getElementById('backBtn').addEventListener('click', () => {
    location.hash = '';
  });
  document.getElementById('submitBtn').addEventListener('click', () => {
    // Клик по кнопке "Оформить рассрочку" с параметрами
    const params = {
      date: Date.now(),
      variant: VARIANT,
      sum: state.amount,
      period: `${state.term} мес`,
      payment: state.payment,
    };
    sendGA('5639_click_agreement_make_deal_var4', params);
    sendYM('5639_click_agreement_make_deal_var4', params);
    location.hash = 'success';
  });
  if (infoBlockHtml) {
    document.getElementById('infoBlock').addEventListener('click', () => {
      // Клик по info на экране подтверждения
      sendGA('5639_click_agreement_more_info_var4');
      sendYM('5639_click_agreement_more_info_var4');
      infoBackHash = location.hash;
      location.hash = 'info';
    });
  }
}

function renderInfo() {
  document.title = 'Почему деньги могут зачислиться не сразу';
  // Первый рендер экрана информации после клика на info
  if (!analyticsFlags.moreInfo) {
    sendGA('5639_page_view_more_info_var4');
    sendYM('5639_page_view_more_info_var4');
    analyticsFlags.moreInfo = true;
  }
  document.getElementById('app').innerHTML = `
    <button id="infoCloseBtn" class="info-close-btn" aria-label="Закрыть" style="position:absolute;top:16px;right:16px;background:none;border:none;padding:0;z-index:10;">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M31 18.4L29.6 17L24 22.6L18.4 17L17 18.4L22.6 24L17 29.6L18.4 31L24 25.4L29.6 31L31 29.6L25.4 24L31 18.4Z" fill="#0E0E0E"/>
      </svg>
    </button>
    <h2 class="screen-title" style="margin-top:32px;">Почему деньги могут<br>зачислиться не сразу</h2>
    <p style="font-size:1.15rem;margin-bottom:18px;">Это требование закона по защите от мошенников. После одобрения рассрочки банк должен убедиться, что она была оформлена добровольно, а не под влиянием злоумышленников.</p>
    <h3 style="font-size:1.2rem;margin-top:32px;margin-bottom:16px;">Как быстро поступят деньги</h3>
    <p style="font-size:1.15rem;margin-bottom:18px;">Зависит от суммы всех рассрочек — и новой, и действующих.</p>
    <ul class="info-list">
      <li>Если сумма всех рассрочек не больше 49 999 ₽, деньги поступят сразу на карту.</li>
      <li>Если от 50 000 до 200 000 ₽ — перечислим деньги через 4 часа или позже.</li>
      <li>Если больше 200 000 ₽ — через 48 часов или позже.</li>
    </ul>
    <h3 style="font-size:1.2rem;margin-top:32px;margin-bottom:16px;">Как это работает</h3>
    <p style="font-size:1.15rem;margin-bottom:18px;">Например, у Саши есть действующая рассрочка — 35 000 ₽, и он оформляет новую на сумму 25 000 ₽.</p>
    <p style="font-size:1.15rem;margin-bottom:32px;">Общая сумма двух рассрочек — 60 000 рублей. Это значит, что деньги по новой рассрочке придут на Сашин счёт через 4 часа.</p>
    <button class="info-ok-btn" id="infoOkBtn">Понятно</button>
  `;
  document.getElementById('infoOkBtn').addEventListener('click', () => {
    location.hash = infoBackHash || '';
  });
  document.getElementById('infoCloseBtn').addEventListener('click', () => {
    location.hash = infoBackHash || '';
  });
}

function renderSuccess() {
  document.title = 'Спасибо!';
  // Первый рендер финального экрана
  if (!analyticsFlags.end) {
    sendGA('5639_end_page_view_var4');
    sendYM('5639_end_page_view_var4');
    analyticsFlags.end = true;
  }
  document.getElementById('app').innerHTML = `
    <img src="img/success.png" alt="Успех" class="success-img" style="display:block;margin:48px auto 32px auto;width:160px;height:160px;object-fit:contain;" />
    <h2 style="text-align:center;">Только тссс</h2>
    <p style="text-align:center;font-size:1.2rem;">Вы поучаствовали в очень важном исследовании, которое поможет улучшить продукт. Вы – наш герой!</p>
  `;
  // Ставим флаг, чтобы при обновлении всегда показывалась заглушка
  localStorage.setItem(STORAGE_KEY, 'true');
  // Блокируем возврат назад
  window.history.pushState(null, '', window.location.href);
  window.onpopstate = function() {
    window.history.go(1);
  };
}

// --- Инициализация ---
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => {
  // Если уже завершено — сразу показываем заглушку
  if (localStorage.getItem(STORAGE_KEY) === 'true') {
    location.hash = 'success';
  }
  render();
}); 