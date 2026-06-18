// ─── Smooth Scroll Engine (lerp-eased, Lenis-style buttery scroll) ───
  // Defined first so other scroll-driven systems (parallax, navbar shadow,
  // scroll-progress morph) can all read from one consistent virtual scroll value.
  // Skipped entirely on touch devices and reduced-motion — native scroll feels best there.
  const SmoothScroll = (function () {
    const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wrapper = document.getElementById('smooth-wrapper');

    if (isTouch || reducedMotion || !wrapper) {
      return { enabled: false, getScroll: () => window.scrollY };
    }

    document.documentElement.classList.add('smooth-scroll-active');

    let targetY = window.scrollY;
    let currentY = window.scrollY;
    const ease = 0.085; // lower = laggier/smoother, higher = snappier

    function setBodyHeight() {
      document.body.style.height = wrapper.getBoundingClientRect().height + 'px';
    }
    setBodyHeight();
    window.addEventListener('resize', setBodyHeight);
    window.addEventListener('load', setBodyHeight);
    setTimeout(setBodyHeight, 500);

    window.addEventListener('wheel', (e) => {
      if (document.body.classList.contains('scroll-locked')) {
        e.preventDefault();
        return;
      }
      targetY += e.deltaY;
      targetY = Math.max(0, Math.min(targetY, wrapper.getBoundingClientRect().height - window.innerHeight));
      e.preventDefault();
    }, { passive: false });

    // Allow keyboard scroll (space, arrows, page up/down) to keep working
    window.addEventListener('keydown', (e) => {
      if (document.body.classList.contains('scroll-locked')) {
        const keys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Space', ' ', 'End', 'Home'];
        if (keys.includes(e.key)) {
          e.preventDefault();
        }
        return;
      }
      const keys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Space', ' ', 'End', 'Home'];
      if (!keys.includes(e.key)) return;
      const delta = {
        ArrowDown: 80, ArrowUp: -80, PageDown: window.innerHeight * 0.9,
        PageUp: -window.innerHeight * 0.9, Space: window.innerHeight * 0.9,
        ' ': window.innerHeight * 0.9, End: 1e7, Home: -1e7
      }[e.key] || 0;
      targetY += delta;
      const maxY = wrapper.getBoundingClientRect().height - window.innerHeight;
      targetY = Math.max(0, Math.min(targetY, maxY));
    });

    function raf() {
      currentY += (targetY - currentY) * ease;
      if (Math.abs(targetY - currentY) < 0.05) currentY = targetY;
      wrapper.style.transform = `translateY(${-currentY}px)`;
      window.requestAnimationFrame(raf);
    }
    window.requestAnimationFrame(raf);

    // Intercept in-page anchor links (#features, #pricing, etc.) so they
    // animate the lerp target instead of jumping the (hidden) native scroll.
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href').slice(1);
        const targetEl = document.getElementById(id);
        if (!targetEl) return;
        e.preventDefault();
        const rect = targetEl.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();
        const destination = rect.top - wrapperRect.top - 70; // offset for fixed nav
        targetY = Math.max(0, destination);
      });
    });

    return {
      enabled: true,
      getScroll: () => currentY
    };
  })();

  // ─── Scroll Reveal Engine (Fade In / Slide Up / Zoom In, Framer-Motion-style spring easing) ───
  (function () {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Groups of siblings that should cascade in with a staggered delay
    // rather than all animating at the exact same moment.
    const staggerGroupSelectors = [
      '.feat-grid > .feat-card',
      '.roles-grid > .role-card',
      '.flow-steps > .flow-step',
      '.pricing-grid > .pricing-card',
      '.stats-grid > .stat-blk',
      '.notif-demo > .notif-card',
      '.hero-stats > .stat-item',
      '.footer-grid > *'
    ];

    function applyStagger() {
      staggerGroupSelectors.forEach((selector) => {
        const groups = {};
        document.querySelectorAll(selector).forEach((el) => {
          const parent = el.parentElement;
          if (!parent) return;
          const key = selector + '::' + (parent.dataset.staggerId || (parent.dataset.staggerId = Math.random().toString(36).slice(2)));
          groups[key] = groups[key] || 0;
          if (el.hasAttribute('data-reveal')) {
            el.style.setProperty('--reveal-delay', (groups[key] * 0.08) + 's');
            groups[key]++;
          }
        });
      });
    }

    if (prefersReducedMotion) {
      // Skip animation setup entirely; CSS reduced-motion rules already force visibility.
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
    } else {
      applyStagger();

      // Note: IntersectionObserver tracks real painted position, which stays
      // correct even though #smooth-wrapper is moved with a CSS transform —
      // no need to feed it the virtual scroll value separately.
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.15,
        rootMargin: '0px 0px -60px 0px'
      });

      document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el));

      // ─── Parallax (Hero background grid + glowing orbs) ───
      const parallaxHero = document.querySelector('.hero');
      const parallaxOrb1 = document.querySelector('.orb-1');
      const parallaxOrb2 = document.querySelector('.orb-2');
      const parallaxGrid = document.querySelector('.hero-grid-bg');

      function updateParallax() {
        const scrollY = SmoothScroll.getScroll();
        const heroHeight = parallaxHero ? parallaxHero.offsetHeight : 0;

        // Only run while the hero is still in view (cheap perf guard)
        if (scrollY < heroHeight) {
          if (parallaxOrb1) parallaxOrb1.style.transform = `translateY(${scrollY * 0.25}px)`;
          if (parallaxOrb2) parallaxOrb2.style.transform = `translateY(${scrollY * -0.18}px)`;
          if (parallaxGrid) parallaxGrid.style.transform = `translateY(${scrollY * 0.12}px)`;
        }
        window.requestAnimationFrame(updateParallax);
      }
      window.requestAnimationFrame(updateParallax);
    }
  })();

  // ─── Scroll-Progress Morph (elements scale/rotate/blur based on how far
  //     they've scrubbed through the viewport — the "scroll-driven transform"
  //     feel from premium agency sites) ───
  (function () {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const morphTargets = [
      { el: document.querySelector('.preview-wrap'), rotateRange: 6, scaleRange: 0.06 },
      { el: document.querySelector('.users-banner'), rotateRange: 3, scaleRange: 0.04 },
      { el: document.querySelector('.pricing-calculator'), rotateRange: 2, scaleRange: 0.03 }
    ].filter((t) => t.el);

    morphTargets.forEach((t) => t.el.classList.add('morph-target'));

    let lastFrame = -1;
    function getScrollY() {
      return SmoothScroll.enabled ? SmoothScroll.getScroll() : window.scrollY;
    }

    function updateMorph() {
      const scrollY = getScrollY();
      const viewportH = window.innerHeight;

      morphTargets.forEach(({ el, rotateRange, scaleRange }) => {
        const rect = el.getBoundingClientRect();
        // progress: -1 when element center is at bottom of viewport, 0 at dead center, +1 at top
        const center = rect.top + rect.height / 2;
        const progress = Math.max(-1, Math.min(1, (viewportH / 2 - center) / (viewportH / 2)));

        const rotate = progress * rotateRange;
        const scale = 1 - Math.abs(progress) * scaleRange;
        el.style.transform = `perspective(1000px) rotateX(${rotate * -1}deg) scale(${scale})`;
      });

      window.requestAnimationFrame(updateMorph);
    }
    window.requestAnimationFrame(updateMorph);
  })();

  // ─── 3D Mouse-Tilt (cards lean toward the cursor, parallax-light effect
  //     on icons inside) — skipped on touch devices via CSS hover/pointer query ───
  (function () {
    const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch || reducedMotion) return;

    const tiltSelectors = [
      '.feat-card', '.role-card', '.pricing-card',
      '.showcase-panel', '.preview-card'
    ];
    const tiltCards = document.querySelectorAll(tiltSelectors.join(','));

    tiltCards.forEach((card) => {
      card.classList.add('tilt-card');
      const maxTilt = 8; // degrees
      const maxLift = 6; // px translateZ-like lift via translateY

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;  // 0 → 1
        const y = (e.clientY - rect.top) / rect.height;  // 0 → 1
        const rotateY = (x - 0.5) * maxTilt * 2;
        const rotateX = (0.5 - y) * maxTilt * 2;
        card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-${maxLift}px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  })();

  // ─── Theme Toggle Logic ───
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeToggleIcon = themeToggleBtn.querySelector('i');

  function getActiveTheme() {
    const stored = localStorage.getItem('theme');
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyActiveTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update icon
    if (theme === 'dark') {
      themeToggleIcon.className = 'fa-solid fa-sun';
      themeToggleBtn.setAttribute('aria-label', 'Switch to light theme');
    } else {
      themeToggleIcon.className = 'fa-solid fa-moon';
      themeToggleBtn.setAttribute('aria-label', 'Switch to dark theme');
    }
  }

  // Initialize icon state on load (attribute is set by head script already)
  applyActiveTheme(getActiveTheme());

  themeToggleBtn.addEventListener('click', () => {
    const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyActiveTheme(nextTheme);
  });

  // Listen to system changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      applyActiveTheme(e.matches ? 'dark' : 'light');
    }
  });

  // ─── Navbar scroll shadow ───
  const topNav = document.getElementById('top-nav');
  function updateNavShadow() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const scrollY = SmoothScroll.getScroll();
    if (scrollY > 60) {
      topNav.style.boxShadow = isDark ? '0 4px 40px rgba(0,0,0,.5)' : '0 4px 20px rgba(0,0,0,.08)';
    } else {
      topNav.style.boxShadow = 'none';
    }
    window.requestAnimationFrame(updateNavShadow);
  }
  window.requestAnimationFrame(updateNavShadow);
  // Native scroll still fires on touch/reduced-motion fallback path
  window.addEventListener('scroll', updateNavShadow);

  // ─── Hamburger menu toggle ───
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');

  function openMenu() {
    hamburger.classList.add('open');
    mobileNav.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    hamburger.classList.remove('open');
    mobileNav.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    hamburger.classList.contains('open') ? closeMenu() : openMenu();
  });

  // Close on nav link click
  document.querySelectorAll('.mobile-nav-link, .mobile-nav-cta a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close when tapping outside
  document.addEventListener('click', (e) => {
    if (mobileNav.classList.contains('open') &&
        !mobileNav.contains(e.target) &&
        !hamburger.contains(e.target)) {
      closeMenu();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // Close menu on window resize if desktop width
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeMenu();
  });

  // ─── Interactive Pricing Calculator ───
  function updatePricing() {
    const slider = document.getElementById('storage-slider');
    const val = parseInt(slider.value);
    document.getElementById('storage-val-display').innerText = val + ' GB';

    // Pricing calculation rules:
    // Plan 1 & Plan 2: ₹20 / GB additional
    // Plan 3: ₹50 / GB additional
    const addCost1_2 = val * 20;
    const addCost3 = val * 50;

    const total1 = 999 + addCost1_2;
    const total2 = 1499 + addCost1_2;
    const total3 = 1999 + addCost3;

    document.getElementById('price-val-1').innerText = total1.toLocaleString('en-IN');
    document.getElementById('price-val-2').innerText = total2.toLocaleString('en-IN');
    document.getElementById('price-val-3').innerText = total3.toLocaleString('en-IN');

    // Show breakdown subtext dynamically
    if (val > 0) {
      document.getElementById('price-breakdown-1').innerHTML = `₹999 base + ₹${addCost1_2.toLocaleString('en-IN')} storage`;
      document.getElementById('price-breakdown-2').innerHTML = `₹1,499 base + ₹${addCost1_2.toLocaleString('en-IN')} storage`;
      document.getElementById('price-breakdown-3').innerHTML = `₹1,999 base + ₹${addCost3.toLocaleString('en-IN')} storage`;
    } else {
      document.getElementById('price-breakdown-1').innerHTML = '₹999 base + 2GB free';
      document.getElementById('price-breakdown-2').innerHTML = '₹1,499 base + 2GB free';
      document.getElementById('price-breakdown-3').innerHTML = '₹1,999 base + 2GB free';
    }
  }

  // Run once on load to initialize breakdown texts
  updatePricing();

  // ─── Interactive Practice Simulator Engine ───
  (function () {
    const scenes = [
      {
        title: "The Problem",
        subtitle: "Managing a dental clinic shouldn't mean spending hours on paperwork. Yet many clinics still struggle with manual records, scattered patient data, and time-consuming administrative tasks.",
        html: `
          <div class="sim-scene-content">
            <div class="scene-clinic-chaos">
              <div class="chaos-office-desk">
                <div class="chaos-desk-files">
                  <div class="file-line red"></div>
                  <div class="file-line amber"></div>
                  <div class="file-line blue"></div>
                </div>
                <span style="font-size:0.6rem;color:var(--text-muted);font-weight:700;">Paper Records</span>
              </div>
              <div class="chaos-clinic-staff">
                <i class="fa-solid fa-face-frown"></i>
              </div>
              <div class="warning-alert-bubble">⚠️ BACKLOG</div>
              <div class="floating-papers-container">
                <div class="flying-paper p1"><div class="paper-line"></div><div class="paper-line"></div></div>
                <div class="flying-paper p2"><div class="paper-line"></div><div class="paper-line"></div></div>
                <div class="flying-paper p3"><div class="paper-line"></div><div class="paper-line"></div></div>
                <div class="flying-paper p4"><div class="paper-line"></div><div class="paper-line"></div></div>
                <div class="flying-paper p5"><div class="paper-line"></div><div class="paper-line"></div></div>
              </div>
            </div>
          </div>
        `,
        duration: 8000
      },
      {
        title: "Challenges",
        subtitle: "Manual processes lead to lost time, slower operations, reporting challenges, and reduced productivity.",
        html: `
          <div class="sim-scene-content">
            <div class="challenges-list">
              <div class="challenge-item c1" id="ch-1">
                <div class="challenge-icon"><i class="fa-solid fa-copy"></i></div>
                <div class="challenge-text">Papers piling up on desks</div>
              </div>
              <div class="challenge-item c2" id="ch-2">
                <div class="challenge-icon"><i class="fa-solid fa-magnifying-glass challenge-search-shake"></i></div>
                <div class="challenge-text">Staff searching for patient records</div>
              </div>
              <div class="challenge-item c3" id="ch-3">
                <div class="challenge-icon"><i class="fa-regular fa-clock challenge-clock-spin"></i></div>
                <div class="challenge-text">Long waiting times for patients</div>
              </div>
              <div class="challenge-item c4" id="ch-4">
                <div class="challenge-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div class="challenge-text">Missed follow-ups and delayed reports</div>
              </div>
            </div>
          </div>
        `,
        duration: 7500
      },
      {
        title: "The Solution",
        subtitle: "Introducing DentalOS – the complete dental practice management solution.",
        html: `
          <div class="sim-scene-content">
            <div class="morph-stage">
              <div class="papers-dissolving">
                <div class="dissolve-particle"></div>
                <div class="dissolve-particle"></div>
                <div class="dissolve-particle"></div>
                <div class="dissolve-particle"></div>
                <div class="dissolve-particle"></div>
                <div class="dissolve-particle"></div>
              </div>
              <div class="reveal-glow-flash"></div>
              <div class="transformed-dashboard-card">
                <div class="dash-header-mini">
                  <div class="prev-dot" style="background:#ef4444;width:6px;height:6px;"></div>
                  <div class="prev-dot" style="background:#f59e0b;width:6px;height:6px;"></div>
                  <div class="prev-dot" style="background:#10b981;width:6px;height:6px;"></div>
                  <span style="font-size:0.55rem;color:var(--text-muted);font-weight:700;margin-left:5px;">DentalOS — Dashboard</span>
                </div>
                <div class="dash-body-mini">
                  <div class="dash-sidebar-mini">
                    <div class="bar active"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                  </div>
                  <div class="dash-main-mini">
                    <div class="dash-stats-grid">
                      <div class="mini-stat-card">
                        <span class="mini-stat-title">Patient Queue</span>
                        <span class="mini-stat-value">12 / 15</span>
                      </div>
                      <div class="mini-stat-card">
                        <span class="mini-stat-title">Revenue (Daily)</span>
                        <span class="mini-stat-value">₹24,500</span>
                      </div>
                    </div>
                    <div class="dash-chart-mini">
                      <div class="chart-bars-wrap">
                        <div class="chart-bar-mini"></div>
                        <div class="chart-bar-mini"></div>
                        <div class="chart-bar-mini"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
        duration: 7000
      },
      {
        title: "Key Benefits",
        subtitle: "Manage patient records, prescriptions, automated reports, appointments, and billing in one secure place.",
        html: `
          <div class="sim-scene-content">
            <div class="benefits-dashboard-mockup">
              <div class="benefit-mockup-header">
                <div class="benefit-mockup-title">
                  <i class="fa-solid fa-tooth" style="color:var(--c-blue);"></i>
                  <span>Clinic Insights</span>
                </div>
                <div class="results-stars-float-wrap">
                  <i class="fa-solid fa-star"></i>
                  <i class="fa-solid fa-star"></i>
                  <i class="fa-solid fa-star"></i>
                </div>
              </div>
              <div class="benefit-mockup-body">
                <div class="benefit-card-widget active" id="ben-card-1" onclick="selectBenefitHotspot(0)">
                  <div class="benefit-hotspot-pulse"></div>
                  <div class="benefit-widget-icon"><i class="fa-solid fa-file-shield"></i></div>
                  <div class="benefit-widget-label">Paperwork -90%</div>
                  <div class="benefit-widget-val">90% faster flows</div>
                </div>
                <div class="benefit-card-widget" id="ben-card-2" onclick="selectBenefitHotspot(1)">
                  <div class="benefit-hotspot-pulse"></div>
                  <div class="benefit-widget-icon"><i class="fa-solid fa-user-shield"></i></div>
                  <div class="benefit-widget-label">Secure Records</div>
                  <div class="benefit-widget-val">100% HIPAA Safe</div>
                </div>
                <div class="benefit-card-widget" id="ben-card-3" onclick="selectBenefitHotspot(2)">
                  <div class="benefit-hotspot-pulse"></div>
                  <div class="benefit-widget-icon"><i class="fa-solid fa-chart-line"></i></div>
                  <div class="benefit-widget-label">Auto Reports</div>
                  <div class="benefit-widget-val">1-Click Stats</div>
                </div>
                <div class="benefit-card-widget" id="ben-card-4" onclick="selectBenefitHotspot(3)">
                  <div class="benefit-hotspot-pulse"></div>
                  <div class="benefit-widget-icon"><i class="fa-solid fa-receipt"></i></div>
                  <div class="benefit-widget-label">Billing Flow</div>
                  <div class="benefit-widget-val">Instant Invoices</div>
                </div>
              </div>
              
              <div class="benefit-tooltip-overlay" id="ben-tooltip">
                Reduce paperwork by up to 90% with integrated prescriptions & details.
              </div>
            </div>
          </div>
        `,
        duration: 11000
      },
      {
        title: "Results",
        subtitle: "Spend less time managing paperwork and more time caring for patients.",
        html: `
          <div class="sim-scene-content">
            <div class="scene-results-wrap">
              <div class="results-shield-panel">
                <div class="results-illustration-circle">
                  <i class="fa-solid fa-face-smile"></i>
                  <div class="success-ring-morph"></div>
                </div>
                <div class="results-text-block">
                  <span class="results-h3">Happy Staff, Satisfied Patients</span>
                  <span class="results-p">The clinic runs smoother. Treatment queues are organized, and reports generate automatically.</span>
                </div>
              </div>
              <div class="results-checkmarks-grid">
                <div class="result-check-pill"><i class="fa-solid fa-circle-check"></i> Paperwork -90%</div>
                <div class="result-check-pill"><i class="fa-solid fa-circle-check"></i> Faster Operations</div>
                <div class="result-check-pill"><i class="fa-solid fa-circle-check"></i> Smart Reminders</div>
                <div class="result-check-pill"><i class="fa-solid fa-circle-check"></i> 100% Productivity</div>
              </div>
            </div>
          </div>
        `,
        duration: 8000
      },
      {
        title: "Closing",
        subtitle: "Transform your dental practice with DentalOS. Faster. Smarter. Paperless.",
        html: `
          <div class="sim-scene-content">
            <div class="closing-cta-card">
              <div class="closing-logo-wrap">
                <i class="fa-solid fa-tooth"></i>
              </div>
              <span class="closing-cta-h3">Get DentalOS Today</span>
              <div class="closing-bullet-points">
                <div class="closing-bullet"><i class="fa-solid fa-circle-check"></i> Single License for Up to 25 Users</div>
                <div class="closing-bullet"><i class="fa-solid fa-circle-check"></i> Cloud Sync + Offline Capability</div>
                <div class="closing-bullet"><i class="fa-solid fa-circle-check"></i> Try Free for 14 Days</div>
              </div>
              <div class="closing-buttons">
                <a href="#pricing" class="btn-sim-cta primary"><i class="fa-solid fa-rocket"></i> Get Started Free</a>
                <a href="#pricing" class="btn-sim-cta outline"><i class="fa-solid fa-calendar"></i> Book Demo</a>
              </div>
            </div>
          </div>
        `,
        duration: 8000
      }
    ];

    let currentScene = 0;
    let isPlaying = false;
    let isNarratorUnmuted = false;
    let sceneTimer = null;
    let progressInterval = null;
    let currentProgress = 0;
    let benefitInterval = null;

    const viewport = document.getElementById("sim-viewport");
    const subtitle = document.getElementById("sim-subtitle");
    const waveform = document.getElementById("sim-waveform");
    const playBtn = document.getElementById("sim-play-btn");
    const prevBtn = document.getElementById("sim-prev-btn");
    const nextBtn = document.getElementById("sim-next-btn");
    const progressBar = document.getElementById("sim-progress-bar");
    const voiceToggleBtn = document.getElementById("narrator-voice-toggle");
    const stepBtns = document.querySelectorAll(".sim-step-btn");

    if (!viewport || !subtitle) return; // safety check

    // Setup global benefit click function
    const benefitsHotspots = [
      "Reduce paperwork by up to 90% with integrated prescriptions & details.",
      "Manage all patient records securely in one place, instantly accessible.",
      "Generate accurate reports and analytics in seconds with a single click.",
      "Billing and treatments flow smoothly, increasing clinic productivity."
    ];

    window.selectBenefitHotspot = function (idx) {
      const cards = document.querySelectorAll(".benefit-card-widget");
      const tooltip = document.getElementById("ben-tooltip");
      if (!cards || !tooltip) return;

      cards.forEach(c => c.classList.remove("active"));
      const activeCard = document.getElementById(`ben-card-${idx + 1}`);
      if (activeCard) activeCard.classList.add("active");

      tooltip.innerText = benefitsHotspots[idx];
      tooltip.className = "benefit-tooltip-overlay";
      if (idx === 1) tooltip.classList.add("color-cyan");
      else if (idx === 2) tooltip.classList.add("color-green");
      else if (idx === 3) tooltip.classList.add("color-violet");
    };

    function speakText(text) {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel(); // cancel any active speech first
      if (!isNarratorUnmuted) return;

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Attempt to pick a smooth English voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith("en-") && (v.name.includes("US") || v.name.includes("Google") || v.name.includes("Natural")));
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.rate = 0.95; // comfortable rate
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }

    function stopSpeaking() {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }

    function loadScene(index) {
      // Clean up previous scene resources
      clearTimeout(sceneTimer);
      clearInterval(progressInterval);
      clearInterval(benefitInterval);
      stopSpeaking();

      currentScene = index;
      const scene = scenes[index];

      // Update Navigation step classes
      stepBtns.forEach((btn, idx) => {
        if (idx === index) {
          btn.classList.add("active");
          btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        } else {
          btn.classList.remove("active");
        }
      });

      // Update Content
      subtitle.innerText = scene.subtitle;
      viewport.innerHTML = scene.html;

      // Reset visual progress
      currentProgress = 0;
      progressBar.style.width = "0%";

      // Scene-specific script triggers
      if (index === 1) {
        // Challenges Checklist sequential reveal
        setTimeout(() => document.getElementById("ch-1")?.classList.add("reveal"), 500);
        setTimeout(() => document.getElementById("ch-2")?.classList.add("reveal"), 1500);
        setTimeout(() => document.getElementById("ch-3")?.classList.add("reveal"), 2500);
        setTimeout(() => document.getElementById("ch-4")?.classList.add("reveal"), 3500);
      } else if (index === 3) {
        // Benefits Auto-Highlight cycling
        let benefitCycleIdx = 0;
        benefitInterval = setInterval(() => {
          benefitCycleIdx = (benefitCycleIdx + 1) % 4;
          window.selectBenefitHotspot(benefitCycleIdx);
        }, 2500);
      }

      // Handle Narration Voice Speech
      if (isNarratorUnmuted) {
        speakText(scene.subtitle);
        waveform.classList.add("playing");
      } else {
        waveform.classList.remove("playing");
      }

      // If playing, set timer to auto-advance
      if (isPlaying) {
        let stepCount = 0;
        const totalSteps = 100;
        const stepTime = scene.duration / totalSteps;

        progressInterval = setInterval(() => {
          stepCount++;
          currentProgress = stepCount;
          progressBar.style.width = currentProgress + "%";
          if (stepCount >= totalSteps) {
            clearInterval(progressInterval);
            advanceScene();
          }
        }, stepTime);
      } else {
        progressBar.style.width = "0%";
      }
    }

    function advanceScene() {
      const nextIdx = (currentScene + 1) % scenes.length;
      loadScene(nextIdx);
    }

    function retreatScene() {
      const prevIdx = (currentScene - 1 + scenes.length) % scenes.length;
      loadScene(prevIdx);
    }

    function togglePlayState() {
      isPlaying = !isPlaying;
      if (isPlaying) {
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        playBtn.setAttribute("aria-label", "Pause Story");
        if (isNarratorUnmuted) {
          waveform.classList.add("playing");
        }
        loadScene(currentScene); // refresh timers with play active
      } else {
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        playBtn.setAttribute("aria-label", "Play Story");
        waveform.classList.remove("playing");
        stopSpeaking();
        clearInterval(progressInterval);
        clearTimeout(sceneTimer);
      }
    }

    // Event Listeners
    playBtn.addEventListener("click", togglePlayState);
    prevBtn.addEventListener("click", () => {
      isPlaying = false; // stop auto play on manual action
      playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      waveform.classList.remove("playing");
      retreatScene();
    });
    nextBtn.addEventListener("click", () => {
      isPlaying = false;
      playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      waveform.classList.remove("playing");
      advanceScene();
    });

    voiceToggleBtn.addEventListener("click", () => {
      isNarratorUnmuted = !isNarratorUnmuted;
      const icon = voiceToggleBtn.querySelector("i");
      const label = voiceToggleBtn.querySelector(".voice-label");

      if (isNarratorUnmuted) {
        voiceToggleBtn.classList.add("active");
        icon.className = "fa-solid fa-volume-high";
        label.innerText = "Voice: On";
        // Speak current scene immediately
        speakText(scenes[currentScene].subtitle);
        waveform.classList.add("playing");
      } else {
        voiceToggleBtn.classList.remove("active");
        icon.className = "fa-solid fa-volume-xmark";
        label.innerText = "Unmute Voice";
        stopSpeaking();
        waveform.classList.remove("playing");
      }
    });

    stepBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        isPlaying = false;
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        waveform.classList.remove("playing");
        const targetIdx = parseInt(btn.getAttribute("data-scene"));
        loadScene(targetIdx);
      });
    });

    // Ensure voices are fully loaded in browser (chrome voice list async loading check)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        // Just triggers reloading voices internally so speakText picks them up correctly
      };
    }

    // Initialize first scene
    loadScene(0);
  })();

  // ─── Ultra-Premium Cinematic Splash Intro Controller ───
  (function () {
    const splashEl      = document.getElementById('startup-intro-splash');
    if (!splashEl) return;

    const skipBtn       = document.getElementById('splash-skip-btn');
    const replayBtn     = document.getElementById('btn-see-how-works');
    const progressBarEl = document.getElementById('sp-progress-bar');
    const particlesEl   = document.getElementById('sp-particles');

    const TOTAL_MS      = 15000;                            // 15-second timeline
    const SCENE_TIMES   = [0, 3000, 6000, 10000, 13000];   // when each scene enters
    const TOTAL_SCENES  = 5;

    let timers      = [];
    let pRaf        = null;
    let pStart      = null;

    // ── 60-particle floating field ──
    function buildParticles() {
      if (!particlesEl) return;
      particlesEl.innerHTML = '';
      const palette = [
        'rgba(56,189,248,0.65)', 'rgba(14,165,233,0.55)', 'rgba(52,211,153,0.45)',
        'rgba(167,139,250,0.45)', 'rgba(251,191,36,0.35)', 'rgba(255,255,255,0.38)'
      ];
      for (let i = 0; i < 60; i++) {
        const el   = document.createElement('div');
        el.className = 'sp-particle';
        const col  = palette[Math.floor(Math.random() * palette.length)];
        const sz   = 2 + Math.random() * 3.5;
        const dur  = 10 + Math.random() * 15;
        const dly  = -(Math.random() * dur);
        const drft = (Math.random() - 0.5) * 140;
        const op   = 0.3 + Math.random() * 0.5;
        el.style.cssText = `left:${(Math.random()*100).toFixed(1)}%;bottom:0;width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;--p-color:${col};--p-glow:${(sz*2.2).toFixed(0)}px;--p-dur:${dur.toFixed(1)}s;--p-delay:${dly.toFixed(2)}s;--p-drift:${drft.toFixed(1)}px;--p-opacity:${op.toFixed(2)};`;
        particlesEl.appendChild(el);
      }
    }

    // ── Activate a scene (by ID) ──
    function setScene(n) {
      for (let i = 1; i <= TOTAL_SCENES; i++) {
        const el = document.getElementById(`sp-scene-${i}`);
        if (el) el.classList.toggle('active', i === n);
      }
      if (n === 4) {
        animCounter('sp-kpi-1', 0, 90, 1800);
        animCounter('sp-kpi-2', 0, 3,  1400);
      }
    }

    // ── Activate text block ──
    function setText(n) {
      document.querySelectorAll('.sp-text-block').forEach((el, idx) => {
        el.classList.toggle('sp-tb-active', idx + 1 === n);
      });
    }

    // ── easeOutQuad counter ──
    function animCounter(id, from, to, ms) {
      const el = document.getElementById(id);
      if (!el) return;
      let t0 = null;
      (function tick(ts) {
        if (!t0) t0 = ts;
        const p = Math.min((ts - t0) / ms, 1);
        el.innerText = Math.round(from + (p * (2 - p)) * (to - from));
        if (p < 1) requestAnimationFrame(tick);
      })(performance.now());
    }

    // ── RAF progress bar ──
    function startProgress() {
      pStart = null;
      if (pRaf) cancelAnimationFrame(pRaf);
      (function tick(ts) {
        if (!pStart) pStart = ts;
        const pct = Math.min(((ts - pStart) / TOTAL_MS) * 100, 100);
        if (progressBarEl) progressBarEl.style.width = pct + '%';
        if (pct < 100) pRaf = requestAnimationFrame(tick);
      })(performance.now());
    }

    // ── Clear all pending tasks ──
    function clearAll() {
      timers.forEach(clearTimeout);
      timers = [];
      if (pRaf) { cancelAnimationFrame(pRaf); pRaf = null; }
    }

    // ── Main 15s cinematic timeline ──
    function startSplash() {
      clearAll();

      splashEl.style.display    = '';
      splashEl.style.opacity    = '';
      splashEl.style.transform  = '';
      splashEl.style.transition = '';
      splashEl.style.visibility = '';
      splashEl.classList.remove('sp-fade-out');
      document.body.classList.add('scroll-locked');

      buildParticles();
      if (progressBarEl) progressBarEl.style.width = '0%';

      setScene(1);
      setText(1);

      // Queue scene transitions
      for (let i = 1; i < TOTAL_SCENES; i++) {
        const n   = i + 1;
        const ms  = SCENE_TIMES[i];
        timers.push(setTimeout(() => { setScene(n); setText(n); }, ms));
      }
      // Auto-end
      timers.push(setTimeout(() => endSplash(false), TOTAL_MS));

      startProgress();
    }

    // ── Fade out & unlock ──
    function endSplash(immediate) {
      clearAll();
      sessionStorage.setItem('splashPlayed', 'true');
      document.body.classList.remove('scroll-locked');

      if (immediate) {
        splashEl.style.transition = 'none';
        splashEl.classList.add('sp-fade-out');
        setTimeout(() => { splashEl.style.display = 'none'; }, 80);
      } else {
        splashEl.classList.add('sp-fade-out');
        timers.push(setTimeout(() => { splashEl.style.display = 'none'; }, 1050));
      }
    }

    // ── Boot sequence ──
    if (sessionStorage.getItem('splashPlayed') === 'true') {
      endSplash(true);
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startSplash);
    } else {
      startSplash();
    }

    // ── Controls ──
    if (skipBtn)   skipBtn.addEventListener('click', () => endSplash(false));
    if (replayBtn) replayBtn.addEventListener('click', e => {
      e.preventDefault();
      sessionStorage.removeItem('splashPlayed');
      startSplash();
    });
  })();