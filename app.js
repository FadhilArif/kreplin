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
      description:
        'Latihan ritme kerja, kecepatan, ketelitian, konsistensi, dan ketahanan.',
      kind: 'kraepelin',
    },

    kuantitatif: {
      name: 'Kuantitatif',
      icon: '➗',
      description:
        'Latihan hitungan dasar, persentase, rasio, dan operasi numerik.',
      kind: 'mcq',
    },

    numerical: {
      name: 'Numerical',
      icon: '🔢',
      description:
        'Latihan pola angka, deret, perbandingan, dan penalaran numerik.',
      kind: 'mcq',
    },

    sinonim: {
      name: 'Sinonim Verbal',
      icon: '🔤',
      description:
        'Latihan memahami persamaan makna kata dalam konteks psikotes.',
      kind: 'mcq',
    },

    silogisme: {
      name: 'Silogisme',
      icon: '🧠',
      description:
        'Latihan menarik kesimpulan logis dari beberapa premis.',
      kind: 'mcq',
    },

    analogi: {
      name: 'Analogi',
      icon: '🔗',
      description:
        'Latihan hubungan kata dan konsep secara analogis.',
      kind: 'mcq',
    },

    kognitif: {
      name: 'Tes Kognitif',
      icon: '🧩',
      description:
        'Latihan gabungan perhatian, logika, memori, dan pemecahan masalah.',
      kind: 'mcq',
    },
  };

  // Dummy bank sementara.
  // Tetap dipertahankan sebagai cadangan internal.
  const SAMPLE = {
    kuantitatif: [
      ['12 + 8 = ?', ['18', '20', '22', '24'], 1],
      ['25% dari 80 = ?', ['15', '20', '25', '30'], 1],
      ['7 × 9 = ?', ['54', '56', '63', '72'], 2],
      ['144 ÷ 12 = ?', ['10', '11', '12', '14'], 2],
      ['3/4 dari 40 = ?', ['20', '25', '30', '35'], 2],
      [
        'Jika 5 barang = 60.000, maka 8 barang = ?',
        ['84.000', '90.000', '96.000', '100.000'],
        2,
      ],
    ],

    numerical: [
      ['Deret: 2, 4, 6, 8, …', ['9', '10', '11', '12'], 1],
      ['Deret: 3, 6, 12, 24, …', ['36', '42', '48', '54'], 2],
      [
        'Angka mana paling besar?',
        ['0,75', '0,8', '0,65', '0,7'],
        1,
      ],
      [
        'Jika 5 buku = 50.000, 8 buku = ?',
        ['70.000', '75.000', '80.000', '90.000'],
        2,
      ],
      ['Deret: 20, 17, 14, 11, …', ['7', '8', '9', '10'], 1],
      ['Deret: 1, 4, 9, 16, …', ['20', '24', '25', '27'], 2],
    ],

    sinonim: [
      [
        'Sinonim “akurat” adalah …',
        ['cepat', 'tepat', 'lambat', 'besar'],
        1,
      ],
      [
        'Sinonim “konkret” adalah …',
        ['nyata', 'rumit', 'sementara', 'abstrak'],
        0,
      ],
      [
        'Sinonim “efisien” adalah …',
        ['boros', 'hemat guna', 'lambat', 'acak'],
        1,
      ],
      [
        'Sinonim “valid” adalah …',
        ['sah', 'lemah', 'samar', 'salah'],
        0,
      ],
      [
        'Sinonim “esensial” adalah …',
        ['tambahan', 'pokok', 'sementara', 'remeh'],
        1,
      ],
      [
        'Sinonim “abstrak” adalah …',
        ['nyata', 'konkret', 'tidak berwujud', 'terukur'],
        2,
      ],
    ],

    silogisme: [
      [
        'Semua A adalah B. Semua B adalah C. Kesimpulan yang benar?',
        [
          'Semua A adalah C',
          'Semua C adalah A',
          'Sebagian A bukan B',
          'Tidak ada hubungan',
        ],
        0,
      ],
      [
        'Semua dokter adalah pekerja. Rina adalah dokter. Maka …',
        [
          'Rina bukan pekerja',
          'Rina pekerja',
          'Semua pekerja dokter',
          'Tidak dapat disimpulkan',
        ],
        1,
      ],
      [
        'Semua X adalah Y. Tidak ada Y yang Z. Maka …',
        [
          'X adalah Z',
          'Tidak ada X yang Z',
          'Semua Z adalah X',
          'Sebagian X pasti Z',
        ],
        1,
      ],
      [
        'Sebagian P adalah Q. Semua Q adalah R. Maka …',
        [
          'Sebagian P adalah R',
          'Semua P adalah R',
          'Tidak ada P yang R',
          'Semua R adalah P',
        ],
        0,
      ],
      [
        'Semua M adalah N. Sebagian N adalah O. Maka …',
        [
          'Semua M adalah O',
          'Sebagian M pasti O',
          'Mungkin sebagian M adalah O',
          'Tidak ada N yang M',
        ],
        2,
      ],
      [
        'Semua siswa rajin lulus. Budi siswa. Kesimpulan?',
        [
          'Budi pasti lulus',
          'Budi tidak lulus',
          'Budi pasti malas',
          'Tidak bisa menyimpulkan',
        ],
        0,
      ],
    ],

    analogi: [
      [
        'Buku : Membaca = Makanan : …',
        ['memasak', 'makan', 'membeli', 'menjual'],
        1,
      ],
      [
        'Dokter : Rumah sakit = Guru : …',
        ['pasar', 'sekolah', 'bank', 'terminal'],
        1,
      ],
      [
        'Panas : Dingin = Tinggi : …',
        ['besar', 'jauh', 'rendah', 'panjang'],
        2,
      ],
      [
        'Mata : Melihat = Telinga : …',
        ['berbicara', 'mendengar', 'berjalan', 'menulis'],
        1,
      ],
      [
        'Kunci : Pintu = Password : …',
        ['akun', 'meja', 'buku', 'kursi'],
        0,
      ],
      [
        'Pensil : Menulis = Gunting : …',
        ['mengukur', 'memotong', 'melipat', 'menempel'],
        1,
      ],
    ],

    kognitif: [
      [
        'Jika semua lampu mati, ruangan menjadi …',
        ['terang', 'gelap', 'ramai', 'dingin'],
        1,
      ],
      [
        'Manakah yang berbeda?',
        ['Apel', 'Mangga', 'Wortel', 'Jeruk'],
        2,
      ],
      [
        'Jika hari ini Senin, 3 hari lagi adalah …',
        ['Selasa', 'Rabu', 'Kamis', 'Jumat'],
        2,
      ],
      [
        'Pola: ▲ ● ▲ ● … berikutnya?',
        ['▲', '●', '■', '◆'],
        0,
      ],
      [
        'Jika A lebih besar dari B dan B lebih besar dari C, maka …',
        ['A<C', 'A=C', 'A>C', 'B<A tidak pasti'],
        2,
      ],
      [
        'Manakah yang termasuk pola berulang?',
        ['A-B-A-B', 'A-A-B-C', 'A-B-C-D', 'A-C-B-D'],
        0,
      ],
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
    Object.values(views).forEach((view) => {
      view?.classList.remove('active');
    });

    views[name]?.classList.add('active');

    document.body.dataset.view = name;
    document.body.dataset.mode = state.isGuest
      ? 'guest'
      : 'account';

    if (name !== 'test') {
      stopTimer();
    }

    window.scrollTo(0, 0);
  }

  function toast(
    message,
    type = 'info',
    duration = 2800
  ) {
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
      button.textContent =
        button.dataset.originalText ||
        button.textContent;
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

    localStorage.setItem(
      CONFIG.SESSION_KEY,
      JSON.stringify(state.session)
    );
  }

  function loadSession() {
    try {
      const session = JSON.parse(
        localStorage.getItem(CONFIG.SESSION_KEY) ||
          'null'
      );

      if (
        !session?.token ||
        !session?.user_id ||
        !session?.username
      ) {
        return null;
      }

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
  // Response -> postMessage langsung
  // ============================================================

  function ensureApiFrame() {
    if (apiFrame?.contentWindow) {
      return apiFrame;
    }

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
        .map((value) =>
          value.toString(16).padStart(8, '0')
        )
        .join('-');
    }

    return `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2)}`;
  }

  window.addEventListener('message', (event) => {
    if (
      !apiFrame ||
      event.source !== apiFrame.contentWindow
    ) {
      return;
    }

    const message = event.data;

    if (
      !message ||
      message.type !==
        'PSYCHOTEST_API_RESPONSE' ||
      !message.nonce
    ) {
      return;
    }

    const waiter = apiWaiters.get(message.nonce);

    if (!waiter) return;

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

  function pollOnce(nonce, onReady) {
    const callbackName =
      `psychotestPoll_${nonce.replace(
        /[^a-zA-Z0-9]/g,
        ''
      )}`;

    const script =
      document.createElement('script');

    const cleanupScript = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (result) => {
      cleanupScript();
      onReady(result);
    };

    script.src =
      `${CONFIG.API_URL}?action=poll&nonce=` +
      `${encodeURIComponent(nonce)}&callback=` +
      `${encodeURIComponent(callbackName)}`;

    script.onerror = cleanupScript;

    document.body.appendChild(script);
  }

  function api(
    action,
    payload = {},
    timeoutMs = 20000
  ) {
    return new Promise((resolve, reject) => {
      if (!CONFIG.API_URL) {
        reject(
          new Error(
            'URL backend belum dikonfigurasi.'
          )
        );

        return;
      }

      const frame = ensureApiFrame();
      const nonce = makeNonce();

      let settled = false;
      let pollTimer = null;
      let overallTimeoutId = null;

      const form =
        document.createElement('form');

      form.method = 'POST';
      form.action = CONFIG.API_URL;
      form.target = frame.name;
      form.enctype =
        'application/x-www-form-urlencoded';
      form.style.display = 'none';

      const dataInput =
        document.createElement('input');

      dataInput.type = 'hidden';
      dataInput.name = 'data';
      dataInput.value = JSON.stringify({
        action,
        ...payload,
        nonce,
      });

      const nonceInput =
        document.createElement('input');

      nonceInput.type = 'hidden';
      nonceInput.name = 'nonce';
      nonceInput.value = nonce;

      form.append(
        dataInput,
        nonceInput
      );

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

      apiWaiters.set(nonce, {
        resolve: (data) =>
          finish(resolve, data),
        reject: (err) =>
          finish(reject, err),
        timeoutId: null,
      });

      pollTimer = setInterval(() => {
        if (settled) return;

        pollOnce(nonce, (result) => {
          if (
            settled ||
            !result?.ready
          ) {
            return;
          }

          if (result.data?.success) {
            finish(
              resolve,
              result.data
            );
          } else {
            finish(
              reject,
              new Error(
                result.data?.message ||
                  'Backend gagal memproses permintaan.'
              )
            );
          }
        });
      }, 700);

      overallTimeoutId = setTimeout(() => {
        finish(
          reject,
          new Error(
            'Backend tidak merespons dalam waktu yang ditentukan. Pastikan deployment Apps Script terbaru sudah dipublikasikan.'
          )
        );
      }, timeoutMs);

      try {
        form.submit();
      } catch (error) {
        finish(
          reject,
          new Error(
            `Gagal mengirim request: ${
              error.message || error
            }`
          )
        );

        return;
      }

      setTimeout(() => {
        if (settled) return;

        pollOnce(nonce, (result) => {
          if (
            settled ||
            !result?.ready
          ) {
            return;
          }

          if (result.data?.success) {
            finish(
              resolve,
              result.data
            );
          } else {
            finish(
              reject,
              new Error(
                result.data?.message ||
                  'Backend gagal memproses permintaan.'
              )
            );
          }
        });
      }, 400);
    });
  }

  async function apiChecked(
    action,
    payload = {}
  ) {
    const result = await api(
      action,
      payload
    );

    if (!result?.success) {
      throw new Error(
        result?.message ||
          'Permintaan backend gagal.'
      );
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

      pdf +=
        `${index + 1} 0 obj\n` +
        `${object}\n` +
        `endobj\n`;
    });

    const xrefOffset = pdf.length;

    pdf +=
      `xref\n0 ${objects.length + 1}\n`;

    pdf +=
      '0000000000 65535 f \n';

    for (
      let i = 1;
      i <= objects.length;
      i += 1
    ) {
      pdf +=
        `${String(offsets[i]).padStart(
          10,
          '0'
        )} 00000 n \n`;
    }

    pdf +=
      `trailer\n<< /Size ${
        objects.length + 1
      } /Root 1 0 R >>\n`;

    pdf +=
      `startxref\n${xrefOffset}\n%%EOF`;

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
      `(Peserta: ${pdfEscape(
        participant
      )}) Tj`,
      '0 -16 Td',
      `(Tes: ${pdfEscape(
        TESTS[result.type].name
      )} - Paket ${pdfEscape(
        result.package
      )}) Tj`,
      '0 -16 Td',
      `(Tanggal: ${pdfEscape(
        formatDate(result.tanggal)
      )}) Tj`,
      '0 -28 Td',
      '/F1 13 Tf',
      '(Ringkasan Performa) Tj',
      '/F1 10 Tf',
    ];

    const rows = [
      [
        'Skor utama',
        `${result.score}%`,
      ],
      [
        'Kecepatan',
        `${result.speed}%`,
      ],
      [
        'Ketelitian',
        `${result.accuracy}%`,
      ],
      [
        'Konsistensi',
        `${result.consistency}%`,
      ],
      [
        'Ketahanan',
        `${result.endurance}%`,
      ],
      [
        'Dijawab',
        `${result.answered}/${result.total}`,
      ],
      [
        'Benar',
        String(result.correct),
      ],
      [
        'Salah',
        String(result.wrong),
      ],
    ];

    rows.forEach(([label, value]) => {
      lines.push('0 -18 Td');

      lines.push(
        `(${pdfEscape(
          label
        )}: ${pdfEscape(value)}) Tj`
      );
    });

    lines.push('0 -30 Td');
    lines.push('/F1 13 Tf');
    lines.push('(Grafik performa) Tj');
    lines.push('/F1 8 Tf');
    lines.push('0 -18 Td');
    lines.push(
      '(Skor internal latihan - bukan norma psikotes resmi.) Tj'
    );
    lines.push('ET');

    const data = result.chart.slice(
      0,
      result.type === 'kraepelin'
        ? 50
        : 20
    );

    const max = Math.max(
      1,
      ...data
    );

    const chartX = 50;
    const chartY = 360;
    const chartHeight = 130;
    const chartWidth = 500;

    const gap =
      result.type === 'kraepelin'
        ? 1.5
        : 8;

    const barWidth = Math.max(
      3,
      (
        chartWidth -
        gap * (data.length - 1)
      ) / data.length
    );

    lines.push(
      '0.16 0.49 0.95 rg'
    );

    data.forEach(
      (value, index) => {
        const height =
          (value / max) *
          chartHeight;

        const x =
          chartX +
          index *
            (barWidth + gap);

        lines.push(
          `${x.toFixed(
            2
          )} ${chartY.toFixed(
            2
          )} ${barWidth.toFixed(
            2
          )} ${height.toFixed(
            2
          )} re f`
        );
      }
    );

    return createPdfBytes(
      lines.join('\n')
    );
  }

  // ============================================================
  // RANDOM
  // ============================================================

  function randomInt(max) {
    if (
      window.crypto?.getRandomValues
    ) {
      const buffer =
        new Uint32Array(1);

      window.crypto.getRandomValues(
        buffer
      );

      return buffer[0] % max;
    }

    return Math.floor(
      Math.random() * max
    );
  }

  function shuffle(array) {
    const result = [...array];

    for (
      let i = result.length - 1;
      i > 0;
      i -= 1
    ) {
      const j = randomInt(
        i + 1
      );

      [result[i], result[j]] = [
        result[j],
        result[i],
      ];
    }

    return result;
  }

  function escapeHtml(value) {
    return String(value).replace(
      /[&<>'"]/g,
      (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[char]
    );
  }

  // ============================================================
  // GUEST / DASHBOARD
  // ============================================================

  function enterGuest() {
    state.session = null;
    state.isGuest = true;
    state.history = [];

    saveSession();

    $('welcomeName').textContent =
      'Tamu';

    renderCatalog();
    showView('dashboard');
  }

  function leaveGuest() {
    state.isGuest = false;
    state.session = null;
    state.history = [];
  }

  function renderCatalog() {
    const root =
      $('testCatalog');

    if (!root) return;

    root.innerHTML = '';

    Object.entries(TESTS).forEach(
      ([id, test]) => {
        const card =
          document.createElement(
            'article'
          );

        card.className =
          'test-card card';

        card.innerHTML = `
          <div class="test-card-top">
            <div class="test-icon">${test.icon}</div>

            <div>
              <h3>${test.name}</h3>
              <p>${test.description}</p>
            </div>
          </div>

          <div class="package-row">
            <select
              class="package-select"
              aria-label="Paket ${escapeHtml(
                test.name
              )}"
            >
              <option value="1">Paket 1</option>
              <option value="2">Paket 2</option>
              <option value="3">Paket 3</option>
            </select>

            <button
              class="primary-btn"
              type="button"
            >
              Mulai →
            </button>
          </div>
        `;

        const select =
          card.querySelector(
            'select'
          );

        card
          .querySelector('button')
          .addEventListener(
            'click',
            () => {
              openInstruction(
                id,
                Number(
                  select.value
                )
              );
            }
          );

        root.appendChild(card);
      }
    );
  }
