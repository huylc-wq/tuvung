/* =========================================================
   TỪ VỰNG — engine học từ theo phương pháp Leitner 5 hộp
   Toàn bộ dữ liệu lưu trong localStorage của máy người dùng
   ========================================================= */

const KEY = 'tuvung_v1';
const INTERVALS = [0, 1, 2, 4, 8, 16];          // hộp 1..5 → số ngày ôn lại
const POS = { n:'danh từ', v:'động từ', adj:'tính từ', adv:'trạng từ', phr:'cụm từ' };
const PTS = { en2vi:10, vi2en:12, listen:12, type:20 };
const MODE_NAME = {
  en2vi : '📖 Anh → Việt',
  vi2en : '📖 Việt → Anh',
  listen: '🔊 Nghe → Việt',
  type  : '⌨️ Việt → Anh (gõ chữ)'
};

/* ---------- ngày tháng ---------- */
function todayStr(d){
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function dayNum(s){ const [y,m,d] = s.split('-').map(Number); return Math.floor(Date.UTC(y,m-1,d)/86400000); }
function dayNow(){ return dayNum(todayStr()); }
function shiftDay(s, n){ const [y,m,d] = s.split('-').map(Number); return todayStr(new Date(y, m-1, d+n)); }

/* ---------- state ---------- */
const blankDay = () => ({ ans:0, ok:0, no:0, nw:0, pts:0 });
const DEFAULTS = {
  v:1, cards:{}, score:0, streak:0, best:0, lastDay:null,
  days:{}, log:[],
  settings:{ newPerDay:17, cap:0, rate:0.9, autoSpeak:true }
};
let S = load();

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return structuredClone(DEFAULTS);
    const o = JSON.parse(raw);
    return Object.assign(structuredClone(DEFAULTS), o,
      { settings: Object.assign({}, DEFAULTS.settings, o.settings||{}) });
  }catch(e){ return structuredClone(DEFAULTS); }
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){ toast('⚠️ Không lưu được dữ liệu'); } }
function today(){ const t = todayStr(); if(!S.days[t]) S.days[t] = blankDay(); return S.days[t]; }

/* ---------- tra cứu từ ---------- */
const BY_EN = {}; WORDS.forEach(w => BY_EN[w[0]] = w);
const TOPIC_NAME = {}; TOPICS.forEach(t => TOPIC_NAME[t.id] = t.name);

/* ---------- chuỗi ngày ---------- */
function curStreak(){
  if(!S.lastDay) return 0;
  const t = todayStr();
  if(S.lastDay === t || S.lastDay === shiftDay(t,-1)) return S.streak;
  return 0;                                     // đã đứt chuỗi
}
function markStudied(){
  const t = todayStr();
  if(S.lastDay === t) return;
  S.streak = curStreak() + 1;
  S.lastDay = t;
  if(S.streak > S.best) S.best = S.streak;
  save();
  toast('🔥 Giữ chuỗi ' + S.streak + ' ngày!');
}

/* =========================================================
   PHÁT ÂM (Text-to-Speech)
   ========================================================= */
let enVoice = null, viVoice = null, ttsReady = false;
function pickVoices(){
  const vs = speechSynthesis.getVoices(); if(!vs.length) return;
  enVoice = vs.find(v => /^en-US/i.test(v.lang) && /Samantha|Ava|Allison|Google US/i.test(v.name))
         || vs.find(v => /^en-US/i.test(v.lang))
         || vs.find(v => /^en/i.test(v.lang)) || null;
  viVoice = vs.find(v => /^vi/i.test(v.lang)) || null;
}
pickVoices();
if(typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = pickVoices;

function unlockTTS(){                            // iOS chỉ cho phát âm sau 1 thao tác chạm
  if(ttsReady) return; ttsReady = true;
  try{ const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }catch(e){}
}
function speak(text, lang){
  if(typeof speechSynthesis === 'undefined') return;
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if(lang === 'vi'){ u.lang = 'vi-VN'; if(viVoice) u.voice = viVoice; u.rate = 1; }
    else            { u.lang = 'en-US'; if(enVoice) u.voice = enVoice; u.rate = S.settings.rate; }
    speechSynthesis.speak(u);
  }catch(e){}
}

/* =========================================================
   XÂY HÀNG ĐỢI HỌC
   ========================================================= */
function modeForBox(b){
  return b <= 1 ? 'en2vi' : b === 2 ? 'listen' : b === 3 ? 'vi2en' : 'type';
}
function dueList(){
  const t = dayNow();
  return Object.keys(S.cards).filter(k => BY_EN[k] && S.cards[k].d <= t)
    .sort((a,b) => S.cards[a].b - S.cards[b].b || S.cards[a].d - S.cards[b].d);
}
function newList(limit){
  const out = [];
  if(limit <= 0) return out;
  for(const w of WORDS){ if(!S.cards[w[0]]){ out.push(w[0]); if(out.length >= limit) break; } }
  return out;
}
function dailyPlan(){
  const d = today();
  const newLeft = Math.max(0, S.settings.newPerDay - d.nw);
  return { due: dueList(), fresh: newList(newLeft) };
}

/* Mục tiêu ngày = 17 từ mới. Vòng tròn chỉ đo phần này.
   Một từ tính là "thuộc" khi đã trả lời đúng trọn vẹn (không sai) ít nhất 1 lần → hộp >= 2 */
function todayGoal(){
  const t = todayStr();
  const intro = Object.entries(S.cards).filter(([k,c]) => c.i === t && BY_EN[k]);
  const availNew = WORDS.length - Object.keys(S.cards).length;
  const goal = Math.max(1, Math.min(S.settings.newPerDay, intro.length + availNew));
  const done = intro.filter(([k,c]) => c.b >= 2).length;
  return { goal, done, intro: intro.length, pct: Math.min(100, Math.round(done / goal * 100)) };
}

function buildDailyQueue(){
  const { due, fresh } = dailyPlan();
  const items = [];
  // từ mới của hôm nay xếp trước — làm xong 17 từ này là vòng tròn đầy 100%
  fresh.forEach(en => items.push({ en, kind:'quiz', mode:'en2vi', fresh:true }));
  // từ mới hôm nay chưa "thuộc" (còn ở hộp 1) → đưa lại vào để anh có cơ hội đủ 100%
  const t = todayStr();
  Object.keys(S.cards).forEach(en => {
    const c = S.cards[en];
    if(BY_EN[en] && c.i === t && c.b < 2 && !fresh.includes(en))
      items.push({ en, kind:'quiz', mode:'en2vi', fresh:true });
  });
  // sau đó mới trộn từ cũ đến hạn ôn
  const cap = S.settings.cap;                       // 0 = không giới hạn
  const dueUse = cap > 0 ? due.slice(0, cap) : due;
  dueUse.forEach(en => { if(!items.some(i => i.en === en))
    items.push({ en, kind:'quiz', mode: modeForBox(S.cards[en].b) }); });
  return items;
}

/* ===== CHẾ ĐỘ ÔN THÍCH ỨNG (không giới hạn) =====
   Đúng liên tiếp  → bơm thêm từ mới, chuỗi càng dài bơm càng nhiều
   Sai một câu     → chuỗi về 0, lùi lại làm từ cũ, và ôn lại chính từ vừa sai   */
let adapt = null;
const NEW_CHANCE = st => st >= 9 ? 0.85 : st >= 6 ? 0.78 : st >= 3 ? 0.70 : 0.60;

function nextAdaptiveItem(){
  const fresh = newList(1);
  const giveNew = () => { adapt.newAdded++; adapt.oldRun = 0;
    return { en: fresh[0], kind:'quiz', mode:'en2vi', fresh:true, bonusNew:true }; };
  const giveOld = (en, again) => { adapt.oldRun++;
    return { en, kind:'quiz', mode: modeForBox(S.cards[en].b), practice:true, again:!!again }; };

  // BẢO ĐẢM CỨNG: không bao giờ quá 3 câu từ cũ liên tiếp — từ mới luôn ra đều
  if(fresh.length && adapt.oldRun >= 3) return giveNew();

  // vừa sai → 2 câu từ cũ cho nguội, rồi ôn lại đúng từ vừa sai
  let cooling = false;
  if(adapt.cool > 0){ adapt.cool--; cooling = true; }
  else if(adapt.retry.length){
    const en = adapt.retry.shift();
    if(S.cards[en]) return giveOld(en, true);
  }

  // mặc định ưu tiên TỪ MỚI — chuỗi đúng càng dài, tỉ lệ càng cao
  if(!cooling && fresh.length && Math.random() < NEW_CHANCE(adapt.streak)) return giveNew();

  // trộn từ cũ: bốc CÓ TRỌNG SỐ trên toàn bộ từ đã học (hộp thấp nặng hơn),
  // không nhốt trong nhóm vài từ yếu nhất → hết cảnh lặp đi lặp lại
  let pool = Object.keys(S.cards).filter(k => BY_EN[k] && !adapt.recent.includes(k));
  if(!pool.length) pool = Object.keys(S.cards).filter(k => BY_EN[k]);
  if(!pool.length) return fresh.length ? giveNew() : null;
  let total = 0;
  const weights = pool.map(k => { const w = 6 - S.cards[k].b; total += w; return w; });
  let r = Math.random() * total, idx = pool.length - 1;
  for(let i = 0; i < pool.length; i++){ r -= weights[i]; if(r <= 0){ idx = i; break; } }
  return giveOld(pool[idx]);
}


/* chọn phiên tiếp theo: còn bài hôm nay thì học tiếp, xong rồi thì ôn thêm không giới hạn */
function startNext(){
  const p = dailyPlan();
  const t = todayStr();
  const unfinished = Object.keys(S.cards).filter(en => S.cards[en].i === t && S.cards[en].b < 2).length;
  if(p.fresh.length + p.due.length + unfinished > 0) startSession(null);
  else startSession('mix');
}

function buildPracticeQueue(mode){
  if(mode === 'mix') return [];                     // chế độ thích ứng tự sinh câu, không dựng sẵn
  const known = Object.keys(S.cards).filter(k => BY_EN[k]);
  if(!known.length) return [];
  return shuffle(known).slice(0, 20).map(en => ({ en, kind:'quiz', mode, practice:true }));
}

/* =========================================================
   PHIÊN HỌC
   ========================================================= */
let Q = [], qi = 0, combo = 0, locked = false, retried = {}, sessionStats = null;

function startSession(mode){
  unlockTTS();
  adapt = null;
  if(mode === 'mix'){
    if(!Object.keys(S.cards).length){ toast('Bạn cần học vài từ mới trước đã 🙂'); return; }
    adapt = { streak:0, cool:0, retry:[], recent:[], newAdded:0, oldRun:0 };
    Q = [];
    const first = nextAdaptiveItem();
    if(!first){ toast('Chưa có từ nào để ôn 🙂'); return; }
    Q.push(first);
  }else if(mode){
    Q = buildPracticeQueue(mode);
    if(!Q.length){ toast('Bạn cần học vài từ mới trước đã 🙂'); return; }
  }else{
    Q = buildDailyQueue();
    if(!Q.length){ toast('🎉 Hôm nay bạn học xong rồi!'); return; }
  }
  qi = 0; combo = 0; retried = {};
  sessionStats = { ok:0, no:0, pts:0, start:Date.now(), practice:!!mode, adaptive:!!adapt };
  go('study'); renderQ();
}

function renderQ(){
  hideFb();
  const wrap = document.getElementById('qwrap');
  if(qi >= Q.length){
    if(!adapt) return finishSession();
    const nx = nextAdaptiveItem();               // chế độ thích ứng: học tiếp không giới hạn
    if(!nx) return finishSession();
    Q.push(nx);
  }
  const it = Q[qi];
  it.tries = 0;                                   // đếm số lần trả lời sai của câu này
  if(adapt){
    adapt.recent.unshift(it.en); if(adapt.recent.length > 10) adapt.recent.pop();
    document.getElementById('sFill').style.width = Math.min(100, adapt.streak / 9 * 100) + '%';
    document.getElementById('sCnt').textContent = '🔥 ' + adapt.streak;
  }else{
    document.getElementById('sFill').style.width = (qi / Q.length * 100) + '%';
    document.getElementById('sCnt').textContent = qi + '/' + Q.length;
  }
  renderQuiz(wrap, BY_EN[it.en], it);
}

function renderQuiz(wrap, w, it){
  const m = it.mode;
  const opts = makeOptions(w, m);
  let head;

  if(m === 'en2vi'){
    head = '<div class="qbox"><div class="qword">' + esc(w[0]) + '</div>' +
           '<div class="qpos">' + posLine(w) + '</div>' +
           '<button class="spk" id="spk">🔊</button></div>';
  } else if(m === 'vi2en'){
    head = '<div class="qbox"><div class="qword vi">' + esc(w[1]) + '</div>' +
           '<div class="qpos">' + (POS[w[2]]||w[2]) + '</div></div>';
  } else if(m === 'listen'){
    head = '<div class="qbox"><div style="font-size:13px;color:var(--muted);margin-bottom:8px">Bấm loa để nghe</div>' +
           '<button class="spk big" id="spk">🔊</button>' +
           '<div class="qpos" style="margin-top:12px">Nghe rồi chọn nghĩa tiếng Việt</div></div>';
  } else {
    head = '<div class="qbox"><div class="qword vi">' + esc(w[1]) + '</div>' +
           '<div class="qpos">' + (POS[w[2]]||w[2]) + ' · ' + w[0].length + ' chữ cái</div></div>';
  }

  let body;
  if(m === 'type'){
    body = '<div class="typewrap">' +
             '<input id="ti" placeholder="Gõ từ tiếng Anh…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">' +
             '<button class="btn" style="width:auto;padding:15px 20px" id="tgo">✓</button>' +
           '</div><div class="hint" id="hint">Gợi ý: bắt đầu bằng <b>' + esc(w[0][0]) + '</b>…</div>';
  }else{
    body = '<div class="opts">' + opts.map((o,i) =>
             '<button class="opt" data-i="' + i + '"><span class="k">' + (i+1) + '</span>' + esc(o.txt) + '</button>').join('') +
           '</div><div class="hint" id="hint"></div>';
  }

  const tag = it.bonusNew ? '🎁 TỪ MỚI THƯỞNG · '
            : it.fresh    ? '✨ TỪ MỚI · '
            : it.again    ? '🔁 ÔN LẠI TỪ VỪA SAI · ' : '';
  wrap.innerHTML = '<div class="qtag' + (it.fresh ? ' newword' : '') + '">' +
                   tag + MODE_NAME[m] + '</div>' + head + body;

  const sp = document.getElementById('spk');
  if(sp) sp.onclick = () => speak(w[0]);
  if(m === 'listen' || (m === 'en2vi' && S.settings.autoSpeak)) setTimeout(() => speak(w[0]), 220);

  if(m === 'type') bindType(w, it); else bindOptions(wrap, opts, w, it);
}

/* ---------- trắc nghiệm: sai thì cho chọn lại ---------- */
function bindOptions(wrap, opts, w, it){
  wrap.querySelectorAll('.opt').forEach(btn => {
    btn.onclick = () => {
      if(locked || btn.classList.contains('bad')) return;
      const i = +btn.dataset.i;
      if(opts[i].ok){
        locked = true;
        btn.classList.add('ok');
        wrap.querySelectorAll('.opt').forEach(b => { if(b !== btn && !b.classList.contains('bad')) b.classList.add('dim'); });
        grade(it.tries === 0, w, it);
      }else{
        it.tries++;
        btn.classList.add('bad');
        btn.disabled = true;
        const h = document.getElementById('hint');
        h.innerHTML = it.tries === 1 ? '❌ Chưa đúng — thử lại nhé'
                    : '❌ Vẫn chưa đúng — còn ' + (opts.length - it.tries) + ' lựa chọn';
        h.style.color = 'var(--bad)';
        if(navigator.vibrate) navigator.vibrate(60);
      }
    };
  });
}

/* ---------- gõ chữ: sai thì cho gõ lại, gợi ý tăng dần ---------- */
function bindType(w, it){
  const inp = document.getElementById('ti'), h = document.getElementById('hint');
  const submit = () => {
    if(locked) return;
    const val = inp.value.trim();
    if(!val) return;
    if(checkTyped(val, w[0])){
      locked = true;
      inp.classList.remove('bad'); inp.classList.add('ok'); inp.blur();
      grade(it.tries === 0, w, it);
      return;
    }
    it.tries++;
    inp.classList.add('bad');
    if(navigator.vibrate) navigator.vibrate(60);
    setTimeout(() => { inp.classList.remove('bad'); inp.value = ''; inp.focus(); }, 320);
    const reveal = Math.min(w[0].length - 1, it.tries + 1);
    h.style.color = 'var(--bad)';
    if(it.tries < 3){
      h.innerHTML = '❌ Chưa đúng — gợi ý: <b>' + esc(w[0].slice(0, reveal)) +
                    '</b>' + '•'.repeat(w[0].length - reveal);
    }else{
      h.innerHTML = '❌ Chưa đúng · <button id="giveup" style="color:var(--accent);font-weight:700;text-decoration:underline">Xem đáp án</button>';
      document.getElementById('giveup').onclick = () => {
        if(locked) return;
        locked = true; inp.blur();
        grade(false, w, it);
      };
    }
  };
  document.getElementById('tgo').onclick = submit;
  inp.addEventListener('keydown', e => { if(e.key === 'Enter') submit(); });
  setTimeout(() => inp.focus(), 120);
}

/* ---------- tạo đáp án nhiễu ---------- */
function makeOptions(w, mode){
  const field = (mode === 'vi2en') ? 0 : 1;
  const pool  = WORDS.filter(x => x[0] !== w[0] && x[5] === w[5] && x[2] === w[2]);
  const pool2 = WORDS.filter(x => x[0] !== w[0] && x[2] === w[2]);
  const pool3 = WORDS.filter(x => x[0] !== w[0]);
  const picked = [], used = new Set([w[field]]);
  for(const p of [shuffle(pool.slice()), shuffle(pool2.slice()), shuffle(pool3.slice())]){
    for(const x of p){
      if(picked.length >= 3) break;
      if(used.has(x[field])) continue;
      used.add(x[field]); picked.push(x);
    }
    if(picked.length >= 3) break;
  }
  return shuffle([{ txt:w[field], ok:true }].concat(picked.map(x => ({ txt:x[field], ok:false }))));
}

/* ---------- so khớp khi gõ ---------- */
function norm(s){ return s.toLowerCase().trim().replace(/\s+/g,' ').replace(/[^a-z' ]/g,''); }
function lev(a,b){
  const m = [];
  for(let i=0;i<=b.length;i++) m[i] = [i];
  for(let j=0;j<=a.length;j++) m[0][j] = j;
  for(let i=1;i<=b.length;i++)
    for(let j=1;j<=a.length;j++)
      m[i][j] = b[i-1] === a[j-1] ? m[i-1][j-1]
              : Math.min(m[i-1][j-1]+1, m[i][j-1]+1, m[i-1][j]+1);
  return m[b.length][a.length];
}
function checkTyped(input, answer){
  const a = norm(input), b = norm(answer);
  if(a === b) return true;
  return b.length >= 5 && lev(a,b) <= 1;
}

/* ---------- chấm điểm + cập nhật Leitner ---------- */
function grade(firstTry, w, it){
  locked = true;
  const en = w[0], d = today();
  let c = S.cards[en];
  if(!c){ c = S.cards[en] = { b:1, d:dayNow(), s:0, c:0, w:0, i:todayStr() }; d.nw++; }

  c.s++; firstTry ? c.c++ : c.w++;
  if(!it.practice){                               // ôn thêm không đụng lịch; từ MỚI thì vẫn lên lịch bình thường
    c.b = firstTry ? Math.min(5, c.b + 1) : 1;    // sai lần đầu → rơi về hộp 1, mai gặp lại
    c.d = dayNow() + INTERVALS[c.b];
  }

  let pts = 0;
  if(firstTry){
    combo++;
    pts = (PTS[it.mode] || 10) + Math.min(10, (combo - 1) * 2);
    S.score += pts;
  }else{
    combo = 0;
    // từ mới hôm nay mà sai → gặp lại sau vài câu, để còn cơ hội đạt đủ 100%
    if(it.fresh && !it.requeued && !adapt)
      Q.splice(Math.min(Q.length, qi + 4), 0, Object.assign({}, it, { requeued:true, tries:0 }));
  }
  if(adapt){
    if(firstTry) adapt.streak++;
    else { adapt.streak = 0; adapt.cool = 2; if(!adapt.retry.includes(en)) adapt.retry.push(en); }
  }

  d.ans++; firstTry ? d.ok++ : d.no++; d.pts += pts;
  sessionStats[firstTry ? 'ok' : 'no']++; sessionStats.pts += pts;

  S.log.unshift({ t:Date.now(), en, m:it.mode, ok:firstTry?1:0, tries:it.tries });
  if(S.log.length > 400) S.log.length = 400;

  if(d.ans >= 10) markStudied();
  save(); refreshHome();
  showDetail(firstTry, w, pts, it.tries);
}

/* ---------- bảng chi tiết về từ (hiện sau khi trả lời đúng) ---------- */
function posLine(w){
  return (POS[w[2]]||w[2]) + (w[6] ? ' · <span style="font-family:ui-monospace,Menlo,monospace">' + esc(w[6]) + '</span>' : '');
}
function showDetail(firstTry, w, pts, tries){
  const fb = document.getElementById('fb');
  fb.className = (firstTry ? 'good' : 'wrongfb') + ' show';
  const head = firstTry
    ? '✅ Chính xác!' + (pts ? '<span class="pts">+' + pts + (combo>1 ? ' 🔥x'+combo : '') + '</span>' : '')
    : '📖 Ghi nhớ từ này nhé' + '<span class="pts" style="font-size:12.5px;color:var(--muted)">sai ' + tries + ' lần · mai ôn lại</span>';
  fb.innerHTML =
    '<div class="head">' + head + '</div>' +
    '<div class="dcard">' +
      '<div class="drow">' +
        '<div class="dmain"><b>' + esc(w[0]) + '</b>' +
          (w[6] ? '<span class="ipa">' + esc(w[6]) + '</span>' : '') +
          '<div class="dpos">' + (POS[w[2]]||w[2]) + ' · ' + esc(TOPIC_NAME[w[5]]||'') + '</div>' +
        '</div>' +
        '<button class="sp" id="fbspk">🔊</button>' +
      '</div>' +
      '<div class="dvi">' + esc(w[1]) + '</div>' +
      '<div class="dlabel">Ví dụ</div>' +
      '<div class="ex"><div class="en">' + esc(w[3]) + '</div><div class="vi">' + esc(w[4]) + '</div></div>' +
      (w[7] ? '<div class="dlabel">Cụm từ thường gặp</div><div class="dnote">' + esc(w[7]) + '</div>' : '') +
    '</div>' +
    '<button class="btn" id="fbnext">Tiếp tục →</button>';
  document.getElementById('fbspk').onclick  = () => speak(w[0]);
  document.getElementById('fbnext').onclick = () => { qi++; renderQ(); };
}
function hideFb(){
  locked = false;
  const fb = document.getElementById('fb');
  fb.className = '';
  setTimeout(() => { if(!fb.classList.contains('show')) fb.innerHTML = ''; }, 260);
}

/* ---------- kết thúc phiên ---------- */
function finishSession(){
  hideFb();
  const st = sessionStats, tot = st.ok + st.no;
  const acc = tot ? Math.round(st.ok / tot * 100) : 0;
  const secs = Math.round((Date.now() - st.start) / 1000);
  document.getElementById('sFill').style.width = '100%';
  document.getElementById('sCnt').textContent = Q.length + '/' + Q.length;
  document.getElementById('qwrap').innerHTML =
    '<div class="qbox" style="padding:30px 18px">' +
      '<div style="font-size:52px">' + (acc >= 80 ? '🎉' : acc >= 50 ? '👍' : '💪') + '</div>' +
      '<div style="font-size:21px;font-weight:800;margin:10px 0 4px">Xong phiên học!</div>' +
      '<div style="color:var(--muted);font-size:14px">' + fmtSecs(secs) + ' · ' + tot + ' lượt trả lời</div>' +
      '<div class="kpis" style="margin-top:20px">' +
        '<div class="kpi"><b style="color:var(--ok)">' + st.ok + '</b><span>Đúng</span></div>' +
        '<div class="kpi"><b style="color:var(--bad)">' + st.no + '</b><span>Sai</span></div>' +
        '<div class="kpi"><b>' + acc + '%</b><span>Chính xác</span></div>' +
        '<div class="kpi"><b style="color:var(--accent)">+' + st.pts + '</b><span>Điểm</span></div>' +
      '</div>' +
      '<div style="margin-top:16px;font-size:14px">🔥 Chuỗi hiện tại: <b>' + curStreak() + ' ngày</b>' +
        ' · 🎯 Từ mới hôm nay: <b>' + todayGoal().done + '/' + todayGoal().goal + '</b></div>' +
      (adapt && adapt.newAdded ? '<div style="margin-top:8px;font-size:14px;color:var(--accent)">🎁 Học thêm <b>' + adapt.newAdded + ' từ mới</b> nhờ trả lời đúng liên tiếp</div>' : '') +
    '</div>' +
    '<button class="btn" id="done">Về trang chính</button>' +
    '<div style="height:9px"></div>' +
    '<button class="btn ghost" id="more">Học tiếp</button>';
  document.getElementById('done').onclick = () => go('home');
  document.getElementById('more').onclick = () => startNext();
  save(); refreshHome();
}

/* =========================================================
   MÀN HÌNH
   ========================================================= */
function go(tab){
  ['home','study','words','stats','set'].forEach(t => {
    const sc = document.getElementById('sc-' + t); if(sc) sc.classList.toggle('on', t === tab);
    const br = document.getElementById('bar-' + t); if(br) br.style.display = (t === tab) ? 'flex' : 'none';
  });
  document.getElementById('bar-home').style.display = (tab === 'home') ? 'flex' : 'none';
  document.getElementById('nav').style.display = (tab === 'study') ? 'none' : 'flex';
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if(tab === 'home')  refreshHome();
  if(tab === 'words') renderWords();
  if(tab === 'stats') renderStats();
  if(tab === 'set')   renderSet();
  window.scrollTo(0,0);
}

function refreshHome(){
  const d = today(), plan = dailyPlan(), g = todayGoal();
  document.getElementById('ringFill').style.strokeDashoffset = 283 - 283 * g.pct / 100;
  document.getElementById('ringPct').textContent = g.pct + '%';
  document.getElementById('ringSub').textContent = g.done + '/' + g.goal + ' từ mới';
  document.getElementById('gNew').textContent  = g.done + ' / ' + g.goal;
  document.getElementById('gRev').textContent  = plan.due.length;
  document.getElementById('gDone').textContent = d.ans;
  document.getElementById('gAcc').textContent  = d.ans ? Math.round(d.ok / d.ans * 100) + '%' : '—';
  document.getElementById('pStreak').textContent = curStreak();
  document.getElementById('pScore').textContent  = S.score;

  const learned = Object.keys(S.cards).length;
  const master  = Object.values(S.cards).filter(c => c.b >= 4).length;
  document.getElementById('kLearned').textContent = learned;
  document.getElementById('kMaster').textContent  = master;
  document.getElementById('kTotal').textContent   = WORDS.length;
  document.getElementById('kDays').textContent    = Object.values(S.days).filter(x => x.ans > 0).length;

  const t = todayStr();
  const unfinished = Object.keys(S.cards).filter(en => S.cards[en].i === t && S.cards[en].b < 2).length;
  const remain = plan.fresh.length + plan.due.length + unfinished;
  const btn = document.getElementById('btnStart'), txt = document.getElementById('btnStartTxt');
  if(remain === 0){
    txt.textContent = learned ? '🔁 Ôn thêm không giới hạn' : 'Bắt đầu học';
    btn.classList.add('ghost');
  }else{
    txt.textContent = g.pct < 100
      ? 'Học ' + g.goal + ' từ mới hôm nay (' + g.done + '/' + g.goal + ')'
      : '🔁 Ôn ' + plan.due.length + ' từ cũ đến hạn';
    btn.classList.remove('ghost');
  }
}

/* ---------- danh sách từ ---------- */
let wGroup = '', wFilter = 0, wQuery = '';
function renderWords(){
  const groups = document.getElementById('wGroups');
  groups.innerHTML = '<button class="chip' + (!wGroup?' on':'') + '" data-g="">Tất cả</button>' +
    GROUPS.map(g => '<button class="chip' + (wGroup===g.id?' on':'') + '" data-g="' + g.id + '">' +
      g.icon + ' ' + esc(g.name) + '</button>').join('');
  groups.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    wGroup = c.dataset.g; wFilter = 0; renderWords();
  });

  const shown = wGroup ? TOPICS.filter(t => t.group === wGroup) : [];
  const chips = document.getElementById('wChips');
  chips.style.display = shown.length ? 'flex' : 'none';
  if(shown.length){
    chips.innerHTML = '<button class="chip' + (wFilter===0?' on':'') + '" data-t="0">Tất cả chủ đề</button>' +
      shown.map(t => '<button class="chip' + (wFilter===t.id?' on':'') + '" data-t="' + t.id + '">' +
        t.icon + ' ' + esc(t.name) + '</button>').join('');
    chips.querySelectorAll('.chip').forEach(c => c.onclick = () => { wFilter = +c.dataset.t; renderWords(); });
  }

  const topicOf = {}; TOPICS.forEach(t => topicOf[t.id] = t);
  const q = wQuery.toLowerCase().trim();
  const list = WORDS.filter(w =>
    (!wGroup   || (topicOf[w[5]] && topicOf[w[5]].group === wGroup)) &&
    (!wFilter  || w[5] === wFilter) &&
    (!q || w[0].toLowerCase().includes(q) || w[1].toLowerCase().includes(q)));
  document.getElementById('wCount').textContent = list.length + ' từ';

  const cap = list.slice(0, 300);                   // chỉ dựng 300 dòng cho mượt
  document.getElementById('wList').innerHTML = cap.length ? cap.map(w => {
    const c = S.cards[w[0]], b = c ? c.b : 0;
    return '<div class="wrow">' +
      '<div class="boxdot b' + b + '">' + (b ? b : '–') + '</div>' +
      '<div class="txt"><div class="en">' + esc(w[0]) +
        (w[6] ? ' <span style="font-size:11.5px;color:var(--muted);font-family:ui-monospace,Menlo,monospace">' + esc(w[6]) + '</span>' : '') +
      '</div><div class="vi">' + esc(w[1]) + '</div></div>' +
      '<button class="sp" data-w="' + esc(w[0]) + '">🔊</button></div>';
  }).join('') + (list.length > cap.length
      ? '<div class="empty" style="padding:16px">…còn ' + (list.length - cap.length) + ' từ nữa — hãy dùng ô tìm kiếm hoặc chọn chủ đề</div>' : '')
    : '<div class="empty"><span class="big">🔍</span>Không tìm thấy từ nào</div>';

  document.getElementById('wList').querySelectorAll('.sp').forEach(b =>
    b.onclick = () => { unlockTTS(); speak(b.dataset.w); });
}

/* ---------- thống kê ---------- */
function renderStats(){
  document.getElementById('stStreak').textContent = curStreak();
  document.getElementById('stBest').textContent   = S.best;
  document.getElementById('stScore').textContent  = S.score;
  const tot = Object.values(S.days).reduce((a,x) => a + x.ans, 0);
  const okk = Object.values(S.days).reduce((a,x) => a + x.ok, 0);
  document.getElementById('stAcc').textContent = tot ? Math.round(okk/tot*100) + '%' : '—';

  // biểu đồ 30 ngày
  const t = todayStr(), days = [];
  for(let i = 29; i >= 0; i--) days.push(shiftDay(t, -i));
  const max = Math.max(10, ...days.map(d => (S.days[d]||blankDay()).ans));
  document.getElementById('stBars').innerHTML = days.map(d => {
    const v = (S.days[d]||blankDay()).ans;
    const cls = d === t ? 'b today' : (v ? 'b has' : 'b');
    return '<div class="' + cls + '" style="height:' + Math.max(3, v/max*100) + '%" title="' + d + ': ' + v + ' lượt"></div>';
  }).join('');
  document.getElementById('axL').textContent = days[0].slice(5).replace('-','/');

  // phân bố hộp Leitner
  const colors = ['#e0344a','#f97316','#f59e0b','#3b82f6','#12a150'];
  const cnt = [0,0,0,0,0];
  Object.values(S.cards).forEach(c => cnt[c.b-1]++);
  const mx = Math.max(1, ...cnt);
  document.getElementById('stBoxes').innerHTML = cnt.map((n,i) =>
    '<div class="boxbar"><div class="lbl">Hộp ' + (i+1) + '</div>' +
    '<div class="tr"><div class="fl" style="width:' + (n/mx*100) + '%;background:' + colors[i] + '"></div></div>' +
    '<div class="n">' + n + '</div></div>').join('');

  // lịch sử
  const hist = Object.keys(S.days).filter(d => S.days[d].ans > 0).sort().reverse().slice(0, 30);
  document.getElementById('stHist').innerHTML = hist.length ? hist.map(d => {
    const x = S.days[d], acc = x.ans ? Math.round(x.ok/x.ans*100) : 0;
    return '<div class="hrow"><div class="d">' + (d === todayStr() ? 'Hôm nay' : d.slice(5).replace('-','/')) + '</div>' +
      '<div class="m">' + x.ans + ' lượt · ' + acc + '% đúng' + (x.nw ? ' · ' + x.nw + ' từ mới' : '') + '</div>' +
      '<div class="p">+' + x.pts + '</div></div>';
  }).join('') : '<div class="empty">Chưa có buổi học nào. Bắt đầu ngay nhé! 💪</div>';
}

/* ---------- cài đặt ---------- */
function renderSet(){
  document.getElementById('setNew').value  = S.settings.newPerDay;
  document.getElementById('setCap').value  = S.settings.cap;
  document.getElementById('setRate').value = S.settings.rate;
  document.getElementById('setAuto').classList.toggle('on', S.settings.autoSpeak);
}

/* =========================================================
   TIỆN ÍCH
   ========================================================= */
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function fmtSecs(s){ return s < 60 ? s + ' giây' : Math.floor(s/60) + ' phút ' + (s%60) + ' giây'; }
let toastT;
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400);
}

/* =========================================================
   GẮN SỰ KIỆN
   ========================================================= */
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { unlockTTS(); go(b.dataset.tab); });
document.getElementById('btnStart').onclick = () => startNext();
document.querySelectorAll('.modebtn').forEach(b => b.onclick = () => startSession(b.dataset.mode));
document.getElementById('btnQuit').onclick = () => { if(sessionStats && (sessionStats.ok+sessionStats.no)){ save(); finishSession(); } else go('home'); };
document.getElementById('wSearch').oninput = e => { wQuery = e.target.value; renderWords(); };

document.getElementById('setNew').onchange  = e => { S.settings.newPerDay = clamp(+e.target.value,1,60);  e.target.value = S.settings.newPerDay; save(); refreshHome(); };
document.getElementById('setCap').onchange  = e => { S.settings.cap       = clamp(+e.target.value,0,500); e.target.value = S.settings.cap; save(); refreshHome(); };
document.getElementById('setRate').onchange = e => { S.settings.rate      = clamp(+e.target.value,0.5,1.2); e.target.value = S.settings.rate; save(); };
document.getElementById('setAuto').onclick  = () => { S.settings.autoSpeak = !S.settings.autoSpeak; renderSet(); save(); };
document.getElementById('btnTestVoice').onclick = () => { unlockTTS(); speak('Hello, this is your English vocabulary app.'); };
function clamp(v,a,b){ return isNaN(v) ? a : Math.min(b, Math.max(a, v)); }

document.getElementById('btnExport').onclick = () => {
  const blob = new Blob([JSON.stringify(S)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tuvung-backup-' + todayStr() + '.json';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('💾 Đã tạo tệp sao lưu');
};
document.getElementById('btnImport').onclick = () => document.getElementById('fileIn').click();
document.getElementById('fileIn').onchange = e => {
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const o = JSON.parse(r.result);
      if(!o.cards) throw 0;
      S = Object.assign(structuredClone(DEFAULTS), o,
          { settings: Object.assign({}, DEFAULTS.settings, o.settings||{}) });
      save(); go('home'); toast('📂 Đã khôi phục dữ liệu');
    }catch(err){ toast('⚠️ Tệp không hợp lệ'); }
  };
  r.readAsText(f); e.target.value = '';
};
document.getElementById('btnReset').onclick = () => {
  if(!confirm('Xóa toàn bộ tiến trình học? Không thể hoàn tác.')) return;
  S = structuredClone(DEFAULTS); save(); go('home'); toast('Đã xóa toàn bộ tiến trình');
};

document.addEventListener('touchstart', unlockTTS, { once:true });
document.addEventListener('click', unlockTTS, { once:true });

/* khởi động */
go('home');
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
