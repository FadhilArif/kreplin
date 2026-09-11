(() => {
  'use strict';

  // ============================================================
  // PSYCHOTEST PRACTICE - PHASE 4
  // Google Sheets + dummy question bank + PDF fallback
  // ============================================================

  const CONFIG = Object.freeze({
    API_URL:
      'https://script.google.com/macros/s/AKfycbwtcJdN60aa3sbe-CGyqGSj72g7AH47dNJySyNk41pS_3Q7e-M03wfQSumNxItNgP_-yw/exec',

    SESSION_KEY: 'psychotest_session_v2',

    KRAEPELIN_COLUMNS: 50,
    KRAEPELIN_QUESTIONS: 26,
    KRAEPELIN_DIGITS: 27,
    KRAEPELIN_SECONDS: 15,

    MCQ_QUESTIONS: 20,
    MCQ_SECONDS: 30
  });

  const TESTS = {
    kraepelin: {
      name: 'Kraepelin',
      icon: '🧮',
      description:
        'Latihan ritme kerja, kecepatan, ketelitian, konsistensi, dan ketahanan.',
      kind: 'kraepelin'
    },
    kuantitatif: {
      name: 'Kuantitatif',
      icon: '➗',
      description:
        'Latihan hitungan dasar, persentase, rasio, dan operasi numerik.',
      kind: 'mcq'
    },
    numerical: {
      name: 'Numerical',
      icon: '🔢',
      description:
        'Latihan pola angka, deret, perbandingan, dan penalaran numerik.',
      kind: 'mcq'
    },
    sinonim: {
      name: 'Sinonim Verbal',
      icon: '🔤',
      description:
        'Latihan memahami persamaan makna kata dalam konteks psikotes.',
      kind: 'mcq'
    },
    silogisme: {
      name: 'Silogisme',
      icon: '🧠',
      description:
        'Latihan menarik kesimpulan logis dari beberapa premis.',
      kind: 'mcq'
    },
    analogi: {
      name: 'Analogi',
      icon: '🔗',
      description:
        'Latihan hubungan kata dan konsep secara analogis.',
      kind: 'mcq'
    },
    kognitif: {
      name: 'Tes Kognitif',
      icon: '🧩',
      description:
        'Latihan gabungan perhatian, logika, memori, dan pemecahan masalah.',
      kind: 'mcq'
    }
  };

  // ------------------------------------------------------------
  // DUMMY QUESTIONS
  // Paket 1-3 memakai bank dummy yang sama sementara.
  // ------------------------------------------------------------

  const SAMPLE = {
    kuantitatif: [
      ['12 + 8 = ?', ['18', '20', '22', '24'], 1],
      ['25% dari 80 = ?', ['15', '20', '25', '30'], 1],
      ['7 × 9 = ?', ['54', '56', '63', '72'], 2],
      ['144 ÷ 12 = ?', ['10', '11', '12', '14'], 2],
      ['3/4 dari 40 = ?', ['20', '25', '30', '35'], 2]
    ],

    numerical: [
      ['Deret: 2, 4, 6, 8, …', ['9', '10', '11', '12'], 1],
      ['Deret: 3, 6, 12, 24, …', ['36', '42', '48', '54'], 2],
      ['Angka mana paling besar?', ['0,75', '0,8', '0,65', '0,7'], 1],
      ['Jika 5 buku = 50.000, 8 buku = ?', ['70.000', '75.000', '80.000', '90.000'], 2],
      ['Deret: 20, 17, 14, 11, …', ['7', '8', '9', '10'], 1]
    ],

    sinonim: [
      ['Sinonim “akurat” adalah …', ['cepat', 'tepat', 'lambat', 'besar'], 1],
      ['Sinonim “konkret” adalah …', ['nyata', 'rumit', 'sementara', 'abstrak'], 0],
      ['Sinonim “efisien” adalah …', ['boros', 'hemat guna', 'lambat', 'acak'], 1],
      ['Sinonim “valid” adalah …', ['sah', 'lemah', 'samar', 'salah'], 0],
      ['Sinonim “esensial” adalah …', ['tambahan', 'pokok', 'sementara', 'remeh'], 1]
    ],

    silogisme: [
      ['Semua A adalah B. Semua B adalah C. Kesimpulan yang benar?',
        ['Semua A adalah C', 'Semua C adalah A', 'Sebagian A bukan B', 'Tidak ada hubungan'], 0],
      ['Semua dokter adalah pekerja. Rina adalah dokter. Maka …',
        ['Rina bukan pekerja', 'Rina pekerja', 'Semua pekerja dokter', 'Tidak dapat disimpulkan'], 1],
      ['Semua X adalah Y. Tidak ada Y yang Z. Maka …',
        ['X adalah Z', 'Tidak ada X yang Z', 'Semua Z adalah X', 'Sebagian X pasti Z'], 1],
      ['Sebagian P adalah Q. Semua Q adalah R. Maka …',
        ['Sebagian P adalah R', 'Semua P adalah R', 'Tidak ada P yang R', 'Semua R adalah P'], 0],
      ['Semua M adalah N. Sebagian N adalah O. Maka …',
        ['Semua M adalah O', 'Sebagian M pasti O', 'Mungkin sebagian M adalah O', 'Tidak ada N yang M'], 2]
    ],

    analogi: [
      ['Buku : Membaca = Makanan : …', ['memasak', 'makan', 'membeli', 'menjual'], 1],
      ['Dokter : Rumah sakit = Guru : …', ['pasar', 'sekolah', 'bank', 'terminal'], 1],
      ['Panas : Dingin = Tinggi : …', ['besar', 'jauh', 'rendah', 'panjang'], 2],
      ['Mata : Melihat = Telinga : …', ['berbicara', 'mendengar', 'berjalan', 'menulis'], 1],
      ['Kunci : Pintu = Password : …', ['akun', 'meja', 'buku', 'kursi'], 0]
    ],

    kognitif: [
      ['Jika semua lampu mati, ruangan menjadi …', ['terang', 'gelap', 'ramai', 'dingin'], 1],
      ['Manakah yang berbeda?', ['Apel', 'Mangga', 'Wortel', 'Jeruk'], 2],
      ['Jika hari ini Senin, 3 hari lagi adalah …', ['Selasa', 'Rabu', 'Kamis', 'Jumat'], 2],
      ['Pola: ▲ ● ▲ ● … berikutnya?', ['▲', '●', '■', '◆'], 0],
      ['Jika A lebih besar dari B dan B lebih besar dari C, maka …', ['A<C', 'A=C', 'A>C', 'B<A tidak pasti'], 2]
    ]
  };

  const state = {
    session: null,
    isGuest: false,

    test: null,
    package: 1,

    questions: [],
    answers: [],
    index: 0,

    columns: [],
    columnIndex: 0,
    questionIndex: 0,

    timerId: null,
    startedAt: 0,

    lastResult: null,
    locked: false,
    finished: false
  };

  const $ = (id) => document.getElementById(id);

  const views = [
    'landing',
    'auth',
    'dashboard',
    'instruction',
    'test',
    'result',
    'history'
  ];

  // ============================================================
  // VIEW
  // ============================================================

  function showView(name) {
    views.forEach((view) => {
      $(view + 'View')?.classList.remove('active');
    });

    $(name + 'View')?.classList.add('active');
    document.body.dataset.view = name;

    if (name !== 'test') {
      stopTimer();
    }

    window.scrollTo(0, 0);
  }

  // ============================================================
  // TOAST
  // ============================================================

  function toast(message, type = 'info', duration = 2600) {
    const root = $('toastRoot');

    if (!root) {
      return;
    }

    root.innerHTML = '';

    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;

    if (type === 'success') {
      el.classList.add('success');
    }

    if (type === 'warning') {
      el.classList.add('warning');
    }

    root.appendChild(el);

    window.setTimeout(() => {
      el.remove();
    }, duration);
  }

  // ============================================================
  // RANDOM
  // ============================================================

  function randomInt(max) {
    if (
      window.crypto &&
      typeof window.crypto.getRandomValues === 'function'
    ) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);

      const limit =
        Math.floor(0x100000000 / max) * max;

      if (array[0] < limit) {
        return array[0] % max;
      }
    }

    return Math.floor(Math.random() * max);
  }

  function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
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
      const raw = localStorage.getItem(CONFIG.SESSION_KEY);

      if (!raw) {
        return null;
      }

      const session = JSON.parse(raw);

      if (
        !session?.token ||
        !session?.user_id ||
        !session?.username
      ) {
        return null;
      }

      return session;
    } catch (error) {
      console.warn('Session tidak valid:', error);
      return null;
    }
  }

  // ============================================================
  // GOOGLE APPS SCRIPT API
  //
  // Tidak menggunakan fetch CORS.
  // POST dikirim melalui hidden iframe + form.
  // Apps Script mengembalikan HTML kecil yang melakukan
  // window.parent.postMessage(...).
  // ============================================================

  function createHiddenFrame() {
    const iframe = document.createElement('iframe');

    iframe.name =
      `api_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;

    Object.assign(iframe.style, {
      position: 'fixed',
      width: '1px',
      height: '1px',
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
      left: '-10000px',
      top: '-10000px'
    });

    document.body.appendChild(iframe);

    return iframe;
  }

  function makeNonce() {
    if (
      window.crypto &&
      typeof window.crypto.getRandomValues === 'function'
    ) {
      const buffer = new Uint32Array(3);
      window.crypto.getRandomValues(buffer);

      return Array.from(buffer)
        .map((value) => value.toString(16).padStart(8, '0'))
        .join('-');
    }

    return (
      `${Date.now().toString(36)}-` +
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2)
    );
  }

  function api(action, data = {}, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const iframe = createHiddenFrame();
      const nonce = makeNonce();

      let settled = false;

      const cleanup = () => {
        window.removeEventListener('message', onMessage);

        window.setTimeout(() => {
          iframe.remove();
        }, 100);
      };

      const finish = (fn, value) => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutId);
        cleanup();
        fn(value);
      };

      const onMessage = (event) => {
        if (
          event.source !== iframe.contentWindow
        ) {
          return;
        }

        const message = event.data;

        if (
          !message ||
          message.type !== 'PSYCHOTEST_API_RESPONSE' ||
          String(message.nonce || '') !== nonce
        ) {
          return;
        }

        if (message.ok === true && message.data) {
          finish(resolve, message.data);
          return;
        }

        finish(
          reject,
          new Error(
            message.error ||
            message.data?.message ||
            'Backend gagal memproses permintaan.'
          )
        );
      };

      const timeoutId = window.setTimeout(() => {
        finish(
          reject,
          new Error('Backend tidak merespons dalam 20 detik.')
        );
      }, timeoutMs);

      window.addEventListener('message', onMessage);

      const form = document.createElement('form');

      form.method = 'POST';
      form.action = CONFIG.API_URL;
      form.target = iframe.name;
      form.style.display = 'none';

      const payload = {
        ...data,
        action,
        nonce
      };

      const field = document.createElement('input');
      field.type = 'hidden';
      field.name = 'data';
      field.value = JSON.stringify(payload);

      form.appendChild(field);
      document.body.appendChild(form);

      try {
        form.submit();
      } catch (error) {
        finish(reject, error);
      } finally {
        form.remove();
      }
    });
  }

  // ============================================================
  // GUEST
  // ============================================================

  function enterGuestMode() {
    state.isGuest = true;
    state.session = null;
    saveSession();

    $('welcomeName').textContent = 'Tamu';

    renderCatalog();
    showView('dashboard');
  }

  function leaveGuestMode() {
    state.isGuest = false;
    state.session = null;
  }

  // ============================================================
  // DASHBOARD
  // ============================================================

  function renderCatalog() {
    const root = $('testCatalog');

    if (!root) {
      return;
    }

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
          <select
            class="package-select"
            aria-label="Paket ${test.name}"
          >
            <option value="1">Paket 1</option>
            <option value="2">Paket 2</option>
            <option value="3">Paket 3</option>
          </select>

          <button class="primary-btn">
            Mulai →
          </button>
        </div>
      `;

      const button = card.querySelector('button');
      const select = card.querySelector('select');

      button.addEventListener('click', () => {
        openInstruction(id, Number(select.value));
      });

      root.appendChild(card);
    });
  }

  // ============================================================
  // INSTRUCTION
  // ============================================================

  function openInstruction(testId, packageNumber) {
    state.test = testId;
    state.package = packageNumber;

    const test = TESTS[testId];

    $('instructionEyebrow').textContent =
      `${test.name.toUpperCase()} • PAKET ${packageNumber}`;

    $('instructionTitle').textContent = test.name;
    $('instructionPackage').textContent =
      `Paket ${packageNumber}`;

    if (test.kind === 'kraepelin') {
      $('instructionLead').innerHTML =
        'Jumlahkan dua angka yang berdekatan dari ' +
        '<strong>bawah ke atas</strong>. Masukkan ' +
        '<strong>angka satuannya</strong>.';

      $('instructionBody').innerHTML = `
        <div class="example-layout">
          <div class="example-column">
            8<br>
            5<br>
            7<br>
            3
          </div>

          <div>→</div>

          <div class="example-results">
            <div>3 + 7 = 10 <strong>→ 0</strong></div>
            <div>7 + 5 = 12 <strong>→ 2</strong></div>
            <div>5 + 8 = 13 <strong>→ 3</strong></div>
          </div>
        </div>

        <div class="instruction-grid">
          <div class="tip">
            <b>50 kolom</b>
            <small>Setiap kolom memiliki 26 jawaban.</small>
          </div>

          <div class="tip">
            <b>15 detik</b>
            <small>Waktu otomatis berpindah ke kolom berikutnya.</small>
          </div>
        </div>
      `;
    } else {
      $('instructionLead').textContent =
        'Pilih jawaban yang paling tepat. Soal akan berpindah setelah ' +
        'jawaban dipilih atau waktu habis.';

      $('instructionBody').innerHTML = `
        <div class="instruction-grid">
          <div class="tip">
            <b>20 soal</b>
            <small>Bank soal sementara masih menggunakan data dummy.</small>
          </div>

          <div class="tip">
            <b>30 detik/soal</b>
            <small>Timer otomatis berpindah bila waktu habis.</small>
          </div>

          <div class="tip">
            <b>3 paket</b>
            <small>Struktur Paket 1–3 sudah tersedia.</small>
          </div>

          <div class="tip">
            <b>Simpan PDF</b>
            <small>Hasil dapat disimpan sebagai file PDF.</small>
          </div>
        </div>
      `;
    }

    showView('instruction');
  }

  // ============================================================
  // START TEST
  // ============================================================

  function startTest() {
    state.startedAt = Date.now();
    state.lastResult = null;
    state.locked = false;
    state.finished = false;

    if (TESTS[state.test].kind === 'kraepelin') {
      startKraepelin();
      return;
    }

    startMCQ();
  }

  // ============================================================
  // KRAEPELIN
  // ============================================================

  function startKraepelin() {
    state.columns = Array.from(
      { length: CONFIG.KRAEPELIN_COLUMNS },
      () =>
        Array.from(
          { length: CONFIG.KRAEPELIN_DIGITS },
          () => randomInt(10)
        )
    );

    state.answers = Array.from(
      { length: CONFIG.KRAEPELIN_COLUMNS },
      () =>
        Array(CONFIG.KRAEPELIN_QUESTIONS).fill(null)
    );

    state.columnIndex = 0;
    state.questionIndex = 0;

    renderKraepelin();
    showView('test');
    startColumnTimer();
  }

  function renderKraepelin() {
    const column = state.columns[state.columnIndex];
    const question = state.questionIndex;

    const bottom =
      column[CONFIG.KRAEPELIN_DIGITS - 1 - question];

    const top =
      column[CONFIG.KRAEPELIN_DIGITS - 2 - question];

    $('testTypeLabel').textContent = 'Kraepelin';

    $('questionCounter').textContent =
      `${question + 1}/${CONFIG.KRAEPELIN_QUESTIONS}`;

    $('timeCounter').textContent =
      `${CONFIG.KRAEPELIN_SECONDS}s`;

    const progress =
      (
        state.columnIndex * CONFIG.KRAEPELIN_QUESTIONS +
        question
      ) /
      (
        CONFIG.KRAEPELIN_COLUMNS *
        CONFIG.KRAEPELIN_QUESTIONS
      ) *
      100;

    $('progressBar').style.width =
      `${progress}%`;

    $('testContent').innerHTML = `
      <div class="question-label">JUMLAHKAN</div>
      <div class="big-number">${top}</div>
      <div class="question-mark">?</div>
      <div class="big-number">${bottom}</div>
    `;

    $('keypad').innerHTML = '';

    [7, 8, 9, 4, 5, 6, 1, 2, 3, 0]
      .forEach((digit) => {
        const button = document.createElement('button');

        button.className = 'digit-btn';

        if (digit === 0) {
          button.classList.add('zero-btn');
        }

        button.textContent = String(digit);
        button.type = 'button';

        button.addEventListener('click', () => {
          answerKraepelin(digit);
        });

        $('keypad').appendChild(button);
      });

    $('testHint').textContent =
      'Keyboard 0–9 juga bisa digunakan.';
  }

  function startColumnTimer() {
    stopTimer();

    const endTime =
      Date.now() +
      CONFIG.KRAEPELIN_SECONDS * 1000;

    state.timerId = window.setInterval(() => {
      const secondsLeft = Math.max(
        0,
        Math.ceil((endTime - Date.now()) / 1000)
      );

      $('timeCounter').textContent =
        `${secondsLeft}s`;

      if (secondsLeft <= 0) {
        stopTimer();
        nextKraepelinColumn();
      }
    }, 100);
  }

  function answerKraepelin(digit) {
    if (state.locked) {
      return;
    }

    const currentAnswer =
      state.answers[state.columnIndex][state.questionIndex];

    if (currentAnswer !== null) {
      return;
    }

    state.answers[state.columnIndex][state.questionIndex] =
      Number(digit);

    if (
      state.questionIndex <
      CONFIG.KRAEPELIN_QUESTIONS - 1
    ) {
      state.questionIndex += 1;
      renderKraepelin();
      return;
    }

    nextKraepelinColumn();
  }

  function nextKraepelinColumn() {
    stopTimer();

    if (
      state.columnIndex >=
      CONFIG.KRAEPELIN_COLUMNS - 1
    ) {
      finishTest();
      return;
    }

    state.columnIndex += 1;
    state.questionIndex = 0;

    renderKraepelin();
    startColumnTimer();
  }

  // ============================================================
  // MCQ
  // ============================================================

  function startMCQ() {
    const base = SAMPLE[state.test] || [];

    let questions = [];

    // Dummy bank: repeat the sample items until 20 questions.
    while (
      questions.length <
      CONFIG.MCQ_QUESTIONS
    ) {
      questions.push(
        ...base.map(([text, options, correct]) => ({
          text,
          options: [...options],
          correct
        }))
      );
    }

    state.questions = shuffle(
      questions.slice(0, CONFIG.MCQ_QUESTIONS)
    );

    state.answers =
      Array(CONFIG.MCQ_QUESTIONS).fill(null);

    state.index = 0;
    state.locked = false;

    renderMCQ();
    showView('test');
    startQuestionTimer();
  }

  function renderMCQ() {
    const question =
      state.questions[state.index];

    $('testTypeLabel').textContent =
      TESTS[state.test].name;

    $('questionCounter').textContent =
      `${state.index + 1}/${CONFIG.MCQ_QUESTIONS}`;

    $('progressBar').style.width =
      `${(state.index / CONFIG.MCQ_QUESTIONS) * 100}%`;

    $('testContent').innerHTML = `
      <div class="question-label">
        PERTANYAAN ${state.index + 1}
      </div>

      <h2>
        ${escapeHtml(question.text)}
      </h2>
    `;

    $('keypad').innerHTML = '';

    question.options.forEach((option, index) => {
      const button =
        document.createElement('button');

      button.className = 'answer-btn';
      button.type = 'button';

      button.textContent =
        `${String.fromCharCode(65 + index)}. ${option}`;

      button.addEventListener('click', () => {
        answerMCQ(index);
      });

      $('keypad').appendChild(button);
    });

    $('testHint').textContent =
      'Pilih satu jawaban. Waktu per soal: 30 detik.';
  }

  function startQuestionTimer() {
    stopTimer();

    const endTime =
      Date.now() +
      CONFIG.MCQ_SECONDS * 1000;

    state.timerId = window.setInterval(() => {
      const secondsLeft = Math.max(
        0,
        Math.ceil((endTime - Date.now()) / 1000)
      );

      $('timeCounter').textContent =
        `${secondsLeft}s`;

      if (secondsLeft <= 0) {
        stopTimer();
        answerMCQ(null);
      }
    }, 100);
  }

  function answerMCQ(choice) {
    if (state.locked) {
      return;
    }

    if (state.answers[state.index] !== null) {
      return;
    }

    state.locked = true;
    stopTimer();

    const question =
      state.questions[state.index];

    state.answers[state.index] =
      choice === null ? null : Number(choice);

    if (choice !== null) {
      const buttons =
        $('keypad').querySelectorAll('button');

      buttons.forEach((button, buttonIndex) => {
        if (buttonIndex === question.correct) {
          button.classList.add('correct');
        }

        if (
          buttonIndex === choice &&
          choice !== question.correct
        ) {
          button.classList.add('wrong');
        }
      });
    }

    const isLastQuestion =
      state.index >=
      state.questions.length - 1;

    window.setTimeout(() => {
      if (isLastQuestion) {
        state.locked = false;
        finishTest();
        return;
      }

      state.index += 1;
      state.locked = false;

      renderMCQ();
      startQuestionTimer();
    }, choice === null ? 0 : 180);
  }

  // ============================================================
  // SCORING
  // ============================================================

  function clamp(number) {
    return Math.max(
      0,
      Math.min(100, number)
    );
  }

  function mean(values) {
    return values.length
      ? values.reduce(
          (sum, value) => sum + value,
          0
        ) / values.length
      : 0;
  }

  function calculateKraepelin() {
    let answered = 0;
    let correct = 0;
    const counts = [];

    state.answers.forEach(
      (columnAnswers, columnIndex) => {
        let answeredInColumn = 0;

        columnAnswers.forEach(
          (answer, questionIndex) => {
            if (answer === null) {
              return;
            }

            answered += 1;
            answeredInColumn += 1;

            const expected =
              (
                state.columns[columnIndex][26 - questionIndex] +
                state.columns[columnIndex][25 - questionIndex]
              ) %
              10;

            if (answer === expected) {
              correct += 1;
            }
          }
        );

        counts.push(answeredInColumn);
      }
    );

    const total =
      CONFIG.KRAEPELIN_COLUMNS *
      CONFIG.KRAEPELIN_QUESTIONS;

    const average = mean(counts);

    const standardDeviation =
      Math.sqrt(
        mean(
          counts.map(
            (value) =>
              (value - average) ** 2
          )
        )
      );

    const consistency =
      Math.round(
        clamp(
          100 -
          (
            average
              ? standardDeviation / average
              : 1
          ) *
          100
        )
      );

    const firstTen =
      mean(counts.slice(0, 10));

    const middleTen =
      mean(counts.slice(20, 30));

    const lastTen =
      mean(counts.slice(40, 50));

    const baseline =
      Math.max(
        1,
        mean([firstTen, middleTen])
      );

    const endurance =
      Math.round(
        clamp(
          100 -
          Math.max(
            0,
            (baseline - lastTen) / baseline
          ) *
          100
        )
      );

    return {
      type: 'kraepelin',
      package: state.package,
      answered,
      correct,
      wrong: answered - correct,
      total,
      score:
        Math.round(
          (correct / total) * 100
        ),
      speed:
        Math.round(
          (answered / total) * 100
        ),
      accuracy:
        answered
          ? Math.round(
              (correct / answered) * 100
            )
          : 0,
      consistency,
      endurance,
      chart: counts
    };
  }

  function calculateMCQ() {
    const total =
      state.questions.length;

    const answered =
      state.answers.filter(
        (answer) => answer !== null
      ).length;

    const correct =
      state.answers.reduce(
        (sum, answer, index) => {
          if (
            answer !== null &&
            answer ===
              state.questions[index].correct
          ) {
            return sum + 1;
          }

          return sum;
        },
        0
      );

    const wrong =
      answered - correct;

    const accuracy =
      answered
        ? Math.round(
            (correct / answered) * 100
          )
        : 0;

    const speed =
      Math.round(
        (answered / total) * 100
      );

    const consistency =
      Math.round(
        clamp(
          100 -
          Math.abs(
            speed - accuracy
          )
        )
      );

    const endurance =
      Math.round(
        clamp(
          (answered / total) * 100
        )
      );

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
      chart:
        state.answers.map(
          (answer, index) =>
            answer === null
              ? 0
              : answer ===
                state.questions[index].correct
                ? 1
                : 0
        )
    };
  }

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

  // ============================================================
  // FINISH TEST
  // ============================================================

  function finishTest() {
    if (state.finished) {
      return;
    }

    state.finished = true;
    state.locked = true;

    stopTimer();

    const result =
      TESTS[state.test].kind === 'kraepelin'
        ? calculateKraepelin()
        : calculateMCQ();

    result.test_id =
      `T-${Date.now()}-${randomInt(100000)}`;

    result.tanggal =
      new Date().toISOString();

    state.lastResult = result;

    // Show the result immediately.
    // Saving to Sheets happens in the background so a slow
    // backend can never freeze the result page.
    renderResult(result);
    showView('result');

    window.setTimeout(() => {
      drawChart(result);
      saveHistoryToGoogleSheets(result);
    }, 20);
  }

  async function saveHistoryToGoogleSheets(result) {
    if (state.isGuest) {
      return;
    }

    if (!state.session?.token) {
      toast(
        'Sesi akun tidak ditemukan. Hasil tetap tampil, tetapi histori tidak tersimpan.',
        'warning',
        4200
      );
      return;
    }

    try {
      await api('saveHistory', {
        token: state.session.token,
        test_id: result.test_id,
        user_id: state.session.user_id,
        test_type: result.type,
        package: result.package,
        tanggal: result.tanggal,
        score: result.score,
        correct: result.correct,
        wrong: result.wrong,
        total: result.total,
        speed: result.speed,
        accuracy: result.accuracy,
        consistency: result.consistency,
        endurance: result.endurance
      });

      toast(
        'Hasil berhasil disimpan ke Google Sheets.',
        'success'
      );
    } catch (error) {
      console.error(error);

      toast(
        `Hasil selesai, tetapi histori gagal disimpan: ${error.message}`,
        'warning',
        5000
      );
    }
  }

  // ============================================================
  // RESULT
  // ============================================================

  function renderResult(result) {
    const test =
      TESTS[result.type];

    $('resultTitle').textContent =
      `${test.name} selesai 🎉`;

    if (state.isGuest) {
      $('resultIntro').innerHTML =
        'Hasil mode <strong>Tamu</strong> tidak disimpan ke histori akun. ' +
        'Gunakan tombol <strong>Simpan dalam PDF</strong> untuk menyimpan salinannya.';
    } else {
      $('resultIntro').innerHTML =
        'Hasil <strong>disimpan ke Google Sheets</strong> secara otomatis setelah tes selesai.';
    }

    const scores = [
      ['Kecepatan', result.speed],
      ['Ketelitian', result.accuracy],
      ['Konsistensi', result.consistency],
      ['Ketahanan', result.endurance]
    ];

    $('resultScores').innerHTML =
      scores
        .map(
          ([name, value]) => `
            <article class="score-card">
              <span class="score-label">${name}</span>
              <strong>${value}%</strong>
              <small>${level(value)}</small>

              <div class="score-track">
                <i style="--score:${value}%"></i>
              </div>
            </article>
          `
        )
        .join('');

    $('resultSummary').innerHTML =
      [
        ['Skor utama', `${result.score}%`],
        [
          'Total dijawab',
          `${result.answered}/${result.total}`
        ],
        ['Benar', result.correct],
        ['Salah', result.wrong]
      ]
        .map(
          ([label, value]) => `
            <div>
              <span>${label}</span>
              <strong>${value}</strong>
            </div>
          `
        )
        .join('');

    $('chartSubtitle').textContent =
      result.type === 'kraepelin'
        ? 'Jumlah jawaban per kolom.'
        : 'Benar (1) dan salah/kosong (0) per soal.';

    $('chartBadge').textContent =
      result.type === 'kraepelin'
        ? '50 kolom'
        : `${result.total} soal`;
  }

  function drawChart(result) {
    const canvas =
      $('performanceChart');

    if (!canvas) {
      return;
    }

    const dpr =
      window.devicePixelRatio || 1;

    const width =
      Math.max(
        500,
        canvas.clientWidth || 700
      );

    const height = 220;

    canvas.width =
      width * dpr;

    canvas.height =
      height * dpr;

    const context =
      canvas.getContext('2d');

    context.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

    context.clearRect(
      0,
      0,
      width,
      height
    );

    context.strokeStyle =
      '#dbe5ef';

    context.fillStyle =
      '#6f7f94';

    context.font =
      '10px Inter, sans-serif';

    context.beginPath();
    context.moveTo(35, 10);
    context.lineTo(35, height - 28);
    context.lineTo(width - 10, height - 28);
    context.stroke();

    const data =
      result.chart.slice(
        0,
        result.type === 'kraepelin'
          ? 50
          : 20
      );

    const max =
      Math.max(1, ...data);

    const gap = 4;

    const barWidth =
      Math.max(
        3,
        (width - 55) / data.length - gap
      );

    data.forEach(
      (value, index) => {
        const barHeight =
          (value / max) *
          (height - 55);

        const x =
          38 +
          index *
            (barWidth + gap);

        const y =
          height -
          28 -
          barHeight;

        context.fillStyle =
          '#2f7df2';

        context.fillRect(
          x,
          y,
          barWidth,
          barHeight
        );
      }
    );

    context.fillStyle =
      '#6f7f94';

    context.fillText(
      '0',
      18,
      height - 25
    );

    context.fillText(
      String(max),
      12,
      18
    );
  }

  // ============================================================
  // PDF
  //
  // 1) Pakai jsPDF jika tersedia.
  // 2) Jika CDN/library gagal, gunakan PDF generator kecil
  //    bawaan browser. Jadi tombol tidak lagi bergantung
  //    pada library eksternal.
  // ============================================================

  function downloadPdf() {
    const result =
      state.lastResult;

    if (!result) {
      toast(
        'Hasil tes belum tersedia.',
        'warning'
      );
      return;
    }

    const jsPDF =
      window.jspdf?.jsPDF;

    if (typeof jsPDF === 'function') {
      downloadPdfWithJsPdf(result, jsPDF);
      return;
    }

    downloadSimplePdf(result);
  }

  function downloadPdfWithJsPdf(result, JsPDF) {
    try {
      const doc =
        new JsPDF();

      const name =
        state.isGuest
          ? 'Tamu'
          : (
              state.session?.username ||
              'Peserta'
            );

      doc.setFont(
        'helvetica',
        'bold'
      );

      doc.setFontSize(20);

      doc.text(
        'Hasil Latihan Psikotes',
        20,
        22
      );

      doc.setFont(
        'helvetica',
        'normal'
      );

      doc.setFontSize(10);

      doc.text(
        `Peserta: ${name}`,
        20,
        31
      );

      doc.text(
        `Tes: ${TESTS[result.type].name} - Paket ${result.package}`,
        20,
        37
      );

      doc.text(
        `Tanggal: ${new Date(result.tanggal).toLocaleString('id-ID')}`,
        20,
        43
      );

      doc.setFont(
        'helvetica',
        'bold'
      );

      doc.setFontSize(13);

      doc.text(
        'Ringkasan Performa',
        20,
        56
      );

      const rows = [
        ['Skor utama', `${result.score}%`],
        ['Kecepatan', `${result.speed}%`],
        ['Ketelitian', `${result.accuracy}%`],
        ['Konsistensi', `${result.consistency}%`],
        ['Ketahanan', `${result.endurance}%`],
        ['Dijawab', `${result.answered}/${result.total}`],
        ['Benar', String(result.correct)],
        ['Salah', String(result.wrong)]
      ];

      doc.setFont(
        'helvetica',
        'normal'
      );

      doc.setFontSize(10);

      rows.forEach(
        ([label, value], index) => {
          doc.text(
            `${label}: ${value}`,
            20,
            68 + index * 7
          );
        }
      );

      const canvas =
        $('performanceChart');

      if (canvas) {
        const image =
          canvas.toDataURL(
            'image/png'
          );

        doc.addImage(
          image,
          'PNG',
          20,
          132,
          170,
          58
        );
      }

      doc.setFontSize(8.5);
      doc.setTextColor(
        100,
        112,
        128
      );

      const note =
        'Catatan: skor ini adalah indikator latihan internal, ' +
        'bukan norma resmi psikotes dan bukan diagnosis psikologis.';

      doc.text(
        doc.splitTextToSize(
          note,
          170
        ),
        20,
        202
      );

      doc.setTextColor(
        24,
        38,
        59
      );

      doc.setFontSize(10);

      doc.text(
        'Interpretasi latihan',
        20,
        222
      );

      doc.setFontSize(9);

      doc.text(
        `Kecepatan: ${level(result.speed)} | Ketelitian: ${level(result.accuracy)}`,
        20,
        230
      );

      doc.text(
        `Konsistensi: ${level(result.consistency)} | Ketahanan: ${level(result.endurance)}`,
        20,
        237
      );

      doc.save(
        `hasil-${result.type}-paket-${result.package}-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`
      );

      toast(
        'PDF berhasil disimpan.',
        'success'
      );
    } catch (error) {
      console.error(error);

      toast(
        'Library PDF gagal digunakan. Membuat PDF mandiri...',
        'warning'
      );

      downloadSimplePdf(result);
    }
  }

  // Minimal PDF writer.
  // Tidak membutuhkan library eksternal.
  function downloadSimplePdf(result) {
    try {
      const name =
        state.isGuest
          ? 'Tamu'
          : (
              state.session?.username ||
              'Peserta'
            );

      const lines = [
        'HASIL LATIHAN PSIKOTES',
        '',
        `Peserta     : ${name}`,
        `Tes         : ${TESTS[result.type].name}`,
        `Paket       : ${result.package}`,
        `Tanggal     : ${new Date(result.tanggal).toLocaleString('id-ID')}`,
        '',
        'RINGKASAN PERFORMA',
        `Skor utama  : ${result.score}%`,
        `Kecepatan   : ${result.speed}% - ${level(result.speed)}`,
        `Ketelitian  : ${result.accuracy}% - ${level(result.accuracy)}`,
        `Konsistensi : ${result.consistency}% - ${level(result.consistency)}`,
        `Ketahanan   : ${result.endurance}% - ${level(result.endurance)}`,
        `Dijawab     : ${result.answered}/${result.total}`,
        `Benar       : ${result.correct}`,
        `Salah       : ${result.wrong}`,
        '',
        'Catatan:',
        'Skor ini adalah indikator latihan internal.',
        'Bukan norma resmi psikotes dan bukan diagnosis psikologis.'
      ];

      const pdf =
        buildSimplePdf(lines);

      const blob =
        new Blob(
          [pdf],
          { type: 'application/pdf' }
        );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement('a');

      link.href = url;

      link.download =
        `hasil-${result.type}-paket-${result.package}-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      toast(
        'PDF berhasil dibuat tanpa library eksternal.',
        'success'
      );
    } catch (error) {
      console.error(error);

      toast(
        'PDF mandiri gagal dibuat. Coba gunakan Print → Save as PDF.',
        'warning',
        4500
      );

      window.print();
    }
  }

  function buildSimplePdf(lines) {
    const safeLines =
      lines.map((line) =>
        toPdfAscii(
          String(line)
        )
      );

    const pageWidth = 595;
    const pageHeight = 842;

    const objects = [];

    const contentLines = [
      'BT',
      '/F1 18 Tf',
      `50 ${pageHeight - 60} Td`
    ];

    let lineIndex = 0;

    safeLines.forEach((line) => {
      if (lineIndex === 0) {
        contentLines.push(
          `(${pdfEscape(line)}) Tj`
        );
      } else {
        contentLines.push(
          '0 -20 Td'
        );
        contentLines.push(
          `(${pdfEscape(line)}) Tj`
        );
      }

      lineIndex += 1;
    });

    contentLines.push('ET');

    const content =
      contentLines.join('\n');

    objects.push(
      '<< /Type /Catalog /Pages 2 0 R >>'
    );

    objects.push(
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'
    );

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`
    );

    objects.push(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
    );

    objects.push(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    );

    let pdf =
      '%PDF-1.4\n';

    const offsets =
      [0];

    objects.forEach(
      (object, index) => {
        offsets[index + 1] =
          pdf.length;

        pdf +=
          `${index + 1} 0 obj\n`;

        pdf +=
          `${object}\n`;

        pdf +=
          'endobj\n';
      }
    );

    const xrefOffset =
      pdf.length;

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
        `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }

    pdf +=
      'trailer\n';

    pdf +=
      `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;

    pdf +=
      'startxref\n';

    pdf +=
      `${xrefOffset}\n`;

    pdf +=
      '%%EOF';

    return pdf;
  }

  function pdfEscape(value) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  function toPdfAscii(value) {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '?');
  }

  // ============================================================
  // HISTORY
  // ============================================================

  async function renderHistory() {
    const body =
      $('historyTableBody');

    const empty =
      $('emptyHistory');

    const table =
      $('historyTable');

    if (!state.session?.token) {
      body.innerHTML = '';
      empty.hidden = false;
      table.hidden = true;

      $('historyPageCount').textContent =
        '0';

      return;
    }

    body.innerHTML = '';

    empty.hidden = true;
    table.hidden = true;

    $('historyPageCount').textContent =
      '…';

    try {
      const response =
        await api(
          'getHistory',
          {
            token: state.session.token
          }
        );

      if (!response?.success) {
        throw new Error(
          response?.message ||
          'Histori tidak dapat dimuat.'
        );
      }

      const history =
        Array.isArray(response.history)
          ? response.history
          : [];

      $('historyPageCount').textContent =
        String(history.length);

      empty.hidden =
        history.length > 0;

      table.hidden =
        history.length === 0;

      history.forEach(
        (item, index) => {
          const row =
            document.createElement('tr');

          row.innerHTML = `
            <td>${index + 1}</td>
            <td>${formatDate(item.tanggal)}</td>
            <td>${escapeHtml(
              TESTS[item.test_type]?.name ||
              item.test_type ||
              '-'
            )}</td>
            <td>${item.package ?? '-'}</td>
            <td>${Number(item.score) || 0}%</td>
            <td>${Number(item.speed) || 0}%</td>
            <td>${Number(item.accuracy) || 0}%</td>
            <td>${Number(item.consistency) || 0}%</td>
            <td>${Number(item.endurance) || 0}%</td>
          `;

          body.appendChild(row);
        }
      );
    } catch (error) {
      console.error(error);

      $('historyPageCount').textContent =
        '0';

      empty.hidden = false;
      table.hidden = true;

      empty.textContent =
        'Histori gagal dimuat. Coba buka halaman Histori lagi.';

      toast(
        `Histori gagal dimuat: ${error.message}`,
        'warning',
        4500
      );
    }
  }

  function formatDate(value) {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '-';
    }

    return date.toLocaleString(
      'id-ID'
    );
  }

  // ============================================================
  // AUTH
  // ============================================================

  function showAuth(type) {
    $('loginPane').hidden =
      type !== 'login';

    $('registerPane').hidden =
      type !== 'register';

    $('authTitle').textContent =
      type === 'login'
        ? 'Selamat datang kembali'
        : 'Buat akun peserta';

    $('authSubtitle').textContent =
      type === 'login'
        ? 'Masuk untuk menyimpan histori latihan di Google Sheets.'
        : 'Akun digunakan untuk menyimpan histori latihan di Google Sheets.';

    $('loginError').textContent = '';
    $('registerError').textContent = '';

    showView('auth');
  }

  async function handleLogin(event) {
    event.preventDefault();

    const username =
      $('loginUsername').value.trim();

    const password =
      $('loginPassword').value;

    const errorElement =
      $('loginError');

    errorElement.textContent = '';

    if (!username || !password) {
      errorElement.textContent =
        'Username dan password wajib diisi.';
      return;
    }

    const button =
      $('loginForm').querySelector(
        'button[type="submit"]'
      );

    setButtonBusy(
      button,
      'Memeriksa...'
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

      if (
        !response?.success ||
        !response.session
      ) {
        throw new Error(
          response?.message ||
          'Login gagal.'
        );
      }

      state.session =
        response.session;

      state.isGuest = false;

      saveSession();

      $('welcomeName').textContent =
        state.session.username;

      renderCatalog();
      showView('dashboard');

      toast(
        'Login berhasil. Histori terhubung ke Google Sheets.',
        'success',
        3500
      );

      $('loginForm').reset();
    } catch (error) {
      console.error(error);

      errorElement.textContent =
        error.message ||
        'Login gagal.';
    } finally {
      setButtonReady(button);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();

    const username =
      $('registerUsername').value.trim();

    const password =
      $('registerPassword').value;

    const confirmation =
      $('registerConfirm').value;

    const errorElement =
      $('registerError');

    errorElement.textContent = '';

    if (
      !/^[A-Za-z0-9_]{3,24}$/.test(username)
    ) {
      errorElement.textContent =
        'Username 3–24 karakter: huruf, angka, underscore.';
      return;
    }

    if (password.length < 8) {
      errorElement.textContent =
        'Password minimal 8 karakter.';
      return;
    }

    if (password !== confirmation) {
      errorElement.textContent =
        'Konfirmasi password belum sama.';
      return;
    }

    const button =
      $('registerForm').querySelector(
        'button[type="submit"]'
      );

    setButtonBusy(
      button,
      'Membuat akun...'
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

      if (
        !response?.success ||
        !response.session
      ) {
        throw new Error(
          response?.message ||
          'Pendaftaran gagal.'
        );
      }

      state.session =
        response.session;

      state.isGuest = false;

      saveSession();

      $('welcomeName').textContent =
        state.session.username;

      renderCatalog();
      showView('dashboard');

      toast(
        'Akun berhasil dibuat dan tersambung ke Google Sheets.',
        'success',
        3500
      );

      $('registerForm').reset();
    } catch (error) {
      console.error(error);

      errorElement.textContent =
        error.message ||
        'Pendaftaran gagal.';
    } finally {
      setButtonReady(button);
    }
  }

  async function logout() {
    const currentSession =
      state.session;

    state.session = null;
    state.isGuest = false;

    saveSession();
    showView('landing');

    if (currentSession?.token) {
      try {
        await api(
          'logout',
          {
            token:
              currentSession.token
          }
        );
      } catch (error) {
        console.warn(
          'Logout backend gagal:',
          error
        );
      }
    }

    toast(
      'Kamu sudah keluar.',
      'success'
    );
  }

  function setButtonBusy(
    button,
    label
  ) {
    if (!button) {
      return;
    }

    button.dataset.originalText =
      button.textContent;

    button.disabled = true;
    button.textContent = label;
  }

  function setButtonReady(button) {
    if (!button) {
      return;
    }

    button.disabled = false;

    if (button.dataset.originalText) {
      button.textContent =
        button.dataset.originalText;
    }
  }

  // ============================================================
  // MISC / EVENTS
  // ============================================================

  function stopTimer() {
    if (state.timerId) {
      window.clearInterval(
        state.timerId
      );

      state.timerId = null;
    }
  }

  function resetTestState() {
    stopTimer();

    state.questions = [];
    state.answers = [];
    state.columns = [];

    state.index = 0;
    state.columnIndex = 0;
    state.questionIndex = 0;

    state.lastResult = null;
    state.locked = false;
    state.finished = false;
    state.test = null;
    state.package = 1;
  }

  function escapeHtml(value) {
    return String(value).replace(
      /[&<>'"]/g,
      (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[character])
    );
  }

  function bindEvents() {
    $('landingLoginBtn')
      ?.addEventListener(
        'click',
        () => showAuth('login')
      );

    $('landingRegisterBtn')
      ?.addEventListener(
        'click',
        () => showAuth('register')
      );

    $('landingGuestBtn')
      ?.addEventListener(
        'click',
        () => {
          $('guestModal').hidden = false;
        }
      );

    $('cancelGuestBtn')
      ?.addEventListener(
        'click',
        () => {
          $('guestModal').hidden = true;
        }
      );

    $('confirmGuestBtn')
      ?.addEventListener(
        'click',
        () => {
          $('guestModal').hidden = true;
          enterGuestMode();

          toast(
            'Mode tamu aktif.',
            'success'
          );
        }
      );

    $('backToLandingBtn')
      ?.addEventListener(
        'click',
        () => showView('landing')
      );

    $('openRegisterFromLogin')
      ?.addEventListener(
        'click',
        () => showAuth('register')
      );

    $('openLoginFromRegister')
      ?.addEventListener(
        'click',
        () => showAuth('login')
      );

    $('backFromInstructionBtn')
      ?.addEventListener(
        'click',
        () => showView('dashboard')
      );

    $('startTestBtn')
      ?.addEventListener(
        'click',
        startTest
      );

    $('testHomeBtn')
      ?.addEventListener(
        'click',
        () => {
          $('confirmModal').hidden = false;
        }
      );

    $('cancelEndTestBtn')
      ?.addEventListener(
        'click',
        () => {
          $('confirmModal').hidden = true;
        }
      );

    $('confirmEndTestBtn')
      ?.addEventListener(
        'click',
        () => {
          $('confirmModal').hidden = true;
          resetTestState();
          showView('dashboard');

          toast(
            'Tes dibatalkan.',
            'warning'
          );
        }
      );

    $('downloadPdfBtn')
      ?.addEventListener(
        'click',
        downloadPdf
      );

    $('resultHistoryBtn')
      ?.addEventListener(
        'click',
        async () => {
          await renderHistory();
          showView('history');
        }
      );

    $('finishBtn')
      ?.addEventListener(
        'click',
        () => {
          resetTestState();

          if (state.isGuest) {
            leaveGuestMode();
          }

          if (state.session) {
            $('welcomeName').textContent =
              state.session.username;
          } else {
            $('welcomeName').textContent =
              'Tamu';
          }

          showView('dashboard');
        }
      );

    $('viewHistoryBtn')
      ?.addEventListener(
        'click',
        async () => {
          if (!state.session?.token) {
            toast(
              'Histori hanya tersedia setelah login.',
              'warning'
            );
            return;
          }

          await renderHistory();
          showView('history');
        }
      );

    $('backDashboardBtn')
      ?.addEventListener(
        'click',
        () => showView('dashboard')
      );

    $('logoutBtn')
      ?.addEventListener(
        'click',
        logout
      );

    $('loginForm')
      ?.addEventListener(
        'submit',
        handleLogin
      );

    $('registerForm')
      ?.addEventListener(
        'submit',
        handleRegister
      );

    window.addEventListener(
      'keydown',
      (event) => {
        if (
          document.body.dataset.view !== 'test' ||
          TESTS[state.test]?.kind !== 'kraepelin'
        ) {
          return;
        }

        if (/^[0-9]$/.test(event.key)) {
          event.preventDefault();
          answerKraepelin(
            Number(event.key)
          );
        }
      }
    );

    window.addEventListener(
      'beforeunload',
      stopTimer
    );
  }

  // ============================================================
  // INIT
  // ============================================================

  function init() {
    bindEvents();
    renderCatalog();

    state.session =
      loadSession();

    if (state.session) {
      state.isGuest = false;

      $('welcomeName').textContent =
        state.session.username;

      showView('dashboard');
    } else {
      showView('landing');
    }
  }

  init();
})();
