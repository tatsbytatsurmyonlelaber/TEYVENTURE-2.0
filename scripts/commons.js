// Destination carousel (endless loop)
(function () {
    var slider = document.querySelector('.destination-slider');
    if (!slider) return;

    var row  = slider.querySelector('.destination-row');
    var prev = slider.querySelector('.slider-btn.prev');
    var next = slider.querySelector('.slider-btn.next');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var originals = Array.prototype.slice.call(row.querySelectorAll('.destination-card'));
    var N = originals.length;
    if (N < 2) return;

    // Put a full set of copies before and after the real cards,
    // so there is always a card to slide into in either direction.
    function makeCopies() {
        var frag = document.createDocumentFragment();
        originals.forEach(function (card) {
            var copy = card.cloneNode(true);
            copy.setAttribute('aria-hidden', 'true');
            copy.tabIndex = -1;
            frag.appendChild(copy);
        });
        return frag;
    }
    row.insertBefore(makeCopies(), row.firstChild);
    row.appendChild(makeCopies());

    var cards = row.querySelectorAll('.destination-card');
    var index = N; // position of the first real card

    // Distance from one card's left edge to the next (card width + gap)
    function step() {
        return cards[1].offsetLeft - cards[0].offsetLeft;
    }

    function place(i, instant) {
        row.scrollTo({
            left: i * step(),
            behavior: (instant || reduceMotion) ? 'auto' : 'smooth'
        });
    }

    // If we are sitting on a copy, silently jump to the identical real card.
    // The two look exactly the same, so the jump cannot be seen.
    function normalize() {
        if (index >= 2 * N) {
            index -= N;
            row.scrollLeft -= N * step();
        } else if (index < N) {
            index += N;
            row.scrollLeft += N * step();
        }
    }

    function move(dir) {
        normalize();
        index += dir;
        place(index);
    }

    prev.addEventListener('click', function () { move(-1); });
    next.addEventListener('click', function () { move(1); });

    // Swipe support for touch screens
    var startX = null;
    row.addEventListener('touchstart', function (e) {
        startX = e.touches[0].clientX;
    }, { passive: true });
    row.addEventListener('touchend', function (e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        startX = null;
        if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1);
    }, { passive: true });

    // Keyboard: when a card gets focus, the browser scrolls it into view,
    // so just remember where we ended up.
    row.addEventListener('focusin', function () {
        setTimeout(function () {
            index = Math.round(row.scrollLeft / step());
        }, 0);
    });

    // Re-align when the window size changes (card width changes)
    window.addEventListener('resize', function () {
        normalize();
        place(index, true);
    });

    place(index, true);
})();

// Featured stop galleries: photo count badge + lightbox
(function () {
    var galleries = document.querySelectorAll('.stop-gallery');
    if (!galleries.length) return;

    var ICON_PHOTOS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>';
    var ICON_PREV  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    var ICON_NEXT  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
    var ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

    function photosOf(gallery) {
        return Array.prototype.slice.call(gallery.querySelectorAll('img.stop-photo'));
    }

    // Count badge on each stop
    galleries.forEach(function (g) {
        var n = photosOf(g).length;
        var label = n + (n === 1 ? ' photo' : ' photos');
        var badge = document.createElement('span');
        badge.className = 'stop-count';
        badge.setAttribute('aria-hidden', 'true');
        badge.innerHTML = ICON_PHOTOS + label;
        g.appendChild(badge);
        g.setAttribute('aria-label', 'Open ' + (g.dataset.title || 'stop') + ' gallery, ' + label);
    });

    // Lightbox (built the first time it is needed)
    var box, imgEl, captionEl, thumbsEl, closeBtn, prevBtn, nextBtn;
    var photos = [], current = 0, title = '', opener = null, startX = null;

    function build() {
        box = document.createElement('div');
        box.className = 'lightbox';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-label', 'Photo gallery');
        box.innerHTML =
            '<button type="button" class="lightbox-btn lightbox-close" aria-label="Close gallery">' + ICON_CLOSE + '</button>' +
            '<button type="button" class="lightbox-btn lightbox-prev" aria-label="Previous photo">' + ICON_PREV + '</button>' +
            '<button type="button" class="lightbox-btn lightbox-next" aria-label="Next photo">' + ICON_NEXT + '</button>' +
            '<div class="lightbox-stage"><img class="lightbox-img" alt=""></div>' +
            '<p class="lightbox-caption"></p>' +
            '<div class="lightbox-thumbs"></div>';
        document.body.appendChild(box);

        imgEl     = box.querySelector('.lightbox-img');
        captionEl = box.querySelector('.lightbox-caption');
        thumbsEl  = box.querySelector('.lightbox-thumbs');
        closeBtn  = box.querySelector('.lightbox-close');
        prevBtn   = box.querySelector('.lightbox-prev');
        nextBtn   = box.querySelector('.lightbox-next');

        closeBtn.addEventListener('click', close);
        prevBtn.addEventListener('click', function () { show(current - 1); });
        nextBtn.addEventListener('click', function () { show(current + 1); });

        // click on the dark backdrop closes
        box.addEventListener('click', function (e) {
            if (e.target === box || e.target.classList.contains('lightbox-stage')) close();
        });

        // swipe
        box.addEventListener('touchstart', function (e) {
            startX = e.touches[0].clientX;
        }, { passive: true });
        box.addEventListener('touchend', function (e) {
            if (startX === null) return;
            var dx = e.changedTouches[0].clientX - startX;
            startX = null;
            if (Math.abs(dx) > 50 && photos.length > 1) show(current + (dx < 0 ? 1 : -1));
        }, { passive: true });

        document.addEventListener('keydown', onKey);
    }

    function show(i) {
        current = (i + photos.length) % photos.length;
        var p = photos[current];
        imgEl.src = p.currentSrc || p.src;
        imgEl.alt = p.alt || title;
        captionEl.innerHTML = '';
        captionEl.appendChild(document.createTextNode(title));
        if (photos.length > 1) {
            var count = document.createElement('span');
            count.textContent = (current + 1) + ' / ' + photos.length;
            captionEl.appendChild(count);
        }
        var thumbs = thumbsEl.children;
        for (var k = 0; k < thumbs.length; k++) {
            thumbs[k].classList.toggle('active', k === current);
            if (k === current) thumbs[k].setAttribute('aria-current', 'true');
            else thumbs[k].removeAttribute('aria-current');
        }
    }

    function open(gallery, startIndex) {
        if (!box) build();
        opener = gallery;
        photos = photosOf(gallery);
        title = gallery.dataset.title || '';

        thumbsEl.innerHTML = '';
        photos.forEach(function (p, i) {
            var t = document.createElement('button');
            t.type = 'button';
            t.className = 'lightbox-thumb';
            t.setAttribute('aria-label', 'Show photo ' + (i + 1));
            var im = document.createElement('img');
            im.src = p.currentSrc || p.src;
            im.alt = '';
            t.appendChild(im);
            t.addEventListener('click', function () { show(i); });
            thumbsEl.appendChild(t);
        });

        box.classList.toggle('lightbox-single', photos.length < 2);
        show(startIndex || 0);
        box.classList.add('open');
        document.body.style.overflow = 'hidden';
        closeBtn.focus();
    }

    function close() {
        if (!box || !box.classList.contains('open')) return;
        box.classList.remove('open');
        document.body.style.overflow = '';
        if (opener) opener.focus();
    }

    function onKey(e) {
        if (!box || !box.classList.contains('open')) return;
        if (e.key === 'Escape') { close(); }
        else if (e.key === 'ArrowLeft'  && photos.length > 1) { show(current - 1); }
        else if (e.key === 'ArrowRight' && photos.length > 1) { show(current + 1); }
        else if (e.key === 'Tab') {
            // keep keyboard focus inside the dialog
            var items = Array.prototype.filter.call(
                box.querySelectorAll('button'),
                function (b) { return b.offsetParent !== null; }
            );
            if (!items.length) return;
            var first = items[0], last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    }

    galleries.forEach(function (g) {
        g.addEventListener('click', function () { open(g, 0); });
    });
})();