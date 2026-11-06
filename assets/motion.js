/* Think Tank motion — progressive enhancement only.
 *
 * The public front door serves CSP script-src 'none', and motion.css already
 * delivers smooth scroll, reveals and parallax with pure CSS scroll-driven
 * animations. This file exists for browsers without scroll-timeline support
 * and for the company site's nav-section tracking. It never hides content on
 * its own authority: the pre-reveal state in motion.css applies only under
 * html.tt-anim, which this script adds immediately before observing — so if
 * this script is blocked, absent, or fails, every element stays visible.
 */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var root = document.documentElement;

  /* Day / night persistence — enhancement only. The theme itself is pure
     CSS (the nav checkbox + body:has() variable blocks), so it works with
     this script blocked or absent; all this does is remember the choice.
     Night stays the default whatever the OS prefers: it is the approved
     brand look from the founder's mockups. */
  var themeBox = document.querySelector('.tt-theme-toggle');
  if (themeBox) {
    try {
      if (window.localStorage.getItem('tt-theme') === 'day') themeBox.checked = true;
      themeBox.addEventListener('change', function () {
        try { window.localStorage.setItem('tt-theme', themeBox.checked ? 'day' : 'night'); } catch (e) { /* storage unavailable */ }
      });
    } catch (e) { /* storage unavailable — the CSS toggle still works */ }
  }

  /* Pointer tilt — fine pointers only, subtle (max ~4deg), on the auth card
     and the guide cards. The .tt-tilt class pauses the element's reveal
     animation while the pointer owns its transform; leaving resets it. */
  if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      var raf = null;
      el.addEventListener('pointermove', function (event) {
        if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
        if (raf) return;
        raf = window.requestAnimationFrame(function () {
          raf = null;
          var rect = el.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          var px = (event.clientX - rect.left) / rect.width - 0.5;
          var py = (event.clientY - rect.top) / rect.height - 0.5;
          el.classList.add('tt-tilt');
          el.style.transform = 'perspective(950px) rotateX(' + (-py * 8).toFixed(2) + 'deg) rotateY(' + (px * 8).toFixed(2) + 'deg)';
        });
      });
      el.addEventListener('pointerleave', function () {
        if (raf) { window.cancelAnimationFrame(raf); raf = null; }
        el.style.transform = '';
        window.setTimeout(function () { el.classList.remove('tt-tilt'); }, 200);
      });
    });
  }

  var cssScrollDriven = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');

  /* Scroll reveals via IntersectionObserver (fallback path only). */
  if (!cssScrollDriven && 'IntersectionObserver' in window) {
    var targets = document.querySelectorAll('[data-reveal]');
    if (targets.length) {
      root.classList.add('tt-anim');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('tt-in');
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      targets.forEach(function (el) { io.observe(el); });
    }
  }

  /* Hero parallax via rAF-throttled scroll (fallback path only — the CSS
     scroll-timeline owns this where supported). Mirrors jussco.company:
     background translate3d(0, scrollY * 0.25, 0). */
  if (!cssScrollDriven) {
    var plates = document.querySelectorAll('[data-parallax]');
    if (plates.length) {
      var ticking = false;
      var apply = function () {
        var y = Math.min(window.scrollY || 0, 800);
        plates.forEach(function (el) {
          el.style.transform = 'translate3d(0,' + (y * 0.25) + 'px,0) scale(1.12)';
        });
        ticking = false;
      };
      window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; window.requestAnimationFrame(apply); }
      }, { passive: true });
      apply();
    }
  }

  /* Nav active-section tracking, same rootMargin as jussco.company. */
  var navLinks = document.querySelectorAll('[data-nav]');
  if (navLinks.length && 'IntersectionObserver' in window) {
    var bySection = {};
    navLinks.forEach(function (a) { bySection[a.getAttribute('data-nav')] = a; });
    var navIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          navLinks.forEach(function (a) { a.classList.toggle('on', a === bySection[entry.target.id]); });
        }
      });
    }, { rootMargin: '-40% 0px -50% 0px' });
    Object.keys(bySection).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) navIo.observe(section);
    });
  }
})();
