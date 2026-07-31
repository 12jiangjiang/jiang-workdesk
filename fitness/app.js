/**
 * 减肥追踪 App
 * 功能: 今日打卡 / 体重趋势 / 饮食记录 / 运动记录
 * 数据存储: localStorage (key: weight-loss-tracker)
 */

const STORAGE_KEY = 'weight-loss-tracker';
const WATER_GOAL = 8;
const HABITS = ['exercise', 'diet', 'nosnack', 'nosnack2', 'sleep'];
const HABIT_LABELS = { exercise: '完成运动', diet: '饮食健康', nosnack: '没吃零食', nosnack2: '没喝奶茶', sleep: '早睡早起' };
const MEAL_TYPES = { breakfast: '🌅 早餐', lunch: '☀️ 午餐', dinner: '🌙 晚餐', snack: '🍵 加餐' };
const EX_TYPES = { '跑步': '🏃', '快走': '🚶', '瑜伽': '🧘', '骑行': '🚴', '力量训练': '💪', '游泳': '🏊', '普拉提': '🤸', '跳绳': '🪢', '其他': '🎯' };

const DEFAULT_TRAINING = [
  { id: 'dt1', name: '晨跑/快走', detail: '30分钟', icon: '🏃' },
  { id: 'dt2', name: '深蹲', detail: '3组×20个', icon: '🦵' },
  { id: 'dt3', name: '跑步', detail: '3公里/5公里', icon: '🏃' },
  { id: 'dt4', name: '仰卧起坐', detail: '3组×20个', icon: '💪' },
  { id: 'dt5', name: '开合跳', detail: '3组×30个', icon: '⭐' },
  { id: 'dt6', name: '拉伸放松', detail: '15分钟', icon: '🧘' },
];

let state = {
  profile: { height: null, startWeight: null, goalWeight: null, startDate: null },
  weights: [],
  checkins: {},
  meals: [],
  exercises: [],
  customTraining: [],
};

let currentView = 'checkin';
let mealFilter = 'all';

/* ==================== 工具函数 ==================== */

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateCN(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const week = ['日','一','二','三','四','五','六'][d.getDay()];
  return `${d.getMonth()+1} 月 ${d.getDate()} 日 · 星期${week}`;
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function uid() { return 'id_' + Date.now() + '_' + Math.floor(Math.random()*1000); }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

function getCheckin(dateStr) {
  if (!state.checkins[dateStr]) {
    state.checkins[dateStr] = { water: 0, exercise: false, diet: false, nosnack: false, sleep: false, trainingDone: {} };
  }
  if (!state.checkins[dateStr].trainingDone) {
    state.checkins[dateStr].trainingDone = {};
  }
  return state.checkins[dateStr];
}

/* ==================== 数据管理 ==================== */

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const d = JSON.parse(raw);
      state.profile = d.profile || state.profile;
      state.weights = d.weights || [];
      state.checkins = d.checkins || {};
      state.meals = d.meals || [];
      state.exercises = d.exercises || [];
      state.customTraining = d.customTraining || [];
    } catch(e) { console.error('load error', e); }
  }
  // 自动设置起始体重
  if (!state.profile.startWeight && state.weights.length > 0) {
    state.profile.startWeight = state.weights[0].weight;
    state.profile.startDate = state.weights[0].date;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ==================== 今日打卡 ==================== */

function renderCheckin() {
  const today = todayStr();
  const checkin = getCheckin(today);

  // 体重显示
  const todayWeight = state.weights.find(w => w.date === today);
  const weightDisplay = document.getElementById('weightDisplay');
  if (todayWeight) {
    weightDisplay.style.display = 'flex';
    document.getElementById('weightCurrent').textContent = todayWeight.weight;
    // 计算与前一天的变化
    const idx = state.weights.findIndex(w => w.date === today);
    const changeEl = document.getElementById('weightChange');
    if (idx > 0) {
      const prev = state.weights[idx - 1];
      const diff = todayWeight.weight - prev.weight;
      if (diff < 0) { changeEl.textContent = `↓ ${Math.abs(diff).toFixed(1)} kg`; changeEl.className = 'weight-change down'; }
      else if (diff > 0) { changeEl.textContent = `↑ ${diff.toFixed(1)} kg`; changeEl.className = 'weight-change up'; }
      else { changeEl.textContent = '→ 持平'; changeEl.className = 'weight-change'; }
    } else { changeEl.textContent = '首次记录'; changeEl.className = 'weight-change'; }
  } else {
    weightDisplay.style.display = 'none';
  }

  // 喝水
  renderWaterCups(checkin.water);
  document.getElementById('waterCount').textContent = `${checkin.water} / ${WATER_GOAL} 杯`;

  // 习惯
  HABITS.forEach(h => {
    const el = document.querySelector(`[data-habit="${h}"]`);
    if (checkin[h]) el.classList.add('done');
    else el.classList.remove('done');
  });

  // 训练计划
  renderTraining();

  // 进度
  updateCheckinProgress(checkin, todayWeight);

  // 连续打卡天数
  updateStreak();
}

function renderWaterCups(count) {
  const container = document.getElementById('waterCups');
  let html = '';
  for (let i = 0; i < WATER_GOAL; i++) {
    html += `<div class="water-cup ${i < count ? 'filled' : ''}" data-cup="${i+1}">💧</div>`;
  }
  container.innerHTML = html;
  container.querySelectorAll('.water-cup').forEach(c => {
    c.addEventListener('click', () => {
      const cup = parseInt(c.dataset.cup);
      const checkin = getCheckin(todayStr());
      checkin.water = cup <= checkin.water ? cup - 1 : cup;
      saveData();
      renderCheckin();
    });
  });
}

function updateCheckinProgress(checkin, todayWeight) {
  let done = 0;
  const total = 7;
  if (todayWeight) done++;
  if (checkin.water >= WATER_GOAL) done++;
  HABITS.forEach(h => { if (checkin[h]) done++; });

  const pct = Math.round((done / total) * 100);
  document.getElementById('checkinDone').textContent = done;
  document.getElementById('checkinProgressText').textContent = pct + '%';

  const ring = document.getElementById('checkinProgressRing');
  const circ = 2 * Math.PI * 30;
  ring.style.strokeDasharray = circ;
  ring.style.strokeDashoffset = circ - (pct / 100) * circ;

  const hint = document.getElementById('checkinHint');
  if (pct === 100) hint.textContent = '完美！今天的健康目标全部完成啦！🎉';
  else if (pct >= 60) hint.textContent = '快完成了，再接再厉！💪';
  else if (pct >= 30) hint.textContent = '已经有进展了，继续加油！🔥';
  else hint.textContent = '开始今天的健康打卡吧！🌱';
}

function updateStreak() {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const c = state.checkins[ds];
    const w = state.weights.find(x => x.date === ds);
    if ((c && (c.water > 0 || c.exercise || c.diet || c.nosnack || c.sleep)) || w) {
      streak++;
    } else {
      if (i > 0) break;
    }
  }
  const badge = document.getElementById('streakBadge');
  if (streak >= 2) {
    badge.style.display = 'flex';
    document.getElementById('streakDays').textContent = streak;
  } else {
    badge.style.display = 'none';
  }
}

function saveWeight() {
  const input = document.getElementById('todayWeightInput');
  const w = parseFloat(input.value);
  if (!w || w < 20 || w > 300) { showToast('请输入合理的体重'); return; }
  const today = todayStr();
  const existing = state.weights.find(x => x.date === today);
  if (existing) { existing.weight = w; }
  else { state.weights.push({ date: today, weight: w }); }
  state.weights.sort((a, b) => a.date.localeCompare(b.date));
  // 自动设置起始
  if (!state.profile.startWeight) {
    state.profile.startWeight = state.weights[0].weight;
    state.profile.startDate = state.weights[0].date;
  }
  saveData();
  renderCheckin();
  input.value = '';
  showToast('体重已记录');
}

/* ==================== 每日训练 ==================== */

function getAllTraining() {
  return [...DEFAULT_TRAINING, ...state.customTraining];
}

function renderTraining() {
  const checkin = getCheckin(todayStr());
  const allTasks = getAllTraining();
  const doneCount = allTasks.filter(t => checkin.trainingDone[t.id]).length;

  document.getElementById('trainingCount').textContent = `${doneCount} / ${allTasks.length} 完成`;

  const list = document.getElementById('trainingList');
  list.innerHTML = allTasks.map(t => {
    const done = checkin.trainingDone[t.id];
    const isCustom = t.id.startsWith('custom_');
    return `
      <div class="training-item ${done ? 'done' : ''}" data-tid="${t.id}">
        <div class="training-check">${done ? '✓' : ''}</div>
        <span class="training-icon">${t.icon}</span>
        <div class="training-info">
          <div class="training-name">${t.name}</div>
          <div class="training-detail">${t.detail}</div>
        </div>
        ${isCustom ? `<button class="training-delete" data-del="${t.id}">✕</button>` : ''}
      </div>
    `;
  }).join('');

  list.querySelectorAll('.training-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('training-delete')) return;
      const tid = item.dataset.tid;
      const c = getCheckin(todayStr());
      c.trainingDone[tid] = !c.trainingDone[tid];
      saveData();
      renderTraining();
      // 全部完成自动打卡运动习惯
      const allDone = getAllTraining().every(t => c.trainingDone[t.id]);
      if (allDone && !c.exercise) {
        c.exercise = true;
        saveData();
        renderCheckin();
        showToast('训练全部完成！运动习惯已自动打卡 💪');
      }
    });
  });

  list.querySelectorAll('.training-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTraining(btn.dataset.del);
    });
  });
}

function addTraining(name, detail) {
  const id = 'custom_' + Date.now();
  const iconMap = { '跑步': '🏃', '跑': '🏃', '走': '🚶', '跳': '⭐', '蹲': '🦵', '俯卧撑': '💪', '撑': '🏋️', '拉伸': '🧘', '瑜伽': '🧘', '骑': '🚴', '游': '🏊', '平板': '🏋️' };
  let icon = '🎯';
  for (const key in iconMap) { if (name.includes(key)) { icon = iconMap[key]; break; } }
  state.customTraining.push({ id, name, detail: detail || '', icon });
  saveData();
  renderTraining();
  showToast('训练项目已添加');
}

function deleteTraining(id) {
  state.customTraining = state.customTraining.filter(t => t.id !== id);
  Object.keys(state.checkins).forEach(date => {
    if (state.checkins[date].trainingDone) {
      delete state.checkins[date].trainingDone[id];
    }
  });
  saveData();
  renderTraining();
  showToast('已删除');
}

/* ==================== 体重趋势 ==================== */

function renderWeight() {
  const profile = state.profile;
  const weights = state.weights;

  // 目标卡片
  document.getElementById('startWeight').textContent = profile.startWeight ? profile.startWeight + ' kg' : '-- kg';
  const latest = weights.length > 0 ? weights[weights.length - 1] : null;
  document.getElementById('currentWeight').textContent = latest ? latest.weight + ' kg' : '-- kg';
  document.getElementById('goalWeight').textContent = profile.goalWeight ? profile.goalWeight + ' kg' : '-- kg';

  // 目标进度
  const goalFill = document.getElementById('goalProgressFill');
  const goalText = document.getElementById('goalProgressText');
  if (profile.startWeight && profile.goalWeight && latest) {
    const total = profile.startWeight - profile.goalWeight;
    const done = profile.startWeight - latest.weight;
    const pct = total > 0 ? Math.min(Math.round((done / total) * 100), 100) : 0;
    goalFill.style.width = Math.max(pct, 2) + '%';
    if (latest.weight <= profile.goalWeight) {
      goalText.textContent = '🎉 目标已达成！太棒了！';
      goalFill.style.background = 'var(--green)';
    } else {
      goalText.textContent = `已完成 ${pct}%，还需减 ${Math.max(0, latest.weight - profile.goalWeight).toFixed(1)} kg`;
    }
  } else {
    goalFill.style.width = '0%';
    if (!profile.goalWeight) goalText.textContent = '设置目标体重，开始追踪进度';
    else if (!profile.startWeight) goalText.textContent = '记录第一次体重，开始追踪';
    else goalText.textContent = '继续记录体重，追踪进度';
  }

  // 统计
  renderWeightStats(weights);

  // BMI
  renderBMI(profile, latest);

  // 体重曲线
  renderWeightChart(weights);
}

function renderWeightStats(weights) {
  const totalLossEl = document.getElementById('totalLoss');
  const weekLossEl = document.getElementById('weekLoss');
  const monthLossEl = document.getElementById('monthLoss');

  if (weights.length === 0) {
    totalLossEl.textContent = '--'; weekLossEl.textContent = '--'; monthLossEl.textContent = '--';
    return;
  }

  const latest = weights[weights.length - 1];
  const first = weights[0];
  const totalLoss = first.weight - latest.weight;
  totalLossEl.textContent = (totalLoss > 0 ? '-' : '+') + Math.abs(totalLoss).toFixed(1) + ' kg';
  totalLossEl.style.color = totalLoss > 0 ? 'var(--green)' : totalLoss < 0 ? 'var(--red)' : 'var(--text-secondary)';

  // 本周
  const weekAgo = daysAgoStr(7);
  const weekData = weights.filter(w => w.date >= weekAgo);
  if (weekData.length >= 2) {
    const weekLoss = weekData[0].weight - latest.weight;
    weekLossEl.textContent = (weekLoss > 0 ? '-' : '+') + Math.abs(weekLoss).toFixed(1) + ' kg';
    weekLossEl.style.color = weekLoss > 0 ? 'var(--green)' : weekLoss < 0 ? 'var(--red)' : 'var(--text-secondary)';
  } else { weekLossEl.textContent = '--'; }

  // 本月
  const monthAgo = daysAgoStr(30);
  const monthData = weights.filter(w => w.date >= monthAgo);
  if (monthData.length >= 2) {
    const monthLoss = monthData[0].weight - latest.weight;
    monthLossEl.textContent = (monthLoss > 0 ? '-' : '+') + Math.abs(monthLoss).toFixed(1) + ' kg';
    monthLossEl.style.color = monthLoss > 0 ? 'var(--green)' : monthLoss < 0 ? 'var(--red)' : 'var(--text-secondary)';
  } else { monthLossEl.textContent = '--'; }
}

function renderBMI(profile, latest) {
  const bmiValue = document.getElementById('bmiValue');
  const bmiLabel = document.getElementById('bmiLabel');
  if (profile.height && latest) {
    const h = profile.height / 100;
    const bmi = latest.weight / (h * h);
    bmiValue.textContent = bmi.toFixed(1);
    let label, color;
    if (bmi < 18.5) { label = '偏瘦'; color = 'var(--blue)'; }
    else if (bmi < 24) { label = '正常 ✓'; color = 'var(--green)'; }
    else if (bmi < 28) { label = '偏胖'; color = 'var(--orange)'; }
    else { label = '肥胖'; color = 'var(--red)'; }
    bmiLabel.textContent = label;
    bmiLabel.style.color = color;
    bmiValue.style.color = color;
  } else {
    bmiValue.textContent = '--';
    bmiLabel.textContent = profile.height ? '请记录体重' : '请设置身高';
    bmiValue.style.color = 'var(--text-secondary)';
  }

  // 身高输入
  const heightInput = document.getElementById('heightInput');
  if (profile.height) heightInput.value = profile.height;
}

function renderWeightChart(weights) {
  const container = document.getElementById('weightChartContainer');
  if (weights.length === 0) {
    container.innerHTML = '<div class="empty-state">还没有体重数据，去打卡记录吧 📋</div>';
    return;
  }

  // 取最近30天
  const recent = weights.slice(-30);
  const wValues = recent.map(w => w.weight);
  const minW = Math.min(...wValues) - 1;
  const maxW = Math.max(...wValues) + 1;
  const range = maxW - minW || 1;

  const W = 320, H = 160, pad = 28;
  const chartW = W - pad * 2, chartH = H - pad - 16;

  // 计算坐标
  const points = recent.map((w, i) => {
    const x = pad + (recent.length > 1 ? (i / (recent.length - 1)) * chartW : chartW / 2);
    const y = pad + chartH - ((w.weight - minW) / range) * chartH;
    return { x, y, weight: w.weight, date: w.date };
  });

  // 路径
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = linePath + ` L ${points[points.length-1].x.toFixed(1)} ${pad + chartH} L ${points[0].x.toFixed(1)} ${pad + chartH} Z`;

  // Y轴标签
  const yLabels = [maxW, (maxW + minW) / 2, minW];

  let svg = `<svg class="weight-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  // 网格线
  yLabels.forEach(v => {
    const y = pad + chartH - ((v - minW) / range) * chartH;
    svg += `<line class="weight-chart-axis" x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke-dasharray="2 4"/>`;
    svg += `<text class="weight-chart-label" x="${pad - 4}" y="${y + 3}" text-anchor="end">${v.toFixed(1)}</text>`;
  });
  // 区域
  svg += `<path class="weight-chart-area" d="${areaPath}"/>`;
  // 线
  svg += `<path class="weight-chart-line" d="${linePath}"/>`;
  // 点
  points.forEach(p => {
    svg += `<circle class="weight-chart-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3"/>`;
  });
  // X轴标签（首、中、尾）
  if (points.length > 0) {
    svg += `<text class="weight-chart-label" x="${points[0].x}" y="${H - 2}" text-anchor="middle">${formatDateShort(points[0].date)}</text>`;
    if (points.length > 2) {
      const mid = points[Math.floor(points.length / 2)];
      svg += `<text class="weight-chart-label" x="${mid.x}" y="${H - 2}" text-anchor="middle">${formatDateShort(mid.date)}</text>`;
    }
    const last = points[points.length - 1];
    svg += `<text class="weight-chart-label" x="${last.x}" y="${H - 2}" text-anchor="middle">${formatDateShort(last.date)}</text>`;
  }
  svg += '</svg>';

  container.innerHTML = svg;
}

/* ==================== 饮食记录 ==================== */

function renderDiet() {
  const today = todayStr();
  const todayMeals = state.meals.filter(m => m.date === today);
  const totalCal = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
  const target = 1800;

  document.getElementById('todayCalories').textContent = totalCal;
  const pct = Math.min(Math.round((totalCal / target) * 100), 100);
  document.getElementById('calorieBar').style.width = Math.max(pct, 1) + '%';
  const bar = document.getElementById('calorieBar');
  if (totalCal > target) bar.style.background = 'var(--red)';
  else if (totalCal > target * 0.8) bar.style.background = 'var(--orange)';
  else bar.style.background = 'var(--primary)';

  // 列表
  const filtered = mealFilter === 'all' ? state.meals : state.meals.filter(m => m.type === mealFilter);
  const sorted = filtered.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const list = document.getElementById('mealList');
  if (sorted.length === 0) { list.innerHTML = '<div class="empty-state">还没有饮食记录 🍽️</div>'; return; }

  // 按日期分组
  const groups = {};
  sorted.forEach(m => { if (!groups[m.date]) groups[m.date] = []; groups[m.date].push(m); });

  list.innerHTML = Object.keys(groups).map(date => {
    const items = groups[date];
    const dayTotal = items.reduce((s, m) => s + (m.calories || 0), 0);
    return `
      <div style="font-size:12px;color:var(--text-secondary);padding:4px 4px 2px;">${formatDateCN(date)} · 共 ${dayTotal} kcal</div>
      ${items.map(m => `
        <div class="record-item">
          <div class="record-icon">${(MEAL_TYPES[m.type] || '🍽️').slice(0, 2)}</div>
          <div class="record-info">
            <span class="record-title">${MEAL_TYPES[m.type] || m.type}</span>
            <div class="record-meta">${m.desc || ''}</div>
          </div>
          <span class="record-value calories">${m.calories || 0} kcal</span>
          <button class="record-delete" onclick="deleteMeal('${m.id}')">✕</button>
        </div>
      `).join('')}
    `;
  }).join('');
}

function addMeal(type, desc, calories) {
  state.meals.push({ id: uid(), date: todayStr(), type, desc, calories: parseInt(calories) || 0 });
  saveData(); renderDiet(); showToast('饮食已记录');
}

function deleteMeal(id) {
  state.meals = state.meals.filter(m => m.id !== id);
  saveData(); renderDiet(); showToast('已删除');
}

/* ==================== 运动记录 ==================== */

function renderExercise() {
  const today = todayStr();
  const todayEx = state.exercises.filter(e => e.date === today);
  const todayBurned = todayEx.reduce((s, e) => s + (e.calories || 0), 0);
  const todayMin = todayEx.reduce((s, e) => s + (e.duration || 0), 0);

  document.getElementById('todayBurned').textContent = todayBurned;
  document.getElementById('todayMinutes').textContent = todayMin;

  // 本周运动次数
  const weekAgo = daysAgoStr(7);
  const weekEx = state.exercises.filter(e => e.date >= weekAgo);
  document.getElementById('weekCount').textContent = weekEx.length;

  // 列表
  const sorted = state.exercises.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const list = document.getElementById('exerciseList');
  if (sorted.length === 0) { list.innerHTML = '<div class="empty-state">还没有运动记录 🏃</div>'; return; }

  const groups = {};
  sorted.forEach(e => { if (!groups[e.date]) groups[e.date] = []; groups[e.date].push(e); });

  list.innerHTML = Object.keys(groups).map(date => {
    const items = groups[date];
    const dayBurn = items.reduce((s, e) => s + (e.calories || 0), 0);
    const dayMin = items.reduce((s, e) => s + (e.duration || 0), 0);
    return `
      <div style="font-size:12px;color:var(--text-secondary);padding:4px 4px 2px;">${formatDateCN(date)} · ${dayMin} 分钟 · ${dayBurn} kcal</div>
      ${items.map(e => `
        <div class="record-item">
          <div class="record-icon">${EX_TYPES[e.type] || '🎯'}</div>
          <div class="record-info">
            <span class="record-title">${e.type}</span>
            <div class="record-meta">${e.duration || 0} 分钟${e.note ? ' · ' + e.note : ''}</div>
          </div>
          <span class="record-value burned">${e.calories || 0} kcal</span>
          <button class="record-delete" onclick="deleteExercise('${e.id}')">✕</button>
        </div>
      `).join('')}
    `;
  }).join('');
}

function addExercise(type, duration, calories, note) {
  state.exercises.push({ id: uid(), date: todayStr(), type, duration: parseInt(duration) || 0, calories: parseInt(calories) || 0, note });
  saveData(); renderExercise();
  // 自动打卡运动习惯
  const checkin = getCheckin(todayStr());
  if (!checkin.exercise) { checkin.exercise = true; saveData(); renderCheckin(); }
  showToast('运动已记录');
}

function deleteExercise(id) {
  state.exercises = state.exercises.filter(e => e.id !== id);
  saveData(); renderExercise(); showToast('已删除');
}

/* ==================== 导航 ==================== */

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => { n.classList.remove('active'); n.setAttribute('aria-pressed', 'false'); });
  const viewEl = document.getElementById(view + 'View');
  const navEl = document.querySelector(`[data-view="${view}"]`);
  if (viewEl) viewEl.classList.add('active');
  if (navEl) { navEl.classList.add('active'); navEl.setAttribute('aria-pressed', 'true'); }
  if (view === 'checkin') renderCheckin();
  if (view === 'weight') renderWeight();
  if (view === 'diet') renderDiet();
  if (view === 'exercise') renderExercise();
}

/* ==================== 初始化 ==================== */

function init() {
  loadData();
  document.getElementById('dateDisplay').textContent = formatDateCN(todayStr());

  // 导航
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // 记录体重
  document.getElementById('saveWeightBtn').addEventListener('click', saveWeight);
  document.getElementById('todayWeightInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveWeight(); });

  // 喝水按钮
  document.getElementById('waterAdd').addEventListener('click', () => {
    const checkin = getCheckin(todayStr());
    if (checkin.water < 20) { checkin.water++; saveData(); renderCheckin(); }
  });
  document.getElementById('waterReset').addEventListener('click', () => {
    const checkin = getCheckin(todayStr());
    checkin.water = 0; saveData(); renderCheckin();
  });

  // 习惯打卡
  document.querySelectorAll('.habit-item').forEach(item => {
    item.addEventListener('click', () => {
      const h = item.dataset.habit;
      const checkin = getCheckin(todayStr());
      checkin[h] = !checkin[h];
      saveData(); renderCheckin();
    });
  });

  // 保存身高
  document.getElementById('saveHeightBtn').addEventListener('click', () => {
    const h = parseFloat(document.getElementById('heightInput').value);
    if (!h || h < 100 || h > 250) { showToast('请输入合理的身高'); return; }
    state.profile.height = h; saveData(); renderWeight(); showToast('身高已保存');
  });

  // 设置目标体重（点击目标体重可设置）
  document.getElementById('goalWeight').addEventListener('click', () => {
    const input = prompt('设置目标体重 (kg)：', state.profile.goalWeight || '');
    if (input !== null) {
      const w = parseFloat(input);
      if (w && w > 20 && w < 300) {
        state.profile.goalWeight = w; saveData(); renderWeight(); showToast('目标已设置');
      } else if (input) { showToast('请输入合理的体重'); }
    }
  });

  // 添加饮食
  document.getElementById('addMealForm').addEventListener('submit', e => {
    e.preventDefault();
    const type = document.getElementById('mealType').value;
    const desc = document.getElementById('mealDesc').value.trim();
    const cal = document.getElementById('mealCalories').value.trim();
    if (!cal) { showToast('请输入热量'); return; }
    addMeal(type, desc, cal);
    document.getElementById('mealDesc').value = '';
    document.getElementById('mealCalories').value = '';
  });

  // 添加运动
  document.getElementById('addExerciseForm').addEventListener('submit', e => {
    e.preventDefault();
    const type = document.getElementById('exerciseType').value;
    const dur = document.getElementById('exerciseDuration').value.trim();
    const cal = document.getElementById('exerciseCalories').value.trim();
    const note = document.getElementById('exerciseNote').value.trim();
    if (!dur && !cal) { showToast('请输入时长或消耗'); return; }
    addExercise(type, dur, cal, note);
    document.getElementById('exerciseDuration').value = '';
    document.getElementById('exerciseCalories').value = '';
    document.getElementById('exerciseNote').value = '';
  });

  // 添加训练项目
  document.getElementById('addTrainingForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('trainingName').value.trim();
    const detail = document.getElementById('trainingDetail').value.trim();
    if (!name) { showToast('请输入训练项目'); return; }
    addTraining(name, detail);
    document.getElementById('trainingName').value = '';
    document.getElementById('trainingDetail').value = '';
  });

  // 饮食筛选
  document.querySelectorAll('#mealFilterTabs .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      mealFilter = tab.dataset.filter;
      document.querySelectorAll('#mealFilterTabs .filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderDiet();
    });
  });

  // 弹窗
  const modal = document.getElementById('installModal');
  document.getElementById('closeInstallModal').addEventListener('click', () => modal.classList.remove('show'));
  document.querySelector('.modal-backdrop').addEventListener('click', () => modal.classList.remove('show'));

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 初始渲染
  renderCheckin();
}

window.deleteMeal = deleteMeal;
window.deleteExercise = deleteExercise;
window.deleteTraining = deleteTraining;

document.addEventListener('DOMContentLoaded', init);