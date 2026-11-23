// Location gallery: click a featured stop picture to browse its pictures

// 1. Build the popup once and add it to the page
var modal = document.createElement('div');
modal.className = 'gallery-modal';
modal.innerHTML =
    '<button class="gallery-close" aria-label="Close gallery">&times;</button>' +
    '<h3 class="gallery-title"></h3>' +
    '<div class="gallery-stage">' +
        '<button class="gallery-arrow gallery-prev" aria-label="Previous picture">&#10094;</button>' +
        '<img class="gallery-main" src="" alt="">' +
        '<button class="gallery-arrow gallery-next" aria-label="Next picture">&#10095;</button>' +
    '</div>' +
    '<p class="gallery-count"></p>' +
    '<div class="gallery-thumbs"></div>';
document.body.appendChild(modal);

var titleEl = modal.querySelector('.gallery-title');
var mainEl = modal.querySelector('.gallery-main');
var countEl = modal.querySelector('.gallery-count');
var thumbsEl = modal.querySelector('.gallery-thumbs');

var pictures = [];   // the pictures of the stop that is open
var current = 0;     // which picture is showing

// 2. Show one picture
function showPicture(index) {
    current = (index + pictures.length) % pictures.length;   // loops around

    // replay the fade animation
    mainEl.style.animation = 'none';
    mainEl.offsetHeight;
    mainEl.style.animation = '';

    mainEl.src = pictures[current];
    countEl.textContent = (current + 1) + ' / ' + pictures.length;

    var thumbs = thumbsEl.querySelectorAll('.gallery-thumb');
    for (var i = 0; i < thumbs.length; i++) {
        thumbs[i].classList.toggle('active', i === current);
    }
}

// 3. Open the gallery for one stop
function openGallery(stop) {
    var gallery = stop.querySelector('.stop-gallery');
    var name = stop.querySelector('.dest-stop-name').textContent.trim();

    // Main picture first, then the side pictures, then any extras in data-more
    var found = [];
    var imgs = gallery.querySelectorAll('img');
    var main = gallery.querySelector('.dest-stop-img');
    found.push(main.getAttribute('src'));
    for (var i = 0; i < imgs.length; i++) {
        found.push(imgs[i].getAttribute('src'));
    }
    if (gallery.dataset.more) {
        var extras = gallery.dataset.more.split(',');
        for (var j = 0; j < extras.length; j++) {
            found.push(extras[j].trim());
        }
    }

    // Remove repeats (right now the side pictures are copies of the main one)
    pictures = [];
    for (var k = 0; k < found.length; k++) {
        if (pictures.indexOf(found[k]) === -1) {
            pictures.push(found[k]);
        }
    }

    // Build the thumbnails
    thumbsEl.innerHTML = '';
    for (var t = 0; t < pictures.length; t++) {
        var thumb = document.createElement('img');
        thumb.className = 'gallery-thumb';
        thumb.src = pictures[t];
        thumb.alt = name + ' picture ' + (t + 1);
        thumb.dataset.index = t;
        thumbsEl.appendChild(thumb);
    }

    titleEl.textContent = name;
    modal.classList.toggle('single', pictures.length === 1);
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';   // stop the page scrolling behind
    showPicture(0);
}

function closeGallery() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

// 4. Click a stop picture to open its gallery
var galleries = document.querySelectorAll('.stop-gallery');
for (var g = 0; g < galleries.length; g++) {
    galleries[g].setAttribute('tabindex', '0');
    galleries[g].setAttribute('role', 'button');
    galleries[g].addEventListener('click', function () {
        openGallery(this.closest('.dest-stop'));
    });
    galleries[g].addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            openGallery(this.closest('.dest-stop'));
        }
    });
}

// 5. Buttons, thumbnails, dark background
modal.querySelector('.gallery-prev').addEventListener('click', function () {
    showPicture(current - 1);
});
modal.querySelector('.gallery-next').addEventListener('click', function () {
    showPicture(current + 1);
});
modal.querySelector('.gallery-close').addEventListener('click', closeGallery);

thumbsEl.addEventListener('click', function (e) {
    if (e.target.classList.contains('gallery-thumb')) {
        showPicture(Number(e.target.dataset.index));
    }
});

modal.addEventListener('click', function (e) {
    if (e.target === modal) {
        closeGallery();   // clicked the dark background
    }
});

// 6. Keyboard: arrows to browse, Esc to close
document.addEventListener('keydown', function (e) {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') closeGallery();
    if (e.key === 'ArrowLeft') showPicture(current - 1);
    if (e.key === 'ArrowRight') showPicture(current + 1);
});