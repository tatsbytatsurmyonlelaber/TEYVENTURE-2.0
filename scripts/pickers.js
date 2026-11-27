/* Custom Field Components */
(function () {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var ICON_CHEVRON = '<svg class="ct-pick-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var ICON_CAL = '<svg class="ct-pick-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  var ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  var widgets = [];
  var current = null;   // the widget whose popup is open

  /* date helpers (ISO yyyy-mm-dd strings, no time zones) */
  function p2(n) { return String(n).padStart(2, '0'); }
  function iso(y, m, d) { return y + '-' + p2(m + 1) + '-' + p2(d); }
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
  }
  function fromUTC(d) { return iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
  function todayIso() { var d = new Date(); return iso(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(s, n) { var p = parse(s); return fromUTC(new Date(Date.UTC(p.y, p.m, p.d + n))); }
  function addMonths(s, n) {
    var p = parse(s);
    var last = new Date(Date.UTC(p.y, p.m + n + 1, 0)).getUTCDate();
    return fromUTC(new Date(Date.UTC(p.y, p.m + n, Math.min(p.d, last))));
  }
  function weekday(s) { var p = parse(s); return new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay(); }
  function shortLabel(s) { var p = parse(s); return DAYS[weekday(s)].slice(0, 3) + ', ' + MON[p.m] + ' ' + p.d + ', ' + p.y; }
  function longLabel(s) { var p = parse(s); return DAYS[weekday(s)] + ', ' + MONTHS[p.m] + ' ' + p.d + ', ' + p.y; }

  /* shared helpers */
  function make(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function fire(field) {
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // label: focuses the new trigger; returns the label so it can name the trigger
  function hookLabel(field, trigger) {
    var lab = field.id && document.querySelector('label[for="' + field.id + '"]');
    if (!lab) return null;
    if (!lab.id) lab.id = field.id + '-label';
    lab.addEventListener('click', function (e) { e.preventDefault(); trigger.focus(); });
    return lab;
  }

  // copy the error / valid state that contact.js puts on the hidden field
  function mirror(field, trigger) {
    function update() {
      if (field.getAttribute('aria-invalid') === 'true') trigger.setAttribute('aria-invalid', 'true');
      else trigger.removeAttribute('aria-invalid');
      trigger.classList.toggle('is-valid', field.classList.contains('is-valid'));
    }
    new MutationObserver(update).observe(field, { attributes: true, attributeFilter: ['aria-invalid', 'class'] });
    update();
  }

  // open upward when there is no room below
  function place(root, pop) {
    pop.classList.remove('is-up');
    var r = root.getBoundingClientRect();
    var h = pop.offsetHeight + 12;
    if (window.innerHeight - r.bottom < h && r.top > h) pop.classList.add('is-up');
  }

  function shell(field, kind) {
    var root = make('div', 'ct-pick ' + kind);
    root.setAttribute('data-for', field.name);
    var btn = make('button', 'ct-pick-btn');
    btn.type = 'button';
    btn.id = field.id + '-btn';
    var val = make('span', 'ct-pick-val');
    val.id = field.id + '-val';
    btn.appendChild(val);
    var desc = field.getAttribute('aria-describedby');
    if (desc) btn.setAttribute('aria-describedby', desc);
    field.after(root);
    root.appendChild(btn);
    field.hidden = true;
    field._tvTrigger = btn;   // contact.js focuses this when the field has an error
    return { root: root, btn: btn, val: val, lab: hookLabel(field, btn) };
  }

  function wireCommon(api, root, pop) {
    pop.addEventListener('mousedown', function (e) { e.preventDefault(); });   // keep focus where it is
    root.addEventListener('focusout', function (e) {
      if (api.isOpen() && e.relatedTarget && !root.contains(e.relatedTarget)) api.close(false);
    });
  }

  function openWidget(api) {
    if (current && current !== api) current.close(false);
    current = api;
  }

  document.addEventListener('pointerdown', function (e) {
    if (current && !current.root.contains(e.target)) current.close(false);
  });

  /* combo box (select-only) */
  function makeSelect(sel) {
    var s = shell(sel, 'ct-cb');
    var root = s.root, btn = s.btn, val = s.val;
    s.btn.insertAdjacentHTML('beforeend', ICON_CHEVRON);

    var list = make('ul', 'ct-pick-pop ct-cb-list');
    list.id = sel.id + '-list';
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    root.appendChild(list);

    btn.setAttribute('role', 'combobox');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', list.id);
    if (s.lab) {
      btn.setAttribute('aria-labelledby', s.lab.id + ' ' + val.id);
      list.setAttribute('aria-labelledby', s.lab.id);
    }

    // options marked hidden (like "Choose a topic") are prompts, not choices
    var opts = [];
    Array.prototype.forEach.call(sel.options, function (o, i) {
      if (o.hidden) return;
      var li = make('li', 'ct-cb-opt');
      li.id = sel.id + '-opt-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.textContent = o.text;
      list.appendChild(li);
      opts.push({ value: o.value, text: o.text, li: li });
    });

    var active = -1;
    var api;

    function indexOf(v) {
      for (var i = 0; i < opts.length; i++) if (opts[i].value === v) return i;
      return -1;
    }
    function setActive(i) {
      if (active > -1 && opts[active]) opts[active].li.classList.remove('is-active');
      active = i;
      if (i < 0) { btn.removeAttribute('aria-activedescendant'); return; }
      var li = opts[i].li;
      li.classList.add('is-active');
      btn.setAttribute('aria-activedescendant', li.id);
      if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop - 6;
      else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight + 6;
      }
    }
    function sync() {
      var o = sel.options[sel.selectedIndex];
      val.textContent = o ? o.text : '';
      root.classList.toggle('is-empty', !sel.value);
      opts.forEach(function (x) { x.li.setAttribute('aria-selected', x.value === sel.value ? 'true' : 'false'); });
    }
    function choose(i) {
      if (i < 0) return;
      var changed = sel.value !== opts[i].value;
      sel.value = opts[i].value;
      sync();
      if (changed) fire(sel);
    }
    function isOpen() { return !list.hidden; }
    function open() {
      openWidget(api);
      list.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      root.classList.add('is-open');
      place(root, list);
      setActive(Math.max(0, indexOf(sel.value)));
    }
    function close(focusBtn) {
      if (current === api) current = null;
      list.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      root.classList.remove('is-open');
      setActive(-1);
      if (focusBtn) btn.focus();
    }

    // type a letter to jump to an option
    var typed = '', typedTimer;
    function match(ch) {
      clearTimeout(typedTimer);
      typed += ch.toLowerCase();
      typedTimer = setTimeout(function () { typed = ''; }, 600);
      var from = active < 0 ? indexOf(sel.value) : active;
      var start = typed.length === 1 ? from + 1 : Math.max(from, 0);
      for (var k = 0; k < opts.length; k++) {
        var i = (start + k + opts.length) % opts.length;
        if (opts[i].text.toLowerCase().indexOf(typed) === 0) return i;
      }
      return -1;
    }
    function printable(e) { return e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey; }

    btn.addEventListener('click', function () { if (isOpen()) close(true); else open(); });

    btn.addEventListener('keydown', function (e) {
      var k = e.key, last = opts.length - 1;
      if (!isOpen()) {
        if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') {
          e.preventDefault(); open();
          if (k === 'ArrowUp' && indexOf(sel.value) < 0) setActive(last);
        } else if (k === 'Home' || k === 'End') {
          e.preventDefault(); open(); setActive(k === 'Home' ? 0 : last);
        } else if (printable(e)) {
          choose(match(e.key));   // like a normal select: typing changes the value
        }
        return;
      }
      if (k === 'ArrowDown') { e.preventDefault(); setActive(Math.min(last, active + 1)); }
      else if (k === 'ArrowUp') {
        e.preventDefault();
        if (e.altKey) { choose(active); close(true); } else setActive(Math.max(0, active - 1));
      }
      else if (k === 'Home') { e.preventDefault(); setActive(0); }
      else if (k === 'End') { e.preventDefault(); setActive(last); }
      else if (k === 'PageDown') { e.preventDefault(); setActive(Math.min(last, active + 5)); }
      else if (k === 'PageUp') { e.preventDefault(); setActive(Math.max(0, active - 5)); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(active); close(true); }
      else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (k === 'Tab') { choose(active); close(false); }
      else if (printable(e)) { var i = match(e.key); if (i > -1) setActive(i); }
    });

    list.addEventListener('mousemove', function (e) {
      var li = e.target.closest('.ct-cb-opt');
      if (!li) return;
      var i = opts.findIndex(function (x) { return x.li === li; });
      if (i !== active) setActive(i);
    });
    list.addEventListener('click', function (e) {
      var li = e.target.closest('.ct-cb-opt');
      if (!li) return;
      choose(opts.findIndex(function (x) { return x.li === li; }));
      close(true);
    });

    api = { root: root, close: close, isOpen: isOpen, sync: sync };
    wireCommon(api, root, list);
    mirror(sel, btn);
    sync();
    return api;
  }

  /* date picker */
  function makeDate(inp) {
    var s = shell(inp, 'ct-dp');
    var root = s.root, btn = s.btn, val = s.val;
    btn.insertAdjacentHTML('beforeend', ICON_CAL);

    var labelText = s.lab ? s.lab.textContent.replace('*', '').trim() : 'date';
    var pop = make('div', 'ct-pick-pop ct-dp-pop');
    pop.id = inp.id + '-cal';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'false');
    pop.setAttribute('aria-label', 'Choose ' + labelText.toLowerCase());
    pop.hidden = true;
    pop.innerHTML =
      '<div class="ct-dp-head">' +
        '<button type="button" class="ct-dp-nav" data-move="-1" aria-label="Previous month">' + ICON_PREV + '</button>' +
        '<h3 class="ct-dp-title" id="' + inp.id + '-title" aria-live="polite"></h3>' +
        '<button type="button" class="ct-dp-nav" data-move="1" aria-label="Next month">' + ICON_NEXT + '</button>' +
      '</div>' +
      '<table class="ct-dp-grid" role="grid" aria-labelledby="' + inp.id + '-title">' +
        '<thead><tr>' + DAYS.map(function (d) {
          return '<th scope="col" abbr="' + d + '"><span aria-hidden="true">' + d.charAt(0) + '</span><span class="ct-sr">' + d + '</span></th>';
        }).join('') + '</tr></thead>' +
        '<tbody></tbody>' +
      '</table>' +
      '<div class="ct-dp-foot">' +
        '<button type="button" class="ct-dp-link" data-act="clear">Clear</button>' +
        '<button type="button" class="ct-dp-link" data-act="today">Today</button>' +
      '</div>';
    root.appendChild(pop);

    var title = pop.querySelector('.ct-dp-title');
    var body = pop.querySelector('tbody');
    var prevBtn = pop.querySelector('[data-move="-1"]');
    var nextBtn = pop.querySelector('[data-move="1"]');
    var clearBtn = pop.querySelector('[data-act="clear"]');
    var todayBtn = pop.querySelector('[data-act="today"]');

    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', pop.id);
    if (s.lab) btn.setAttribute('aria-labelledby', s.lab.id + ' ' + val.id);

    var focusDate = todayIso();
    var api;

    // min / max are read every time, because contact.js changes them (departure can't be before arrival)
    function inRange(d) { return (!inp.min || d >= inp.min) && (!inp.max || d <= inp.max); }
    function clamp(d) {
      if (inp.min && d < inp.min) return inp.min;
      if (inp.max && d > inp.max) return inp.max;
      return d;
    }

    function render() {
      var p = parse(focusDate);
      var first = iso(p.y, p.m, 1);
      var daysInMonth = new Date(Date.UTC(p.y, p.m + 1, 0)).getUTCDate();
      var rows = Math.ceil((weekday(first) + daysInMonth) / 7);
      var start = addDays(first, -weekday(first));
      var today = todayIso();

      title.textContent = MONTHS[p.m] + ' ' + p.y;
      prevBtn.disabled = !!inp.min && addDays(first, -1) < inp.min;
      nextBtn.disabled = !!inp.max && addMonths(first, 1) > inp.max;
      todayBtn.disabled = !inRange(today);
      clearBtn.disabled = !inp.value;

      var html = '';
      for (var w = 0; w < rows; w++) {
        html += '<tr>';
        for (var c = 0; c < 7; c++) {
          var d = addDays(start, w * 7 + c);
          var dp = parse(d);
          var cls = 'ct-dp-day';
          if (dp.m !== p.m) cls += ' is-out';
          if (d === today) cls += ' is-today';
          if (d === inp.value) cls += ' is-sel';
          html += '<td role="gridcell" aria-selected="' + (d === inp.value) + '">' +
            '<button type="button" class="' + cls + '" data-date="' + d + '"' +
            ' tabindex="' + (d === focusDate ? 0 : -1) + '"' +
            ' aria-label="' + longLabel(d) + '"' +
            (d === today ? ' aria-current="date"' : '') +
            (inRange(d) ? '' : ' disabled') + '>' + dp.d + '</button></td>';
        }
        html += '</tr>';
      }
      body.innerHTML = html;
    }

    function focusDay() {
      var b = body.querySelector('[data-date="' + focusDate + '"]');
      if (b) b.focus();
    }

    function go(d, focus) {
      var wasInside = pop.contains(document.activeElement);
      focusDate = clamp(d);
      render();
      if (focus || (wasInside && !pop.contains(document.activeElement))) focusDay();
    }

    function sync() {
      val.textContent = inp.value ? shortLabel(inp.value) : 'Pick a date';
      root.classList.toggle('is-empty', !inp.value);
      if (isOpen()) render();
    }

    function setValue(d) {
      var changed = inp.value !== d;
      inp.value = d;
      sync();
      if (changed) fire(inp);
    }

    function isOpen() { return !pop.hidden; }
    function open() {
      openWidget(api);
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      root.classList.add('is-open');
      var today = todayIso();
      focusDate = clamp(inp.value || (inp.min && inp.min > today ? inp.min : today));
      render();
      place(root, pop);
      focusDay();
    }
    function close(focusBtn) {
      if (current === api) current = null;
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      root.classList.remove('is-open');
      if (focusBtn) btn.focus();
    }

    btn.addEventListener('click', function () { if (isOpen()) close(true); else open(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' && !isOpen()) { e.preventDefault(); open(); }
    });

    pop.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    });

    prevBtn.addEventListener('click', function () { go(addMonths(focusDate, -1), false); });
    nextBtn.addEventListener('click', function () { go(addMonths(focusDate, 1), false); });
    clearBtn.addEventListener('click', function () { setValue(''); close(true); });
    todayBtn.addEventListener('click', function () { setValue(todayIso()); close(true); });

    body.addEventListener('click', function (e) {
      var b = e.target.closest('.ct-dp-day');
      if (!b || b.disabled) return;
      setValue(b.getAttribute('data-date'));
      close(true);
    });

    body.addEventListener('keydown', function (e) {
      var d = e.target.getAttribute && e.target.getAttribute('data-date');
      if (!d) return;
      var next = null;
      switch (e.key) {
        case 'ArrowLeft': next = addDays(d, -1); break;
        case 'ArrowRight': next = addDays(d, 1); break;
        case 'ArrowUp': next = addDays(d, -7); break;
        case 'ArrowDown': next = addDays(d, 7); break;
        case 'Home': next = addDays(d, -weekday(d)); break;
        case 'End': next = addDays(d, 6 - weekday(d)); break;
        case 'PageUp': next = addMonths(d, e.shiftKey ? -12 : -1); break;
        case 'PageDown': next = addMonths(d, e.shiftKey ? 12 : 1); break;
      }
      if (next) { e.preventDefault(); go(next, true); }
    });

    api = { root: root, close: close, isOpen: isOpen, sync: sync };
    wireCommon(api, root, pop);
    mirror(inp, btn);
    sync();
    return api;
  }

  /* multi-select combo box with chips */
  function makeMulti(group) {
    var chipsWrap = group.querySelector('.ct-chips');
    var boxes = Array.prototype.slice.call(chipsWrap.querySelectorAll('input[type="checkbox"]'));
    if (!boxes.length) return null;
    var name = boxes[0].name;
    var gid = group.id || ('ct-' + name);
    var legend = group.querySelector('legend');
    if (legend && !legend.id) legend.id = gid + '-legend';
    var placeholder = group.getAttribute('data-placeholder') || 'Choose';

    var root = make('div', 'ct-pick ct-mc');
    root.setAttribute('data-for', name);

    var box = make('div', 'ct-mc-box');
    var input = make('input', 'ct-mc-input');
    input.type = 'text';
    input.id = gid + '-input';
    input.autocomplete = 'off';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', gid + '-list');
    if (legend) input.setAttribute('aria-labelledby', legend.id);
    var desc = group.getAttribute('aria-describedby');
    if (desc) input.setAttribute('aria-describedby', desc);
    var wrap = make('span', 'ct-mc-chips');      // one line of chips; the ones that don't fit are hidden
    var more = make('span', 'ct-mc-more');       // the "..." shown when some chips are hidden
    more.textContent = '\u2026';
    more.setAttribute('role', 'img');
    more.hidden = true;
    box.appendChild(wrap);
    box.appendChild(input);
    box.insertAdjacentHTML('beforeend', ICON_CHEVRON);

    var list = make('ul', 'ct-pick-pop ct-cb-list ct-mc-list');
    list.id = gid + '-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-multiselectable', 'true');
    if (legend) list.setAttribute('aria-labelledby', legend.id);
    list.hidden = true;

    root.appendChild(box);
    root.appendChild(list);
    chipsWrap.after(root);
    chipsWrap.hidden = true;
    boxes.forEach(function (b) { b._tvTrigger = input; });   // contact.js focuses this on error

    var opts = boxes.map(function (b, i) {
      var text = b.parentNode.textContent.trim();
      var li = make('li', 'ct-cb-opt');
      li.id = gid + '-opt-' + i;
      li.setAttribute('role', 'option');
      li.textContent = text;
      list.appendChild(li);
      return { box: b, text: text, li: li };
    });
    var empty = make('li', 'ct-mc-empty');
    empty.textContent = 'No matches';
    empty.hidden = true;
    list.appendChild(empty);

    var active = -1;
    var api;

    function shown() {
      var r = [];
      opts.forEach(function (o, i) { if (!o.li.hidden) r.push(i); });
      return r;
    }
    function setActive(i) {
      if (active > -1) opts[active].li.classList.remove('is-active');
      active = i;
      if (i < 0) { input.removeAttribute('aria-activedescendant'); return; }
      var li = opts[i].li;
      li.classList.add('is-active');
      input.setAttribute('aria-activedescendant', li.id);
      if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop - 6;
      else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight + 6;
      }
    }
    function move(step) {
      var v = shown();
      if (!v.length) return;
      var p = v.indexOf(active);
      var n = p < 0 ? (step > 0 ? 0 : v.length - 1) : Math.max(0, Math.min(v.length - 1, p + step));
      setActive(v[n]);
    }
    // typing filters the list
    function filter() {
      var q = input.value.trim().toLowerCase();
      var any = false;
      opts.forEach(function (o) {
        var show = !q || o.text.toLowerCase().indexOf(q) > -1;
        o.li.hidden = !show;
        if (show) any = true;
      });
      empty.hidden = any;
      var v = shown();
      if (v.indexOf(active) < 0) setActive(v.length ? v[0] : -1);
    }

    function sync() {
      Array.prototype.forEach.call(wrap.querySelectorAll('.ct-mc-chip'), function (c) { c.remove(); });
      var count = 0;
      opts.forEach(function (o) {
        o.li.setAttribute('aria-selected', o.box.checked ? 'true' : 'false');
        if (!o.box.checked) return;
        count++;
        var chip = make('span', 'ct-mc-chip');
        var label = make('span');
        label.textContent = o.text;
        var x = make('button', 'ct-mc-x');
        x.type = 'button';
        x.setAttribute('aria-label', 'Remove ' + o.text);
        x.innerHTML = '<span aria-hidden="true">&times;</span>';
        x.addEventListener('click', function () { toggle(o, false); input.focus(); });
        chip.appendChild(label);
        chip.appendChild(x);
        wrap.appendChild(chip);
      });
      wrap.appendChild(more);
      input.placeholder = count ? '' : placeholder;
      root.classList.toggle('is-empty', !count);
      layout();
    }

    // keep the chips on one line: hide the ones that don't fit and show "..."
    var MIN_INPUT = 56, GAP = 6;
    function layout() {
      var chips = Array.prototype.slice.call(wrap.querySelectorAll('.ct-mc-chip'));
      chips.forEach(function (c) { c.hidden = false; });
      more.hidden = true;
      if (!chips.length) return;
      var cs = getComputedStyle(box);
      var ico = box.querySelector('.ct-pick-ico');
      var avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) -
        (ico ? ico.getBoundingClientRect().width : 0) - MIN_INPUT - GAP * 2;
      if (avail <= 0) return;   // not visible yet (the observer calls this again when it is)
      var total = GAP * (chips.length - 1);
      chips.forEach(function (c) { total += c.offsetWidth; });
      if (total <= avail) return;
      more.hidden = false;
      var room = avail - more.offsetWidth - GAP, used = 0, fit = 0;
      for (var i = 0; i < chips.length; i++) {
        var w = chips[i].offsetWidth + (i ? GAP : 0);
        if (used + w > room) break;
        used += w; fit++;
      }
      if (fit < 1) fit = 1;   // always show at least one; a long name is cut with ...
      chips.forEach(function (c, i) { c.hidden = i >= fit; });
      var n = chips.length - fit;
      more.setAttribute('aria-label', n + ' more selected');
      more.title = n + ' more selected';
    }
    if (window.ResizeObserver) new ResizeObserver(layout).observe(box);
    else window.addEventListener('resize', layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

    function toggle(o, on) {
      var next = on === undefined ? !o.box.checked : on;
      if (o.box.checked === next) return;
      o.box.checked = next;
      sync();
      fire(o.box);
    }

    function isOpen() { return !list.hidden; }
    function open() {
      if (isOpen()) return;
      openWidget(api);
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      root.classList.add('is-open');
      filter();
      place(root, list);
      if (active < 0) { var v = shown(); setActive(v.length ? v[0] : -1); }
    }
    function close(focusInput) {
      if (current === api) current = null;
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      root.classList.remove('is-open');
      input.value = '';
      filter();
      setActive(-1);
      if (focusInput) input.focus();
    }

    // click anywhere in the box (except a chip's x) to open / close
    box.addEventListener('mousedown', function (e) {
      if (e.target.closest('.ct-mc-x')) return;
      if (e.target !== input) {
        e.preventDefault();
        input.focus();
        if (isOpen()) close(false); else open();
      } else if (!isOpen()) {
        open();
      }
    });

    input.addEventListener('input', function () { open(); filter(); });

    input.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'ArrowDown') { e.preventDefault(); if (isOpen()) move(1); else open(); }
      else if (k === 'ArrowUp') { e.preventDefault(); if (isOpen()) move(-1); else open(); }
      else if (k === 'Enter') {
        e.preventDefault();   // never submit the form from here
        if (!isOpen()) open();
        else if (active > -1) { toggle(opts[active]); input.value = ''; filter(); }
      }
      else if (k === 'Escape') {
        if (isOpen()) { e.preventDefault(); e.stopPropagation(); close(false); }
      }
      else if (k === 'Backspace' && !input.value) {
        var picked = opts.filter(function (o) { return o.box.checked; });
        if (picked.length) { e.preventDefault(); toggle(picked[picked.length - 1], false); }
      }
      else if (k === 'Tab' && isOpen()) { close(false); }
    });

    list.addEventListener('mousemove', function (e) {
      var li = e.target.closest('.ct-cb-opt');
      if (!li) return;
      var i = opts.findIndex(function (o) { return o.li === li; });
      if (i !== active) setActive(i);
    });
    list.addEventListener('click', function (e) {
      var li = e.target.closest('.ct-cb-opt');
      if (!li) return;
      toggle(opts[opts.findIndex(function (o) { return o.li === li; })]);
      input.value = '';
      filter();
      input.focus();
    });

    // show contact.js errors (it puts .is-bad on the fieldset)
    function mirrorBad() {
      if (group.classList.contains('is-bad')) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    new MutationObserver(mirrorBad).observe(group, { attributes: true, attributeFilter: ['class'] });

    api = { root: root, close: close, isOpen: isOpen, sync: sync };
    wireCommon(api, root, list);
    mirrorBad();
    sync();
    return api;
  }

  /* start */
  function syncAll() { widgets.forEach(function (w) { w.sync(); }); }

  Array.prototype.forEach.call(document.querySelectorAll('.ct-form select, .ct-form input[type="date"]'), function (f) {
    if (!f.id || !f.name) return;
    widgets.push(f.tagName === 'SELECT' ? makeSelect(f) : makeDate(f));
  });

  /* put "Where do you want to go?" and "What do you enjoy?" side by side, right above the message box */
  (function () {
    var dest = document.getElementById('ct-destinations');
    var inter = document.getElementById('ct-interests');
    var notes = document.getElementById('ct-notes');
    if (!dest || !inter || !notes) return;
    var anchor = notes.closest('.ct-f') || notes;
    var row = make('div', 'ct-row ct-mc-row');
    [dest, inter].forEach(function (g) {
      var cell = make('div', 'ct-mc-cell');   // not .ct-f: its text-input styles would leak onto the combo's inner input
      var err = document.getElementById(g.id + '-err');
      cell.appendChild(g);
      if (err && !g.contains(err)) cell.appendChild(err);
      row.appendChild(cell);
    });
    anchor.parentNode.insertBefore(row, anchor);
  })();

  Array.prototype.forEach.call(document.querySelectorAll('.ct-form .ct-group'), function (g) {
    if (!g.querySelector('.ct-chips')) return;
    var w = makeMulti(g);
    if (w) widgets.push(w);
  });

  Array.prototype.forEach.call(document.querySelectorAll('.ct-form'), function (form) {
    form.addEventListener('reset', function () { setTimeout(syncAll, 0); });
  });

  window.TVPickers = { syncAll: syncAll };
})();