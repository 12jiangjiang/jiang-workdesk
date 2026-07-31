(() => {
  'use strict';

  const STORAGE_KEY = 'household-budget-app';

  // 分类定义
  const CATEGORIES = {
    expense: [
      { id: 'food', name: '餐饮', icon: '🍜', color: '#FF9800' },
      { id: 'grocery', name: '买菜', icon: '🥬', color: '#4CAF50' },
      { id: 'transport', name: '交通', icon: '🚇', color: '#2196F3' },
      { id: 'shop', name: '购物', icon: '🛍️', color: '#E91E63' },
      { id: 'housing', name: '居家', icon: '🏠', color: '#9C27B0' },
      { id: 'medical', name: '医疗', icon: '💊', color: '#f44336' },
      { id: 'education', name: '教育', icon: '📚', color: '#3F51B5' },
      { id: 'entertainment', name: '娱乐', icon: '🎬', color: '#FF5722' },
      { id: 'beauty', name: '美妆', icon: '💄', color: '#E84A8A' },
      { id: 'baby', name: '育儿', icon: '🍼', color: '#00BCD4' },
      { id: 'social', name: '社交', icon: '🎁', color: '#795548' },
      { id: 'other_exp', name: '其他', icon: '📝', color: '#9E9E9E' },
    ],
    income: [
      { id: 'salary', name: '工资', icon: '💵', color: '#4CAF50' },
      { id: 'bonus', name: '奖金', icon: '🎉', color: '#FF9800' },
      { id: 'sidejob', name: '副业', icon: '💡', color: '#2196F3' },
      { id: 'investment', name: '理财', icon: '📈', color: '#9C27B0' },
      { id: 'redpacket', name: '红包', icon: '🧧', color: '#f44336' },
      { id: 'other_inc', name: '其他', icon: '📝', color: '#9E9E9E' },
    ]
  };

  const allCategories = {};
  [...CATEGORIES.expense, ...CATEGORIES.income].forEach(c => {
    allCategories[c.id] = c;
  });

  // 状态
  let state = loadState();
  let currentType = 'expense';
  let selectedCategory = null;
  let viewMonth = getMonthKey(new Date());
  let currentFilter = 'all';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialState();
      return JSON.parse(raw);
    } catch (e) {
      return createInitialState();
    }
  }

  function createInitialState() {
    return {
      transactions: [],
      budgets: {},
      installed: false
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      showToast('保存失败');
    }
  }

  function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getMonthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function formatDate() {
    const d = new Date();
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
  }

  function formatMonth(mk) {
    const [y, m] = mk.split('-');
    return `${y}年${parseInt(m)}月`;
  }

  function formatMoney(n) {
    return '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  // DOM
  const els = {
    date: document.getElementById('dateDisplay'),
    monthDisplay: document.getElementById('monthDisplay'),
    prevMonth: document.getElementById('prevMonth'),
    nextMonth: document.getElementById('nextMonth'),
    navItems: document.querySelectorAll('.nav-item'),
    views: document.querySelectorAll('.view'),
    typeBtns: document.querySelectorAll('.type-btn'),
    categoryGrid: document.getElementById('categoryGrid'),
    amountInput: document.getElementById('amountInput'),
    noteInput: document.getElementById('noteInput'),
    dateInput: document.getElementById('dateInput'),
    dateTodayBtn: document.getElementById('dateTodayBtn'),
    submitBtn: document.getElementById('submitBtn'),
    totalIncome: document.getElementById('totalIncome'),
    totalExpense: document.getElementById('totalExpense'),
    totalBalance: document.getElementById('totalBalance'),
    categoryStats: document.getElementById('categoryStats'),
    dailyChart: document.getElementById('dailyChart'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    transactionList: document.getElementById('transactionList'),
    budgetTotal: document.getElementById('budgetTotal'),
    budgetSpent: document.getElementById('budgetSpent'),
    budgetRemain: document.getElementById('budgetRemain'),
    budgetProgress: document.getElementById('budgetProgress'),
    budgetHint: document.getElementById('budgetHint'),
    budgetList: document.getElementById('budgetList'),
    addBudgetForm: document.getElementById('addBudgetForm'),
    budgetCategorySelect: document.getElementById('budgetCategorySelect'),
    budgetAmountInput: document.getElementById('budgetAmountInput'),
    monthlyTotalIncome: document.getElementById('monthlyTotalIncome'),
    monthlyTotalExpense: document.getElementById('monthlyTotalExpense'),
    monthlyTotalBalance: document.getElementById('monthlyTotalBalance'),
    monthlyChart: document.getElementById('monthlyChart'),
    monthlyList: document.getElementById('monthlyList'),
    installModal: document.getElementById('installModal'),
    closeInstallModal: document.getElementById('closeInstallModal'),
    toast: document.getElementById('toast')
  };

  function init() {
    els.date.textContent = formatDate();
    els.monthDisplay.textContent = formatMonth(viewMonth);
    els.dateInput.value = getTodayKey();
    bindNav();
    bindTypeToggle();
    bindSubmit();
    bindMonthNav();
    bindFilter();
    bindBudgetForm();
    bindDateInput();
    bindInstall();
    registerServiceWorker();
    renderCategories();
    renderAll();
  }

  // 导航
  function bindNav() {
    els.navItems.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        switchView(view);
        els.navItems.forEach(b => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        // 切到概览或明细时刷新
        if (view === 'overview') renderOverview();
        if (view === 'detail') renderDetail();
        if (view === 'budget') renderBudget();
        if (view === 'monthly') renderMonthly();
      });
    });
  }

  function switchView(view) {
    els.views.forEach(v => v.classList.toggle('active', v.id === `${view}View`));
  }

  // 类型切换
  function bindTypeToggle() {
    els.typeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        currentType = btn.dataset.type;
        els.typeBtns.forEach(b => b.classList.toggle('active', b === btn));
        selectedCategory = null;
        renderCategories();
      });
    });
  }

  // 分类网格
  function renderCategories() {
    els.categoryGrid.innerHTML = '';
    const cats = CATEGORIES[currentType];
    cats.forEach(cat => {
      const div = document.createElement('div');
      div.className = 'category-item' + (selectedCategory === cat.id ? ' active' : '');
      div.innerHTML = `<span class="category-icon">${cat.icon}</span><span class="category-name">${cat.name}</span>`;
      div.addEventListener('click', () => {
        selectedCategory = cat.id;
        renderCategories();
        els.amountInput.focus();
      });
      els.categoryGrid.appendChild(div);
    });
  }

  // 提交记账
  function bindSubmit() {
    els.submitBtn.addEventListener('click', () => {
      const amount = parseFloat(els.amountInput.value);
      if (!amount || amount <= 0) {
        showToast('请输入金额');
        els.amountInput.focus();
        return;
      }
      if (!selectedCategory) {
        showToast('请选择分类');
        return;
      }
      const tx = {
        id: 'tx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        type: currentType,
        category: selectedCategory,
        amount: Math.round(amount * 100) / 100,
        note: els.noteInput.value.trim(),
        date: els.dateInput.value || getTodayKey(),
        month: (els.dateInput.value || getTodayKey()).slice(0, 7),
        createdAt: Date.now()
      };
      state.transactions.unshift(tx);
      saveState();
      // 清空表单
      els.amountInput.value = '';
      els.noteInput.value = '';
      els.dateInput.value = getTodayKey();
      selectedCategory = null;
      renderCategories();
      showToast('记下来了 ✓');
    });
  }

  // 月份切换
  function bindMonthNav() {
    els.prevMonth.addEventListener('click', () => {
      const [y, m] = viewMonth.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      viewMonth = getMonthKey(d);
      els.monthDisplay.textContent = formatMonth(viewMonth);
      renderAll();
    });
    els.nextMonth.addEventListener('click', () => {
      const [y, m] = viewMonth.split('-').map(Number);
      const d = new Date(y, m, 1);
      viewMonth = getMonthKey(d);
      els.monthDisplay.textContent = formatMonth(viewMonth);
      renderAll();
    });
  }

  // 筛选
  function bindFilter() {
    els.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        currentFilter = tab.dataset.filter;
        els.filterTabs.forEach(t => t.classList.toggle('active', t === tab));
        renderDetail();
      });
    });
  }

  // 获取当月交易
  function getMonthTransactions() {
    return state.transactions.filter(t => t.month === viewMonth);
  }

  // 渲染所有
  function renderAll() {
    renderOverview();
    renderDetail();
    renderBudget();
  }

  // 概览
  function renderOverview() {
    const txs = getMonthTransactions();
    let income = 0, expense = 0;
    txs.forEach(t => {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    });
    const balance = income - expense;
    els.totalIncome.textContent = formatMoney(income);
    els.totalExpense.textContent = formatMoney(expense);
    els.totalBalance.textContent = formatMoney(balance);

    // 分类统计
    const catStats = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      if (!catStats[t.category]) catStats[t.category] = 0;
      catStats[t.category] += t.amount;
    });

    const sorted = Object.entries(catStats).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
      els.categoryStats.innerHTML = '<div class="empty-state">暂无支出数据，先记一笔吧 ✨</div>';
    } else {
      els.categoryStats.innerHTML = '';
      const maxVal = sorted[0][1];
      sorted.forEach(([catId, amount]) => {
        const cat = allCategories[catId] || { name: '未知', icon: '❓', color: '#999' };
        const pct = maxVal > 0 ? Math.round((amount / maxVal) * 100) : 0;
        const div = document.createElement('div');
        div.className = 'cat-stat-item';
        div.innerHTML = `
          <div class="cat-stat-header">
            <span class="cat-stat-name">${cat.icon} ${cat.name}</span>
            <span class="cat-stat-amount">${formatMoney(amount)}</span>
          </div>
          <div class="cat-stat-bar">
            <div class="cat-stat-fill" style="width: ${pct}%; background: ${cat.color}"></div>
          </div>`;
        els.categoryStats.appendChild(div);
      });
    }

    // 每日趋势
    renderDailyChart(txs);
  }

  function renderDailyChart(txs) {
    const [y, m] = viewMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const today = getTodayKey();
    const dailyData = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      const day = parseInt(t.date.split('-')[2]);
      if (!dailyData[day]) dailyData[day] = 0;
      dailyData[day] += t.amount;
    });

    const maxVal = Math.max(...Object.values(dailyData), 1);
    els.dailyChart.innerHTML = '';
    for (let day = 1; day <= daysInMonth; day++) {
      const amount = dailyData[day] || 0;
      const height = amount > 0 ? Math.max((amount / maxVal) * 100, 4) : 0;
      const dateStr = `${viewMonth}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === today;
      const wrap = document.createElement('div');
      wrap.className = 'daily-bar-wrap';
      wrap.innerHTML = `
        <div class="daily-bar${isToday ? ' today' : ''}" style="height: ${height}%;" title="${formatMoney(amount)}"></div>
        <span class="daily-bar-label">${day}</span>`;
      els.dailyChart.appendChild(wrap);
    }
  }

  // 流水明细
  function renderDetail() {
    let txs = getMonthTransactions();
    if (currentFilter !== 'all') {
      txs = txs.filter(t => t.type === currentFilter);
    }

    if (txs.length === 0) {
      els.transactionList.innerHTML = '<div class="empty-state">暂无记录</div>';
      return;
    }

    // 按日期分组
    const groups = {};
    txs.forEach(t => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });

    els.transactionList.innerHTML = '';
    Object.keys(groups).sort().reverse().forEach(date => {
      const group = document.createElement('div');
      group.className = 'tx-group';

      const header = document.createElement('div');
      header.className = 'tx-date-header';
      const [yy, mm, dd] = date.split('-').map(Number);
      const d = new Date(yy, mm - 1, dd);
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const todayKey = getTodayKey();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
      let label;
      if (date === todayKey) label = '今天';
      else if (date === yKey) label = '昨天';
      else label = `${mm}月${dd}日`;
      header.textContent = `${label} · ${weekdays[d.getDay()]}`;
      group.appendChild(header);

      groups[date].forEach(tx => {
        const cat = allCategories[tx.category] || { name: '未知', icon: '❓', color: '#999' };
        const item = document.createElement('div');
        item.className = 'tx-item';
        item.innerHTML = `
          <span class="tx-icon" style="background: ${cat.color}22">${cat.icon}</span>
          <div class="tx-info">
            <div class="tx-category">${cat.name}</div>
            ${tx.note ? `<div class="tx-note">${tx.note}</div>` : ''}
          </div>
          <span class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatMoney(tx.amount)}</span>
          <button class="tx-delete" data-id="${tx.id}" aria-label="删除">×</button>`;
        group.appendChild(item);
      });

      els.transactionList.appendChild(group);
    });

    // 绑定删除
    els.transactionList.querySelectorAll('.tx-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        state.transactions = state.transactions.filter(t => t.id !== id);
        saveState();
        renderAll();
        showToast('已删除');
      });
    });
  }

  // 预算
  function renderBudget() {
    const budgets = state.budgets;
    const txs = getMonthTransactions();

    // 总预算
    let totalBudget = 0;
    Object.values(budgets).forEach(v => totalBudget += v);

    // 总支出
    let totalSpent = 0;
    txs.filter(t => t.type === 'expense').forEach(t => {
      if (budgets[t.category]) totalSpent += t.amount;
    });

    const remain = totalBudget - totalSpent;
    els.budgetTotal.textContent = formatMoney(totalBudget);
    els.budgetSpent.textContent = formatMoney(totalSpent);
    els.budgetRemain.textContent = formatMoney(remain);

    const pct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
    els.budgetProgress.style.width = pct + '%';
    els.budgetProgress.classList.toggle('over', totalSpent > totalBudget && totalBudget > 0);

    if (totalBudget === 0) {
      els.budgetHint.textContent = '👇 在下方设置分类预算来控制消费';
    } else if (totalSpent > totalBudget) {
      els.budgetHint.textContent = '⚠️ 本月已超支！注意控制消费';
      els.budgetHint.style.color = 'var(--red)';
    } else {
      els.budgetHint.textContent = `本月预算使用 ${pct.toFixed(0)}%，控制得不错！`;
      els.budgetHint.style.color = 'var(--text-secondary)';
    }

    // 分类预算列表
    els.budgetList.innerHTML = '';
    const budgetEntries = Object.entries(budgets).filter(([_, v]) => v > 0);
    if (budgetEntries.length === 0) {
      els.budgetList.innerHTML = '<div class="empty-state">还没有设置预算</div>';
    } else {
      budgetEntries.forEach(([catId, budget]) => {
        const cat = allCategories[catId] || { name: '未知', icon: '❓', color: '#999' };
        const spent = txs.filter(t => t.type === 'expense' && t.category === catId).reduce((s, t) => s + t.amount, 0);
        const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
        const over = spent > budget;
        const div = document.createElement('div');
        div.className = 'budget-item';
        div.innerHTML = `
          <div class="budget-item-header">
            <span class="budget-item-name">${cat.icon} ${cat.name}</span>
            <span class="budget-item-amounts"><span class="spent">${formatMoney(spent)}</span> / ${formatMoney(budget)}</span>
          </div>
          <div class="budget-item-bar">
            <div class="budget-item-fill" style="width: ${pct}%; background: ${over ? 'var(--red)' : cat.color}"></div>
          </div>`;
        els.budgetList.appendChild(div);
      });
    }

    // 更新下拉选择
    els.budgetCategorySelect.innerHTML = '';
    CATEGORIES.expense.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `${cat.icon} ${cat.name}`;
      els.budgetCategorySelect.appendChild(opt);
    });
  }

  function bindBudgetForm() {
    els.addBudgetForm.addEventListener('submit', e => {
      e.preventDefault();
      const catId = els.budgetCategorySelect.value;
      const amount = parseFloat(els.budgetAmountInput.value);
      if (!catId || !amount || amount <= 0) {
        showToast('请选择分类并输入金额');
        return;
      }
      state.budgets[catId] = Math.round(amount * 100) / 100;
      saveState();
      els.budgetAmountInput.value = '';
      renderBudget();
      showToast('预算已设置 ✓');
    });
  }

  // 日期选择器
  function bindDateInput() {
    els.dateTodayBtn.addEventListener('click', () => {
      els.dateInput.value = getTodayKey();
    });
  }

  // 月统计
  function getRecent6Months() {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(getMonthKey(d));
    }
    return months;
  }

  function getMonthStats(mk) {
    const txs = state.transactions.filter(t => t.month === mk);
    let income = 0, expense = 0;
    txs.forEach(t => {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    });
    return { income, expense, balance: income - expense, count: txs.length };
  }

  function renderMonthly() {
    const months = getRecent6Months();
    const allStats = months.map(mk => ({ mk, ...getMonthStats(mk) }));

    // 汇总
    const totalIncome = allStats.reduce((s, m) => s + m.income, 0);
    const totalExpense = allStats.reduce((s, m) => s + m.expense, 0);
    els.monthlyTotalIncome.textContent = formatMoney(totalIncome);
    els.monthlyTotalExpense.textContent = formatMoney(totalExpense);
    els.monthlyTotalBalance.textContent = formatMoney(totalIncome - totalExpense);

    // 柱状图
    const maxVal = Math.max(...allStats.map(m => Math.max(m.income, m.expense)), 1);
    els.monthlyChart.innerHTML = '';
    allStats.forEach(m => {
      const [, mon] = m.mk.split('-');
      const incomeH = Math.max((m.income / maxVal) * 100, m.income > 0 ? 4 : 0);
      const expenseH = Math.max((m.expense / maxVal) * 100, m.expense > 0 ? 4 : 0);
      const col = document.createElement('div');
      col.className = 'monthly-bar-wrap';
      col.innerHTML = `
        <div class="monthly-bars">
          <div class="monthly-bar income" style="height: ${incomeH}%;" title="收入 ${formatMoney(m.income)}"></div>
          <div class="monthly-bar expense" style="height: ${expenseH}%;" title="支出 ${formatMoney(m.expense)}"></div>
        </div>
        <span class="monthly-bar-label">${parseInt(mon)}月</span>`;
      els.monthlyChart.appendChild(col);
    });

    // 月度明细列表（倒序）
    const reversed = [...allStats].reverse();
    els.monthlyList.innerHTML = '';
    reversed.forEach(m => {
      const [, mon] = m.mk.split('-');
      const [y, mm] = m.mk.split('-');
      const div = document.createElement('div');
      div.className = 'monthly-item';
      const rate = m.income > 0 ? Math.round((m.expense / m.income) * 100) : 0;
      const rateLabel = rate > 100 ? '<span class="monthly-rate over">超支</span>' : `<span class="monthly-rate">${rate}%</span>`;
      div.innerHTML = `
        <div class="monthly-item-header">
          <span class="monthly-item-month">${y}年${parseInt(mm)}月</span>
          ${rateLabel}
        </div>
        <div class="monthly-item-stats">
          <div class="monthly-stat">
            <span class="monthly-stat-label">收入</span>
            <span class="monthly-stat-value income">${formatMoney(m.income)}</span>
          </div>
          <div class="monthly-stat">
            <span class="monthly-stat-label">支出</span>
            <span class="monthly-stat-value expense">${formatMoney(m.expense)}</span>
          </div>
          <div class="monthly-stat">
            <span class="monthly-stat-label">结余</span>
            <span class="monthly-stat-value balance">${formatMoney(m.balance)}</span>
          </div>
          <div class="monthly-stat">
            <span class="monthly-stat-label">笔数</span>
            <span class="monthly-stat-value">${m.count}</span>
          </div>
        </div>`;
      els.monthlyList.appendChild(div);
    });
  }

  // 安装提示
  function bindInstall() {
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
