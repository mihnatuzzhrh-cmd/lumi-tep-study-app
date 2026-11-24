/**
 * LUMI | TEP UNESA Study Companion
 * Backend Google Apps Script. All questions are read LIVE from Google Sheets.
 * The answer key never goes to the browser until feedback / quiz submission.
 */
const LUMI = Object.freeze({
  SHEETS: ['LISTENING', 'STRUCTURE', 'READING'],
  TEXTS: 'BANK_TEKS',
  HISTORY: 'RIWAYAT_BELAJAR',
  TIME_ZONE: 'Asia/Jakarta',
  CACHE_SECONDS: 21600,
  MAX_QUESTIONS: 50,
  HISTORY_HEADERS: [
    'Waktu', 'ID Sesi', 'Mode', 'Section', 'ID Soal',
    'Kategori Materi', 'Jawaban', 'Kunci', 'Benar', 'XP', 'Durasi (detik)'
  ]
});

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('LUMI — TEP Study Companion')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function include(name) {
  if (['Styles', 'Scripts'].indexOf(name) === -1) throw new Error('Invalid include.');
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Run once after pasting the files. Also created automatically on first visit. */
function setupLumi() {
  const ss = spreadsheet_();
  questionBank_(); // Validate all four source sheets before creating a history sheet.
  historySheet_(ss);
  return { success: true, spreadsheet: ss.getName(), url: ss.getUrl() };
}

function getBootstrapData() {
  const ss = spreadsheet_();
  const bank = questionBank_(ss);
  historySheet_(ss);
  const totals = { ALL: bank.questions.length, LISTENING: 0, STRUCTURE: 0, READING: 0 };
  const categories = { ALL: {}, LISTENING: {}, STRUCTURE: {}, READING: {} };
  bank.questions.forEach(function (q) {
    totals[q.section]++;
    const cat = q.category || 'Other';
    categories.ALL[cat] = (categories.ALL[cat] || 0) + 1;
    categories[q.section][cat] = (categories[q.section][cat] || 0) + 1;
  });
  return {
    appName: 'LUMI',
    displayName: PropertiesService.getScriptProperties().getProperty('DISPLAY_NAME') || 'Learner',
    totals: totals,
    categories: categories,
    textCount: Object.keys(bank.texts).length,
    stats: statistics_(readHistory_(ss))
  };
}

/**
 * Starts a quiz. No keys/translations are exposed to the client beforehand.
 * Input: { section, category, count, mode, onlyMistakes }
 */
function getQuiz(request) {
  request = request || {};
  const ss = spreadsheet_();
  const bank = questionBank_(ss);
  const section = String(request.section || 'ALL').toUpperCase();
  const mode = request.mode === 'mock' ? 'mock' : 'practice';
  const category = String(request.category || 'ALL');
  if (['ALL'].concat(LUMI.SHEETS).indexOf(section) === -1) {
    throw new Error('Section tidak dikenali.');
  }
  const count = Math.max(1, Math.min(LUMI.MAX_QUESTIONS, Number(request.count) || 10));
  let eligible = bank.questions.filter(function (q) {
    return (section === 'ALL' || q.section === section) &&
      (category === 'ALL' || q.category === category);
  });
  if (request.onlyMistakes === true) {
    const last = latestAnswers_(readHistory_(ss));
    eligible = eligible.filter(function (q) { return last[q.id] && !last[q.id].correct; });
  }
  if (!eligible.length) {
    throw new Error(request.onlyMistakes ?
      'Belum ada soal salah untuk filter ini. Coba latihan biasa dahulu.' :
      'Tidak ada soal yang cocok. Pastikan bank soal dan filter sudah terisi.');
  }
  const selected = pickQuestions_(eligible, Math.min(count, eligible.length));
  const sessionId = Utilities.getUuid();
  const keys = {};
  selected.forEach(function (q) { keys[q.id] = q.key; });
  const session = {
    ids: selected.map(function (q) { return q.id; }),
    keys: keys,
    mode: mode,
    section: section,
    category: category,
    created: Date.now()
  };
  CacheService.getScriptCache().put('lumi:' + sessionId, JSON.stringify(session), LUMI.CACHE_SECONDS);
  return {
    sessionId: sessionId,
    mode: mode,
    questions: selected.map(function (q) { return publicQuestion_(q, bank.texts); }),
    durationLimitSec: mode === 'mock' ? selected.length * 60 : null
  };
}

/** For Practice Mode: reveal feedback once a question has been answered. */
function checkAnswer(sessionId, questionId, answer) {
  const session = session_(sessionId);
  if (session.mode !== 'practice') throw new Error('Pembahasan hanya tersedia setelah Mock Test selesai.');
  const id = String(questionId || '');
  if (session.ids.indexOf(id) < 0) throw new Error('Soal tidak termasuk sesi ini.');
  const choice = String(answer || '').toUpperCase();
  if ('ABCD'.indexOf(choice) < 0 || choice.length !== 1) throw new Error('Pilih jawaban A–D dahulu.');
  const bank = questionBank_();
  const q = bank.byId[id];
  return feedback_(q, session.keys[id], choice, bank.texts);
}

/** Submit exactly one session. Scores are calculated on server using saved keys. */
function submitQuiz(payload) {
  payload = payload || {};
  const sessionId = String(payload.sessionId || '');
  const session = session_(sessionId);
  const submitted = {};
  (Array.isArray(payload.answers) ? payload.answers : []).forEach(function (a) {
    const id = String(a && a.id || '');
    const ans = String(a && a.answer || '').toUpperCase();
    if (session.ids.indexOf(id) >= 0 && /^[ABCD]$/.test(ans)) submitted[id] = ans;
  });
  const bank = questionBank_();
  const now = new Date();
  const duration = Math.max(0, Math.min(7200, Math.round(Number(payload.durationSec) || 0)));
  const resultRows = [];
  let correct = 0;
  const feedbacks = [];
  session.ids.forEach(function (id) {
    const q = bank.byId[id] || {
      id: id, section: session.section, category: session.category,
      question: '(Soal telah dihapus dari Sheets)', choices: ['','','',''],
      translation: '', explanation: '', textId: ''
    };
    const ans = submitted[id] || '';
    const key = session.keys[id];
    const right = ans === key;
    if (right) correct++;
    const fb = feedback_(q, key, ans, bank.texts);
    fb.section = q.section;
    fb.category = q.category;
    fb.question = q.question;
    fb.choices = q.choices;
    fb.textId = q.textId;
    feedbacks.push(fb);
    resultRows.push([now, sessionId, session.mode, q.section, id, q.category, ans, key, right, right ? 10 : 0, duration]);
  });
  const accuracy = session.ids.length ? Math.round(correct / session.ids.length * 100) : 0;
  const bonus = accuracy >= 80 && session.ids.length >= 5 ? 20 : 0;
  if (bonus && resultRows.length) resultRows[0][9] += bonus;
  const ss = spreadsheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // A second submission of the same session must not create duplicate history.
    const history = historySheet_(ss);
    if (sessionAlreadySaved_(history, sessionId)) throw new Error('Sesi ini sudah pernah disimpan.');
    history.getRange(history.getLastRow() + 1, 1, resultRows.length, LUMI.HISTORY_HEADERS.length)
      .setValues(resultRows);
    SpreadsheetApp.flush();
    CacheService.getScriptCache().remove('lumi:' + sessionId);
  } finally {
    lock.releaseLock();
  }
  return {
    sessionId: sessionId,
    mode: session.mode,
    total: session.ids.length,
    correct: correct,
    accuracy: accuracy,
    earnedXP: correct * 10 + bonus,
    durationSec: duration,
    feedback: feedbacks,
    stats: statistics_(readHistory_(ss))
  };
}

function getProgressData() {
  return statistics_(readHistory_(spreadsheet_()));
}

// --- Private helpers -------------------------------------------------------

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet belum terhubung. Buka file Google Sheets > Extensions > Apps Script, atau set Script Property SPREADSHEET_ID.');
  return ss;
}

function table_(ss, sheetName, requiredHeaders) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" belum ada. Jangan mengganti nama empat sheet utama.');
  if (sheet.getLastRow() < 1) throw new Error('Sheet "' + sheetName + '" belum memiliki header.');
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0].map(function (h) { return String(h).trim(); });
  const indices = {};
  requiredHeaders.forEach(function (h) {
    const index = headers.indexOf(h);
    if (index < 0) throw new Error('Kolom "' + h + '" tidak ditemukan di sheet ' + sheetName + '.');
    indices[h] = index;
  });
  return data.slice(1).map(function (cells) {
    const out = {};
    requiredHeaders.forEach(function (h) { out[h] = String(cells[indices[h]] || '').trim(); });
    return out;
  });
}

function questionBank_(existingSS) {
  const ss = existingSS || spreadsheet_();
  const textRows = table_(ss, LUMI.TEXTS, [
    'ID Teks', 'Section', 'Jenis Teks', 'Judul / Topik', 'Teks Asli (EN)', 'Terjemahan Teks (ID)'
  ]);
  const texts = {};
  textRows.forEach(function (t) {
    if (!t['ID Teks']) return;
    texts[t['ID Teks']] = {
      id: t['ID Teks'], section: t.Section, kind: t['Jenis Teks'],
      title: t['Judul / Topik'], en: t['Teks Asli (EN)'], idTranslation: t['Terjemahan Teks (ID)']
    };
  });
  const questions = [];
  const byId = {};
  LUMI.SHEETS.forEach(function (section) {
    const required = section === 'LISTENING' ? [
      'ID Soal', 'Bagian', 'Kategori Materi', 'ID Teks', 'Pertanyaan (EN)',
      'Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Kunci', 'Terjemahan Soal (ID)', 'Pembahasan (ID)'
    ] : section === 'READING' ? [
      'ID Soal', 'Kategori Materi', 'ID Teks', 'Pertanyaan (EN)',
      'Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Kunci', 'Terjemahan Soal (ID)', 'Pembahasan (ID)'
    ] : [
      'ID Soal', 'Jenis Soal', 'Kategori Materi', 'Soal / Kalimat (EN)',
      'Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Kunci', 'Terjemahan Soal (ID)', 'Pembahasan (ID)'
    ];
    const rows = table_(ss, section, required);
    rows.forEach(function (r) {
      const id = r['ID Soal'];
      if (!id) return;
      const key = String(r.Kunci || '').toUpperCase();
      const textId = r['ID Teks'] || '';
      const question = r['Pertanyaan (EN)'] || r['Soal / Kalimat (EN)'] || '';
      const choices = ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'].map(function (h) { return r[h]; });
      // Skip unfinished rows: the sheet may be edited while the app is in use.
      if (!question || !/^[ABCD]$/.test(key) || choices.some(function (c) { return !c; })) return;
      if (textId && !texts[textId]) return;
      if (byId[id]) throw new Error('Ada ID Soal ganda: ' + id + '. Setiap ID harus unik.');
      const q = {
        id: id, section: section, kind: r['Bagian'] || r['Jenis Soal'] || '',
        category: r['Kategori Materi'] || 'Other', textId: textId,
        question: question, choices: choices, key: key,
        translation: r['Terjemahan Soal (ID)'], explanation: r['Pembahasan (ID)']
      };
      questions.push(q);
      byId[id] = q;
    });
  });
  return { questions: questions, byId: byId, texts: texts };
}

function publicQuestion_(q, texts) {
  const txt = texts[q.textId];
  return {
    id: q.id, section: q.section, kind: q.kind, category: q.category,
    textId: q.textId, question: q.question, choices: q.choices,
    source: txt ? { title: txt.title, kind: txt.kind, en: txt.en } : null
  };
}

function feedback_(q, key, answer, texts) {
  const txt = texts[q.textId];
  return {
    id: q.id, answer: answer, key: key, correct: answer === key,
    translation: q.translation || '', explanation: q.explanation || '',
    sourceTranslation: txt ? txt.idTranslation : ''
  };
}

function pickQuestions_(eligible, count) {
  // Shuffle by text groups so multiple Reading questions can reuse one passage consecutively.
  const groups = {};
  eligible.forEach(function (q) {
    const group = q.section === 'READING' && q.textId ? 'READ:' + q.textId : q.id;
    if (!groups[group]) groups[group] = [];
    groups[group].push(q);
  });
  const shuffledGroups = shuffle_(Object.keys(groups));
  const out = [];
  shuffledGroups.forEach(function (g) {
    shuffle_(groups[g]).forEach(function (q) { if (out.length < count) out.push(q); });
  });
  return out;
}

function shuffle_(items) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function session_(id) {
  if (!/^[0-9a-fA-F-]{30,40}$/.test(String(id || ''))) throw new Error('Sesi tidak valid.');
  const json = CacheService.getScriptCache().get('lumi:' + id);
  if (!json) throw new Error('Sesi sudah kedaluwarsa atau sudah disimpan. Mulai latihan baru ya.');
  return JSON.parse(json);
}

function historySheet_(ss) {
  let sheet = ss.getSheetByName(LUMI.HISTORY);
  if (!sheet) {
    sheet = ss.insertSheet(LUMI.HISTORY);
    sheet.getRange(1, 1, 1, LUMI.HISTORY_HEADERS.length).setValues([LUMI.HISTORY_HEADERS]);
    sheet.getRange(1, 1, 1, LUMI.HISTORY_HEADERS.length)
      .setBackground('#1C284A').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 175);
    sheet.setColumnWidth(5, 135);
    sheet.setColumnWidth(6, 180);
    sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  }
  return sheet;
}

function readHistory_(ss) {
  const sheet = historySheet_(ss);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, LUMI.HISTORY_HEADERS.length).getValues()
    .filter(function (r) { return r[1] && r[4]; });
}

function sessionAlreadySaved_(sheet, id) {
  if (sheet.getLastRow() < 2) return false;
  const cell = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1)
    .createTextFinder(id).matchEntireCell(true).findNext();
  return !!cell;
}

function latestAnswers_(rows) {
  const latest = {};
  rows.forEach(function (r) {
    const id = String(r[4]);
    latest[id] = { correct: r[8] === true || String(r[8]).toUpperCase() === 'TRUE' };
  });
  return latest;
}

function statistics_(rows) {
  const sections = {};
  LUMI.SHEETS.forEach(function (s) { sections[s] = { attempts: 0, correct: 0, accuracy: 0 }; });
  const dates = {};
  const sessions = {};
  let correctCount = 0;
  let xp = 0;
  rows.forEach(function (r) {
    const section = String(r[3] || '').toUpperCase();
    const right = r[8] === true || String(r[8]).toUpperCase() === 'TRUE';
    const date = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (!isNaN(date.getTime())) dates[Utilities.formatDate(date, LUMI.TIME_ZONE, 'yyyy-MM-dd')] = true;
    if (r[1]) sessions[String(r[1])] = true;
    xp += Number(r[9]) || 0;
    if (right) correctCount++;
    if (sections[section]) {
      sections[section].attempts++;
      if (right) sections[section].correct++;
    }
  });
  LUMI.SHEETS.forEach(function (s) {
    const x = sections[s];
    x.accuracy = x.attempts ? Math.round(x.correct / x.attempts * 100) : 0;
  });
  const today = new Date();
  const todayKey = Utilities.formatDate(today, LUMI.TIME_ZONE, 'yyyy-MM-dd');
  let startDay = new Date(today.getTime());
  if (!dates[todayKey]) startDay.setDate(startDay.getDate() - 1);
  let streak = 0;
  for (let i = 0; i < 3660; i++) {
    const key = Utilities.formatDate(startDay, LUMI.TIME_ZONE, 'yyyy-MM-dd');
    if (!dates[key]) break;
    streak++;
    startDay.setDate(startDay.getDate() - 1);
  }
  // Weekly target starts Monday in Jakarta.
  const dayOfWeek = Number(Utilities.formatDate(today, LUMI.TIME_ZONE, 'u'));
  const weekKeys = [];
  for (let d = dayOfWeek - 1; d >= 0; d--) {
    const day = new Date(today.getTime()); day.setDate(day.getDate() - d);
    weekKeys.push(Utilities.formatDate(day, LUMI.TIME_ZONE, 'yyyy-MM-dd'));
  }
  const weeklyDays = weekKeys.filter(function (k) { return !!dates[k]; }).length;
  const level = Math.floor(xp / 500) + 1;
  const badges = [];
  if (rows.length >= 1) badges.push({ icon: 'spark', title: 'First Step', subtitle: 'Latihan pertamamu' });
  if (streak >= 3) badges.push({ icon: 'flame', title: 'Streak Starter', subtitle: streak + ' hari konsisten' });
  if (streak >= 7) badges.push({ icon: 'fire', title: 'Streak Master', subtitle: '7 hari berturut-turut' });
  if (correctCount >= 50) badges.push({ icon: 'star', title: 'XP Collector', subtitle: '50 jawaban benar' });
  if (correctCount >= 150) badges.push({ icon: 'trophy', title: 'Practice Pro', subtitle: '150 jawaban benar' });
  const latest = latestAnswers_(rows);
  const wrongCount = Object.keys(latest).filter(function (id) { return !latest[id].correct; }).length;
  return {
    answered: rows.length,
    correct: correctCount,
    accuracy: rows.length ? Math.round(correctCount / rows.length * 100) : 0,
    sessions: Object.keys(sessions).length,
    xp: xp,
    level: level,
    levelXP: xp % 500,
    levelTarget: 500,
    streak: streak,
    weeklyDays: weeklyDays,
    weeklyTarget: 5,
    wrongCount: wrongCount,
    sections: sections,
    badges: badges
  };
}
