# Baseweight lead-capture backend (Google Apps Script)

Reference copy of the Apps Script web app that receives the site's two form
captures. **It is not part of the Vercel build** (excluded via `../.vercelignore`);
the live version is deployed by hand in the Google Apps Script console, bound to
the spreadsheet that stores leads. This file lives here for version history and
review only.

## What it does

Both site forms POST (via a hidden iframe) to the script's `/exec` URL, gated by
the shared formkey (`k`):

- `source=fit-score`: the Fit Score quiz (`fit-score.html`). Sends `email`,
  `verdict`, `q1_task`, `answers` (a plain-text blob), `notify`, `ua`. Logs the
  row, emails you the diagnosis, and sends the submitter a personal receipt with
  their verdict and next step.
- `source=about-page`: the benchmark opt-in (`about.html`). Sends `email`, `ua`.
  Logs the row, marks `Notify=yes`, and sends a "you're on the list" confirmation.

`CONFIG.SECRET_KEY` must equal the site's hidden `k`
(`formkey_QidffT6hpBTjEE38dkn2pbCvfCmebUJn`, in `about.html` and `fit-score.html`).
The endpoint the site posts to is
`https://script.google.com/macros/s/AKfycbw…/exec`.

## Deploy / update

1. Open the Apps Script project (bound to the leads spreadsheet) and paste
   `Code.gs`.
2. **Deploy → Manage deployments → edit the existing web app → Version: New
   version → Deploy.** Editing the existing deployment keeps the same `/exec`
   URL. Creating a *new* deployment changes the URL and breaks the site's form
   `action`.
3. Settings: Execute as **Me**, Who has access **Anyone**.

## Notes

- Rows land in a sheet named `Baseweight Leads` (auto-created on first POST).
  Older rows from the previous `Lead Magnet Emails` sheet stay where they are.
- Emails send from the Google account that owns the script, with display name
  "Philip Stevens" and reply-to `phil@baseweight.co`. To send *from*
  `phil@baseweight.co`, add it as a "Send mail as" alias on that account and
  switch the sends to `GmailApp` with a `from` option.
- Quota: two emails per signup (your notification + the reply) against Gmail's
  daily send cap.
- Rate limiting uses `CacheService` (best-effort, auto-expiring), so a duplicate
  submit within `MIN_SECONDS_BETWEEN_SAME_EMAIL` is dropped without storing or
  emailing again.
