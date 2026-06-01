/**
 * Baseweight lead capture + auto-reply (Apps Script web app).
 *
 * Reference copy. NOT part of the Vercel build (see ../.vercelignore). The live
 * version is pasted/deployed by hand in the Google Apps Script console, bound to
 * the spreadsheet that stores leads. See README.md for deploy steps.
 *
 * Two POST sources from the site, both gated by the shared formkey:
 *   source = "fit-score"  -> Fit Score quiz (email, verdict, q1_task, answers, notify)
 *   source = "about-page" -> benchmark opt-in (email)
 */
const CONFIG = {
  SHEET_NAME: "Baseweight Leads",
  SECRET_KEY: "formkey_QidffT6hpBTjEE38dkn2pbCvfCmebUJn", // must equal the site's hidden `k`
  MIN_SECONDS_BETWEEN_SAME_EMAIL: 60,

  FROM_NAME: "Philip Stevens",
  REPLY_TO:  "phil@baseweight.co",   // reply-to on auto-replies
  NOTIFY_TO: "phil@baseweight.co",   // where YOU get pinged on a new lead (change to your Gmail if you prefer)
  CAL_URL:   "https://cal.com/baseweight/intro",
  SITE_URL:  "https://baseweight.co",
  BENCHMARK_URL: "https://baseweight.co/benchmark",
  BRAND: "Baseweight"
};

// Fit Score verdict copy, kept consistent with the page.
const VERDICTS = {
  candidate: {
    label: "Candidate",
    line: "Your task has a checkable right answer, so an owned model can be benchmarked head-to-head with your current option on your data.",
    next: function (c) { return "The cheap Scan confirms it on a sample before you commit, then leads into the Pilot. Want to start now? Book a call: " + c.CAL_URL + " (the Scan fee credits toward the Pilot)."; }
  },
  build: {
    label: "We can build it",
    line: "You want to own it and the task is real, but correctness is subjective, so we can't prove a win the way the public benchmark does. We can still build it.",
    next: function (c) { return "We'd scope it on a call rather than a benchmark. Book one here: " + c.CAL_URL + "."; }
  },
  notyet: {
    label: "Not yet",
    line: "Your task has a checkable right answer (good), but there isn't enough labelled data to train and measure on yet. Get this in place first:\n  - A few hundred real examples of the task (more is better).\n  - The correct answer recorded for each (the label is what makes it measurable).\n  - A repeatable way to keep capturing them.",
    next: function (c) { return "Come back when you have it and the cheap Scan will settle it. Questions in the meantime? Just reply."; }
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
    if (source === "fit-score") sendFitScoreReply(email, verdict);
    else if (source === "about-page") sendBenchmarkReply(email);
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
      verdict ? "Verdict: " + verdict : null,
      task ? "Task:    " + task : null,
      "Notify:  " + (notify ? "yes" : "no"),
      answers ? "\nAnswers:\n" + answers : null
    ].filter(function (x) { return x; });
    MailApp.sendEmail({
      to: CONFIG.NOTIFY_TO,
      subject: "New " + (source === "fit-score" ? "Fit Score" : source) + " lead: " + email + (verdict ? " (" + verdict + ")" : ""),
      body: lines.join("\n"),
      replyTo: email   // hit reply to answer the lead directly
    });
  } catch (err) {}
}

function sendFitScoreReply(email, verdict) {
  const v = VERDICTS[verdict];
  const verdictPara = v ? ("Your quick verdict: " + v.label + ".\n" + v.line + "\n\n" + v.next(CONFIG) + "\n\n") : "";
  const body =
    "Hi,\n\n" +
    "Thanks for running the fit check. I'll personally go through your answers and send back the two or three things that would make or break it on your task, my actual read, not a copy of the page.\n\n" +
    verdictPara +
    "Philip Stevens\n" + CONFIG.BRAND + " · " + CONFIG.SITE_URL;
  MailApp.sendEmail({
    to: email,
    subject: v ? ("Your Baseweight fit check (" + v.label + ")") : "Your Baseweight fit check",
    body: body,
    name: CONFIG.FROM_NAME,
    replyTo: CONFIG.REPLY_TO
  });
}

function sendBenchmarkReply(email) {
  const body =
    "Hi,\n\n" +
    "You're on the list. I'll send the next public benchmark when it drops: methodology, failure analysis, and per-task numbers. Technical content only, no sequence.\n\n" +
    "The current one is here: " + CONFIG.BENCHMARK_URL + "\n\n" +
    "Philip Stevens\n" + CONFIG.BRAND + " · " + CONFIG.SITE_URL;
  MailApp.sendEmail({
    to: email,
    subject: "You're on the list for the next Baseweight benchmark",
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
