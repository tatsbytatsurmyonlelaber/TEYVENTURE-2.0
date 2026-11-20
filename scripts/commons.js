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