/* 
   TeyVenture home search
   Duration + budget + travel date -> matching packages.
   - empty fields are ignored; fill in any one, two or all three
   - results appear under the search bar and link to the destination page
   Keep DATA in sync with the package cards on the destination pages.
    */
(function () {
    'use strict';

    var form = document.getElementById('search-form');
    if (!form) return;

    var PESO = '\u20B1';
    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    /*  settings (same values as booking.js) */
    var DEFAULTS = {
        minLeadDays: 14,       // earliest bookable departure, in days from today
        monthsAhead: 10,       // how far the booking calendar goes
        departureWeekday: 0,   // 0 = Sunday (placeholder departures)
        departures: null,      // real availability: { 'LIYU-GP01': { '2027-05-16': 8 } }
        dateWindowDays: 28     // a picked date matches departures up to 4 weeks after it
    };
    var CFG = Object.assign({}, DEFAULTS, window.TEYVENTURE_BOOKING || {});

    /*package data */
    // d = days, n = nights. s = solo package, g = group packages [code, name, people, price]
    var DATA = [
        { id: 'mondstadt', name: 'Mondstadt', page: 'mondstadt.html', d: 3, n: 2,
          s: ['MOND-01', "Wanderer's Breeze", 12500],
          g: [['MOND-GP01', 'Whispering Winds', '2 persons', 24000],
              ['MOND-GP02', 'Windswept Expedition', '3-5 persons', 34500],
              ['MOND-GP03', 'Grand Voyage of Freedom', '6-10 persons', 66000]] },
        { id: 'liyue', name: 'Liyue', page: 'liyue.html', d: 4, n: 3,
          s: ['LIYU-02', 'Jade Wanderer', 15000],
          g: [['LIYU-GP01', 'Twin Peaks Journey', '2 persons', 29000],
              ['LIYU-GP02', 'Golden Lantern Expedition', '3-5 persons', 42000],
              ['LIYU-GP03', 'Grand Voyage of Prosperity', '6-10 persons', 81000]] },
        { id: 'inazuma', name: 'Inazuma', page: 'inazuma.html', d: 4, n: 3,
          s: ['INAZ-03', 'Sakura Wanderer', 18000],
          g: [['INAZ-GP01', 'Moonlit Sakura', '2 persons', 35000],
              ['INAZ-GP02', 'Thunderbound Expedition', '3-5 persons', 51000],
              ['INAZ-GP03', 'Grand Voyage of Eternity', '6-10 persons', 99000]] },
        { id: 'sumeru', name: 'Sumeru', page: 'sumeru.html', d: 3, n: 3,
          s: ['SUME-04', 'Verdant Wanderer', 14000],
          g: [['SUME-GP01', 'Whispers of the Canopy', '2 persons', 27000],
              ['SUME-GP02', 'Lost Oasis Expedition', '3-5 persons', 39000],
              ['SUME-GP03', 'Grand Voyage of Wisdom', '6-10 persons', 75000]] },
        { id: 'natlan', name: 'Natlan', page: 'natlan.html', d: 4, n: 3,
          s: ['NATL-06', 'Ember Wanderer', 16500],
          g: [['NATL-GP01', 'Blazing Horizon', '2 persons', 32000],
              ['NATL-GP02', 'Flame Heart Expedition', '3-5 persons', 46500],
              ['NATL-GP03', 'Grand Voyage of Valor', '6-10 persons', 90000]] },
        { id: 'fontaine', name: 'Fontaine', page: 'fontaine.html', d: 5, n: 4,
          s: ['FONT-05', 'Azure Wanderer', 20000],
          g: [['FONT-GP01', 'Serenade of the Tides', '2 persons', 39000],
              ['FONT-GP02', 'Riviera Expedition', '3-5 persons', 57000],
              ['FONT-GP03', 'Grand Voyage of Splendor', '6-10 persons', 111000]] },
        { id: 'snezhnaya', name: 'Snezhnaya', page: 'snezhnaya.html', d: 5, n: 4,
          s: ['SNEZ-07', 'Frostbound Wanderer', 22000],
          g: [['SNEZ-GP01', "Winter's Embrace", '2 persons', 43000],
              ['SNEZ-GP02', 'Frostfire Expedition', '3-5 persons', 63000],
              ['SNEZ-GP03', 'Grand Voyage of the North', '6-10 persons', 123000]] }
    ];

    // package photos (same files the destination pages use; names are not all alike)
    var IMG = {
        'MOND-01': 'mondstadt-solo.JPG', 'MOND-GP01': 'mondstadt-gp01.JPG', 'MOND-GP02': 'mondstadt-gp02.JPG', 'MOND-GP03': 'mondstadt-gp03.JPG',
        'LIYU-02': 'liyue-solo.jpg', 'LIYU-GP01': 'liyue-gp01.jpg', 'LIYU-GP02': 'liyue-gp02.jpg', 'LIYU-GP03': 'liyue-gp03.jpg',
        'INAZ-03': 'inazuma-solo.jpg', 'INAZ-GP01': 'inazuma-gp01.jpg', 'INAZ-GP02': 'inazuma-gp02.jpg', 'INAZ-GP03': 'inazuma-gp03.jpg',
        'SUME-04': 'sumeru-solo.jpg', 'SUME-GP01': 'sumeru-gp01.jpg', 'SUME-GP02': 'sumeru-gp02.jpg', 'SUME-GP03': 'sumeru-gp03.jpg',
        'NATL-06': 'natlan-solo.jpg', 'NATL-GP01': 'natlan-gp01.jpg', 'NATL-GP02': 'natlan-gp02.jpg', 'NATL-GP03': 'natlan-gp03.jpg',
        'FONT-05': 'fontaine-solo.jpg', 'FONT-GP01': 'fontain-gp01.jpg', 'FONT-GP02': 'fontaine-gp02.jpg', 'FONT-GP03': 'fontaine-gp03.jpg',
        'SNEZ-07': 'snezhnaya-solo.jpg', 'SNEZ-GP01': 'snezhnaya-gp01.jpg', 'SNEZ-GP02': 'snezhnaya-gp02.jpg', 'SNEZ-GP03': 'snezhnaya-gp03.jpg'
    };

    /* flat list of packages */
    var PACKAGES = [];
    DATA.forEach(function (dest) {
        PACKAGES.push({ dest: dest, code: dest.s[0], title: dest.s[1], who: 'Solo traveler', price: dest.s[2], unit: 'per person', solo: true });
        dest.g.forEach(function (g) {
            PACKAGES.push({ dest: dest, code: g[0], title: g[1], who: g[2], price: g[3], unit: 'per group', solo: false });
        });
    });

    /*  helpers  */
    var els = {
        duration: document.getElementById('duration'),
        price: document.getElementById('price'),
        date: document.getElementById('date'),
        submit: form.querySelector('.search-btn')
    };

    /*  pop-up (built the first time it is needed)  */
    var box = null, dialog, listEl, summaryEl, emptyEl, closeBtn, opener = null;

    function build() {
        box = document.createElement('div');
        box.className = 'sr-overlay';
        box.innerHTML =
            '<div class="sr-dialog" role="dialog" aria-modal="true" aria-labelledby="sr-heading">' +
                '<button type="button" class="sr-close" aria-label="Close results">&times;</button>' +
                '<h2 class="sr-title-main" id="sr-heading">SEARCH RESULTS</h2>' +
                '<p class="sr-summary" role="status" aria-live="polite" tabindex="-1"></p>' +
                '<p class="sr-hint">Click a package to view more information.</p>' +
                '<ul class="sr-list"></ul>' +
                '<p class="sr-empty" hidden>Nothing matches yet. Try a wider duration or budget, or ' +
                    '<a href="contact.html">ask us for a custom itinerary</a>.</p>' +
                '<div class="sr-actions">' +
                    '<button type="button" class="sr-edit">Change search</button>' +
                    '<button type="button" class="sr-clear">Clear search</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(box);

        dialog    = box.querySelector('.sr-dialog');
        listEl    = box.querySelector('.sr-list');
        summaryEl = box.querySelector('.sr-summary');
        emptyEl   = box.querySelector('.sr-empty');
        closeBtn  = box.querySelector('.sr-close');

        closeBtn.addEventListener('click', closePopup);
        box.querySelector('.sr-edit').addEventListener('click', closePopup);
        box.querySelector('.sr-clear').addEventListener('click', function () { closePopup(); reset(); });
        box.addEventListener('click', function (e) { if (e.target === box) closePopup(); });
        document.addEventListener('keydown', onKey);
    }

    function openPopup() {
        opener = document.activeElement;
        box.classList.add('open');
        document.documentElement.classList.add('sr-lock');
        dialog.scrollTop = 0;
        closeBtn.focus({ preventScroll: true });
    }

    function closePopup() {
        if (!box || !box.classList.contains('open')) return;
        box.classList.remove('open');
        document.documentElement.classList.remove('sr-lock');
        if (opener && opener.focus) opener.focus();
    }

    function onKey(e) {
        if (!box || !box.classList.contains('open')) return;
        if (e.key === 'Escape') { closePopup(); return; }
        if (e.key !== 'Tab') return;
        // keep keyboard focus inside the dialog
        var items = Array.prototype.filter.call(
            dialog.querySelectorAll('button, a[href]'),
            function (el) { return el.offsetParent !== null; }
        );
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function p2(n) { return String(n).padStart(2, '0'); }
    function peso(n) { return PESO + Number(n).toLocaleString('en-PH'); }
    function iso(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
    function fromISO(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
    function nice(d) { return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h; }

    /* booking.js stores the id without the "SOLO" prefix, e.g. LIYU-02 / LIYU-GP01 */
    function seats(code, d) {
        var key = iso(d);
        if (CFG.departures) {
            var set = CFG.departures[code];
            return set && set[key] != null ? set[key] : undefined;
        }
        if (d.getDay() !== CFG.departureWeekday) return undefined;
        return (d.getDate() * 7 + d.getMonth() * 5 + d.getFullYear() + hash(code)) % 11;
    }

    /* the calendar in booking.js starts on the 1st of next month and runs monthsAhead months */
    function bookingWindow() {
        var now = new Date();
        var calStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        var lead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + CFG.minLeadDays);
        var start = lead > calStart ? lead : calStart;
        var end = new Date(now.getFullYear(), now.getMonth() + CFG.monthsAhead + 1, 0);
        return { start: start, end: end };
    }

    /*  parsing the three fields  */
    // "5", "3-7", "3 to 7 days", "3 - 7"  ->  { min, max }
    function parseDuration(text) {
        var nums = (text.match(/\d+/g) || []).map(Number);
        if (!nums.length) return { error: 'Enter a number of days, like 4 or 3 - 7.' };
        var a = nums[0], b = nums.length > 1 ? nums[1] : nums[0];
        if (a > b) { var t = a; a = b; b = t; }
        if (a < 1 || b > 30) return { error: 'Trips here run from 1 to 30 days.' };
        return { min: a, max: b };
    }

    // "15000", "\u20B115,000", "10k - 30k", "PHP 20,000 to 40,000"
    // one value = your maximum budget, two values = a range
    function parsePrice(text) {
        var clean = text.toLowerCase().replace(/,/g, '');
        var found = clean.match(/\d+(?:\.\d+)?\s*k?/g) || [];
        var nums = found.map(function (s) {
            var n = parseFloat(s);
            return /k\s*$/.test(s) ? n * 1000 : n;
        });
        if (!nums.length) return { error: 'Enter an amount in pesos, like 20000 or 15,000 - 40,000.' };
        if (nums.length === 1) return { min: 0, max: nums[0] };
        var a = nums[0], b = nums[1];
        if (a > b) { var t = a; a = b; b = t; }
        return { min: a, max: b };
    }

    function parseDate(value) {
        var d = fromISO(value);
        if (isNaN(d.getTime())) return { error: 'That date is not valid.' };
        var w = bookingWindow();
        if (d > w.end) return { error: 'We take bookings up to ' + nice(w.end) + '.' };
        // a date before the window is fine: we just start looking at the first bookable day
        return { date: d < w.start ? w.start : d, clamped: d < w.start, window: w };
    }

    /* first departure with seats on or after `from`, inside the date window */
    function nextDeparture(code, from, windowEnd) {
        var last = new Date(from.getFullYear(), from.getMonth(), from.getDate() + CFG.dateWindowDays);
        if (last > windowEnd) last = windowEnd;
        for (var d = new Date(from); d <= last; d.setDate(d.getDate() + 1)) {
            var left = seats(code, d);
            if (left > 0) return { date: new Date(d), left: left };
        }
        return null;
    }

    /*  errors  */
    function setError(input, msg) {
        var id = input.id + '-err';
        var box = document.getElementById(id);
        if (!box) {
            box = document.createElement('p');
            box.id = id;
            box.className = 'sf-error';
            box.setAttribute('role', 'alert');
            input.closest('.search-field').appendChild(box);
        }
        box.textContent = msg || '';
        box.hidden = !msg;
        input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        if (msg) input.setAttribute('aria-describedby', id); else input.removeAttribute('aria-describedby');
    }

    /*  search  */
    function run() {
        var dur = null, prc = null, dat = null, bad = null;
        [['duration', parseDuration], ['price', parsePrice]].forEach(function (f) {
            var input = els[f[0]], v = input.value.trim(), r = null;
            if (v) { r = f[1](v); if (r.error) { setError(input, r.error); bad = bad || input; r = null; } else setError(input, ''); }
            else setError(input, '');
            if (f[0] === 'duration') dur = r; else prc = r;
        });
        if (els.date.value) {
            var dr = parseDate(els.date.value);
            if (dr.error) { setError(els.date, dr.error); bad = bad || els.date; } else { setError(els.date, ''); dat = dr; }
        } else setError(els.date, '');
        if (bad) { bad.focus(); return; }

        var results = [];
        PACKAGES.forEach(function (p) {
            if (dur && (p.dest.d < dur.min || p.dest.d > dur.max)) return;
            if (prc && (p.price < prc.min || p.price > prc.max)) return;
            var dep = null;
            if (dat) {
                dep = nextDeparture(p.code, dat.date, dat.window.end);
                if (!dep) return;
            }
            results.push({ p: p, dep: dep });
        });

        results.sort(function (a, b) {
            if (a.dep && b.dep) return a.dep.date - b.dep.date || a.p.price - b.p.price;
            return a.p.price - b.p.price;
        });

        show(results, dur, prc, dat);
    }

    function describe(dur, prc, dat) {
        var bits = [];
        if (dur) bits.push(dur.min === dur.max ? dur.min + ' days' : dur.min + '\u2013' + dur.max + ' days');
        if (prc) bits.push(prc.min === 0 ? 'up to ' + peso(prc.max) : peso(prc.min) + '\u2013' + peso(prc.max));
        if (dat) bits.push((dat.clamped ? 'from ' : 'on or after ') + nice(dat.date));
        return bits.join(' \u00B7 ');
    }

    function show(results, dur, prc, dat) {
        if (!box) build();
        var n = results.length;
        var what = describe(dur, prc, dat);
        summaryEl.textContent = (n ? n + (n === 1 ? ' package' : ' packages') : 'No packages') + (what ? ' for ' + what : '');
        if (dat && dat.clamped) {
            summaryEl.textContent += '. Earliest bookable departure is ' + nice(dat.date) + '.';
        }
        listEl.innerHTML = results.map(function (r) {
            var p = r.p;
            return '<li class="sr-card">' +
                '<a href="' + p.dest.page + '#package" class="sr-link" aria-label="' + esc(p.title + ', ' + p.dest.name + ', ' + p.dest.d + ' days ' + p.dest.n + ' nights, ' + p.who) + '">' +
                '<span class="sr-photo"><img src="images/' + esc(IMG[p.code] || '') + '" alt="" loading="lazy" onerror="this.remove()">' +
                    '<span class="sr-tag">' + p.dest.d + ' days / ' + p.dest.n + ' nights</span></span>' +
                '<span class="sr-body">' +
                    '<span class="sr-dest">' + esc(p.dest.name) + '</span>' +
                    '<span class="sr-title">' + esc(p.title) + '</span>' +
                    '<span class="sr-meta">' + esc(p.who) + '</span>' +
                    '<span class="sr-price">' + peso(p.price) + ' <small>' + p.unit + '</small></span>' +
                    (r.dep ? '<span class="sr-dep">Departs ' + esc(nice(r.dep.date)) + ' \u00B7 ' + r.dep.left + (r.dep.left === 1 ? ' place' : ' places') + ' left</span>' : '') +
                '</span>' +
                '</a></li>';
        }).join('');
        emptyEl.hidden = n > 0;
        openPopup();
    }

    function reset() {
        form.reset();
        ['duration', 'price', 'date'].forEach(function (k) { setError(els[k], ''); });
        els.duration.focus();
    }

    /*  wire up  */
    form.addEventListener('submit', function (e) { e.preventDefault(); run(); });

    // date picker: only offer bookable days
    (function () {
        var w = bookingWindow();
        els.date.min = iso(w.start);
        els.date.max = iso(w.end);
    })();

    // clear an error as soon as the person fixes the field
    ['duration', 'price', 'date'].forEach(function (k) {
        els[k].addEventListener('input', function () { setError(els[k], ''); });
    });
})();