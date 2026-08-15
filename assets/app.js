/* ============================================================
   Katerina Michael — portfolio behaviour
   Progressive enhancement only. Every feature here is additive:
   with JS off the page is a complete, readable, linked document.
   ============================================================ */
(function () {
  "use strict";

  /* Always open at the top. Browsers default to history.scrollRestoration
     = "auto", which restores your last scroll position on reload/return —
     and with the page's smooth scroll-behavior that restore animates as an
     unwanted glide down to wherever you last were (usually the footer).
     Manual restoration keeps every visit starting at the top; hash links
     (index.html#work etc.) still jump normally. */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. HIGHLIGHTS: auto-advancing stories ----------
     WCAG 2.2.2 (Pause, Stop, Hide): anything that auto-updates for
     more than 5s needs a user-reachable pause. So: a real pause
     button, pause on hover/focus, and no autoplay at all when the
     user has asked for reduced motion.                          */
  var stories = document.querySelector("[data-stories]");
  if (stories) {
    var track  = stories.querySelector(".stories__track");
    var items  = Array.prototype.slice.call(track.querySelectorAll(".story"));
    var bars   = Array.prototype.slice.call(stories.querySelectorAll(".stories__bar"));
    var toggle = stories.querySelector("[data-stories-toggle]");
    var STEP   = 5000;

    var index = 0;
    var playing = !reduceMotion;
    var startedAt = 0;
    var raf = null;

    function paint() {
      items.forEach(function (el, i) {
        el.setAttribute("data-active", i === index ? "1" : "0");
      });
      /* Only the current segment lights up. Filling every previous bar
         reads as "already watched", which is wrong here — these are
         positions in a set, not episodes you've consumed. */
      bars.forEach(function (bar, i) {
        bar.setAttribute("data-active", i === index ? "1" : "0");
        if (i !== index) bar.firstElementChild.style.width = "0%";
      });
    }

    /* Scroll the track itself rather than calling scrollIntoView. The
       latter will move the PAGE vertically whenever the carousel is only
       partly in view — which is what was yanking the reader down into the
       next section every five seconds. Setting scrollLeft can only ever
       move the track horizontally. */
    function show(i, scroll) {
      index = (i + items.length) % items.length;
      paint();
      if (scroll !== false) {
        var target = items[index].offsetLeft
                   - (track.clientWidth - items[index].offsetWidth) / 2;
        var max = track.scrollWidth - track.clientWidth;
        target = Math.max(0, Math.min(target, max));
        if (reduceMotion || typeof track.scrollTo !== "function") {
          track.scrollLeft = target;
        } else {
          track.scrollTo({ left: target, behavior: "smooth" });
        }
      }
      startedAt = performance.now();
    }

    function tick(now) {
      if (!playing) return;
      var elapsed = now - startedAt;
      var fill = bars[index] && bars[index].firstElementChild;
      if (fill) fill.style.width = Math.min(100, (elapsed / STEP) * 100) + "%";
      if (elapsed >= STEP) show(index + 1);
      raf = requestAnimationFrame(tick);
    }

    var toggleIcon = toggle.querySelector("img");

    function play() {
      if (playing) return;
      playing = true;
      startedAt = performance.now();
      toggle.setAttribute("aria-pressed", "false");
      if (toggleIcon) toggleIcon.src = "assets/ui6/icon-pause.png";
      toggle.setAttribute("aria-label", "Pause highlights");
      raf = requestAnimationFrame(tick);
    }

    function pause() {
      playing = false;
      if (raf) cancelAnimationFrame(raf);
      toggle.setAttribute("aria-pressed", "true");
      if (toggleIcon) toggleIcon.src = "assets/ui6/icon-play.png";
      toggle.setAttribute("aria-label", "Play highlights");
    }

    toggle.hidden = false;
    toggle.addEventListener("click", function () { playing ? pause() : play(); });

    stories.querySelector("[data-stories-prev]").addEventListener("click", function () { pause(); show(index - 1); });
    stories.querySelector("[data-stories-next]").addEventListener("click", function () { pause(); show(index + 1); });

    /* don't advance out from under someone who is reading or tabbing */
    stories.addEventListener("mouseenter", function () { if (playing) { playing = false; if (raf) cancelAnimationFrame(raf); } });
    stories.addEventListener("mouseleave", function () { if (toggle.getAttribute("aria-pressed") === "false") { playing = false; play(); } });
    stories.addEventListener("focusin", pause);

    /* stop burning frames while off-screen */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting && playing) { playing = false; if (raf) cancelAnimationFrame(raf); }
          else if (e.isIntersecting && toggle.getAttribute("aria-pressed") === "false" && !playing) { playing = false; play(); }
        });
      }, { threshold: .3 }).observe(stories);
    }

    show(0, false);
    if (reduceMotion) pause(); else { playing = false; play(); }
  }

  /* ---------- 2. Search filter ----------
     Rendered only when JS is available, because a search box that
     does nothing is worse than no search box.

     The container is matched on [data-search-box], NOT [data-search]:
     every poster card carries a data-search attribute of keywords, so
     querySelector("[data-search]") returned the first CARD, `field` came
     back null, and the null addEventListener threw — taking out every
     feature defined below this point. Guarded on the input as well, so a
     malformed search box degrades to "no filter" instead of a dead page. */
  var search = document.querySelector("[data-search-box]");
  var field = search && search.querySelector("input");
  var rows = Array.prototype.slice.call(document.querySelectorAll("[data-row]"));
  if (search && field && rows.length) {
    search.hidden = false;

    /* empty state — never leave someone staring at a blank console */
    var empty = document.createElement("p");
    empty.className = "row__empty";
    empty.setAttribute("role", "status");
    empty.hidden = true;
    rows[0].parentNode.parentNode.insertBefore(empty, rows[0].parentNode);

    field.addEventListener("input", function () {
      var q = field.value.trim().toLowerCase();
      var total = 0;
      rows.forEach(function (row) {
        var posters = Array.prototype.slice.call(row.querySelectorAll(".poster"));
        var shown = 0;
        posters.forEach(function (p) {
          var hit = !q || (p.getAttribute("data-search") || "").toLowerCase().indexOf(q) > -1;
          p.hidden = !hit;
          if (hit) shown++;
        });
        total += shown;
        var section = row.closest(".lvl-row");
        if (section) section.hidden = shown === 0;
      });
      empty.hidden = total > 0;
      if (total === 0) empty.textContent = 'No levels match "' + field.value.trim() + '".';
    });
  }

  /* ---------- 3. Copy-to-clipboard email ----------
     The button ships as a real mailto: link so it works with JS off and
     stays meaningful to anyone who'd rather open their mail client. This
     upgrades it in place: click copies instead, and the address is
     announced through a live region so the result isn't visual-only.
     navigator.clipboard needs a secure context and is absent on file://,
     so there's an execCommand fallback, and if BOTH fail we simply let
     the mailto: through rather than swallowing the click. */
  var copyBtn = document.querySelector("[data-copy-email]");
  if (copyBtn) {
    var status = document.querySelector("[data-copy-status]");
    var statusTimer = null;

    function say(msg) {
      if (!status) return;
      status.textContent = msg;
      if (statusTimer) clearTimeout(statusTimer);
      statusTimer = setTimeout(function () { status.textContent = ""; }, 4000);
    }

    function legacyCopy(text) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      /* off-screen rather than display:none — hidden elements can't be selected */
      ta.style.cssText = "position:absolute;left:-9999px;top:0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }

    copyBtn.addEventListener("click", function (e) {
      var address = copyBtn.getAttribute("data-copy-email");

      function done() {
        e.preventDefault();
        say("Copied " + address);
      }

      if (navigator.clipboard && window.isSecureContext) {
        e.preventDefault();
        navigator.clipboard.writeText(address).then(
          function () { say("Copied " + address); },
          function () {
            /* clipboard API present but refused — try the old way, and if
               that also fails tell them the address so it can be read off
               the screen and typed */
            if (!legacyCopy(address)) say(address);
            else say("Copied " + address);
          }
        );
        return;
      }

      if (legacyCopy(address)) { done(); return; }
      /* no clipboard at all: don't preventDefault — the mailto: fires */
    });
  }

  /* ---------- 4. Parallax sky ----------
     A fixed layer behind the sheet, translated at a fraction of scrollY
     so it drifts instead of sitting still. Fixed layers don't scroll at
     all, so translating UP by rate*scrollY is what produces "moves at
     rate x page speed". */
  var sky = document.querySelector(".sky");
  if (sky) {
    var reduceSky = window.matchMedia("(prefers-reduced-motion: reduce)");
    var rate = parseFloat(getComputedStyle(document.documentElement)
                 .getPropertyValue("--parallax")) || 0.28;
    var skyRO = null;
    var skyTicking = false;

    function skySize() {
      var travel = (document.documentElement.scrollHeight - window.innerHeight) * rate;
      /* +2 so rounding can never expose a hairline of page behind it */
      sky.style.height = (window.innerHeight + Math.max(0, travel) + 2) + "px";
    }
    function skyMove() {
      sky.style.transform = "translate3d(0," + (-window.scrollY * rate) + "px,0)";
      skyTicking = false;
    }
    function onSkyScroll() {
      if (!skyTicking) { skyTicking = true; requestAnimationFrame(skyMove); }
    }
    function skyStart() {
      skySize(); skyMove();
      window.addEventListener("scroll", onSkyScroll, { passive: true });
      /* the page grows after first paint as fonts and images land, and a
         height measured too early leaves the sky short at the bottom */
      if ("ResizeObserver" in window) { skyRO = new ResizeObserver(skySize); skyRO.observe(document.body); }
      window.addEventListener("load", skySize);
    }
    function skyStop() {
      window.removeEventListener("scroll", onSkyScroll);
      if (skyRO) { skyRO.disconnect(); skyRO = null; }
      sky.style.transform = ""; sky.style.height = "";
    }

    if (reduceSky.matches) skyStop(); else skyStart();
    reduceSky.addEventListener("change", function (e) { e.matches ? skyStop() : skyStart(); });
    window.addEventListener("resize", function () { if (!reduceSky.matches) skySize(); }, { passive: true });
  }

  /* ---------- 5. Mobile nav ----------
     The button is inert until this runs — it only gets `is-ready` here,
     so with JS off the full nav list stays visible rather than being
     hidden behind a control that does nothing. */
  var navToggle = document.querySelector("[data-nav-toggle]");
  var navList = navToggle && document.getElementById(navToggle.getAttribute("aria-controls"));
  if (navToggle && navList) {
    navToggle.classList.add("is-ready");

    function setNav(open) {
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      navList.setAttribute("data-open", open ? "1" : "0");
    }

    navToggle.addEventListener("click", function () {
      setNav(navToggle.getAttribute("aria-expanded") !== "true");
    });

    /* every link is a jump — leaving the menu open over the destination
       is the classic mobile-nav annoyance */
    navList.addEventListener("click", function (e) {
      if (e.target.closest("a")) setNav(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
        setNav(false);
        navToggle.focus();
      }
    });

    /* if the viewport grows past the breakpoint while the menu is open,
       clear the state so the desktop bar isn't left in an "open" mode */
    var wide = window.matchMedia("(min-width: 701px)");
    wide.addEventListener("change", function (e) { if (e.matches) setNav(false); });

    setNav(false);
  }

  /* ---------- 6. Mid-depth parallax for the in-page decoration ----------
     Three depths instead of two: the .sky behind the sheet drifts at
     --parallax (.28), the text and panels scroll at 1, and the decoration
     layers inside the sheet (mushrooms, clouds, helmets, arcade icons…) sit
     between them.

     These layers are in flow, so their natural rate is 1. Translating them
     DOWN by scrollY * (1 - rate) makes the apparent rate `rate`:
       moved = -scrollY + scrollY(1 - rate) = -scrollY * rate
     Only the container moves — the sway/bob animations live on the children,
     so their own transforms are untouched. No height fix is needed: pushing a
     full-height layer down can only ever over-cover the viewport, not gap it.

     Two kinds of decoration need this, so both are driven from one handler:
       - themed pages use a real layer element -> translate it
       - the landing page's clouds/stars are ::before pseudo-elements, which
         cannot be translated from script, so a --decor-shift custom property
         is folded into their background-position instead (see styles.css) */
  var decor = document.querySelectorAll(
    ".kr-shrooms, .ac-desk, .ip-arcade, .rc-helms, .bb-page-boxes, .df-scene, " +
    ".hy-plot, .ap-ruins, .pg-desk, .gs-arcade"
  );
  var decorPseudo = document.querySelector(".hero, .band, .level, .foot");
  if (decor.length || decorPseudo) {
    var decorRoot = document.documentElement;
    var decorRate = 0.62;                 /* between the sky (.28) and the content (1) */
    var decorShift = 1 - decorRate;
    var decorTicking = false;

    function decorMove() {
      var y = window.scrollY * decorShift;
      for (var i = 0; i < decor.length; i++) {
        decor[i].style.transform = "translate3d(0," + y + "px,0)";
      }
      if (decorPseudo) decorRoot.style.setProperty("--decor-shift", y + "px");
      decorTicking = false;
    }
    function onDecorScroll() {
      if (!decorTicking) { decorTicking = true; requestAnimationFrame(decorMove); }
    }
    /* The layers are inset:0, so translating them down pushes their lowest
       items past the sheet's overflow:hidden and they get sliced mid-shape —
       which reads as decoration abruptly vanishing near the footer. Shrinking
       each layer by the maximum travel keeps every item inside its own box. */
    function decorSize() {
      var maxShift =
        Math.max(0, document.documentElement.scrollHeight - window.innerHeight) * decorShift;
      for (var i = 0; i < decor.length; i++) {
        var host = decor[i].parentNode;
        var h = (host && host.scrollHeight) || document.documentElement.scrollHeight;
        decor[i].style.bottom = "auto";
        decor[i].style.height = Math.max(0, h - maxShift) + "px";
      }
    }

    function decorStart() {
      for (var i = 0; i < decor.length; i++) decor[i].style.willChange = "transform";
      decorSize();
      decorMove();
      window.addEventListener("scroll", onDecorScroll, { passive: true });
      window.addEventListener("resize", decorSize, { passive: true });
      window.addEventListener("load", decorSize);
    }
    function decorStop() {
      window.removeEventListener("scroll", onDecorScroll);
      window.removeEventListener("resize", decorSize);
      for (var i = 0; i < decor.length; i++) {
        decor[i].style.transform = "";
        decor[i].style.willChange = "";
        decor[i].style.height = "";
        decor[i].style.bottom = "";
      }
      decorRoot.style.removeProperty("--decor-shift");
    }

    var decorMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!decorMQ.matches) decorStart();
    decorMQ.addEventListener("change", function (e) { e.matches ? decorStop() : decorStart(); });
  }

  /* ---------- 7. Active level tab ----------
     Tabs are ordinary anchors, so this only decorates them. */
  var tabLinks = Array.prototype.slice.call(document.querySelectorAll(".tabs a[href^='#']"));
  if (tabLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    tabLinks.forEach(function (a) {
      var t = document.getElementById(a.getAttribute("href").slice(1));
      if (t) byId[t.id] = a;
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var a = byId[e.target.id];
        if (!a) return;
        tabLinks.forEach(function (x) { x.removeAttribute("aria-current"); });
        a.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-25% 0px -65% 0px" });

    Object.keys(byId).forEach(function (id) { spy.observe(document.getElementById(id)); });
  }

  /* ---------- 7b. Active section in the top nav ----------
     Only runs where the nav points at same-page anchors, i.e. the landing
     page. On a project page the links are cross-document
     ("../../index.html#work") so they don't match [href^='#'] and the static
     aria-current="location" on Work is left alone — which is correct there,
     you ARE inside the work section of the site.

     ⚠️ Deliberately NOT an IntersectionObserver, unlike section 7 above.
     "Highlighted only while the target is intersecting" leaves the nav blank
     for long stretches here: #work is just the level-select band, and the five
     level sections after it are thousands of px with no nav target of their
     own. Picking the LAST section whose top has passed a threshold keeps Work
     lit all the way through the levels, which is what a reader expects.

     The bottom case is special-cased: #contact is the footer, and on a long
     page its top may never cross the threshold before the page runs out of
     scroll, so hitting the end activates the last link outright. */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav a[href^='#']"));
  if (navLinks.length) {
    var navTargets = [];
    navLinks.forEach(function (a) {
      var t = document.getElementById(a.getAttribute("href").slice(1));
      if (t) navTargets.push({ link: a, el: t });
    });

    if (navTargets.length) {
      var navTicking = false;

      function markNav() {
        navTicking = false;
        var line = window.innerHeight * 0.35;   /* a third down the viewport */
        var current = navTargets[0];

        for (var i = 0; i < navTargets.length; i++) {
          if (navTargets[i].el.getBoundingClientRect().top <= line) current = navTargets[i];
        }
        /* scrolled to the very bottom — the footer wins even if its top
           never reached the line */
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
          current = navTargets[navTargets.length - 1];
        }

        navTargets.forEach(function (t) {
          if (t === current) t.link.setAttribute("aria-current", "true");
          else t.link.removeAttribute("aria-current");
        });
      }

      window.addEventListener("scroll", function () {
        if (!navTicking) { navTicking = true; requestAnimationFrame(markNav); }
      }, { passive: true });
      window.addEventListener("resize", markNav, { passive: true });
      markNav();
    }
  }

  /* ---------- 8. Lightbox / click-to-zoom ----------
     Every piece of artwork on the site opens full size on click. This is
     OPT-OUT, not opt-in: qualifying images are found by rule, so no page
     markup had to change and any future page gets it for free.

     What is deliberately EXCLUDED, and why:
       - anything inside an <a>       — it already navigates (story cards,
                                        index level panels, poster grids,
                                        the .kr-preview / .ac-preview links).
                                        Hijacking those would break the link.
       - alt="" or [aria-hidden]      — decorative by declaration.
       - /ui6/ and /ui7/ sprites      — chrome, not artwork (arrows, icons).
       - .ico                         — inline button glyphs.
     Everything else — .hy-piece, .ap-piece, .df-piece, .gs-piece, .pg-piece,
     .plate, the gallery grids, the hero portrait — qualifies.

     ⚠️ The trigger is the <img> itself with role="button", NOT a wrapping
     <button>. A wrapper would sit between .hy-piece and its `img` child and
     break every `.<x>-piece img { display:block; width:100% }` rule on the
     themed pages. The alt text is preserved in the aria-label so the
     accessible name still describes the picture. */
  var zoomables = Array.prototype.slice.call(document.images).filter(function (img) {
    if (img.closest("a")) return false;
    if (!img.getAttribute("alt")) return false;
    if (img.hasAttribute("aria-hidden")) return false;
    if (img.classList.contains("ico")) return false;
    var src = img.getAttribute("src") || "";
    return src.indexOf("/ui6/") === -1 && src.indexOf("/ui7/") === -1;
  });

  if (zoomables.length) {
    var lbx = document.createElement("div");
    lbx.className = "lbx";
    lbx.hidden = true;
    lbx.innerHTML =
      '<div class="lbx__backdrop" data-lbx-close></div>' +
      '<div class="lbx__inner" role="dialog" aria-modal="true" aria-label="Image preview">' +
        '<img class="lbx__img" alt="">' +
        '<p class="lbx__cap"></p>' +
        '<button class="lbx__btn lbx__close" type="button" data-lbx-close aria-label="Close preview">&times;</button>' +
        '<button class="lbx__btn lbx__prev" type="button" aria-label="Previous image">&#8249;</button>' +
        '<button class="lbx__btn lbx__next" type="button" aria-label="Next image">&#8250;</button>' +
      "</div>";
    document.body.appendChild(lbx);

    var lbxImg   = lbx.querySelector(".lbx__img");
    var lbxCap   = lbx.querySelector(".lbx__cap");
    var lbxClose = lbx.querySelector(".lbx__close");
    var lbxPrev  = lbx.querySelector(".lbx__prev");
    var lbxNext  = lbx.querySelector(".lbx__next");
    var lbxIndex = 0;
    var lastFocus = null;

    /* Caption: prefer the visible label the page already shows next to the
       picture, so the lightbox says the same thing the page does. Falls back
       to the alt text.
       ⚠️ Search the whole enclosing tile, not img.parentElement — the label is
       not always a sibling of the image. Game Store wraps its screens in CRT
       casing markup, so .gs-crt__cap sits two levels above the <img> and a
       parent-only lookup silently fell through to the alt text. */
    var CAP_SEL =
      ".hy-piece__cap, .ap-piece__cap, .df-piece__cap, .gs-piece__cap, " +
      ".gs-crt__cap, .pg-piece__cap, .plate__no, .kr-piece__no, .gal-piece__no";
    function captionFor(img) {
      var holder = img.closest("li, figure, .plate") || img.parentElement;
      var cap = holder && holder.querySelector(CAP_SEL);
      return (cap && cap.textContent.trim()) || img.getAttribute("alt") || "";
    }

    function show(i) {
      lbxIndex = (i + zoomables.length) % zoomables.length;
      var src = zoomables[lbxIndex];
      lbxImg.src = src.currentSrc || src.src;
      lbxImg.alt = src.getAttribute("alt") || "";
      lbxCap.textContent = captionFor(src);
      var many = zoomables.length > 1;
      lbxPrev.hidden = !many;
      lbxNext.hidden = !many;
    }

    function openLbx(i, trigger) {
      lastFocus = trigger || document.activeElement;
      show(i);
      lbx.hidden = false;
      document.documentElement.classList.add("lbx-open");
      lbxClose.focus();
    }

    function closeLbx() {
      lbx.hidden = true;
      document.documentElement.classList.remove("lbx-open");
      lbxImg.removeAttribute("src");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      lastFocus = null;
    }

    zoomables.forEach(function (img, i) {
      img.classList.add("is-zoomable");
      img.setAttribute("role", "button");
      img.setAttribute("tabindex", "0");
      img.setAttribute("aria-label", "View larger: " + (img.getAttribute("alt") || "image"));
      img.addEventListener("click", function () { openLbx(i, img); });
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          openLbx(i, img);
        }
      });
    });

    lbx.addEventListener("click", function (e) {
      if (e.target.hasAttribute && e.target.hasAttribute("data-lbx-close")) closeLbx();
    });
    lbxPrev.addEventListener("click", function () { show(lbxIndex - 1); });
    lbxNext.addEventListener("click", function () { show(lbxIndex + 1); });

    document.addEventListener("keydown", function (e) {
      if (lbx.hidden) return;
      if (e.key === "Escape") { closeLbx(); return; }
      if (e.key === "ArrowLeft")  { show(lbxIndex - 1); return; }
      if (e.key === "ArrowRight") { show(lbxIndex + 1); return; }
      /* focus trap — the dialog is appended to <body>, so without this Tab
         walks straight out into the page behind the backdrop */
      if (e.key === "Tab") {
        var stops = [lbxClose, lbxPrev, lbxNext].filter(function (b) { return !b.hidden; });
        var first = stops[0];
        var last = stops[stops.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }
})();
