(() => {
  'use strict';

  // ============================================================
  // KRAEPELIN PRACTICE - FINAL APP.JS
  // ============================================================
  //
  // Struktur:
  // - 50 kolom
  // - 26 soal per kolom
  // - 15 detik per kolom
  // - 27 digit per kolom -> 26 pasangan penjumlahan
  //
  // Backend:
  // Google Apps Script + Google Sheets
  //
  // API:
  // POST -> hidden iframe
  // GET  -> JSONP polling
  //
  // Active test:
  // - refresh browser = progress tetap ada
  // - Home + konfirmasi = progress hangus
  // - selesai tes = active test dihapus
  // ============================================================

  const CONFIG = Object.freeze({
    COLUMNS: 50,
    QUESTIONS_PER_COLUMN: 26,
    DIGITS_PER_COLUMN: 27,
    SECONDS_PER_COLUMN: 15,

    STORAGE_KEY: 'kraepelin_active_test_v5',
    SESSION_KEY: 'kraepelin_session_v5',
    GUEST_TEST_KEY: 'kraepelin_guest_test_v1',

    API_URL:
      'https://script.google.com/macros/s/AKfycbwtcJdN60aa3sbe-CGyqGSj72g7AH47dNJySyNk41pS_3Q7e-M03wfQSumNxItNgP_-yw/exec'
  });

  // ============================================================
  // DOM
  // ============================================================

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

  // ============================================================
  // STATE
  // ============================================================

  const state = {
    session: null,
    isGuest: false,

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

  let apiFrame = null;

  // ============================================================
  // VIEW
  // ============================================================

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
    document.body.dataset.mode =
      state.isGuest ? 'guest' : 'account';

    if (name !== 'test') {
      stopTimer();
    }

    window.scrollTo(0, 0);
  }

  // ============================================================
  // TOAST
  // ============================================================

  function toast(
    message,
    type = 'info',
    duration = 2400
  ) {
    const root = $('toastRoot');

    if (!root) {
      return;
    }

    root.innerHTML = '';

    const el = document.createElement('div');

    el.className =
      `toast toast-${type}`;

    el.textContent = message;

    root.appendChild(el);

    requestAnimationFrame(() => {
      el.classList.add('show');
    });

    setTimeout(() => {
      el.classList.remove('show');

      setTimeout(() => {
        el.remove();
      }, 220);
    }, duration);
  }

  // ============================================================
  // BUTTON BUSY
  // ============================================================

  function busy(
    button,
    label,
    isBusy
  ) {
    if (!button) {
      return;
    }

    if (isBusy) {
      button.dataset.originalText =
        button.textContent;

      button.disabled = true;
      button.textContent = label;
    } else {
      button.disabled = false;

      button.textContent =
        button.dataset.originalText ||
        button.textContent;
    }
  }

  // ============================================================
  // SECURE RANDOM
  // ============================================================

  function secureRandomInt(max) {
    if (
      window.crypto &&
      typeof window.crypto.getRandomValues ===
        'function'
    ) {
      const maxUint =
        0x100000000;

      const limit =
        Math.floor(
          maxUint / max
        ) * max;

      const buffer =
        new Uint32Array(1);

      do {
        window.crypto.getRandomValues(
          buffer
        );
      } while (
        buffer[0] >= limit
      );

      return (
        buffer[0] % max
      );
    }

    return Math.floor(
      Math.random() * max
    );
  }

  function randomDigit() {
    return secureRandomInt(10);
  }

  function createRandomColumn() {
    return Array.from(
      {
        length:
          CONFIG.DIGITS_PER_COLUMN
      },
      randomDigit
    );
  }

  // ============================================================
  // SESSION
  // ============================================================

  function saveSession() {
    if (!state.session) {
      localStorage.removeItem(
        CONFIG.SESSION_KEY
      );

      return;
    }

    try {
      localStorage.setItem(
        CONFIG.SESSION_KEY,
        JSON.stringify(
          state.session
        )
      );
    } catch (error) {
      console.warn(
        'Session tidak dapat disimpan:',
        error
      );
    }
  }

  function loadSession() {
    try {
      const raw =
        localStorage.getItem(
          CONFIG.SESSION_KEY
        );

      if (!raw) {
        return null;
      }

      const session =
        JSON.parse(raw);

      if (
        !session?.token ||
        !session?.user_id ||
        !session?.username
      ) {
        return null;
      }

      return session;
    } catch (error) {
      console.warn(
        'Session tidak valid:',
        error
      );

      return null;
    }
  }

  function clearSession() {
    state.session = null;

    localStorage.removeItem(
      CONFIG.SESSION_KEY
    );
  }

  function enterGuestMode() {
    state.session = null;
    state.isGuest = true;
    state.history = [];
    state.lastResult = null;

    /*
     * Guest mode sengaja tidak menggunakan
     * session akun dan tidak mengirim data
     * hasil ke Google Sheets.
     */
    localStorage.removeItem(CONFIG.SESSION_KEY);

    if ($('welcomeName')) {
      $('welcomeName').textContent = 'Tamu';
    }

    updateResumeBanner();
  }

  function leaveGuestMode() {
    state.isGuest = false;
    state.session = null;
    state.history = [];
    state.lastResult = null;

    clearGuestPersistedTest();

    document.body.dataset.mode = 'account';
  }

  function clearGuestPersistedTest() {
    localStorage.removeItem(
      CONFIG.GUEST_TEST_KEY
    );
  }

  // ============================================================
  // APPS SCRIPT API
  //
  // POST  -> hidden iframe
  // GET   -> JSONP polling
  //
  // Tidak menggunakan:
  // - fetch()
  // - CORS
  // - postMessage dari Apps Script
  // ============================================================

  function ensureApiFrame() {
    if (
      apiFrame &&
      apiFrame.contentWindow
    ) {
      return apiFrame;
    }

    apiFrame =
      document.createElement(
        'iframe'
      );

    apiFrame.name =
      'kraepelinApiFrame';

    apiFrame.title =
      'Backend connector';

    apiFrame.setAttribute(
      'aria-hidden',
      'true'
    );

    apiFrame.tabIndex = -1;

    Object.assign(
      apiFrame.style,
      {
        position: 'fixed',
        width: '1px',
        height: '1px',
        border: '0',
        opacity: '0',
        pointerEvents: 'none',
        left: '-10000px',
        top: '-10000px'
      }
    );

    document.body.appendChild(
      apiFrame
    );

    return apiFrame;
  }

  function makeNonce() {
    if (
      window.crypto &&
      typeof window.crypto.getRandomValues ===
        'function'
    ) {
      const buffer =
        new Uint32Array(4);

      window.crypto.getRandomValues(
        buffer
      );

      return Array.from(
        buffer
      )
        .map(
          (number) =>
            number
              .toString(16)
              .padStart(8, '0')
        )
        .join('-');
    }

    return (
      `${Date.now().toString(36)}-` +
      `${Math.random()
        .toString(36)
        .slice(2)}-` +
      `${Math.random()
        .toString(36)
        .slice(2)}`
    );
  }

  function createJsonpCallbackName() {
    return (
      'kraepelinCallback_' +
      Date.now() +
      '_' +
      Math.floor(
        Math.random() * 1000000
      )
    );
  }

  function pollApiResponse(
    nonce,
    timeoutMs = 20000
  ) {
    return new Promise(
      (
        resolve,
        reject
      ) => {
        const callbackName =
          createJsonpCallbackName();

        let settled = false;

        let script = null;

        let timeoutId = null;

        function cleanup() {
          if (timeoutId) {
            clearTimeout(
              timeoutId
            );
          }

          try {
            delete window[
              callbackName
            ];
          } catch (_) {
            window[
              callbackName
            ] = undefined;
          }

          if (script) {
            script.remove();
          }
        }

        function fail(message) {
          if (settled) {
            return;
          }

          settled = true;

          cleanup();

          reject(
            new Error(message)
          );
        }

        function succeed(value) {
          if (settled) {
            return;
          }

          settled = true;

          cleanup();

          resolve(value);
        }

        function load() {
          if (settled) {
            return;
          }

          if (script) {
            script.remove();
          }

          script =
            document.createElement(
              'script'
            );

          script.async = true;

          script.src =
            CONFIG.API_URL +
            '?action=poll' +
            '&nonce=' +
            encodeURIComponent(
              nonce
            ) +
            '&callback=' +
            encodeURIComponent(
              callbackName
            ) +
            '&_=' +
            Date.now();

          script.onerror = () => {
            if (!settled) {
              setTimeout(
                load,
                350
              );
            }
          };

          document.head.appendChild(
            script
          );
        }

        window[
          callbackName
        ] = (response) => {
          if (settled) {
            return;
          }

          /*
           * Apps Script memberi:
           * { pending: true }
           * jika response belum tersedia.
           */
          if (
            response &&
            response.pending === true
          ) {
            setTimeout(
              load,
              200
            );

            return;
          }

          if (!response) {
            fail(
              'Response dari backend kosong.'
            );

            return;
          }

          succeed(
            response
          );
        };

        timeoutId =
          setTimeout(
            () => {
              fail(
                'Backend tidak merespons dalam 20 detik. Periksa deployment Web App Apps Script.'
              );
            },
            timeoutMs
          );

        load();
      }
    );
  }

  async function api(
    action,
    payload = {}
  ) {
    if (state.isGuest) {
      throw new Error(
        'Mode tamu tidak menggunakan backend akun.'
      );
    }

    if (!CONFIG.API_URL) {
      throw new Error(
        'URL backend belum dikonfigurasi.'
      );
    }

    const frame =
      ensureApiFrame();

    const nonce =
      makeNonce();

    const data = {
      action,
      ...payload,
      nonce
    };

    const form =
      document.createElement(
        'form'
      );

    form.method =
      'POST';

    form.action =
      CONFIG.API_URL;

    form.target =
      frame.name;

    form.enctype =
      'application/x-www-form-urlencoded';

    form.acceptCharset =
      'UTF-8';

    form.style.display =
      'none';

    const dataInput =
      document.createElement(
        'input'
      );

    dataInput.type =
      'hidden';

    dataInput.name =
      'data';

    dataInput.value =
      JSON.stringify(
        data
      );

    form.appendChild(
      dataInput
    );

    document.body.appendChild(
      form
    );

    try {
      /*
       * Request dikirim ke Apps Script.
       * Response POST tidak dibaca browser.
       */
      form.submit();
    } catch (error) {
      form.remove();

      throw new Error(
        `Gagal mengirim request ke backend: ${
          error?.message || error
        }`
      );
    }

    setTimeout(
      () => {
        form.remove();
      },
      1000
    );

    /*
     * Ambil response berdasarkan nonce.
     */
    const response =
      await pollApiResponse(
        nonce
      );

    if (
      !response ||
      response.success !== true
    ) {
      throw new Error(
        response?.message ||
        'Permintaan ke backend gagal.'
      );
    }

    return response;
  }

  function apiGetHistory() {
    if (state.isGuest) {
      return Promise.resolve({
        success: true,
        history: []
      });
    }

    if (
      !state.session?.token
    ) {
      return Promise.reject(
        new Error(
          'Session login tidak tersedia.'
        )
      );
    }

    return api(
      'getHistory',
      {
        token:
          state.session.token
      }
    );
  }

  // ============================================================
  // GUEST MODE
  // ============================================================

  function openGuestModal() {
    $('guestModal').hidden = false;
    $('cancelGuestBtn')?.focus();
  }

  function closeGuestModal() {
    $('guestModal').hidden = true;
  }

  function confirmGuestMode() {
    closeGuestModal();

    leaveGuestMode();
    enterGuestMode();

    showView('instruction');

    toast(
      'Mode tamu aktif. Hasil tidak masuk histori.',
      'info',
      2600
    );
  }

  // ============================================================
  // AUTH VIEW
  // ============================================================

  function showAuth(
    mode = 'login'
  ) {
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

    $('loginError').textContent =
      '';

    $('registerError').textContent =
      '';

    showView('auth');

    setTimeout(() => {
      const input =
        $(
          registerMode
            ? 'registerUsername'
            : 'loginUsername'
        );

      input?.focus();
    }, 50);
  }

  // ============================================================
  // REGISTER
  // ============================================================

  async function register() {
    const username =
      $('registerUsername')
        .value
        .trim();

    const password =
      $('registerPassword')
        .value;

    const confirm =
      $('registerConfirm')
        .value;

    const button =
      $('registerBtn');

    const error =
      $('registerError');

    error.textContent =
      '';

    if (
      !/^[A-Za-z0-9_]{3,24}$/.test(
        username
      )
    ) {
      error.textContent =
        'Username 3–24 karakter, hanya huruf, angka, dan underscore.';

      return;
    }

    if (
      password.length < 8
    ) {
      error.textContent =
        'Password minimal 8 karakter.';

      return;
    }

    if (
      password !== confirm
    ) {
      error.textContent =
        'Konfirmasi password belum sama.';

      return;
    }

    busy(
      button,
      'Membuat akun…',
      true
    );

    try {
      const response =
        await api(
          'register',
          {
            username,
            password
          }
        );

      state.isGuest = false;
      state.isGuest = false;
      state.session =
        response.session;

      saveSession();

      $('registerForm')
        .reset();

      await goDashboard(
        'Akun berhasil dibuat. Selamat datang!'
      );
    } catch (errorObject) {
      error.textContent =
        errorObject?.message ||
        'Gagal membuat akun.';
    } finally {
      busy(
        button,
        '',
        false
      );
    }
  }

  // ============================================================
  // LOGIN
  // ============================================================

  async function login() {
    const username =
      $('loginUsername')
        .value
        .trim();

    const password =
      $('loginPassword')
        .value;

    const button =
      $('loginBtn');

    const error =
      $('loginError');

    error.textContent =
      '';

    if (
      !username ||
      !password
    ) {
      error.textContent =
        'Username dan password wajib diisi.';

      return;
    }

    busy(
      button,
      'Memeriksa…',
      true
    );

    try {
      const response =
        await api(
          'login',
          {
            username,
            password
          }
        );

      state.session =
        response.session;

      saveSession();

      $('loginForm')
        .reset();

      await goDashboard(
        'Login berhasil.'
      );
    } catch (errorObject) {
      error.textContent =
        errorObject?.message ||
        'Login gagal.';
    } finally {
      busy(
        button,
        '',
        false
      );
    }
  }

  // ============================================================
  // DASHBOARD
  // ============================================================

  async function goDashboard(
    message = ''
  ) {
    if (state.isGuest) {
      showView('landing');
      return;
    }

    if (!state.session) {
      showView('landing');
      return;
    }

    $('welcomeName').textContent =
      state.session.username;

    updateResumeBanner();

    showView('dashboard');

    try {
      const response =
        await apiGetHistory();

      state.history =
        Array.isArray(
          response.history
        )
          ? response.history
          : [];

      renderDashboard();

      renderHistory();
    } catch (errorObject) {
      renderDashboard();

      toast(
        `Histori belum bisa dimuat: ${
          errorObject?.message ||
          errorObject
        }`,
        'warning',
        3600
      );
    }

    if (message) {
      toast(
        message,
        'success'
      );
    }
  }

  function renderDashboard() {
    $('historyCount').textContent =
      String(
        state.history.length
      );

    if (
      !state.history.length
    ) {
      $('latestDate').textContent =
        'Belum ada tes';

      [
        'dashSpeed',
        'dashAccuracy',
        'dashConsistency',
        'dashEndurance'
      ].forEach(
        (id) => {
          $(id).textContent =
            '—';
        }
      );

      return;
    }

    const latest =
      state.history[0];

    $('latestDate').textContent =
      formatDate(
        latest.tanggal
      );

    $('dashSpeed').textContent =
      `${Math.round(
        Number(
          latest.speed
        ) || 0
      )}%`;

    $('dashAccuracy').textContent =
      `${Math.round(
        Number(
          latest.accuracy
        ) || 0
      )}%`;

    $('dashConsistency').textContent =
      `${Math.round(
        Number(
          latest.consistency
        ) || 0
      )}%`;

    $('dashEndurance').textContent =
      `${Math.round(
        Number(
          latest.endurance
        ) || 0
      )}%`;
  }

  // ============================================================
  // HISTORY
  // ============================================================

  function renderHistory() {
    const body =
      $('historyTableBody');

    if (!body) {
      return;
    }

    body.innerHTML =
      '';

    $('historyPageCount').textContent =
      String(
        state.history.length
      );

    if (
      !state.history.length
    ) {
      $('emptyHistory').hidden =
        false;

      $('historyTable').hidden =
        true;

      return;
    }

    $('emptyHistory').hidden =
      true;

    $('historyTable').hidden =
      false;

    state.history.forEach(
      (
        item,
        index
      ) => {
        const row =
          document.createElement(
            'tr'
          );

        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${escapeHtml(
            formatDate(
              item.tanggal
            )
          )}</td>
          <td>${Math.round(
            Number(
              item.speed
            ) || 0
          )}%</td>
          <td>${Math.round(
            Number(
              item.accuracy
            ) || 0
          )}%</td>
          <td>${Math.round(
            Number(
              item.consistency
            ) || 0
          )}%</td>
          <td>${Math.round(
            Number(
              item.endurance
            ) || 0
          )}%</td>
        `;

        body.appendChild(
          row
        );
      }
    );
  }

  // ============================================================
  // ACTIVE TEST STORAGE
  // ============================================================

  function persistTest() {
    if (
      state.finished ||
      !state.columns.length
    ) {
      return;
    }

    if (state.isGuest) {
      /*
       * Mode tamu tidak menyimpan progress ke
       * localStorage, akun, atau Google Sheets.
       */
      return;
    }

    if (
      !state.session ||
      state.activeTestUserId !==
        state.session.user_id
    ) {
      return;
    }

    const snapshot = {
      version: 5,

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
        JSON.stringify(
          snapshot
        )
      );
    } catch (error) {
      toast(
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
    if (state.isGuest) {
      return null;
    }

    try {
      const raw =
        localStorage.getItem(
          CONFIG.STORAGE_KEY
        );

      if (!raw) {
        return null;
      }

      const saved =
        JSON.parse(raw);

      const valid =
        saved?.version === 5 &&
        saved.userId ===
          state.session?.user_id &&
        saved.testId &&
        Array.isArray(
          saved.columns
        ) &&
        Array.isArray(
          saved.answers
        );

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

  function updateResumeBanner() {
    const banner =
      $('resumeTestBanner');

    if (!banner) {
      return;
    }

    banner.hidden =
      !readPersistedTest();
  }

  function catchUpElapsedColumns() {
    const elapsedSeconds =
      Math.max(
        0,
        (
          Date.now() -
          state.columnStartedAt
        ) / 1000
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

    const remainderMs =
      (
        elapsedSeconds %
        CONFIG.SECONDS_PER_COLUMN
      ) * 1000;

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

    state.questionIndex =
      0;

    state.columnStartedAt =
      Date.now() -
      remainderMs;
  }

  function restoreTest(
    saved
  ) {
    state.columns =
      saved.columns;

    state.answers =
      saved.answers;

    state.columnIndex =
      Math.max(
        0,
        Math.min(
          CONFIG.COLUMNS - 1,
          Number(
            saved.columnIndex
          ) || 0
        )
      );

    state.questionIndex =
      Math.max(
        0,
        Math.min(
          CONFIG.QUESTIONS_PER_COLUMN -
            1,
          Number(
            saved.questionIndex
          ) || 0
        )
      );

    state.columnStartedAt =
      Number(
        saved.columnStartedAt
      ) ||
      Date.now();

    state.testStartedAt =
      Number(
        saved.testStartedAt
      ) ||
      Date.now();

    state.activeTestUserId =
      saved.userId;

    state.currentTestId =
      saved.testId;

    state.finished =
      false;

    catchUpElapsedColumns();

    if (state.finished) {
      return;
    }

    persistTest();

    showView('test');

    renderQuestion();

    startTimer();

    toast(
      'Tes dilanjutkan. Progress tetap aman setelah refresh.',
      'success',
      2500
    );
  }

  // ============================================================
  // BUILD TEST
  // ============================================================

  function buildTest() {
    state.columns =
      Array.from(
        {
          length:
            CONFIG.COLUMNS
        },
        createRandomColumn
      );

    state.answers =
      Array.from(
        {
          length:
            CONFIG.COLUMNS
        },
        () =>
          Array(
            CONFIG.QUESTIONS_PER_COLUMN
          ).fill(null)
      );

    state.columnIndex =
      0;

    state.questionIndex =
      0;

    const now =
      Date.now();

    state.columnStartedAt =
      now;

    state.testStartedAt =
      now;

    state.finished =
      false;

    state.activeTestUserId =
      state.isGuest
        ? null
        : state.session.user_id;

    state.currentTestId =
      `T-${Date.now()}-${secureRandomInt(
        1000000
      )}`;

    state.lastResult =
      null;

    persistTest();
  }

  // ============================================================
  // KRAEPELIN QUESTION
  // ============================================================

  function getPair(
    columnIndex = state.columnIndex,
    questionIndex = state.questionIndex
  ) {
    const digits =
      state.columns[
        columnIndex
      ];

    const bottomIndex =
      CONFIG.DIGITS_PER_COLUMN -
      1 -
      questionIndex;

    return {
      top:
        digits[
          bottomIndex - 1
        ],

      bottom:
        digits[
          bottomIndex
        ]
    };
  }

  function correctAnswerFor(
    columnIndex,
    questionIndex
  ) {
    const {
      top,
      bottom
    } = getPair(
      columnIndex,
      questionIndex
    );

    return (
      (top + bottom) %
      10
    );
  }

  // ============================================================
  // RENDER QUESTION
  // ============================================================

  function renderQuestion() {
    if (
      state.finished
    ) {
      return;
    }

    const {
      top,
      bottom
    } = getPair();

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

  // ============================================================
  // TIMER
  // ============================================================

  function updateTimerText() {
    const elapsed =
      Math.max(
        0,
        (
          Date.now() -
          state.columnStartedAt
        ) / 1000
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
          (
            Date.now() -
            state.columnStartedAt
          ) / 1000
        )
      );

    const fraction =
      elapsed /
      CONFIG.SECONDS_PER_COLUMN;

    const percent =
      (
        (
          state.columnIndex +
          fraction
        ) /
        CONFIG.COLUMNS
      ) * 100;

    $('progressBar').style.width =
      `${Math.min(
        100,
        Math.max(
          0,
          percent
        )
      )}%`;
  }

  function pulseButton(
    digit
  ) {
    const button =
      document.querySelector(
        `.digit-btn[data-digit="${digit}"]`
      );

    if (!button) {
      return;
    }

    button.classList.remove(
      'active-pulse'
    );

    void button.offsetWidth;

    button.classList.add(
      'active-pulse'
    );

    setTimeout(
      () => {
        button.classList.remove(
          'active-pulse'
        );
      },
      120
    );
  }

  // ============================================================
  // ANSWER
  // ============================================================

  function registerAnswer(
    value
  ) {
    if (
      state.finished ||
      !views.test.classList.contains(
        'active'
      )
    ) {
      return;
    }

    if (
      !state.answers[
        state.columnIndex
      ]
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

    const current =
      state.answers[
        state.columnIndex
      ][
        state.questionIndex
      ];

    if (
      current !== null &&
      current !== undefined
    ) {
      return;
    }

    state.answers[
      state.columnIndex
    ][
      state.questionIndex
    ] =
      numericValue;

    pulseButton(
      numericValue
    );

    persistTest();

    if (
      state.questionIndex <
      CONFIG.QUESTIONS_PER_COLUMN -
        1
    ) {
      state.questionIndex +=
        1;

      renderQuestion();
    } else {
      nextColumn(
        'completed'
      );
    }
  }

  // ============================================================
  // COLUMN TRANSITION
  // ============================================================

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

    state.columnIndex +=
      1;

    state.questionIndex =
      0;

    state.columnStartedAt =
      Date.now();

    renderQuestion();

    persistTest();

    if (
      reason === 'timer'
    ) {
      toast(
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

    updateTimerText();

    updateProgress();

    const elapsed =
      (
        Date.now() -
        state.columnStartedAt
      ) / 1000;

    if (
      elapsed >=
      CONFIG.SECONDS_PER_COLUMN
    ) {
      nextColumn(
        'timer'
      );
    }
  }

  function startTimer() {
    stopTimer();

    state.timerId =
      setInterval(
        tick,
        50
      );

    tick();
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(
        state.timerId
      );
    }

    state.timerId =
      null;
  }

  // ============================================================
  // START TEST
  // ============================================================

  function startTest() {
    if (!state.session && !state.isGuest) {
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
        showView(
          'dashboard'
        );

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

  // ============================================================
  // STATISTICS
  // ============================================================

  function mean(values) {
    if (
      !values.length
    ) {
      return 0;
    }

    return (
      values.reduce(
        (
          total,
          value
        ) =>
          total + value,
        0
      ) /
      values.length
    );
  }

  function standardDeviation(
    values,
    average
  ) {
    if (
      !values.length
    ) {
      return 0;
    }

    return Math.sqrt(
      mean(
        values.map(
          (value) =>
            Math.pow(
              value -
                average,
              2
            )
        )
      )
    );
  }

  function clamp(
    value,
    min = 0,
    max = 100
  ) {
    return Math.max(
      min,
      Math.min(
        max,
        value
      )
    );
  }

  // ============================================================
  // SCORING
  // ============================================================

  function calculateResults() {
    const counts =
      state.answers.map(
        (column) =>
          column.filter(
            (
              value
            ) =>
              value !==
              null
          ).length
      );

    let answered = 0;
    let correct = 0;

    state.answers.forEach(
      (
        column,
        columnIndex
      ) => {
        column.forEach(
          (
            answer,
            questionIndex
          ) => {
            if (
              answer === null
            ) {
              return;
            }

            answered +=
              1;

            if (
              answer ===
              correctAnswerFor(
                columnIndex,
                questionIndex
              )
            ) {
              correct +=
                1;
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

    // Kecepatan
    const speed =
      Math.round(
        clamp(
          (
            answered /
            totalItems
          ) * 100
        )
      );

    // Ketelitian
    const accuracy =
      answered > 0
        ? Math.round(
            clamp(
              (
                correct /
                answered
              ) * 100
            )
          )
        : 0;

    // Konsistensi
    const average =
      mean(counts);

    const sd =
      standardDeviation(
        counts,
        average
      );

    const coefficient =
      average > 0
        ? sd / average
        : 1;

    const consistency =
      Math.round(
        clamp(
          100 -
            coefficient *
              100
        )
      );

    // Ketahanan
    const first =
      mean(
        counts.slice(
          0,
          10
        )
      );

    const middle =
      mean(
        counts.slice(
          20,
          30
        )
      );

    const last =
      mean(
        counts.slice(
          40,
          50
        )
      );

    const baseline =
      Math.max(
        1,
        mean([
          first,
          middle
        ])
      );

    const decline =
      Math.max(
        0,
        (
          baseline -
          last
        ) /
        baseline
      );

    const endurance =
      Math.round(
        clamp(
          100 -
            decline *
              100
        )
      );

    return {
      counts,

      answered,

      correct,

      wrong,

      avg:
        average,

      speed,

      accuracy,

      consistency,

      endurance,

      totalItems
    };
  }

  // ============================================================
  // SAVE HISTORY
  // ============================================================

  async function saveHistory(
    result
  ) {
    if (state.isGuest) {
      return false;
    }

    if (
      !state.session ||
      state.savingHistory
    ) {
      return false;
    }

    state.savingHistory =
      true;

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
    } catch (errorObject) {
      toast(
        `Hasil tampil, tetapi histori belum tersimpan: ${
          errorObject?.message ||
          errorObject
        }`,
        'warning',
        3800
      );

      return false;
    } finally {
      state.savingHistory =
        false;
    }
  }

  // ============================================================
  // FINISH TEST
  // ============================================================

  async function finishTest() {
    if (
      state.finished
    ) {
      return;
    }

    state.finished =
      true;

    stopTimer();

    const result =
      calculateResults();

    state.lastResult =
      result;

    /*
     * Hapus active test.
     *
     * Kalau halaman result direfresh,
     * hasil tidak dapat dipulihkan.
     */
    clearPersistedTest();

    renderResults(
      result
    );

    showView(
      'result'
    );

    requestAnimationFrame(
      () => {
        drawChart(
          result.counts
        );
      }
    );

    await saveHistory(
      result
    );

    if (state.isGuest) {
      state.history = [];
      return;
    }

    try {
      const response =
        await apiGetHistory();

      state.history =
        Array.isArray(
          response.history
        )
          ? response.history
          : [];

      renderDashboard();
      renderHistory();
    } catch (errorObject) {
      console.warn(
        'Gagal refresh history:',
        errorObject
      );
    }
  }

  // ============================================================
  // ABANDON TEST
  // ============================================================

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

    $('cancelEndTestBtn')?.focus();
  }

  function closeEndTestModal() {
    $('confirmModal').hidden =
      true;
  }

  function abandonTest() {
    /*
     * Home + konfirmasi =
     * tes dibatalkan.
     *
     * Tidak ada:
     * - hasil
     * - history
     * - progress
     */

    stopTimer();

    clearPersistedTest();

    state.columns = [];

    state.answers = [];

    state.columnIndex = 0;

    state.questionIndex = 0;

    state.columnStartedAt =
      0;

    state.testStartedAt =
      0;

    state.finished =
      true;

    state.lastResult =
      null;

    state.activeTestUserId =
      null;

    state.currentTestId =
      null;

    closeEndTestModal();

    goDashboard(
      'Tes diakhiri. Progress tadi dihapus dan tidak disimpan.'
    );
  }

  // ============================================================
  // RESULT LEVEL
  // ============================================================

  function level(
    score
  ) {
    if (
      score >= 90
    ) {
      return 'Sangat baik';
    }

    if (
      score >= 80
    ) {
      return 'Baik';
    }

    if (
      score >= 65
    ) {
      return 'Cukup';
    }

    if (
      score >= 50
    ) {
      return 'Perlu latihan';
    }

    return 'Perlu ditingkatkan';
  }

  // ============================================================
  // RESULT
  // ============================================================

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
          level(
            score
          );

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
      String(
        result.correct
      );

    $('wrongSummary').textContent =
      String(
        result.wrong
      );

    $('avgSummary').textContent =
      result.avg.toFixed(
        1
      );

    $('resultUsername').textContent =
      state.isGuest
        ? 'Tamu'
        : state.session?.username || '—';

    const resultIntro =
      $('resultIntro');

    if (resultIntro) {
      if (state.isGuest) {
        resultIntro.innerHTML =
          'Hasil untuk <strong>Tamu</strong> tidak disimpan ke histori. <strong>Download PDF sekarang</strong> untuk menyimpan hasil latihanmu.';
      } else {
        resultIntro.innerHTML =
          `Hasil untuk <strong>${escapeHtml(
            state.session?.username || 'peserta'
          )}</strong> sudah masuk ke histori. Download PDF kalau ingin menyimpan salinan detailnya.`;
      }
    }
  }

  // ============================================================
  // CHART
  // ============================================================

  function drawChart(
    counts
  ) {
    const canvas =
      $('performanceChart');

    if (
      !canvas ||
      !Array.isArray(
        counts
      ) ||
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
          rect.width ||
            900
        )
      );

    const height =
      240;

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
      width *
      ratio;

    canvas.height =
      height *
      ratio;

    canvas.style.height =
      `${height}px`;

    const ctx =
      canvas.getContext(
        '2d'
      );

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

    const padding = {
      left: 34,
      right: 12,
      top: 14,
      bottom: 29
    };

    const plotWidth =
      width -
      padding.left -
      padding.right;

    const plotHeight =
      height -
      padding.top -
      padding.bottom;

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
        padding.top +
        plotHeight -
        (
          plotHeight *
          i
        ) /
          5;

      ctx.beginPath();

      ctx.moveTo(
        padding.left,
        y
      );

      ctx.lineTo(
        padding.left +
          plotWidth,
        y
      );

      ctx.stroke();

      ctx.fillText(
        String(
          Math.round(
            (
              max *
              i
            ) /
              5
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
            padding.left +
            (
              index /
              (
                counts.length -
                1
              )
            ) *
              plotWidth,

          y:
            padding.top +
            plotHeight -
            (
              value /
              max
            ) *
              plotHeight
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

    ctx.lineWidth =
      2.5;

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

    [
      0,
      9,
      19,
      29,
      39,
      49
    ].forEach(
      (index) => {
        if (
          index >=
          counts.length
        ) {
          return;
        }

        const x =
          padding.left +
          (
            index /
            (
              counts.length -
              1
            )
          ) *
            plotWidth;

        ctx.fillStyle =
          '#7b899b';

        ctx.fillText(
          String(
            index + 1
          ),
          Math.max(
            0,
            x - 5
          ),
          height - 8
        );
      }
    );
  }

  // ============================================================
  // PDF CHART
  // ============================================================

  function drawPdfChart(
    canvas,
    counts
  ) {
    const ctx =
      canvas.getContext(
        '2d'
      );

    const width =
      canvas.width;

    const height =
      canvas.height;

    ctx.fillStyle =
      '#ffffff';

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    const padding = {
      left: 44,
      right: 18,
      top: 18,
      bottom: 28
    };

    const plotWidth =
      width -
      padding.left -
      padding.right;

    const plotHeight =
      height -
      padding.top -
      padding.bottom;

    const max =
      CONFIG.QUESTIONS_PER_COLUMN;

    ctx.strokeStyle =
      '#dfe6ee';

    ctx.lineWidth = 2;

    for (
      let i = 0;
      i <= 5;
      i += 1
    ) {
      const y =
        padding.top +
        plotHeight -
        (
          plotHeight *
          i
        ) /
          5;

      ctx.beginPath();

      ctx.moveTo(
        padding.left,
        y
      );

      ctx.lineTo(
        padding.left +
          plotWidth,
        y
      );

      ctx.stroke();
    }

    ctx.beginPath();

    counts.forEach(
      (
        value,
        index
      ) => {
        const x =
          padding.left +
          (
            index /
            (
              counts.length -
              1
            )
          ) *
            plotWidth;

        const y =
          padding.top +
          plotHeight -
          (
            value /
            max
          ) *
            plotHeight;

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

    ctx.lineWidth =
      5;

    ctx.lineJoin =
      'round';

    ctx.stroke();
  }

  // ============================================================
  // PDF
  // ============================================================

  function downloadPdf() {
    const result =
      state.lastResult;

    const jsPDF =
      window.jspdf?.jsPDF;

    if (
      !result ||
      !jsPDF
    ) {
      toast(
        'PDF belum siap. Pastikan koneksi internet aktif.',
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

    const username =
      state.session?.username ||
      'peserta';

    const dateText =
      new Intl.DateTimeFormat(
        'id-ID',
        {
          dateStyle: 'full',
          timeStyle: 'short'
        }
      ).format(
        now
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

    doc.setFontSize(
      21
    );

    doc.text(
      'Hasil Latihan Tes Kraepelin',
      20,
      23
    );

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.setFontSize(
      9.5
    );

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
        [
          label,
          score
        ],
        index
      ) => {
        const x =
          20 +
          (
            index %
            2
          ) *
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

        doc.setFontSize(
          9
        );

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

        doc.setFontSize(
          18
        );

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

    doc.setTextColor(
      24,
      38,
      59
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(
      11
    );

    doc.text(
      'Ringkasan',
      20,
      128
    );

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.setFontSize(
      9.5
    );

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

    const chartCanvas =
      document.createElement(
        'canvas'
      );

    chartCanvas.width =
      900;

    chartCanvas.height =
      240;

    drawPdfChart(
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

    doc.setFontSize(
      8.5
    );

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

    doc.setTextColor(
      24,
      38,
      59
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(
      10
    );

    doc.text(
      'Interpretasi latihan',
      20,
      242
    );

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.setFontSize(
      9
    );

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
        .slice(
          0,
          10
        )}.pdf`
    );

    toast(
      'PDF berhasil dibuat.',
      'success',
      1800
    );
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async function logout() {
    if (state.isGuest) {
      leaveGuestMode();

      showView('landing');

      toast(
        'Mode tamu selesai.',
        'info'
      );

      return;
    }

    const active =
      readPersistedTest();

    if (active) {
      const confirmLogout =
        window.confirm(
          'Ada tes yang belum selesai. Logout akan menghapus progress tes tersebut. Lanjut logout?'
        );

      if (!confirmLogout) {
        return;
      }
    }

    try {
      if (
        state.session?.token
      ) {
        await api(
          'logout',
          {
            token:
              state.session.token
          }
        );
      }
    } catch (
      errorObject
    ) {
      console.warn(
        'Logout backend gagal:',
        errorObject
      );
    }

    clearSession();

    clearPersistedTest();

    stopTimer();

    state.columns = [];

    state.answers = [];

    state.lastResult =
      null;

    state.finished =
      true;

    state.activeTestUserId =
      null;

    state.currentTestId =
      null;

    showView(
      'landing'
    );

    toast(
      'Kamu sudah logout.',
      'info'
    );
  }

  // ============================================================
  // HELPER
  // ============================================================

  function formatDate(
    value
  ) {
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
        dateStyle:
          'medium',
        timeStyle:
          'short'
      }
    ).format(
      date
    );
  }

  function escapeHtml(
    value
  ) {
    return String(
      value
    ).replace(
      /[&<>'"]/g,
      (match) =>
        ({
          '&':
            '&amp;',

          '<':
            '&lt;',

          '>':
            '&gt;',

          "'":
            '&#39;',

          '"':
            '&quot;'
        })[
          match
        ]
    );
  }

  // ============================================================
  // EVENTS
  // ============================================================

  function bindEvents() {
    // Landing
    $('landingLoginBtn')
      ?.addEventListener(
        'click',
        () =>
          showAuth(
            'login'
          )
      );

    $('landingRegisterBtn')
      ?.addEventListener(
        'click',
        () =>
          showAuth(
            'register'
          )
      );

    $('landingGuestBtn')
      ?.addEventListener(
        'click',
        openGuestModal
      );

    // Auth navigation
    $('openLoginFromRegister')
      ?.addEventListener(
        'click',
        () =>
          showAuth(
            'login'
          )
      );

    $('openRegisterFromLogin')
      ?.addEventListener(
        'click',
        () =>
          showAuth(
            'register'
          )
      );

    $('backToLandingBtn')
      ?.addEventListener(
        'click',
        () =>
          showView(
            'landing'
          )
      );

    // Forms
    $('loginForm')
      ?.addEventListener(
        'submit',
        (
          event
        ) => {
          event.preventDefault();
          login();
        }
      );

    $('registerForm')
      ?.addEventListener(
        'submit',
        (
          event
        ) => {
          event.preventDefault();
          register();
        }
      );

    // Dashboard
    $('startPracticeBtn')
      ?.addEventListener(
        'click',
        () =>
          showView(
            'instruction'
          )
      );

    $('viewHistoryBtn')
      ?.addEventListener(
        'click',
        () => {
          renderHistory();

          showView(
            'history'
          );
        }
      );

    $('backDashboardBtn')
      ?.addEventListener(
        'click',
        () =>
          goDashboard()
      );

    $('backFromInstructionBtn')
      ?.addEventListener(
        'click',
        () => {
          if (state.isGuest) {
            leaveGuestMode();
            showView('landing');
          } else {
            goDashboard();
          }
        }
      );

    $('logoutBtn')
      ?.addEventListener(
        'click',
        logout
      );

    // Resume
    $('resumeTestBtn')
      ?.addEventListener(
        'click',
        () => {
          const saved =
            readPersistedTest();

          if (saved) {
            restoreTest(
              saved
            );
          } else {
            updateResumeBanner();
          }
        }
      );

    // Test
    $('startTestBtn')
      ?.addEventListener(
        'click',
        startTest
      );

    $('testHomeBtn')
      ?.addEventListener(
        'click',
        openEndTestModal
      );

    // Result
    $('downloadPdfBtn')
      ?.addEventListener(
        'click',
        downloadPdf
      );

    $('resultHistoryBtn')
      ?.addEventListener(
        'click',
        () => {
          if (state.isGuest) {
            toast(
              'Mode tamu tidak memiliki histori. Download PDF untuk menyimpan hasil.',
              'info',
              3000
            );
            return;
          }

          renderHistory();

          showView(
            'history'
          );
        }
      );

    $('finishBtn')
      ?.addEventListener(
        'click',
        () => {
          state.lastResult =
            null;

          if (state.isGuest) {
            leaveGuestMode();
            showView('landing');
          } else {
            goDashboard();
          }
        }
      );

    // History
    $('backDashboardBtn')
      ?.addEventListener(
        'click',
        () =>
          goDashboard()
      );

    // Keypad
    document
      .querySelectorAll(
        '.digit-btn'
      )
      .forEach(
        (
          button
        ) => {
          button.addEventListener(
            'click',
            () =>
              registerAnswer(
                button.dataset
                  .digit
              )
          );
        }
      );

    // Modal
    $('cancelEndTestBtn')
      ?.addEventListener(
        'click',
        closeEndTestModal
      );

    $('confirmEndTestBtn')
      ?.addEventListener(
        'click',
        abandonTest
      );

    $('cancelGuestBtn')
      ?.addEventListener(
        'click',
        closeGuestModal
      );

    $('confirmGuestBtn')
      ?.addEventListener(
        'click',
        confirmGuestMode
      );

    $('guestModal')
      ?.addEventListener(
        'click',
        (event) => {
          if (
            event.target ===
            $('guestModal')
          ) {
            closeGuestModal();
          }
        }
      );

    $('confirmModal')
      ?.addEventListener(
        'click',
        (
          event
        ) => {
          if (
            event.target ===
            $('confirmModal')
          ) {
            closeEndTestModal();
          }
        }
      );

    // Keyboard
    window.addEventListener(
      'keydown',
      (
        event
      ) => {
        if (
          event.key ===
            'Escape' &&
          $('guestModal') &&
          !$('guestModal').hidden
        ) {
          closeGuestModal();

          return;
        }

        if (
          event.key ===
            'Escape' &&
          $('confirmModal') &&
          !$('confirmModal')
            .hidden
        ) {
          closeEndTestModal();

          return;
        }

        if (
          !views.test.classList.contains(
            'active'
          )
        ) {
          return;
        }

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

    // Backup progress saat refresh
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

    // Responsive chart
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

    // Session berubah di tab lain
    window.addEventListener(
      'storage',
      (
        event
      ) => {
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

          showView(
            'landing'
          );

          toast(
            'Sesi akun telah berakhir di tab lain.',
            'warning'
          );
        }
      }
    );
  }

  // ============================================================
  // INIT
  // ============================================================

  async function initialize() {
    state.session =
      loadSession();

    state.isGuest = false;

    if (
      state.session
    ) {
      await goDashboard();

      return;
    }

    showView(
      'landing'
    );
  }

  // ============================================================
  // START APP
  // ============================================================

  bindEvents();

  initialize();

})();
