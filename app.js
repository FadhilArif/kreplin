(() => {
  'use strict';

  // ============================================================
  // PSYCHOTEST PRACTICE — PHASE 4
  // Multi-test + Google Sheets + PDF fallback
  // ============================================================

  const CONFIG = Object.freeze({
    API_URL:
      'https://script.google.com/macros/s/AKfycbwtcJdN60aa3sbe-CGyqGSj72g7AH47dNJySyNk41pS_3Q7e-M03wfQSumNxItNgP_-yw/exec',
    SESSION_KEY: 'psychotest_session_v2',
    TEST_KEY: 'psychotest_active_v2',
    PDF_TIMEOUT: 10000,
    KRAEPELIN_COLUMNS: 50,
    KRAEPELIN_QUESTIONS: 26,
    KRAEPELIN_SECONDS: 15,
    MCQ_QUESTIONS: 20,
    MCQ_SECONDS: 30,
  });

  const TESTS = {
    kraepelin: {
      name: 'Kraepelin',
      icon: '🧮',
      description: 'Latihan ritme kerja, kecepatan, ketelitian, konsistensi, dan ketahanan.',
      kind: 'kraepelin',
    },
    kuantitatif: {
      name: 'Kuantitatif',
      icon: '➗',
      description: 'Latihan hitungan dasar, persentase, rasio, dan operasi numerik.',
      kind: 'mcq',
    },
    numerical: {
      name: 'Numerical',
      icon: '🔢',
      description: 'Latihan pola angka, deret, perbandingan, dan penalaran numerik.',
      kind: 'mcq',
    },
    sinonim: {
      name: 'Sinonim Verbal',
      icon: '🔤',
      description: 'Latihan memahami persamaan makna kata dalam konteks psikotes.',
      kind: 'mcq',
    },
    silogisme: {
      name: 'Silogisme',
      icon: '🧠',
      description: 'Latihan menarik kesimpulan logis dari beberapa premis.',
      kind: 'mcq',
    },
    analogi: {
      name: 'Analogi',
      icon: '🔗',
      description: 'Latihan hubungan kata dan konsep secara analogis.',
      kind: 'mcq',
    },
    kognitif: {
      name: 'Tes Kognitif',
      icon: '🧩',
      description: 'Latihan gabungan perhatian, logika, memori, dan pemecahan masalah.',
      kind: 'mcq',
    },
  };

  // Dummy bank sementara. Nanti dipindah ke JSON/GitHub pada fase bank soal.
  const SAMPLE = {
    kuantitatif: [
      ['12 + 8 = ?', ['18', '20', '22', '24'], 1],
      ['25% dari 80 = ?', ['15', '20', '25', '30'], 1],
      ['7 × 9 = ?', ['54', '56', '63', '72'], 2],
      ['144 ÷ 12 = ?', ['10', '11', '12', '14'], 2],
      ['3/4 dari 40 = ?', ['20', '25', '30', '35'], 2],
      ['Jika 5 barang = 60.000, maka 8 barang = ?', ['84.000', '90.000', '96.000', '100.000'], 2],
    ],
    numerical: [
      ['Deret: 2, 4, 6, 8, …', ['9', '10', '11', '12'], 1],
      ['Deret: 3, 6, 12, 24, …', ['36', '42', '48', '54'], 2],
      ['Angka mana paling besar?', ['0,75', '0,8', '0,65', '0,7'], 1],
      ['Jika 5 buku = 50.000, 8 buku = ?', ['70.000', '75.000', '80.000', '90.000'], 2],
      ['Deret: 20, 17, 14, 11, …', ['7', '8', '9', '10'], 1],
      ['Deret: 1, 4, 9, 16, …', ['20', '24', '25', '27'], 2],
    ],
    sinonim: [
      ['Sinonim “akurat” adalah …', ['cepat', 'tepat', 'lambat', 'besar'], 1],
      ['Sinonim “konkret” adalah …', ['nyata', 'rumit', 'sementara', 'abstrak'], 0],
      ['Sinonim “efisien” adalah …', ['boros', 'hemat guna', 'lambat', 'acak'], 1],
      ['Sinonim “valid” adalah …', ['sah', 'lemah', 'samar', 'salah'], 0],
      ['Sinonim “esensial” adalah …', ['tambahan', 'pokok', 'sementara', 'remeh'], 1],
      ['Sinonim “abstrak” adalah …', ['nyata', 'konkret', 'tidak berwujud', 'terukur'], 2],
    ],
    silogisme: [
      ['Semua A adalah B. Semua B adalah C. Kesimpulan yang benar?', ['Semua A adalah C', 'Semua C adalah A', 'Sebagian A bukan B', 'Tidak ada hubungan'], 0],
      ['Semua dokter adalah pekerja. Rina adalah dokter. Maka …', ['Rina bukan pekerja', 'Rina pekerja', 'Semua pekerja dokter', 'Tidak dapat disimpulkan'], 1],
      ['Semua X adalah Y. Tidak ada Y yang Z. Maka …', ['X adalah Z', 'Tidak ada X yang Z', 'Semua Z adalah X', 'Sebagian X pasti Z'], 1],
      ['Sebagian P adalah Q. Semua Q adalah R. Maka …', ['Sebagian P adalah R', 'Semua P adalah R', 'Tidak ada P yang R', 'Semua R adalah P'], 0],
      ['Semua M adalah N. Sebagian N adalah O. Maka …', ['Semua M adalah O', 'Sebagian M pasti O', 'Mungkin sebagian M adalah O', 'Tidak ada N yang M'], 2],
      ['Semua siswa rajin lulus. Budi siswa. Kesimpulan?', ['Budi pasti lulus', 'Budi tidak lulus', 'Budi pasti malas', 'Tidak bisa menyimpulkan'], 0],
    ],
    analogi: [
      ['Buku : Membaca = Makanan : …', ['memasak', 'makan', 'membeli', 'menjual'], 1],
      ['Dokter : Rumah sakit = Guru : …', ['pasar', 'sekolah', 'bank', 'terminal'], 1],
      ['Panas : Dingin = Tinggi : …', ['besar', 'jauh', 'rendah', 'panjang'], 2],
      ['Mata : Melihat = Telinga : …', ['berbicara', 'mendengar', 'berjalan', 'menulis'], 1],
      ['Kunci : Pintu = Password : …', ['akun', 'meja', 'buku', 'kursi'], 0],
      ['Pensil : Menulis = Gunting : …', ['mengukur', 'memotong', 'melipat', 'menempel'], 1],
    ],
    kognitif: [
      ['Jika semua lampu mati, ruangan menjadi …', ['terang', 'gelap', 'ramai', 'dingin'], 1],
      ['Manakah yang berbeda?', ['Apel', 'Mangga', 'Wortel', 'Jeruk'], 2],
      ['Jika hari ini Senin, 3 hari lagi adalah …', ['Selasa', 'Rabu', 'Kamis', 'Jumat'], 2],
      ['Pola: ▲ ● ▲ ● … berikutnya?', ['▲', '●', '■', '◆'], 0],
      ['Jika A lebih besar dari B dan B lebih besar dari C, maka …', ['A<C', 'A=C', 'A>C', 'B<A tidak pasti'], 2],
      ['Manakah yang termasuk pola berulang?', ['A-B-A-B', 'A-A-B-C', 'A-B-C-D', 'A-C-B-D'], 0],
    ],
  };

  const $ = (id) => document.getElementById(id);

  const views = {
    landing: $('landingView'),
    auth: $('authView'),
    dashboard: $('dashboardView'),
    instruction: $('instructionView'),
    test: $('testView'),
    result: $('resultView'),
    history: $('historyView'),
  };

  const state = {
    session: null,
    isGuest: false,
    history: [],
    test: null,
    package: 1,
    currentTestId: null,
    questions: [],
    answers: [],
    index: 0,
    columns: [],
    colIndex: 0,
    qIndex: 0,
    timerId: null,
    testStartedAt: 0,
    lastResult: null,
    finished: true,
    savingHistory: false,
  };

  let apiFrame = null;
  const apiWaiters = new Map();

  // ============================================================
  // VIEW / TOAST
  // ============================================================

  function showView(name) {
    Object.values(views).forEach((view) => view?.classList.remove('active'));
    views[name]?.classList.add('active');
    document.body.dataset.view = name;
    document.body.dataset.mode = state.isGuest ? 'guest' : 'account';
    if (name !== 'test') stopTimer();
    window.scrollTo(0, 0);
  }

  function toast(message, type = 'info', duration = 2800) {
    const root = $('toastRoot');
    if (!root) return;

    root.innerHTML = '';
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    root.appendChild(el);

    setTimeout(() => el.remove(), duration);
  }

  function busy(button, label, isBusy) {
    if (!button) return;

    if (isBusy) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = label;
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
    }
  }

  // ============================================================
  // SESSION
  // ============================================================

  function saveSession() {
    if (!state.session) {
      localStorage.removeItem(CONFIG.SESSION_KEY);
      return;
    }

    localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(state.session));
  }

  function loadSession() {
    try {
      const session = JSON.parse(localStorage.getItem(CONFIG.SESSION_KEY) || 'null');
      if (!session?.token || !session?.user_id || !session?.username) return null;
      return session;
    } catch {
      return null;
    }
  }

  function clearSession() {
    state.session = null;
    localStorage.removeItem(CONFIG.SESSION_KEY);
  }

  // ============================================================
  // GOOGLE APPS SCRIPT CONNECTOR
  // POST -> hidden iframe
  // Response -> postMessage langsung dari Apps Script
  // ============================================================

  function ensureApiFrame() {
    if (apiFrame?.contentWindow) return apiFrame;

    apiFrame = document.createElement('iframe');
    apiFrame.name = 'psychotestApiFrame';
    apiFrame.title = 'Backend connector';
    apiFrame.setAttribute('aria-hidden', 'true');
    apiFrame.tabIndex = -1;

    Object.assign(apiFrame.style, {
      position: 'fixed',
      width: '1px',
      height: '1px',
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
      left: '-10000px',
      top: '-10000px',
    });

    document.body.appendChild(apiFrame);
    return apiFrame;
  }

  function makeNonce() {
    if (window.crypto?.getRandomValues) {
      const buffer = new Uint32Array(4);
      window.crypto.getRandomValues(buffer);
      return Array.from(buffer)
        .map((value) => value.toString(16).padStart(8, '0'))
        .join('-');
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  window.addEventListener('message', (event) => {
    if (!apiFrame || event.source !== apiFrame.contentWindow) return;

    const message = event.data;
    if (!message || message.type !== 'PSYCHOTEST_API_RESPONSE' || !message.nonce) {
      return;
    }

    const waiter = apiWaiters.get(message.nonce);
    if (!waiter) return;

    apiWaiters.delete(message.nonce);
    clearTimeout(waiter.timeoutId);

    if (message.ok === false) {
      waiter.reject(new Error(message.error || 'Backend tidak dapat memproses permintaan.'));
      return;
    }

    waiter.resolve(message.data);
  });

  function pollOnce(nonce, onReady) {
    const callbackName = `psychotestPoll_${nonce.replace(/[^a-zA-Z0-9]/g, '')}`;
    const script = document.createElement('script');

    const cleanupScript = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (result) => {
      cleanupScript();
      onReady(result);
    };

    script.src = `${CONFIG.API_URL}?action=poll&nonce=${encodeURIComponent(nonce)}&callback=${encodeURIComponent(callbackName)}`;
    script.onerror = cleanupScript;
    document.body.appendChild(script);
  }

  function api(action, payload = {}, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      if (!CONFIG.API_URL) {
        reject(new Error('URL backend belum dikonfigurasi.'));
        return;
      }

      const frame = ensureApiFrame();
      const nonce = makeNonce();
      let settled = false;
      let pollTimer = null;
      let overallTimeoutId = null;

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = CONFIG.API_URL;
      form.target = frame.name;
      form.enctype = 'application/x-www-form-urlencoded';
      form.style.display = 'none';

      const dataInput = document.createElement('input');
      dataInput.type = 'hidden';
      dataInput.name = 'data';
      dataInput.value = JSON.stringify({
        action,
        ...payload,
        nonce,
      });

      const nonceInput = document.createElement('input');
      nonceInput.type = 'hidden';
      nonceInput.name = 'nonce';
      nonceInput.value = nonce;

      form.append(dataInput, nonceInput);
      document.body.appendChild(form);

      function finish(fn, value) {
        if (settled) return;
        settled = true;
        clearInterval(pollTimer);
        clearTimeout(overallTimeoutId);
        apiWaiters.delete(nonce);
        form.remove();
        fn(value);
      }

      // Jalur cepat: dipakai kalau postMessage kebetulan berhasil sampai.
      apiWaiters.set(nonce, {
        resolve: (data) => finish(resolve, data),
        reject: (err) => finish(reject, err),
        timeoutId: null,
      });

      // Jalur utama yang andal: polling via JSONP ke doGet?action=poll.
      // Tidak tunduk pada CORS/postMessage, jadi tidak terpengaruh masalah
      // Cross-Origin-Opener-Policy yang bisa mematikan window.parent.postMessage.
      pollTimer = setInterval(() => {
        if (settled) return;
        pollOnce(nonce, (result) => {
          if (settled || !result?.ready) return;

          if (result.data?.success) {
            finish(resolve, result.data);
          } else {
            finish(reject, new Error(result.data?.message || 'Backend gagal memproses permintaan.'));
          }
        });
      }, 700);

      overallTimeoutId = setTimeout(() => {
        finish(reject, new Error('Backend tidak merespons dalam waktu yang ditentukan. Pastikan deployment Apps Script terbaru sudah dipublikasikan.'));
      }, timeoutMs);

      try {
        form.submit();
      } catch (error) {
        finish(reject, new Error(`Gagal mengirim request: ${error.message || error}`));
        return;
      }

      // Mulai polling pertama sedikit setelah submit, tanpa menunggu interval penuh.
      setTimeout(() => {
        if (!settled) {
          pollOnce(nonce, (result) => {
            if (settled || !result?.ready) return;
            if (result.data?.success) {
              finish(resolve, result.data);
            } else {
              finish(reject, new Error(result.data?.message || 'Backend gagal memproses permintaan.'));
            }
          });
        }
      }, 400);
    });
  }

  async function apiChecked(action, payload = {}) {
    const result = await api(action, payload);

    if (!result?.success) {
      throw new Error(result?.message || 'Permintaan backend gagal.');
    }

    return result;
  }

  // ============================================================
  // PDF — NO EXTERNAL LIBRARY REQUIRED
  // ============================================================

  function pdfEscape(value) {
    return String(value ?? '')
      .replace(/[^\x20-\x7E]/g, '?')
      .replaceAll('(', '[')
      .replaceAll(')', ']');
  }

  function createPdfBytes(content) {
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach((object, index) => {
      offsets[index + 1] = pdf.length;
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';

    for (let i = 1; i <= objects.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return new TextEncoder().encode(pdf);
  }

  function buildPdf(result, participant) {
    const lines = [
      'BT',
      '/F1 20 Tf',
      '50 790 Td',
      '(Hasil Latihan Psikotes) Tj',
      '/F1 10 Tf',
      '0 -28 Td',
      `(Peserta: ${pdfEscape(participant)}) Tj`,
      '0 -16 Td',
      `(Tes: ${pdfEscape(TESTS[result.type].name)} - Paket ${pdfEscape(result.package)}) Tj`,
      '0 -16 Td',
      `(Tanggal: ${pdfEscape(formatDate(result.tanggal))}) Tj`,
      '0 -28 Td',
      '/F1 13 Tf',
      '(Ringkasan Performa) Tj',
      '/F1 10 Tf',
    ];

    const rows = [
      ['Skor utama', `${result.score}%`],
      ['Kecepatan', `${result.speed}%`],
      ['Ketelitian', `${result.accuracy}%`],
      ['Konsistensi', `${result.consistency}%`],
      ['Ketahanan', `${result.endurance}%`],
      ['Dijawab', `${result.answered}/${result.total}`],
      ['Benar', String(result.correct)],
      ['Salah', String(result.wrong)],
    ];

    rows.forEach(([label, value]) => {
      lines.push('0 -18 Td');
      lines.push(`(${pdfEscape(label)}: ${pdfEscape(value)}) Tj`);
    });

    lines.push('0 -30 Td');
    lines.push('/F1 13 Tf');
    lines.push('(Grafik performa) Tj');
    lines.push('/F1 8 Tf');
    lines.push('0 -18 Td');
    lines.push('(Skor internal latihan - bukan norma psikotes resmi.) Tj');
    lines.push('ET');

    const data = result.chart.slice(0, result.type === 'kraepelin' ? 50 : 20);
    const max = Math.max(1, ...data);
    const chartX = 50;
    const chartY = 360;
    const chartHeight = 130;
    const chartWidth = 500;
    const gap = result.type === 'kraepelin' ? 1.5 : 8;
    const barWidth = Math.max(3, (chartWidth - gap * (data.length - 1)) / data.length);

    lines.push('0.16 0.49 0.95 rg');

    data.forEach((value, index) => {
      const height = (value / max) * chartHeight;
      const x = chartX + index * (barWidth + gap);
      lines.push(`${x.toFixed(2)} ${chartY.toFixed(2)} ${barWidth.toFixed(2)} ${height.toFixed(2)} re f`);
    });

    return createPdfBytes(lines.join('\n'));
  }

  // RANDOM
  // ============================================================

  function randomInt(max) {
    if (window.crypto?.getRandomValues) {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    })[char]);
  }

  // ============================================================
  // GUEST / DASHBOARD
  // ============================================================

  function enterGuest() {
    state.session = null;
    state.isGuest = true;
    state.history = [];
    saveSession();
    $('welcomeName').textContent = 'Tamu';
    renderCatalog();
    showView('dashboard');
  }

  function leaveGuest() {
    state.isGuest = false;
    state.session = null;
    state.history = [];
  }

  function renderCatalog() {
    const root = $('testCatalog');
    if (!root) return;

    root.innerHTML = '';

    Object.entries(TESTS).forEach(([id, test]) => {
      const card = document.createElement('article');
      card.className = 'test-card card';
      card.innerHTML = `
        <div class="test-card-top">
          <div class="test-icon">${test.icon}</div>
          <div>
            <h3>${test.name}</h3>
            <p>${test.description}</p>
          </div>
        </div>
        <div class="package-row">
          <select class="package-select" aria-label="Paket ${escapeHtml(test.name)}">
            <option value="1">Paket 1</option>
            <option value="2">Paket 2</option>
            <option value="3">Paket 3</option>
          </select>
          <button class="primary-btn" type="button">Mulai →</button>
        </div>
      `;

      const select = card.querySelector('select');
      card.querySelector('button').addEventListener('click', () => {
        openInstruction(id, Number(select.value));
      });

      root.appendChild(card);
    });
  }

  async function refreshHistory() {
    if (state.isGuest || !state.session?.token) {
      state.history = [];
      return [];
    }

    try {
      const response = await apiChecked('getHistory', {
        token: state.session.token,
      });

      state.history = Array.isArray(response.history) ? response.history : [];
      renderHistory();
      renderDashboardSummary();
      return state.history;
    } catch (error) {
      if (/sesi login/i.test(error.message)) {
        clearSession();
        state.isGuest = false;
        showView('landing');
      }
      throw error;
    }
  }

  function renderDashboardSummary() {
    const count = state.history.length;
    $('historyCount').textContent = String(count);

    if (!count) {
      $('latestDate').textContent = 'Belum ada tes';
      $('dashSpeed').textContent = '—';
      $('dashAccuracy').textContent = '—';
      $('dashConsistency').textContent = '—';
      $('dashEndurance').textContent = '—';
      return;
    }

    const latest = state.history[0];
    $('latestDate').textContent = formatDate(latest.tanggal);
    $('dashSpeed').textContent = `${Number(latest.speed) || 0}%`;
    $('dashAccuracy').textContent = `${Number(latest.accuracy) || 0}%`;
    $('dashConsistency').textContent = `${Number(latest.consistency) || 0}%`;
    $('dashEndurance').textContent = `${Number(latest.endurance) || 0}%`;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '—');
    return date.toLocaleString('id-ID');
  }

  function renderHistory() {
    const body = $('historyTableBody');
    if (!body) return;

    const history = state.isGuest ? [] : state.history;
    $('historyPageCount').textContent = String(history.length);
    body.innerHTML = '';
    $('emptyHistory').hidden = history.length > 0;
    $('historyTable').hidden = history.length === 0;

    history.forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${escapeHtml(formatDate(item.tanggal))}</td>
        <td>${escapeHtml(TESTS[item.test_type]?.name || item.test_type || '—')}</td>
        <td>${escapeHtml(item.package ?? '—')}</td>
        <td>${Number(item.score) || 0}%</td>
        <td>${Number(item.speed) || 0}%</td>
        <td>${Number(item.accuracy) || 0}%</td>
        <td>${Number(item.consistency) || 0}%</td>
        <td>${Number(item.endurance) || 0}%</td>
      `;
      body.appendChild(row);
    });
  }

  async function goDashboard(message = '') {
    if (state.isGuest) {
      renderCatalog();
      showView('dashboard');
      return;
    }

    if (!state.session) {
      showView('landing');
      return;
    }

    $('welcomeName').textContent = state.session.username;
    renderCatalog();
    showView('dashboard');

    try {
      await refreshHistory();
    } catch (error) {
      toast(`Histori belum bisa dimuat: ${error.message}`, 'warning', 4200);
    }

    if (message) toast(message, 'success');
  }

  // ============================================================
  // AUTH
  // ============================================================

  function showAuth(mode) {
    const registerMode = mode === 'register';
    $('loginPane').hidden = registerMode;
    $('registerPane').hidden = !registerMode;
    $('authTitle').textContent = registerMode ? 'Buat akun peserta' : 'Selamat datang kembali';
    $('authSubtitle').textContent = registerMode
      ? 'Akun digunakan untuk menyimpan histori latihan di Google Sheets.'
      : 'Masuk untuk melanjutkan latihan dan melihat histori.';

    $('loginError').textContent = '';
    $('registerError').textContent = '';
    showView('auth');

    setTimeout(() => {
      $(registerMode ? 'registerUsername' : 'loginUsername')?.focus();
    }, 30);
  }

  async function register() {
    const username = $('registerUsername').value.trim();
    const password = $('registerPassword').value;
    const confirm = $('registerConfirm').value;
    const error = $('registerError');
    const button = $('registerForm').querySelector('button[type="submit"]');
    error.textContent = '';

    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      error.textContent = 'Username 3–24 karakter: huruf, angka, underscore.';
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

    busy(button, 'Membuat akun…', true);

    try {
      const response = await apiChecked('register', { username, password });
      state.session = response.session;
      state.isGuest = false;
      saveSession();
      $('registerForm').reset();
      await goDashboard('Akun berhasil dibuat.');
    } catch (errorObject) {
      error.textContent = errorObject.message || 'Gagal membuat akun.';
    } finally {
      busy(button, '', false);
    }
  }

  async function login() {
    const username = $('loginUsername').value.trim();
    const password = $('loginPassword').value;
    const error = $('loginError');
    const button = $('loginForm').querySelector('button[type="submit"]');
    error.textContent = '';

    if (!username || !password) {
      error.textContent = 'Username dan password wajib diisi.';
      return;
    }

    busy(button, 'Memeriksa…', true);

    try {
      const response = await apiChecked('login', { username, password });
      state.session = response.session;
      state.isGuest = false;
      saveSession();
      $('loginForm').reset();
      await goDashboard('Login berhasil.');
    } catch (errorObject) {
      error.textContent = errorObject.message || 'Login gagal.';
    } finally {
      busy(button, '', false);
    }
  }

  async function logout() {
    try {
      if (state.session?.token) {
        await apiChecked('logout', { token: state.session.token });
      }
    } catch (_) {
      // Logout lokal tetap dilakukan meskipun request backend gagal.
    } finally {
      clearSession();
      leaveGuest();
      showView('landing');
      toast('Kamu sudah keluar.', 'info');
    }
  }

  // ============================================================
  // INSTRUCTIONS
  // ============================================================

  function openInstruction(testId, packageNumber) {
    state.test = testId;
    state.package = packageNumber;

    const test = TESTS[testId];
    $('instructionEyebrow').textContent = `${test.name.toUpperCase()} • PAKET ${packageNumber}`;
    $('instructionTitle').textContent = test.name;
    $('instructionPackage').textContent = `Paket ${packageNumber}`;

    if (test.kind === 'kraepelin') {
      $('instructionLead').innerHTML =
        'Jumlahkan dua angka yang berdekatan dari <strong>bawah ke atas</strong>. Masukkan <strong>angka satuannya</strong>.';
      $('instructionBody').innerHTML = `
        <div class="example-layout">
          <div class="example-column">8<br>5<br>7<br>3</div>
          <div>→</div>
          <div class="example-results">
            <div>3 + 7 = 10 <strong>→ 0</strong></div>
            <div>7 + 5 = 12 <strong>→ 2</strong></div>
            <div>5 + 8 = 13 <strong>→ 3</strong></div>
          </div>
        </div>
        <div class="instruction-grid">
          <div class="tip"><b>50 kolom</b><small>Setiap kolom memiliki 26 jawaban.</small></div>
          <div class="tip"><b>15 detik</b><small>Waktu otomatis berpindah ke kolom berikutnya.</small></div>
        </div>
      `;
    } else {
      $('instructionLead').textContent =
        'Pilih jawaban yang paling tepat. Soal berpindah setelah jawaban dipilih atau waktu habis.';
      $('instructionBody').innerHTML = `
        <div class="instruction-grid">
          <div class="tip"><b>20 soal</b><small>Fase 4 menggunakan soal dummy sementara.</small></div>
          <div class="tip"><b>30 detik/soal</b><small>Timer otomatis berpindah bila waktu habis.</small></div>
          <div class="tip"><b>3 paket</b><small>Paket 1–3 tersedia untuk setiap jenis latihan.</small></div>
          <div class="tip"><b>Hasil PDF</b><small>Hasil tetap dapat diunduh meskipun mode tamu.</small></div>
        </div>
      `;
    }

    showView('instruction');
  }

  // ============================================================
  // TEST ENGINE
  // ============================================================

  function startTest() {
    if (!state.test || !TESTS[state.test]) return;

    stopTimer();
    state.finished = false;
    state.lastResult = null;
    state.currentTestId = `T-${Date.now()}-${randomInt(100000)}`;
    state.testStartedAt = Date.now();

    if (TESTS[state.test].kind === 'kraepelin') {
      startKraepelin();
    } else {
      startMCQ();
    }

    persistTest();
  }

  function startKraepelin() {
    state.columns = Array.from(
      { length: CONFIG.KRAEPELIN_COLUMNS },
      () => Array.from({ length: 27 }, () => randomInt(10)),
    );
    state.answers = Array.from(
      { length: CONFIG.KRAEPELIN_COLUMNS },
      () => Array(CONFIG.KRAEPELIN_QUESTIONS).fill(null),
    );
    state.colIndex = 0;
    state.qIndex = 0;
    state.questions = [];

    renderKraepelin();
    showView('test');
    startColumnTimer();
  }

  function renderKraepelin() {
    const column = state.columns[state.colIndex];
    const answerIndex = state.qIndex;
    const bottom = column[26 - answerIndex];
    const top = column[25 - answerIndex];

    $('testTypeLabel').textContent = 'Kraepelin';
    $('questionCounter').textContent = `${answerIndex + 1}/26`;
    $('timeCounter').textContent = `${CONFIG.KRAEPELIN_SECONDS}s`;
    $('progressBar').style.width = `${((state.colIndex * 26 + answerIndex) / 1300) * 100}%`;

    $('testContent').innerHTML = `
      <div class="question-label">JUMLAHKAN</div>
      <div class="big-number">${top}</div>
      <div class="question-mark">?</div>
      <div class="big-number">${bottom}</div>
    `;

    $('keypad').innerHTML = '';
    [7, 8, 9, 4, 5, 6, 1, 2, 3, 0].forEach((digit) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `digit-btn ${digit === 0 ? 'zero-btn' : ''}`;
      button.textContent = digit;
      button.addEventListener('click', () => answerKraepelin(digit));
      $('keypad').appendChild(button);
    });

    $('testHint').textContent = 'Keyboard 0–9 juga bisa digunakan.';
  }

  function startColumnTimer() {
    stopTimer();
    const end = Date.now() + CONFIG.KRAEPELIN_SECONDS * 1000;

    state.timerId = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      $('timeCounter').textContent = `${left}s`;

      if (left <= 0) {
        stopTimer();
        nextColumn();
      }
    }, 100);
  }

  function answerKraepelin(digit) {
    if (state.answers[state.colIndex][state.qIndex] !== null) return;

    state.answers[state.colIndex][state.qIndex] = Number(digit);

    if (state.qIndex < CONFIG.KRAEPELIN_QUESTIONS - 1) {
      state.qIndex += 1;
      renderKraepelin();
    } else {
      nextColumn();
    }

    persistTest();
  }

  function nextColumn() {
    if (state.colIndex >= CONFIG.KRAEPELIN_COLUMNS - 1) {
      finishTest();
      return;
    }

    state.colIndex += 1;
    state.qIndex = 0;
    renderKraepelin();
    startColumnTimer();
    persistTest();
  }

  function startMCQ() {
    const base = SAMPLE[state.test] || [];
    const pool = [];

    for (let i = 0; i < 4; i += 1) {
      base.forEach(([text, options, correct]) => {
        pool.push({ text, options, correct });
      });
    }

    state.questions = shuffle(pool).slice(0, CONFIG.MCQ_QUESTIONS);
    state.answers = Array(CONFIG.MCQ_QUESTIONS).fill(null);
    state.index = 0;

    renderMCQ();
    showView('test');
    startQuestionTimer();
  }

  function renderMCQ() {
    const question = state.questions[state.index];
    if (!question) return;

    $('testTypeLabel').textContent = TESTS[state.test].name;
    $('questionCounter').textContent = `${state.index + 1}/${CONFIG.MCQ_QUESTIONS}`;
    $('timeCounter').textContent = `${CONFIG.MCQ_SECONDS}s`;
    $('progressBar').style.width = `${(state.index / CONFIG.MCQ_QUESTIONS) * 100}%`;

    $('testContent').innerHTML = `
      <div class="question-label">PERTANYAAN ${state.index + 1}</div>
      <h2>${escapeHtml(question.text)}</h2>
    `;

    $('keypad').innerHTML = '';

    question.options.forEach((option, optionIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'answer-btn';
      button.textContent = `${String.fromCharCode(65 + optionIndex)}. ${option}`;
      button.addEventListener('click', () => answerMCQ(optionIndex));
      $('keypad').appendChild(button);
    });

    $('testHint').textContent = `Pilih satu jawaban. Waktu per soal: ${CONFIG.MCQ_SECONDS} detik.`;
  }

  function startQuestionTimer() {
    stopTimer();
    const end = Date.now() + CONFIG.MCQ_SECONDS * 1000;

    state.timerId = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      $('timeCounter').textContent = `${left}s`;

      if (left <= 0) {
        stopTimer();
        answerMCQ(null);
      }
    }, 100);
  }

  function answerMCQ(choice) {
    if (state.answers[state.index] !== null || state.finished) return;

    const question = state.questions[state.index];
    const isLastQuestion = state.index >= state.questions.length - 1;

    state.answers[state.index] = choice;
    stopTimer();

    const buttons = $('keypad').querySelectorAll('button');

    buttons.forEach((button, buttonIndex) => {
      button.disabled = true;

      if (choice !== null && buttonIndex === question.correct) {
        button.classList.add('correct');
      }

      if (choice !== null && buttonIndex === choice && choice !== question.correct) {
        button.classList.add('wrong');
      }
    });

    persistTest();

    if (isLastQuestion) {
      setTimeout(() => finishTest(), choice === null ? 0 : 160);
      return;
    }

    setTimeout(() => {
      state.index += 1;
      renderMCQ();
      startQuestionTimer();
      persistTest();
    }, choice === null ? 0 : 160);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  // ============================================================
  // SCORE
  // ============================================================

  function clamp(value) {
    return Math.max(0, Math.min(100, value));
  }

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function level(score) {
    if (score >= 90) return 'Sangat baik';
    if (score >= 80) return 'Baik';
    if (score >= 65) return 'Cukup';
    if (score >= 50) return 'Perlu latihan';
    return 'Perlu ditingkatkan';
  }

  function calculateKraepelin() {
    let answered = 0;
    let correct = 0;
    const counts = [];

    state.answers.forEach((columnAnswers, columnIndex) => {
      let columnCount = 0;

      columnAnswers.forEach((answer, questionIndex) => {
        if (answer === null) return;

        answered += 1;
        columnCount += 1;

        const expected = (
          state.columns[columnIndex][26 - questionIndex] +
          state.columns[columnIndex][25 - questionIndex]
        ) % 10;

        if (Number(answer) === expected) correct += 1;
      });

      counts.push(columnCount);
    });

    const total = CONFIG.KRAEPELIN_COLUMNS * CONFIG.KRAEPELIN_QUESTIONS;
    const average = mean(counts);
    const standardDeviation = Math.sqrt(
      mean(counts.map((count) => (count - average) ** 2)),
    );

    const consistency = Math.round(
      clamp(100 - (average ? standardDeviation / average : 1) * 100),
    );

    const first = mean(counts.slice(0, 10));
    const middle = mean(counts.slice(20, 30));
    const last = mean(counts.slice(40, 50));
    const baseline = Math.max(1, mean([first, middle]));
    const endurance = Math.round(
      clamp(100 - Math.max(0, (baseline - last) / baseline) * 100),
    );

    return {
      type: 'kraepelin',
      package: state.package,
      answered,
      correct,
      wrong: answered - correct,
      total,
      score: Math.round((correct / total) * 100),
      speed: Math.round((answered / total) * 100),
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      consistency,
      endurance,
      average,
      chart: counts,
    };
  }

  function calculateMCQ() {
    const total = state.questions.length;
    const answered = state.answers.filter((answer) => answer !== null).length;
    const correct = state.answers.reduce(
      (sum, answer, index) => sum + (answer === state.questions[index].correct ? 1 : 0),
      0,
    );
    const wrong = answered - correct;
    const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
    const speed = Math.round((answered / total) * 100);
    const consistency = Math.round(clamp(100 - Math.abs(speed - accuracy)));
    const endurance = Math.round(clamp((answered / total) * 100));

    return {
      type: state.test,
      package: state.package,
      answered,
      correct,
      wrong,
      total,
      score: accuracy,
      speed,
      accuracy,
      consistency,
      endurance,
      average: mean(state.answers.map((answer) => (answer === null ? 0 : 1))),
      chart: state.answers.map((answer, index) =>
        answer === null ? 0 : answer === state.questions[index].correct ? 1 : 0,
      ),
    };
  }

  // ============================================================
  // PERSIST ACTIVE TEST
  // ============================================================

  function persistTest() {
    if (state.finished || state.isGuest || !state.session) return;

    try {
      localStorage.setItem(
        CONFIG.TEST_KEY,
        JSON.stringify({
          version: 2,
          userId: state.session.user_id,
          test: state.test,
          package: state.package,
          currentTestId: state.currentTestId,
          questions: state.questions,
          answers: state.answers,
          index: state.index,
          columns: state.columns,
          colIndex: state.colIndex,
          qIndex: state.qIndex,
          testStartedAt: state.testStartedAt,
        }),
      );
    } catch (error) {
      console.warn('Progress tes tidak tersimpan:', error);
    }
  }

  function clearPersistedTest() {
    localStorage.removeItem(CONFIG.TEST_KEY);
  }

  function loadPersistedTest() {
    if (!state.session) return null;

    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.TEST_KEY) || 'null');
      if (!saved || saved.userId !== state.session.user_id || !saved.test) return null;
      return saved;
    } catch {
      return null;
    }
  }

  function resumePersistedTest() {
    const saved = loadPersistedTest();
    if (!saved) {
      toast('Tidak ada progress tes yang bisa dilanjutkan.', 'warning');
      return;
    }

    state.test = saved.test;
    state.package = Number(saved.package) || 1;
    state.currentTestId = saved.currentTestId || `T-${Date.now()}-${randomInt(100000)}`;
    state.questions = Array.isArray(saved.questions) ? saved.questions : [];
    state.answers = Array.isArray(saved.answers) ? saved.answers : [];
    state.index = Number(saved.index) || 0;
    state.columns = Array.isArray(saved.columns) ? saved.columns : [];
    state.colIndex = Number(saved.colIndex) || 0;
    state.qIndex = Number(saved.qIndex) || 0;
    state.testStartedAt = Number(saved.testStartedAt) || Date.now();
    state.finished = false;

    if (TESTS[state.test]?.kind === 'kraepelin') {
      renderKraepelin();
      showView('test');
      startColumnTimer();
    } else {
      renderMCQ();
      showView('test');
      startQuestionTimer();
    }

    toast('Progress tes dipulihkan.', 'success');
  }

  // ============================================================
  // FINISH + SAVE HISTORY
  // ============================================================

  async function saveHistory(result) {
    if (state.isGuest || !state.session?.token || state.savingHistory) return false;

    state.savingHistory = true;

    try {
      await apiChecked('saveHistory', {
        token: state.session.token,
        test_id: state.currentTestId,
        test_type: result.type,
        package: result.package,
        tanggal: new Date().toISOString(),
        score: result.score,
        correct: result.correct,
        wrong: result.wrong,
        total: result.total,
        speed: result.speed,
        accuracy: result.accuracy,
        consistency: result.consistency,
        endurance: result.endurance,
      });

      return true;
    } catch (error) {
      toast(`Hasil tampil, tetapi belum masuk spreadsheet: ${error.message}`, 'warning', 5000);
      return false;
    } finally {
      state.savingHistory = false;
    }
  }

  async function finishTest() {
    if (state.finished) return;

    state.finished = true;
    stopTimer();

    const result = TESTS[state.test].kind === 'kraepelin'
      ? calculateKraepelin()
      : calculateMCQ();

    result.testId = state.currentTestId || `T-${Date.now()}-${randomInt(100000)}`;
    result.tanggal = new Date().toISOString();
    state.lastResult = result;
    clearPersistedTest();

    renderResult(result);
    drawChart(result);
    showView('result');

    await saveHistory(result);

    if (!state.isGuest) {
      try {
        await refreshHistory();
        toast('Hasil tersimpan ke Google Sheets.', 'success');
      } catch (error) {
        console.warn('Refresh histori gagal:', error);
      }
    }
  }

  // ============================================================
  // RESULT + CHART
  // ============================================================

  function renderResult(result) {
    const name = state.isGuest ? 'Tamu' : state.session?.username || 'Peserta';
    $('resultTitle').textContent = `${TESTS[result.type].name} selesai 🎉`;


    $('resultIntro').innerHTML = state.isGuest
      ? 'Hasil mode <strong>Tamu</strong> tidak disimpan ke histori. <strong>Download PDF</strong> untuk menyimpan salinannya.'
      : `Hasil <strong>${escapeHtml(name)}</strong> sudah dikirim ke Google Sheets. Download PDF untuk menyimpan salinan detailnya.`;

    const scores = [
      ['speed', 'Kecepatan', result.speed],
      ['accuracy', 'Ketelitian', result.accuracy],
      ['consistency', 'Konsistensi', result.consistency],
      ['endurance', 'Ketahanan', result.endurance],
    ];

    $('resultScores').innerHTML = scores.map(([key, label, score]) => `
      <article class="score-card">
        <span class="score-label">${label}</span>
        <strong>${score}%</strong>
        <small>${level(score)}</small>
        <div class="score-track"><i style="--score:${score}%"></i></div>
      </article>
    `).join('');

    $('resultSummary').innerHTML = [
      ['Skor utama', `${result.score}%`],
      ['Total dijawab', `${result.answered}/${result.total}`],
      ['Benar', result.correct],
      ['Salah', result.wrong],
    ].map(([label, value]) => `
      <div><span>${label}</span><strong>${value}</strong></div>
    `).join('');

    $('chartSubtitle').textContent = result.type === 'kraepelin'
      ? 'Jumlah jawaban yang berhasil dikerjakan pada tiap kolom.'
      : 'Benar (1) dan tidak benar/kosong (0) per soal.';
    $('chartBadge').textContent = result.type === 'kraepelin'
      ? '50 kolom'
      : `${result.total} soal`;
  }

  function drawChart(result) {
    const canvas = $('performanceChart');
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(500, canvas.clientWidth || 700);
    const height = 220;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#dbe5ef';
    ctx.fillStyle = '#6f7f94';
    ctx.font = '10px Inter, sans-serif';

    ctx.beginPath();
    ctx.moveTo(35, 10);
    ctx.lineTo(35, height - 28);
    ctx.lineTo(width - 10, height - 28);
    ctx.stroke();

    const data = result.chart.slice(0, result.type === 'kraepelin' ? 50 : 20);
    const max = Math.max(1, ...data);
    const gap = 4;
    const barWidth = Math.max(3, (width - 55) / data.length - gap);

    data.forEach((value, index) => {
      const barHeight = (value / max) * (height - 55);
      const x = 38 + index * (barWidth + gap);
      const y = height - 28 - barHeight;
      ctx.fillStyle = '#2f7df2';
      ctx.fillRect(x, y, barWidth, barHeight);
    });

    ctx.fillStyle = '#6f7f94';
    ctx.fillText('0', 18, height - 25);
    ctx.fillText(String(max), 12, 18);
  }

  // ============================================================
  // PDF
  // ============================================================

  function downloadPdf() {
    const result = state.lastResult;

    if (!result) {
      toast('Hasil tes belum tersedia.', 'warning');
      return;
    }

    const button = $('downloadPdfBtn');
    busy(button, 'Menyiapkan PDF…', true);

    try {
      const participant = state.isGuest
        ? 'Tamu'
        : state.session?.username || 'Peserta';
      const bytes = buildPdf(result, participant);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download =
        `hasil-${result.type}-paket-${result.package}-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast('PDF berhasil disimpan.', 'success');
    } catch (error) {
      console.error('PDF error:', error);
      toast('PDF gagal dibuat.', 'warning', 4500);
    } finally {
      busy(button, '', false);
    }
  }


  // ============================================================
  // MODAL / NAVIGATION
  // ============================================================

  function openEndTestModal() {
    if (!views.test?.classList.contains('active')) return;
    $('confirmModal').hidden = false;
  }

  function abandonTest() {
    stopTimer();
    state.finished = true;
    state.lastResult = null;
    clearPersistedTest();
    $('confirmModal').hidden = true;
    showView('dashboard');
    toast('Tes dibatalkan. Progress tidak disimpan.', 'info');
  }

  // ============================================================
  // EVENT BINDING
  // ============================================================

  function bind() {
    $('landingLoginBtn').addEventListener('click', () => showAuth('login'));
    $('landingRegisterBtn').addEventListener('click', () => showAuth('register'));
    $('landingGuestBtn').addEventListener('click', () => { $('guestModal').hidden = false; });

    $('cancelGuestBtn').addEventListener('click', () => { $('guestModal').hidden = true; });
    $('confirmGuestBtn').addEventListener('click', () => {
      $('guestModal').hidden = true;
      enterGuest();
      toast('Mode tamu aktif.', 'info');
    });

    $('backToLandingBtn').addEventListener('click', () => showView('landing'));
    $('openRegisterFromLogin').addEventListener('click', () => showAuth('register'));
    $('openLoginFromRegister').addEventListener('click', () => showAuth('login'));

    $('backFromInstructionBtn').addEventListener('click', () => showView('dashboard'));
    $('startTestBtn').addEventListener('click', startTest);

    $('testHomeBtn').addEventListener('click', openEndTestModal);
    $('cancelEndTestBtn').addEventListener('click', () => { $('confirmModal').hidden = true; });
    $('confirmEndTestBtn').addEventListener('click', abandonTest);

    $('downloadPdfBtn').addEventListener('click', downloadPdf);
    $('resultHistoryBtn').addEventListener('click', async () => {
      if (!state.isGuest) {
        try { await refreshHistory(); } catch (error) { toast(error.message, 'warning'); }
      }
      renderHistory();
      showView('history');
    });

    $('finishBtn').addEventListener('click', async () => {
      if (state.isGuest) {
        leaveGuest();
        showView('landing');
        return;
      }
      await goDashboard();
    });

    $('viewHistoryBtn').addEventListener('click', async () => {
      if (!state.isGuest) {
        try { await refreshHistory(); } catch (error) { toast(error.message, 'warning'); }
      }
      renderHistory();
      showView('history');
    });

    $('backDashboardBtn').addEventListener('click', () => goDashboard());
    $('logoutBtn').addEventListener('click', logout);

    $('loginForm').addEventListener('submit', (event) => {
      event.preventDefault();
      login();
    });

    $('registerForm').addEventListener('submit', (event) => {
      event.preventDefault();
      register();
    });

    $('resumeTestBtn')?.addEventListener('click', resumePersistedTest);
    $('startPracticeBtn')?.addEventListener('click', () => openInstruction('kraepelin', 1));

    window.addEventListener('keydown', (event) => {
      if (document.body.dataset.view !== 'test') return;
      if (TESTS[state.test]?.kind !== 'kraepelin') return;
      if (/^[0-9]$/.test(event.key)) {
        answerKraepelin(Number(event.key));
      }
    });
  }

  // ============================================================
  // INIT
  // ============================================================

  async function init() {
    bind();

    state.session = loadSession();
    state.isGuest = false;

    renderCatalog();

    if (state.session) {
      $('welcomeName').textContent = state.session.username;
      showView('dashboard');

      try {
        await refreshHistory();
      } catch (error) {
        toast(`Belum dapat mengambil histori: ${error.message}`, 'warning', 4500);
      }

      if (loadPersistedTest()) {
        // Dashboard Fase 4 tetap ringan; user memilih lanjutkan dari data lokal.
        toast('Ada progress tes yang tersimpan. Kamu bisa melanjutkannya dari sesi ini.', 'info', 4200);
      }
    } else {
      showView('landing');
    }
  }

  init();
})();
