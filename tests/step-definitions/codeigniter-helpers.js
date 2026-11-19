'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the
// plumbing the steps use and that a project can require for its own steps:
// the wait budget and the settle on the page's own requests, the paths of the
// app, the users registry and the session cache, fields found by their label,
// the messages of a page (the error, success, warning and information lines a
// form or a redirect leaves), the answers the browser received on its way to
// a page, the mailbox of the test app, and the status of the page.
//
// The app is a server-rendered app: every action is a form sent or a link
// followed, and the answer is a new page (often after a redirect). Every
// lookup starts with what a person reads (a label, a role, a text) and falls
// back to the stable hooks of the pages (`role="alert"`, the contextual
// classes of a message, the name of a field).
//
// Everything builds on webship-js's own helpers (`gotoUrl`, `friendly`,
// `fillField`) so the steps fail the way the core webship-js steps do.

const { gotoUrl, friendly, fillField } = require('webship-js/tests/step-definitions/webship');

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least
 * 10 seconds. Kept below webship-js's 45 second step timeout.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/** The settle budget after an action (`minWaitTime.page`, 3 seconds by default). */
function settleBudget(world) {
  return (world && world.minWaitTime && world.minWaitTime.page) || 3000;
}

/** Escape a literal string for use in a RegExp. */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** White space collapsed and trimmed. */
function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
}

/** A list for an error message: `"a", "b", "c"` or `(none)`. */
function listed(values) {
  const items = [...new Set((values || []).map(clean).filter(Boolean))];
  return items.length ? items.map((item) => `"${item}"`).join(', ') : '(none)';
}

/** The site root without a trailing slash. */
function siteRoot(world) {
  return String(world.launchUrl || (world.parameters && world.parameters.launchUrl) || '').replace(/\/+$/, '');
}

/** Join the site root and a path with exactly one slash. Absolute URLs pass through. */
function siteUrl(world, url) {
  if (!url) return siteRoot(world) + '/';
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/** A path of the app read from cucumber.js (`worldParameters.<key>`), or its default. */
function appPath(world, key, fallback) {
  const value = world.parameters && world.parameters[key];
  return '/' + String(value || fallback).replace(/^\/+/, '');
}

/** The login page (`loginPath`, /login). */
function loginPath(world) {
  return appPath(world, 'loginPath', '/login');
}

/** The address that ends a session (`logoutPath`, /logout): a link a page offers, or the address itself. */
function logoutPath(world) {
  return appPath(world, 'logoutPath', '/logout');
}

/** The page that sends a login link by mail (`loginLinkPath`, /login/magic-link). */
function loginLinkPath(world) {
  return appPath(world, 'loginLinkPath', '/login/magic-link');
}

/** A page that names the signed-in account (`accountPath`, /account on the test app). */
function accountPath(world) {
  return appPath(world, 'accountPath', '/account');
}

/** The path of the page the browser shows, without the query and the fragment. */
function currentPath(world) {
  try {
    return new URL(world.page.url()).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

/** The path of an address, without the query, the fragment and a trailing slash. */
function pathOf(url) {
  try {
    return new URL(url, 'https://x.invalid').pathname.replace(/\/+$/, '') || '/';
  } catch {
    return String(url || '');
  }
}

/** Whether the browser shows the page of a path (trailing slashes ignored). */
function isOnPath(world, path) {
  return currentPath(world) === (String(path).replace(/\/+$/, '') || '/');
}

// ---------------------------------------------------------------------------
// Waiting on the page's own requests
// ---------------------------------------------------------------------------

const TRACKED = new WeakMap();

/**
 * The background requests (XHR and fetch) of the page that are still running,
 * how many started so far, and the answers to the documents the main frame
 * loaded (each hop of a redirect included), newest last. The tracker is
 * attached once per page.
 *
 * @returns {{pending: Set, started: number, documents: Array<{url: string, status: number, location: string, at: number}>}}
 */
function requests(world) {
  const page = world.page;
  let state = TRACKED.get(page);
  if (!state) {
    state = { pending: new Set(), started: 0, documents: [] };
    TRACKED.set(page, state);
    const background = (request) => ['xhr', 'fetch'].includes(request.resourceType());
    page.on('request', (request) => {
      if (!background(request)) return;
      state.pending.add(request);
      state.started += 1;
    });
    page.on('response', (response) => {
      try {
        const request = response.request();
        if (!request.isNavigationRequest() || response.frame() !== page.mainFrame()) return;
        const headers = response.headers();
        state.documents.push({ url: response.url(), status: response.status(), location: headers.location || '', at: Date.now() });
        if (state.documents.length > 50) state.documents.shift();
      } catch (e) { /* a response of a frame that is gone */ }
    });
    const done = (request) => { state.pending.delete(request); };
    page.on('requestfinished', done);
    page.on('requestfailed', done);
    // A navigation drops the requests of the page it leaves.
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) state.pending.clear(); });
  }
  return state;
}

/**
 * Wait for the page to go quiet after an action: the document is loaded and no
 * background request has been running for a moment. Returns as soon as that is
 * true, and at the latest after `timeout` (the settle budget by default).
 */
async function settle(world, timeout) {
  const state = requests(world);
  const deadline = Date.now() + (timeout || settleBudget(world));
  await world.page.waitForLoadState('domcontentloaded', { timeout: Math.max(deadline - Date.now(), 1) }).catch(() => {});
  let quietSince = 0;
  while (Date.now() < deadline) {
    if (state.pending.size === 0) {
      if (!quietSince) quietSince = Date.now();
      if (Date.now() - quietSince >= 200) return;
    } else {
      quietSince = 0;
    }
    await world.page.waitForTimeout(40);
  }
}

/**
 * Run an action that sends a form or follows a link, and wait for the answer:
 * the browser leaves the page it was on and the new page is loaded. Returns
 * the answers the main frame received since the action, in order (a redirect
 * is an answer of its own).
 */
async function afterNavigation(world, fn) {
  const state = requests(world);
  const before = state.documents.length;
  const from = world.page.url();
  await Promise.all([
    world.page.waitForNavigation({ timeout: budget(world), waitUntil: 'load' }).catch(() => {}),
    fn(),
  ]);
  await world.page.waitForLoadState('load', { timeout: budget(world) }).catch(() => {});
  await settle(world);
  return { from, answers: state.documents.slice(before) };
}

/**
 * Open a URL and wait for the page to settle. Returns the answers the main
 * frame received on the way (a redirect is an answer of its own).
 */
async function open(world, url) {
  const state = requests(world);
  const before = state.documents.length;
  try {
    await gotoUrl(world.page, url);
  } catch (err) {
    // A network interface that comes or goes on the machine (a container starting next door) aborts the
    // navigation once, with ERR_NETWORK_CHANGED or the browser's own error page: go again.
    if (!/ERR_NETWORK_CHANGED|chrome-error:\/\/chromewebdata/.test(String(err && err.message))) throw err;
    await world.page.waitForTimeout(500);
    await gotoUrl(world.page, url);
  }
  await world.page.waitForSelector('body', { state: 'attached', timeout: budget(world) });
  await world.page.waitForLoadState('load', { timeout: budget(world) }).catch(() => {});
  await settle(world);
  return state.documents.slice(before);
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match
 * and fail with a friendly error otherwise: the wait and the assertion are one
 * call, so content that arrives a moment late still passes.
 */
async function assertPresence(locator, notCase, { label, hint, timeout, found }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout });
  } catch {
    const seen = found ? await found().catch(() => '') : '';
    throw friendly({
      message: (notCase ? `Expected not to see ${label}, but it is on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.`) + (seen ? ` ${seen}` : ''),
      hint,
    });
  }
}

/**
 * Poll a reading until it satisfies a check, or fail with the last reading.
 *
 * @param {object} world
 * @param {Function} read - async () => value
 * @param {Function} check - (value) => boolean
 * @param {Function} explain - (value) => {message, hint}
 */
async function eventually(world, read, check, explain, timeout) {
  const deadline = Date.now() + (timeout || budget(world));
  let value;
  for (;;) {
    value = await read();
    if (check(value)) return value;
    if (Date.now() > deadline) throw friendly(explain(value));
    await world.page.waitForTimeout(200);
  }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/**
 * An account of the users registry in cucumber.js (`worldParameters.users`),
 * by the handle a scenario names it with.
 *
 * @returns {{handle: string, email: string, username: (string|undefined), password: string}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { email: '${handle}@example.com', username: '${handle}', password: process.env.${String(handle).toUpperCase()}_PASSWORD } }. The account itself is created once by the build of the app, never by a feature.`,
    });
  }
  if (!entry.email || !entry.password) {
    throw friendly({
      message: `The user "${handle}" has no ${entry.email ? 'password' : 'email address'} in the users registry.`,
      hint: `Set worldParameters.users.${handle}.email and .password in cucumber.js, from environment variables.`,
    });
  }
  return { handle, email: entry.email, username: entry.username, password: entry.password };
}

/** A handle of the users registry stands for its address; anything else is an address. */
function addressOf(world, who) {
  const users = (world.parameters && world.parameters.users) || {};
  return users[who] ? resolveUser(world, who).email : who;
}

// The sessions of the accounts that logged in during this run, by site and
// address: the cookies of the browser after a login through the form. A
// scenario that logs in as an account that already has a session takes it
// over instead of filling in the login form again, which is quicker.
// `worldParameters.reuseSessions: false` in cucumber.js turns it off.
const SESSIONS = new Map();

function sessionKey(world, email) {
  return `${siteRoot(world)}|${String(email).toLowerCase()}`;
}

function reuseSessions(world) {
  return !(world.parameters && world.parameters.reuseSessions === false);
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/**
 * The visible form control a person means by `name`: its label exactly as
 * written, then its `name` attribute, then the one label that starts with the
 * text (letter case ignored), then its placeholder.
 *
 * @returns {Promise<import('playwright').Locator>} one element
 */
async function findField(world, name, { timeout } = {}) {
  const page = world.page;
  const deadline = Date.now() + (timeout || budget(world));
  const candidates = () => [
    page.getByLabel(name, { exact: true }),
    page.locator(`[name="${String(name).replace(/["\\]/g, '\\$&')}"]`),
    page.getByLabel(new RegExp('^\\s*' + escapeRegExp(name), 'i')),
    page.getByPlaceholder(name, { exact: true }),
  ];
  for (;;) {
    for (const locator of candidates()) {
      const count = await locator.count().catch(() => 0);
      for (let i = 0; i < count; i += 1) {
        const item = locator.nth(i);
        if (await item.isVisible().catch(() => false)) return item;
      }
    }
    if (Date.now() > deadline) break;
    await page.waitForTimeout(150);
  }
  const labels = await visibleFieldLabels(world);
  throw friendly({
    message: `No field "${name}" is on the page (${world.page.url()}). The fields are: ${listed(labels)}.`,
    hint: 'Name the field by its label as the page writes it ("Email Address"), or by its name attribute ("email").',
  });
}

/** The labels of the visible form controls of the page, for an error message. */
async function visibleFieldLabels(world) {
  return world.page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
      const box = el.getBoundingClientRect();
      if (!box.width && !box.height) continue;
      const text = (el.labels && el.labels[0] && el.labels[0].textContent) || el.getAttribute('aria-label') || el.getAttribute('name') || '';
      out.push(text.replace(/\s+/g, ' ').trim());
    }
    return out;
  }).catch(() => []);
}

/** Fill a field the way webship-js's "I fill in" does: by its exact label, placeholder or name. */
async function fillLikeABuiltIn(world, name, value) {
  await fillField(world.page, name, value, world);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

// The kinds of message a page shows, and how each is marked: the contextual
// classes of the message box (the auth pages use `alert-danger`,
// `alert-success`, …), else words in its classes.
const MESSAGE_KINDS = {
  error: /\b(alert-danger|alert-error|text-bg-danger|is-danger|is-error|error|errors|danger)\b/i,
  success: /\b(alert-success|text-bg-success|is-success|success)\b/i,
  warning: /\b(alert-warning|text-bg-warning|is-warning|warning)\b/i,
  info: /\b(alert-info|alert-primary|text-bg-info|is-info|info|notice)\b/i,
};

/**
 * The messages the page shows, by kind: the visible message boxes
 * (`role="alert"`, `role="status"`, `.alert`), each split into its lines (a box
 * that lists several errors prints one per line). A box with no kind of its
 * own counts as an error when its role is "alert", as information otherwise.
 *
 * @returns {Promise<Array<{kind: string, text: string}>>}
 */
async function pageMessages(world) {
  const kinds = Object.fromEntries(Object.entries(MESSAGE_KINDS).map(([kind, re]) => [kind, re.source]));
  return world.page.evaluate((patterns) => {
    const out = [];
    const boxes = [...document.querySelectorAll('[role="alert"], [role="status"], .alert')];
    for (const box of boxes) {
      if (boxes.some((other) => other !== box && other.contains(box))) continue;
      const style = getComputedStyle(box);
      const rect = box.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || (!rect.width && !rect.height)) continue;
      const classes = `${box.className || ''} ${box.parentElement ? box.parentElement.className || '' : ''}`;
      let kind = Object.keys(patterns).find((k) => new RegExp(patterns[k], 'i').test(classes));
      if (!kind) kind = box.getAttribute('role') === 'alert' ? 'error' : 'info';
      for (const line of (box.innerText || '').split('\n')) {
        const text = line.replace(/\s+/g, ' ').trim();
        if (text && !/^[×✕x]$/.test(text)) out.push({ kind, text });
      }
    }
    return out;
  }, kinds).catch(() => []);
}

// ---------------------------------------------------------------------------
// The mailbox of the test app
// ---------------------------------------------------------------------------

/**
 * The address of the mailbox that catches the mail of the app
 * (`worldParameters.mailUrl` in cucumber.js): a Mailpit, which every DDEV
 * project has at port 8026.
 */
function mailUrl(world) {
  const url = world.parameters && world.parameters.mailUrl;
  if (!url) {
    throw friendly({ message: 'No mailbox is configured.', hint: 'Set worldParameters.mailUrl in cucumber.js to the Mailpit of the app, for example https://your-app.ddev.site:8026.' });
  }
  return String(url).replace(/\/+$/, '');
}

/** The messages of the mailbox to an address, newest first, as Mailpit lists them. */
async function mailList(world, address) {
  const request = world.page.context().request;
  const response = await request.get(`${mailUrl(world)}/api/v1/search?query=${encodeURIComponent('to:' + address)}`, { failOnStatusCode: false, ignoreHTTPSErrors: true });
  if (!response.ok()) throw new Error(`the mailbox answered HTTP ${response.status()}`);
  return (await response.json()).messages || [];
}

/**
 * The newest e-mail to an address that arrived after a moment in time, once it
 * is there (and, when `subject` is given, with that subject).
 *
 * @returns {Promise<{id: string, subject: string, text: string, html: string}>}
 */
async function mailTo(world, address, { since = 0, subject = null, timeout } = {}) {
  const request = world.page.context().request;
  const base = mailUrl(world);
  const deadline = Date.now() + (timeout || budget(world) * 2);
  let found = null;
  let problem = '';
  let subjects = [];
  for (;;) {
    try {
      const messages = (await mailList(world, address)).filter((message) => !since || Date.parse(message.Created) >= since - 2000);
      subjects = messages.map((message) => message.Subject);
      found = messages.find((message) => !subject || clean(message.Subject) === clean(subject)) || null;
      problem = messages.length ? `it has ${messages.length} for that address since the step that asked for it, none with the subject "${subject}"` : 'it has none for that address since the step that asked for it';
      if (found) break;
    } catch (err) {
      problem = clean(err && err.message).split(' Call log')[0];
    }
    if (Date.now() > deadline) break;
    await world.page.waitForTimeout(300);
  }
  if (!found) {
    throw friendly({
      message: `No e-mail${subject ? ` "${subject}"` : ''} to ${address} arrived in the mailbox at ${base} (${problem}).${subjects.length ? ` Subjects: ${listed(subjects)}.` : ''}`,
      hint: 'The app must send its mail to this mailbox (the mail catcher of the container: the sendmail of the web container, or SMTP on port 1025), and the address must be the one of the account. Check worldParameters.mailUrl in cucumber.js.',
    });
  }
  const message = await (await request.get(`${base}/api/v1/message/${found.ID}`, { ignoreHTTPSErrors: true })).json();
  return { id: found.ID, subject: message.Subject || '', text: message.Text || '', html: message.HTML || '' };
}

/**
 * The address of a link of an e-mail, by the text a person clicks (the text
 * of the button of the HTML version, or the label before the address in the
 * text version: "Login: https://…").
 */
function mailLink(mail, label) {
  const anchors = [...String(mail.html).matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ href: m[1].replace(/&amp;/g, '&'), text: clean(m[2].replace(/<[^>]+>/g, ' ')) }));
  const byText = anchors.find((a) => a.text.toLowerCase() === clean(label).toLowerCase());
  if (byText) return { href: byText.href, anchors };
  const line = String(mail.text).split('\n').map((l) => l.trim()).find((l) => l.toLowerCase().startsWith(clean(label).toLowerCase() + ':'));
  const inLine = line && line.match(/https?:\/\/\S+/);
  return { href: inLine ? inLine[0].replace(/[)\].,]+$/, '') : null, anchors };
}

// ---------------------------------------------------------------------------
// The page on screen
// ---------------------------------------------------------------------------

/**
 * The status of the document the browser shows: the one webship-js recorded
 * for the last navigation of the page (`_lastResponse`), else the one the
 * browser keeps in its navigation timing.
 */
async function documentStatus(world) {
  const last = world._lastResponse;
  const strip = (url) => String(url || '').split('#')[0];
  if (last && last.page === world.page && strip(last.url) === strip(world.page.url())) return last.status;
  return world.page.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0];
    return entry && typeof entry.responseStatus === 'number' && entry.responseStatus ? entry.responseStatus : null;
  }).catch(() => null);
}

/** The login form: the visible form that holds a password field and an address or user name field. */
function loginForm(world) {
  return world.page.locator('form:has(input[type="password"]):has(input[name="email"], input[name="username"], input[type="email"])').filter({ visible: true }).first();
}

/** What the page on screen says about itself: its address, status, title and main heading. */
async function pageSummary(world) {
  const status = await documentStatus(world);
  const title = clean(await world.page.title().catch(() => ''));
  const heading = clean(await world.page.locator('h1').first().innerText({ timeout: 500 }).catch(() => ''));
  const text = clean(await world.page.locator('body').innerText({ timeout: 1000 }).catch(() => ''));
  return { path: currentPath(world), status, title, heading, text };
}

// ---------------------------------------------------------------------------
// Logging in
// ---------------------------------------------------------------------------

const LOGIN_HINT = 'The login form is at /login (worldParameters.loginPath): the fields "Email Address" and "Password", the "Remember me?" box and the "Login" button. Check launchUrl in cucumber.js.';

/** The address field of the login form: the field named email (or username), else the address field. */
async function identityField(world, user) {
  const form = loginForm(world);
  for (const name of ['email', 'username']) {
    const field = form.locator(`input[name="${name}"]`);
    if (await field.count()) return { field: field.first(), value: name === 'username' && user.username ? user.username : user.email };
  }
  return { field: form.locator('input[type="email"]').first(), value: user.email };
}

/** Open the login page as a visitor: the browser forgets the session it had. */
async function openLoginForm(world) {
  await world.page.context().clearCookies();
  world.__sessionKey = null;
  await open(world, siteUrl(world, loginPath(world)));
  try {
    await loginForm(world).waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    throw friendly({ message: `The login form did not appear at ${siteUrl(world, loginPath(world))} (${world.page.url()}).`, cause: err, hint: LOGIN_HINT });
  }
}

/**
 * Fill in and send the login form, then read its outcome: a page that is not
 * the login page (the account is signed in), the error message of the login
 * page, or the answer that there were too many attempts (HTTP 429, when the
 * app limits the requests to its login page).
 *
 * @returns {Promise<{error: string, throttled: boolean, retryAfter: number}>}
 */
async function submitLogin(world, user, { remember = false } = {}) {
  await openLoginForm(world);
  const { field, value } = await identityField(world, user);
  await field.fill(value);
  await loginForm(world).locator('input[type="password"]').first().fill(user.password);
  if (remember) {
    let box = loginForm(world).locator('input[type="checkbox"][name="remember"]');
    if (!(await box.count())) box = world.page.getByRole('checkbox', { name: /^\s*remember me\b/i });
    if (!(await box.count())) {
      throw friendly({ message: 'The login form has no "Remember me" box.', hint: LOGIN_HINT });
    }
    if (!(await box.first().isChecked())) await box.first().check();
  }
  const submit = loginForm(world).locator('button[type="submit"], input[type="submit"]').first();
  const { answers } = await afterNavigation(world, () => submit.click());
  const last = answers[answers.length - 1];
  if (last && last.status === 429) {
    const headers = (world._lastResponse && world._lastResponse.headers) || {};
    return { error: 'Too Many Requests (HTTP 429)', throttled: true, retryAfter: Number(headers['retry-after']) || 60 };
  }
  if (!isOnPath(world, loginPath(world))) return { error: '', throttled: false, retryAfter: 0 };
  const errors = (await pageMessages(world)).filter((m) => m.kind === 'error').map((m) => m.text);
  return { error: errors.join(' ') || `the login page came back with no message (${world.page.url()})`, throttled: false, retryAfter: 0 };
}

/**
 * Log in through the form; when the app answers that there were too many
 * attempts, wait the time its Retry-After header gives (a minute at most) and
 * try once more.
 */
async function loginThroughTheForm(world, user, options) {
  let outcome = await submitLogin(world, user, options);
  if (outcome.throttled) {
    const retry = Math.min(outcome.retryAfter, 65);
    process.stderr.write(`\n[codeigniter-steps] the login of ${user.email} was refused for too many requests: waiting ${retry} s, as the app asks.\n`);
    await world.page.waitForTimeout((retry + 1) * 1000);
    outcome = await submitLogin(world, user, options);
  }
  return outcome;
}

/**
 * Whether somebody is signed in: the app sends a signed-in account away from
 * its login page, and shows the login form to a visitor.
 */
async function signedIn(world) {
  await open(world, siteUrl(world, loginPath(world)));
  if (!isOnPath(world, loginPath(world))) return true;
  return !(await loginForm(world).isVisible().catch(() => false));
}

/** Take over the session an account opened earlier in this run. */
async function restoreSession(world, user) {
  const key = sessionKey(world, user.email);
  const cookies = SESSIONS.get(key);
  if (!cookies || !reuseSessions(world)) return false;
  const context = world.page.context();
  await context.clearCookies();
  await context.addCookies(cookies);
  if (await signedIn(world)) {
    world.__sessionKey = key;
    return true;
  }
  // The session ended since (a logout, a timeout): log in again.
  SESSIONS.delete(key);
  await context.clearCookies();
  return false;
}

/**
 * Log in as an account of the users registry, by its handle: take over its
 * session when it has one from earlier in the run, else log in through the
 * form and keep the session for the next scenario.
 */
async function logInAs(world, handle) {
  const user = resolveUser(world, handle);
  if (await restoreSession(world, user)) return;
  const outcome = await loginThroughTheForm(world, user);
  if (outcome.error) {
    throw friendly({
      message: `Could not log in as "${handle}" (${user.email}): ${outcome.error}`,
      hint: outcome.throttled
        ? 'The app limits the requests to its login page. Keep session reuse on (worldParameters.reuseSessions) and log in through the form only where a scenario tests the form.'
        : 'Check the address and the password of the account in worldParameters.users, and that the build of the app created the account (and did not ban it).',
    });
  }
  if (reuseSessions(world)) {
    const key = sessionKey(world, user.email);
    SESSIONS.set(key, await world.page.context().cookies());
    world.__sessionKey = key;
  }
}

/** Forget the session of the browser in the session cache: it ended (a logout, an expiry). */
function forgetSession(world) {
  for (const key of [...SESSIONS.keys()]) {
    if (key === world.__sessionKey) SESSIONS.delete(key);
  }
  world.__sessionKey = null;
}

module.exports = {
  budget,
  settleBudget,
  escapeRegExp,
  clean,
  listed,
  siteRoot,
  siteUrl,
  appPath,
  loginPath,
  logoutPath,
  loginLinkPath,
  accountPath,
  currentPath,
  pathOf,
  isOnPath,
  requests,
  settle,
  afterNavigation,
  open,
  assertPresence,
  eventually,
  resolveUser,
  addressOf,
  SESSIONS,
  sessionKey,
  reuseSessions,
  findField,
  visibleFieldLabels,
  fillLikeABuiltIn,
  MESSAGE_KINDS,
  pageMessages,
  mailUrl,
  mailList,
  mailTo,
  mailLink,
  documentStatus,
  loginForm,
  pageSummary,
  LOGIN_HINT,
  openLoginForm,
  submitLogin,
  loginThroughTheForm,
  signedIn,
  restoreSession,
  logInAs,
  forgetSession,
};
