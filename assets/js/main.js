(function () {
  document.documentElement.classList.add('js');

  // Intro loader — camera-aperture opening animation, plays once per
  // browser tab session. The inline pre-script right after the loader
  // markup in <body> already hides it synchronously, before first
  // paint, if it already played this session or the visitor prefers
  // reduced motion — so this block only ever runs when it should.
  var introLoader = document.querySelector('[data-intro-loader]');
  if (introLoader && introLoader.style.display !== 'none') {
    try { sessionStorage.setItem('psIntroPlayed', '1'); } catch (e) {}
    document.documentElement.classList.add('intro-lock');
    var introStart = null;
    var introMaxR = 0;
    var INTRO_HOLD = 1150;
    var INTRO_OPEN = 900;
    var introStep = function (ts) {
      if (introStart === null) introStart = ts;
      var elapsed = ts - introStart;
      if (elapsed < INTRO_HOLD) {
        requestAnimationFrame(introStep);
        return;
      }
      if (!introMaxR) {
        introMaxR = Math.sqrt(window.innerWidth * window.innerWidth + window.innerHeight * window.innerHeight) / 2 + 40;
      }
      var t = Math.min(1, (elapsed - INTRO_HOLD) / INTRO_OPEN);
      var eased = 1 - Math.pow(1 - t, 3);
      introLoader.style.setProperty('--intro-r', (eased * introMaxR) + 'px');
      if (t < 1) {
        requestAnimationFrame(introStep);
      } else {
        document.documentElement.classList.remove('intro-lock');
        if (introLoader.parentNode) introLoader.parentNode.removeChild(introLoader);
      }
    };
    requestAnimationFrame(introStep);
  }

  // Mobile menu
  var toggle = document.querySelector('[data-menu-toggle]');
  var mobileNav = document.querySelector('[data-mobile-nav]');
  if (toggle && mobileNav) {
    var closeMenu = function () {
      toggle.setAttribute('aria-expanded', 'false');
      mobileNav.classList.remove('is-open');
    };
    var openMenu = function () {
      toggle.setAttribute('aria-expanded', 'true');
      mobileNav.classList.add('is-open');
    };
    toggle.addEventListener('click', function () {
      var isOpen = toggle.getAttribute('aria-expanded') === 'true';
      isOpen ? closeMenu() : openMenu();
    });
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1024) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  // Collapsible bios (duo cards) — only collapses if the text actually
  // overflows the preview height; short bios stay fully shown, no button.
  var bios = document.querySelectorAll('[data-bio]');
  bios.forEach(function (bio) {
    var collapsedHeight = 78;
    var toggle = bio.nextElementSibling;
    if (!toggle || !toggle.hasAttribute('data-bio-toggle')) return;
    if (bio.scrollHeight <= collapsedHeight + 20) return;
    bio.classList.add('is-collapsible');
    toggle.hidden = false;
    var label = toggle.querySelector('[data-bio-toggle-label]');
    toggle.addEventListener('click', function () {
      var expanded = bio.classList.toggle('is-expanded');
      bio.style.maxHeight = expanded ? bio.scrollHeight + 'px' : collapsedHeight + 'px';
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (label) label.textContent = expanded ? 'Voir moins' : 'Lire la suite';
    });
  });

  // Reveal-on-scroll
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    }
    // Safety net: guarantee visibility even if observation stalls.
    window.setTimeout(function () {
      revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    }, 2500);
  }

  // Stat counters — count up from 0 to the real value, then settle.
  // Each element already holds its final label as static text, so a
  // stalled/failed animation just leaves the correct number in place.
  var counters = document.querySelectorAll('[data-count-to]');
  if (counters.length && 'IntersectionObserver' in window) {
    var animateCounter = function (el) {
      var target = parseFloat(el.getAttribute('data-count-to'));
      var decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
      var suffix = el.getAttribute('data-count-suffix') || '';
      var duration = 1400;
      var start = null;
      var step = function (ts) {
        if (!start) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = (target * eased).toFixed(decimals) + suffix;
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = target.toFixed(decimals) + suffix;
        }
      };
      requestAnimationFrame(step);
    };
    var counterIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          var delay = Array.prototype.indexOf.call(counters, el) * 90;
          window.setTimeout(function () { animateCounter(el); }, delay);
          counterIo.unobserve(el);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { counterIo.observe(el); });
  }

  var lightboxEl = document.querySelector('[data-lightbox]');
  var Lightbox = null;
  if (lightboxEl) {
    var lbImage = lightboxEl.querySelector('[data-lightbox-image]');
    var lbTitle = lightboxEl.querySelector('[data-lightbox-title]');
    var lbCount = lightboxEl.querySelector('[data-lightbox-count]');
    var lbImages = [];
    var lbIndex = 0;

    var render = function () {
      lbImage.style.opacity = 0;
      window.setTimeout(function () {
        lbImage.src = lbImages[lbIndex];
        lbImage.onload = function () { lbImage.style.opacity = 1; };
      }, 120);
      if (lbCount) lbCount.textContent = (lbIndex + 1) + ' / ' + lbImages.length;
    };
    var next = function () { lbIndex = (lbIndex + 1) % lbImages.length; render(); };
    var prev = function () { lbIndex = (lbIndex - 1 + lbImages.length) % lbImages.length; render(); };
    var close = function () {
      lightboxEl.classList.remove('is-open');
      document.body.style.overflow = '';
      window.setTimeout(function () { lightboxEl.hidden = true; }, 300);
    };
    var open = function (images, startIndex, title) {
      lbImages = images;
      lbIndex = startIndex || 0;
      if (lbTitle) lbTitle.textContent = title || '';
      lightboxEl.hidden = false;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(function () { lightboxEl.classList.add('is-open'); });
      render();
    };

    var closeBtn = lightboxEl.querySelector('[data-lightbox-close]');
    var prevBtn = lightboxEl.querySelector('[data-lightbox-prev]');
    var nextBtn = lightboxEl.querySelector('[data-lightbox-next]');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);
    lightboxEl.addEventListener('click', function (e) { if (e.target === lightboxEl) close(); });
    document.addEventListener('keydown', function (e) {
      if (lightboxEl.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    });
    var touchStartX = null;
    lightboxEl.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX; });
    lightboxEl.addEventListener('touchend', function (e) {
      if (touchStartX === null) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) { dx > 0 ? prev() : next(); }
      touchStartX = null;
    });

    Lightbox = { open: open };
  }

  // Project cards — read the pre-built manifest (assets/img/portfolio/
  // manifest.json, one file listing the real photos per project) and
  // wire up the cover image, count and lightbox. No probing, no 404s:
  // every path referenced here is known to exist ahead of time.
  var projectCards = document.querySelectorAll('[data-project]');
  if (projectCards.length) {
    fetch('assets/img/portfolio/manifest.json')
      .then(function (res) { return res.ok ? res.json() : {}; })
      .catch(function () { return {}; })
      .then(function (manifest) {
        projectCards.forEach(function (card) {
          var slug = card.getAttribute('data-slug');
          var title = card.getAttribute('data-title');
          var entry = manifest[slug];
          if (!entry || !entry.files || !entry.files.length) return;

          var basePath = 'assets/img/portfolio/' + slug + '/';
          var coverImg = card.querySelector('[data-project-cover]');
          var countEl = card.querySelector('[data-project-count]');
          var fullSrcs = entry.files.map(function (f) { return basePath + f.file; });

          card.classList.add('has-photo');
          if (coverImg) {
            var coverMeta = entry.coverThumb || entry.files[entry.cover - 1] || entry.files[0];
            coverImg.src = basePath + coverMeta.file;
            coverImg.width = coverMeta.w;
            coverImg.height = coverMeta.h;
            coverImg.loading = 'lazy';
            coverImg.onload = function () { coverImg.classList.add('is-loaded'); };
          }
          if (countEl) countEl.textContent = fullSrcs.length + (fullSrcs.length > 1 ? ' photos' : ' photo');
          card.addEventListener('click', function () {
            if (Lightbox) Lightbox.open(fullSrcs, 0, title);
          });
        });
      });
  }

  // Contact form — submits to Formspree (see contact.html form action);
  // falls back to a plain browser POST if fetch/JS is unavailable.
  var form = document.querySelector('[data-contact-form]');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var success = document.querySelector('[data-contact-success]');
      var error = document.querySelector('[data-contact-error]');
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      if (error) error.hidden = true;

      fetch(form.action, {
        method: form.method,
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          form.hidden = true;
          if (success) success.hidden = false;
        } else {
          throw new Error('submit failed');
        }
      }).catch(function () {
        if (submitBtn) submitBtn.disabled = false;
        if (error) error.hidden = false;
      });
    });
  }
})();
