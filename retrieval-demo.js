// The demo for /retrieval-service: one question to POST /v1/compare, answered
// by every rung side by side (INTEGRATION-BRIEF.md §5, ADR-0001). Nothing
// reaches the service until the question box or a prepared question takes
// focus, and a question goes only once GET /v1/meta has answered, so the live
// attribution is in place before any rung output. Model output enters the page
// as text; a citation's link is built from its url alone.
(function () {
  const API = 'https://baseweight-service.fly.dev';
  // Rung.name in the deployed openapi.json, in the order the service answers
  // (brief §3). A comparison comes back whole, so every rung is outstanding
  // until it does.
  const RUNGS = ['closed_book', 'bm25', 'hybrid', 'full'];
  // Picked from live comparisons on 2026-11-01, each for a different outcome.
  const QUESTIONS = [
    'Which piece did Ludwig van Beethoven publish in 1801 that was dedicated to Count Moritz von Fries?',
    "Who translated Beethoven's letters into English?",
    'Which branch of economics studies an economy as a whole?',
    'Who won the 2022 FIFA World Cup?',
  ];
  const LABEL = 'Read-only. Comparisons are rate-limited, and the demo has a daily budget.';
  // Under the box, what leaves the browser; privacy.html names the providers.
  const PRIVACY = 'Your question and IP address go to our service, which passes the question to its providers.';
  const MARKER = /\[(c\d+)\]/g;
  // A cold start alone took 15 to 19 s (brief §3); this bounds a request the
  // service never answers.
  const TIMEOUT_MS = 120000;
  const UNAVAILABLE = 'The service is unavailable. Try again later.';
  // Error.code in the deployed openapi.json.
  const CODES = ['rate_limited', 'budget_exhausted', 'invalid_request', 'upstream_error', 'internal'];
  // The two budget_exhausted bodies differ only in message (brief §3).
  const BUDGET = {
    "the service's daily spend cap is reached": 'The daily demo budget is spent.',
    "the model provider's spend limit is reached": "The model provider's spend limit is reached.",
  };

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  const isText = v => typeof v === 'string';

  // Resolves to the response and its body, null when the body is not JSON.
  // Rejects when the service cannot be reached: a network error, a CORS
  // refusal, or no answer within TIMEOUT_MS.
  async function call(path, init) {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API + path, { ...init, signal: abort.signal });
      const body = await res.json().catch(() => null);
      return { res, body };
    } finally {
      clearTimeout(timeout);
    }
  }

  // Checks only what this component renders.
  function readable(result) {
    return Array.isArray(result?.rungs) && result.rungs.every(r =>
      isText(r.name) && isText(r.label) && Number.isInteger(r.latency_ms) &&
      Array.isArray(r.passage_titles) && r.passage_titles.every(isText) &&
      (r.error ? isText(r.error.message) : isText(r.answer) && Array.isArray(r.citations) &&
        r.citations.every(c => [c.marker, c.page_title, c.url, c.snippet].every(isText) &&
          typeof c.supported === 'boolean')));
  }

  // Retry-After in whole seconds (deployed openapi.json), shown exactly.
  function rateLimited(header) {
    if (!/^\d+$/.test(header || '')) return 'The demo is rate-limited. Try again later.';
    const s = Number(header);
    const wait = s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
    return `The demo is rate-limited. Try again in ${wait}.`;
  }

  // What a comparison's response leaves on the page: its result, or one note.
  // Anything outside the result's shape or the error envelope is unavailable.
  function outcome(res, body) {
    if (res.ok) return readable(body) ? { result: body } : { note: UNAVAILABLE };
    const error = body?.error;
    if (!error || !CODES.includes(error.code) || !isText(error.message)) return { note: UNAVAILABLE };
    if (error.code === 'rate_limited') return { note: rateLimited(res.headers.get('Retry-After')) };
    if (error.code === 'budget_exhausted') return { note: BUDGET[error.message] || "The demo's budget is spent." };
    if (error.code === 'invalid_request') return { note: 'The service refused that question.' };
    return { note: 'The service failed on that question. Try again.' };
  }

  // The service builds every citation's url as an https link to English
  // Wikipedia; any other url shows as the title alone.
  function article(url, title) {
    let host = null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') host = parsed.hostname;
    } catch (e) {}
    if (host !== 'en.wikipedia.org') return el('span', title);
    const link = el('a', title);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  // Closed until its marker or its summary opens it.
  function citation(rung, c) {
    const panel = el('details', null, 'demo-cite');
    panel.id = `demo-${rung}-${c.marker}`;
    const summary = el('summary', `[${c.marker}] ${c.page_title} · `);
    summary.append(el('span', c.supported ? 'supported' : 'unsupported', 'demo-support'));
    panel.append(summary, el('p', c.snippet, 'demo-snippet'), article(c.url, c.page_title));
    return panel;
  }

  // The answer as text, with each [cN] that names one of the rung's citations
  // made the button that opens it. Any other marker stays text.
  function answer(text, panels) {
    const p = el('p', null, 'demo-answer');
    let at = 0;
    for (const m of text.matchAll(MARKER)) {
      const panel = panels.get(m[1]);
      if (!panel) continue;
      p.append(text.slice(at, m.index));
      const open = el('button', m[0], 'demo-marker');
      open.type = 'button';
      open.setAttribute('aria-controls', panel.id);
      open.addEventListener('click', () => {
        panel.open = true;
        panel.querySelector('summary').focus();
      });
      p.append(open);
      at = m.index + m[0].length;
    }
    p.append(text.slice(at));
    return p;
  }

  function column(name, ...content) {
    const col = el('section', null, 'demo-rung');
    col.append(el('h2', name), ...content);
    return col;
  }

  // Every title the rung retrieved, in its order, repeats included.
  function passages(titles) {
    const wrap = el('div', null, 'demo-passages');
    wrap.append(el('h3', 'Passages retrieved'));
    if (!titles.length) {
      wrap.append(el('p', 'None'));
      return wrap;
    }
    const list = el('ol');
    titles.forEach(title => list.append(el('li', title)));
    wrap.append(list);
    return wrap;
  }

  // The answer and the citations it opens.
  function cited(rung) {
    const panels = new Map(rung.citations.map(c => [c.marker, citation(rung.name, c)]));
    const cites = el('ol', null, 'demo-cites');
    panels.forEach(panel => {
      const item = el('li');
      item.append(panel);
      cites.append(item);
    });
    return [answer(rung.answer, panels), ...(panels.size ? [cites] : [])];
  }

  // A rung whose `error` is set failed alone: its message shows where its
  // answer would, beside the rungs that answered.
  function answered(rung) {
    return column(rung.name,
      el('p', rung.label, 'demo-rung-label'),
      ...(rung.error ? [el('p', `Failed: ${rung.error.message}`, 'demo-error')] : cited(rung)),
      passages(rung.passage_titles),
      el('p', `Latency ${rung.latency_ms} ms`, 'demo-latency'));
  }

  // `attribution` is the page's licence notice, replaced by the live one.
  window.mountDemo = function (mount, attribution) {
    const box = el('input');
    box.id = 'demoQuestion';
    box.type = 'text';
    box.maxLength = 2000;
    box.autocomplete = 'off';
    const label = el('label', 'Question');
    label.htmlFor = box.id;
    const go = el('button', 'Compare', 'demo-go');
    go.type = 'button';
    const row = el('div', null, 'demo-row');
    row.append(box, go);
    const list = el('ul', null, 'demo-prepared');
    list.setAttribute('aria-label', 'Prepared questions');
    const asks = QUESTIONS.map(q => {
      const ask = el('button', q);
      ask.type = 'button';
      ask.addEventListener('click', () => {
        if (busy) return;
        box.value = q;
        send(q);
      });
      const item = el('li');
      item.append(ask);
      list.append(item);
      return ask;
    });
    const privacy = el('p', `${PRIVACY} `);
    const policy = el('a', 'Privacy policy');
    policy.href = '/privacy';
    privacy.append(policy);
    const controls = el('div', null, 'demo-ask');
    controls.append(label, row, privacy, list);
    const service = el('dl', null, 'demo-service');
    service.hidden = true;
    const status = el('p', null, 'demo-status');
    status.setAttribute('role', 'status');
    const timer = el('span');
    timer.setAttribute('role', 'timer');
    const elapsed = el('p', 'Elapsed ', 'demo-elapsed');
    elapsed.append(timer);
    elapsed.hidden = true;
    const rungs = el('div', null, 'demo-rungs');
    mount.replaceChildren(el('p', LABEL, 'demo-limits'), controls, service, status, elapsed, rungs);

    // GET /v1/meta once; a failure lets the next attempt ask again.
    let ready = null;
    function prepare() {
      if (!ready) {
        ready = call('/v1/meta').then(({ res, body }) => {
          // public_mode is the constant "read_only" in the contract, which LABEL states.
          if (!res.ok || body?.public_mode !== 'read_only' || !isText(body.attribution))
            throw new Error('GET /v1/meta answered outside its contract');
          if (body.attribution !== attribution.textContent) attribution.textContent = body.attribution;
        });
        ready.catch(() => { ready = null; });
        // The service line is extra: without it the comparison still goes.
        call('/v1/health').then(({ res, body }) => {
          if (!res.ok || !isText(body?.git_sha) || !isText(body.index_version)) return;
          service.replaceChildren(
            el('dt', 'Deployed commit'), el('dd', body.git_sha),
            el('dt', 'Index version'), el('dd', body.index_version));
          service.hidden = false;
        }, () => {});
      }
      return ready;
    }
    controls.addEventListener('focusin', prepare);

    let busy = false;
    async function send(text) {
      const query = text.trim();
      if (busy || !query) return;
      busy = true;
      [go, ...asks].forEach(b => b.setAttribute('aria-disabled', 'true'));
      box.readOnly = true;
      const started = Date.now();
      const tick = () => { timer.textContent = `${Math.floor((Date.now() - started) / 1000)} s`; };
      tick();
      elapsed.hidden = false;
      const clock = setInterval(tick, 1000);
      status.textContent = 'Waiting for the service.';
      rungs.replaceChildren(...RUNGS.map(name => column(name, el('p', 'Outstanding', 'demo-pending'))));
      try {
        await prepare();
        const { res, body } = await call('/v1/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        const { result, note } = outcome(res, body);
        rungs.replaceChildren(...(result ? result.rungs.map(answered) : []));
        status.textContent = result ? 'Comparison returned.' : note;
      } catch (e) {
        rungs.replaceChildren();
        status.textContent = UNAVAILABLE;
      } finally {
        clearInterval(clock);
        tick();
        busy = false;
        [go, ...asks].forEach(b => b.removeAttribute('aria-disabled'));
        box.readOnly = false;
      }
    }
    go.addEventListener('click', () => send(box.value));
    box.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        send(box.value);
      }
    });
  };
})();
