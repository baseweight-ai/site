(function () {
  const CAL = 'https://cal.com/philip-stevens/baseweight-intro';
  const LINKS = [
    { href: '/', label: 'Home' },
    { href: '/benchmark', label: 'Benchmark' },
    { href: '/diagnostic', label: 'Diagnostic' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ];

  function renderNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    const path = window.location.pathname;
    const items = LINKS.map(({ href, label }) => {
      const active = path === href || (href !== '/' && path.startsWith(href + '/'));
      return `<li><a href="${href}"${active ? ' aria-current="page"' : ''}>${label}</a></li>`;
    }).join('\n      ');

    nav.innerHTML = `
  <div class="nav-inner">
    <a href="/" class="nav-logo"><img src="/images/logo.png" alt="Baseweight" width="169" height="36" loading="eager"></a>
    <ul class="nav-links" id="navLinks">
      ${items}
      <li><a href="${CAL}" target="_blank" rel="noopener noreferrer" class="nav-cta">Book a free call</a></li>
    </ul>
    <button class="nav-mobile-toggle" id="navToggle" aria-label="Toggle menu">
      <span></span><span></span><span></span>
    </button>
  </div>`;

    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });

    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      toggle.classList.toggle('open');
    });
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.classList.remove('open');
      });
    });
  }

  function renderFooter() {
    const footer = document.querySelector('footer');
    if (!footer) return;
    footer.innerHTML = `
  <div class="container">
    <p>&copy; 2026 Baseweight. &nbsp;&middot;&nbsp; <a href="/about">About</a> &nbsp;&middot;&nbsp; <a href="/contact">Contact</a> &nbsp;&middot;&nbsp; <a href="/privacy" rel="privacy-policy">Privacy Policy</a></p>
    <p itemscope itemtype="https://schema.org/WebPage">By <span itemprop="author" itemscope itemtype="https://schema.org/Person"><a href="/about" rel="author" itemprop="url"><span itemprop="name">Philip Stevens</span></a></span> &nbsp;&middot;&nbsp; Updated <time itemprop="datePublished" datetime="2026-05-01">May 2026</time></p>
  </div>`;
  }

  renderNav();
  renderFooter();
})();
