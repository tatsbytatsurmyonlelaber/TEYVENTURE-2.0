(function () {
    'use strict';

    var root = document.documentElement;
    var nav = document.querySelector('.navbar');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var phone = window.matchMedia('(max-width: 700px)');

    /* sticky navbar */
    var spacer = null;

    // The navbar is fixed, so a spacer keeps the hero from jumping up.
        // Measure the navbar in its normal (not scrolled) look.
    function measure() {
        var wasScrolled = nav.classList.contains('is-scrolled');
        nav.classList.add('is-measuring');
        nav.classList.remove('is-scrolled');
        spacer.style.height = nav.offsetHeight + 'px';
        if (wasScrolled) nav.classList.add('is-scrolled');
        nav.getBoundingClientRect();           // flush styles before animations come back
        nav.classList.remove('is-measuring');
    }

    if (nav && nav.parentNode) {
        spacer = document.createElement('div');
        spacer.className = 'nav-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        nav.parentNode.insertBefore(spacer, nav);
        root.classList.add('nav-js');
        measure();

        var resizeTimer = null;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(measure, 120);
        });
        window.addEventListener('load', measure);   // the logo image may change the height
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    }

    /* scroll spy */
    var spyLinks = [];    
    var origActive = [];   
    var spyOn = null;

    (function setupSpy() {
        if (!nav) return;
        var file = location.pathname.split('/').pop();
        var links = Array.prototype.slice.call(nav.querySelectorAll('.nav-titles > a, .nav-dropdown > a'));
        origActive = links.filter(function (a) { return a.classList.contains('active'); });

        links.forEach(function (a) {
            var href = a.getAttribute('href') || '';
            var hash = '';
            if (href.charAt(0) === '#') hash = href.slice(1);
            else if (file && href.indexOf(file + '#') === 0) hash = href.slice(file.length + 1);
            else return;
            var el = (hash === '' || hash === 'top')
                ? document.querySelector('.landingpage')
                : document.getElementById(hash);
            if (el) spyLinks.push({ a: a, el: el });
        });

        spyLinks.sort(function (x, y) {
            return x.el.compareDocumentPosition(y.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
    })();

    function updateSpy(y) {
        if (!spyLinks.length) return;
        var line = window.innerHeight * 0.35;
        var chosen = null;
        for (var i = 0; i < spyLinks.length; i++) {
            if (spyLinks[i].el.getBoundingClientRect().top <= line) chosen = spyLinks[i];
        }
        // at the very bottom of the page the last section wins
        if (y + window.innerHeight >= root.scrollHeight - 4) chosen = spyLinks[spyLinks.length - 1];

        var next = chosen ? chosen.a : null;
        if (next === spyOn) return;
        spyOn = next;

        var all = nav.querySelectorAll('.nav-titles > a, .nav-dropdown > a');
        Array.prototype.forEach.call(all, function (a) {
            a.classList.remove('active');
            if (a.getAttribute('aria-current') === 'location') a.removeAttribute('aria-current');
        });
        if (next) {
            next.classList.add('active');
            next.setAttribute('aria-current', 'location');
        } else {
            origActive.forEach(function (a) { a.classList.add('active'); });
        }
    }

    /* back to top */
    var topBtn = document.createElement('button');
    topBtn.type = 'button';
    topBtn.className = 'to-top';
    topBtn.setAttribute('aria-label', 'Back to top');
    topBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 15l7-7 7 7"/></svg>';
    document.body.appendChild(topBtn);

    topBtn.addEventListener('click', function (e) {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        if (e.detail === 0) {
            var logo = document.querySelector('.logo');
            if (logo) logo.focus({ preventScroll: true });
        }
    });

    /* one scroll handler for all of the above */
    var lastY = window.pageYOffset;
    var ticking = false;

    function onScroll() {
        ticking = false;
        var y = window.pageYOffset;

        if (nav) {
            nav.classList.toggle('is-scrolled', y > 30);

            // phones: hide while scrolling down, show on the way back up
            var hide = false;
            if (phone.matches) {
                if (y <= 220 || y < lastY - 6) hide = false;
                else if (y > lastY + 6 && !nav.contains(document.activeElement)) hide = true;
                else hide = nav.classList.contains('is-hidden');
            }
            nav.classList.toggle('is-hidden', hide);
        }

        topBtn.classList.toggle('is-shown', y > Math.max(500, window.innerHeight * 0.7));
        updateSpy(y);
        lastY = y;
    }

    window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
    }, { passive: true });
    window.addEventListener('resize', onScroll);
    if (nav) {
        nav.addEventListener('focusin', function () { nav.classList.remove('is-hidden'); });
    }
    onScroll();

    /* scroll reveal */
    var REVEAL = [
        '.about-heading', '.about-content',
        '.destinations-content > h1', '.destinations-content > p', '.destination-slider',
        '.director-card', '.director-content',
        '.faq-title', '.faq-item',
        '.dab-card', '.dest-stops-head', '.dest-stop', '.pkg-top', '.trv-cell', '.pkg-itin',
        '.contact-head', '.ct-card'
    ].join(',');

    if (!reduceMotion && 'IntersectionObserver' in window) {
        var targets = Array.prototype.filter.call(document.querySelectorAll(REVEAL), function (el) {
            // only hide things that are still below the fold
            return el.getBoundingClientRect().top > window.innerHeight * 0.95;
        });

        var io = new IntersectionObserver(function (entries) {
            var seen = entries.filter(function (e) { return e.isIntersecting; });
            seen.sort(function (a, b) {
                var ra = a.boundingClientRect, rb = b.boundingClientRect;
                return (ra.top - rb.top) || (ra.left - rb.left);
            });
            seen.forEach(function (entry, i) {
                var el = entry.target;
                io.unobserve(el);
                // cards that enter together come in one after another
                el.style.setProperty('--rv-delay', Math.min(i, 4) * 90 + 'ms');
                el.classList.add('is-visible');

                var done = false;
                function finish() {
                    if (done) return;
                    done = true;
                    // hand the element back to its normal CSS (hover effects etc.)
                    el.classList.remove('reveal', 'reveal-left', 'reveal-right', 'is-visible');
                    el.style.removeProperty('--rv-delay');
                }
                el.addEventListener('transitionend', function (ev) {
                    if (ev.target === el && ev.propertyName === 'opacity') finish();
                });
                setTimeout(finish, 1600);
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

        targets.forEach(function (el) {
            el.classList.add('reveal');
            // the director photo slides in from the left, its text from the right
            if (el.matches('.director-card')) el.classList.add('reveal-left');
            else if (el.matches('.director-content')) el.classList.add('reveal-right');
            io.observe(el);
        });
    }

    /* itinerary: fade the stops in when a day is opened  */
    if (!reduceMotion && 'MutationObserver' in window) {
        Array.prototype.forEach.call(document.querySelectorAll('.itin-body'), function (body) {
            new MutationObserver(function () {
                var items = body.querySelectorAll('.itin-sum, .itin-count, .itin-per, .itin-stop');
                Array.prototype.forEach.call(items, function (el, i) {
                    el.classList.remove('rv-item');
                    el.style.setProperty('--rv-delay', Math.min(i, 9) * 55 + 'ms');
                });
                void body.offsetWidth;                      // restart the animation
                Array.prototype.forEach.call(items, function (el) { el.classList.add('rv-item'); });
            }).observe(body, { childList: true });
        });
    }
})();