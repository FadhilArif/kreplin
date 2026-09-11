(() => {
  'use strict'; const CONFIG= {
    STORAGE:'psychotest_history_v1',SESSION:'psychotest_session_v1',TEST:'psychotest_active_v1',KRAEPELIN_COLUMNS:50,KRAEPELIN_Q:26,KRAEPELIN_SECONDS:15
  }
  ; const TESTS= {
    kraepelin: {
      name:'Kraepelin',icon:'🧮',description:'Latihan ritme kerja, kecepatan, ketelitian, konsistensi, dan ketahanan.',kind:'kraepelin'
    }
    , kuantitatif: {
      name:'Kuantitatif',icon:'➗',description:'Latihan hitungan dasar, persentase, rasio, dan operasi numerik.',kind:'mcq'
    }
    , numerical: {
      name:'Numerical',icon:'🔢',description:'Latihan pola angka, deret, perbandingan, dan penalaran numerik.',kind:'mcq'
    }
    , sinonim: {
      name:'Sinonim Verbal',icon:'🔤',description:'Latihan memahami persamaan makna kata dalam konteks psikotes.',kind:'mcq'
    }
    , silogisme: {
      name:'Silogisme',icon:'🧠',description:'Latihan menarik kesimpulan logis dari beberapa premis.',kind:'mcq'
    }
    , analogi: {
      name:'Analogi',icon:'🔗',description:'Latihan hubungan kata dan konsep secara analogis.',kind:'mcq'
    }
    , kognitif: {
      name:'Tes Kognitif',icon:'🧩',description:'Latihan gabungan perhatian, logika, memori, dan pemecahan masalah.',kind:'mcq'
    }
  }
  ; const SAMPLE= {
    kuantitatif:[['12 + 8 = ?',['18','20','22','24'],1],['25% dari 80 = ?',['15','20','25','30'],1],['7 × 9 = ?',['54','56','63','72'],2],['144 ÷ 12 = ?',['10','11','12','14'],2],['3/4 dari 40 = ?',['20','25','30','35'],2]], numerical:[['Deret: 2, 4, 6, 8, …',['9','10','11','12'],1],['Deret: 3, 6, 12, 24, …',['36','42','48','54'],2],['Angka mana paling besar?',['0,75','0,8','0,65','0,7'],1],['Jika 5 buku = 50.000, 8 buku = ?',['70.000','75.000','80.000','90.000'],2],['Deret: 20, 17, 14, 11, …',['7','8','9','10'],1]], sinonim:[['Sinonim “akurat” adalah …',['cepat','tepat','lambat','besar'],1],['Sinonim “konkret” adalah …',['nyata','rumit','sementara','abstrak'],0],['Sinonim “efisien” adalah …',['boros','hemat guna','lambat','acak'],1],['Sinonim “valid” adalah …',['sah','lemah','samar','salah'],0],['Sinonim “esensial” adalah …',['tambahan','pokok','sementara','remeh'],1]], silogisme:[['Semua A adalah B. Semua B adalah C. Kesimpulan yang benar?',['Semua A adalah C','Semua C adalah A','Sebagian A bukan B','Tidak ada hubungan'],0],['Semua dokter adalah pekerja. Rina adalah dokter. Maka …',['Rina bukan pekerja','Rina pekerja','Semua pekerja dokter','Tidak dapat disimpulkan'],1],['Semua X adalah Y. Tidak ada Y yang Z. Maka …',['X adalah Z','Tidak ada X yang Z','Semua Z adalah X','Sebagian X pasti Z'],1],['Sebagian P adalah Q. Semua Q adalah R. Maka …',['Sebagian P adalah R','Semua P adalah R','Tidak ada P yang R','Semua R adalah P'],0],['Semua M adalah N. Sebagian N adalah O. Maka …',['Semua M adalah O','Sebagian M pasti O','Mungkin sebagian M adalah O','Tidak ada N yang M'],2]], analogi:[['Buku : Membaca = Makanan : …',['memasak','makan','membeli','menjual'],1],['Dokter : Rumah sakit = Guru : …',['pasar','sekolah','bank','terminal'],1],['Panas : Dingin = Tinggi : …',['besar','jauh','rendah','panjang'],2],['Mata : Melihat = Telinga : …',['berbicara','mendengar','berjalan','menulis'],1],['Kunci : Pintu = Password : …',['akun','meja','buku','kursi'],0]], kognitif:[['Jika semua lampu mati, ruangan menjadi …',['terang','gelap','ramai','dingin'],1],['Manakah yang berbeda?',['Apel','Mangga','Wortel','Jeruk'],2],['Jika hari ini Senin, 3 hari lagi adalah …',['Selasa','Rabu','Kamis','Jumat'],2],['Pola: ▲ ● ▲ ● … berikutnya?',['▲','●','■','◆'],0],['Jika A lebih besar dari B dan B lebih besar dari C, maka …',['A<C','A=C','A>C','B<A tidak pasti'],2]]
  }
  ; let state= {
    session:null,isGuest:false,test:null,package:1,questions:[],answers:[],index:0,startedAt:0,questionStartedAt:0,timer:null,lastResult:null,columns:[],colIndex:0,qIndex:0,colStartedAt:0
  }
  ; const $=id=>document.getElementById(id); const views=['landing','auth','dashboard','instruction','test','result','history']; function showView(v) {
    views.forEach(x=>$(x+'View')?.classList.remove('active')); $(v+'View')?.classList.add('active'); document.body.dataset.view=v; if(v!=='test')stopTimer(); scrollTo(0,0)
  }
  function toast(msg,type='info') {
    const r=$('toastRoot'); r.innerHTML=''; const e=document.createElement('div'); e.className='toast '+type; e.textContent=msg; r.appendChild(e); setTimeout(()=>e.remove(),2600)
  }
  function randomInt(n) {
    if(crypto?.getRandomValues) {
      const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n
    }
    return Math.floor(Math.random()*n)
  }
  function shuffle(a) {
    a=[...a]; for(let i=a.length-1; i>0; i--) {
      const j=randomInt(i+1); [a[i],a[j]]=[a[j],a[i]]
    }
    return a
  }
  function sessionLoad() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.SESSION)||'null')
    } catch {
      return null
    }
  }
  function sessionSave() {
    if(state.session)localStorage.setItem(CONFIG.SESSION,JSON.stringify(state.session)); else localStorage.removeItem(CONFIG.SESSION)
  }
  function historyLoad() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.STORAGE)||'[]')
    } catch {
      return []
    }
  }
  function historySave(h) {
    localStorage.setItem(CONFIG.STORAGE,JSON.stringify(h))
  }
  function enterGuest() {
    state.session=null; state.isGuest=true; sessionSave(); $('welcomeName').textContent='Tamu'; renderCatalog(); showView('dashboard')
  }
  function leaveGuest() {
    state.isGuest=false; state.session=null
  }
  function renderCatalog() {
    const root=$('testCatalog'); root.innerHTML=''; Object.entries(TESTS).forEach(([id,t])=> {
      const card=document.createElement('article'); card.className='test-card card'; card.innerHTML=`<div class="test-card-top"><div class="test-icon">${t.icon}</div><div><h3>${t.name}</h3><p>${t.description}</p></div></div><div class="package-row"><select class="package-select" aria-label="Paket ${t.name}"><option value="1">Paket 1</option><option value="2">Paket 2</option><option value="3">Paket 3</option></select><button class="primary-btn">Mulai →</button></div>`; card.querySelector('button').onclick=()=>openInstruction(id,Number(card.querySelector('select').value)); root.appendChild(card)
    }
    )
  }
  function openInstruction(id,pkg) {
    state.test=id; state.package=pkg; const t=TESTS[id]; $('instructionEyebrow').textContent=`${t.name.toUpperCase()} • PAKET ${pkg}`; $('instructionTitle').textContent=t.name; $('instructionPackage').textContent=`Paket ${pkg}`; if(t.kind==='kraepelin') {
      $('instructionLead').innerHTML='Jumlahkan dua angka yang berdekatan dari <strong>bawah ke atas</strong>. Masukkan <strong>angka satuannya</strong>.'; $('instructionBody').innerHTML=`<div class="example-layout"><div class="example-column">8<br>5<br>7<br>3</div><div>→</div><div class="example-results"><div>3 + 7 = 10 <strong>→ 0</strong></div><div>7 + 5 = 12 <strong>→ 2</strong></div><div>5 + 8 = 13 <strong>→ 3</strong></div></div></div><div class="instruction-grid"><div class="tip"><b>50 kolom</b><small>Setiap kolom memiliki 26 jawaban.</small></div><div class="tip"><b>15 detik</b><small>Waktu otomatis berpindah ke kolom berikutnya.</small></div></div>`
    } else {
      $('instructionLead').textContent='Pilih jawaban yang paling tepat. Soal akan berpindah setelah jawaban dipilih atau waktu habis.'; $('instructionBody').innerHTML=`<div class="instruction-grid"><div class="tip"><b>20 soal</b><small>Fase 1–3 menggunakan 20 soal latihan per paket.</small></div><div class="tip"><b>30 detik/soal</b><small>Timer otomatis berpindah bila waktu habis.</small></div><div class="tip"><b>3 paket</b><small>Paket 1–3 sudah disiapkan dalam struktur aplikasi.</small></div><div class="tip"><b>Hasil PDF</b><small>Semua hasil dapat langsung diunduh sebagai PDF.</small></div></div>`
    }
    showView('instruction')
  }
  function startTest() {
    state.startedAt=Date.now(); state.lastResult=null; if(TESTS[state.test].kind==='kraepelin')startKraepelin(); else startMCQ()
  }
  function startKraepelin() {
    state.columns=Array.from( {
      length:CONFIG.KRAEPELIN_COLUMNS
    }
    ,()=>Array.from( {
      length:27
    }
    ,()=>randomInt(10))); state.answers=Array.from( {
      length:50
    }
    ,()=>Array(26).fill(null)); state.colIndex=0; state.qIndex=0; state.colStartedAt=Date.now(); state.questions=[]; renderKraepelin(); showView('test'); startColumnTimer()
  }
  function renderKraepelin() {
    const c=state.columns[state.colIndex],i=state.qIndex; const bottom=c[26-i],top=c[25-i]; $('testTypeLabel').textContent='Kraepelin'; $('questionCounter').textContent=`${i+1}/26`; $('timeCounter').textContent='15s'; $('progressBar').style.width=`${((state.colIndex*26+i)/(50*26))*100}%`; $('testContent').innerHTML=`<div class="question-label">JUMLAHKAN</div><div class="big-number">${top}</div><div class="question-mark">?</div><div class="big-number">${bottom}</div>`; $('keypad').innerHTML=''; [7,8,9,4,5,6,1,2,3,0].forEach(d=> {
      const b=document.createElement('button'); b.className='digit-btn '+(d===0?'zero-btn':''); b.textContent=d; b.onclick=()=>answerKraepelin(d); $('keypad').appendChild(b)
    }
    ); $('testHint').textContent='Keyboard 0–9 juga bisa digunakan.'
  }
  function startColumnTimer() {
    stopTimer(); let end=Date.now()+15000; state.timer=setInterval(()=> {
      const left=Math.max(0,Math.ceil((end-Date.now())/1000)); $('timeCounter').textContent=left+'s'; if(left<=0) {
        stopTimer(); nextColumn()
      }
    }
    ,100)
  }
  function answerKraepelin(d) {
    if(state.answers[state.colIndex][state.qIndex]!==null)return; state.answers[state.colIndex][state.qIndex]=Number(d); if(state.qIndex<25) {
      state.qIndex++; renderKraepelin()
    } else nextColumn()
  }
  function nextColumn() {
    if(state.colIndex>=49) {
      finishTest(); return
    }
    state.colIndex++; state.qIndex=0; renderKraepelin(); startColumnTimer()
  }
  function startMCQ() {
    const base=SAMPLE[state.test]||[]; let arr=[]; for(let i=0; i<4; i++)arr.push(...base.map(x=>( {
      text:x[0],options:x[1],correct:x[2]
    }
    ))); state.questions=shuffle(arr).slice(0,20); state.answers=Array(20).fill(null); state.index=0; renderMCQ(); showView('test'); startQuestionTimer()
  }
  function renderMCQ() {
    const q=state.questions[state.index]; $('testTypeLabel').textContent=TESTS[state.test].name; $('questionCounter').textContent=`${state.index+1}/20`; $('progressBar').style.width=`${(state.index/20)*100}%`; $('testContent').innerHTML=`<div class="question-label">PERTANYAAN ${state.index+1}</div><h2>${escapeHtml(q.text)}</h2><div id="answers" class="keypad"></div>`; $('keypad').innerHTML=''; q.options.forEach((op,i)=> {
      const b=document.createElement('button'); b.className='answer-btn'; b.textContent=`${String.fromCharCode(65+i)}. ${op}`; b.onclick=()=>answerMCQ(i); $('keypad').appendChild(b)
    }
    ); $('testHint').textContent='Pilih satu jawaban. Waktu per soal: 30 detik.'
  }
  function startQuestionTimer() {
    stopTimer(); let end=Date.now()+30000; state.timer=setInterval(()=> {
      const left=Math.max(0,Math.ceil((end-Date.now())/1000)); $('timeCounter').textContent=left+'s'; if(left<=0) {
        stopTimer(); answerMCQ(null)
      }
    }
    ,100)
  }
  function answerMCQ(choice) {
    if(state.answers[state.index]!==null)return; const q=state.questions[state.index]; state.answers[state.index]=choice; if(choice!==null) {
      const buttons=$('keypad').querySelectorAll('button'); buttons.forEach((b,i)=> {
        if(i===q.correct)b.classList.add('correct'); if(i===choice&&choice!==q.correct)b.classList.add('wrong')
      }
      )
    }
    setTimeout(()=> {
      if(state.index>=state.questions.length-1)finishTest(); else {
        state.index++; renderMCQ(); startQuestionTimer()
      }
    }
    ,choice===null?0:180)
  }
  function stopTimer() {
    if(state.timer) {
      clearInterval(state.timer); state.timer=null
    }
  }
  function clamp(n) {
    return Math.max(0,Math.min(100,n))
  }
  function mean(a) {
    return a.length?a.reduce((x,y)=>x+y,0)/a.length:0
  }
  function calcKraepelin() {
    let answered=0,correct=0,counts=[]; state.answers.forEach((col,ci)=> {
      let c=0; col.forEach((a,qi)=> {
        if(a!==null) {
          answered++; c++; if(a===((state.columns[ci][26-qi]+state.columns[ci][25-qi])%10))correct++
        }
      }
      ); counts.push(c)
    }
    ); const total=1300,avg=mean(counts),sd=Math.sqrt(mean(counts.map(x=>(x-avg)**2))); const consistency=Math.round(clamp(100-(avg?sd/avg:1)*100)); const first=mean(counts.slice(0,10)),mid=mean(counts.slice(20,30)),last=mean(counts.slice(40,50)); const baseline=Math.max(1,mean([first,mid])); const endurance=Math.round(clamp(100-Math.max(0,(baseline-last)/baseline)*100)); return {
      type:'kraepelin',package:state.package,answered,correct,wrong:answered-correct,total,score:Math.round((correct/total)*100),speed:Math.round((answered/total)*100),accuracy:answered?Math.round(correct/answered*100):0,consistency,endurance,chart:counts
    }
  }
  function calcMCQ() {
    const total=state.questions.length,answered=state.answers.filter(x=>x!==null).length,correct=state.answers.reduce((n,a,i)=>n+(a===state.questions[i].correct?1:0),0),wrong=answered-correct,accuracy=answered?Math.round(correct/answered*100):0,speed=Math.round(answered/total*100),consistency=Math.round(clamp(100-Math.abs(speed-accuracy))),endurance=Math.round(clamp(answered/total*100)); return {
      type:state.test,package:state.package,answered,correct,wrong,total,score:accuracy,speed,accuracy,consistency,endurance,chart:state.answers.map((x,i)=>x===null?0:x===state.questions[i].correct?1:0)
    }
  }
  function level(n) {
    return n>=90?'Sangat baik':n>=80?'Baik':n>=65?'Cukup':n>=50?'Perlu latihan':'Perlu ditingkatkan'
  }
  function finishTest() {
    stopTimer(); const r=TESTS[state.test].kind==='kraepelin'?calcKraepelin():calcMCQ(); r.testId='T-'+Date.now()+'-'+randomInt(100000); r.tanggal=new Date().toISOString(); state.lastResult=r; saveHistoryResult(r); renderResult(r); showView('result'); setTimeout(()=>drawChart(r),30)
  }
  function saveHistoryResult(r) {
    if(state.isGuest)return; const h=historyLoad(); h.unshift( {
      test_id:r.testId,user_id:state.session?.user_id||'local',tanggal:r.tanggal,test_type:r.type,package:r.package,score:r.score,correct:r.correct,wrong:r.wrong,total:r.total,speed:r.speed,accuracy:r.accuracy,consistency:r.consistency,endurance:r.endurance
    }
    ); historySave(h.slice(0,200))
  }
  function renderResult(r) {
    $('resultTitle').textContent=`${TESTS[r.type].name} selesai 🎉`; $('resultIntro').innerHTML=state.isGuest?'Hasil mode <strong>Tamu</strong> tidak disimpan ke histori. Download PDF untuk menyimpan salinannya.':`Hasil <strong>${TESTS[r.type].name}</strong> sudah tersimpan di histori browser.`; const scores=[['Kecepatan',r.speed],['Ketelitian',r.accuracy],['Konsistensi',r.consistency],['Ketahanan',r.endurance]]; $('resultScores').innerHTML=scores.map(([n,v])=>`<article class="score-card"><span class="score-label">${n}</span><strong>${v}%</strong><small>${level(v)}</small><div class="score-track"><i style="--score:${v}%"></i></div></article>`).join(''); $('resultSummary').innerHTML=[['Skor utama',r.score+'%'],['Total dijawab',`${r.answered}/${r.total}`],['Benar',r.correct],['Salah',r.wrong]].map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join(''); $('chartSubtitle').textContent=r.type==='kraepelin'?'Jumlah jawaban per kolom.':'Benar (1) dan tidak benar/kosong (0) per soal.'; $('chartBadge').textContent=r.type==='kraepelin'?'50 kolom':`${r.total} soal`
  }
  function drawChart(r) {
    const c=$('performanceChart'),dpr=devicePixelRatio||1,w=Math.max(500,c.clientWidth||700),h=220; c.width=w*dpr; c.height=h*dpr; const ctx=c.getContext('2d'); ctx.scale(dpr,dpr); ctx.clearRect(0,0,w,h); ctx.strokeStyle='#dbe5ef'; ctx.fillStyle='#6f7f94'; ctx.font='10px Inter, sans-serif'; ctx.beginPath(); ctx.moveTo(35,10); ctx.lineTo(35,h-28); ctx.lineTo(w-10,h-28); ctx.stroke(); const data=r.chart.slice(0,r.type==='kraepelin'?50:20); const max=Math.max(1,...data); const gap=4; const bw=Math.max(3,(w-55)/data.length-gap); data.forEach((v,i)=> {
      const bh=(v/max)*(h-55); const x=38+i*(bw+gap),y=h-28-bh; ctx.fillStyle='#2f7df2'; ctx.fillRect(x,y,bw,bh);
    }
    ); ctx.fillStyle='#6f7f94'; ctx.fillText('0',18,h-25); ctx.fillText(String(max),12,18)
  }
  function downloadPdf() {
    const r=state.lastResult; if(!r)return; const js=window.jspdf?.jsPDF; if(!js) {
      toast('Library PDF belum siap. Coba lagi.','warning'); return
    }
    const doc=new js(); const name=state.isGuest?'Tamu':(state.session?.username||'User'); doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.text('Hasil Latihan Psikotes',20,22); doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text(`Peserta: ${name}`,20,31); doc.text(`Tes: ${TESTS[r.type].name} • Paket ${r.package}`,20,37); doc.text(`Tanggal: ${new Date(r.tanggal).toLocaleString('id-ID')}`,20,43); doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text('Ringkasan Performa',20,56); const rows=[['Skor utama',r.score+'%'],['Kecepatan',r.speed+'%'],['Ketelitian',r.accuracy+'%'],['Konsistensi',r.consistency+'%'],['Ketahanan',r.endurance+'%'],['Dijawab',`${r.answered}/${r.total}`],['Benar',String(r.correct)],['Salah',String(r.wrong)]]; doc.setFont('helvetica','normal'); doc.setFontSize(10); rows.forEach((x,i)=>doc.text(`${x[0]}: ${x[1]}`,20,68+i*7)); const canvas=document.createElement('canvas'); canvas.width=700; canvas.height=240; const old=$('performanceChart'); const img=old.toDataURL('image/png'); doc.addImage(img,'PNG',20,132,170,58); doc.setFontSize(8.5); doc.setTextColor(100,112,128); doc.text(doc.splitTextToSize('Catatan: skor ini adalah indikator latihan internal, bukan norma resmi psikotes dan bukan diagnosis psikologis.',170),20,200); doc.setTextColor(24,38,59); doc.setFontSize(10); doc.text('Interpretasi latihan',20,220); doc.setFontSize(9); doc.text(`Kecepatan: ${level(r.speed)} • Ketelitian: ${level(r.accuracy)}`,20,228); doc.text(`Konsistensi: ${level(r.consistency)} • Ketahanan: ${level(r.endurance)}`,20,235); doc.save(`hasil-${r.type}-paket-${r.package}-${new Date().toISOString().slice(0,10)}.pdf`); toast('PDF berhasil dibuat.','success')
  }
  function renderHistory() {
    const h=state.isGuest?[]:historyLoad(); $('historyPageCount').textContent=h.length; const body=$('historyTableBody'); body.innerHTML=''; $('emptyHistory').hidden=h.length>0; $('historyTable').hidden=!h.length; h.forEach((x,i)=> {
      const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${new Date(x.tanggal).toLocaleString('id-ID')}</td><td>${TESTS[x.test_type]?.name||x.test_type}</td><td>${x.package}</td><td>${x.score}%</td><td>${x.speed}%</td><td>${x.accuracy}%</td><td>${x.consistency}%</td><td>${x.endurance}%</td>`; body.appendChild(tr)
    }
    )
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp; ','<':'&lt; ','>':'&gt; ',"'":'&#39;','"':'&quot; '}[m]))}
function bind(){
$('landingLoginBtn').onclick=()=>showAuth('login');$('landingRegisterBtn').onclick=()=>showAuth('register');$('landingGuestBtn').onclick=()=>$('guestModal').hidden=false;$('cancelGuestBtn').onclick=()=>$('guestModal').hidden=true;$('confirmGuestBtn').onclick=()=>{ $('guestModal').hidden=true;enterGuest();toast('Mode tamu aktif.','info')};$('backToLandingBtn').onclick=()=>showView('landing');$('openRegisterFromLogin').onclick=()=>showAuth('register');$('openLoginFromRegister').onclick=()=>showAuth('login');$('backFromInstructionBtn').onclick=()=>showView('dashboard');$('startTestBtn').onclick=startTest;$('testHomeBtn').onclick=()=>$('confirmModal').hidden=false;$('cancelEndTestBtn').onclick=()=>$('confirmModal').hidden=true;$('confirmEndTestBtn').onclick=()=>{ $('confirmModal').hidden=true;state.lastResult=null;showView('dashboard');toast('Tes dibatalkan.','info')};$('downloadPdfBtn').onclick=downloadPdf;$('resultHistoryBtn').onclick=()=>{renderHistory();showView('history')};$('finishBtn').onclick=()=>{if(state.isGuest){leaveGuest()}showView('dashboard')};$('viewHistoryBtn').onclick=()=>{renderHistory();showView('history')};$('backDashboardBtn').onclick=()=>showView('dashboard');$('logoutBtn').onclick=()=>{leaveGuest();sessionSave();showView('landing')};$('loginForm').onsubmit=e=>{e.preventDefault();const u=$('loginUsername').value.trim(),p=$('loginPassword').value;if(!u||!p){$('loginError').textContent='Username dan password wajib diisi.';return}state.session={user_id:'U-'+u.toLowerCase(),username:u,token:'local-'+Date.now()};state.isGuest=false;sessionSave();showView('dashboard');toast('Login lokal berhasil.','success')};$('registerForm').onsubmit=e=>{e.preventDefault();const u=$('registerUsername').value.trim(),p=$('registerPassword').value,c=$('registerConfirm').value;if(!/^[A-Za-z0-9_]{3,24}$/.test(u)){$('registerError').textContent='Username 3–24 karakter: huruf, angka, underscore.';return}if(p.length<8){$('registerError').textContent='Password minimal 8 karakter.';return}if(p!==c){$('registerError').textContent='Konfirmasi password belum sama.';return}state.session={user_id:'U-'+u.toLowerCase(),username:u,token:'local-'+Date.now()};state.isGuest=false;sessionSave();showView('dashboard');toast('Akun lokal siap digunakan.','success')};
window.addEventListener('keydown',e=>{if(document.body.dataset.view==='test'&&TESTS[state.test]?.kind==='kraepelin'&&/^[0-9]$/.test(e.key))answerKraepelin(Number(e.key))});
}
function init(){state.session=sessionLoad();if(state.session){state.isGuest=false;$('welcomeName').textContent=state.session.username;showView('dashboard')}else renderCatalog();bind();renderCatalog()}
init();
})();
