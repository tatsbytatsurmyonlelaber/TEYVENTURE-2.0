(function () {
  'use strict';

  /* things you will want to edit */
  var DEFAULTS = {
    rating: 5.0,                       // set to null to hide the stars
    bank: {                            // shown on the Bank Transfer panel
      name: '[BANK NAME]',
      accountName: '[ACCOUNT NAME]',
      accountNumber: '[ACCOUNT NUMBER]',
      deadline: '[PAYMENT DEADLINE]'
    },
    departureWeekday: 0,               // 0 = Sunday (only used by the placeholder dates)
    minLeadDays: 14,                   // earliest bookable departure, in days from today
    monthsAhead: 10,                   // how many months the calendar covers
    departures: null,
    draft: true,                       // false = turn the autosave off
    draftPassport: true,               // false = never keep passport numbers / expiry dates in the draft
    draftMaxAgeHours: 12,              // an older draft is ignored and removed

    // Called when the customer presses Pay. Send `booking` to your server here.
    onSubmit: function (booking) {
      console.log('[TeyVenture] booking to send to your server:', booking);
    }
  };
  var CFG = Object.assign({}, DEFAULTS, window.TEYVENTURE_BOOKING || {});

  var MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var NATS = [
    'Philippines', 'United States', 'Japan', 'South Korea', 'China', 'Taiwan',
    'Hong Kong', 'Singapore', 'Malaysia', 'Indonesia', 'Thailand', 'Vietnam',
    'India', 'Australia', 'New Zealand', 'Canada', 'United Kingdom', 'Ireland',
    'France', 'Germany', 'Italy', 'Spain', 'Netherlands', 'Switzerland',
    'United Arab Emirates', 'Saudi Arabia', 'Other'
  ];
  var PESO = '\u20B1';
  var DOT = '\u2022';

  var overlay = null;
  var state = null;
  var lastFocus = null;


  /* small helpers */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function p2(n) {
    return String(n).padStart(2, '0');
  }

  function peso(n) {
    return PESO + Number(n).toLocaleString('en-PH');
  }

  function txt(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function $(sel) {
    return overlay ? overlay.querySelector(sel) : null;
  }

  function iso(t) {
    var d = new Date(t);
    return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
  }

  function fmt(t) {
    var d = new Date(t);
    return DAYS[d.getUTCDay()] + ', ' + p2(d.getUTCDate()) + ' ' + MONTHS[d.getUTCMonth()].slice(0, 3);
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) % 9973;
    }
    return h;
  }

  function total() {
    return state.pkg.perPax ? state.pkg.price * state.count : state.pkg.price;
  }


  /* validation rules */
  // Names: letters (any language), spaces, hyphens, apostrophes and full stops only. No digits or symbols.
  var NAME_BAD, NAME_OK;
  try {
    NAME_BAD = new RegExp("[^\\p{L}\\p{M}\\s'\u2019.\\-]", 'gu');
    NAME_OK = new RegExp("^[\\p{L}\\p{M}][\\p{L}\\p{M}\\s'\u2019.\\-]*$", 'u');
  } catch (err) {
    // very old browsers without unicode property escapes
    NAME_BAD = /[^A-Za-z\u00C0-\u024F\s'\u2019.\-]/g;
    NAME_OK = /^[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F\s'\u2019.\-]*$/;
  }
  var NAME_HINT = 'Letters only: numbers and symbols are not allowed';
  var MAX_FILE_MB = 5;
  var PROOF_EXT = /\.(jpe?g|png|webp|gif|heic|pdf)$/i;

  function cleanName(v) {
    return String(v).replace(/\s+/g, ' ').replace(/^\s+/, '');
  }

  function letterCount(s) {
    return s.replace(/[\s'\u2019.\-]/g, '').length;
  }

  function validISO(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var a = s.split('-').map(Number);
    var d = new Date(Date.UTC(a[0], a[1] - 1, a[2]));
    return d.getUTCFullYear() === a[0] && d.getUTCMonth() === a[1] - 1 && d.getUTCDate() === a[2];
  }

  function shiftYears(n) {
    var d = new Date();
    d.setFullYear(d.getFullYear() + n);
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }

  function tomorrowISO() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }


  /* draft: keep the traveler details for this browser tab */
  var DRAFT_KEY = 'teyventure-booking-draft';
  var T_FIELDS = ['given', 'sur', 'dob', 'nat', 'pass', 'exp'];
  var draftTimer = null;

  function draftStore() {
    try {
      return window.sessionStorage;
    } catch (e) {
      return null;
    }
  }

  function slotFilled(t) {
    return T_FIELDS.some(function (k) {
      return t[k] !== '';
    });
  }

  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = null;

    var ss = draftStore();
    if (!CFG.draft || !ss || !state) return;

    try {
      var tr = state.tr.map(function (t) {
        var o = {};
        T_FIELDS.forEach(function (k) {
          o[k] = (!CFG.draftPassport && (k === 'pass' || k === 'exp')) ? '' : String(t[k] || '');
        });
        return o;
      });

      if (!tr.some(slotFilled)) {
        ss.removeItem(DRAFT_KEY);
        return;
      }

      ss.setItem(DRAFT_KEY, JSON.stringify({
        v: 1,
        pkg: state.pkg.id,
        count: state.count,
        saved: Date.now(),
        tr: tr
      }));
    } catch (e) {
      /* storage full or blocked: skip */
    }
  }

  function saveDraftSoon() {
    if (!CFG.draft || !state) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 300);
  }

  function clearDraft() {
    clearTimeout(draftTimer);
    draftTimer = null;

    var ss = draftStore();
    try {
      if (ss) ss.removeItem(DRAFT_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function loadDraft() {
    var ss = draftStore();
    if (!CFG.draft || !ss) return;

    try {
      var d = JSON.parse(ss.getItem(DRAFT_KEY) || 'null');
      if (!d || d.v !== 1 || !Array.isArray(d.tr)) return;

      if (CFG.draftMaxAgeHours && Date.now() - d.saved > CFG.draftMaxAgeHours * 36e5) {
        ss.removeItem(DRAFT_KEY);
        return;
      }

      var any = false;
      var isDate = /^\d{4}-\d{2}-\d{2}$/;

      d.tr.slice(0, state.tr.length).forEach(function (s, i) {
        if (!s || typeof s !== 'object') return;

        // storage can be edited by anyone: check every value
        var t = state.tr[i];
        t.given = String(s.given || '').slice(0, 80);
        t.sur = String(s.sur || '').slice(0, 80);
        t.dob = isDate.test(s.dob) ? s.dob : '';
        t.nat = NATS.indexOf(s.nat) > -1 ? s.nat : '';

        if (CFG.draftPassport) {
          t.pass = String(s.pass || '').slice(0, 30);
          t.exp = isDate.test(s.exp) ? s.exp : '';
        }

        if (slotFilled(t)) any = true;
      });

      if (!any) return;
      state.restored = true;

      var n = parseInt(d.count, 10);
      if (n) state.count = Math.max(state.pkg.min, Math.min(state.pkg.max, n));
    } catch (e) {
      /* ignore a damaged draft */
    }
  }


  /* read the package from its card */
  function readPackage(btn) {
    var card = btn.closest('.trv-card');
    if (!card) return null;

    var solo = card.classList.contains('trv-solo');
    var badge = txt(card.querySelector('.trv-badge'));       // "4 DAYS / 3 NIGHTS"
    var cap = txt(card.querySelector('.trv-cap'));           // "SOLO", "2 PERSONS", "3-5 PERSONS"
    var amount = card.querySelector('.trv-amount');
    var price = parseInt((amount && amount.firstChild ? amount.firstChild.textContent : '').replace(/[^\d]/g, ''), 10) || 0;
    var per = txt(amount && amount.querySelector('small')).toUpperCase();
    var id = (card.getAttribute('data-code') || '').replace(/\s+/g, '');   // hidden package id
    var min = 1;
    var max = 1;

    if (!solo) {
      var m = cap.match(/(\d+)(?:\s*-\s*(\d+))?/);
      if (m) {
        min = parseInt(m[1], 10);
        max = m[2] ? parseInt(m[2], 10) : min;
      }
    }

    var d = badge.match(/(\d+)\s*DAYS?\s*\/\s*(\d+)\s*NIGHTS?/i);
    var days = d ? +d[1] : 4;
    var nights = d ? +d[2] : 3;
    var img = card.querySelector('.trv-media img');

    return {
      id: id,
      title: txt(card.querySelector('.trv-title')),
      destination: txt(document.querySelector('.pkg-title')),
      who: solo ? 'Solo' : cap.charAt(0) + cap.slice(1).toLowerCase(),
      price: price,
      perPax: /PAX/.test(per),
      min: min,
      max: max,
      days: days,
      nights: nights,
      duration: days + ' DAYS / ' + nights + ' NIGHTS',
      image: img ? img.getAttribute('src') : ''
    };
  }

  function newState(pkg) {
    var tr = [];
    for (var i = 0; i < 10; i++) {
      tr.push({ given: '', sur: '', dob: '', nat: '', pass: '', exp: '' });
    }

    return {
      pkg: pkg,
      step: 1,
      count: pkg.min,
      tr: tr,
      mi: 0,
      sel: null,
      focus: null,
      wl: {},
      method: 'card',
      wallet: 'apple',
      card: { name: '', number: '', exp: '', cvc: '' },
      terms: false,
      proof: '',
      proofErr: '',
      errors: {},
      banner: '',
      ref: ''
    };
  }


  /* open / close */
  function open(pkg, trigger) {
    if (overlay) return;

    state = newState(pkg);
    lastFocus = trigger || document.activeElement;
    loadDraft();

    overlay = document.createElement('div');
    overlay.className = 'tv-overlay';
    overlay.innerHTML =
      '<div class="tv-dialog" role="dialog" aria-modal="true" aria-labelledby="tv-title">' +
        heroHTML() +
        '<div class="tv-steps" id="tv-steps"></div>' +
        '<div class="tv-body" id="tv-body" tabindex="-1"></div>' +
        '<div class="tv-foot" id="tv-foot"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.documentElement.classList.add('tv-lock');

    overlay.addEventListener('click', onClick);
    overlay.addEventListener('input', onInput);
    overlay.addEventListener('change', onChange);
    overlay.addEventListener('input', saveDraftSoon);       // runs after onInput has updated the state
    overlay.addEventListener('change', saveDraftSoon);
    overlay.addEventListener('focusin', onFocus);
    overlay.addEventListener('focusout', onFocus);
    overlay.addEventListener('focusout', onBlur);
    document.addEventListener('keydown', onKey);

    var hi = overlay.querySelector('.tv-hero > img');
    if (hi) {
      hi.addEventListener('error', function () {
        hi.remove();
      });
    }

    render(false);

    var first = $('#tv-body input, #tv-body button');
    (first || $('#tv-body')).focus({ preventScroll: true });
  }

  function close() {
    if (!overlay) return;

    document.removeEventListener('keydown', onKey);
    if (state && state.step !== 'done') saveDraft();

    overlay.remove();
    overlay = null;
    state = null;
    document.documentElement.classList.remove('tv-lock');

    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }


  /* static header */
  var STAR =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>' +
    '</svg>';

  function heroHTML() {
    var p = state.pkg;

    return '<div class="tv-hero">' +
      (p.image ? '<img src="' + esc(p.image) + '" alt="">' : '') +
      '<div class="tv-shade"></div>' +
      '<span class="tv-tag">' + esc(p.duration) + '</span>' +

      '<div class="tv-hbtns">' +
        '<button type="button" class="tv-ib" data-act="save" aria-pressed="false" aria-label="Save package">' +
          '<svg viewBox="0 0 24 24"><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/></svg>' +
        '</button>' +
        '<button type="button" class="tv-ib" data-act="close" aria-label="Close">' +
          '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
      '</div>' +

      '<div class="tv-htitle">' +
        '<span class="tv-dest">' + esc(p.destination) + ' \u00B7 ' + esc(p.who) + '</span>' +
        '<h2 id="tv-title">' + esc(p.title) + '</h2>' +
      '</div>' +

      (CFG.rating != null
        ? '<div class="tv-rate" role="img" aria-label="Rated ' + CFG.rating.toFixed(1) + ' out of 5">' +
            new Array(6).join(STAR) +
            '<b>' + CFG.rating.toFixed(1) + '</b>' +
          '</div>'
        : '') +
    '</div>';
  }


  /* render */
  var CHECK =
    '<svg viewBox="0 0 24 24" role="img" aria-label="Completed">' +
      '<path d="M5 12.5l4.5 4.5L19 7.5"/>' +
    '</svg>';

  function stepsHTML() {
    var labels = ['Package and Travelers', 'Departure', 'Billing and Payments'];
    var s = state.step === 'done' ? 4 : state.step;
    var h = '';

    labels.forEach(function (l, i) {
      var n = i + 1;
      var cls = n < s ? 'is-done' : (n === s ? 'is-cur' : '');

      h += '<span class="tv-step ' + cls + '"' + (n === s ? ' aria-current="step"' : '') + '>' +
        '<span class="tv-dot">' + (n < s ? CHECK : n) + '</span>' +
        '<span class="tv-lab">' + l + '</span>' +
      '</span>';

      if (n < 3) {
        h += '<span class="tv-line ' + (n < s ? 'is-done' : '') + '"></span>';
      }
    });

    return h;
  }

  function render(keepScroll) {
    var body = $('#tv-body');
    var top = body.scrollTop;
    var h;

    $('#tv-steps').innerHTML = stepsHTML();

    if (state.step === 1) h = stepTravelers();
    else if (state.step === 2) h = stepDeparture();
    else if (state.step === 3) h = stepBilling();
    else h = stepDone();

    body.innerHTML = h;
    body.scrollTop = keepScroll ? top : 0;
    $('#tv-foot').innerHTML = footHTML();

    if (state.step === 3) updatePreview();
  }

  function focusFirstError() {
    var el = $('[aria-invalid="true"]');
    if (el) el.focus();
  }


  /* travelers */
  function stepTravelers() {
    var p = state.pkg;
    var ranged = p.max > p.min;

    var h = '<h3 class="tv-h">Your Travel Party</h3>' +
      '<p class="tv-sub">Enter each traveler\u2019s details exactly as they appear on their passport.</p>';

    if (state.banner) {
      h += '<div class="tv-banner" role="alert">' + esc(state.banner) + '</div>';
    }

    if (state.restored) {
      h += '<div class="tv-draft" role="status">' +
        '<span>We restored the traveler details you entered earlier. They are kept in this browser tab only.</span>' +
        '<button type="button" class="tv-draft-x" data-act="cleardraft">Clear saved details</button>' +
      '</div>';
    }

    h += '<div class="tv-slotbar">' +
      '<span>' +
        state.count + (state.count === 1 ? ' traveler slot' : ' traveler slots') + ' \u00B7 ' +
        (ranged ? 'this package fits ' + p.min + ' to ' + p.max : 'fixed for this package') +
      '</span>';

    if (ranged) {
      h += '<div class="tv-count">' +
        '<button type="button" class="tv-circ" data-act="dec" aria-label="Remove a traveler"' +
          (state.count <= p.min ? ' disabled' : '') + '>\u2212</button>' +
        '<b aria-live="polite">' + state.count + '</b>' +
        '<button type="button" class="tv-circ" data-act="inc" aria-label="Add a traveler"' +
          (state.count >= p.max ? ' disabled' : '') + '>+</button>' +
      '</div>';
    }

    h += '</div>';

    for (var i = 0; i < state.count; i++) {
      h += travelerCard(i);
    }

    return h;
  }

  function travelerCard(i) {
    var t = state.tr[i];
    var F = [
      ['given', 'Given name(s)', 'text'],
      ['sur', 'Surname', 'text'],
      ['dob', 'Date of birth', 'date'],
      ['nat', 'Nationality', 'select'],
      ['pass', 'Passport number', 'text'],
      ['exp', 'Passport expiry', 'date']
    ];

    var h = '<div class="tv-tcard">' +
      '<div class="tv-tname">' +
        '<span class="tv-num">' + (i + 1) + '</span>' +
        (i === 0 ? 'Lead traveler' : 'Traveler ' + (i + 1)) +
      '</div>' +
      '<div class="tv-fields">';

    F.forEach(function (f) {
      var k = f[0];
      var id = 'tv-t' + i + '-' + k;
      var err = state.errors[i + '-' + k];
      var a = ' id="' + id + '" data-t="' + i + '" data-k="' + k + '"' +
        (err ? ' aria-invalid="true" aria-describedby="' + id + '-e"' : '');
      var c;

      if (f[2] === 'select') {
        c = '<select' + a + '>' +
          '<option value="">Select country</option>' +
          NATS.map(function (n) {
            return '<option' + (t.nat === n ? ' selected' : '') + '>' + n + '</option>';
          }).join('') +
        '</select>';
      } else {
        var lim = '';
        if (k === 'dob') {
          lim = ' min="' + shiftYears(-120) + '" max="' + todayISO() + '"';
        } else if (k === 'exp') {
          lim = ' min="' + tomorrowISO() + '" max="' + shiftYears(15) + '"';
        }

        var tx = '';
        if (k === 'pass') {
          tx = ' maxlength="9" autocapitalize="characters" spellcheck="false" placeholder="e.g. P1234567A"';
        } else if (k === 'given' || k === 'sur') {
          tx = ' maxlength="50" autocapitalize="words"';
        }

        c = '<input' + a + ' type="' + f[2] + '" value="' + esc(t[k]) + '"' + lim + tx +
          (f[2] === 'text' ? ' autocomplete="off"' : '') + '>';
      }

      h += '<div class="tv-f">' +
        '<label for="' + id + '">' + f[1] + ' <span class="tv-req" aria-hidden="true">*</span></label>' +
        c +
        (err ? '<span class="tv-err" id="' + id + '-e">' + esc(err) + '</span>' : '') +
      '</div>';
    });

    return h + '</div></div>';
  }

  function nameError(v, what) {
    v = v.trim();
    if (!v) return 'Required';
    if (!NAME_OK.test(v)) {
      return /^[\s'\u2019.\-]/.test(v) ? 'Must start with a letter' : NAME_HINT;
    }
    if (letterCount(v) < 2) return 'Enter at least 2 letters';
    if (v.length > 50) return what + ' is too long (50 characters max)';
    if (/(['\u2019.\-])\1/.test(v) || /['\u2019.\-]\s*['\u2019.\-]/.test(v)) {
      return 'Check for repeated punctuation';
    }
    return '';
  }

  // One rule per field, used when typing, leaving a field, and pressing Continue.
  function travelerError(i, k) {
    var t = state.tr[i];
    var today = todayISO();
    var v = String(t[k] || '').trim();

    switch (k) {
      case 'given':
        return nameError(t.given, 'Given name');

      case 'sur':
        return nameError(t.sur, 'Surname');

      case 'dob':
        if (!t.dob) return 'Required';
        if (!validISO(t.dob)) return 'Enter a valid date';
        if (t.dob > today) return 'Date of birth cannot be in the future';
        if (t.dob < shiftYears(-120)) return 'Enter a valid date of birth';
        if (i === 0 && t.dob > shiftYears(-18)) return 'The lead traveler must be 18 or older';
        return '';

      case 'nat':
        if (!t.nat) return 'Required';
        if (NATS.indexOf(t.nat) < 0) return 'Choose a country from the list';
        return '';

      case 'pass':
        if (!v) return 'Required';
        if (!/^[A-Za-z0-9]+$/.test(v)) return 'Letters and numbers only, no spaces or symbols';
        if (v.length < 6 || v.length > 9) return 'Passport number must be 6 to 9 characters';
        if (!/\d/.test(v)) return 'Passport number must include at least one digit';
        for (var j = 0; j < i; j++) {
          if (String(state.tr[j].pass).trim().toUpperCase() === v.toUpperCase()) {
            return 'Same passport number as ' + (j === 0 ? 'the lead traveler' : 'traveler ' + (j + 1));
          }
        }
        return '';

      case 'exp':
        if (!t.exp) return 'Required';
        if (!validISO(t.exp)) return 'Enter a valid date';
        if (t.exp <= today) return 'This passport has expired';
        if (t.exp > shiftYears(15)) return 'Check the expiry date';
        if (t.dob && validISO(t.dob) && t.exp <= t.dob) return 'Expiry must be after the date of birth';
        return '';
    }

    return '';
  }

  function validateTravelers() {
    var e = {};
    var keys = ['given', 'sur', 'dob', 'nat', 'pass', 'exp'];

    for (var i = 0; i < state.count; i++) {
      keys.forEach(function (k) {
        var m = travelerError(i, k);
        if (m) e[i + '-' + k] = m;
      });
    }

    return e;
  }


  /* departure */
  function monthList() {
    var n = new Date();
    var out = [];

    for (var i = 1; i <= CFG.monthsAhead; i++) {
      var d = new Date(n.getFullYear(), n.getMonth() + i, 1);
      out.push({ y: d.getFullYear(), m: d.getMonth() });
    }

    return out;
  }

  function placesFor(y, m, d) {
    var key = y + '-' + p2(m + 1) + '-' + p2(d);
    var p = state.pkg;

    if (CFG.departures) {
      var set = CFG.departures[p.id];
      return set && set[key] != null ? set[key] : undefined;
    }

    if (new Date(Date.UTC(y, m, d)).getUTCDay() !== CFG.departureWeekday) return undefined;

    // placeholder availability (0-10)
    return (d * 7 + m * 5 + y + hash(p.id)) % 11;
  }

  function statusOf(places) {
    if (places === 0) return 'sold';
    if (places < state.count) return 'short';
    return 'ok';
  }

  function chosen() {
    if (!state.sel) return null;

    var a = state.sel.split('-').map(Number);
    var pl = placesFor(a[0], a[1] - 1, a[2]);
    if (pl === undefined) return null;

    var t = Date.UTC(a[0], a[1] - 1, a[2]);
    var r = t + state.pkg.nights * 864e5;

    return {
      key: state.sel,
      places: pl,
      st: statusOf(pl),
      t: t,
      r: r,
      retISO: iso(r),
      year: a[0],
      retYear: new Date(r).getUTCFullYear()
    };
  }

  function passportIssue(c) {
    for (var i = 0; i < state.count; i++) {
      if (state.tr[i].exp && state.tr[i].exp < c.retISO) {
        return (i === 0 ? 'The lead traveler\u2019s' : 'Traveler ' + (i + 1) + '\u2019s') +
          ' passport expires before the return date. Go back to update it, or choose another departure.';
      }
    }
    return '';
  }

  var ICON = {
    ok: 'M8 12.5l3 3 5-6',
    short: 'M12 7.5v5M12 16v.5',
    sold: 'M9 9l6 6M15 9l-6 6'
  };

  function stepDeparture() {
    var ms = monthList();
    var cur = ms[state.mi];
    var first = new Date(Date.UTC(cur.y, cur.m, 1)).getUTCDay();
    var dim = new Date(Date.UTC(cur.y, cur.m + 1, 0)).getUTCDate();

    var h = '<div class="tv-titlerow">' +
      '<h3 class="tv-h tv-h--flush">Available Departures</h3>' +
      '<span class="tv-pill">' +
        '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/></svg>' +
        'Your group: ' + state.count + (state.count === 1 ? ' traveler' : ' travelers') +
      '</span>' +
    '</div>';

    if (state.banner) {
      h += '<div class="tv-banner" role="alert">' + esc(state.banner) + '</div>';
    }

    // calendar header
    h += '<div class="tv-cal">' +
      '<div class="tv-calhead">' +
        '<button type="button" class="tv-nav" data-act="prev" aria-label="Previous month"' +
          (state.mi === 0 ? ' disabled' : '') + '>' +
          '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>' +
        '</button>' +
        '<strong aria-live="polite">' + MONTHS[cur.m] + ' ' + cur.y + '</strong>' +
        '<button type="button" class="tv-nav" data-act="next" aria-label="Next month"' +
          (state.mi === ms.length - 1 ? ' disabled' : '') + '>' +
          '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="tv-grid">';

    // weekday names and blank cells before the 1st
    DAYS.forEach(function (d) {
      h += '<span class="tv-wd">' + d.toUpperCase() + '</span>';
    });
    for (var i = 0; i < first; i++) {
      h += '<span class="tv-blank"></span>';
    }

    // day cells
    var sc = chosen();
    var trip = sc && sc.st === 'ok';

    for (var d = 1; d <= dim; d++) {
      var pl = placesFor(cur.y, cur.m, d);
      var dt0 = Date.UTC(cur.y, cur.m, d);
      var col = (first + d - 1) % 7;

      // where the highlighted band has to stop and round off
      var rowStart = col === 0 || d === 1;
      var rowEnd = col === 6 || d === dim;

      // return date and the days in between
      if (trip && dt0 > sc.t && dt0 <= sc.r) {
        var isEnd = dt0 === sc.r;

        h += '<span class="tv-trip' + (isEnd ? ' is-end' : '') + (rowStart ? ' is-rs' : '') + (rowEnd ? ' is-re' : '') + '"' +
          ' aria-label="' + esc(fmt(dt0) + (isEnd ? ', return date' : ', during your trip')) + '">' +
          '<span class="tv-dn">' + d + '</span><i class="tv-pip"></i>' +
        '</span>';
        continue;
      }

      // not a departure day, or too soon to book
      if (pl === undefined || Date.UTC(cur.y, cur.m, d) < Date.now() + CFG.minLeadDays * 864e5) {
        h += '<span class="tv-plain"><span class="tv-dn">' + d + '</span></span>';
        continue;
      }

      var key = cur.y + '-' + p2(cur.m + 1) + '-' + p2(d);
      var st = statusOf(pl);
      var on = state.sel === key;

      var label = fmt(Date.UTC(cur.y, cur.m, d)) + ', ' +
        (st === 'sold' ? 'sold out' : st === 'short' ? 'not enough places for your group' : pl + ' places available');

      var cls = 'tv-day' +
        (st === 'short' ? ' is-short' : st === 'sold' ? ' is-sold' : '') +
        (on && st === 'ok' ? ' is-sel' + (trip && !rowEnd ? ' has-band' : '') : '') +
        (on && st !== 'ok' ? ' is-focus' : '');

      h += '<button type="button" class="' + cls + '" data-act="pick" data-key="' + key + '"' +
        ' aria-pressed="' + on + '" aria-label="' + esc(label) + '">' +
        '<span class="tv-dn">' + d + '</span><i class="tv-pip"></i>' +
      '</button>';
    }

    // legend
    h += '</div>' +
      '<div class="tv-legend">' +
        '<span><i class="tv-sw tv-sw--ok"></i>Available</span>' +
        '<span><i class="tv-sw tv-sw--short"></i>Not enough places for your group</span>' +
        '<span><i class="tv-sw tv-sw--sold"></i>Sold out</span>' +
        '<span><i class="tv-sw tv-sw--sel"></i>Selected</span>' +
        '<span><i class="tv-sw tv-sw--trip"></i>Your trip</span>' +
      '</div>' +
    '</div>';

    // selected-date summary
    var c = chosen();
    if (!c) {
      return h + '<div class="tv-detail" aria-live="polite">' +
        '<span class="tv-hint">Select a date on the calendar to choose your departure.</span>' +
      '</div>';
    }

    var head;
    if (c.st === 'sold') head = 'Sold out';
    else if (c.st === 'short') head = c.places === 1 ? '1 place left' : c.places + ' places left';
    else head = c.places + ' places available';

    var wl = state.wl[c.key];
    var sub;
    if (c.st === 'sold') sub = wl ? 'You\u2019re on the waitlist' : 'Waitlist open';
    else if (c.st === 'short') sub = 'Not enough places for your group';
    else sub = 'Guaranteed departure';

    var issue = c.st === 'ok' ? passportIssue(c) : '';

    h += '<div class="tv-detail is-' + c.st + '" aria-live="polite">' +
      '<span>' +
        '<span class="tv-dk">DEPARTS \u00B7 ' + c.year + '</span>' +
        '<span class="tv-dv">' + fmt(c.t) + '</span>' +
      '</span>' +
      '<svg class="tv-arrow" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg>' +
      '<span>' +
        '<span class="tv-dk">RETURNS' + (c.retYear !== c.year ? ' \u00B7 ' + c.retYear : '') + '</span>' +
        '<span class="tv-dv">' + fmt(c.r) + '</span>' +
      '</span>' +
      '<span class="tv-note">' +
        sub + (c.st === 'ok' ? ' \u00B7 ' + state.count + (state.count === 1 ? ' traveler' : ' travelers') : '') +
      '</span>' +
      '<span class="tv-stat"><strong>' +
        '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="' + ICON[c.st] + '"/></svg>' +
        head +
      '</strong></span>' +
      (c.st === 'sold'
        ? '<button type="button" class="tv-wl" data-act="waitlist" aria-pressed="' + !!wl + '">' +
            (wl ? 'On waitlist' : 'Join waitlist') +
          '</button>'
        : '') +
    '</div>';

    if (issue) {
      h += '<div class="tv-banner tv-banner--tight" role="alert">' + esc(issue) + '</div>';
    }

    return h;
  }


  /* billing */
  var ICO = {
    card:   '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>',
    wallet: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h5v3h-5a1.5 1.5 0 0 1 0-3z"/></svg>',
    bank:   '<svg viewBox="0 0 24 24"><path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></svg>',
    phone:  '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></svg>',
    pp:     '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M9.5 16.5l1.5-9h3a2.3 2.3 0 0 1 0 4.6h-2.4"/></svg>'
  };

  function fld(id, label, attrs, key, extra) {
    var err = state.errors[key];

    return '<div class="tv-f"' + (extra || '') + '>' +
      '<label for="' + id + '">' + label + ' <span class="tv-req" aria-hidden="true">*</span></label>' +
      '<input id="' + id + '" ' + attrs +
        (err ? ' aria-invalid="true" aria-describedby="' + id + '-e"' : '') + '>' +
      (err ? '<span class="tv-err" id="' + id + '-e">' + esc(err) + '</span>' : '') +
    '</div>';
  }

  function termsHTML() {
    var err = state.errors.terms;

    return '<label class="tv-chk">' +
      '<input type="checkbox" data-flag="terms"' +
        (state.terms ? ' checked' : '') +
        (err ? ' aria-invalid="true"' : '') + '>' +
      'I agree to the booking terms and cancellation policy' +
    '</label>' +
    (err ? '<span class="tv-err">' + esc(err) + '</span>' : '');
  }

  function stepBilling() {
    var p = state.pkg;
    var m = state.method;
    var c = state.card;
    var dep = chosen();

    var h = '<h3 class="tv-h">How would you like to pay?</h3>';

    if (state.banner) {
      h += '<div class="tv-banner" role="alert">' + esc(state.banner) + '</div>';
    }

    // left side: payment methods and order summary
    var methods = [
      ['card', ICO.card, 'Credit / debit card'],
      ['wallet', ICO.wallet, 'Apple Pay / PayPal'],
      ['bank', ICO.bank, 'Bank Transfer']
    ];

    h += '<div class="tv-pay"><aside class="tv-side">' +
      methods.map(function (x) {
        return '<button type="button" class="tv-m" data-act="method" data-m="' + x[0] + '"' +
          ' aria-pressed="' + (m === x[0]) + '">' + x[1] + x[2] + '</button>';
      }).join('') +

      '<div class="tv-hr"></div>' +
      '<div class="tv-cap">ORDER SUMMARY</div>' +
      '<div class="tv-row"><span>Package</span><b>' + esc(p.title) + '</b></div>' +
      '<div class="tv-row"><span>Duration</span><b>' +
        esc(p.duration.toLowerCase().replace(/^(\d+) days \/ (\d+) nights$/, '$1 days / $2 nights')) +
      '</b></div>' +
      '<div class="tv-row"><span>Travelers</span><b>' + state.count + '</b></div>' +
      (dep
        ? '<div class="tv-row"><span>Departs</span><b>' + fmt(dep.t) + ' ' + dep.year + '</b></div>' +
          '<div class="tv-row"><span>Returns</span><b>' + fmt(dep.r) + ' ' + dep.retYear + '</b></div>'
        : '') +
      '<div class="tv-total"><span>Total:</span><b>' + peso(total()) + '</b></div>' +
    '</aside>' +
    '<section class="tv-panel">';

    // right side: the chosen payment panel
    if (m === 'card') {
      h += '<div class="tv-pv"><div class="tv-pvf"><div class="tv-flip" id="tv-flip">' +

        // card front
        '<div class="tv-face">' +
          '<span class="tv-ring"></span>' +
          '<div class="tv-fr">' +
            '<svg width="38" height="28" viewBox="0 0 38 28" aria-hidden="true">' +
              '<rect width="38" height="28" rx="6" fill="#C9A85C"/>' +
              '<path d="M0 10h38M0 18h38M13 0v28M25 0v28" stroke="#24476B" stroke-opacity=".45"/>' +
            '</svg>' +
            '<span class="tv-brand">TeyVenture</span>' +
          '</div>' +
          '<div class="tv-pnum" id="tv-pv-num"></div>' +
          '<div class="tv-fr tv-fr--end">' +
            '<div><div class="tv-lb">CARDHOLDER</div><div class="tv-pv-v" id="tv-pv-name"></div></div>' +
            '<div><div class="tv-lb">EXPIRES</div><div class="tv-pv-v" id="tv-pv-exp"></div></div>' +
          '</div>' +
        '</div>' +

        // card back
        '<div class="tv-face tv-back">' +
          '<div class="tv-stripe"></div>' +
          '<div><div class="tv-lb tv-lb--cvc">CVC</div><div class="tv-cvcbox" id="tv-pv-cvc"></div></div>' +
          '<div class="tv-brand tv-brand--small">' + esc(p.title) + '</div>' +
        '</div>' +

      '</div></div></div>' +

      fld('tv-cname', 'Name on card',
        'type="text" data-c="name" autocomplete="cc-name" placeholder="As shown on your card" value="' + esc(c.name) + '"',
        'c-name') +
      fld('tv-cnum', 'Card number',
        'type="text" data-c="number" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" value="' + esc(c.number) + '"',
        'c-number') +
      '<div class="tv-fields">' +
        fld('tv-cexp', 'Expiry date',
          'type="text" data-c="exp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" value="' + esc(c.exp) + '"',
          'c-exp') +
        fld('tv-ccvc', 'Security code',
          'type="text" data-c="cvc" inputmode="numeric" autocomplete="cc-csc" placeholder="CVC" value="' + esc(c.cvc) + '"',
          'c-cvc') +
      '</div>';

    } else if (m === 'wallet') {
      var ap = state.wallet === 'apple';

      h += '<h3>Pay with a digital wallet</h3>' +
        '<p>Choose a wallet. You\u2019ll confirm the payment in the next step.</p>' +
        '<button type="button" class="tv-tile" data-act="wallet" data-w="apple" aria-pressed="' + ap + '">' +
          '<i>' + ICO.phone + '</i>' +
          '<span><strong>Apple Pay</strong><small>Pay with Face ID or Touch ID</small></span>' +
        '</button>' +
        '<button type="button" class="tv-tile" data-act="wallet" data-w="paypal" aria-pressed="' + !ap + '">' +
          '<i>' + ICO.pp + '</i>' +
          '<span><strong>PayPal</strong><small>Use your PayPal balance or linked accounts</small></span>' +
        '</button>' +
        '<div class="tv-total tv-total--flush"><span>Amount to pay</span><b>' + peso(total()) + '</b></div>';

    } else {
      var b = CFG.bank;

      h += '<h3>Pay by bank transfer</h3>' +
        '<p>Send the exact amount to the account below and include your reference code so we can match your payment.</p>' +
        '<div class="tv-bank">' +
          '<div class="tv-row"><span>Bank</span><b>' + esc(b.name) + '</b></div>' +
          '<div class="tv-row"><span>Account name</span><b>' + esc(b.accountName) + '</b></div>' +
          '<div class="tv-row"><span>Account number</span><b>' + esc(b.accountNumber) + '</b></div>' +
          '<div class="tv-row"><span>Reference code</span><b>' + esc(refCode()) + '</b></div>' +
          '<hr>' +
          '<div class="tv-row tv-row--base"><span>Amount</span><b class="tv-big">' + peso(total()) + '</b></div>' +
        '</div>' +
        '<div class="tv-drop">' +
          '<label for="tv-proof">Upload proof of payment (optional)</label>' +
          '<input id="tv-proof" type="file" accept="image/*,.pdf" data-proof' +
            (state.errors.proof ? ' aria-invalid="true" aria-describedby="tv-proof-e"' : '') + '>' +
          (state.proof ? '<span>Selected: ' + esc(state.proof) + '</span>' : '') +
          (state.errors.proof ? '<span class="tv-err" id="tv-proof-e">' + esc(state.errors.proof) + '</span>' : '') +
        '</div>' +
        '<p>Please complete your transfer by ' + esc(b.deadline) + '.</p>';
    }

    return h + termsHTML() + '</section></div>';
  }

  function refCode() {
    if (!state.ref) state.ref = 'TV-' + Date.now().toString(36).toUpperCase().slice(-6);
    return state.ref;
  }

  function updatePreview() {
    var c = state.card;
    var d = c.number.replace(/\s/g, '');

    var set = function (id, v) {
      var e = $('#' + id);
      if (e) e.textContent = v;
    };

    set('tv-pv-num', (d + new Array(17).join(DOT)).slice(0, 16).replace(/(.{4})/g, '$1 ').trim());
    set('tv-pv-name', (c.name || 'YOUR NAME').toUpperCase());
    set('tv-pv-exp', c.exp || 'MM/YY');
    set('tv-pv-cvc', c.cvc || DOT + DOT + DOT);
  }

  function luhn(n) {
    var s = 0;
    var alt = false;

    for (var i = n.length - 1; i >= 0; i--) {
      var d = +n[i];
      if (alt) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      s += d;
      alt = !alt;
    }

    return s % 10 === 0;
  }

  function isAmex(n) {
    return /^3[47]/.test(n);
  }

  function cardError(k) {
    var c = state.card;
    var n = c.number.replace(/\s/g, '');

    switch (k) {
      case 'name':
        var m0 = nameError(c.name, 'Name');
        return m0 === 'Enter at least 2 letters' ? 'Enter the name as shown on the card' : m0;

      case 'number':
        if (!n) return 'Required';
        if (!/^\d+$/.test(n)) return 'Digits only';
        if (isAmex(n) ? n.length !== 15 : (n.length < 13 || n.length > 16)) {
          return isAmex(n) ? 'American Express cards have 15 digits' : 'Card number must be 13 to 16 digits';
        }
        if (/^(\d)\1+$/.test(n) || !luhn(n)) return 'This card number is not valid';
        return '';

      case 'exp':
        if (!c.exp) return 'Required';
        var m = c.exp.match(/^(\d{2})\/(\d{2})$/);
        var now = new Date();
        if (!m) return 'Use the format MM/YY';
        if (+m[1] < 1 || +m[1] > 12) return 'Month must be 01 to 12';
        if (new Date(2000 + +m[2], +m[1], 1) <= now) return 'This card has expired';
        if (2000 + +m[2] > now.getFullYear() + 20) return 'Check the expiry year';
        return '';

      case 'cvc':
        if (!c.cvc) return 'Required';
        var need = isAmex(n) ? 4 : 3;
        if (c.cvc.length !== need) {
          return need === 4 ? 'American Express uses a 4-digit code' : 'Security code must be 3 digits';
        }
        return '';
    }

    return '';
  }

  function proofError(file) {
    if (!file) return '';
    if (!PROOF_EXT.test(file.name) && !/^image\//.test(file.type) && file.type !== 'application/pdf') {
      return 'Upload an image (JPG, PNG) or a PDF';
    }
    if (file.size > MAX_FILE_MB * 1048576) return 'File is too large (' + MAX_FILE_MB + ' MB max)';
    if (file.size === 0) return 'This file is empty';
    return '';
  }

  function validateBilling() {
    var e = {};

    if (state.method === 'card') {
      ['name', 'number', 'exp', 'cvc'].forEach(function (k) {
        var m = cardError(k);
        if (m) e['c-' + k] = m;
      });
    }

    if (state.method === 'bank' && state.proofErr) e.proof = state.proofErr;
    if (!state.terms) e.terms = 'Please accept the terms to continue';

    return e;
  }


  /* finish */
  function buildBooking() {
    var d = chosen();
    var p = state.pkg;
    var method;

    if (state.method === 'wallet') method = state.wallet === 'apple' ? 'apple-pay' : 'paypal';
    else if (state.method === 'bank') method = 'bank-transfer';
    else method = 'card';

    // card numbers are deliberately NOT included: use a payment provider for real card payments
    return {
      reference: refCode(),
      package: {
        id: p.id,
        title: p.title,
        destination: p.destination,
        duration: p.duration
      },
      travelers: state.tr.slice(0, state.count).map(function (t) {
        return {
          givenNames: t.given.trim(),
          surname: t.sur.trim(),
          dateOfBirth: t.dob,
          nationality: t.nat,
          passportNumber: t.pass.trim(),
          passportExpiry: t.exp
        };
      }),
      departure: {
        date: iso(d.t),
        returnDate: d.retISO
      },
      payment: {
        method: method,
        total: total(),
        currency: 'PHP',
        proofFileName: state.proof
      },
      termsAccepted: state.terms
    };
  }

  function stepDone() {
    // the booking card closes (hides) at that moment.
    var bank = state.method === 'bank';

    return '<div class="tv-done">' +
      '<div class="tv-ok">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' +
      '</div>' +
      '<h3 class="tv-h tv-done-title">' + (bank ? 'Booking request received' : 'Reservation Confirmed') + '</h3>' +
      '<p class="tv-sub tv-sub--done">' +
        (bank
          ? 'Transfer ' + peso(total()) + ' using the reference code on your receipt. We\u2019ll confirm your booking once the payment is received.'
          : 'Your travel reservation has been processed and registered with Teyventure.') +
      '</p>' +
      '<div class="tv-vbtns">' +
        '<button type="button" class="tv-vbtn tv-vbtn--teal" data-act="close">Return to Portal</button>' +
      '</div>' +
    '</div>';
  }


  /* receipt */
  function receiptHTML() {
    var d = chosen();
    var bank = state.method === 'bank';
    var t = state.tr[0];
    var who = (t.given + ' ' + t.sur).trim();
    var n = state.count;

    var PRINT =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z"/>' +
      '</svg>';

    return '<div class="tv-rwrap"><div class="tv-rcard" role="dialog" aria-modal="true" aria-labelledby="tv-rtitle">' +
      '<div class="tv-ok">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' +
      '</div>' +
      '<h3 class="tv-rtitle" id="tv-rtitle">' + (bank ? 'Awaiting Bank Transfer' : 'Payment Received') + '</h3>' +
      '<hr class="tv-done-hr">' +

      '<div class="tv-receipt">' +
        '<div class="tv-rr tv-rr--ref"><span>Booking Reference:</span><b>' + esc(state.ref) + '</b></div>' +
        '<hr>' +
        '<div class="tv-rr tv-rr--bold"><span>Reserved Package:</span><b>' + esc(state.pkg.title) + '</b></div>' +
        '<div class="tv-rr"><span>Lead Traveler:</span><b>' + esc(who) + '</b></div>' +
        '<div class="tv-rr"><span>Travelers:</span><b>' + n + (n === 1 ? ' traveler' : ' travelers') + '</b></div>' +
        '<div class="tv-rr"><span>Departure:</span><b>' + fmt(d.t) + ' ' + d.year + '</b></div>' +
        '<div class="tv-rr"><span>Return:</span><b>' + fmt(d.r) + ' ' + d.retYear + '</b></div>' +
        '<hr>' +
        '<div class="tv-rr tv-rr--pay' + (bank ? ' is-pending' : '') + '">' +
          '<span>Payment Status:</span>' +
          '<b>' + peso(total()) + (bank ? ' (Awaiting Bank Transfer)' : ' (Paid &amp; Confirmed)') + '</b>' +
        '</div>' +
      '</div>' +

      '<div class="tv-vbtns">' +
        '<button type="button" class="tv-vbtn tv-vbtn--line" data-act="print">' + PRINT + 'Download / Print Voucher</button>' +
        '<button type="button" class="tv-vbtn tv-vbtn--teal" data-act="closereceipt">Return to Portal</button>' +
      '</div>' +
    '</div></div>';
  }

  function showReceipt() {
    if (!overlay || $('.tv-rwrap')) return;

    overlay.insertAdjacentHTML('beforeend', receiptHTML());
    overlay.classList.add('has-receipt');

    var b = $('.tv-rwrap [data-act="closereceipt"]');
    if (b) b.focus({ preventScroll: true });
  }

  function footHTML() {
    var s = state.step;
    if (s === 'done') return '';

    var c = s === 2 ? chosen() : null;
    var ok = s !== 2 || (c && c.st === 'ok');
    var label = 'Continue';

    if (s === 3) {
      if (state.method === 'card') label = 'Pay ' + peso(total());
      else if (state.method === 'wallet') label = 'Pay with ' + (state.wallet === 'apple' ? 'Apple Pay' : 'PayPal');
      else label = 'Submit transfer details';
    }

    return '<button type="button" class="tv-ghost" data-act="back">' + (s === 1 ? 'Cancel' : 'Go Back') + '</button>' +
      '<button type="button" class="tv-gold" data-act="' + (s === 3 ? 'pay' : 'next') + '"' +
        (ok ? '' : ' disabled') + '>' + label + '</button>';
  }


  /* events */
  function onClick(e) {
    if (e.target === overlay) {
      close();
      return;
    }
    if (e.target.classList && e.target.classList.contains('tv-rwrap')) {
      close();
      return;
    }

    var el = e.target.closest('[data-act]');
    if (!el) return;

    var act = el.getAttribute('data-act');

    switch (act) {
      case 'close':
        close();
        break;

      case 'print':
        window.print();
        break;

      case 'closereceipt':
        close();
        break;

      case 'save':
        var on = el.getAttribute('aria-pressed') !== 'true';
        el.setAttribute('aria-pressed', on);
        el.classList.toggle('is-on', on);
        break;

      case 'cleardraft':
        clearDraft();
        state.restored = false;
        state.errors = {};
        state.banner = '';
        state.tr = newState(state.pkg).tr;
        render(true);

        var f0 = $('#tv-body input');
        if (f0) f0.focus({ preventScroll: true });
        break;

      case 'inc':
        state.count = Math.min(state.pkg.max, state.count + 1);
        saveDraftSoon();
        render(true);
        break;

      case 'dec':
        state.count = Math.max(state.pkg.min, state.count - 1);
        saveDraftSoon();
        render(true);
        break;

      case 'prev':
        state.mi = Math.max(0, state.mi - 1);
        render(true);
        break;

      case 'next':
        if (el.disabled) break;
        state.banner = '';

        if (state.step === 1) {
          state.errors = validateTravelers();
          if (Object.keys(state.errors).length) {
            state.banner = 'Please complete the highlighted fields.';
            render(false);
            focusFirstError();
            return;
          }
        }

        if (state.step === 2) {
          var c = chosen();
          if (!c) {
            state.banner = 'Please select a departure date.';
            render(true);
            return;
          }
          if (c.st !== 'ok') return;
          if (passportIssue(c)) {
            render(true);
            return;
          }
        }

        state.step++;
        state.errors = {};
        render(false);
        $('#tv-body').focus({ preventScroll: true });
        break;

      case 'back':
        state.banner = '';
        if (state.step === 1) {
          close();
        } else {
          state.step--;
          state.errors = {};
          render(false);
        }
        break;

      case 'pick':
        state.sel = el.getAttribute('data-key');
        render(true);

        var dt = $('.tv-detail');
        if (dt) dt.scrollIntoView({ block: 'nearest' });
        break;

      case 'waitlist':
        var c2 = chosen();
        state.wl[c2.key] = !state.wl[c2.key];
        render(true);
        break;

      case 'method':
        state.method = el.getAttribute('data-m');
        state.errors = {};
        state.proofErr = '';
        state.proof = '';
        state.banner = '';
        render(true);
        break;

      case 'wallet':
        state.wallet = el.getAttribute('data-w');
        render(true);
        break;

      case 'pay':
        state.errors = validateBilling();
        if (Object.keys(state.errors).length) {
          state.banner = 'Please fix the highlighted fields.';
          render(false);
          focusFirstError();
          return;
        }

        state.banner = '';
        var booking = buildBooking();
        clearDraft();
        state.step = 'done';
        render(false);
        CFG.onSubmit(booking);
        showReceipt();
        break;
    }
  }

  function clearErr(el) {
    el.removeAttribute('aria-invalid');
    var m = document.getElementById(el.id + '-e');
    if (m) m.remove();
  }

  // show / clear a message under a field without re-rendering the whole step
  function showErr(el, key, msg) {
    clearErr(el);
    state.errors[key] = msg;
    el.setAttribute('aria-invalid', 'true');
    el.setAttribute('aria-describedby', el.id + '-e');
    el.insertAdjacentHTML('afterend', '<span class="tv-err" id="' + el.id + '-e">' + esc(msg) + '</span>');
  }

  function setVal(el, v) {
    if (el.value === v) return false;

    var pos = el.selectionStart;
    var diff = el.value.length - v.length;
    el.value = v;

    try {
      if (pos != null) el.setSelectionRange(Math.max(0, pos - diff), Math.max(0, pos - diff));
    } catch (x) {
      /* some inputs have no caret */
    }

    return true;
  }

  function errKey(el) {
    if (el.hasAttribute('data-t')) return el.getAttribute('data-t') + '-' + el.getAttribute('data-k');
    if (el.hasAttribute('data-c')) return 'c-' + el.getAttribute('data-c');
    return '';
  }

  function onInput(e) {
    var el = e.target;
    var v = el.value;
    var stripped = false;

    // traveler fields
    if (el.hasAttribute('data-t')) {
      var ti = +el.getAttribute('data-t');
      var tk = el.getAttribute('data-k');

      if (tk === 'given' || tk === 'sur') {
        var nv = cleanName(v.replace(NAME_BAD, ''));
        stripped = nv !== cleanName(v);
        v = nv;
        if (setVal(el, v)) { /* value changed */ }
      }

      if (tk === 'pass') {
        var pv = v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 9);
        stripped = pv.length !== v.replace(/\s/g, '').length && v.replace(/[A-Za-z0-9]/g, '').length > 0;
        v = pv;
        setVal(el, v);
      }

      state.tr[ti][tk] = v;
      delete state.errors[ti + '-' + tk];
      clearErr(el);

      if (stripped) {
        showErr(el, ti + '-' + tk, tk === 'pass' ? 'Letters and numbers only' : NAME_HINT);
      }
      return;
    }

    // card fields
    if (el.hasAttribute('data-c')) {
      var k = el.getAttribute('data-c');

      if (k === 'name') {
        var cn = cleanName(v.replace(NAME_BAD, '')).slice(0, 50);
        stripped = cn !== cleanName(v);
        v = cn;
      }

      if (k === 'number') {
        v = (v.replace(/\D/g, '').slice(0, 16).match(/.{1,4}/g) || []).join(' ');
      }

      if (k === 'exp') {
        var d = v.replace(/\D/g, '').slice(0, 4);
        // typing 5 becomes 05
        if (d.length === 1 && +d > 1 && e.inputType !== 'deleteContentBackward') d = '0' + d;
        v = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
      }

      if (k === 'cvc') {
        v = v.replace(/\D/g, '').slice(0, 4);
      }

      setVal(el, v);
      state.card[k] = v;
      delete state.errors['c-' + k];
      clearErr(el);
      updatePreview();

      if (stripped) showErr(el, 'c-' + k, NAME_HINT);
    }
  }

  // when the person leaves a field: tidy it and check it (empty fields wait until Continue / Pay)
  function onBlur(e) {
    var el = e.target;
    if (!el.isConnected || !state) return;

    var key = errKey(el);
    if (!key) return;

    var msg;

    if (el.hasAttribute('data-t')) {
      var i = +el.getAttribute('data-t');
      var k = el.getAttribute('data-k');
      if (i >= state.count) return;

      if (k === 'given' || k === 'sur') {
        var nv = cleanName(el.value).trim();
        el.value = nv;
        state.tr[i][k] = nv;
      }

      if (!el.value) return;
      msg = travelerError(i, k);
    } else {
      var ck = el.getAttribute('data-c');

      if (ck === 'name') {
        var cv = cleanName(el.value).trim();
        el.value = cv;
        state.card[ck] = cv;
      }

      if (!el.value) return;
      msg = cardError(ck);
    }

    if (msg) {
      showErr(el, key, msg);
    } else {
      delete state.errors[key];
      clearErr(el);
    }
  }

  function onChange(e) {
    var el = e.target;

    if (el.hasAttribute('data-t')) {
      var ci = +el.getAttribute('data-t');
      var ck = el.getAttribute('data-k');

      state.tr[ci][ck] = el.value;
      delete state.errors[ci + '-' + ck];
      clearErr(el);

      if (el.value && (ck === 'dob' || ck === 'exp' || ck === 'nat')) {
        var cm = travelerError(ci, ck);
        if (cm) showErr(el, ci + '-' + ck, cm);
      }

    } else if (el.hasAttribute('data-flag')) {
      state[el.getAttribute('data-flag')] = el.checked;

      if (el.getAttribute('data-flag') === 'terms') {
        delete state.errors.terms;
        el.removeAttribute('aria-invalid');

        var m = el.closest('.tv-panel').querySelector('.tv-err:last-child');
        if (m && !m.id) m.remove();
      }

    } else if (el.hasAttribute('data-proof')) {
      var f = el.files && el.files[0];
      var pe = proofError(f);

      state.proofErr = pe;
      state.proof = f && !pe ? f.name : '';
      delete state.errors.proof;
      if (pe) state.errors.proof = pe;

      render(true);
    }
  }

  function onFocus(e) {
    if (e.target.id !== 'tv-ccvc') return;

    var f = $('#tv-flip');
    if (f) f.classList.toggle('is-flipped', e.type === 'focusin');
  }

  function onKey(e) {
    if (!overlay) return;

    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key !== 'Tab') return;

    var scope = overlay.querySelector('.tv-rwrap') || overlay;
    var list = Array.prototype.filter.call(
      scope.querySelectorAll('button:not([disabled]),input:not([disabled]),select,[tabindex]:not([tabindex="-1"])'),
      function (n) {
        return n.offsetParent !== null;
      }
    );
    if (!list.length) return;

    var first = list[0];
    var last = list[list.length - 1];

    if (e.shiftKey && (document.activeElement === first || !scope.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }


  /* -hook up the package buttons */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.trv-btn');
    if (!b) return;

    var pkg = readPackage(b);
    if (!pkg) return;

    e.preventDefault();
    open(pkg, b);
  });

  function labelButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('.trv-btn'), function (b) {
      var card = b.closest('.trv-card');
      b.setAttribute('aria-label', 'Book ' + txt(card && card.querySelector('.trv-title')));
      b.setAttribute('aria-haspopup', 'dialog');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', labelButtons);
  } else {
    labelButtons();
  }

  window.TeyVentureBooking = { open: open, close: close, config: CFG };
})();