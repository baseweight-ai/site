// Results for /retrieval-service: the snapshot's metric rows
// (INTEGRATION-BRIEF.md), one table row each, split into a gated and an
// advisory table by each row's own `gated` field. Every figure is the
// snapshot's own, unrounded, inserted as text, and shown only beside its n and
// interval. With no snapshot it renders the pending state. Each table's
// caption says in plain words what its category means, so the tables need no
// legend; the page's notes define the two categories.
(function () {
  const CATEGORIES = [
    { gated: true, kind: 'gated', caption: 'A change that makes these worse is blocked' },
    { gated: false, kind: 'advisory', caption: 'A change that makes these worse can still go ahead' },
  ];
  const LABELS = ['Metric', 'Setup', 'Question set', 'Subset'];
  // What a visitor needs to read the figures.
  const READING = 'Each score shows n, the number of questions behind it, and a CI, the range the true score likely sits in.';

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  // A figure missing where one is due stops the render, so an estimate never
  // shows without its n and interval.
  function figure(v) {
    if (!Number.isFinite(v)) throw new Error(`results snapshot: expected a number, got ${v}`);
    return String(v);
  }
  const interval = (low, high) => `${figure(low)} to ${figure(high)}`;

  // The file's top-level `confidence_level`, a fraction, heads the interval
  // columns as a percent: 0.95 reads "95% CI". Without one they read "CI", and
  // any value that is not a number between 0 and 1 refuses the file.
  function ciLabel(level) {
    if (level === undefined) return 'CI';
    if (typeof level !== 'number' || !(level > 0 && level < 1))
      throw new Error(`results snapshot: confidence_level must be a number between 0 and 1, got ${level}`);
    return `${percent(level)}% CI`;
  }

  // The level's own digits with the point moved two places right. Multiplying
  // by a hundred adds float noise: 0.954 becomes 95.39999999999999.
  function percent(level) {
    const [mantissa, exponent] = level.toExponential().split('e');
    const digits = mantissa.replace('.', '');
    // Digits before the point once in percent: the exponent, plus two, plus one.
    const whole = Number(exponent) + 3;
    if (whole <= 0) return `0.${'0'.repeat(-whole)}${digits}`;
    const int = digits.slice(0, whole).padEnd(whole, '0');
    const frac = digits.slice(whole);
    return frac ? `${int}.${frac}` : int;
  }

  function row(m, span) {
    const tr = el('tr');
    const name = el('th', m.name);
    name.scope = 'row';
    tr.append(name, ...[m.config, m.tier, m.slice].map(v => el('td', v)));
    // A null value is a metric the run did not measure: no figure, n or interval.
    if (m.value === null) {
      const note = el('td', 'Not measured');
      note.colSpan = span;
      tr.append(note);
      return tr;
    }
    const delta = m.delta_vs_baseline != null;
    tr.append(...[
      figure(m.n),
      figure(m.value),
      interval(m.ci_low, m.ci_high),
      delta ? figure(m.delta_vs_baseline) : '',
      delta ? interval(m.delta_ci_low, m.delta_ci_high) : '',
    ].map(v => el('td', v)));
    return tr;
  }

  // The caption names the table, so the category is in its accessible name.
  function table({ kind, caption }, rows, ci) {
    const figures = ['n', 'Score', ci, 'Change from baseline', `Change ${ci}`];
    const head = el('tr');
    [...LABELS, ...figures].forEach(label => {
      const th = el('th', label);
      th.scope = 'col';
      head.append(th);
    });
    const thead = el('thead');
    thead.append(head);
    const tbody = el('tbody');
    tbody.append(...rows.map(m => row(m, figures.length)));
    const t = el('table', null, kind);
    t.append(el('caption', caption), thead, tbody);
    const wrap = el('div', null, 'table-wrap');
    wrap.append(t);
    return wrap;
  }

  // `snapshot` is the results document already held to the schema, or null
  // when none is committed. The mount changes only once everything is built,
  // so a render that stops leaves it as it was.
  window.renderResults = function (mount, snapshot) {
    if (!snapshot) {
      mount.replaceChildren(el('p', 'Measurement pending.', 'state-note'));
      return;
    }
    const ci = ciLabel(snapshot.confidence_level);
    // Only `true` gates, so every row lands in exactly one table.
    const tables = CATEGORIES
      .map(c => [c, snapshot.metrics.filter(m => (m.gated === true) === c.gated)])
      .filter(([, rows]) => rows.length)
      .map(([c, rows]) => table(c, rows, ci));
    mount.replaceChildren(...tables, el('p', READING, 'table-note'));
  };
})();
