(() => {
  'use strict';

  const STORAGE_KEY = 'creator-daily-workbench';
  const defaultTasks = [
    { id: 't1', text: '运动 1 小时', done: false },
    { id: 't2', text: '尤克里里练习 1 小时', done: false },
    { id: 't3', text: '英语练习 30 分钟', done: false }
  ];

  const state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialState();
      const parsed = JSON.parse(raw);
      // 按日期重置任务完成状态
      const today = getTodayKey();
      if (parsed.date !== today) {
        parsed.tasks = parsed.tasks.map(t => ({ ...t, done: false }));
        parsed.date = today;
        saveState(parsed);
      }
      return parsed;
    } catch (e) {
      return createInitialState();
    }
  }

  function createInitialState() {
    return {
      date: getTodayKey(),
      tasks: [...defaultTasks],
      notes: { ideas: '', trending: '', review: '' }
    };
  }

  function saveState(s = state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) {
      showToast('保存失败，请检查浏览器存储权限');
    }
  }

  function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatDate() {
    const d = new Date();
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
  }

  // DOM 元素
  const els = {
    date: document.getElementById('dateDisplay'),
    navItems: document.querySelectorAll('.nav-item'),
    views: document.querySelectorAll('.view'),
    taskList: document.getElementById('taskList'),
    addForm: document.getElementById('addTaskForm'),
    addInput: document.getElementById('newTaskInput'),
    progressText: document.getElementById('progressText'),
    progressPercent: document.getElementById('progressPercent'),
    progressFill: document.getElementById('progressFill'),
    progressBar: document.querySelector('.progress-bar'),
    ideasNote: document.getElementById('ideasNote'),
    trendingNote: document.getElementById('trendingNote'),
    reviewNote: document.getElementById('reviewNote'),
    syncBtn: document.getElementById('syncBtn'),
    installModal: document.getElementById('installModal'),
    closeInstallModal: document.getElementById('closeInstallModal'),
    toast: document.getElementById('toast')
  };

  // ... (hot data state)
  let hotData = null;
  let activeHotTab = 'douyin';

  function loadHotData() {
    fetch('hot_data.json?v=' + Date.now())
      .then(r => r.json())
      .then(data => {
        hotData = data;
        renderHotTabs();
        renderHotList();
      })
      .catch(() => {
        const list = document.getElementById('hotList');
        if (list) list.innerHTML = '<div class="hot-empty">暂无热点数据，每天8点自动更新</div>';
        const meta = document.getElementById('hotMeta');
        if (meta) meta.textContent = '';
      });
  }

  function renderHotTabs() {
    if (!hotData || !hotData.sources) return;
    const tabs = document.getElementById('hotTabs');
    if (!tabs) return;
    tabs.querySelectorAll('.hot-tab').forEach(tab => {
      const src = tab.dataset.source;
      const hasData = hotData.sources[src] && hotData.sources[src].length > 0;
      tab.style.display = hasData ? '' : 'none';
      tab.addEventListener('click', () => {
        activeHotTab = src;
        tabs.querySelectorAll('.hot-tab').forEach(t => t.classList.toggle('active', t === tab));
        renderHotList();
      });
    });
    // 如果当前 tab 没数据，切到第一个有数据的
    if (!hotData.sources[activeHotTab] || hotData.sources[activeHotTab].length === 0) {
      for (const key of Object.keys(hotData.sources)) {
        if (hotData.sources[key] && hotData.sources[key].length > 0) {
          activeHotTab = key;
          break;
        }
      }
      tabs.querySelectorAll('.hot-tab').forEach(t => t.classList.toggle('active', t.dataset.source === activeHotTab));
    }
  }

  function renderHotList() {
    const list = document.getElementById('hotList');
    const meta = document.getElementById('hotMeta');
    if (!list || !hotData) return;

    if (meta) {
      meta.textContent = hotData.update_time ? '更新时间: ' + hotData.update_time : '';
    }

    const items = (hotData.sources[activeHotTab] || []);
    if (items.length === 0) {
      list.innerHTML = '<div class="hot-empty">该平台暂无数据</div>';
      return;
    }

    list.innerHTML = '';
    items.forEach((item, i) => {
      const a = document.createElement('a');
      a.className = 'hot-item';
      a.href = item.url || '#';
      a.target = '_blank';
      a.rel = 'noopener';

      const rank = document.createElement('span');
      rank.className = 'hot-rank';
      rank.textContent = String(i + 1);

      const title = document.createElement('span');
      title.className = 'hot-title';
      title.textContent = item.title;

      a.appendChild(rank);
      a.appendChild(title);

      if (item.hot) {
        const hot = document.createElement('span');
        hot.className = 'hot-value';
        hot.textContent = item.hot;
        a.appendChild(hot);
      }

      list.appendChild(a);
    });
  }

  function init() {
    els.date.textContent = formatDate();
    bindNav();
    bindTasks();
    bindNotes();
    bindInstall();
    registerServiceWorker();
    renderTasks();
    restoreNotes();
    loadHotData();
  }

  function bindNav() {
    els.navItems.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        switchView(view);
        els.navItems.forEach(b => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
      });
    });
  }

  function switchView(view) {
    els.views.forEach(v => v.classList.toggle('active', v.id === `${view}View`));
  }

  function bindTasks() {
    els.addForm.addEventListener('submit', e => {
      e.preventDefault();
      const text = els.addInput.value.trim();
      if (!text) return;
      addTask(text);
      els.addInput.value = '';
      els.addInput.focus();
    });
  }

  function addTask(text) {
    const task = {
      id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      text,
      done: false
    };
    state.tasks.push(task);
    saveState();
    renderTasks();
    showToast('任务已添加');
  }

  function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.done = !task.done;
    saveState();
    renderTasks();
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
    renderTasks();
    showToast('任务已删除');
  }

  function renderTasks() {
    els.taskList.innerHTML = '';

    if (state.tasks.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'task-empty';
      empty.textContent = '还没有任务，添加一个吧 ✨';
      els.taskList.appendChild(empty);
      updateProgress(0, 0);
      return;
    }

    state.tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item' + (task.done ? ' completed' : '');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = task.done;
      checkbox.setAttribute('aria-label', `标记完成：${task.text}`);
      checkbox.addEventListener('change', () => toggleTask(task.id));

      const span = document.createElement('span');
      span.className = 'task-text';
      span.textContent = task.text;

      const delBtn = document.createElement('button');
      delBtn.className = 'task-delete';
      delBtn.innerHTML = '×';
      delBtn.setAttribute('aria-label', `删除任务：${task.text}`);
      delBtn.addEventListener('click', () => deleteTask(task.id));

      li.appendChild(checkbox);
      li.appendChild(span);
      li.appendChild(delBtn);
      els.taskList.appendChild(li);
    });

    const doneCount = state.tasks.filter(t => t.done).length;
    updateProgress(doneCount, state.tasks.length);
  }

  function updateProgress(done, total) {
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    els.progressText.textContent = `${done} / ${total}`;
    els.progressPercent.textContent = `${percent}%`;
    els.progressFill.style.width = `${percent}%`;
    els.progressBar.setAttribute('aria-valuenow', percent);
  }

  function bindNotes() {
    const fields = [
      ['ideas', els.ideasNote],
      ['trending', els.trendingNote],
      ['review', els.reviewNote]
    ];

    fields.forEach(([key, el]) => {
      if (!el) return;
      el.value = state.notes[key] || '';
      el.addEventListener('input', () => {
        state.notes[key] = el.value;
        saveState();
      });
    });
  }

  function restoreNotes() {
    if (els.ideasNote) els.ideasNote.value = state.notes.ideas || '';
    if (els.trendingNote) els.trendingNote.value = state.notes.trending || '';
    if (els.reviewNote) els.reviewNote.value = state.notes.review || '';
  }

  function bindInstall() {
    els.syncBtn.addEventListener('click', () => {
      els.installModal.classList.add('show');
      els.installModal.setAttribute('aria-hidden', 'false');
    });

    els.closeInstallModal.addEventListener('click', () => {
      els.installModal.classList.remove('show');
      els.installModal.setAttribute('aria-hidden', 'true');
    });

    els.installModal.querySelector('.modal-backdrop').addEventListener('click', () => {
      els.installModal.classList.remove('show');
      els.installModal.setAttribute('aria-hidden', 'true');
    });
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(els.toast._timer);
    els.toast._timer = setTimeout(() => {
      els.toast.classList.remove('show');
    }, 2000);
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('Service Worker 注册失败', err);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
