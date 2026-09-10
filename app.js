(() => {
  'use strict';

  const CONFIG = Object.freeze({
    COLUMNS: 50,
    QUESTIONS_PER_COLUMN: 26,
    DIGITS_PER_COLUMN: 27,
    SECONDS_PER_COLUMN: 15,
    STORAGE_KEY: 'kraepelin_active_test_v4',
    SESSION_KEY: 'kraepelin_session_v2',
    API_URL: 'https://script.google.com/macros/s/AKfycbwtcJdN60aa3sbe-CGyqGSj72g7AH47dNJySyNk41pS_3Q7e-M03wfQSumNxItNgP_-yw/exec'
  });

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

  function showView(name) {
    Object.values(views).forEach((view) => view.classList.remove('active'));
    views[name].classList.add('active');
    document.body.dataset.view = name;
    if (name !== 'test') stopTimer();
    if (name === 'test') document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function setApiStatus() {
    document.querySelectorAll('[data-api-status]').forEach((el) => {
      el.textContent = 'Backend Google Sheets aktif melalui Google Apps Script.';
      el.dataset.ready = 'true';
    });
  }

  function secureRandomInt(max) {
    if (window.crypto?.getRandomValues) {
      const maxUint = 0x100000000;
      const limit = Math.floor(maxUint / max) * max;
      const buffer = new Uint32Array(1);
      do window.crypto.getRandomValues(buffer); while (buffer[0] >= limit);
      return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  const randomDigit = () => secureRandomInt(10);
  const createRandomColumn = () => Array.from({ length: CONFIG.DIGITS_PER_COLUMN }, randomDigit);

  function persistSession() {
    if (!state.session) {
      localStorage.removeItem(CONFIG.SESSION_KEY);
      return;
    }
    localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(state.session));
  }

  function readSession() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CONFIG.SESSION_KEY) || 'null');
      if (!parsed?.token || !parsed?.user_id || !parsed?.username) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function clearSession() {
    state.session = null;
    localStorage.removeItem(CONFIG.SESSION_KEY);
  }

  async function api(action, payload = {}) {
    if (!CONFIG.API_URL) throw new Error('URL backend belum dikonfigurasi.');

    const body = new URLSearchParams();
    body.set('action', action);
    Object.entries(payload).forEach(([key, value]) => {
      body.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    });

    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      body,
      redirect: 'follow',
      cache: 'no-store'
    });

    if (!response.ok) throw new Error(`Server error (${response.status}).`);
    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      throw new Error('Respons backend bukan JSON. Pastikan deployment Apps Script adalah Web App dan URL berakhir dengan /exec.');
    }
    if (!data.success) throw new Error(data.message || 'Permintaan gagal.');
    return data;
  }

  async function apiGetHistory() {
    return api('getHistory', { token: state.session.token });
  }

  function setBusy(button, text, busy) {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = text;
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
    }
  }

  async function register() {
    const username = $('registerUsername').value.trim();
    const password = $('registerPassword').value;
    const confirm = $('registerConfirm').value;
    const btn = $('registerBtn');
    const error = $('registerError');
    error.textContent = '';

    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      error.textContent = 'Username 3–24 karakter, hanya huruf, angka, dan underscore.';
      return;
    }
    if (password.length < 8) {
      error.textContent = 'Password minimal 8 karakter.';
      return;
    }
    if (password !== confirm) {
      error.textContent = 'Konfirmasi password belum sama.';
      return;
    }

    setBusy(btn, 'Membuat akun…', true);
    try {
      const data = await api('register', { username, password });
      state.session = data.session;
      persistSession();
      $('registerForm').reset();
      await enterDashboard('Akun berhasil dibuat. Selamat datang!');
    } catch (err) {
      error.textContent = err.message;
    } finally {
      setBusy(btn, '', false);
    }
  }

  async function login() {
    const username = $('loginUsername').value.trim();
    const password = $('loginPassword').value;
    const btn = $('loginBtn');
    const error = $('loginError');
    error.textContent = '';

    if (!username || !password) {
      error.textContent = 'Username dan password wajib diisi.';
      return;
    }

    setBusy(btn, 'Memeriksa…', true);
    try {
      const data = await api('login', { username, password });
      state.session = data.session;
      persistSession();
      $('loginForm').reset();
      await enterDashboard('Login berhasil.');
    } catch (err) {
      error.textContent = err.message;
    } finally {
      setBusy(btn, '', false);
    }
  }

  async function enterDashboard(toastMessage = '') {
    if (!state.session) {
      showView('landing');
      return;
    }
    $('welcomeName').textContent = state.session.username;
    updateResumeBanner();
    showView('dashboard');
    try {
      const data = await apiGetHistory();
      state.history = Array.isArray(data.history) ? data.history : [];
      renderDashboard();
      renderHistory();
    } catch (err) {
      renderDashboard();
      showToast(`Histori belum bisa dimuat: ${err.message}`, 'warning', 3400);
    }
    if (toastMessage) showToast(toastMessage, 'success');
  }

  function renderDashboard() {
    const h = state.history;
    $('historyCount').textContent = String(h.length);
    if (!h.length) {
      $('latestDate').textContent = 'Belum ada tes';
      ['dashSpeed', 'dashAccuracy', 'dashConsistency', 'dashEndurance'].forEach((id) => { $(id).textContent = '—'; });
      return;
    }
    const latest = h[0];
    $('latestDate').textContent = formatDate(latest.tanggal);
    $('dashSpeed').textContent = `${Math.round(Number(latest.speed) || 0)}%`;
    $('dashAccuracy').textContent = `${Math.round(Number(latest.accuracy) || 0)}%`;
    $('dashConsistency').textContent = `${Math.round(Number(latest.consistency) || 0)}%`;
    $('dashEndurance').textContent = `${Math.round(Number(latest.endurance) || 0)}%`;
  }

  function renderHistory() {
    const tbody = $('historyTableBody');
    tbody.innerHTML = '';
    $('historyPageCount').textContent = String(state.history.length);
    if (!state.history.length) {
      $('emptyHistory').hidden = false;
      $('historyTable').hidden = true;
      return;
    }
    $('emptyHistory').hidden = true;
    $('historyTable').hidden = false;

    state.history.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${escapeHtml(formatDate(item.tanggal))}</td>
        <td>${Math.round(Number(item.speed) || 0)}%</td>
        <td>${Math.round(Number(item.accuracy) || 0)}%</td>
        <td>${Math.round(Number(item.consistency) || 0)}%</td>
        <td>${Math.round(Number(item.endurance) || 0)}%</td>`;
      tbody.appendChild(tr);
    });
  }

  function showAuth(mode) {
    const registerMode = mode === 'register';
    $('authTitle').textContent = registerMode ? 'Buat akun baru' : 'Selamat datang kembali';
    $('authSubtitle').textContent = registerMode ? 'Cukup username dan password. Tidak perlu email.' : 'Masuk untuk melanjutkan latihan dan melihat histori.';
    $('loginPane').hidden = registerMode;
    $('registerPane').hidden = !registerMode;
    showView('auth');
    setTimeout(() => $(registerMode ? 'registerUsername' : 'loginUsername').focus(), 50);
  }

  function buildTest() {
    state.columns = Array.from({ length: CONFIG.COLUMNS }, createRandomColumn);
    state.answers = Array.from({ length: CONFIG.COLUMNS }, () => Array(CONFIG.QUESTIONS_PER_COLUMN).fill(null));
    state.columnIndex = 0;
    state.questionIndex = 0;
    state.testStartedAt = Date.now();
    state.columnStartedAt = Date.now();
    state.finished = false;
    state.activeTestUserId = state.session.user_id;
    state.currentTestId = `T-${Date.now()}-${secureRandomInt(1000000)}`;
    state.lastResult = null;
    persistTest();
  }

  function persistTest() {
    if (state.finished || !state.columns.length || state.activeTestUserId !== state.session?.user_id) return;
    const snapshot = {
      version: 4,
      userId: state.activeTestUserId,
      testId: state.currentTestId,
      columns: state.columns,
      answers: state.answers,
      columnIndex: state.columnIndex,
      questionIndex: state.questionIndex,
      columnStartedAt: state.columnStartedAt,
      testStartedAt: state.testStartedAt
    };
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(snapshot));
    } catch (_) {
      showToast('Browser tidak mengizinkan penyimpanan progress lokal.', 'warning', 3200);
    }
  }

  function clearPersistedTest() {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
  }

  function readPersistedTest() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      const valid = saved?.version === 4 && saved.userId === state.session?.user_id && saved.testId && Array.isArray(saved.columns) && Array.isArray(saved.answers);
      if (!valid) {
        clearPersistedTest();
        return null;
      }
      return saved;
    } catch (_) {
      clearPersistedTest();
      return null;
    }
  }

  function updateResumeBanner() {
    const saved = readPersistedTest();
    $('resumeTestBanner').hidden = !saved;
  }

  function restoreTest(saved) {
    state.columns = saved.columns;
    state.answers = saved.answers;
    state.columnIndex = Math.max(0, Math.min(CONFIG.COLUMNS - 1, Number(saved.columnIndex) || 0));
    state.questionIndex = Math.max(0, Math.min(CONFIG.QUESTIONS_PER_COLUMN - 1, Number(saved.questionIndex) || 0));
    state.columnStartedAt = Number(saved.columnStartedAt) || Date.now();
    state.testStartedAt = Number(saved.testStartedAt) || Date.now();
    state.activeTestUserId = saved.userId;
    state.currentTestId = saved.testId;
    state.finished = false;

    catchUpElapsedColumns();
    if (!state.finished) {
      persistTest();
      showView('test');
      renderQuestion();
      startTimer();
      showToast('Tes dilanjutkan. Progress tetap aman setelah refresh.', 'success', 2500);
    }
  }

  function catchUpElapsedColumns() {
    let elapsed = Math.max(0, (Date.now() - state.columnStartedAt) / 1000);
    if (elapsed < CONFIG.SECONDS_PER_COLUMN) return;

    const advance = Math.floor(elapsed / CONFIG.SECONDS_PER_COLUMN);
    const remainingMs = (elapsed % CONFIG.SECONDS_PER_COLUMN) * 1000;
    if (state.columnIndex + advance >= CONFIG.COLUMNS) {
      finishTest();
      return;
    }
    state.columnIndex += advance;
    state.questionIndex = 0;
    state.columnStartedAt = Date.now() - remainingMs;
    elapsed = remainingMs / 1000;
    if (elapsed >= CONFIG.SECONDS_PER_COLUMN) {
      state.columnStartedAt = Date.now();
    }
  }

  function getPair(columnIndex = state.columnIndex, questionIndex = state.questionIndex) {
    const digits = state.columns[columnIndex];
    const bottomIndex = CONFIG.DIGITS_PER_COLUMN - 1 - questionIndex;
    return { top: digits[bottomIndex - 1], bottom: digits[bottomIndex] };
  }

  function correctAnswerFor(columnIndex, questionIndex) {
    const { top, bottom } = getPair(columnIndex, questionIndex);
    return (top + bottom) % 10;
  }

  function renderQuestion() {
    if (state.finished) return;
    const { top, bottom } = getPair();
    $('topNumber').textContent = top;
    $('bottomNumber').textContent = bottom;
    $('columnCounter').textContent = `${state.columnIndex + 1}/${CONFIG.COLUMNS}`;
    $('questionCounter').textContent = `${state.questionIndex + 1}/${CONFIG.QUESTIONS_PER_COLUMN}`;
    updateTimerText();
    updateProgress();
  }

  function updateTimerText() {
    const elapsed = Math.max(0, (Date.now() - state.columnStartedAt) / 1000);
    const remaining = Math.ceil(Math.max(0, CONFIG.SECONDS_PER_COLUMN - elapsed));
    $('timeCounter').textContent = `${remaining}s`;
  }

  function updateProgress() {
    const elapsed = Math.min(CONFIG.SECONDS_PER_COLUMN, Math.max(0, (Date.now() - state.columnStartedAt) / 1000));
    const fraction = elapsed / CONFIG.SECONDS_PER_COLUMN;
    const percent = ((state.columnIndex + fraction) / CONFIG.COLUMNS) * 100;
    $('progressBar').style.width = `${Math.min(100, percent)}%`;
  }

  function pulseButton(digit) {
    const btn = document.querySelector(`.digit-btn[data-digit="${digit}"]`);
    if (!btn) return;
    btn.classList.remove('active-pulse');
    void btn.offsetWidth;
    btn.classList.add('active-pulse');
    setTimeout(() => btn.classList.remove('active-pulse'), 110);
  }

  function registerAnswer(value) {
    if (state.finished || !views.test.classList.contains('active')) return;
    if (!state.answers[state.columnIndex] || state.answers[state.columnIndex][state.questionIndex] !== null) return;

    const numericValue = Number(value);
    state.answers[state.columnIndex][state.questionIndex] = numericValue;
    pulseButton(numericValue);
    persistTest();

    if (state.questionIndex < CONFIG.QUESTIONS_PER_COLUMN - 1) {
      state.questionIndex += 1;
      renderQuestion();
    } else {
      nextColumn('completed');
    }
  }

  function nextColumn(reason = 'timer') {
    if (state.columnIndex >= CONFIG.COLUMNS - 1) {
      finishTest();
      return;
    }
    state.columnIndex += 1;
    state.questionIndex = 0;
    state.columnStartedAt = Date.now();
    renderQuestion();
    persistTest();
    if (reason === 'timer') showToast('Waktu habis — lanjut ke kolom berikutnya.', 'info', 850);
  }

  function tick() {
    if (state.finished || !views.test.classList.contains('active')) return;
    const elapsed = Math.max(0, (Date.now() - state.columnStartedAt) / 1000);
    updateTimerText();
    updateProgress();
    if (elapsed >= CONFIG.SECONDS_PER_COLUMN) nextColumn('timer');
  }

  function startTimer() {
    stopTimer();
    state.timerId = setInterval(tick, 50);
    tick();
  }

  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
  }

  function startTest() {
    if (!state.session) {
      showAuth('login');
      return;
    }

    const existing = readPersistedTest();
    if (existing) {
      const replace = window.confirm('Masih ada progress tes sebelumnya. Jika memulai tes baru, progress lama akan dihapus. Tetap mulai tes baru?');
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

  function standardDeviation(values, mean) {
    if (!values.length) return 0;
    return Math.sqrt(values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length);
  }

  function clamp(value, min = 0, max = 100) { return Math.max(min, Math.min(max, value)); }

  function calculateResults() {
    const counts = state.answers.map((col) => col.filter((value) => value !== null).length);
    let answered = 0;
    let correct = 0;

    state.answers.forEach((col, c) => col.forEach((answer, q) => {
      if (answer === null) return;
      answered += 1;
      if (answer === correctAnswerFor(c, q)) correct += 1;
    }));

    const wrong = answered - correct;
    const totalItems = CONFIG.COLUMNS * CONFIG.QUESTIONS_PER_COLUMN;
    const avg = counts.reduce((a, b) => a + b, 0) / CONFIG.COLUMNS;
    const speed = Math.round(clamp((answered / totalItems) * 100));
    const accuracy = answered ? Math.round(clamp((correct / answered) * 100)) : 0;
    const sd = standardDeviation(counts, avg);
    const cv = avg ? sd / avg : 1;
    const consistency = Math.round(clamp(100 - cv * 100));

    const first = counts.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const middle = counts.slice(20, 30).reduce((a, b) => a + b, 0) / 10;
    const last = counts.slice(40, 50).reduce((a, b) => a + b, 0) / 10;
    const baseline = Math.max(1, (first + middle) / 2);
    const decline = Math.max(0, (baseline - last) / baseline);
    const endurance = Math.round(clamp(100 - decline * 100));

    return { counts, answered, correct, wrong, avg, speed, accuracy, consistency, endurance, totalItems };
  }

  async function saveHistory(result) {
    if (!state.session || state.savingHistory) return false;
    state.savingHistory = true;
    try {
      await api('saveHistory', {
        token: state.session.token,
        test_id: state.currentTestId || `T-${Date.now()}-${secureRandomInt(100000)}`,
        tanggal: new Date().toISOString(),
        speed: result.speed,
        accuracy: result.accuracy,
        consistency: result.consistency,
        endurance: result.endurance
      });
      return true;
    } catch (err) {
      showToast(`Hasil tampil, tetapi histori belum tersimpan: ${err.message}`, 'warning', 3800);
      return false;
    } finally {
      state.savingHistory = false;
    }
  }

  async function finishTest() {
    if (state.finished) return;
    state.finished = true;
    stopTimer();

    const result = calculateResults();
    state.lastResult = result;
    clearPersistedTest();
    renderResults(result);
    showView('result');
    requestAnimationFrame(() => drawChart(result.counts));

    await saveHistory(result);
    try {
      const data = await apiGetHistory();
      state.history = Array.isArray(data.history) ? data.history : [];
      renderDashboard();
      renderHistory();
    } catch (_) {}
  }

  function abandonTest() {
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
    state.activeTestUserId = null;
    state.currentTestId = null;
    closeEndTestModal();
    enterDashboard('Tes diakhiri. Progress tadi sudah dihapus dan tidak disimpan.');
  }

  function openEndTestModal() {
    if (!views.test.classList.contains('active')) return;
    $('confirmModal').hidden = false;
    $('cancelEndTestBtn').focus();
  }

  function closeEndTestModal() {
    $('confirmModal').hidden = true;
  }

  function level(score) {
    if (score >= 90) return 'Sangat baik';
    if (score >= 80) return 'Baik';
    if (score >= 65) return 'Cukup';
    if (score >= 50) return 'Perlu latihan';
    return 'Perlu ditingkatkan';
  }

  function renderResults(result) {
    const rows = [
      ['speedScore', result.speed, 'speedLevel'],
      ['accuracyScore', result.accuracy, 'accuracyLevel'],
      ['consistencyScore', result.consistency, 'consistencyLevel'],
      ['enduranceScore', result.endurance, 'enduranceLevel']
    ];
    rows.forEach(([scoreId, score, levelId]) => {
      $(scoreId).textContent = `${score}%`;
      $(levelId).textContent = level(score);
      $(scoreId).closest('.score-card').style.setProperty('--score', `${score}%`);
    });
    $('answeredSummary').textContent = `${result.answered} / ${result.totalItems}`;
    $('correctSummary').textContent = String(result.correct);
    $('wrongSummary').textContent = String(result.wrong);
    $('avgSummary').textContent = result.avg.toFixed(1);
    $('resultUsername').textContent = state.session?.username || '—';
  }

  function drawChart(counts) {
    const canvas = $('performanceChart');
    if (!canvas || !Array.isArray(counts) || counts.length < 2) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(300, Math.floor(rect.width || 900));
    const height = 240;
    const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const p = { l: 34, r: 12, t: 14, b: 29 };
    const pw = width - p.l - p.r;
    const ph = height - p.t - p.b;
    const max = CONFIG.QUESTIONS_PER_COLUMN;

    ctx.strokeStyle = '#e3e9f0';
    ctx.fillStyle = '#7b899b';
    ctx.font = '10px Inter, system-ui, sans-serif';
    for (let i = 0; i <= 5; i += 1) {
      const y = p.t + ph - (ph * i / 5);
      ctx.beginPath();
      ctx.moveTo(p.l, y);
      ctx.lineTo(p.l + pw, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(max * i / 5)), 5, y + 4);
    }

    const points = counts.map((value, index) => ({
      x: p.l + (index / (counts.length - 1)) * pw,
      y: p.t + ph - (value / max) * ph
    }));

    ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.strokeStyle = '#2f7df2';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.fillStyle = '#2f7df2';
    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    [0, 9, 19, 29, 39, 49].forEach((index) => {
      const x = p.l + (index / (counts.length - 1)) * pw;
      ctx.fillStyle = '#7b899b';
      ctx.fillText(String(index + 1), Math.max(0, x - 5), height - 8);
    });
  }

  function downloadPdf() {
    const result = state.lastResult;
    const jsPDF = window.jspdf?.jsPDF;
    if (!result || !jsPDF) {
      showToast('PDF belum siap. Pastikan koneksi internet aktif, lalu coba lagi.', 'warning', 3200);
      return;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const now = new Date();
    const dateText = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(now);
    const username = state.session?.username || 'peserta';

    doc.setTextColor(24, 38, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(21);
    doc.text('Hasil Latihan Tes Kraepelin', 20, 23);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(98, 112, 131);
    doc.text(`Peserta: ${username}`, 20, 30);
    doc.text(dateText, 20, 36);
    doc.text('50 kolom • 26 soal/kolom • 15 detik/kolom', 20, 42);

    const cards = [
      ['Kecepatan', result.speed],
      ['Ketelitian', result.accuracy],
      ['Konsistensi', result.consistency],
      ['Ketahanan', result.endurance]
    ];
    cards.forEach(([label, score], index) => {
      const x = 20 + (index % 2) * 85;
      const y = 51 + Math.floor(index / 2) * 34;
      doc.setFillColor(245, 248, 252);
      doc.roundedRect(x, y, 78, 27, 4, 4, 'F');
      doc.setTextColor(86, 101, 120);
      doc.setFontSize(9);
      doc.text(label, x + 6, y + 9);
      doc.setTextColor(24, 38, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(`${score}%`, x + 6, y + 21);
      doc.setFont('helvetica', 'normal');
    });

    doc.setTextColor(24, 38, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Ringkasan', 20, 128);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Total dijawab   : ${result.answered}/${result.totalItems}`, 20, 136);
    doc.text(`Total benar     : ${result.correct}`, 20, 143);
    doc.text(`Total salah     : ${result.wrong}`, 20, 150);
    doc.text(`Rata-rata/kolom : ${result.avg.toFixed(1)} soal`, 20, 157);

    const chartCanvas = document.createElement('canvas');
    chartCanvas.width = 900;
    chartCanvas.height = 240;
    drawChartOnCanvas(chartCanvas, result.counts);
    doc.addImage(chartCanvas.toDataURL('image/png'), 'PNG', 20, 166, 170, 45);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 112, 128);
    const disclaimer = 'Catatan: skor aplikasi ini adalah skor latihan internal, bukan norma resmi kelulusan psikotes dan bukan diagnosis psikologis.';
    doc.text(doc.splitTextToSize(disclaimer, 170), 20, 224);

    doc.setTextColor(24, 38, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Interpretasi latihan', 20, 242);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Kecepatan: ${level(result.speed)} • Ketelitian: ${level(result.accuracy)}`, 20, 249);
    doc.text(`Konsistensi: ${level(result.consistency)} • Ketahanan: ${level(result.endurance)}`, 20, 256);

    const safeName = username.replace(/[^A-Za-z0-9_-]/g, '_');
    doc.save(`hasil-kraepelin-${safeName}-${now.toISOString().slice(0, 10)}.pdf`);
    showToast('PDF berhasil dibuat.', 'success', 1800);
  }

  function drawChartOnCanvas(canvas, counts) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    const p = { l: 44, r: 18, t: 18, b: 28 };
    const pw = width - p.l - p.r;
    const ph = height - p.t - p.b;
    const max = CONFIG.QUESTIONS_PER_COLUMN;
    ctx.strokeStyle = '#dfe6ee';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 5; i += 1) {
      const y = p.t + ph - (ph * i / 5);
      ctx.beginPath();
      ctx.moveTo(p.l, y);
      ctx.lineTo(p.l + pw, y);
      ctx.stroke();
    }
    ctx.beginPath();
    counts.forEach((value, index) => {
      const x = p.l + (index / (counts.length - 1)) * pw;
      const y = p.t + ph - (value / max) * ph;
      index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = '#2f7df2';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '—');
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[match]));
  }

  function showToast(message, type = 'info', duration = 2200) {
    const root = $('toastRoot');
    root.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    root.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 220);
    }, duration);
  }

  async function logout() {
    const saved = readPersistedTest();
    if (saved) {
      const confirmed = window.confirm('Ada tes yang belum selesai. Keluar akun sekarang akan membuat tes itu tidak bisa dilanjutkan setelah sesi ini dihapus. Lanjut keluar?');
      if (!confirmed) return;
    }

    try {
      if (state.session?.token) await api('logout', { token: state.session.token });
    } catch (_) {}
    clearSession();
    clearPersistedTest();
    stopTimer();
    state.finished = true;
    showView('landing');
    showToast('Kamu sudah logout.', 'info');
  }

  function initialize() {
    setApiStatus();
    state.session = readSession();

    if (state.session) {
      $('welcomeName').textContent = state.session.username;
      enterDashboard();
      updateResumeBanner();
    } else {
      showView('landing');
    }
  }

  function bindEvents() {
    $('landingLoginBtn').addEventListener('click', () => showAuth('login'));
    $('landingRegisterBtn').addEventListener('click', () => showAuth('register'));
    $('openLoginFromRegister').addEventListener('click', () => showAuth('login'));
    $('openRegisterFromLogin').addEventListener('click', () => showAuth('register'));
    $('backToLandingBtn').addEventListener('click', () => showView('landing'));

    $('loginForm').addEventListener('submit', (event) => { event.preventDefault(); login(); });
    $('registerForm').addEventListener('submit', (event) => { event.preventDefault(); register(); });

    $('startPracticeBtn').addEventListener('click', () => showView('instruction'));
    $('viewHistoryBtn').addEventListener('click', () => { renderHistory(); showView('history'); });
    $('backDashboardBtn').addEventListener('click', () => enterDashboard());
    $('backFromInstructionBtn').addEventListener('click', () => enterDashboard());
    $('logoutBtn').addEventListener('click', logout);

    $('resumeTestBtn').addEventListener('click', () => {
      const saved = readPersistedTest();
      if (saved) restoreTest(saved);
      else updateResumeBanner();
    });

    $('startTestBtn').addEventListener('click', startTest);
    $('downloadPdfBtn').addEventListener('click', downloadPdf);
    $('resultHistoryBtn').addEventListener('click', () => { renderHistory(); showView('history'); });
    $('finishBtn').addEventListener('click', () => { state.lastResult = null; enterDashboard(); });

    document.querySelectorAll('.digit-btn').forEach((btn) => {
      btn.addEventListener('click', () => registerAnswer(btn.dataset.digit));
    });

    $('testHomeBtn').addEventListener('click', openEndTestModal);
    $('cancelEndTestBtn').addEventListener('click', closeEndTestModal);
    $('confirmEndTestBtn').addEventListener('click', abandonTest);
    $('confirmModal').addEventListener('click', (event) => {
      if (event.target === $('confirmModal')) closeEndTestModal();
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('confirmModal').hidden) {
        closeEndTestModal();
        return;
      }
      if (!views.test.classList.contains('active')) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        registerAnswer(event.key);
      }
    });

    window.addEventListener('beforeunload', () => {
      if (!state.finished && views.test.classList.contains('active')) persistTest();
    });

    window.addEventListener('resize', () => {
      if (views.result.classList.contains('active') && state.lastResult) drawChart(state.lastResult.counts);
    });

    window.addEventListener('storage', (event) => {
      if (event.key === CONFIG.SESSION_KEY && !event.newValue && views.test.classList.contains('active')) {
        stopTimer();
        clearPersistedTest();
        showView('landing');
        showToast('Sesi akun telah berakhir di tab lain.', 'warning');
      }
    });
  }

  bindEvents();
  initialize();
})();
