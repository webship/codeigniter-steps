'use strict';

// The debug toolbar an app shows on its pages while it runs in development:
// that a page has it (and that a live page has none), its panels, and what a
// panel shows. The toolbar is the icon in a corner of the page that opens a
// bar of tabs (the time, the logs, the views, the files, the routes, the
// events, the history, the variables, the configuration, and the panels of
// the libraries the app uses); a tab opens its panel.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  listed,
  currentPath,
  assertPresence,
} = require('./codeigniter-helpers');

const TOOLBAR_HINT = 'The debug toolbar is on the pages of an app that runs in the development environment (CI_ENVIRONMENT = development): the icon at the corner of the page opens it.';

/**
 * The tabs of the toolbar that open a panel: their name (the panel they open)
 * and the text of their label. A tab without a panel of its own (the views
 * tab outlines the views on the page instead) is left out.
 */
async function toolbarTabs(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('#debug-bar a[data-tab]')].map((a) => ({
    name: String(a.getAttribute('data-tab') || '').replace(/^ci-/, ''),
    label: (a.textContent || '').replace(/\s+/g, ' ').trim(),
    panel: !!document.querySelector(`#debug-bar .tab#${a.getAttribute('data-tab')}`),
  })).filter((t) => t.panel)).catch(() => []);
}

/** The tab a person means by a name: the label that starts with it ("Routes 12"), else the panel it opens ("Timeline"). */
async function findTab(world, name) {
  const wanted = clean(name).toLowerCase();
  const tabs = await toolbarTabs(world);
  const tab = tabs.find((t) => t.label.toLowerCase() === wanted || t.label.toLowerCase().startsWith(wanted + ' '))
    || tabs.find((t) => t.name.toLowerCase() === wanted);
  return { tab, tabs };
}

/** The tabs as a person reads them, for an error message. */
function tabNames(tabs) {
  return listed(tabs.map((t) => (/^[A-Za-z]/.test(t.label) ? t.label.replace(/\s+\d+$/, '') : `${t.name} (${t.label})`)));
}

/** Open the toolbar from its icon, unless it is open already. */
async function openToolbar(world) {
  const icon = world.page.locator('#debug-icon');
  try {
    await icon.waitFor({ state: 'attached', timeout: budget(world) });
  } catch {
    throw friendly({ message: `The page has no debug toolbar (${currentPath(world)}).`, hint: TOOLBAR_HINT });
  }
  const bar = world.page.locator('#debug-bar');
  if (!(await bar.isVisible().catch(() => false))) {
    await world.page.locator('#debug-icon a, #debug-icon').first().click();
    await bar.waitFor({ state: 'visible', timeout: budget(world) });
  }
}

/**
 * Assert that the page has, or has not, the debug toolbar: its icon at the
 * corner of the page, put there by the script that loads it. A page of a live
 * app has neither.
 *
 * Example #1: Then I should see the debug toolbar
 * Example #2: Then I should not see the debug toolbar
 * Example #3: And we should see the debug toolbar
 * Example #4: But I should not see the debug toolbar
 * Example #5: Then we should not see the debug toolbar
 */
Then(/^(I |we )*should( not)* see the debug toolbar$/, async function (pronounCase, notCase) {
  if (notCase) {
    const left = await this.page.evaluate(() => [
      document.getElementById('debugbar_loader') ? 'the script that loads it' : '',
      document.getElementById('debug-icon') ? 'its icon' : '',
      document.getElementById('debug-bar') ? 'its bar' : '',
    ].filter(Boolean)).catch(() => []);
    if (left.length) {
      throw friendly({ message: `Expected no debug toolbar, but the page has ${left.join(', ')} (${currentPath(this)}).`, hint: 'A live app runs in the production environment (CI_ENVIRONMENT = production in its .env): its pages carry no debug toolbar.' });
    }
    return;
  }
  // The icon while the toolbar is closed, the bar while it is open (the toolbar keeps its state).
  await assertPresence(this.page.locator('#debug-icon, #debug-bar').filter({ visible: true }), false, {
    label: 'the debug toolbar (its icon at the corner of the page, or its bar)',
    hint: TOOLBAR_HINT,
    timeout: budget(this),
    found: async () => `The page is ${this.page.url()} ("${clean(await this.page.title())}").`,
  });
});

/**
 * Open a panel of the debug toolbar, as a person does: the icon opens the
 * toolbar, then the tab of that name opens its panel. A tab is named by the
 * word of its label ("Routes", "Auth", "Vars"); the two tabs without a word
 * by the panel they open ("Timeline", "Config").
 *
 * Example #1: When I open the "Routes" panel of the debug toolbar
 * Example #2: When we open the "Auth" panel of the debug toolbar
 * Example #3: And I open the "Timeline" panel of the debug toolbar
 * Example #4: When I open the "Vars" panel of the debug toolbar
 * Example #5: And we open the "Config" panel of the debug toolbar
 */
When(/^(I |we )*open the "([^"]*)" panel of the debug toolbar$/, async function (pronounCase, name) {
  await openToolbar(this);
  const { tab, tabs } = await findTab(this, name);
  if (!tab) {
    throw friendly({ message: `The debug toolbar has no "${name}" tab. Its tabs: ${tabNames(tabs)}.`, hint: 'Name a tab by the word of its label; a library adds its own tab (a database tab appears once the page ran a query).' });
  }
  // The toolbar keeps the tab that was open (a cookie): a second click would close it again.
  const panel = this.page.locator(`#debug-bar #ci-${tab.name}`);
  if (!(await panel.isVisible().catch(() => false))) {
    await this.page.locator(`#debug-bar a[data-tab="ci-${tab.name}"]`).first().click();
  }
  try {
    await panel.waitFor({ state: 'visible', timeout: budget(this) });
  } catch {
    throw friendly({ message: `The "${name}" tab of the debug toolbar did not open its panel.`, hint: 'A tab opens its panel above the toolbar; a second click closes it again.' });
  }
});

/**
 * Assert what an open panel of the debug toolbar shows, or does not show: a
 * text of the panel (a route, a view, the name of the signed-in account),
 * white space collapsed. Open the panel first.
 *
 * Example #1: Then the "Routes" panel of the debug toolbar should show "TestFixtures::account"
 * Example #2: Then the "Auth" panel of the debug toolbar should show "user@example.com"
 * Example #3: And the "Timeline" panel of the debug toolbar should show "welcome_message"
 * Example #4: Then the "Routes" panel of the debug toolbar should not show "admin/settings"
 * Example #5: And the "Config" panel of the debug toolbar should show "Environment: development"
 */
Then(/^the "([^"]*)" panel of the debug toolbar should( not)* show "([^"]*)"$/, async function (name, notCase, text) {
  const { tab, tabs } = await findTab(this, name);
  if (!tab) {
    throw friendly({ message: `The debug toolbar has no "${name}" tab. Its tabs: ${tabNames(tabs)}.`, hint: TOOLBAR_HINT });
  }
  const panel = this.page.locator(`#debug-bar #ci-${tab.name}`);
  if (!(await panel.isVisible().catch(() => false))) {
    throw friendly({ message: `The "${name}" panel of the debug toolbar is not open.`, hint: `Open it first: When I open the "${name}" panel of the debug toolbar.` });
  }
  const shown = clean(await panel.innerText().catch(() => ''));
  const has = shown.toLowerCase().includes(clean(text).toLowerCase());
  if (notCase && has) {
    throw friendly({ message: `Expected the "${name}" panel of the debug toolbar not to show "${text}", but it does.`, hint: 'The step reads the text of the open panel, letter case ignored.' });
  }
  if (!notCase && !has) {
    throw friendly({ message: `Expected the "${name}" panel of the debug toolbar to show "${text}". It shows: "${shown.slice(0, 240)}…".`, hint: 'The step reads the text of the open panel, letter case ignored.' });
  }
});
