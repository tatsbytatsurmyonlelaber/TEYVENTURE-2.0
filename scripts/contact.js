/* ==========================================================
   TeyVenture contact page
   Two inquiry types in one form: "general" and "custom" itinerary.
   - validates on blur and on submit (only the fields of the chosen type)
   - dates, trip length, traveler steppers, children's ages
   - keeps a draft for the browser tab, prefills from the URL
   URL options:  contact.html?type=custom&dest=liyue
                 contact.html?package=LIYU-02&title=Harbor%20Escape
   ========================================================== */
(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form) return;

  /* ---------- things you will want to edit ---------- */
  var DEFAULTS = {
    endpoint: '',        // your form service / server URL. Empty = demo mode (nothing is sent).
    onSubmit: null,      // or: function (data) { return fetch(...); }  (must return a promise)
    minMessage: 20,      // shortest general message
    maxYearsAhead: 2,    // furthest travel date
    maxTripDays: 30,     // longest trip the form accepts
    draftKey: 'teyventure-contact-draft'
  };
  var CFG = Object.assign({}, DEFAULTS, window.TEYVENTURE_CONTACT || {});

  /* ---------- which fields belong to which inquiry ---------- */
  var COMMON = ['name', 'email', 'phone', 'consent'];
  var BY_TYPE = {
    general: ['topic', 'message'],
    custom: ['destinations', 'startDate', 'endDate', 'adults', 'children', 'childAges']
  };
  var TEXT = {
    general: { submit: 'Send inquiry', done: 'Inquiry sent', lead: 'We\u2019ll reply to' },
    custom: { submit: 'Request my itinerary', done: 'Itinerary request sent', lead: 'We\u2019ll start planning your trip and reply to' }
  };
  var GROUPS = { destinations: true, interests: true };   // chip groups (fieldsets)
  var CHECKS = { consent: true, flexible: true };         // single checkboxes

  var banner = document.getElementById('ct-banner');
  var submitBtn = document.getElementById('ct-submit');
  var success = document.getElementById('ct-success');
  var secGeneral = document.getElementById('ct-sec-general');
  var secCustom = document.getElementById('ct-sec-custom');
  var sending = false;

  /* ---------- helpers ---------- */
  function p2(n) { return String(n).padStart(2, '0'); }
  function isoOf(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function today() { return isoOf(new Date()); }
  function yearsAhead(n) { var d = new Date(); d.setFullYear(d.getFullYear() + n); return isoOf(d); }
  function utc(iso) { var a = iso.split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); }
  function daysBetween(a, b) { return Math.round((utc(b) - utc(a)) / 86400000); }
  function ctl(n) { return document.getElementById('ct-' + n); }
  function type() { return form.elements.type.value; }
  function checked(n) {
    return Array.prototype.map.call(form.querySelectorAll('input[name="' + n + '"]:checked'), function (i) { return i.value; });
  }
  function get(n) {
    if (GROUPS[n]) return checked(n);
    if (CHECKS[n]) return ctl(n).checked;
    return ctl(n).value;
  }
  function intRule(min, max, tooLow, tooHigh) {
    return function (v) {
      var s = String(v).trim();
      if (!/^\d+$/.test(s)) return 'Enter a whole number.';
      var n = +s;
      if (n < min) return tooLow;
      if (n > max) return tooHigh;
      return '';
    };
  }

  /* ---------- rules: each returns an error message, or '' when fine ---------- */
  var RULES = {
    name: function (v) {
      v = v.trim();
      if (!v) return 'Enter your full name.';
      if (v.length < 2) return 'Your name needs at least 2 characters.';
      if (!/^[\p{L}][\p{L}\s'\u2019.\-]*$/u.test(v)) return 'Use letters, spaces, apostrophes, periods or hyphens only.';
      return '';
    },
    email: function (v) {
      v = v.trim();
      if (!v) return 'Enter your email address.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email, like name@example.com.';
      return '';
    },
    phone: function (v) {
      var n = v.replace(/[\s\-().]/g, '');
      if (!n) return '';                              // optional
      if (/^(?:0|\+63)9\d{9}$/.test(n)) return '';   // Philippine mobile
      if (/^\+\d{8,15}$/.test(n)) return '';         // international
      return 'Use a Philippine mobile like 0917 123 4567, or an international number starting with +.';
    },
    consent: function (on) { return on ? '' : 'Tick this box so we can reply to you.'; },

    /* general */
    topic: function (v) { return v ? '' : 'Choose what your inquiry is about.'; },
    message: function (v) {
      var len = v.trim().length;
      if (!len) return 'Write a short message so we know how to help.';
      if (len < CFG.minMessage) return 'Tell us a little more. We need at least ' + CFG.minMessage + ' characters (you have ' + len + ').';
      return '';
    },

    /* custom itinerary */
    destinations: function (a) { return a.length ? '' : 'Choose at least one destination, or tick \u201CNot sure yet\u201D.'; },
    startDate: function (v) {
      if (!v) return get('flexible') ? '' : 'Pick your arrival date, or tick \u201CMy dates are flexible\u201D.';
      if (v < today()) return 'Pick today or a later date.';
      if (v > yearsAhead(CFG.maxYearsAhead)) return 'Pick a date within the next ' + CFG.maxYearsAhead + ' years.';
      return '';
    },
    endDate: function (v) {
      var s = get('startDate');
      if (!v) return get('flexible') ? '' : 'Pick your departure date, or tick \u201CMy dates are flexible\u201D.';
      if (v < today()) return 'Pick today or a later date.';
      if (v > yearsAhead(CFG.maxYearsAhead)) return 'Pick a date within the next ' + CFG.maxYearsAhead + ' years.';
      if (s && v < s) return 'Departure can\u2019t be before arrival.';
      if (s && daysBetween(s, v) + 1 > CFG.maxTripDays) return 'For trips longer than ' + CFG.maxTripDays + ' days, tell us in the notes instead.';
      return '';
    },
    adults: intRule(1, 20, 'Add at least 1 adult.', 'For more than 20 adults, tell us in the notes.'),
    children: intRule(0, 10, 'Children can\u2019t be negative.', 'For more than 10 children, tell us in the notes.'),
    childAges: function (v) {
      return (+get('children') > 0 && !v.trim()) ? 'Tell us the children\u2019s ages, for example 4 and 9.' : '';
    }
  };

  function activeFields() { return COMMON.concat(BY_TYPE[type()]); }

  /* ---------- show / clear one field's state ---------- */
  function validate(n) {
    var rule = RULES[n];
    if (!rule) return '';
    var msg = rule(get(n));
    var c = ctl(n);
    var err = document.getElementById('ct-' + n + '-err');

    if (GROUPS[n]) {
      c.classList.toggle('is-bad', !!msg);
    } else if (msg) {
      c.setAttribute('aria-invalid', 'true');
      c.classList.remove('is-valid');
    } else {
      c.removeAttribute('aria-invalid');
      var filled = !CHECKS[n] && String(get(n)).trim() !== '';
      c.classList.toggle('is-valid', filled && c.tagName !== 'SELECT');
    }
    if (err) { err.textContent = msg; err.hidden = !msg; }
    return msg;
  }

  function isBad(n) {
    var c = ctl(n);
    return !!c && (c.getAttribute('aria-invalid') === 'true' || c.classList.contains('is-bad'));
  }
  function recheck(n) { if (isBad(n)) validate(n); }
  function focusTarget(n) { var c = ctl(n); return GROUPS[n] ? c.querySelector('input') : c; }

  function clearErrors(names) {
    names.forEach(function (n) {
      var c = ctl(n), err = document.getElementById('ct-' + n + '-err');
      if (!c) return;
      c.removeAttribute('aria-invalid');
      c.classList.remove('is-valid', 'is-bad');
      if (err) { err.textContent = ''; err.hidden = true; }
    });
  }

  /* ---------- banner ---------- */
  function showBanner(text) { banner.textContent = text; banner.hidden = false; }
  function hideBanner() { banner.hidden = true; banner.textContent = ''; }

  /* ---------- inquiry type ---------- */
  function applyType(fromUser) {
    var t = type();
    secGeneral.hidden = t !== 'general';
    secCustom.hidden = t !== 'custom';
    submitBtn.textContent = TEXT[t].submit;
    clearErrors(BY_TYPE[t === 'general' ? 'custom' : 'general']);
    hideBanner();
    if (fromUser) {
      try {
        var u = new URL(window.location.href);
        u.searchParams.set('type', t);
        window.history.replaceState(null, '', u);
      } catch (e) { /* file:// or blocked: skip */ }
    }
  }

  /* ---------- dates ---------- */
  function applyFlexible() {
    var flex = get('flexible');
    document.getElementById('ct-start-req').hidden = flex;
    document.getElementById('ct-end-req').hidden = flex;
    recheck('startDate'); recheck('endDate');
  }
  function updateTrip() {
    var s = get('startDate'), e = get('endDate'), out = document.getElementById('ct-trip');
    ctl('endDate').min = s && s > today() ? s : today();
    if (s && e && e >= s && !RULES.endDate(e)) {
      var days = daysBetween(s, e) + 1;
      out.textContent = days + (days === 1 ? ' day' : ' days') + ' / ' + (days - 1) + ((days - 1) === 1 ? ' night' : ' nights');
    } else {
      out.textContent = '';
    }
  }

  /* ---------- children's ages ---------- */
  function applyChildren() {
    var n = parseInt(get('children'), 10);
    var wrap = document.getElementById('ct-childAges-wrap');
    wrap.hidden = !(n > 0);
    if (wrap.hidden) { clearErrors(['childAges']); }
    else { recheck('childAges'); }
  }

  /* ---------- counters ---------- */
  function updateCounts() {
    Array.prototype.forEach.call(form.querySelectorAll('[data-count-for]'), function (el) {
      var f = ctl(el.getAttribute('data-count-for'));
      var len = f.value.length, max = f.maxLength;
      el.textContent = len + ' / ' + max;
      el.classList.toggle('is-near', len >= max * 0.9);
    });
  }

  /* ---------- attached package (from the destination pages) ---------- */
  function setPackage(code, title) {
    var pill = document.getElementById('ct-pkg');
    code = String(code || '').replace(/[^\w\-]/g, '').slice(0, 20);
    title = String(title || '').slice(0, 60);
    document.getElementById('ct-package').value = code;
    if (code) {
      document.getElementById('ct-pkg-name').textContent = title ? title + ' (' + code + ')' : code;
    }
    pill.hidden = !code;
  }

  /* ---------- draft for this browser tab ---------- */
  var SKIP = { website: 1, consent: 1, package: 1 };
  function saveDraft() {
    try {
      var d = {};
      Array.prototype.forEach.call(form.elements, function (c) {
        if (!c.name || SKIP[c.name]) return;
        if (c.type === 'checkbox' || c.type === 'radio') d[c.name + '|' + c.value] = c.checked;
        else d[c.name] = c.value;
      });
      sessionStorage.setItem(CFG.draftKey, JSON.stringify(d));
    } catch (e) { /* storage blocked: skip */ }
  }
  function loadDraft() {
    try {
      var d = JSON.parse(sessionStorage.getItem(CFG.draftKey) || 'null');
      if (!d) return;
      Array.prototype.forEach.call(form.elements, function (c) {
        if (!c.name || SKIP[c.name]) return;
        if (c.type === 'checkbox' || c.type === 'radio') {
          var k = c.name + '|' + c.value;
          if (k in d) c.checked = !!d[k];
        } else if (typeof d[c.name] === 'string') {
          c.value = d[c.name];
        }
      });
    } catch (e) { /* ignore */ }
  }
  function clearDraft() { try { sessionStorage.removeItem(CFG.draftKey); } catch (e) { /* ignore */ } }

  /* ---------- sending ---------- */
  function collect() {
    var t = type();
    var topic = ctl('topic');
    var d = {
      type: t,
      name: get('name').trim(),
      email: get('email').trim(),
      phone: get('phone').replace(/[\s\-().]/g, ''),
      package: ctl('package').value,
      consent: true,
      sentAt: new Date().toISOString()
    };
    if (t === 'general') {
      d.topic = topic.value;
      d.topicName = topic.options[topic.selectedIndex].text;
      d.destination = get('destination');
      d.message = get('message').trim();
    } else {
      d.destinations = checked('destinations');
      d.flexibleDates = get('flexible');
      d.startDate = get('startDate');
      d.endDate = get('endDate');
      d.adults = parseInt(get('adults'), 10);
      d.children = parseInt(get('children'), 10);
      d.childAges = d.children > 0 ? get('childAges').trim() : '';
      d.budget = get('budget');
      d.comfort = get('stay');
      d.interests = checked('interests');
      d.notes = get('notes').trim();
    }
    return d;
  }

  function makeRef(t) {
    var d = new Date();
    var rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return (t === 'custom' ? 'TV-C-' : 'TV-G-') + String(d.getFullYear()).slice(2) + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + rand;
  }

  function transport(data) {
    if (typeof CFG.onSubmit === 'function') return Promise.resolve(CFG.onSubmit(data));
    if (CFG.endpoint) {
      return fetch(CFG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r; });
    }
    console.log('[TeyVenture] inquiry (demo mode, not sent):', data);   // demo mode
    return new Promise(function (resolve) { setTimeout(resolve, 900); });
  }

  function setSending(on) {
    sending = on;
    submitBtn.disabled = on;
    submitBtn.classList.toggle('is-sending', on);
    submitBtn.textContent = on ? 'Sending\u2026' : TEXT[type()].submit;
    form.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function showSuccess(data) {
    var t = data.type;
    document.getElementById('ct-s-title').textContent = TEXT[t].done;
    document.getElementById('ct-s-text').textContent =
      'Thanks, ' + data.name.split(/\s+/)[0] + '. ' + TEXT[t].lead + ' ' + data.email + '.';
    document.getElementById('ct-s-ref').textContent = makeRef(t);
    form.hidden = true;
    success.hidden = false;
    success.focus();
    clearDraft();
    form.reset();
    setPackage('', '');
    clearErrors(COMMON.concat(BY_TYPE.general, BY_TYPE.custom));
    applyType(false); applyFlexible(); applyChildren(); updateTrip(); updateCounts();
    success.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function submit() {
    var data = collect();
    setSending(true);
    transport(data)
      .then(function () { showSuccess(data); })
      .catch(function (err) {
        console.error('[TeyVenture] contact form error:', err);
        showBanner('We couldn\u2019t send your inquiry. Check your connection and try again. Your details are still here.');
        banner.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      })
      .then(function () { setSending(false); });
  }

  /* ---------- events ---------- */
  // Check a text-like field when the person leaves it
  form.addEventListener('focusout', function (e) {
    var n = e.target && e.target.name;
    if (n && RULES[n] && !GROUPS[n] && !CHECKS[n] && activeFields().indexOf(n) > -1) validate(n);
  });

  function onEdit(e) {
    var t = e.target, n = t && t.name;
    if (!n) return;
    if (n === 'type') { applyType(true); saveDraft(); return; }
    if (n === 'flexible') applyFlexible();
    if (n === 'startDate') { updateTrip(); if (get('endDate')) validate('endDate'); recheck('startDate'); }
    if (n === 'endDate') updateTrip();
    if (n === 'children') applyChildren();
    if (RULES[n]) recheck(n);          // once a field shows an error, re-check while it is fixed
    if (n === 'message' || n === 'notes') updateCounts();
    if (n !== 'consent') saveDraft();
    if (!banner.hidden && !sending) hideBanner();
  }
  form.addEventListener('input', onEdit);
  form.addEventListener('change', onEdit);

  // +/- steppers
  form.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-step]');
    if (!b) return;
    var input = ctl(b.getAttribute('data-target'));
    var next = (parseInt(input.value, 10) || 0) + parseInt(b.getAttribute('data-step'), 10);
    input.value = Math.max(+input.min, Math.min(+input.max, next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  document.getElementById('ct-pkg-x').addEventListener('click', function () {
    setPackage('', '');
    ctl('name').focus();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;

    // honeypot: people never fill this field; pretend it worked and send nothing
    if (form.elements.website.value) { showSuccess(collect()); return; }

    var bad = activeFields().filter(function (n) { return validate(n); });
    if (bad.length) {
      showBanner(bad.length === 1
        ? 'Please fix the highlighted field and send again.'
        : 'Please fix the ' + bad.length + ' highlighted fields and send again.');
      focusTarget(bad[0]).focus();
      return;
    }
    hideBanner();
    submit();
  });

  document.getElementById('ct-again').addEventListener('click', function () {
    success.hidden = true;
    form.hidden = false;
    hideBanner();
    ctl('name').focus();
  });

  /* ---------- start ---------- */
  ctl('startDate').min = today();
  ctl('startDate').max = yearsAhead(CFG.maxYearsAhead);
  ctl('endDate').min = today();
  ctl('endDate').max = yearsAhead(CFG.maxYearsAhead);

  loadDraft();

  // URL prefill (links from the destination pages and the home page)
  try {
    var q = new URLSearchParams(window.location.search);
    var qType = q.get('type'), dest = q.get('dest'), pkg = q.get('package');
    if (qType === 'general' || qType === 'custom') {
      form.querySelector('input[name="type"][value="' + qType + '"]').checked = true;
    }
    if (dest) {
      var sel = ctl('destination');
      if (Array.prototype.some.call(sel.options, function (o) { return o.value === dest; })) sel.value = dest;
      var chip = form.querySelector('input[name="destinations"][value="' + dest.replace(/[^\w-]/g, '') + '"]');
      if (chip) chip.checked = true;
    }
    if (pkg) {
      setPackage(pkg, q.get('title'));
      if (!ctl('topic').value) ctl('topic').value = 'package';
    }
  } catch (e) { /* ignore */ }

  applyType(false);
  applyFlexible();
  applyChildren();
  updateTrip();
  updateCounts();
})();