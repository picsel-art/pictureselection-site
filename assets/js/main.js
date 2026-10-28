/* Picture Selection, interactions et animations.
   JavaScript natif, sans dépendance. Chaque effet respecte
   prefers-reduced-motion et le contenu reste lisible sans JS. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var desktop = function () { return window.innerWidth >= 900; };

  // Titres : découpe en mots pour la révélation ligne à ligne. Seules les
  // espaces simples coupent, les espaces insécables gardent les mots liés.
  function splitTitle(el) {
    var i = 0;
    var wrap = function (content) {
      var outer = document.createElement('span');
      var inner = document.createElement('span');
      outer.className = 'w';
      inner.style.setProperty('--i', i++);
      inner.appendChild(content);
      outer.appendChild(inner);
      return outer;
    };
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/([ \t\n\r]+)/).forEach(function (part) {
            if (!part) return;
            if (/^[ \t\n\r]+$/.test(part)) frag.appendChild(document.createTextNode(' '));
            else frag.appendChild(wrap(document.createTextNode(part)));
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          if (child.classList.contains('nw')) {
            var holder = document.createElement('span');
            node.replaceChild(holder, child);
            node.replaceChild(wrap(child), holder);
          } else {
            walk(child);
          }
        }
      });
    };
    walk(el);
  }
  $$('[data-split]').forEach(splitTitle);

  // Révélations au défilement (titres, images, filets).
  var revealed = false;
  function startReveals() {
    if (revealed) return;
    revealed = true;
    var targets = $$('[data-split], [data-reveal]');
    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    targets.forEach(function (el) { io.observe(el); });
  }
  window.addEventListener('beforeprint', function () {
    $$('[data-split], [data-reveal]').forEach(function (el) { el.classList.add('is-in'); });
  });

  // En-tête : se retire à la descente, revient à la remontée.
  var hd = $('[data-header]');
  var lastY = window.pageYOffset;
  var menuOpen = false;
  function updateHeader(y) {
    if (!hd) return;
    hd.classList.toggle('is-scrolled', y > 8);
    if (Math.abs(y - lastY) < 6) return;
    var hide = y > lastY && y > 160 && !menuOpen && !hd.contains(document.activeElement);
    hd.classList.toggle('is-hidden', hide);
    lastY = y;
  }
  if (hd) hd.addEventListener('focusin', function () { hd.classList.remove('is-hidden'); });

  // Menu mobile.
  var toggle = $('[data-menu-toggle]');
  var menu = $('[data-menu]');
  var menuLabel = $('[data-menu-label]');
  var setInert = function (on, except) {
    $$('main, footer, .hd, [data-lightbox]').forEach(function (el) {
      if (except && except.indexOf(el) !== -1) return;
      el.inert = on;
    });
  };
  function openMenu() {
    menuOpen = true;
    menu.hidden = false;
    void menu.offsetWidth;
    menu.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    menuLabel.textContent = 'Fermer';
    doc.classList.add('menu-lock');
    if (hd) hd.classList.remove('is-hidden');
    setInert(true, [hd]);
    var first = $('a', menu);
    if (first) first.focus();
  }
  function closeMenu(restoreFocus) {
    if (!menuOpen) return;
    menuOpen = false;
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    menuLabel.textContent = 'Menu';
    doc.classList.remove('menu-lock');
    setInert(false);
    window.setTimeout(function () { if (!menuOpen) menu.hidden = true; }, 200);
    if (restoreFocus) toggle.focus();
  }
  if (toggle && menu) {
    toggle.addEventListener('click', function () { menuOpen ? closeMenu(true) : openMenu(); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { closeMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) closeMenu(true); });
    window.addEventListener('resize', function () { if (window.innerWidth >= 860) closeMenu(false); });
  }

  // Planche contact : le cercle rouge suit l'image sélectionnée,
  // qui passe du noir et blanc à la couleur.
  var sheet = $('[data-sheet]');
  var sheetSection = sheet ? sheet.closest('.sheet') : null;
  var rows = sheet ? $$('[data-drift]', sheet) : [];
  if (sheet) {
    var frames = $$('[data-frame]', sheet);
    var select = function (f) {
      frames.forEach(function (x) { x.classList.toggle('is-sel', x === f); });
    };
    frames.forEach(function (f) {
      var btn = $('button', f);
      f.addEventListener('mouseenter', function () { select(f); });
      if (btn) btn.addEventListener('focus', function () { select(f); });
    });
    if (!reduced && 'IntersectionObserver' in window) {
      frames.forEach(function (x) { x.classList.remove('is-sel'); });
      sheetSection.classList.add('is-first');
      var firstIo = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting || !revealed) return;
        firstIo.disconnect();
        window.setTimeout(function () {
          if (!$('.is-sel', sheet)) select(frames[0]);
          window.setTimeout(function () { sheetSection.classList.remove('is-first'); }, 1000);
        }, 350);
      }, { threshold: 0.35 });
      sheet.__start = function () { firstIo.observe(sheet); };
    }
  }

  // Effets liés au défilement : dérive de la planche, parallaxe des
  // images, progression des lignes (méthode, parcours).
  var parallax = $$('[data-parallax]');
  var progressEls = $$('[data-progress]');
  var ticking = false;
  function progressOf(el, vh) {
    var r = el.getBoundingClientRect();
    return clamp((vh * 0.85 - r.top) / Math.max(r.height, vh * 0.45), 0, 1);
  }
  function frame() {
    ticking = false;
    var y = window.pageYOffset;
    var vh = window.innerHeight;
    updateHeader(y);
    progressEls.forEach(function (el) {
      var p = reduced ? 1 : progressOf(el, vh);
      el.style.setProperty('--p', p.toFixed(4));
      var steps = $$('[data-step]', el);
      steps.forEach(function (s, i) { s.classList.toggle('is-on', reduced || p >= (i + 0.25) / steps.length); });
    });
    if (reduced || !desktop()) return;
    if (sheetSection && rows.length) {
      var r = sheetSection.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        var t = clamp((vh - r.top) / (vh + r.height), 0, 1);
        rows.forEach(function (row) {
          var dir = parseFloat(row.getAttribute('data-drift')) || 0;
          row.style.transform = 'translate3d(' + ((t - 0.5) * 2 * 72 * dir).toFixed(1) + 'px,0,0)';
        });
      }
    }
    parallax.forEach(function (el) {
      var box = el.parentNode.getBoundingClientRect();
      if (box.bottom < -80 || box.top > vh + 80) return;
      var shift = clamp((box.top + box.height / 2 - vh / 2) * -0.07, -38, 38);
      el.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
    });
  }
  function requestFrame() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(frame); }
  }
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', function () {
    if (!desktop()) {
      rows.forEach(function (row) { row.style.transform = ''; });
      parallax.forEach(function (el) { el.style.transform = ''; });
    }
    requestFrame();
  });
  requestFrame();

  // Intro de l'accueil : traits de coupe, logo, cercle de sélection,
  // puis le rideau se lève. Une fois par session, cliquable pour passer.
  function begin() {
    startReveals();
    if (sheet && sheet.__start) sheet.__start();
  }
  var intro = $('[data-intro]');
  if (intro) {
    try { sessionStorage.setItem('psIntro', '1'); } catch (e) {}
    doc.classList.add('intro-lock');
    var finished = false;
    var finish = function () {
      if (finished) return;
      finished = true;
      doc.classList.remove('intro-lock');
      if (intro.parentNode) intro.parentNode.removeChild(intro);
    };
    var t1, t2;
    var leave = function () {
      intro.classList.add('is-leaving');
      begin();
      t2 = window.setTimeout(finish, 320);
    };
    window.requestAnimationFrame(function () { intro.classList.add('is-playing'); });
    t1 = window.setTimeout(leave, 1150);
    intro.addEventListener('click', function () {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      begin();
      finish();
    });
  } else {
    begin();
  }

  // Galerie plein écran, alimentée par assets/img/portfolio/manifest.json.
  var lb = $('[data-lightbox]');
  if (lb) {
    var lbImg = $('[data-lb-img]', lb);
    var lbVideo = $('[data-lb-video]', lb);
    var lbPlay = $('[data-lb-play]', lb);
    var lbTitle = $('[data-lb-title]', lb);
    var lbCount = $('[data-lb-count]', lb);
    var lbLive = $('[data-lb-live]', lb);
    var lbClose = $('[data-lb-close]', lb);
    var manifestPromise = null;
    var items = [];
    var index = 0;
    var name = '';
    var opener = null;
    var token = 0;

    var loadManifest = function () {
      if (!manifestPromise) {
        manifestPromise = fetch('assets/img/portfolio/manifest.json')
          .then(function (res) { return res.ok ? res.json() : {}; })
          .catch(function () { return {}; });
      }
      return manifestPromise;
    };
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    // Les vidéos (animations de logo) tournent en boucle, sans son ;
    // le bouton Pause les arrête, et rien ne démarre seul en mouvement réduit.
    var syncPlay = function () { lbPlay.textContent = lbVideo.paused ? 'Lecture' : 'Pause'; };
    lbVideo.addEventListener('play', syncPlay);
    lbVideo.addEventListener('pause', syncPlay);
    lbPlay.addEventListener('click', function () {
      if (lbVideo.paused) { var p = lbVideo.play(); if (p && p.catch) p.catch(syncPlay); } else lbVideo.pause();
    });
    var show = function (i, dir) {
      index = (i + items.length) % items.length;
      var item = items[index];
      var mine = ++token;
      var isVideo = item.type === 'video';
      lbVideo.pause();
      lbImg.hidden = isVideo;
      lbVideo.hidden = !isVideo;
      lbPlay.hidden = !isVideo;
      lbCount.textContent = pad(index + 1) + ' / ' + pad(items.length);
      lbLive.textContent = 'Visuel ' + (index + 1) + ' sur ' + items.length;
      [1, -1].forEach(function (d) {
        var n = items[(index + d + items.length) % items.length];
        if (n) (new Image()).src = n.type === 'video' ? n.poster : n.src;
      });
      if (isVideo) {
        lbVideo.classList.remove('is-ready');
        lbVideo.style.setProperty('--dx', (dir || 0) * 14 + 'px');
        lbVideo.muted = true;
        lbVideo.poster = item.poster;
        lbVideo.src = item.webm && !lbVideo.canPlayType('video/mp4; codecs="avc1.640028"') ? item.webm : item.src;
        lbVideo.width = item.w;
        lbVideo.height = item.h;
        lbVideo.setAttribute('aria-label', name + ', animation, visuel ' + (index + 1) + ' sur ' + items.length);
        if (!reduced) { var p = lbVideo.play(); if (p && p.catch) p.catch(syncPlay); }
        syncPlay();
        window.requestAnimationFrame(function () { lbVideo.classList.add('is-ready'); });
        return;
      }
      lbImg.classList.remove('is-ready');
      lbImg.style.setProperty('--dx', (dir || 0) * 14 + 'px');
      var pre = new Image();
      pre.onload = pre.onerror = function () {
        if (mine !== token) return;
        lbImg.src = item.src;
        lbImg.width = item.w;
        lbImg.height = item.h;
        lbImg.alt = name + ', visuel ' + (index + 1) + ' sur ' + items.length;
        window.requestAnimationFrame(function () { lbImg.classList.add('is-ready'); });
      };
      pre.src = item.src;
    };
    var openGallery = function (slug, title, from) {
      loadManifest().then(function (m) {
        var entry = m[slug];
        if (!entry || !entry.files || !entry.files.length) return;
        var base = 'assets/img/portfolio/' + slug + '/';
        items = entry.files.map(function (f) {
          return { src: base + f.file, w: f.w, h: f.h, type: f.type || 'image', poster: f.poster ? base + f.poster : '', webm: f.webm ? base + f.webm : '' };
        });
        name = title;
        opener = from;
        lbTitle.textContent = title;
        lb.hidden = false;
        lb.classList.remove('is-closing');
        void lb.offsetWidth;
        lb.classList.add('is-open');
        doc.classList.add('lb-lock');
        setInert(true, [lb]);
        show(0, 0);
        lbClose.focus();
      });
    };
    var closeGallery = function () {
      if (lb.hidden) return;
      lb.classList.add('is-closing');
      lb.classList.remove('is-open');
      doc.classList.remove('lb-lock');
      setInert(false);
      lbVideo.pause();
      window.setTimeout(function () { lb.hidden = true; lbImg.removeAttribute('src'); lbVideo.removeAttribute('src'); }, 160);
      if (opener) opener.focus();
    };

    $$('[data-gallery]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openGallery(btn.getAttribute('data-gallery'), btn.getAttribute('data-title'), btn);
      });
    });
    lbClose.addEventListener('click', closeGallery);
    $('[data-lb-prev]', lb).addEventListener('click', function () { show(index - 1, -1); });
    $('[data-lb-next]', lb).addEventListener('click', function () { show(index + 1, 1); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeGallery();
      else if (e.key === 'ArrowRight') show(index + 1, 1);
      else if (e.key === 'ArrowLeft') show(index - 1, -1);
      else if (e.key === 'Tab') {
        var focusables = $$('button', lb);
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    var startX = null;
    var stage = $('[data-lb-stage]', lb);
    stage.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 48) dx > 0 ? show(index - 1, -1) : show(index + 1, 1);
      startX = null;
    });
  }

  // Formulaire de contact : validation à la sortie du champ, messages
  // clairs, envoi Formspree. Tant que l'identifiant Formspree n'est pas
  // configuré, le message s'ouvre dans la messagerie du visiteur.
  var form = $('[data-contact-form]');
  if (form) {
    var messages = {
      name: 'Indiquez votre nom pour que nous sachions à qui répondre.',
      email: 'Indiquez une adresse e-mail complète, par exemple nom@domaine.fr.',
      message: 'Décrivez votre projet en quelques mots.'
    };
    var status = $('[data-form-status]', form);
    var submit = $('[data-submit]', form);
    var fields = $$('input[required], textarea[required]', form);
    var showError = function (input) {
      var err = document.getElementById(input.id + '-err');
      var bad = !input.validity.valid || (input.required && !input.value.trim());
      input.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (err) {
        err.textContent = bad ? messages[input.name] : '';
        err.hidden = !bad;
      }
      return !bad;
    };
    fields.forEach(function (input) {
      input.addEventListener('blur', function () { if (input.value) showError(input); });
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true') showError(input);
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      fields.forEach(function (input) { if (!showError(input) && !firstBad) firstBad = input; });
      if (firstBad) { firstBad.focus(); return; }

      var data = new FormData(form);
      if (form.action.indexOf('YOUR_FORM_ID') !== -1) {
        var body = 'Nom\u00a0: ' + data.get('name') + '\nE-mail\u00a0: ' + data.get('email') + '\n\n' + data.get('message');
        var subject = data.get('subject') || 'Nouveau projet';
        window.location.href = 'mailto:contact@pictureselection.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        status.textContent = 'Votre messagerie s’ouvre avec le message prêt à partir. Si rien ne s’ouvre, écrivez-nous à contact@pictureselection.com.';
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Envoi en cours';
      status.textContent = '';
      fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('envoi');
          form.hidden = true;
          var done = $('[data-form-done]');
          done.hidden = false;
          var title = $('[data-form-done-title]');
          if (title) title.focus();
        })
        .catch(function () {
          submit.disabled = false;
          submit.textContent = 'Envoyer le message';
          status.textContent = 'Le message n’est pas parti, la connexion a échoué. Réessayez, ou écrivez-nous à contact@pictureselection.com.';
        });
    });
  }
})();
