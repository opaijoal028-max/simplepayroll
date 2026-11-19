/* =========================================================
   Simple Payroll System — application logic
   Plain JS, no build step. Data is kept in localStorage.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Formatting helpers ---------- */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  var usd = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  function money(n) { return usd.format(round2(Number(n) || 0)); }
  function money0(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('en-US'); }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  function monthLabel(key, short) {
    var p = String(key || '').split('-');
    var y = Number(p[0]), m = Number(p[1]);
    if (!y || !m) return '—';
    return (short ? MONTHS[m - 1].slice(0, 3) : MONTHS[m - 1]) + ' ' + y;
  }
  function periodLabel(key) {
    var p = String(key || '').split('-');
    var y = Number(p[0]), m = Number(p[1]);
    if (!y || !m) return '—';
    var abbr = MONTHS[m - 1].slice(0, 3);
    var last = new Date(y, m, 0).getDate();
    return '01 ' + abbr + ' – ' + last + ' ' + abbr + ' ' + y;
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function addMonths(key, delta) {
    var p = String(key).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function fullDate() {
    return new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function sum(list, fn) {
    return round2(list.reduce(function (t, x) { return t + fn(x); }, 0));
  }

  /* ---------- Calculations ---------- */
  function grossOf(r) { return round2(r.basic + r.allowances); }
  function netOf(r) { return round2(grossOf(r) - r.deductions); }

  /* ---------- Icons (lucide, 1.5 stroke) ---------- */
  function icon(name, size) {
    var paths = {
      check: '<polyline points="20 6 9 17 4 12"/>',
      plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
      pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
      trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
      receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8"/><path d="M8 12h6"/>',
      printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6"/><rect width="12" height="8" x="6" y="14" rx="1"/>'
    };
    var s = size || 16;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" width="' + s + '" height="' + s + '" aria-hidden="true">' +
      (paths[name] || '') + '</svg>';
  }

  /* ---------- Store ---------- */
  var STORAGE_KEY = 'simplepayroll.v1';
  var DB = { employees: [], payroll: [] };
  var storageOK = true;

  var COMPANY = {
    name: 'Meridian Supply Co.',
    address: '1204 Rennet Street, Portland, OR 97204'
  };

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); }
    catch (e) { storageOK = false; }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.employees) || !Array.isArray(parsed.payroll)) return false;
      DB = { employees: parsed.employees, payroll: parsed.payroll };
      return true;
    } catch (e) { return false; }
  }

  /* ---------- Seed (plausible classroom data) ---------- */
  var SEED_EMPLOYEES = [
    ['EMP-1042', 'Marcus Villaverde', 'Operations Supervisor', 3400],
    ['EMP-1043', 'Aileen Ocampo', 'Accounts Assistant', 2450],
    ['EMP-1044', 'Joselito Ramos', 'Warehouse Lead', 2870],
    ['EMP-1045', 'Priya Nandakumar', 'Data Analyst', 3150],
    ['EMP-1046', 'Tomas Berg', 'Maintenance Technician', 2380],
    ['EMP-1047', 'Grace Whitfield', 'HR Coordinator', 2680],
    ['EMP-1048', 'Daniel Okafor', 'Delivery Driver', 2100],
    ['EMP-1049', 'Sofia Marchetti', 'Customer Support', 2250]
  ];
  var SEED_ALLOWANCES = [250, 180, 220, 300, 160, 200, 120, 175];

  function seed() {
    DB.employees = SEED_EMPLOYEES.map(function (e) {
      return { id: e[0], name: e[1], position: e[2], basic: e[3] };
    });

    var today = todayKey();
    var payroll = [];
    var n = 0;

    for (var back = 5; back >= 0; back--) {
      var month = addMonths(today, -back);
      // The current month is mid-run: five of eight employees are entered.
      var crew = back === 0 ? DB.employees.slice(0, 5) : DB.employees;

      crew.forEach(function (emp, ei) {
        var allow = round2(SEED_ALLOWANCES[ei] + ((back * 17 + ei * 7) % 60));
        var gross = round2(emp.basic + allow);
        var ded = Math.round((gross * 0.18) / 5) * 5;
        n++;
        payroll.push({
          id: 'PR-' + String(n).padStart(4, '0'),
          employeeId: emp.id,
          employeeName: emp.name,
          position: emp.position,
          month: month,
          basic: emp.basic,
          allowances: allow,
          deductions: ded,
          createdAt: month + '-28'
        });
      });
    }

    DB.payroll = payroll;
    save();
  }

  /* ---------- State ---------- */
  var state = {
    view: 'dashboard',
    dashMonth: todayKey(),
    histMonth: 'all',
    histQuery: '',
    empQuery: '',
    editingId: null,
    payslipId: null
  };

  /* ---------- DOM ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Lookups ---------- */
  function monthsWithData() {
    var seen = {};
    DB.payroll.forEach(function (r) { seen[r.month] = true; });
    return Object.keys(seen).sort().reverse();
  }
  function availableMonths() {
    var list = monthsWithData();
    if (list.indexOf(todayKey()) === -1) list.push(todayKey());
    return list.sort().reverse();
  }
  function recordsFor(month) {
    return DB.payroll.filter(function (r) { return r.month === month; });
  }
  function findRecord(id) {
    for (var i = 0; i < DB.payroll.length; i++) {
      if (DB.payroll[i].id === id) return DB.payroll[i];
    }
    return null;
  }
  function findEmployee(id) {
    for (var i = 0; i < DB.employees.length; i++) {
      if (DB.employees[i].id === id) return DB.employees[i];
    }
    return null;
  }
  function onRegister() { return DB.employees.length; }

  /* =========================================================
     Rendering
     ========================================================= */

  var VIEW_META = {
    dashboard: { title: 'Payroll summary', sub: 'Net pay, allowances and deductions by month' },
    employees: { title: 'Employees', sub: '' },
    payroll: { title: 'Run payroll', sub: 'One record per employee each month' },
    history: { title: 'Payroll history', sub: '' }
  };

  function renderHeader() {
    var meta = VIEW_META[state.view];
    $('#page-title').textContent = meta.title;

    var sub = meta.sub;
    if (state.view === 'employees') {
      sub = onRegister() + (onRegister() === 1 ? ' employee on the register' : ' employees on the register');
    } else if (state.view === 'history') {
      sub = DB.payroll.length + ' records across ' + monthsWithData().length + ' months';
    }
    $('#page-sub').textContent = sub;
  }

  function renderNav() {
    $$('.nav-item').forEach(function (btn) {
      var isActive = btn.getAttribute('data-view') === state.view;
      if (isActive) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    $('#nav-count-employees').textContent = onRegister();
    $('#nav-count-records').textContent = DB.payroll.length;
    $('#side-period').textContent = monthLabel(todayKey());
  }

  function renderTopbar() {
    var host = $('#topbar-actions');
    host.innerHTML = '';

    if (state.view === 'dashboard') {
      var wrap = document.createElement('div');
      wrap.className = 'field field-inline';
      wrap.innerHTML = '<label for="dash-month">Month</label>' +
        '<select class="input" id="dash-month">' +
        availableMonths().map(function (m) {
          return '<option value="' + m + '"' + (m === state.dashMonth ? ' selected' : '') + '>' +
            esc(monthLabel(m)) + '</option>';
        }).join('') +
        '</select>';
      host.appendChild(wrap);
      $('#dash-month').addEventListener('change', function () {
        state.dashMonth = this.value;
        renderDashboard();
      });
    }

    if (state.view === 'employees') {
      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn btn-primary';
      add.innerHTML = icon('plus') + '<span>Add employee</span>';
      add.addEventListener('click', function () { openEmployeeForm(null); });
      host.appendChild(add);
    }
  }

  function switchView(view) {
    if (VIEW_META[view] === undefined) view = 'dashboard';
    state.view = view;

    $$('.view').forEach(function (sec) {
      sec.hidden = sec.id !== 'view-' + view;
    });

    renderHeader();
    renderNav();
    renderTopbar();
    if (view === 'dashboard') renderDashboard();
    if (view === 'employees') renderEmployees();
    if (view === 'payroll') renderPayrollPreview();
    if (view === 'history') renderHistory();

    var section = $('#view-' + view);
    section.classList.remove('enter');
    void section.offsetWidth;
    section.classList.add('enter');
  }

  /* ---------- Summary view ---------- */
  function renderDashboard() {
    if (state.view !== 'dashboard') return;
    var month = state.dashMonth;
    var rows = recordsFor(month);
    var prev = addMonths(month, -1);
    var prevRows = recordsFor(prev);

    var gross = sum(rows, grossOf);
    var net = sum(rows, netOf);
    var prevGross = sum(prevRows, grossOf);
    var prevNet = sum(prevRows, netOf);

    $('#dash-stats').innerHTML = [
      stat('Employees', String(onRegister()), 'on the register', false),
      stat('Records', String(rows.length), 'for ' + monthLabel(month), false),
      stat('Gross pay', money(gross), deltaLine(gross - prevGross, monthLabel(prev, true)), false),
      stat('Net pay', money(net), deltaLine(net - prevNet, monthLabel(prev, true)), true)
    ].join('');

    renderChart(rows, month);
    $('#ranked-sub').textContent = monthLabel(month, true);
    renderRanked(rows);
    renderPending(month);
  }

  function renderPending(month) {
    var paid = {};
    recordsFor(month).forEach(function (r) { paid[r.employeeId] = true; });

    var waiting = DB.employees.filter(function (e) { return !paid[e.id]; })
      .sort(function (a, b) { return a.id.localeCompare(b.id); });

    var host = $('#pending-list');
    var done = $('#pending-done');
    $('#pending-sub').textContent = monthLabel(month, true);

    if (!waiting.length) {
      host.innerHTML = '';
      host.hidden = true;
      done.hidden = false;
      done.textContent = DB.employees.length
        ? 'Every employee on the register has a record for ' + monthLabel(month) + '.'
        : 'No employees on the register yet.';
      return;
    }

    host.hidden = false;
    done.hidden = true;
    host.innerHTML = waiting.map(function (e) {
      return '<li>' +
        '<div class="pending-who">' +
          '<span class="pending-name">' + esc(e.name) + '</span>' +
          '<span class="pending-meta">' + esc(e.id) + ' · ' + esc(e.position) + '</span>' +
        '</div>' +
        '<div class="pending-right">' +
          '<span class="pending-basic">' + money(e.basic) + '</span>' +
          '<button class="btn btn-quiet" type="button" data-run="' + esc(e.id) + '">Run payroll</button>' +
        '</div>' +
        '</li>';
    }).join('');
  }

  function stat(label, value, meta, accent) {
    return '<article class="stat">' +
      '<p class="stat-label">' + esc(label) + '</p>' +
      '<p class="stat-value' + (accent ? ' is-accent' : '') + '">' + esc(value) + '</p>' +
      '<p class="stat-meta">' + meta + '</p>' +
      '</article>';
  }

  function deltaLine(diff, ref) {
    var d = round2(diff);
    if (d === 0) return '<span>no change vs ' + esc(ref) + '</span>';
    var sign = d > 0 ? '+' : '−';
    return '<span class="delta">' + sign + money(Math.abs(d)) + '</span> vs ' + esc(ref);
  }

  function renderRanked(rows) {
    var host = $('#ranked-list');
    if (!rows.length) {
      host.innerHTML = '<li><p class="rank-meta">No records for this month.</p></li>';
      return;
    }
    var sorted = rows.slice().sort(function (a, b) { return netOf(b) - netOf(a); }).slice(0, 5);
    var max = netOf(sorted[0]) || 1;

    host.innerHTML = sorted.map(function (r, i) {
      var pct = Math.max(2, (netOf(r) / max) * 100);
      return '<li' + (i === 0 ? ' class="is-lead"' : '') + '>' +
        '<div class="rank-top"><span class="rank-name">' + esc(r.employeeName) + '</span>' +
        '<span class="rank-amt">' + money(netOf(r)) + '</span></div>' +
        '<div class="rank-bar"><div class="rank-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
        '</li>';
    }).join('');
  }

  var chartTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(chartTimer);
    chartTimer = setTimeout(function () { renderDashboard(); }, 140);
  });

  function niceCeil(v) {
    if (v <= 0) return 1;
    var step = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / step;
    var mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return mult * step;
  }

  function renderChart(rows, month) {
    var el = $('#chart');
    var months = [];
    for (var i = 5; i >= 0; i--) months.push(addMonths(month, -i));

    var data = months.map(function (m) {
      return { month: m, value: sum(recordsFor(m), netOf) };
    });

    $('#chart-sub').textContent = monthLabel(months[0], true) + ' – ' + monthLabel(month, true);

    var max = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([0]));
    if (max === 0) {
      el.innerHTML = '<p class="chart-empty">No payroll recorded yet. Run payroll to start the trend.</p>';
      return;
    }

    var w = el.clientWidth || 720;
    var h = 300;
    var pad = { top: 30, right: 8, bottom: 36, left: 72 };
    var plotW = Math.max(80, w - pad.left - pad.right);
    var plotH = h - pad.top - pad.bottom;
    var top = niceCeil(max);
    var band = plotW / data.length;
    var barW = Math.min(46, band * 0.46);
    var showValues = band >= 58;
    var fullLabels = band >= 78;

    function yPos(v) { return pad.top + plotH - (v / top) * plotH; }

    var parts = [];

    // Grid and value axis
    for (var t = 0; t <= 4; t++) {
      var val = (top / 4) * t;
      var y = yPos(val);
      parts.push('<line class="grid-line" x1="' + pad.left + '" y1="' + y + '" x2="' + (w - pad.right) + '" y2="' + y + '"/>');
      parts.push('<text class="axis-label" x="' + (pad.left - 12) + '" y="' + (y + 4) + '" text-anchor="end">' + money0(val) + '</text>');
    }

    parts.push('<line class="axis-line" x1="' + pad.left + '" y1="' + yPos(0) + '" x2="' + (w - pad.right) + '" y2="' + yPos(0) + '"/>');

    data.forEach(function (d, i) {
      var bx = pad.left + i * band;
      var cx = bx + band / 2;
      var barH = (d.value / top) * plotH;
      var barX = cx - barW / 2;

      parts.push('<g class="bar-group">');
      parts.push('<rect class="hit" x="' + bx + '" y="' + pad.top + '" width="' + band + '" height="' + plotH + '" fill="transparent"/>');
      if (d.value > 0) {
        parts.push('<rect class="bar' + (d.month === month ? ' is-selected' : '') + '" x="' + barX.toFixed(1) +
          '" y="' + yPos(d.value).toFixed(1) + '" width="' + barW.toFixed(1) +
          '" height="' + barH.toFixed(1) + '" rx="2"/>');
        if (showValues) {
          parts.push('<text class="bar-value" x="' + cx.toFixed(1) + '" y="' + (yPos(d.value) - 8).toFixed(1) +
            '" text-anchor="middle">' + money0(d.value) + '</text>');
        }
      }
      parts.push('<text class="axis-label" x="' + cx.toFixed(1) + '" y="' + (pad.top + plotH + 22) + '" text-anchor="middle">' +
        esc(fullLabels ? monthLabel(d.month, true) : MONTHS[Number(d.month.split('-')[1]) - 1].slice(0, 3)) + '</text>');
      parts.push('<title>' + esc(monthLabel(d.month)) + ' · ' + money(d.value) + '</title>');
      parts.push('</g>');
    });

    el.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" role="img" ' +
      'aria-label="Net payroll by month, ' + esc(monthLabel(months[0], true)) + ' to ' + esc(monthLabel(month, true)) + '">' +
      parts.join('') + '</svg>';
  }

  $('#pending-list').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-run]');
    if (!btn) return;
    var empId = btn.getAttribute('data-run');
    switchView('payroll');
    $('#pf-employee').value = empId;
    $('#pf-month').value = state.dashMonth;
    renderPayrollPreview();
    $('#pf-allowances').focus();
  });

  /* ---------- Employees view ---------- */
  function renderEmployees() {
    var q = state.empQuery.trim().toLowerCase();
    var list = DB.employees.slice().sort(function (a, b) {
      return a.id.localeCompare(b.id);
    });
    if (q) {
      list = list.filter(function (e) {
        return e.id.toLowerCase().indexOf(q) !== -1 || e.name.toLowerCase().indexOf(q) !== -1;
      });
    }

    var body = $('#emp-body');
    var empty = $('#emp-empty');

    body.innerHTML = list.map(function (e) {
      return '<tr>' +
        '<td class="id">' + esc(e.id) + '</td>' +
        '<td class="cell-name">' + esc(e.name) + '</td>' +
        '<td>' + esc(e.position) + '</td>' +
        '<td class="num">' + money(e.basic) + '</td>' +
        '<td class="col-actions"><div class="row-actions">' +
        '<button class="btn btn-icon" type="button" data-act="edit" data-id="' + esc(e.id) + '" aria-label="Edit ' + esc(e.name) + '">' + icon('pencil') + '</button>' +
        '<button class="btn btn-icon" type="button" data-act="delete" data-id="' + esc(e.id) + '" aria-label="Delete ' + esc(e.name) + '">' + icon('trash') + '</button>' +
        '</div></td>' +
        '</tr>';
    }).join('');

    if (list.length) {
      empty.hidden = true;
    } else {
      empty.hidden = false;
      empty.textContent = DB.employees.length
        ? 'No employee matches ' + state.empQuery.trim() + '.'
        : 'No employees yet. Use Add employee to record the first one.';
    }

    $('#emp-foot').innerHTML = list.length
      ? '<tr><td></td><td class="tfoot-label">Total monthly basic</td><td class="col-position"></td>' +
        '<td class="num">' + money(sum(list, function (e) { return e.basic; })) + '</td>' +
        '<td class="col-actions"></td></tr>'
      : '';

    $('#emp-count').textContent = list.length + ' of ' + DB.employees.length;
    $('#nav-count-employees').textContent = onRegister();
    renderHeader();
  }

  $('#emp-search').addEventListener('input', function () {
    state.empQuery = this.value;
    renderEmployees();
  });

  $('#emp-body').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    if (btn.getAttribute('data-act') === 'edit') openEmployeeForm(id);
    else askDeleteEmployee(id);
  });

  /* ---------- Employee form ---------- */
  function nextEmployeeId() {
    var max = 1041;
    DB.employees.forEach(function (e) {
      var n = parseInt(String(e.id).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return 'EMP-' + (max + 1);
  }

  function openEmployeeForm(id) {
    var emp = id ? findEmployee(id) : null;
    state.editingId = emp ? emp.id : null;

    $('#ef-title').textContent = emp ? 'Edit employee' : 'Add employee';
    $('#ef-submit').textContent = emp ? 'Save changes' : 'Add employee';
    $('#ef-id').value = emp ? emp.id : nextEmployeeId();
    $('#ef-id').readOnly = !!emp;
    $('#ef-name').value = emp ? emp.name : '';
    $('#ef-position').value = emp ? emp.position : '';
    $('#ef-salary').value = emp ? emp.basic : '';
    clearErrors('#emp-form');
    $('#dlg-employee').showModal();
    setTimeout(function () { (emp ? $('#ef-name') : $('#ef-id')).focus(); }, 30);
  }

  $('#emp-form').addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors('#emp-form');

    var id = $('#ef-id').value.trim().toUpperCase();
    var name = $('#ef-name').value.trim();
    var position = $('#ef-position').value.trim();
    var salaryRaw = $('#ef-salary').value;
    var errs = {};

    if (!id) errs['ef-id'] = 'Employee ID is required';
    else if (!/^[A-Z0-9-]{3,16}$/.test(id)) errs['ef-id'] = 'Use 3–16 letters, numbers or dashes';
    else if (DB.employees.some(function (e) { return e.id === id && e.id !== state.editingId; })) errs['ef-id'] = 'That employee ID is already used';

    if (!name) errs['ef-name'] = 'Full name is required';
    if (!position) errs['ef-position'] = 'Position is required';

    if (salaryRaw === '') errs['ef-salary'] = 'Basic salary is required';
    else if (!isFinite(Number(salaryRaw))) errs['ef-salary'] = 'Enter a number';
    else if (Number(salaryRaw) < 0) errs['ef-salary'] = 'Basic salary cannot be negative';

    if (Object.keys(errs).length) { showErrors(errs, '#emp-form'); return; }

    var basic = round2(Number(salaryRaw));

    if (state.editingId) {
      var emp = findEmployee(state.editingId);
      emp.name = name;
      emp.position = position;
      emp.basic = basic;
      // Keep payslips readable: recorded names follow the employee. Amounts
      // stay as they were at the time the payroll was run.
      DB.payroll.forEach(function (r) {
        if (r.employeeId === emp.id) { r.employeeName = name; r.position = position; }
      });
      save();
      $('#dlg-employee').close();
      toast('Employee updated');
    } else {
      DB.employees.push({ id: id, name: name, position: position, basic: basic });
      save();
      $('#dlg-employee').close();
      toast('Employee added');
    }

    renderEmployees();
    renderPayrollPreview();
    renderDashboard();
  });

  function askDeleteEmployee(id) {
    var emp = findEmployee(id);
    if (!emp) return;
    var hasHistory = DB.payroll.some(function (r) { return r.employeeId === id; });
    askConfirm({
      title: 'Delete employee',
      text: 'Delete ' + emp.name + ' (' + emp.id + ')?' +
        (hasHistory ? ' Payroll already recorded for this employee stays in the history.' : ''),
      okLabel: 'Delete employee',
      onOk: function () {
        DB.employees = DB.employees.filter(function (e) { return e.id !== id; });
        save();
        renderEmployees();
        renderPayrollPreview();
        renderDashboard();
        renderHistory();
        toast('Employee deleted');
      }
    });
  }

  function clearErrors(scope) {
    $$('.field-error', $(scope)).forEach(function (p) { p.hidden = true; p.textContent = ''; });
    $$('.input.invalid', $(scope)).forEach(function (i) { i.classList.remove('invalid'); });
  }
  function showErrors(errs, scope) {
    Object.keys(errs).forEach(function (fieldId) {
      var input = document.getElementById(fieldId);
      var msg = document.getElementById(fieldId + '-err');
      if (input) input.classList.add('invalid');
      if (msg) { msg.textContent = errs[fieldId]; msg.hidden = false; }
    });
    var first = document.getElementById(Object.keys(errs)[0]);
    if (first) first.focus();
  }

  /* ---------- Run payroll ---------- */
  function employeeOptions() {
    var sel = $('#pf-employee');
    var current = sel.value;
    sel.innerHTML = '<option value="">Select an employee</option>' +
      DB.employees.slice().sort(function (a, b) { return a.id.localeCompare(b.id); })
        .map(function (e) {
          return '<option value="' + esc(e.id) + '">' + esc(e.name) + ' · ' + esc(e.id) + '</option>';
        }).join('');
    sel.value = current;
  }

  function payrollInputs() {
    var empId = $('#pf-employee').value;
    var month = $('#pf-month').value;
    var allowanceRaw = $('#pf-allowances').value;
    var deductionRaw = $('#pf-deductions').value;
    var emp = findEmployee(empId);
    return {
      emp: emp,
      month: month,
      allowances: allowanceRaw === '' ? 0 : Number(allowanceRaw),
      deductions: deductionRaw === '' ? 0 : Number(deductionRaw)
    };
  }

  function existingRecord(empId, month) {
    for (var i = 0; i < DB.payroll.length; i++) {
      if (DB.payroll[i].employeeId === empId && DB.payroll[i].month === month) return DB.payroll[i];
    }
    return null;
  }

  function renderPayrollPreview() {
    if (!DB.employees.length) {
      $('#pf-employee').disabled = true;
    } else {
      $('#pf-employee').disabled = false;
    }
    employeeOptions();

    var v = payrollInputs();
    var host = $('#payroll-preview');

    if (!v.emp) {
      host.innerHTML = '<p class="preview-empty">Select an employee to see the pay breakdown.</p>';
      $('#pf-basic').value = money(0);
      return;
    }

    $('#pf-basic').value = money(v.emp.basic);

    var allowances = isFinite(v.allowances) ? v.allowances : 0;
    var deductions = isFinite(v.deductions) ? v.deductions : 0;
    var gross = round2(v.emp.basic + allowances);
    var net = round2(gross - deductions);

    host.innerHTML =
      '<div class="breakdown">' +
        '<div class="breakdown-head">' +
          '<p class="breakdown-name">' + esc(v.emp.name) + '</p>' +
          '<p class="breakdown-meta">' + esc(v.emp.id) + ' · ' + esc(v.emp.position) + '</p>' +
        '</div>' +
        '<p class="breakdown-period">' + esc(v.month ? periodLabel(v.month) : 'Select a payroll month') + '</p>' +
        '<div class="ledger">' +
          '<p class="ledger-head">Earnings</p>' +
          '<div class="ledger-line"><span>Basic salary</span><span class="money">' + money(v.emp.basic) + '</span></div>' +
          '<div class="ledger-line"><span>Allowances</span><span class="money">' + money(allowances) + '</span></div>' +
          '<div class="ledger-line is-sub"><span>Gross pay</span><span class="money">' + money(gross) + '</span></div>' +
          '<p class="ledger-head">Deductions</p>' +
          '<div class="ledger-line"><span>Deductions</span><span class="money">' + money(deductions) + '</span></div>' +
          '<div class="ledger-line is-sub"><span>Total deductions</span><span class="money">' + money(deductions) + '</span></div>' +
        '</div>' +
        '<div class="ledger-total"><span class="label">Net pay</span><span class="money">' + money(net) + '</span></div>' +
        '<div class="total-rule"></div>' +
      '</div>';
  }

  ['#pf-employee', '#pf-month', '#pf-allowances', '#pf-deductions'].forEach(function (sel) {
    document.addEventListener('input', function (e) {
      if (e.target.matches(sel)) renderPayrollPreview();
    });
  });
  ['#pf-employee', '#pf-month'].forEach(function (sel) {
    document.addEventListener('change', function (e) {
      if (e.target.matches(sel)) renderPayrollPreview();
    });
  });

  $('#pf-allowances').addEventListener('input', function () { this.classList.remove('invalid'); });
  $('#pf-deductions').addEventListener('input', function () { this.classList.remove('invalid'); });

  $('#payroll-form').addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors('#payroll-form');
    hideAlert();

    var v = payrollInputs();
    var problems = [];

    if (!v.emp) problems.push('Select an employee');
    if (!v.month) problems.push('Select a payroll month');

    if (!isFinite(v.allowances)) problems.push('Allowances must be a number');
    else if (v.allowances < 0) problems.push('Allowances cannot be negative');

    if (!isFinite(v.deductions)) problems.push('Deductions must be a number');
    else if (v.deductions < 0) problems.push('Deductions cannot be negative');

    if (v.emp && isFinite(v.allowances) && v.allowances >= 0 && isFinite(v.deductions) && v.deductions >= 0) {
      var gross = round2(v.emp.basic + v.allowances);
      if (v.deductions > gross) {
        problems.push('Deductions (' + money(v.deductions) + ') cannot be more than gross pay (' + money(gross) + ')');
        $('#pf-deductions').classList.add('invalid');
      }
    }

    if (v.emp && v.month) {
      var dup = existingRecord(v.emp.id, v.month);
      if (dup) problems.push(v.emp.name + ' already has a payroll record for ' + monthLabel(v.month) + ' (' + dup.id + ')');
    }

    if (problems.length) {
      if (!v.emp) $('#pf-employee').classList.add('invalid');
      if (!v.month) $('#pf-month').classList.add('invalid');
      if (isFinite(v.allowances) && v.allowances < 0) $('#pf-allowances').classList.add('invalid');
      if (isFinite(v.deductions) && v.deductions < 0) $('#pf-deductions').classList.add('invalid');
      showAlert(problems);
      return;
    }

    var record = {
      id: nextRecordId(),
      employeeId: v.emp.id,
      employeeName: v.emp.name,
      position: v.emp.position,
      month: v.month,
      basic: v.emp.basic,
      allowances: round2(v.allowances),
      deductions: round2(v.deductions),
      createdAt: new Date().toISOString().slice(0, 10)
    };

    DB.payroll.push(record);
    save();

    state.dashMonth = v.month;
    if (state.view === 'dashboard') renderTopbar();

    resetPayrollForm();
    renderDashboard();
    renderHistory();
    renderNav();
    toast('Payroll saved for ' + record.employeeName + ' · ' + monthLabel(record.month));
    askConfirm({
      title: 'Payroll saved',
      text: 'Payslip ' + record.id + ' for ' + record.employeeName + ' · ' + monthLabel(record.month) +
        '. Net pay ' + money(netOf(record)) + '.',
      okLabel: 'Open payslip',
      danger: false,
      cancelLabel: 'Not now',
      onOk: function () { openPayslip(record.id); }
    });
  });

  function resetPayrollForm() {
    $('#pf-employee').value = '';
    $('#pf-month').value = todayKey();
    $('#pf-allowances').value = 0;
    $('#pf-deductions').value = 0;
    clearErrors('#payroll-form');
    hideAlert();
    renderPayrollPreview();
  }
  $('#pf-reset').addEventListener('click', function (e) {
    e.preventDefault();
    resetPayrollForm();
  });

  function showAlert(list) {
    var el = $('#pf-alert');
    el.innerHTML = list.length > 1
      ? '<div><p>Fix these before saving</p><ul>' + list.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>'
      : '<div><p>' + esc(list[0]) + '</p></div>';
    el.hidden = false;
  }
  function hideAlert() { $('#pf-alert').hidden = true; }

  function nextRecordId() {
    var max = 0;
    DB.payroll.forEach(function (r) {
      var n = parseInt(String(r.id).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return 'PR-' + String(max + 1).padStart(4, '0');
  }

  /* ---------- History view ---------- */
  function renderHistory() {
    var avail = availableMonths();
    if (state.histMonth !== 'all' && avail.indexOf(state.histMonth) === -1) state.histMonth = 'all';

    var sel = $('#hist-month');
    if (sel.options.length !== avail.length + 1) {
      sel.innerHTML = '<option value="all">All months</option>' +
        avail.map(function (m) {
          return '<option value="' + m + '">' + esc(monthLabel(m)) + '</option>';
        }).join('');
      sel.value = state.histMonth;
    }

    var q = state.histQuery.trim().toLowerCase();
    var list = DB.payroll.filter(function (r) {
      if (state.histMonth !== 'all' && r.month !== state.histMonth) return false;
      if (q && r.employeeName.toLowerCase().indexOf(q) === -1 && r.employeeId.toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) {
      if (a.month !== b.month) return a.month < b.month ? 1 : -1;
      return a.employeeName.localeCompare(b.employeeName);
    });

    $('#hist-body').innerHTML = list.map(function (r) {
      return '<tr>' +
        '<td class="id">' + esc(r.id) + '</td>' +
        '<td><span class="cell-name">' + esc(r.employeeName) + '</span> <span class="cell-sub mono">' + esc(r.employeeId) + '</span></td>' +
        '<td class="col-month">' + esc(monthLabel(r.month, true)) + '</td>' +
        '<td class="num col-basic">' + money(r.basic) + '</td>' +
        '<td class="num col-allow">' + money(r.allowances) + '</td>' +
        '<td class="num col-gross">' + money(grossOf(r)) + '</td>' +
        '<td class="num col-ded">' + money(r.deductions) + '</td>' +
        '<td class="num">' + money(netOf(r)) + '</td>' +
        '<td class="col-actions"><div class="row-actions">' +
        '<button class="btn btn-icon" type="button" data-act="payslip" data-id="' + esc(r.id) + '" aria-label="Open payslip ' + esc(r.id) + '">' + icon('receipt') + '</button>' +
        '<button class="btn btn-icon" type="button" data-act="remove" data-id="' + esc(r.id) + '" aria-label="Delete payroll record ' + esc(r.id) + '">' + icon('trash') + '</button>' +
        '</div></td>' +
        '</tr>';
    }).join('');

    var empty = $('#hist-empty');
    if (list.length) {
      empty.hidden = true;
    } else {
      empty.hidden = false;
      empty.textContent = DB.payroll.length
        ? 'No payroll record matches this filter.'
        : 'No payroll records yet. Use Run payroll to record the first one.';
    }

    // Totals row: single rule above, double rule below.
    var foot = $('#hist-foot');
    if (list.length) {
      foot.innerHTML = '<tr>' +
        '<td class="id"></td>' +
        '<td class="tfoot-label">Totals</td>' +
        '<td class="col-month cell-sub">' + esc(state.histMonth === 'all' ? 'All months' : monthLabel(state.histMonth, true)) + '</td>' +
        '<td class="num col-basic">' + money(sum(list, function (r) { return r.basic; })) + '</td>' +
        '<td class="num col-allow">' + money(sum(list, function (r) { return r.allowances; })) + '</td>' +
        '<td class="num col-gross">' + money(sum(list, grossOf)) + '</td>' +
        '<td class="num col-ded">' + money(sum(list, function (r) { return r.deductions; })) + '</td>' +
        '<td class="num">' + money(sum(list, netOf)) + '</td>' +
        '<td class="col-actions"></td>' +
        '</tr>';
    } else {
      foot.innerHTML = '';
    }

    $('#hist-count').textContent = list.length + ' of ' + DB.payroll.length;
    renderHeader();
  }

  $('#hist-month').addEventListener('change', function () {
    state.histMonth = this.value;
    renderHistory();
  });
  $('#hist-search').addEventListener('input', function () {
    state.histQuery = this.value;
    renderHistory();
  });

  $('#hist-body').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    if (btn.getAttribute('data-act') === 'payslip') openPayslip(id);
    else askDeleteRecord(id);
  });

  function askDeleteRecord(id) {
    var r = findRecord(id);
    if (!r) return;
    askConfirm({
      title: 'Delete payroll record',
      text: 'Delete payslip ' + r.id + ' for ' + r.employeeName + ' · ' + monthLabel(r.month) + '? ' +
        'The employee can be paid for that month again once the record is removed.',
      okLabel: 'Delete record',
      onOk: function () {
        DB.payroll = DB.payroll.filter(function (x) { return x.id !== id; });
        save();
        renderHistory();
        renderDashboard();
        renderNav();
        renderPayrollPreview();
        toast('Payroll record deleted');
      }
    });
  }

  /* ---------- Payslip ---------- */
  function payslipHTML(r) {
    var gross = grossOf(r);
    return '' +
      '<article class="sheet" aria-label="Payslip ' + esc(r.id) + '">' +
        '<header class="sheet-head">' +
          '<div>' +
            '<p class="sheet-co">' + esc(COMPANY.name) + '</p>' +
            '<p class="sheet-addr">' + esc(COMPANY.address) + '</p>' +
          '</div>' +
          '<div class="sheet-tag">' +
            '<p class="sheet-tag-label">Payslip ' + esc(r.id) + '</p>' +
            '<p class="sheet-tag-period">' + esc(monthLabel(r.month)) + '</p>' +
          '</div>' +
        '</header>' +
        '<hr class="rule">' +
        '<dl class="sheet-meta">' +
          '<div><dt>Employee</dt><dd>' + esc(r.employeeName) + '</dd></div>' +
          '<div><dt>Employee ID</dt><dd class="mono">' + esc(r.employeeId) + '</dd></div>' +
          '<div><dt>Position</dt><dd>' + esc(r.position) + '</dd></div>' +
          '<div><dt>Pay period</dt><dd>' + esc(periodLabel(r.month)) + '</dd></div>' +
        '</dl>' +
        '<section class="sheet-block">' +
          '<p class="sheet-block-title">Earnings</p>' +
          '<div class="sheet-line"><span>Basic salary</span><span class="money">' + money(r.basic) + '</span></div>' +
          '<div class="sheet-line"><span>Allowances</span><span class="money">' + money(r.allowances) + '</span></div>' +
          '<div class="sheet-line is-sub"><span>Gross pay</span><span class="money">' + money(gross) + '</span></div>' +
        '</section>' +
        '<section class="sheet-block">' +
          '<p class="sheet-block-title">Deductions</p>' +
          '<div class="sheet-line"><span>Deductions</span><span class="money">' + money(r.deductions) + '</span></div>' +
          '<div class="sheet-line is-sub"><span>Total deductions</span><span class="money">' + money(r.deductions) + '</span></div>' +
        '</section>' +
        '<div class="sheet-total"><span class="label">Net pay</span><span class="money">' + money(netOf(r)) + '</span></div>' +
        '<div class="total-rule"></div>' +
        '<div class="sheet-sign">' +
          '<div><span></span><p>Prepared by</p></div>' +
          '<div><span></span><p>Received by</p></div>' +
        '</div>' +
        '<div class="sheet-perf"></div>' +
        '<p class="sheet-foot">Generated ' + esc(fullDate()) + ' · Simple Payroll System</p>' +
      '</article>';
  }

  function openPayslip(id) {
    var r = findRecord(id);
    if (!r) return;
    state.payslipId = id;
    $('#payslip-body').innerHTML = payslipHTML(r);
    $('#dlg-payslip').showModal();
  }

  function printPayslip() {
    if (!state.payslipId) return;
    var r = findRecord(state.payslipId);
    if (!r) return;
    $('#print-root').innerHTML = payslipHTML(r);
    document.body.classList.add('printing');
    window.print();
  }

  $('#payslip-print').addEventListener('click', printPayslip);

  window.addEventListener('beforeprint', function () {
    if (document.body.classList.contains('printing')) return;
    if ($('#dlg-payslip').open && state.payslipId) {
      var r = findRecord(state.payslipId);
      if (r) {
        $('#print-root').innerHTML = payslipHTML(r);
        document.body.classList.add('printing');
      }
    }
  });
  window.addEventListener('afterprint', function () {
    document.body.classList.remove('printing');
    $('#print-root').innerHTML = '';
  });

  /* ---------- Dialogs ---------- */
  $$('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var dlg = btn.closest('dialog');
      if (dlg) dlg.close();
    });
  });

  var confirmHandler = null;
  function askConfirm(opts) {
    $('#confirm-title').textContent = opts.title;
    $('#confirm-text').textContent = opts.text;
    var ok = $('#confirm-ok');
    var cancel = $('#confirm-cancel');
    ok.textContent = opts.okLabel || 'Confirm';
    ok.className = 'btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger-solid');
    cancel.textContent = opts.cancelLabel || 'Cancel';
    confirmHandler = opts.onOk || null;
    $('#dlg-confirm').showModal();
  }
  $('#confirm-ok').addEventListener('click', function () {
    var fn = confirmHandler;
    confirmHandler = null;
    $('#dlg-confirm').close();
    if (fn) fn();
  });
  $('#confirm-cancel').addEventListener('click', function () {
    confirmHandler = null;
    $('#dlg-confirm').close();
  });

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(message) {
    var el = $('#toast');
    el.innerHTML = icon('check') + '<span>' + esc(message) + '</span>';
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2800);
  }

  /* ---------- Navigation ---------- */
  $$('.nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () { switchView(btn.getAttribute('data-view')); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && $('#dlg-confirm').open) { confirmHandler = null; }
  });

  /* ---------- Boot ---------- */
  function boot() {
    if (!load()) seed();

    // Show the closest month that has records.
    var months = monthsWithData();
    state.dashMonth = months.indexOf(todayKey()) !== -1 ? todayKey() : (months[0] || todayKey());
    state.histMonth = months[0] || 'all';

    $('#pf-month').value = todayKey();
    employeeOptions();
    renderNav();
    switchView('dashboard');

    if (!storageOK) {
      toast('Saved for this tab only — storage is unavailable');
    }
  }

  boot();
})();
