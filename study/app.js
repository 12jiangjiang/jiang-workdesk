/**
 * 云南四年级小学生学习追踪 App
 * 功能: 今日学习 / 学习统计 / 试卷记录 / 错题本
 * 数据存储: localStorage (key: yunnan-study-tracker)
 */

const STORAGE_KEY = 'yunnan-study-tracker';
const SUBJECTS = ['语文', '数学', '英语', '科学', '道法'];
const SUBJECT_COLORS = {
  '语文': '#2196F3',
  '数学': '#f56565',
  '英语': '#00A870',
  '科学': '#9C27B0',
  '道法': '#FF9800',
  '其他': '#999',
};
const SUBJECT_EMOJI = {
  '语文': '📕', '数学': '📘', '英语': '📗', '科学': '🔬', '道法': '🌟', '其他': '📌',
};

const DEFAULT_TASKS = [
  { id: 't1', text: '朗读语文课文 20 分钟', subject: '语文', done: false },
  { id: 't2', text: '数学口算练习 50 道', subject: '数学', done: false },
  { id: 't3', text: '英语单词背诵 20 个', subject: '英语', done: false },
  { id: 't4', text: '课外阅读 30 分钟', subject: '其他', done: false },
  { id: 't5', text: '体育运动 1 小时', subject: '其他', done: false },
];

let state = {
  tasks: [],
  customTasks: [],
  history: {},
  papers: [],
  mistakes: [],
  currentDate: null,
};

let currentView = 'today';
let paperFilter = 'all';
let mistakeFilter = 'all';

/* ==================== 工具函数 ==================== */

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateCN(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${week}`;
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
}

function uid() {
  return 'id_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

/* ==================== 数据管理 ==================== */

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      state.history = data.history || {};
      state.papers = data.papers || [];
      state.mistakes = data.mistakes || [];
    } catch (e) { console.error('load error', e); }
  }
  ensureTodayTasks();
}

function saveData() {
  const toSave = {
    history: state.history,
    papers: state.papers,
    mistakes: state.mistakes,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

function ensureTodayTasks() {
  const today = todayStr();
  if (state.currentDate !== today) {
    state.currentDate = today;
    state.customTasks = [];
    state.tasks = DEFAULT_TASKS.map(t => ({ ...t, done: false }));
  }
  // 合并自定义任务
  const allTasks = [...state.tasks, ...state.customTasks];
  renderTasks(allTasks);
  updateProgress(allTasks);
  saveTodayHistory(allTasks);
}

function saveTodayHistory(tasks) {
  const today = todayStr();
  const done = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  state.history[today] = { done, total, pct, subjects: getSubjectBreakdown(tasks) };
  saveData();
}

function getSubjectBreakdown(tasks) {
  const breakdown = {};
  tasks.forEach(t => {
    if (!breakdown[t.subject]) breakdown[t.subject] = { done: 0, total: 0 };
    breakdown[t.subject].total++;
    if (t.done) breakdown[t.subject].done++;
  });
  return breakdown;
}

/* ==================== 今日学习 ==================== */

function renderTasks(tasks) {
  const list = document.getElementById('taskList');
  if (tasks.length === 0) {
    list.innerHTML = '<div class="empty-state">今天还没有任务，添加一个吧 ✨</div>';
    return;
  }
  list.innerHTML = tasks.map(t => `
    <div class="task-item ${t.done ? 'done' : ''}" data-id="${t.id}">
      <div class="task-checkbox" onclick="toggleTask('${t.id}')">${t.done ? '✓' : ''}</div>
      <div class="task-info">
        <span class="task-text">${t.text}</span>
        <span class="task-subject-tag subject-${t.subject}">${SUBJECT_EMOJI[t.subject] || ''} ${t.subject}</span>
      </div>
      <button class="task-delete" onclick="deleteTask('${t.id}')" aria-label="删除">✕</button>
    </div>
  `).join('');
}

function toggleTask(id) {
  const all = [...state.tasks, ...state.customTasks];
  const t = all.find(x => x.id === id);
  if (t) {
    t.done = !t.done;
    renderTasks(all);
    updateProgress(all);
    saveTodayHistory(all);
  }
}

function deleteTask(id) {
  state.customTasks = state.customTasks.filter(t => t.id !== id);
  state.tasks = state.tasks.filter(t => t.id !== id);
  const all = [...state.tasks, ...state.customTasks];
  renderTasks(all);
  updateProgress(all);
  saveTodayHistory(all);
  showToast('已删除');
}

function addTask(subject, text) {
  const task = { id: uid(), text, subject, done: false };
  state.customTasks.push(task);
  const all = [...state.tasks, ...state.customTasks];
  renderTasks(all);
  updateProgress(all);
  saveTodayHistory(all);
  showToast('已添加任务');
}

function updateProgress(tasks) {
  const done = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('doneCount').textContent = done;
  document.getElementById('totalCount').textContent = total;
  document.getElementById('todayProgressText').textContent = pct + '%';

  const ring = document.getElementById('todayProgressRing');
  const circumference = 2 * Math.PI * 34;
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;

  const hint = document.getElementById('progressHint');
  if (pct === 100) hint.textContent = '太棒了！今天的任务全部完成啦！🎉';
  else if (pct >= 60) hint.textContent = '快完成了，再接再厉！💪';
  else if (pct >= 30) hint.textContent = '已经有进展了，继续加油！📚';
  else hint.textContent = '加油完成今天的任务吧！🌱';
}

/* ==================== 学习统计 ==================== */

function renderStats() {
  const history = state.history;
  const dates = Object.keys(history).sort();

  // 总天数
  document.getElementById('totalDays').textContent = dates.length;

  // 连续天数
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (history[ds] && history[ds].total > 0) {
      streak++;
    } else {
      if (i > 0) break;
    }
  }
  document.getElementById('streakCount').textContent = streak;

  const streakBadge = document.getElementById('streakBadge');
  if (streak >= 2) {
    streakBadge.style.display = 'flex';
    document.getElementById('streakDays').textContent = streak;
  } else {
    streakBadge.style.display = 'none';
  }

  // 总完成任务数
  const totalDone = dates.reduce((s, d) => s + (history[d].done || 0), 0);
  document.getElementById('totalDone').textContent = totalDone;

  // 近7天完成率柱状图
  renderWeeklyChart(history);

  // 各科完成情况
  renderSubjectStats(history, dates);
}

function renderWeeklyChart(history) {
  const chart = document.getElementById('weeklyChart');
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const data = history[ds];
    const pct = data && data.total > 0 ? data.pct : 0;
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    const isToday = i === 0;
    days.push({ pct, weekday, isToday, hasData: !!data });
  }
  chart.innerHTML = days.map(d => `
    <div class="weekly-bar-wrap">
      ${d.hasData ? `<span class="weekly-bar-pct">${d.pct}%</span>` : '<span class="weekly-bar-pct" style="opacity:0.3">-</span>'}
      <div class="weekly-bar ${d.isToday ? 'today' : ''}" style="height: ${Math.max(d.pct, 3)}%"></div>
      <span class="weekly-bar-label">${d.weekday}</span>
    </div>
  `).join('');
}

function renderSubjectStats(history, dates) {
  const container = document.getElementById('subjectStats');
  const subjData = {};
  SUBJECTS.forEach(s => subjData[s] = { done: 0, total: 0 });

  dates.forEach(d => {
    const h = history[d];
    if (h && h.subjects) {
      Object.keys(h.subjects).forEach(s => {
        if (subjData[s]) {
          subjData[s].done += h.subjects[s].done;
          subjData[s].total += h.subjects[s].total;
        }
      });
    }
  });

  const hasData = Object.values(subjData).some(v => v.total > 0);
  if (!hasData) {
    container.innerHTML = '<div class="empty-state">暂无数据，开始学习吧 🌱</div>';
    return;
  }

  container.innerHTML = SUBJECTS.map(s => {
    const d = subjData[s];
    const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
    const color = SUBJECT_COLORS[s];
    return `
      <div class="subj-stat-item">
        <div class="subj-stat-header">
          <span class="subj-stat-name">${SUBJECT_EMOJI[s]} ${s}</span>
          <span class="subj-stat-count">${d.done}/${d.total} (${pct}%)</span>
        </div>
        <div class="subj-stat-bar">
          <div class="subj-stat-fill" style="width: ${pct}%; background: ${color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

/* ==================== 试卷记录 ==================== */

function renderPapers() {
  const papers = state.papers.sort((a, b) => b.date.localeCompare(a.date));
  const filtered = paperFilter === 'all' ? papers : papers.filter(p => p.subject === paperFilter);

  document.getElementById('paperCount').textContent = papers.length;

  if (papers.length === 0) {
    document.getElementById('paperAvg').textContent = '--';
    document.getElementById('paperBest').textContent = '--';
  } else {
    const avg = papers.reduce((s, p) => s + (p.score / p.total * 100), 0) / papers.length;
    document.getElementById('paperAvg').textContent = avg.toFixed(1);
    const best = Math.max(...papers.map(p => p.score / p.total * 100));
    document.getElementById('paperBest').textContent = best.toFixed(1);
  }

  renderScoreChart(papers);

  const list = document.getElementById('paperList');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">还没有试卷记录 📝</div>';
    return;
  }

  list.innerHTML = filtered.map(p => {
    const pct = p.total > 0 ? (p.score / p.total * 100) : 0;
    let cls = 'score-poor';
    if (pct >= 90) cls = 'score-excellent';
    else if (pct >= 80) cls = 'score-good';
    else if (pct >= 60) cls = 'score-ok';
    return `
      <div class="paper-item">
        <div class="paper-score-circle ${cls}">${p.score}</div>
        <div class="paper-info">
          <span class="paper-name">${p.name}</span>
          <div class="paper-meta">
            <span class="task-subject-tag subject-${p.subject}">${SUBJECT_EMOJI[p.subject]} ${p.subject}</span>
            ${formatDateShort(p.date)} · ${p.score}/${p.total} 分
          </div>
          ${p.notes ? `<div class="paper-notes-text">📝 ${p.notes}</div>` : ''}
        </div>
        <button class="paper-delete" onclick="deletePaper('${p.id}')" aria-label="删除">✕</button>
      </div>
    `;
  }).join('');
}

function renderScoreChart(papers) {
  const chart = document.getElementById('scoreChart');
  const recent = papers.slice(-12).reverse();
  if (recent.length === 0) {
    chart.innerHTML = '<div class="empty-state" style="width:100%;">暂无成绩数据</div>';
    return;
  }
  const maxScore = 100;
  chart.innerHTML = recent.map(p => {
    const pct = p.total > 0 ? (p.score / p.total * 100) : 0;
    const height = Math.max((pct / maxScore) * 100, 3);
    let color = SUBJECT_COLORS[p.subject] || '#999';
    return `
      <div class="score-point-wrap">
        <span class="score-value-label">${p.score}</span>
        <div class="score-bar" style="height: ${height}%; background: ${color};"></div>
        <span class="score-date-label">${formatDateShort(p.date)}</span>
      </div>
    `;
  }).join('');
}

function addPaper(subject, name, score, total, date, notes) {
  state.papers.push({ id: uid(), subject, name, score: parseFloat(score), total: parseFloat(total), date, notes });
  saveData();
  renderPapers();
  showToast('试卷已记录');
}

function deletePaper(id) {
  state.papers = state.papers.filter(p => p.id !== id);
  saveData();
  renderPapers();
  showToast('已删除');
}

/* ==================== 错题本 ==================== */

function renderMistakes() {
  const mistakes = state.mistakes.sort((a, b) => b.date.localeCompare(a.date));
  const filtered = mistakeFilter === 'all' ? mistakes : mistakes.filter(m => m.subject === mistakeFilter);

  const list = document.getElementById('mistakeList');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">还没有错题记录 ❌</div>';
    return;
  }

  list.innerHTML = filtered.map(m => `
    <div class="mistake-item">
      <div class="mistake-item-header">
        <span class="mistake-subject-tag subject-${m.subject}">${SUBJECT_EMOJI[m.subject]} ${m.subject}</span>
        <span class="mistake-type">${m.type || ''}</span>
        <button class="mistake-delete" onclick="deleteMistake('${m.id}')" aria-label="删除" style="margin-left:auto;">✕</button>
      </div>
      <div class="mistake-question">${m.question}</div>
      <div class="mistake-answer">✅ ${m.answer}</div>
      ${m.reason ? `<div class="mistake-reason">⚠️ 错因：${m.reason}</div>` : ''}
      <div class="mistake-date">${formatDateCN(m.date)}</div>
    </div>
  `).join('');
}

function addMistake(subject, type, question, answer, reason) {
  state.mistakes.push({ id: uid(), subject, type, question, answer, reason, date: todayStr() });
  saveData();
  renderMistakes();
  showToast('错题已收录');
}

function deleteMistake(id) {
  state.mistakes = state.mistakes.filter(m => m.id !== id);
  saveData();
  renderMistakes();
  showToast('已删除');
}

/* ==================== 导航 ==================== */

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
    n.setAttribute('aria-pressed', 'false');
  });
  const viewEl = document.getElementById(view + 'View');
  const navEl = document.querySelector(`[data-view="${view}"]`);
  if (viewEl) viewEl.classList.add('active');
  if (navEl) {
    navEl.classList.add('active');
    navEl.setAttribute('aria-pressed', 'true');
  }

  if (view === 'stats') renderStats();
  if (view === 'papers') renderPapers();
  if (view === 'mistakes') renderMistakes();
}

/* ==================== 初始化 ==================== */

function init() {
  loadData();

  document.getElementById('dateDisplay').textContent = formatDateCN(todayStr());

  // 默认日期填今天
  document.getElementById('paperDate').value = todayStr();

  // 导航
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // 添加任务
  document.getElementById('addTaskForm').addEventListener('submit', e => {
    e.preventDefault();
    const subject = document.getElementById('taskSubjectSelect').value;
    const text = document.getElementById('taskTextInput').value.trim();
    if (!text) { showToast('请输入任务内容'); return; }
    addTask(subject, text);
    document.getElementById('taskTextInput').value = '';
  });

  // 添加试卷
  document.getElementById('addPaperForm').addEventListener('submit', e => {
    e.preventDefault();
    const subject = document.getElementById('paperSubject').value;
    const name = document.getElementById('paperName').value.trim();
    const score = document.getElementById('paperScore').value.trim();
    const total = document.getElementById('paperTotal').value.trim();
    const date = document.getElementById('paperDate').value || todayStr();
    const notes = document.getElementById('paperNotes').value.trim();
    if (!name || !score || !total) { showToast('请填写试卷名称、得分和总分'); return; }
    addPaper(subject, name, score, total, date, notes);
    document.getElementById('paperName').value = '';
    document.getElementById('paperScore').value = '';
    document.getElementById('paperNotes').value = '';
  });

  // 添加错题
  document.getElementById('addMistakeForm').addEventListener('submit', e => {
    e.preventDefault();
    const subject = document.getElementById('mistakeSubject').value;
    const type = document.getElementById('mistakeType').value.trim();
    const question = document.getElementById('mistakeQuestion').value.trim();
    const answer = document.getElementById('mistakeAnswer').value.trim();
    const reason = document.getElementById('mistakeReason').value.trim();
    if (!question || !answer) { showToast('请填写题目和答案'); return; }
    addMistake(subject, type, question, answer, reason);
    document.getElementById('mistakeType').value = '';
    document.getElementById('mistakeQuestion').value = '';
    document.getElementById('mistakeAnswer').value = '';
    document.getElementById('mistakeReason').value = '';
  });

  // 试卷筛选
  document.querySelectorAll('#paperFilterTabs .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      paperFilter = tab.dataset.filter;
      document.querySelectorAll('#paperFilterTabs .filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderPapers();
    });
  });

  // 错题筛选
  document.querySelectorAll('#mistakeFilterTabs .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      mistakeFilter = tab.dataset.filter;
      document.querySelectorAll('#mistakeFilterTabs .filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderMistakes();
    });
  });

  // 弹窗
  const modal = document.getElementById('installModal');
  const closeBtn = document.getElementById('closeInstallModal');
  closeBtn.addEventListener('click', () => modal.classList.remove('show'));
  document.querySelector('.modal-backdrop').addEventListener('click', () => modal.classList.remove('show'));

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// 全局函数（供 onclick 调用）
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.deletePaper = deletePaper;
window.deleteMistake = deleteMistake;

document.addEventListener('DOMContentLoaded', init);