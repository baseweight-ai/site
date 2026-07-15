/**
 * Baseweight lead capture + auto-reply (Apps Script web app).
 *
 * Reference copy. NOT part of the Vercel build (see ../.vercelignore). The live
 * version is pasted/deployed by hand in the Google Apps Script console, bound to
 * the spreadsheet that stores leads. See README.md for deploy steps.
 *
 * Two POST sources from the site, both gated by the shared formkey. The posted
 * field names and values (`source=fit-score`, `verdict`, `q1_task`, `answers`,
 * `notify`, `ua`, `k`) are a contract with the site (CLAUDE.md, lead capture);
 * the fit check page moved to /scope but keeps posting `source=fit-score`.
 *   source = "fit-score"  -> fit check quiz, scope.html (email, verdict, q1_task, answers, notify)
 *   source = "about-page" -> head-to-head opt-in, about.html (email)
 */
const CONFIG = {
  SHEET_NAME: "Baseweight Leads",
  SECRET_KEY: "formkey_QidffT6hpBTjEE38dkn2pbCvfCmebUJn", // must equal the site's hidden `k`
  MIN_SECONDS_BETWEEN_SAME_EMAIL: 60,

  FROM_NAME: "Philip Stevens",
  REPLY_TO:  "phil@baseweight.co",   // reply-to on auto-replies
  NOTIFY_TO: "phil@baseweight.co",   // where YOU get pinged on a new lead
  CAL_URL:   "https://cal.com/baseweight/intro",
  SITE_URL:  "https://baseweight.co",
  HEAD_TO_HEAD_URL: "https://baseweight.co/head-to-head",
  BRAND: "Baseweight"
};

// Fit check result copy, kept consistent with scope.html. Keys are the posted
// `verdict` values (server contract). "no" (keep your API) never posts: the
// capture form is hidden for it on the site.
const RESULTS = {
  candidate: {
    label: "Start with the head-to-head",
    line: "Your task has a reliable way to tell right from wrong, so the Build can open on the head-to-head directly: a specialist model against your current option, on a sample of your data, with a pass mark agreed up front.",
    next: function (c) { return "Book a 20-minute call and I'll walk you through what your Build would take: " + c.CAL_URL; }
  },
  notyet: {
    label: "First, capture labelled examples",
    line: "Your task is measurable; the labelled data isn't there yet. You need: a few hundred real examples, the correct result recorded for each, and a repeatable way to capture more. Start now, a spreadsheet is fine; at a few hundred, the head-to-head can run.",
    next: function (c) { return "Not sure how to start? Book a quick call and I'll help you set it up: " + c.CAL_URL; }
  },
  notmeasurable: {
    label: "First, agree how you'd judge it",
    line: "A specialist model is measured against your definition of right, and that doesn't exist yet. Write the rule you'd accept (a rubric, or one designated reviewer) and judge a few dozen real cases against it; when the judgments hold steady, the head-to-head can run.",
    next: function (c) { return "Book a quick call and I'll help you set it up: " + c.CAL_URL; }
  },
  builder: {
    label: "Run the numbers against your roadmap",
    line: "Your team can build this. The open questions: is one more model worth your team's quarter, and does a small post-trained model beat the rented API at your volume? The head-to-head is public code and hashes, judge the method yourself: " + CONFIG.HEAD_TO_HEAD_URL,
    next: function (c) { return "Want the API-vs-self-hosted numbers at your volume? Reply to this email and I'll send the comparison."; }
  }
};

function doPost(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const email    = ((p.email || p.email_address || "") + "").trim().toLowerCase();
  const honeypot = (p.company || "").trim();
  const source   = (p.source || "website").trim();
  const ua       = (p.ua || "").trim();
  const key      = (p.k || "").trim();
  const verdict  = (p.verdict || "").trim();
  const task     = (p.q1_task || "").trim();
  const answers  = (p.answers || "").trim();
  const notify   = (p.notify || "").trim().toLowerCase() === "yes" || source === "about-page";

  if (honeypot) return ok();                                       // bot: pretend success
  if (CONFIG.SECRET_KEY && key !== CONFIG.SECRET_KEY) return ok();  // wrong key: pretend success
  if (!isValidEmail(email)) return text("invalid_email");
  if (!rateLimitOk(email)) return text("rate_limited");

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    getSheet().appendRow([new Date(), email, source, verdict, task, notify ? "yes" : "", ua, answers]);
  } finally {
    lock.releaseLock();
  }

  notifyOwner(email, source, verdict, task, answers, notify);

  try {
    if (source === "fit-score") sendFitCheckReply(email, verdict);
    else if (source === "about-page") sendHeadToHeadReply(email);
    // other sources: store + notify only.
  } catch (err) { /* never fail the request on a mail hiccup */ }

  return ok();
}

function doGet() { return text("Baseweight capture endpoint. POST only."); }

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(["Timestamp", "Email", "Source", "Verdict", "Task", "Notify", "User Agent", "Answers"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function notifyOwner(email, source, verdict, task, answers, notify) {
  try {
    const lines = [
      "Source:  " + source,
      "Email:   " + email,
      verdict ? "Result:  " + verdict : null,
      task ? "Task:    " + task : null,
      "Notify:  " + (notify ? "yes" : "no"),
      answers ? "\nAnswers:\n" + answers : null
    ].filter(function (x) { return x; });
    MailApp.sendEmail({
      to: CONFIG.NOTIFY_TO,
      subject: "New " + (source === "fit-score" ? "fit check" : source) + " lead: " + email + (verdict ? " (" + verdict + ")" : ""),
      body: lines.join("\n"),
      replyTo: email   // hit reply to answer the lead directly
    });
  } catch (err) {}
}

function sendFitCheckReply(email, verdict) {
  const r = RESULTS[verdict];
  const resultPara = r ? (r.label + ".\n" + r.line + "\n\n" + r.next(CONFIG) + "\n\n") : "";
  const body =
    "Hi,\n\n" +
    "Thanks for scoping your task. I review the answers myself and reply with the two or three factors that decide it.\n\n" +
    resultPara +
    "Philip Stevens\n" + CONFIG.BRAND + " · " + CONFIG.SITE_URL;
  MailApp.sendEmail({
    to: email,
    subject: r ? ("Your Baseweight fit check: " + r.label.toLowerCase()) : "Your Baseweight fit check",
    body: body,
    name: CONFIG.FROM_NAME,
    replyTo: CONFIG.REPLY_TO
  });
}

function sendHeadToHeadReply(email) {
  const body =
    "Hi,\n\n" +
    "You're on the list. I'll send each new head-to-head when it publishes: methodology, failure analysis, per-task numbers. Technical content only.\n\n" +
    "The current one is here: " + CONFIG.HEAD_TO_HEAD_URL + "\n\n" +
    "Philip Stevens\n" + CONFIG.BRAND + " · " + CONFIG.SITE_URL;
  MailApp.sendEmail({
    to: email,
    subject: "You're on the list for the next Baseweight head-to-head",
    body: body,
    name: CONFIG.FROM_NAME,
    replyTo: CONFIG.REPLY_TO
  });
}

function ok()    { return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT); }
function text(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT); }

function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

// Rate-limit via CacheService (auto-expires; no unbounded ScriptProperties growth).
function rateLimitOk(email) {
  const cache = CacheService.getScriptCache();
  const k = "rl_" + email;
  if (cache.get(k)) return false;
  cache.put(k, "1", CONFIG.MIN_SECONDS_BETWEEN_SAME_EMAIL);
  return true;
}
