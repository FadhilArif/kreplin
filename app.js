(() => {
  'use strict';

  /*
   * ============================================================
   * KRAEPELIN PRACTICE - FRONTEND APPLICATION
   * ============================================================
   *
   * Struktur tes:
   * - 50 kolom
   * - 26 soal per kolom
   * - 15 detik per kolom
   * - 27 digit per kolom -> 26 pasangan penjumlahan
   *
   * Backend:
   * Google Apps Script Web App
   *
   * Penyimpanan:
   * - Session login       -> localStorage
   * - Active test         -> localStorage
   * - History hasil tes   -> Google Sheets melalui Apps Script
   *
   * Catatan:
   * Active test tetap tersimpan ketika refresh.
   * Active test DIHAPUS ketika user sengaja mengakhiri tes
   * menggunakan tombol Home dan mengonfirmasi.
   * ============================================================
   */

  const CONFIG = Object.freeze({
    COLUMNS: 50,
    QUESTIONS_PER_COLUMN: 26,
    DIGITS_PER_COLUMN: 27,
    SECONDS_PER_COLUMN: 15,

    STORAGE_KEY: 'kraepelin_active_test_v4',
    SESSION_KEY: 'kraepelin_session_v2',

    API_URL:
      'https://script.google.com/macros/s/AKfycbwtcJdN60aa3sbe-CGyqGSj72g7AH47dNJySyNk41pS_3Q7e-M03wfQSumNxItNgP_-yw/exec'
  });

  /* ============================================================
   * STATE
   * ============================================================
   */

  const state = {
    session: null,

    history: [],

    columns: [],
    answers: [],

    columnIndex: 0,
    questionIndex: 0,

    columnStartedAt: 0,
    testStartedAt: 0,

    timerId: null,

    finished: true,

    lastResult: null,

    activeTestUserId: null,
    currentTestId: null,

    savingHistory: false
  };

  /* ============================================================
   * DOM HELPERS
   * ============================================================
   */

  const $ = (id) => document.getElementById(id);

  const views = {
    landing: $('landingView'),
    auth: $('authView'),
    dashboard: $('dashboardView'),
    instruction: $('instructionView'),
    test: $('testView'),
    result: $('resultView'),
    history: $('historyView')
  };

  /* ============================================================
   * VIEW MANAGEMENT
   * ============================================================
   */

  function showView(name) {
    Object.values(views).forEach((view) => {
      if (view) {
        view.classList.remove('active');
      }
    });

    if (views[name]) {
      views[name].classList.add('active');
    }

    document.body.dataset.view = name;

    if (name !== 'test') {
      stopTimer();
    }

    if (name === 'test') {
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    }

    window.scrollTo(0, 0);
  }

  /* ============================================================
   * API STATUS
   * ============================================================
   */

  function setApiStatus() {
    document.querySelectorAll('[data-api-status]').forEach((el) => {
      el.textContent =
        'Backend Google Sheets aktif melalui Google Apps Script.';
      el.dataset.ready = 'true';
    });
  }

  /* ============================================================
   * RANDOM NUMBER
   * ============================================================
   */

  function secureRandomInt(max) {
    if (
      window.crypto &&
      typeof window.crypto.getRandomValues === 'function'
    ) {
      const maxUint = 0x100000000;
      const limit = Math.floor(maxUint / max) * max;

      const buffer = new Uint32Array(1);

      do {
        window.crypto.getRandomValues(buffer);
      } while (buffer[0] >= limit);

      return buffer[0] % max;
    }

    return Math.floor(Math.random() * max);
  }

  function randomDigit() {
    return secureRandomInt(10);
  }

  function createRandomColumn() {
    return Array.from(
      { length: CONFIG.DIGITS_PER_COLUMN },
      randomDigit
    );
  }

  /* ============================================================
   * SESSION
   * ============================================================
   */

  function persistSession() {
    if (!state.session) {
      localStorage.removeItem(CONFIG.SESSION_KEY);
      return;
    }

    try {
      localStorage.setItem(
        CONFIG.SESSION_KEY,
        JSON.stringify(state.session)
      );
    } catch (error) {
      console.warn('Session tidak dapat disimpan:', error);
    }
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(CONFIG.SESSION_KEY);

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);

      if (
        !parsed ||
        !parsed.token ||
        !parsed.user_id ||
        !parsed.username
      ) {
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn('Session tidak valid:', error);
      return null;
    }
  }

  function clearSession() {
    state.session = null;
    localStorage.removeItem(CONFIG.SESSION_KEY);
  }

  /* ============================================================
   * GOOGLE APPS SCRIPT API
   *
   * Menggunakan hidden iframe + form POST agar tidak bergantung
   * pada fetch CORS biasa.
   * ============================================================
   */

  let apiFrame = null;

  const apiWaiters = new Map();

  function ensureApiFrame() {
    if (apiFrame && apiFrame.contentWindow) {
      return apiFrame;
    }

    apiFrame = document.createElement('iframe');

    apiFrame.name = 'kraepelinApiFrame';
    apiFrame.title = 'Backend connector';
    apiFrame.setAttribute('aria-hidden', 'true');
    apiFrame.tabIndex = -1;

    apiFrame.style.position = 'fixed';
    apiFrame.style.width = '1px';
    apiFrame.style.height = '1px';
    apiFrame.style.border = '0';
    apiFrame.style.opacity = '0';
    apiFrame.style.pointerEvents = 'none';
    apiFrame.style.left = '-10000px';
    apiFrame.style.top = '-10000px';

    document.body.appendChild(apiFrame);

    return apiFrame;
  }

  function randomToken(prefix = '') {
    const parts = [];

    for (let i = 0; i < 3; i += 1) {
      parts.push(
        secureRandomInt(0x1000000)
          .toString(16)
          .padStart(6, '0')
      );
    }

    return `${prefix}${Date.now().toString(36)}-${parts.join('')}`;
  }

  window.addEventListener('message', (event) => {
    const frame = apiFrame;

    if (!frame || event.source !== frame.contentWindow) {
      return;
    }

    const message = event.data;

    if (
      !message ||
      message.type !== 'KRAEPELIN_API_RESPONSE' ||
      !message.nonce
    ) {
      return;
    }

    const waiter = apiWaiters.get(message.nonce);

    if (!waiter) {
      return;
    }

    apiWaiters.delete(message.nonce);

    clearTimeout(waiter.timeoutId);

    if (message.ok === false) {
      waiter.reject(
        new Error(
          message.error ||
            'Backend tidak dapat memproses permintaan.'
        )
      );

      return;
    }

    waiter.resolve(message.data);
  });

  async function api(action, payload = {}) {
    if (!CONFIG.API_URL) {
      throw new Error(
        'URL backend belum dikonfigurasi.'
      );
    }

    const frame = ensureApiFrame();

    const nonce = randomToken('req-');

    const data = {
      action,
      ...payload
    };

    const form = document.createElement('form');

    form.method = 'POST';
    form.action = CONFIG.API_URL;
    form.target = frame.name;
    form.enctype = 'application/x-www-form-urlencoded';
    form.acceptCharset = 'UTF-8';
    form.style.display = 'none';

    const dataInput = document.createElement('input');

    dataInput.type = 'hidden';
    dataInput.name = 'data';
    dataInput.value = JSON.stringify(data);

    const nonceInput = document.createElement('input');

    nonceInput.type = 'hidden';
    nonceInput.name = 'nonce';
    nonceInput.value = nonce;

    form.appendChild(dataInput);
    form.appendChild(nonceInput);

    document.body.appendChild(form);

    const resultPromise = new Promise(
      (resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          apiWaiters.delete(nonce);

          reject(
            new Error(
              'Backend tidak merespons. Pastikan Web App Apps Script sudah aktif dan aksesnya disetel ke Anyone.'
            )
          );
        }, 20000);

        apiWaiters.set(nonce, {
          resolve,
          reject,
          timeoutId
        });
      }
    );

    try {
      form.submit();
    } catch (error) {
      const waiter = apiWaiters.get(nonce);

      if (waiter) {
        apiWaiters.delete(nonce);
        clearTimeout(waiter.timeoutId);
      }

      throw new Error(
        `Gagal mengirim permintaan ke backend: ${
          error.message || error
        }`
      );
    } finally {
      window.setTimeout(() => {
        form.remove();
      }, 1000);
    }

    const response = await resultPromise;

    if (!response || response.success !== true) {
      throw new Error(
        response?.message ||
          'Permintaan ke backend gagal.'
      );
    }

    return response;
  }

  async function apiGetHistory() {
    if (!state.session?.token) {
      throw new Error('Session login tidak tersedia.');
    }

    return api('getHistory', {
      token: state.session.token
    });
  }

  /* ============================================================
   * UI UTILITIES
   * ============================================================
   */

  function setBusy(button, text, busy) {
    if (!button) {
      return;
    }

    if (busy) {
      button.dataset.originalText =
        button.textContent;

      button.disabled = true;
      button.textContent = text;
    } else {
      button.disabled = false;

      button.textContent =
        button.dataset.originalText ||
        button.textContent;
    }
  }

  function showToast(
    message,
    type = 'info',
    duration = 2200
  ) {
    const root = $('toastRoot');

    if (!root) {
      return;
    }

    root.innerHTML = '';

    const toast = document.createElement('div');

    toast.className = `toast toast-${type}`;

    toast.textContent = message;

    root.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');

      setTimeout(() => {
        toast.remove();
      }, 220);
    }, duration);
  }

  /* ============================================================
   * REGISTER
   * ============================================================
   */

  async function register() {
    const username =
      $('registerUsername').value.trim();

    const password =
      $('registerPassword').value;

    const confirm =
      $('registerConfirm').value;

    const btn = $('registerBtn');

    const error = $('registerError');

    error.textContent = '';

    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      error.textContent =
        'Username 3–24 karakter, hanya huruf, angka, dan underscore.';

      return;
    }

    if (password.length < 8) {
      error.textContent =
        'Password minimal 8 karakter.';

      return;
    }

    if (password !== confirm) {
      error.textContent =
        'Konfirmasi password belum sama.';

      return;
    }

    setBusy(
      btn,
      'Membuat akun…',
      true
    );

    try {
      const data = await api('register', {
        username,
        password
      });

      state.session = data.session;

      persistSession();

      $('registerForm').reset();

      await enterDashboard(
        'Akun berhasil dibuat. Selamat datang!'
      );
    } catch (err) {
      error.textContent =
        err?.message ||
        'Gagal membuat akun.';
    } finally {
      setBusy(btn, '', false);
    }
  }

  /* ============================================================
   * LOGIN
   * ============================================================
   */

  async function login() {
    const username =
      $('loginUsername').value.trim();

    const password =
      $('loginPassword').value;

    const btn = $('loginBtn');

    const error = $('loginError');

    error.textContent = '';

    if (!username || !password) {
      error.textContent =
        'Username dan password wajib diisi.';

      return;
    }

    setBusy(
      btn,
      'Memeriksa…',
      true
    );

    try {
      const data = await api('login', {
        username,
        password
      });

      state.session = data.session;

      persistSession();

      $('loginForm').reset();

      await enterDashboard(
        'Login berhasil.'
      );
    } catch (err) {
      error.textContent =
        err?.message ||
        'Login gagal.';
    } finally {
      setBusy(btn, '', false);
    }
  }

  /* ============================================================
   * DASHBOARD
   * ============================================================
   */

  async function enterDashboard(
    toastMessage = ''
  ) {
    if (!state.session) {
      showView('landing');
      return;
    }

    $('welcomeName').textContent =
      state.session.username;

    updateResumeBanner();

    showView('dashboard');

    try {
      const data = await apiGetHistory();

      state.history = Array.isArray(data.history)
        ? data.history
        : [];

      renderDashboard();

      renderHistory();
    } catch (err) {
      renderDashboard();

      showToast(
        `Histori belum bisa dimuat: ${
          err?.message || err
        }`,
        'warning',
        3400
      );
    }

    if (toastMessage) {
      showToast(
        toastMessage,
        'success'
      );
    }
  }

  function renderDashboard() {
    const history = state.history;

    $('historyCount').textContent =
      String(history.length);

    if (!history.length) {
      $('latestDate').textContent =
        'Belum ada tes';

      [
        'dashSpeed',
        'dashAccuracy',
        'dashConsistency',
        'dashEndurance'
      ].forEach((id) => {
        $(id).textContent = '—';
      });

      return;
    }

    const latest = history[0];

    $('latestDate').textContent =
      formatDate(latest.tanggal);

    $('dashSpeed').textContent =
      `${Math.round(
        Number(latest.speed) || 0
      )}%`;

    $('dashAccuracy').textContent =
      `${Math.round(
        Number(latest.accuracy) || 0
      )}%`;

    $('dashConsistency').textContent =
      `${Math.round(
        Number(latest.consistency) || 0
      )}%`;

    $('dashEndurance').textContent =
      `${Math.round(
        Number(latest.endurance) || 0
      )}%`;
  }

  /* ============================================================
   * HISTORY
   * ============================================================
   */

  function renderHistory() {
    const tbody =
      $('historyTableBody');

    if (!tbody) {
      return;
    }

    tbody.innerHTML = '';

    $('historyPageCount').textContent =
      String(state.history.length);

    if (!state.history.length) {
      $('emptyHistory').hidden = false;
      $('historyTable').hidden = true;
      return;
    }

    $('emptyHistory').hidden = true;
    $('historyTable').hidden = false;

    state.history.forEach(
      (item, index) => {
        const tr =
          document.createElement('tr');

        tr.innerHTML = `
          <td>${index + 1}</td>
          <td>${escapeHtml(
            formatDate(item.tanggal)
          )}</td>
          <td>${Math.round(
            Number(item.speed) || 0
          )}%</td>
          <td>${Math.round(
            Number(item.accuracy) || 0
          )}%</td>
          <td>${Math.round(
            Number(item.consistency) || 0
          )}%</td>
          <td>${Math.round(
            Number(item.endurance) || 0
          )}%</td>
        `;

        tbody.appendChild(tr);
      }
    );
  }

  /* ============================================================
   * AUTH VIEW
   * ============================================================
   */

  function showAuth(mode) {
    const registerMode =
      mode === 'register';

    $('authTitle').textContent =
      registerMode
        ? 'Buat akun baru'
        : 'Selamat datang kembali';

    $('authSubtitle').textContent =
      registerMode
        ? 'Cukup username dan password. Tidak perlu email.'
        : 'Masuk untuk melanjutkan latihan dan melihat histori.';

    $('loginPane').hidden =
      registerMode;

    $('registerPane').hidden =
      !registerMode;

    showView('auth');

    setTimeout(() => {
      const input = $(
        registerMode
          ? 'registerUsername'
          : 'loginUsername'
      );

      if (input) {
        input.focus();
      }
    }, 50);
  }

  /* ============================================================
   * KRAEPELIN TEST CREATION
   * ============================================================
   */

  function buildTest() {
    state.columns = Array.from(
      {
        length: CONFIG.COLUMNS
      },
      createRandomColumn
    );

    state.answers = Array.from(
      {
        length: CONFIG.COLUMNS
      },
      () =>
        Array(
          CONFIG.QUESTIONS_PER_COLUMN
        ).fill(null)
    );

    state.columnIndex = 0;
    state.questionIndex = 0;

    const now = Date.now();

    state.testStartedAt = now;
    state.columnStartedAt = now;

    state.finished = false;

    state.activeTestUserId =
      state.session.user_id;

    state.currentTestId =
      `T-${Date.now()}-${secureRandomInt(
        1000000
      )}`;

    state.lastResult = null;

    persistTest();
  }

  /* ============================================================
   * ACTIVE TEST STORAGE
   * ============================================================
   */

  function persistTest() {
    if (
      state.finished ||
      !state.columns.length ||
      !state.session ||
      state.activeTestUserId !==
        state.session.user_id
    ) {
      return;
    }

    const snapshot = {
      version: 4,

      userId:
        state.activeTestUserId,

      testId:
        state.currentTestId,

      columns:
        state.columns,

      answers:
        state.answers,

      columnIndex:
        state.columnIndex,

      questionIndex:
        state.questionIndex,

      columnStartedAt:
        state.columnStartedAt,

      testStartedAt:
        state.testStartedAt
    };

    try {
      localStorage.setItem(
        CONFIG.STORAGE_KEY,
        JSON.stringify(snapshot)
      );
    } catch (error) {
      showToast(
        'Browser tidak mengizinkan penyimpanan progress lokal.',
        'warning',
        3200
      );
    }
  }

  function clearPersistedTest() {
    localStorage.removeItem(
      CONFIG.STORAGE_KEY
    );
  }

  function readPersistedTest() {
    try {
      const raw =
        localStorage.getItem(
          CONFIG.STORAGE_KEY
        );

      if (!raw) {
        return null;
      }

      const saved = JSON.parse(raw);

      const valid =
        saved?.version === 4 &&
        saved.userId ===
          state.session?.user_id &&
        saved.testId &&
        Array.isArray(saved.columns) &&
        Array.isArray(saved.answers);

      if (!valid) {
        clearPersistedTest();
        return null;
      }

      return saved;
    } catch (error) {
      clearPersistedTest();
      return null;
    }
  }

  /* ============================================================
   * RESUME TEST
   * ============================================================
   */

  function updateResumeBanner() {
    const banner =
      $('resumeTestBanner');

    if (!banner) {
      return;
    }

    const saved =
      readPersistedTest();

    banner.hidden = !saved;
  }

  function restoreTest(saved) {
    state.columns =
      saved.columns;

    state.answers =
      saved.answers;

    state.columnIndex =
      Math.max(
        0,
        Math.min(
          CONFIG.COLUMNS - 1,
          Number(saved.columnIndex) || 0
        )
      );

    state.questionIndex =
      Math.max(
        0,
        Math.min(
          CONFIG.QUESTIONS_PER_COLUMN - 1,
          Number(saved.questionIndex) || 0
        )
      );

    state.columnStartedAt =
      Number(saved.columnStartedAt) ||
      Date.now();

    state.testStartedAt =
      Number(saved.testStartedAt) ||
      Date.now();

    state.activeTestUserId =
      saved.userId;

    state.currentTestId =
      saved.testId;

    state.finished = false;

    catchUpElapsedColumns();

    if (!state.finished) {
      persistTest();

      showView('test');

      renderQuestion();

      startTimer();

      showToast(
        'Tes dilanjutkan. Progress tetap aman setelah refresh.',
        'success',
        2500
      );
    }
  }

  function catchUpElapsedColumns() {
    const elapsedSeconds =
      Math.max(
        0,
        (Date.now() -
          state.columnStartedAt) /
          1000
      );

    if (
      elapsedSeconds <
      CONFIG.SECONDS_PER_COLUMN
    ) {
      return;
    }

    const advance =
      Math.floor(
        elapsedSeconds /
          CONFIG.SECONDS_PER_COLUMN
      );

    const remainingMs =
      (elapsedSeconds %
        CONFIG.SECONDS_PER_COLUMN) *
      1000;

    if (
      state.columnIndex +
        advance >=
      CONFIG.COLUMNS
    ) {
      finishTest();
      return;
    }

    state.columnIndex +=
      advance;

    state.questionIndex = 0;

    state.columnStartedAt =
      Date.now() -
      remainingMs;
  }

  /* ============================================================
   * KRAEPELIN QUESTION
   * ============================================================
   */

  function getPair(
    columnIndex = state.columnIndex,
    questionIndex = state.questionIndex
  ) {
    const digits =
      state.columns[columnIndex];

    const bottomIndex =
      CONFIG.DIGITS_PER_COLUMN -
      1 -
      questionIndex;

    return {
      top: digits[bottomIndex - 1],
      bottom: digits[bottomIndex]
    };
  }

  function correctAnswerFor(
    columnIndex,
    questionIndex
  ) {
    const { top, bottom } =
      getPair(
        columnIndex,
        questionIndex
      );

    return (top + bottom) % 10;
  }

  /* ============================================================
   * RENDER QUESTION
   * ============================================================
   */

  function renderQuestion() {
    if (state.finished) {
      return;
    }

    const { top, bottom } =
      getPair();

    $('topNumber').textContent =
      top;

    $('bottomNumber').textContent =
      bottom;

    $('columnCounter').textContent =
      `${state.columnIndex + 1}/${CONFIG.COLUMNS}`;

    $('questionCounter').textContent =
      `${state.questionIndex + 1}/${CONFIG.QUESTIONS_PER_COLUMN}`;

    updateTimerText();

    updateProgress();
  }

  /* ============================================================
   * TIMER
   * ============================================================
   */

  function updateTimerText() {
    const elapsed =
      Math.max(
        0,
        (Date.now() -
          state.columnStartedAt) /
          1000
      );

    const remaining =
      Math.ceil(
        Math.max(
          0,
          CONFIG.SECONDS_PER_COLUMN -
            elapsed
        )
      );

    $('timeCounter').textContent =
      `${remaining}s`;
  }

  function updateProgress() {
    const elapsed =
      Math.min(
        CONFIG.SECONDS_PER_COLUMN,
        Math.max(
          0,
          (Date.now() -
            state.columnStartedAt) /
            1000
        )
      );

    const fraction =
      elapsed /
      CONFIG.SECONDS_PER_COLUMN;

    const percent =
      (
        (state.columnIndex +
          fraction) /
        CONFIG.COLUMNS
      ) * 100;

    $('progressBar').style.width =
      `${Math.min(
        100,
        Math.max(0, percent)
      )}%`;
  }

  /* ============================================================
   * KEYPAD VISUAL FEEDBACK
   * ============================================================
   */

  function pulseButton(digit) {
    const btn =
      document.querySelector(
        `.digit-btn[data-digit="${digit}"]`
      );

    if (!btn) {
      return;
    }

    btn.classList.remove(
      'active-pulse'
    );

    void btn.offsetWidth;

    btn.classList.add(
      'active-pulse'
    );

    setTimeout(() => {
      btn.classList.remove(
        'active-pulse'
      );
    }, 110);
  }

  /* ============================================================
   * ANSWER
   * ============================================================
   */

  function registerAnswer(value) {
    if (
      state.finished ||
      !views.test.classList.contains(
        'active'
      )
    ) {
      return;
    }

    if (
      !state.answers[state.columnIndex]
    ) {
      return;
    }

    if (
      state.answers[
        state.columnIndex
      ][state.questionIndex] !== null
    ) {
      return;
    }

    const numericValue =
      Number(value);

    if (
      !Number.isInteger(
        numericValue
      ) ||
      numericValue < 0 ||
      numericValue > 9
    ) {
      return;
    }

    state.answers[
      state.columnIndex
    ][state.questionIndex] =
      numericValue;

    pulseButton(
      numericValue
    );

    persistTest();

    if (
      state.questionIndex <
      CONFIG.QUESTIONS_PER_COLUMN - 1
    ) {
      state.questionIndex += 1;

      renderQuestion();
    } else {
      nextColumn('completed');
    }
  }

  /* ============================================================
   * COLUMN TRANSITION
   * ============================================================
   */

  function nextColumn(
    reason = 'timer'
  ) {
    if (
      state.columnIndex >=
      CONFIG.COLUMNS - 1
    ) {
      finishTest();
      return;
    }

    state.columnIndex += 1;

    state.questionIndex = 0;

    state.columnStartedAt =
      Date.now();

    renderQuestion();

    persistTest();

    if (reason === 'timer') {
      showToast(
        'Waktu habis — lanjut ke kolom berikutnya.',
        'info',
        850
      );
    }
  }

  function tick() {
    if (
      state.finished ||
      !views.test.classList.contains(
        'active'
      )
    ) {
      return;
    }

    const elapsed =
      Math.max(
        0,
        (Date.now() -
          state.columnStartedAt) /
          1000
      );

    updateTimerText();

    updateProgress();

    if (
      elapsed >=
      CONFIG.SECONDS_PER_COLUMN
    ) {
      nextColumn('timer');
    }
  }

  function startTimer() {
    stopTimer();

    state.timerId =
      setInterval(tick, 50);

    tick();
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(
        state.timerId
      );
    }

    state.timerId = null;
  }

  /* ============================================================
   * START TEST
   * ============================================================
   */

  function startTest() {
    if (!state.session) {
      showAuth('login');
      return;
    }

    const existing =
      readPersistedTest();

    if (existing) {
      const replace =
        window.confirm(
          'Masih ada progress tes sebelumnya. Jika memulai tes baru, progress lama akan dihapus. Tetap mulai tes baru?'
        );

      if (!replace) {
        showView('dashboard');

        updateResumeBanner();

        return;
      }

      clearPersistedTest();
    }

    buildTest();

    showView('test');

    renderQuestion();

    startTimer();
  }

  /* ============================================================
   * SCORING
   *
   * Catatan:
   * Ini adalah scoring latihan internal.
   * Bukan norma resmi psikotes.
   * ============================================================
   */

  function standardDeviation(
    values,
    mean
  ) {
    if (!values.length) {
      return 0;
    }

    return Math.sqrt(
      values.reduce(
        (sum, value) =>
          sum +
          Math.pow(
            value - mean,
            2
          ),
        0
      ) / values.length
    );
  }

  function clamp(
    value,
    min = 0,
    max = 100
  ) {
    return Math.max(
      min,
      Math.min(max, value)
    );
  }

  function calculateResults() {
    const counts =
      state.answers.map(
        (col) =>
          col.filter(
            (value) =>
              value !== null
          ).length
      );

    let answered = 0;
    let correct = 0;

    state.answers.forEach(
      (col, columnIndex) => {
        col.forEach(
          (
            answer,
            questionIndex
          ) => {
            if (
              answer === null
            ) {
              return;
            }

            answered += 1;

            if (
              answer ===
              correctAnswerFor(
                columnIndex,
                questionIndex
              )
            ) {
              correct += 1;
            }
          }
        );
      }
    );

    const wrong =
      answered - correct;

    const totalItems =
      CONFIG.COLUMNS *
      CONFIG.QUESTIONS_PER_COLUMN;

    /* ----------------------------------------------------------
     * KECEPATAN
     * ----------------------------------------------------------
     */

    const avg =
      counts.reduce(
        (a, b) => a + b,
        0
      ) / CONFIG.COLUMNS;

    const speed =
      Math.round(
        clamp(
          (answered /
            totalItems) *
            100
        )
      );

    /* ----------------------------------------------------------
     * KETELITIAN
     * ----------------------------------------------------------
     */

    const accuracy =
      answered > 0
        ? Math.round(
            clamp(
              (correct /
                answered) *
                100
            )
          )
        : 0;

    /* ----------------------------------------------------------
     * KONSISTENSI
     * ----------------------------------------------------------
     */

    const sd =
      standardDeviation(
        counts,
        avg
      );

    const cv =
      avg > 0
        ? sd / avg
        : 1;

    const consistency =
      Math.round(
        clamp(
          100 -
            cv * 100
        )
      );

    /* ----------------------------------------------------------
     * KETAHANAN
     * ----------------------------------------------------------
     *
     * Membandingkan:
     * - 10 kolom pertama
     * - 10 kolom tengah
     * - 10 kolom terakhir
     *
     * terhadap penurunan produktivitas.
     * ----------------------------------------------------------
     */

    const first =
      counts
        .slice(0, 10)
        .reduce(
          (a, b) => a + b,
          0
        ) / 10;

    const middle =
      counts
        .slice(20, 30)
        .reduce(
          (a, b) => a + b,
          0
        ) / 10;

    const last =
      counts
        .slice(40, 50)
        .reduce(
          (a, b) => a + b,
          0
        ) / 10;

    const baseline =
      Math.max(
        1,
        (first + middle) / 2
      );

    const decline =
      Math.max(
        0,
        (baseline - last) /
          baseline
      );

    const endurance =
      Math.round(
        clamp(
          100 -
            decline * 100
        )
      );

    return {
      counts,
      answered,
      correct,
      wrong,
      avg,
      speed,
      accuracy,
      consistency,
      endurance,
      totalItems
    };
  }

  /* ============================================================
   * SAVE HISTORY
   * ============================================================
   */

  async function saveHistory(
    result
  ) {
    if (
      !state.session ||
      state.savingHistory
    ) {
      return false;
    }

    state.savingHistory = true;

    try {
      await api(
        'saveHistory',
        {
          token:
            state.session.token,

          test_id:
            state.currentTestId ||
            `T-${Date.now()}-${secureRandomInt(
              100000
            )}`,

          tanggal:
            new Date().toISOString(),

          speed:
            result.speed,

          accuracy:
            result.accuracy,

          consistency:
            result.consistency,

          endurance:
            result.endurance
        }
      );

      return true;
    } catch (err) {
      showToast(
        `Hasil tampil, tetapi histori belum tersimpan: ${
          err?.message || err
        }`,
        'warning',
        3800
      );

      return false;
    } finally {
      state.savingHistory = false;
    }
  }

  /* ============================================================
   * FINISH TEST
   * ============================================================
   */

  async function finishTest() {
    if (state.finished) {
      return;
    }

    state.finished = true;

    stopTimer();

    const result =
      calculateResults();

    state.lastResult = result;

    /*
     * Hapus active test SEBELUM masuk halaman hasil.
     *
     * Jadi setelah tes selesai:
     * - Refresh hasil -> hasil hilang
     * - Active test tidak bisa dipulihkan
     */

    clearPersistedTest();

    renderResults(result);

    showView('result');

    requestAnimationFrame(() => {
      drawChart(
        result.counts
      );
    });

    await saveHistory(result);

    try {
      const data =
        await apiGetHistory();

      state.history =
        Array.isArray(
          data.history
        )
          ? data.history
          : [];

      renderDashboard();

      renderHistory();
    } catch (error) {
      console.warn(
        'Gagal refresh history:',
        error
      );
    }
  }

  /* ============================================================
   * ABANDON / CANCEL TEST
   * ============================================================
   */

  function abandonTest() {
    /*
     * User sengaja menekan Home lalu
     * mengonfirmasi keluar.
     *
     * Hasil:
     * - Progress DIHAPUS
     * - Tes HANGUS
     * - Tidak masuk history
     * - Tidak ada hasil akhir
     */

    stopTimer();

    clearPersistedTest();

    state.columns = [];
    state.answers = [];

    state.columnIndex = 0;
    state.questionIndex = 0;

    state.columnStartedAt = 0;
    state.testStartedAt = 0;

    state.finished = true;

    state.lastResult = null;

    state.activeTestUserId =
      null;

    state.currentTestId =
      null;

    closeEndTestModal();

    enterDashboard(
      'Tes diakhiri. Progress tadi sudah dihapus dan tidak disimpan.'
    );
  }

  /* ============================================================
   * END TEST MODAL
   * ============================================================
   */

  function openEndTestModal() {
    if (
      !views.test.classList.contains(
        'active'
      )
    ) {
      return;
    }

    $('confirmModal').hidden =
      false;

    $('cancelEndTestBtn').focus();
  }

  function closeEndTestModal() {
    $('confirmModal').hidden =
      true;
  }

  /* ============================================================
   * RESULT LEVEL
   * ============================================================
   */

  function level(score) {
    if (score >= 90) {
      return 'Sangat baik';
    }

    if (score >= 80) {
      return 'Baik';
    }

    if (score >= 65) {
      return 'Cukup';
    }

    if (score >= 50) {
      return 'Perlu latihan';
    }

    return 'Perlu ditingkatkan';
  }

  /* ============================================================
   * RENDER RESULTS
   * ============================================================
   */

  function renderResults(
    result
  ) {
    const rows = [
      [
        'speedScore',
        result.speed,
        'speedLevel'
      ],
      [
        'accuracyScore',
        result.accuracy,
        'accuracyLevel'
      ],
      [
        'consistencyScore',
        result.consistency,
        'consistencyLevel'
      ],
      [
        'enduranceScore',
        result.endurance,
        'enduranceLevel'
      ]
    ];

    rows.forEach(
      ([
        scoreId,
        score,
        levelId
      ]) => {
        $(scoreId).textContent =
          `${score}%`;

        $(levelId).textContent =
          level(score);

        const card =
          $(scoreId).closest(
            '.score-card'
          );

        if (card) {
          card.style.setProperty(
            '--score',
            `${score}%`
          );
        }
      }
    );

    $('answeredSummary').textContent =
      `${result.answered} / ${result.totalItems}`;

    $('correctSummary').textContent =
      String(result.correct);

    $('wrongSummary').textContent =
      String(result.wrong);

    $('avgSummary').textContent =
      result.avg.toFixed(1);

    $('resultUsername').textContent =
      state.session?.username ||
      '—';
  }

  /* ============================================================
   * CHART
   * ============================================================
   */

  function drawChart(
    counts
  ) {
    const canvas =
      $('performanceChart');

    if (
      !canvas ||
      !Array.isArray(counts) ||
      counts.length < 2
    ) {
      return;
    }

    const rect =
      canvas.getBoundingClientRect();

    const width =
      Math.max(
        300,
        Math.floor(
          rect.width || 900
        )
      );

    const height = 240;

    const ratio =
      Math.min(
        2,
        Math.max(
          1,
          window.devicePixelRatio ||
            1
        )
      );

    canvas.width =
      width * ratio;

    canvas.height =
      height * ratio;

    canvas.style.height =
      `${height}px`;

    const ctx =
      canvas.getContext('2d');

    ctx.setTransform(
      ratio,
      0,
      0,
      ratio,
      0,
      0
    );

    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    const p = {
      l: 34,
      r: 12,
      t: 14,
      b: 29
    };

    const pw =
      width -
      p.l -
      p.r;

    const ph =
      height -
      p.t -
      p.b;

    const max =
      CONFIG.QUESTIONS_PER_COLUMN;

    ctx.strokeStyle =
      '#e3e9f0';

    ctx.fillStyle =
      '#7b899b';

    ctx.font =
      '10px Inter, system-ui, sans-serif';

    for (
      let i = 0;
      i <= 5;
      i += 1
    ) {
      const y =
        p.t +
        ph -
        (ph * i) / 5;

      ctx.beginPath();

      ctx.moveTo(
        p.l,
        y
      );

      ctx.lineTo(
        p.l + pw,
        y
      );

      ctx.stroke();

      ctx.fillText(
        String(
          Math.round(
            (max * i) / 5
          )
        ),
        5,
        y + 4
      );
    }

    const points =
      counts.map(
        (
          value,
          index
        ) => ({
          x:
            p.l +
            (index /
              (counts.length - 1)) *
              pw,

          y:
            p.t +
            ph -
            (value / max) *
              ph
        })
      );

    ctx.beginPath();

    points.forEach(
      (
        point,
        index
      ) => {
        if (index) {
          ctx.lineTo(
            point.x,
            point.y
          );
        } else {
          ctx.moveTo(
            point.x,
            point.y
          );
        }
      }
    );

    ctx.strokeStyle =
      '#2f7df2';

    ctx.lineWidth = 2.5;

    ctx.lineJoin =
      'round';

    ctx.stroke();

    ctx.fillStyle =
      '#2f7df2';

    points.forEach(
      (point) => {
        ctx.beginPath();

        ctx.arc(
          point.x,
          point.y,
          2.2,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }
    );

    [0, 9, 19, 29, 39, 49].forEach(
      (index) => {
        if (
          index >=
          counts.length
        ) {
          return;
        }

        const x =
          p.l +
          (index /
            (counts.length - 1)) *
            pw;

        ctx.fillStyle =
          '#7b899b';

        ctx.fillText(
          String(index + 1),
          Math.max(
            0,
            x - 5
          ),
          height - 8
        );
      }
    );
  }

  /* ============================================================
   * PDF
   * ============================================================
   */

  function downloadPdf() {
    const result =
      state.lastResult;

    const jsPDF =
      window.jspdf?.jsPDF;

    if (
      !result ||
      !jsPDF
    ) {
      showToast(
        'PDF belum siap. Pastikan koneksi internet aktif, lalu coba lagi.',
        'warning',
        3200
      );

      return;
    }

    const doc =
      new jsPDF({
        unit: 'mm',
        format: 'a4'
      });

    const now =
      new Date();

    const dateText =
      new Intl.DateTimeFormat(
        'id-ID',
        {
          dateStyle: 'full',
          timeStyle: 'short'
        }
      ).format(now);

    const username =
      state.session?.username ||
      'peserta';

    /*
     * Header
     */

    doc.setTextColor(
      24,
      38,
      59
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(21);

    doc.text(
      'Hasil Latihan Tes Kraepelin',
      20,
      23
    );

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.setFontSize(9.5);

    doc.setTextColor(
      98,
      112,
      131
    );

    doc.text(
      `Peserta: ${username}`,
      20,
      30
    );

    doc.text(
      dateText,
      20,
      36
    );

    doc.text(
      '50 kolom • 26 soal/kolom • 15 detik/kolom',
      20,
      42
    );

    /*
     * Score cards
     */

    const cards = [
      [
        'Kecepatan',
        result.speed
      ],
      [
        'Ketelitian',
        result.accuracy
      ],
      [
        'Konsistensi',
        result.consistency
      ],
      [
        'Ketahanan',
        result.endurance
      ]
    ];

    cards.forEach(
      (
        [label, score],
        index
      ) => {
        const x =
          20 +
          (index % 2) *
            85;

        const y =
          51 +
          Math.floor(
            index / 2
          ) *
            34;

        doc.setFillColor(
          245,
          248,
          252
        );

        doc.roundedRect(
          x,
          y,
          78,
          27,
          4,
          4,
          'F'
        );

        doc.setTextColor(
          86,
          101,
          120
        );

        doc.setFontSize(9);

        doc.text(
          label,
          x + 6,
          y + 9
        );

        doc.setTextColor(
          24,
          38,
          59
        );

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.setFontSize(18);

        doc.text(
          `${score}%`,
          x + 6,
          y + 21
        );

        doc.setFont(
          'helvetica',
          'normal'
        );
      }
    );

    /*
     * Summary
     */

    doc.setTextColor(
      24,
      38,
      59
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(11);

    doc.text(
      'Ringkasan',
      20,
      128
    );

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.setFontSize(9.5);

    doc.text(
      `Total dijawab   : ${result.answered}/${result.totalItems}`,
      20,
      136
    );

    doc.text(
      `Total benar     : ${result.correct}`,
      20,
      143
    );

    doc.text(
      `Total salah     : ${result.wrong}`,
      20,
      150
    );

    doc.text(
      `Rata-rata/kolom : ${result.avg.toFixed(
        1
      )} soal`,
      20,
      157
    );

    /*
     * Chart for PDF
     */

    const chartCanvas =
      document.createElement(
        'canvas'
      );

    chartCanvas.width = 900;
    chartCanvas.height = 240;

    drawChartOnCanvas(
      chartCanvas,
      result.counts
    );

    doc.addImage(
      chartCanvas.toDataURL(
        'image/png'
      ),
      'PNG',
      20,
      166,
      170,
      45
    );

    /*
     * Disclaimer
     */

    doc.setFontSize(8.5);

    doc.setTextColor(
      100,
      112,
      128
    );

    const disclaimer =
      'Catatan: skor aplikasi ini adalah skor latihan internal, bukan norma resmi kelulusan psikotes dan bukan diagnosis psikologis.';

    doc.text(
      doc.splitTextToSize(
        disclaimer,
        170
      ),
      20,
      224
    );

    /*
     * Interpretation
     */

    doc.setTextColor(
      24,
      38,
      59
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(10);

    doc.text(
      'Interpretasi latihan',
      20,
      242
    );

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.setFontSize(9);

    doc.text(
      `Kecepatan: ${level(
        result.speed
      )} • Ketelitian: ${level(
        result.accuracy
      )}`,
      20,
      249
    );

    doc.text(
      `Konsistensi: ${level(
        result.consistency
      )} • Ketahanan: ${level(
        result.endurance
      )}`,
      20,
      256
    );

    const safeName =
      username.replace(
        /[^A-Za-z0-9_-]/g,
        '_'
      );

    doc.save(
      `hasil-kraepelin-${safeName}-${now
        .toISOString()
        .slice(0, 10)}.pdf`
    );

    showToast(
      'PDF berhasil dibuat.',
      'success',
      1800
    );
  }

  function drawChartOnCanvas(
    canvas,
    counts
  ) {
    const ctx =
      canvas.getContext('2d');

    const width =
      canvas.width;

    const height =
      canvas.height;

    /*
     * Background
     */

    ctx.fillStyle =
      '#ffffff';

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    const p = {
      l: 44,
      r: 18,
      t: 18,
      b: 28
    };

    const pw =
      width -
      p.l -
      p.r;

    const ph =
      height -
      p.t -
      p.b;

    const max =
      CONFIG.QUESTIONS_PER_COLUMN;

    /*
     * Grid
     */

    ctx.strokeStyle =
      '#dfe6ee';

    ctx.lineWidth = 2;

    for (
      let i = 0;
      i <= 5;
      i += 1
    ) {
      const y =
        p.t +
        ph -
        (ph * i) / 5;

      ctx.beginPath();

      ctx.moveTo(
        p.l,
        y
      );

      ctx.lineTo(
        p.l + pw,
        y
      );

      ctx.stroke();
    }

    /*
     * Line
     */

    ctx.beginPath();

    counts.forEach(
      (
        value,
        index
      ) => {
        const x =
          p.l +
          (index /
            (counts.length - 1)) *
            pw;

        const y =
          p.t +
          ph -
          (value / max) *
            ph;

        if (index) {
          ctx.lineTo(
            x,
            y
          );
        } else {
          ctx.moveTo(
            x,
            y
          );
        }
      }
    );

    ctx.strokeStyle =
      '#2f7df2';

    ctx.lineWidth = 5;

    ctx.lineJoin =
      'round';

    ctx.stroke();
  }

  /* ============================================================
   * FORMAT / ESCAPE
   * ============================================================
   */

  function formatDate(value) {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(
        value || '—'
      );
    }

    return new Intl.DateTimeFormat(
      'id-ID',
      {
        dateStyle: 'medium',
        timeStyle: 'short'
      }
    ).format(date);
  }

  function escapeHtml(value) {
    return String(
      value
    ).replace(
      /[&<>'"]/g,
      (match) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        })[match]
    );
  }

  /* ============================================================
   * LOGOUT
   * ============================================================
   */

  async function logout() {
    const saved =
      readPersistedTest();

    if (saved) {
      const confirmed =
        window.confirm(
          'Ada tes yang belum selesai. Keluar akun sekarang akan membuat tes itu tidak bisa dilanjutkan. Lanjut keluar?'
        );

      if (!confirmed) {
        return;
      }
    }

    try {
      if (state.session?.token) {
        await api(
          'logout',
          {
            token:
              state.session.token
          }
        );
      }
    } catch (error) {
      console.warn(
        'Logout backend gagal:',
        error
      );
    }

    clearSession();

    clearPersistedTest();

    stopTimer();

    state.finished = true;

    state.columns = [];
    state.answers = [];

    state.lastResult = null;

    state.activeTestUserId = null;
    state.currentTestId = null;

    showView('landing');

    showToast(
      'Kamu sudah logout.',
      'info'
    );
  }

  /* ============================================================
   * INITIALIZE
   * ============================================================
   */

  async function initialize() {
    setApiStatus();

    state.session =
      readSession();

    if (state.session) {
      if ($('welcomeName')) {
        $('welcomeName').textContent =
          state.session.username;
      }

      await enterDashboard();

      updateResumeBanner();
    } else {
      showView('landing');
    }
  }

  /* ============================================================
   * EVENT BINDINGS
   * ============================================================
   */

  function bindEvents() {
    /*
     * Landing
     */

    $('landingLoginBtn')?.addEventListener(
      'click',
      () => {
        showAuth('login');
      }
    );

    $('landingRegisterBtn')?.addEventListener(
      'click',
      () => {
        showAuth('register');
      }
    );

    /*
     * Auth navigation
     */

    $('openLoginFromRegister')?.addEventListener(
      'click',
      () => {
        showAuth('login');
      }
    );

    $('openRegisterFromLogin')?.addEventListener(
      'click',
      () => {
        showAuth('register');
      }
    );

    $('backToLandingBtn')?.addEventListener(
      'click',
      () => {
        showView('landing');
      }
    );

    /*
     * Forms
     */

    $('loginForm')?.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        login();
      }
    );

    $('registerForm')?.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        register();
      }
    );

    /*
     * Dashboard
     */

    $('startPracticeBtn')?.addEventListener(
      'click',
      () => {
        showView('instruction');
      }
    );

    $('viewHistoryBtn')?.addEventListener(
      'click',
      () => {
        renderHistory();
        showView('history');
      }
    );

    $('backDashboardBtn')?.addEventListener(
      'click',
      () => {
        enterDashboard();
      }
    );

    $('backFromInstructionBtn')?.addEventListener(
      'click',
      () => {
        enterDashboard();
      }
    );

    $('logoutBtn')?.addEventListener(
      'click',
      logout
    );

    /*
     * Resume
     */

    $('resumeTestBtn')?.addEventListener(
      'click',
      () => {
        const saved =
          readPersistedTest();

        if (saved) {
          restoreTest(saved);
        } else {
          updateResumeBanner();
        }
      }
    );

    /*
     * Test
     */

    $('startTestBtn')?.addEventListener(
      'click',
      startTest
    );

    /*
     * Result
     */

    $('downloadPdfBtn')?.addEventListener(
      'click',
      downloadPdf
    );

    $('resultHistoryBtn')?.addEventListener(
      'click',
      () => {
        renderHistory();
        showView('history');
      }
    );

    $('finishBtn')?.addEventListener(
      'click',
      () => {
        state.lastResult = null;
        enterDashboard();
      }
    );

    /*
     * Keypad
     */

    document
      .querySelectorAll(
        '.digit-btn'
      )
      .forEach((btn) => {
        btn.addEventListener(
          'click',
          () => {
            registerAnswer(
              btn.dataset.digit
            );
          }
        );
      });

    /*
     * Home / End Test
     */

    $('testHomeBtn')?.addEventListener(
      'click',
      openEndTestModal
    );

    $('cancelEndTestBtn')?.addEventListener(
      'click',
      closeEndTestModal
    );

    $('confirmEndTestBtn')?.addEventListener(
      'click',
      abandonTest
    );

    $('confirmModal')?.addEventListener(
      'click',
      (event) => {
        if (
          event.target ===
          $('confirmModal')
        ) {
          closeEndTestModal();
        }
      }
    );

    /*
     * Keyboard angka 0-9
     */

    window.addEventListener(
      'keydown',
      (event) => {
        /*
         * Escape menutup modal konfirmasi
         */

        if (
          event.key ===
            'Escape' &&
          $('confirmModal') &&
          !$('confirmModal').hidden
        ) {
          closeEndTestModal();
          return;
        }

        /*
         * Hanya aktif ketika test
         */

        if (
          !views.test.classList.contains(
            'active'
          )
        ) {
          return;
        }

        /*
         * Jangan mengganggu tombol Home,
         * modal, atau input lain.
         */

        if (
          /^\d$/.test(
            event.key
          )
        ) {
          event.preventDefault();

          registerAnswer(
            event.key
          );
        }
      }
    );

    /*
     * Refresh / close browser
     *
     * persistTest() dilakukan lagi sebagai
     * backup sebelum page unload.
     */

    window.addEventListener(
      'beforeunload',
      () => {
        if (
          !state.finished &&
          views.test.classList.contains(
            'active'
          )
        ) {
          persistTest();
        }
      }
    );

    /*
     * Responsive chart
     */

    window.addEventListener(
      'resize',
      () => {
        if (
          views.result.classList.contains(
            'active'
          ) &&
          state.lastResult
        ) {
          drawChart(
            state.lastResult.counts
          );
        }
      }
    );

    /*
     * Jika session dihapus dari tab lain.
     */

    window.addEventListener(
      'storage',
      (event) => {
        if (
          event.key ===
            CONFIG.SESSION_KEY &&
          !event.newValue &&
          views.test.classList.contains(
            'active'
          )
        ) {
          stopTimer();

          clearPersistedTest();

          showView('landing');

          showToast(
            'Sesi akun telah berakhir di tab lain.',
            'warning'
          );
        }
      }
    );
  }

  /* ============================================================
   * BOOT
   * ============================================================
   */

  bindEvents();

  initialize();
})();
