/* ==========================================================
   TeyVenture booking pop-up
   Click a package's arrow button -> blurred pop-up with
   1) Travelers  2) Departure  3) Billing and Payments
   Everything is read from the package card, no extra HTML needed.
   ========================================================== */
(function () {
  'use strict';

  /* ---------- things you will want to edit ---------- */
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
    // Real availability: window.TEYVENTURE_BOOKING = { departures: { 'INAZ-GP03': { '2027-05-16': 8, '2027-05-30': 0 } } }
    departures: null,
    // Called when the customer presses Pay. Send `booking` to your server here.
    onSubmit: function (booking) { console.log('[TeyVenture] booking to send to your server:', booking); }
  };
  var CFG = Object.assign({}, DEFAULTS, window.TEYVENTURE_BOOKING || {});

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var NATS = ['Philippines','United States','Japan','South Korea','China','Taiwan','Hong Kong','Singapore','Malaysia','Indonesia','Thailand','Vietnam','India','Australia','New Zealand','Canada','United Kingdom','Ireland','France','Germany','Italy','Spain','Netherlands','Switzerland','United Arab Emirates','Saudi Arabia','Other'];
  var PESO = '\u20B1', DOT = '\u2022';

  var overlay = null, state = null, lastFocus = null;

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function p2(n) { return String(n).padStart(2, '0'); }
  function peso(n) { return PESO + Number(n).toLocaleString('en-PH'); }
  function txt(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function $(sel) { return overlay ? overlay.querySelector(sel) : null; }
  function iso(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); }
  function fmt(t) { var d = new Date(t); return DAYS[d.getUTCDay()] + ', ' + p2(d.getUTCDate()) + ' ' + MONTHS[d.getUTCMonth()].slice(0, 3); }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h; }
  function total() { return state.pkg.perPax ? state.pkg.price * state.count : state.pkg.price; }

  /* ---------- read the package from its card ---------- */
  function readPackage(btn) {
    var card = btn.closest('.trv-card');
    if (!card) return null;
    var solo = card.classList.contains('trv-solo');
    var badge = txt(card.querySelector('.trv-badge'));
    var amount = card.querySelector('.trv-amount');
    var price = parseInt((amount && amount.firstChild ? amount.firstChild.textContent : '').replace(/[^\d]/g, ''), 10) || 0;
    var per = txt(amount && amount.querySelector('small')).toUpperCase();
    var id = (card.querySelector('.trv-code') ? card.querySelector('.trv-code').textContent : '').replace(/\s+/g, '').replace(/^SOLO/, '');
    var min = 1, max = 1;
    if (!solo) { var m = badge.match(/(\d+)(?:\s*-\s*(\d+))?/); if (m) { min = parseInt(m[1], 10); max = m[2] ? parseInt(m[2], 10) : min; } }
    var soloBadge = txt(document.querySelector('.trv-solo .trv-badge'));
    var d = (solo ? badge : soloBadge).match(/(\d+)\s*DAYS?\s*\/\s*(\d+)\s*NIGHTS?/i);
    var days = d ? +d[1] : 4, nights = d ? +d[2] : 3;
    var img = card.querySelector('.trv-media img');
    return {
      id: id, title: txt(card.querySelector('.trv-title')), destination: txt(document.querySelector('.pkg-title')),
      code: (solo ? 'SOLO \u00B7 ' : '') + id, price: price, perPax: /PAX/.test(per), min: min, max: max,
      days: days, nights: nights, duration: days + ' DAYS / ' + nights + ' NIGHTS',
      image: img ? img.getAttribute('src') : ''
    };
  }

  function newState(pkg) {
    var tr = []; for (var i = 0; i < 10; i++) tr.push({ given: '', sur: '', dob: '', nat: '', pass: '', exp: '' });
    return { pkg: pkg, step: 1, count: pkg.min, tr: tr, mi: 0, sel: null, focus: null, wl: {}, method: 'card', wallet: 'apple',
      card: { name: '', number: '', exp: '', cvc: '' }, sameAddr: true, terms: false, proof: '', errors: {}, banner: '', ref: '' };
  }

  /* ---------- open / close ---------- */
  function open(pkg, trigger) {
    if (overlay) return;
    state = newState(pkg); lastFocus = trigger || document.activeElement;
    overlay = document.createElement('div');
    overlay.className = 'tv-overlay';
    overlay.innerHTML = '<div class="tv-dialog" role="dialog" aria-modal="true" aria-labelledby="tv-title">' + heroHTML() +
      '<div class="tv-steps" id="tv-steps"></div><div class="tv-body" id="tv-body" tabindex="-1"></div><div class="tv-foot" id="tv-foot"></div></div>';
    document.body.appendChild(overlay);
    document.documentElement.classList.add('tv-lock');
    overlay.addEventListener('click', onClick);
    overlay.addEventListener('input', onInput);
    overlay.addEventListener('change', onChange);
    overlay.addEventListener('focusin', onFocus);
    overlay.addEventListener('focusout', onFocus);
    document.addEventListener('keydown', onKey);
    var hi = overlay.querySelector('.tv-hero > img'); if (hi) hi.addEventListener('error', function () { hi.remove(); });
    render(false);
    var first = $('#tv-body input, #tv-body button');
    (first || $('#tv-body')).focus({ preventScroll: true });
  }
  function close() {
    if (!overlay) return;
    document.removeEventListener('keydown', onKey);
    overlay.remove(); overlay = null; state = null;
    document.documentElement.classList.remove('tv-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------- static header ---------- */
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/></svg>';
  function heroHTML() {
    var p = state.pkg;
    return '<div class="tv-hero">' + (p.image ? '<img src="' + esc(p.image) + '" alt="">' : '') + '<div class="tv-shade"></div>' +
      '<span class="tv-tag">' + esc(p.duration) + '</span>' +
      '<div class="tv-hbtns"><button type="button" class="tv-ib" data-act="save" aria-pressed="false" aria-label="Save package"><svg viewBox="0 0 24 24"><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/></svg></button>' +
      '<button type="button" class="tv-ib" data-act="close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="tv-htitle"><span class="tv-dest">' + esc(p.destination) + ' \u00B7 ' + esc(p.code) + '</span><h2 id="tv-title">' + esc(p.title) + '</h2></div>' +
      (CFG.rating != null ? '<div class="tv-rate" role="img" aria-label="Rated ' + CFG.rating.toFixed(1) + ' out of 5">' + new Array(6).join(STAR) + '<b>' + CFG.rating.toFixed(1) + '</b></div>' : '') + '</div>';
  }

  /* ---------- render ---------- */
  var CHECK = '<svg viewBox="0 0 24 24" role="img" aria-label="Completed"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function stepsHTML() {
    var labels = ['Package and Travelers', 'Departure', 'Billing and Payments'], s = state.step === 'done' ? 4 : state.step, h = '';
    labels.forEach(function (l, i) {
      var n = i + 1, cls = n < s ? 'is-done' : (n === s ? 'is-cur' : '');
      h += '<span class="tv-step ' + cls + '"' + (n === s ? ' aria-current="step"' : '') + '><span class="tv-dot">' + (n < s ? CHECK : n) + '</span><span class="tv-lab">' + l + '</span></span>';
      if (n < 3) h += '<span class="tv-line ' + (n < s ? 'is-done' : '') + '"></span>';
    });
    return h;
  }
  function render(keepScroll) {
    var body = $('#tv-body'), top = body.scrollTop, h;
    $('#tv-steps').innerHTML = stepsHTML();
    h = state.step === 1 ? stepTravelers() : state.step === 2 ? stepDeparture() : state.step === 3 ? stepBilling() : stepDone();
    body.innerHTML = h;
    body.scrollTop = keepScroll ? top : 0;
    $('#tv-foot').innerHTML = footHTML();
    if (state.step === 3) updatePreview();
  }
  function focusFirstError() {
    var el = $('[aria-invalid="true"]'); if (el) el.focus();
  }

  /* ---------- step 1: travelers ---------- */
  function stepTravelers() {
    var p = state.pkg, ranged = p.max > p.min, h = '<h3 class="tv-h">Your Travel Party</h3>' +
      '<p class="tv-sub">Enter each traveler\u2019s details exactly as they appear on their passport.</p>';
    if (state.banner) h += '<div class="tv-banner" role="alert">' + esc(state.banner) + '</div>';
    h += '<div class="tv-slotbar"><span>' + state.count + (state.count === 1 ? ' traveler slot' : ' traveler slots') + ' \u00B7 ' +
      (ranged ? 'this package fits ' + p.min + ' to ' + p.max : 'fixed for this package') + '</span>';
    if (ranged) h += '<div class="tv-count"><button type="button" class="tv-circ" data-act="dec" aria-label="Remove a traveler"' + (state.count <= p.min ? ' disabled' : '') + '>\u2212</button><b aria-live="polite">' + state.count +
      '</b><button type="button" class="tv-circ" data-act="inc" aria-label="Add a traveler"' + (state.count >= p.max ? ' disabled' : '') + '>+</button></div>';
    h += '</div>';
    for (var i = 0; i < state.count; i++) h += travelerCard(i);
    return h;
  }
  function travelerCard(i) {
    var t = state.tr[i], F = [['given', 'Given name(s)', 'text'], ['sur', 'Surname', 'text'], ['dob', 'Date of birth', 'date'], ['nat', 'Nationality', 'select'], ['pass', 'Passport number', 'text'], ['exp', 'Passport expiry', 'date']];
    var h = '<div class="tv-tcard"><div class="tv-tname"><span class="tv-num">' + (i + 1) + '</span>' + (i === 0 ? 'Lead traveler' : 'Traveler ' + (i + 1)) + '</div><div class="tv-fields">';
    F.forEach(function (f) {
      var k = f[0], id = 'tv-t' + i + '-' + k, err = state.errors[i + '-' + k], a = ' id="' + id + '" data-t="' + i + '" data-k="' + k + '"' + (err ? ' aria-invalid="true" aria-describedby="' + id + '-e"' : '');
      var c;
      if (f[2] === 'select') {
        c = '<select' + a + '><option value="">Select country</option>' + NATS.map(function (n) { return '<option' + (t.nat === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>';
      } else {
        var lim = k === 'dob' ? ' max="' + todayISO() + '"' : (k === 'exp' ? ' min="' + todayISO() + '"' : '');
        c = '<input' + a + ' type="' + f[2] + '" value="' + esc(t[k]) + '"' + lim + (f[2] === 'text' ? ' autocomplete="off"' : '') + '>';
      }
      h += '<div class="tv-f"><label for="' + id + '">' + f[1] + ' <span class="tv-req" aria-hidden="true">*</span></label>' + c + (err ? '<span class="tv-err" id="' + id + '-e">' + esc(err) + '</span>' : '') + '</div>';
    });
    return h + '</div></div>';
  }
  function validateTravelers() {
    var e = {}, today = todayISO();
    for (var i = 0; i < state.count; i++) {
      var t = state.tr[i];
      if (!t.given.trim()) e[i + '-given'] = 'Required';
      if (!t.sur.trim()) e[i + '-sur'] = 'Required';
      if (!t.dob) e[i + '-dob'] = 'Required'; else if (t.dob > today) e[i + '-dob'] = 'Enter a valid date';
      if (!t.nat) e[i + '-nat'] = 'Required';
      if (!t.pass.trim()) e[i + '-pass'] = 'Required'; else if (t.pass.trim().length < 6) e[i + '-pass'] = 'Passport number looks too short';
      if (!t.exp) e[i + '-exp'] = 'Required'; else if (t.exp <= today) e[i + '-exp'] = 'This passport has expired';
    }
    return e;
  }

  /* ---------- step 2: departure ---------- */
  function monthList() {
    var n = new Date(), out = [];
    for (var i = 1; i <= CFG.monthsAhead; i++) { var d = new Date(n.getFullYear(), n.getMonth() + i, 1); out.push({ y: d.getFullYear(), m: d.getMonth() }); }
    return out;
  }
  function placesFor(y, m, d) {
    var key = y + '-' + p2(m + 1) + '-' + p2(d), p = state.pkg;
    if (CFG.departures) { var set = CFG.departures[p.id]; return set && set[key] != null ? set[key] : undefined; }
    if (new Date(Date.UTC(y, m, d)).getUTCDay() !== CFG.departureWeekday) return undefined;
    return (d * 7 + m * 5 + y + hash(p.id)) % 11;           // placeholder availability (0-10)
  }
  function statusOf(places) { return places === 0 ? 'sold' : (places < state.count ? 'short' : 'ok'); }
  function chosen() {
    if (!state.sel) return null;
    var a = state.sel.split('-').map(Number), pl = placesFor(a[0], a[1] - 1, a[2]);
    if (pl === undefined) return null;
    var t = Date.UTC(a[0], a[1] - 1, a[2]), r = t + state.pkg.nights * 864e5;
    return { key: state.sel, places: pl, st: statusOf(pl), t: t, r: r, retISO: iso(r), year: a[0], retYear: new Date(r).getUTCFullYear() };
  }
  function passportIssue(c) {
    for (var i = 0; i < state.count; i++) if (state.tr[i].exp && state.tr[i].exp < c.retISO) return (i === 0 ? 'The lead traveler\u2019s' : 'Traveler ' + (i + 1) + '\u2019s') + ' passport expires before the return date. Go back to update it, or choose another departure.';
    return '';
  }
  var ICON = { ok: 'M8 12.5l3 3 5-6', short: 'M12 7.5v5M12 16v.5', sold: 'M9 9l6 6M15 9l-6 6' };
  function stepDeparture() {
    var ms = monthList(), cur = ms[state.mi], first = new Date(Date.UTC(cur.y, cur.m, 1)).getUTCDay(), dim = new Date(Date.UTC(cur.y, cur.m + 1, 0)).getUTCDate();
    var h = '<div class="tv-titlerow"><h3 class="tv-h tv-h--flush">Available Departures</h3><span class="tv-pill"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/></svg>Your group: ' + state.count + (state.count === 1 ? ' traveler' : ' travelers') + '</span></div>';
    if (state.banner) h += '<div class="tv-banner" role="alert">' + esc(state.banner) + '</div>';
    h += '<div class="tv-cal"><div class="tv-calhead"><button type="button" class="tv-nav" data-act="prev" aria-label="Previous month"' + (state.mi === 0 ? ' disabled' : '') + '><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<strong aria-live="polite">' + MONTHS[cur.m] + ' ' + cur.y + '</strong><button type="button" class="tv-nav" data-act="next" aria-label="Next month"' + (state.mi === ms.length - 1 ? ' disabled' : '') + '><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div><div class="tv-grid">';
    DAYS.forEach(function (d) { h += '<span class="tv-wd">' + d.toUpperCase() + '</span>'; });
    for (var i = 0; i < first; i++) h += '<span class="tv-plain"></span>';
    for (var d = 1; d <= dim; d++) {
      var pl = placesFor(cur.y, cur.m, d);
      if (pl === undefined || Date.UTC(cur.y, cur.m, d) < Date.now() + CFG.minLeadDays * 864e5) { h += '<span class="tv-plain">' + d + '</span>'; continue; }
      var key = cur.y + '-' + p2(cur.m + 1) + '-' + p2(d), st = statusOf(pl), on = state.sel === key;
      var label = fmt(Date.UTC(cur.y, cur.m, d)) + ', ' + (st === 'sold' ? 'sold out' : st === 'short' ? 'not enough places for your group' : pl + ' places available');
      h += '<button type="button" class="tv-day' + (st === 'short' ? ' is-short' : st === 'sold' ? ' is-sold' : '') + (on && st === 'ok' ? ' is-sel' : '') + (on && st !== 'ok' ? ' is-focus' : '') +
        '" data-act="pick" data-key="' + key + '" aria-pressed="' + on + '" aria-label="' + esc(label) + '">' + d + '</button>';
    }
    h += '</div><div class="tv-legend"><span><i class="tv-sw tv-sw--ok"></i>Available</span><span><i class="tv-sw tv-sw--short"></i>Not enough places for your group</span>' +
      '<span><i class="tv-sw tv-sw--sold"></i>Sold out</span><span><i class="tv-sw tv-sw--sel"></i>Selected</span></div></div>';
    var c = chosen();
    if (!c) return h + '<div class="tv-detail" aria-live="polite"><span class="tv-hint">Select a date on the calendar to choose your departure.</span></div>';
    var head = c.st === 'sold' ? 'Sold out' : c.st === 'short' ? (c.places === 1 ? '1 place left' : c.places + ' places left') : c.places + ' places available';
    var wl = state.wl[c.key], sub = c.st === 'sold' ? (wl ? 'You\u2019re on the waitlist' : 'Waitlist open') : c.st === 'short' ? 'Not enough places for your group' : 'Guaranteed departure';
    var issue = c.st === 'ok' ? passportIssue(c) : '';
    h += '<div class="tv-detail is-' + c.st + '" aria-live="polite"><span><span class="tv-dk">DEPARTS \u00B7 ' + c.year + '</span><span class="tv-dv">' + fmt(c.t) + '</span></span>' +
      '<svg class="tv-arrow" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg><span><span class="tv-dk">RETURNS' + (c.retYear !== c.year ? ' \u00B7 ' + c.retYear : '') + '</span><span class="tv-dv">' + fmt(c.r) + '</span></span>' +
      '<span class="tv-note">' + sub + (c.st === 'ok' ? ' \u00B7 ' + state.count + (state.count === 1 ? ' traveler' : ' travelers') : '') + '</span>' +
      '<span class="tv-stat"><strong><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="' + ICON[c.st] + '"/></svg>' + head + '</strong></span>' +
      (c.st === 'sold' ? '<button type="button" class="tv-wl" data-act="waitlist" aria-pressed="' + !!wl + '">' + (wl ? 'On waitlist' : 'Join waitlist') + '</button>' : '') + '</div>';
    if (issue) h += '<div class="tv-banner tv-banner--tight" role="alert">' + esc(issue) + '</div>';
    return h;
  }

  /* ---------- step 3: billing ---------- */
  var ICO = {
    card: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>',
    wallet: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h5v3h-5a1.5 1.5 0 0 1 0-3z"/></svg>',
    bank: '<svg viewBox="0 0 24 24"><path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></svg>',
    pp: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M9.5 16.5l1.5-9h3a2.3 2.3 0 0 1 0 4.6h-2.4"/></svg>'
  };
  function fld(id, label, attrs, key, extra) {
    var err = state.errors[key];
    return '<div class="tv-f"' + (extra || '') + '><label for="' + id + '">' + label + ' <span class="tv-req" aria-hidden="true">*</span></label><input id="' + id + '" ' + attrs + (err ? ' aria-invalid="true" aria-describedby="' + id + '-e"' : '') + '>' +
      (err ? '<span class="tv-err" id="' + id + '-e">' + esc(err) + '</span>' : '') + '</div>';
  }
  function termsHTML() {
    var err = state.errors.terms;
    return '<label class="tv-chk"><input type="checkbox" data-flag="terms"' + (state.terms ? ' checked' : '') + (err ? ' aria-invalid="true"' : '') + '>I agree to the booking terms and cancellation policy</label>' + (err ? '<span class="tv-err">' + esc(err) + '</span>' : '');
  }
  function stepBilling() {
    var p = state.pkg, m = state.method, c = state.card, c0 = state.tr[0], dep = chosen();
    var h = '<h3 class="tv-h">How would you like to pay?</h3>';
    if (state.banner) h += '<div class="tv-banner" role="alert">' + esc(state.banner) + '</div>';
    h += '<div class="tv-pay"><aside class="tv-side">' +
      [['card', ICO.card, 'Credit / debit card'], ['wallet', ICO.wallet, 'Apple Pay / PayPal'], ['bank', ICO.bank, 'Bank Transfer']].map(function (x) {
        return '<button type="button" class="tv-m" data-act="method" data-m="' + x[0] + '" aria-pressed="' + (m === x[0]) + '">' + x[1] + x[2] + '</button>'; }).join('') +
      '<div class="tv-hr"></div><div class="tv-cap">ORDER SUMMARY</div>' +
      '<div class="tv-row"><span>Package</span><b>' + esc(p.title) + '</b></div><div class="tv-row"><span>Duration</span><b>' + esc(p.duration.toLowerCase().replace(/^(\d+) days \/ (\d+) nights$/, '$1 days / $2 nights')) + '</b></div>' +
      '<div class="tv-row"><span>Travelers</span><b>' + state.count + '</b></div>' +
      (dep ? '<div class="tv-row"><span>Departs</span><b>' + fmt(dep.t) + ' ' + dep.year + '</b></div><div class="tv-row"><span>Returns</span><b>' + fmt(dep.r) + ' ' + dep.retYear + '</b></div>' : '') +
      '<div class="tv-total"><span>Total:</span><b>' + peso(total()) + '</b></div></aside><section class="tv-panel">';
    if (m === 'card') {
      h += '<div class="tv-pv"><div class="tv-pvf"><div class="tv-flip" id="tv-flip"><div class="tv-face"><span class="tv-ring"></span><div class="tv-fr">' +
        '<svg width="38" height="28" viewBox="0 0 38 28" aria-hidden="true"><rect width="38" height="28" rx="6" fill="#C9A85C"/><path d="M0 10h38M0 18h38M13 0v28M25 0v28" stroke="#24476B" stroke-opacity=".45"/></svg><span class="tv-brand">TeyVenture</span></div>' +
        '<div class="tv-pnum" id="tv-pv-num"></div><div class="tv-fr tv-fr--end"><div><div class="tv-lb">CARDHOLDER</div><div class="tv-pv-v" id="tv-pv-name"></div></div><div><div class="tv-lb">EXPIRES</div><div class="tv-pv-v" id="tv-pv-exp"></div></div></div></div>' +
        '<div class="tv-face tv-back"><div class="tv-stripe"></div><div><div class="tv-lb tv-lb--cvc">CVC</div><div class="tv-cvcbox" id="tv-pv-cvc"></div></div><div class="tv-brand tv-brand--small">' + esc(p.title) + '</div></div></div></div></div>' +
        fld('tv-cname', 'Name on card', 'type="text" data-c="name" autocomplete="cc-name" placeholder="As shown on your card" value="' + esc(c.name) + '"', 'c-name') +
        fld('tv-cnum', 'Card number', 'type="text" data-c="number" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" value="' + esc(c.number) + '"', 'c-number') +
        '<div class="tv-fields">' + fld('tv-cexp', 'Expiry date', 'type="text" data-c="exp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" value="' + esc(c.exp) + '"', 'c-exp') +
        fld('tv-ccvc', 'Security code', 'type="text" data-c="cvc" inputmode="numeric" autocomplete="cc-csc" placeholder="CVC" value="' + esc(c.cvc) + '"', 'c-cvc') + '</div>' +
        '<label class="tv-chk"><input type="checkbox" data-flag="sameAddr"' + (state.sameAddr ? ' checked' : '') + '>Billing address is the same as the lead traveler</label>';
    } else if (m === 'wallet') {
      var ap = state.wallet === 'apple';
      h += '<h3>Pay with a digital wallet</h3><p>Choose a wallet. You\u2019ll confirm the payment in the next step.</p>' +
        '<button type="button" class="tv-tile" data-act="wallet" data-w="apple" aria-pressed="' + ap + '"><i>' + ICO.phone + '</i><span><strong>Apple Pay</strong><small>Pay with Face ID or Touch ID</small></span></button>' +
        '<button type="button" class="tv-tile" data-act="wallet" data-w="paypal" aria-pressed="' + !ap + '"><i>' + ICO.pp + '</i><span><strong>PayPal</strong><small>Use your PayPal balance or linked accounts</small></span></button>' +
        '<div class="tv-total tv-total--flush"><span>Amount to pay</span><b>' + peso(total()) + '</b></div>';
    } else {
      var b = CFG.bank;
      h += '<h3>Pay by bank transfer</h3><p>Send the exact amount to the account below and include your reference code so we can match your payment.</p><div class="tv-bank">' +
        '<div class="tv-row"><span>Bank</span><b>' + esc(b.name) + '</b></div><div class="tv-row"><span>Account name</span><b>' + esc(b.accountName) + '</b></div><div class="tv-row"><span>Account number</span><b>' + esc(b.accountNumber) + '</b></div>' +
        '<div class="tv-row"><span>Reference code</span><b>' + esc(refCode()) + '</b></div><hr><div class="tv-row tv-row--base"><span>Amount</span><b class="tv-big">' + peso(total()) + '</b></div></div>' +
        '<div class="tv-drop"><label for="tv-proof">Upload proof of payment (optional)</label><input id="tv-proof" type="file" accept="image/*,.pdf" data-proof>' + (state.proof ? '<span>Selected: ' + esc(state.proof) + '</span>' : '') + '</div>' +
        '<p>Please complete your transfer by ' + esc(b.deadline) + '.</p>';
    }
    return h + termsHTML() + '</section></div>';
  }
  function refCode() { if (!state.ref) state.ref = 'TV-' + Date.now().toString(36).toUpperCase().slice(-6); return state.ref; }

  function updatePreview() {
    var c = state.card, d = c.number.replace(/\s/g, ''), set = function (id, v) { var e = $('#' + id); if (e) e.textContent = v; };
    set('tv-pv-num', (d + new Array(17).join(DOT)).slice(0, 16).replace(/(.{4})/g, '$1 ').trim());
    set('tv-pv-name', (c.name || 'YOUR NAME').toUpperCase()); set('tv-pv-exp', c.exp || 'MM/YY'); set('tv-pv-cvc', c.cvc || DOT + DOT + DOT);
  }
  function luhn(n) { var s = 0, alt = false; for (var i = n.length - 1; i >= 0; i--) { var d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } s += d; alt = !alt; } return s % 10 === 0; }
  function validateBilling() {
    var e = {}, c = state.card;
    if (state.method === 'card') {
      var n = c.number.replace(/\s/g, '');
      if (!c.name.trim()) e['c-name'] = 'Required';
      if (!n) e['c-number'] = 'Required'; else if (n.length < 13 || !luhn(n)) e['c-number'] = 'Check the card number';
      var m = c.exp.match(/^(\d{2})\/(\d{2})$/), now = new Date();
      if (!c.exp) e['c-exp'] = 'Required'; else if (!m || +m[1] < 1 || +m[1] > 12 || new Date(2000 + +m[2], +m[1], 1) <= now) e['c-exp'] = 'Check the expiry date';
      if (!c.cvc) e['c-cvc'] = 'Required'; else if (c.cvc.length < 3) e['c-cvc'] = '3 or 4 digits';
    }
    if (!state.terms) e.terms = 'Please accept the terms to continue';
    return e;
  }

  /* ---------- finish ---------- */
  function buildBooking() {
    var d = chosen(), p = state.pkg, method = state.method === 'wallet' ? (state.wallet === 'apple' ? 'apple-pay' : 'paypal') : state.method === 'bank' ? 'bank-transfer' : 'card';
    return {   // card numbers are deliberately NOT included: use a payment provider for real card payments
      reference: refCode(), package: { id: p.id, title: p.title, destination: p.destination, duration: p.duration },
      travelers: state.tr.slice(0, state.count).map(function (t) { return { givenNames: t.given.trim(), surname: t.sur.trim(), dateOfBirth: t.dob, nationality: t.nat, passportNumber: t.pass.trim(), passportExpiry: t.exp }; }),
      departure: { date: iso(d.t), returnDate: d.retISO }, payment: { method: method, total: total(), currency: 'PHP', billingSameAsLeadTraveler: state.sameAddr, proofFileName: state.proof },
      termsAccepted: state.terms
    };
  }
  function stepDone() {
    // The receipt is NOT part of this card. It pops out as its own card (see showReceipt) once the bill is paid, and the booking card closes (hides) at that moment.
    var bank = state.method === 'bank';
    return '<div class="tv-done"><div class="tv-ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<h3 class="tv-h tv-done-title">' + (bank ? 'Booking request received' : 'Reservation Confirmed') + '</h3>' +
      '<p class="tv-sub tv-sub--done">' + (bank ? 'Transfer ' + peso(total()) + ' using the reference code on your receipt. We\u2019ll confirm your booking once the payment is received.' : 'Your travel reservation has been processed and registered with Teyventure.') + '</p>' +
      '<div class="tv-vbtns"><button type="button" class="tv-vbtn tv-vbtn--teal" data-act="close">Return to Portal</button></div></div>';
  }

  /* ---------- receipt: its own card, shown after billing ---------- */
  function receiptHTML() {
    var d = chosen(), bank = state.method === 'bank', t = state.tr[0], who = (t.given + ' ' + t.sur).trim(), n = state.count;
    var PRINT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z"/></svg>';
    return '<div class="tv-rwrap"><div class="tv-rcard" role="dialog" aria-modal="true" aria-labelledby="tv-rtitle">' +
      '<div class="tv-ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<h3 class="tv-rtitle" id="tv-rtitle">' + (bank ? 'Awaiting Bank Transfer' : 'Payment Received') + '</h3>' +
      '<hr class="tv-done-hr"><div class="tv-receipt">' +
      '<div class="tv-rr tv-rr--ref"><span>Booking Reference:</span><b>' + esc(state.ref) + '</b></div><hr>' +
      '<div class="tv-rr tv-rr--bold"><span>Reserved Package:</span><b>' + esc(state.pkg.title) + '</b></div>' +
      '<div class="tv-rr"><span>Lead Traveler:</span><b>' + esc(who) + '</b></div>' +
      '<div class="tv-rr"><span>Travelers:</span><b>' + n + (n === 1 ? ' traveler' : ' travelers') + '</b></div>' +
      '<div class="tv-rr"><span>Departure:</span><b>' + fmt(d.t) + ' ' + d.year + '</b></div>' +
      '<div class="tv-rr"><span>Return:</span><b>' + fmt(d.r) + ' ' + d.retYear + '</b></div><hr>' +
      '<div class="tv-rr tv-rr--pay' + (bank ? ' is-pending' : '') + '"><span>Payment Status:</span><b>' + peso(total()) + (bank ? ' (Awaiting Bank Transfer)' : ' (Paid &amp; Confirmed)') + '</b></div></div>' +
      '<div class="tv-vbtns"><button type="button" class="tv-vbtn tv-vbtn--line" data-act="print">' + PRINT + 'Download / Print Voucher</button>' +
      '<button type="button" class="tv-vbtn tv-vbtn--teal" data-act="closereceipt">Return to Portal</button></div></div></div>';
  }
  function showReceipt() {
    if (!overlay || $('.tv-rwrap')) return;
    overlay.insertAdjacentHTML('beforeend', receiptHTML());
    overlay.classList.add('has-receipt');
    var b = $('.tv-rwrap [data-act="closereceipt"]'); if (b) b.focus({ preventScroll: true });
  }
  function footHTML() {
    var s = state.step;
    if (s === 'done') return '';
    var c = s === 2 ? chosen() : null, ok = s !== 2 || (c && c.st === 'ok'), label = 'Continue';
    if (s === 3) label = state.method === 'card' ? 'Pay ' + peso(total()) : state.method === 'wallet' ? 'Pay with ' + (state.wallet === 'apple' ? 'Apple Pay' : 'PayPal') : 'Submit transfer details';
    return '<button type="button" class="tv-ghost" data-act="back">' + (s === 1 ? 'Cancel' : 'Go Back') + '</button><button type="button" class="tv-gold" data-act="' + (s === 3 ? 'pay' : 'next') + '"' + (ok ? '' : ' disabled') + '>' + label + '</button>';
  }

  /* ---------- events ---------- */
  function onClick(e) {
    if (e.target === overlay) { close(); return; }
    if (e.target.classList && e.target.classList.contains('tv-rwrap')) { close(); return; }
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act');
    switch (act) {
      case 'close': close(); break;
      case 'print': window.print(); break;
      case 'closereceipt': close(); break;
      case 'save': var on = el.getAttribute('aria-pressed') !== 'true'; el.setAttribute('aria-pressed', on); el.classList.toggle('is-on', on); break;
      case 'inc': state.count = Math.min(state.pkg.max, state.count + 1); render(true); break;
      case 'dec': state.count = Math.max(state.pkg.min, state.count - 1); render(true); break;
      case 'prev': state.mi = Math.max(0, state.mi - 1); render(true); break;
      case 'next':
        if (el.disabled) break;
        state.banner = '';
        if (state.step === 1) { state.errors = validateTravelers(); if (Object.keys(state.errors).length) { state.banner = 'Please complete the highlighted fields.'; render(false); focusFirstError(); return; } }
        if (state.step === 2) { var c = chosen(); if (!c || c.st !== 'ok') return; if (passportIssue(c)) { render(true); return; } }
        state.step++; state.errors = {}; render(false); $('#tv-body').focus({ preventScroll: true }); break;
      case 'back': state.banner = ''; if (state.step === 1) close(); else { state.step--; state.errors = {}; render(false); } break;
      case 'pick': state.sel = el.getAttribute('data-key'); render(true); var dt = $('.tv-detail'); if (dt) dt.scrollIntoView({ block: 'nearest' }); break;
      case 'waitlist': var c2 = chosen(); state.wl[c2.key] = !state.wl[c2.key]; render(true); break;
      case 'method': state.method = el.getAttribute('data-m'); state.errors = {}; state.banner = ''; render(true); break;
      case 'wallet': state.wallet = el.getAttribute('data-w'); render(true); break;
      case 'pay':
        state.errors = validateBilling();
        if (Object.keys(state.errors).length) { state.banner = 'Please fix the highlighted fields.'; render(false); focusFirstError(); return; }
        state.banner = ''; var booking = buildBooking(); state.step = 'done'; render(false); CFG.onSubmit(booking); showReceipt(); break;
    }
  }
  function clearErr(el) {
    el.removeAttribute('aria-invalid'); var m = document.getElementById(el.id + '-e'); if (m) m.remove();
  }
  function onInput(e) {
    var el = e.target, v = el.value;
    if (el.hasAttribute('data-t')) { state.tr[+el.getAttribute('data-t')][el.getAttribute('data-k')] = v; delete state.errors[el.getAttribute('data-t') + '-' + el.getAttribute('data-k')]; clearErr(el); return; }
    if (el.hasAttribute('data-c')) {
      var k = el.getAttribute('data-c');
      if (k === 'number') { v = (v.replace(/\D/g, '').slice(0, 16).match(/.{1,4}/g) || []).join(' '); }
      if (k === 'exp') { v = v.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); }
      if (k === 'cvc') v = v.replace(/\D/g, '').slice(0, 4);
      el.value = v; state.card[k] = v; delete state.errors['c-' + k]; clearErr(el); updatePreview();
    }
  }
  function onChange(e) {
    var el = e.target;
    if (el.hasAttribute('data-t')) { state.tr[+el.getAttribute('data-t')][el.getAttribute('data-k')] = el.value; delete state.errors[el.getAttribute('data-t') + '-' + el.getAttribute('data-k')]; clearErr(el); }
    else if (el.hasAttribute('data-flag')) { state[el.getAttribute('data-flag')] = el.checked; if (el.getAttribute('data-flag') === 'terms') { delete state.errors.terms; el.removeAttribute('aria-invalid'); var m = el.closest('.tv-panel').querySelector('.tv-err:last-child'); if (m && !m.id) m.remove(); } }
    else if (el.hasAttribute('data-proof')) { state.proof = el.files && el.files[0] ? el.files[0].name : ''; render(true); }
  }
  function onFocus(e) {
    if (e.target.id !== 'tv-ccvc') return;
    var f = $('#tv-flip'); if (f) f.classList.toggle('is-flipped', e.type === 'focusin');
  }
  function onKey(e) {
    if (!overlay) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    var list = Array.prototype.filter.call((overlay.querySelector('.tv-rwrap') || overlay).querySelectorAll('button:not([disabled]),input:not([disabled]),select,[tabindex]:not([tabindex="-1"])'), function (n) { return n.offsetParent !== null; });
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === first || !(overlay.querySelector('.tv-rwrap') || overlay).contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- hook up the package buttons ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.trv-btn');
    if (!b) return;
    var pkg = readPackage(b); if (!pkg) return;
    e.preventDefault(); open(pkg, b);
  });
  function labelButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('.trv-btn'), function (b) {
      var card = b.closest('.trv-card'); b.setAttribute('aria-label', 'Book ' + txt(card && card.querySelector('.trv-title')));
      b.setAttribute('aria-haspopup', 'dialog');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', labelButtons); else labelButtons();
  window.TeyVentureBooking = { open: open, close: close, config: CFG };
})();