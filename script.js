// ============================================================
// muttest.uz — Free 60-talik Test Platformasi
// Toza, animatsiyasiz, papersketch
// ============================================================

'use strict';

// ===== STATE =====
let currentUser  = '';
let bank         = { musiqa_nazariyasi: [], cholgu_ijrochiligi: [], vokal_ijrochiligi: [], metodika_repertuar: [] };
let currentTest  = [];
let currentSubj  = '';
let currentIndex = 0;
let answers      = []; // null | { selected: idx }
let history      = JSON.parse(localStorage.getItem('mtt_history') || '[]');
let bankLoaded   = false;

// ===== HELPERS =====
function sanitize(t) {
    if (typeof t !== 'string') return '';
    return t.replace(/\n/g,' ').replace(/\s+/g,' ').trim()
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function $(id) { return document.getElementById(id); }
function show(id) { const e=$(id); if(e){ e.style.display=''; e.classList.add('active'); } }
function hide(id) { const e=$(id); if(e){ e.style.display='none'; e.classList.remove('active'); } }

function switchScreen(from, to) {
    const fromEl = $(from);
    const toEl   = $(to);
    if (fromEl) { fromEl.style.display = 'none'; fromEl.classList.remove('active'); }
    if (toEl)   { toEl.style.display   = 'block'; toEl.classList.add('active'); }
}

// ===== LOAD DATA =====
async function loadBank() {
    if (bankLoaded) return;
    const files = {
        musiqa_nazariyasi:  'musiqa_nazariyasi.json',
        cholgu_ijrochiligi: 'cholgu_ijrochiligi.json',
        vokal_ijrochiligi:  'vokal_ijrochiligi.json',
        metodika_repertuar: 'metodika_repertuar.json',
    };
    for (const [key, fname] of Object.entries(files)) {
        try {
            const r = await fetch(fname);
            const data = await r.json();
            if (!Array.isArray(data)) continue;
            bank[key] = data.filter(q => {
                return q && typeof q.q === 'string' && q.q.trim()
                    && Array.isArray(q.options) && q.options.length >= 3
                    && typeof q.answer === 'number'
                    && q.answer >= 0 && q.answer < q.options.length;
            }).map(q => ({
                q:       sanitize(q.q),
                options: q.options.map(o => sanitize(String(o || ''))),
                answer:  q.answer,
                subj:    key
            }));
        } catch(e) {
            console.warn('JSON yuklanmadi:', fname);
        }
    }
    bankLoaded = true;
}

// ===== AUTH =====
async function startSession() {
    const name = $('user-name-input').value.trim();
    if (!name || name.length < 2) {
        $('user-name-input').focus();
        $('user-name-input').style.borderColor = '#c0392b';
        setTimeout(() => { $('user-name-input').style.borderColor = ''; }, 1500);
        return;
    }
    currentUser = name;
    localStorage.setItem('mtt_user', name);

    // Show loading on button
    const btn = document.querySelector('.login-card .primary-btn');
    if (btn) { btn.textContent = 'Yuklanmoqda...'; btn.disabled = true; }

    await loadBank();

    if (btn) { btn.textContent = 'Boshlash →'; btn.disabled = false; }

    switchScreen('login-screen', 'dashboard-screen');
    renderDashboard();
}

function logout() {
    currentUser = '';
    localStorage.removeItem('mtt_user');
    $('user-name-input').value = '';
    switchScreen('dashboard-screen', 'login-screen');
}

// ===== DASHBOARD =====
function getGreeting() {
    const h = new Date().getHours();
    if (h >= 6 && h < 12)  return 'Xayrli tong';
    if (h >= 12 && h < 18) return 'Xayrli kun';
    if (h >= 18 && h < 22) return 'Xayrli kech';
    return 'Xayrli tun';
}

function renderDashboard() {
    $('greeting-text').textContent  = getGreeting();
    $('display-name').textContent   = currentUser;

    // Stats
    const total = history.length;
    $('stat-total-tests').textContent = total;
    if (total > 0) {
        const avg  = Math.round(history.reduce((s,h) => s + h.pct, 0) / total);
        const best = Math.max(...history.map(h => h.pct));
        $('stat-avg-score').textContent  = avg + '%';
        $('stat-best-score').textContent = best + '%';
    } else {
        $('stat-avg-score').textContent  = '—';
        $('stat-best-score').textContent = '—';
    }

    renderHistory();
}

function renderHistory() {
    const recent = history.slice(-5).reverse();
    if (recent.length === 0) {
        $('history-section').style.display = 'none';
        return;
    }
    $('history-section').style.display = 'block';
    $('history-list').innerHTML = recent.map(h => {
        const cls = h.pct >= 75 ? 'good' : h.pct >= 50 ? 'ok' : 'bad';
        return `<div class="history-item">
            <div>
                <div style="font-weight:600;font-size:0.9rem;">${h.subj}</div>
                <div style="font-size:0.75rem;color:#888;">${h.date}</div>
            </div>
            <div class="history-pct ${cls}">${h.pct}%</div>
        </div>`;
    }).join('');
}

// ===== START TEST =====
const SUBJ_NAMES = {
    musiqa_nazariyasi:  'Musiqa nazariyasi',
    cholgu_ijrochiligi: "Cholg'u ijrochiligi",
    vokal_ijrochiligi:  'Vokal ijrochiligi',
    metodika_repertuar: 'Metodika',
    aralash:            'Aralash Test',
};

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length-1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i+1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function startTest(subj) {
    currentSubj = subj;
    let pool = [];

    if (subj === 'aralash') {
        const keys = ['musiqa_nazariyasi','cholgu_ijrochiligi','vokal_ijrochiligi','metodika_repertuar'];
        for (const k of keys) {
            pool = pool.concat(shuffle(bank[k]).slice(0, 15));
        }
        pool = shuffle(pool);
    } else {
        pool = shuffle(bank[subj]).slice(0, 60);
    }

    if (pool.length === 0) {
        alert('Ma\'lumotlar yuklanmadi. Sahifani yangilang.');
        return;
    }

    currentTest  = pool;
    currentIndex = 0;
    answers      = new Array(pool.length).fill(null);

    switchScreen('dashboard-screen', 'test-screen');
    $('finish-btn').style.display = 'none';
    renderQuestion();
    renderMiniMap();
}

// ===== RENDER QUESTION =====
function renderQuestion() {
    const q   = currentTest[currentIndex];
    const ans = answers[currentIndex];
    const tot = currentTest.length;

    // Counter & progress
    $('q-current').textContent  = currentIndex + 1;
    $('q-total').textContent    = tot;
    $('q-badge').textContent    = currentIndex + 1;
    $('progress-bar').style.width = ((currentIndex + 1) / tot * 100) + '%';

    // Question text
    $('question-text').innerHTML = q.q;

    // Options
    const area = $('options-area');
    area.innerHTML = '';
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `<b>${String.fromCharCode(65+idx)}.</b> ${opt}`;
        btn.disabled  = ans !== null;

        if (ans !== null) {
            if (idx === q.answer) {
                btn.classList.add('correct');
            } else if (idx === ans.selected) {
                btn.classList.add('wrong');
            }
        }
        if (ans !== null && idx === ans.selected && ans.selected === q.answer) {
            btn.classList.add('correct'); btn.classList.remove('wrong');
        }

        btn.addEventListener('click', () => selectAnswer(idx));
        area.appendChild(btn);
    });

    // Nav buttons
    $('prev-btn').disabled = (currentIndex === 0);
    $('next-btn').disabled = (currentIndex === tot - 1);

    // Finish button
    const allAnswered = answers.every(a => a !== null);
    $('finish-btn').style.display = allAnswered ? 'block' : 'none';

    updateMiniMap();
}

function selectAnswer(optIdx) {
    if (answers[currentIndex] !== null) return;
    answers[currentIndex] = { selected: optIdx };
    renderQuestion();
    renderMiniMap();

    // Auto-advance after 600ms if not last question
    if (currentIndex < currentTest.length - 1) {
        setTimeout(() => {
            currentIndex++;
            renderQuestion();
            updateMiniMap();
        }, 600);
    }
}

function goTo(delta) {
    const next = currentIndex + delta;
    if (next < 0 || next >= currentTest.length) return;
    currentIndex = next;
    renderQuestion();
    updateMiniMap();
}

// ===== MINI MAP =====
function renderMiniMap() {
    const map = $('mini-map');
    map.innerHTML = '';
    currentTest.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'map-dot';
        dot.textContent = i + 1;
        if (i === currentIndex) dot.classList.add('active');
        else if (answers[i] !== null) {
            const isCorrect = answers[i].selected === currentTest[i].answer;
            dot.classList.add(isCorrect ? 'correct' : 'wrong');
        }
        dot.addEventListener('click', () => {
            currentIndex = i;
            renderQuestion();
            updateMiniMap();
        });
        map.appendChild(dot);
    });
}

function updateMiniMap() {
    const dots = $('mini-map').querySelectorAll('.map-dot');
    dots.forEach((dot, i) => {
        dot.className = 'map-dot';
        if (i === currentIndex) {
            dot.classList.add('active');
        } else if (answers[i] !== null) {
            const isCorrect = answers[i].selected === currentTest[i].answer;
            dot.classList.add(isCorrect ? 'correct' : 'wrong');
        }
    });
}

// ===== EXIT =====
function exitTest() {
    if (!confirm('Testdan chiqishni xohlaysizmi? Natijalar saqlanmaydi.')) return;
    switchScreen('test-screen', 'dashboard-screen');
}

// ===== RESULTS =====
function showResults() {
    const total   = currentTest.length;
    const correct = answers.filter((a, i) => a !== null && a.selected === currentTest[i].answer).length;
    const pct     = Math.round(correct / total * 100);

    // Save to history
    const entry = {
        subj:  SUBJ_NAMES[currentSubj] || currentSubj,
        pct,
        score: `${correct}/${total}`,
        date:  new Date().toLocaleDateString('uz', {day:'2-digit', month:'2-digit', year:'numeric'}),
    };
    history.push(entry);
    if (history.length > 30) history.shift();
    localStorage.setItem('mtt_history', JSON.stringify(history));

    // Result card
    let icon, title;
    if (pct >= 85)      { icon = '🏆'; title = 'Ajoyib natija!'; }
    else if (pct >= 70) { icon = '👍'; title = 'Yaxshi natija!'; }
    else if (pct >= 50) { icon = '📚'; title = 'Qoniqarli natija'; }
    else                { icon = '💪'; title = 'Davom eting!'; }

    $('result-icon').textContent  = icon;
    $('result-title').textContent = title;
    $('result-score').textContent = `${correct} / ${total}`;
    $('result-pct').textContent   = pct + '%';
    $('result-pct').style.color   = pct >= 75 ? 'var(--correct)' : pct >= 50 ? 'var(--accent)' : 'var(--wrong)';

    // Bars by subject (aralash uchun)
    const bars = $('result-bars');
    bars.innerHTML = '';
    if (currentSubj === 'aralash') {
        const subjKeys = ['musiqa_nazariyasi','cholgu_ijrochiligi','vokal_ijrochiligi','metodika_repertuar'];
        subjKeys.forEach(k => {
            const qs     = currentTest.filter(q => q.subj === k);
            if (qs.length === 0) return;
            const idxs   = qs.map(q => currentTest.indexOf(q));
            const c      = idxs.filter(i => answers[i]?.selected === currentTest[i].answer).length;
            const p      = Math.round(c / qs.length * 100);
            const label  = SUBJ_NAMES[k].split(' ')[0];
            bars.innerHTML += `<div class="res-bar-row">
                <span class="res-bar-label">${label}</span>
                <div class="res-bar-outer"><div class="res-bar-fill" style="width:${p}%"></div></div>
                <span class="res-bar-num">${p}%</span>
            </div>`;
        });
    } else {
        bars.innerHTML = `<div class="res-bar-row">
            <span class="res-bar-label">Natija</span>
            <div class="res-bar-outer"><div class="res-bar-fill" style="width:${pct}%"></div></div>
            <span class="res-bar-num">${pct}%</span>
        </div>`;
    }

    switchScreen('test-screen', 'result-screen');
}

function backToDash() {
    switchScreen('result-screen', 'dashboard-screen');
    renderDashboard();
}

function restartTest() {
    startTest(currentSubj);
}

// ===== INIT =====
window.addEventListener('DOMContentLoaded', async () => {
    // Restore session
    const saved = localStorage.getItem('mtt_user');
    if (saved) {
        currentUser = saved;
        await loadBank();
        switchScreen('login-screen', 'dashboard-screen');
        renderDashboard();
    }
});
