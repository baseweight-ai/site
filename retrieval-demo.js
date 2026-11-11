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
  // Before the box, so a question about this week's news is not mistaken for a
  // fault. The page's notes state the corpus in full.
  const CORPUS = 'Wikipedia, nothing recent.';
  // For the page's notes, beside the two the page holds. privacy.html, linked
  // from the footer, names the providers.
  const LIMITS_FULL = 'Read-only. Comparisons are rate-limited, and the demo has a daily budget.';
  const PRIVACY_FULL = 'Your question and IP address go to our service, which passes the question to its providers.';
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

  // A snippet past the page's clamp shows that many lines, and a button opens
  // the rest. The cut is styling alone: the node holds the whole snippet. Whether
  // it overflows depends on the column's width, and a closed citation has no
  // layout to measure, so the check runs whenever the snippet's box changes.
  function passage(id, text) {
    const snippet = el('p', text, 'demo-snippet demo-clamped');
    snippet.id = id;
    const more = el('button', 'Show the rest', 'demo-more');
    more.type = 'button';
    more.hidden = true;
    more.setAttribute('aria-controls', id);
    more.setAttribute('aria-expanded', 'false');
    more.addEventListener('click', () => {
      const clamped = snippet.classList.toggle('demo-clamped');
      more.textContent = clamped ? 'Show the rest' : 'Show less';
      more.setAttribute('aria-expanded', String(!clamped));
    });
    // Zoom can round scrollHeight a pixel past clientHeight; a hidden line is far more.
    new ResizeObserver(() => {
      if (snippet.classList.contains('demo-clamped')) more.hidden = snippet.scrollHeight <= snippet.clientHeight + 1;
    }).observe(snippet);
    return [snippet, more];
  }

  // Closed until its marker or its summary opens it.
  function citation(rung, c) {
    const panel = el('details', null, 'demo-cite');
    panel.id = `demo-${rung}-${c.marker}`;
    const summary = el('summary', `[${c.marker}] ${c.page_title} · `);
    summary.append(el('span', c.supported ? 'supported' : 'unsupported', 'demo-support'));
    panel.append(summary, ...passage(`${panel.id}-snippet`, c.snippet), article(c.url, c.page_title));
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

  function column(...content) {
    const col = el('section', null, 'demo-rung');
    col.append(...content);
    return col;
  }

  // Each title once, in the order it first ranked, with the number of passages
  // retrieved from it.
  function passages(titles) {
    const wrap = el('div', null, 'demo-passages');
    wrap.append(el('h3', 'Passages retrieved'));
    const counts = new Map();
    titles.forEach(title => counts.set(title, (counts.get(title) || 0) + 1));
    const list = el('ol');
    counts.forEach((count, title) => {
      const row = el('li', `${title} `);
      row.append(el('span', `×${count}`, 'demo-count'));
      list.append(row);
    });
    wrap.append(list);
    return wrap;
  }

  // What a column keeps out of the reading path: the rung's technical name, its
  // label's whole sentence, and the service's ranking, repeats included, which
  // the counts leave out.
  function method(rung) {
    const panel = el('details', null, 'demo-method');
    panel.append(el('summary', 'How this works'), el('p', `Technical name: ${rung.name}`, 'demo-name'), el('p', rung.label));
    if (rung.passage_titles.length) {
      const ranked = el('ol');
      rung.passage_titles.forEach(title => ranked.append(el('li', title)));
      panel.append(el('h3', 'Passages by rank'), ranked);
    } else {
      panel.append(el('p', 'No passages retrieved.'));
    }
    return panel;
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
  // answer would, beside the rungs that answered. The service writes a label as
  // "what it does: how", and the first part heads the column. Latency is a live
  // reading that varies by seconds, so one decimal states all it can support.
  function answered(rung) {
    return column(
      el('h2', rung.label.split(':')[0]),
      ...(rung.error ? [el('p', `Failed: ${rung.error.message}`, 'demo-error')] : cited(rung)),
      ...(rung.passage_titles.length ? [passages(rung.passage_titles)] : []),
      el('p', `Latency ${(rung.latency_ms / 1000).toFixed(1)} s`, 'demo-latency'),
      method(rung));
  }

  // `attribution` is the page's licence notice, replaced by the live one.
  // `notes` is the page's place for what the demo leaves out of its reading
  // path: each note in full, a copy of the attribution and the service's ids.
  window.mountDemo = function (mount, attribution, notes) {
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
    const controls = el('div', null, 'demo-ask');
    controls.append(label, row, list);
    const status = el('p', null, 'demo-status');
    status.setAttribute('role', 'status');
    const timer = el('span');
    timer.setAttribute('role', 'timer');
    const elapsed = el('p', 'Elapsed ', 'demo-elapsed');
    elapsed.append(timer);
    elapsed.hidden = true;
    const rungs = el('div', null, 'demo-rungs');
    mount.replaceChildren(el('p', CORPUS, 'demo-corpus'), controls, status, elapsed, rungs);

    // The attribution speaks of the passages on screen, so the page's <style>
    // shows it while the section is demo-has-passages. The notes keep a copy.
    const section = mount.parentElement;
    const service = el('dl', null, 'demo-service');
    service.hidden = true;
    const fullAttribution = attribution.cloneNode(true);
    fullAttribution.removeAttribute('id');
    notes.append(el('p', LIMITS_FULL), el('p', PRIVACY_FULL), fullAttribution, service);

    // GET /v1/meta once; a failure lets the next attempt ask again.
    let ready = null;
    function prepare() {
      if (!ready) {
        ready = call('/v1/meta').then(({ res, body }) => {
          // public_mode is the constant "read_only" in the contract, which LABEL states.
          if (!res.ok || body?.public_mode !== 'read_only' || !isText(body.attribution))
            throw new Error('GET /v1/meta answered outside its contract');
          if (body.attribution !== attribution.textContent) {
            attribution.textContent = body.attribution;
            fullAttribution.textContent = body.attribution;
          }
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
      // The labels come with the answers, so nothing heads a column until then.
      rungs.replaceChildren(...RUNGS.map(() => column(el('p', 'Outstanding', 'demo-pending'))));
      section.classList.remove('demo-has-passages');
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
        // A passage shows as a retrieved title, a failed rung's included, or as a citation.
        if (result && rungs.querySelector('.demo-passages, .demo-cite')) section.classList.add('demo-has-passages');
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
