'use strict';

// The mail the app sends, read from the mailbox of the test app
// (`worldParameters.mailUrl`, a Mailpit): that a mail arrived, that none did,
// what it says, and a link of it opened as a person does.
//
// A mail step reads the mail that arrived since the step that asked for it
// (a login link, codeigniter-session.steps.js), or since the scenario started:
// never a mail of an earlier scenario or run.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  listed,
  open,
  addressOf,
  mailUrl,
  mailList,
  mailTo,
  mailLink,
} = require('./codeigniter-helpers');

/** The moment from which a mail step reads the mailbox. */
function mailSince(world) {
  return world.__mailAskedAt || world.__scenarioStartedAt || 0;
}

/**
 * Assert that the app sent an e-mail with a subject to an address (a handle of
 * the users registry stands for its address) since the step that asked for it.
 *
 * Example #1: Then an email with the subject "Your Login Link" should be sent to "user"
 * Example #2: Then an email with the subject "Your Login Link" should be sent to "admin"
 * Example #3: And an email with the subject "Your Login Link" should be sent to "user@example.com"
 * Example #4: Then an email with the subject "Your Login Link" should be sent to "developer"
 * Example #5: And an email with the subject "Your Login Link" should be sent to "developer@example.com"
 */
Then(/^an email with the subject "([^"]*)" should be sent to "([^"]*)"$/, async function (subject, who) {
  await mailTo(this, addressOf(this, who), { since: mailSince(this), subject });
});

/**
 * Assert that the app sent no e-mail to an address since the step that asked
 * for one: a request it refused sends nothing.
 *
 * Example #1: Then no email should be sent to "nobody@example.com"
 * Example #2: Then no email should be sent to "user"
 * Example #3: And no email should be sent to "banned"
 * Example #4: Then no email should be sent to "no-such-account@example.org"
 * Example #5: And no email should be sent to "nobody@example.com"
 */
Then(/^no email should be sent to "([^"]*)"$/, async function (who) {
  const address = addressOf(this, who);
  // Mail goes out while the app answers the request; a moment more is for a slow mail catcher.
  await this.page.waitForTimeout(1000);
  let messages;
  try {
    messages = (await mailList(this, address)).filter((message) => Date.parse(message.Created) >= mailSince(this) - 1000);
  } catch (err) {
    throw friendly({ message: `The mailbox at ${mailUrl(this)} could not be read.`, cause: err, hint: 'Check worldParameters.mailUrl in cucumber.js.' });
  }
  if (messages.length) {
    throw friendly({ message: `Expected no e-mail to ${address}, but the app sent: ${listed(messages.map((message) => message.Subject))}.`, hint: 'The step counts the mail that arrived since the step that asked for one.' });
  }
});

/**
 * Assert that the newest e-mail to an address with a subject holds a text
 * (in its text or its HTML version, white space collapsed).
 *
 * Example #1: Then the email with the subject "Your Login Link" to "user" should contain "Username: user"
 * Example #2: Then the email with the subject "Your Login Link" to "admin" should contain "Some information about the person:"
 * Example #3: And the email with the subject "Your Login Link" to "user" should contain "IP Address:"
 * Example #4: Then the email with the subject "Your Login Link" to "user@example.com" should contain "Login"
 * Example #5: And the email with the subject "Your Login Link" to "developer" should contain "Username: developer"
 */
Then(/^the email with the subject "([^"]*)" to "([^"]*)" should contain "([^"]*)"$/, async function (subject, who, text) {
  const mail = await mailTo(this, addressOf(this, who), { since: mailSince(this), subject });
  const entities = (s) => String(s).replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
  const plain = clean(entities(mail.text));
  const html = clean(entities(mail.html.replace(/<[^>]+>/g, ' ')));
  if (!plain.includes(clean(text)) && !html.includes(clean(text))) {
    throw friendly({ message: `The e-mail "${mail.subject}" to ${addressOf(this, who)} does not contain "${text}". It reads: ${(plain || html).slice(0, 300)}…`, hint: 'The step compares the text with white space collapsed.' });
  }
});

/**
 * Open a link of an e-mail the app sent, by the text a person clicks (the
 * button of the mail), as a person does: the newest e-mail to the address
 * (a handle of the users registry stands for its address) that holds such a
 * link, since the step that asked for it.
 *
 * Example #1: When I open the "Login" link of the email to "user"
 * Example #2: When we open the "Login" link of the email to "admin"
 * Example #3: And I open the "Login" link of the email to "user@example.com"
 * Example #4: When I open the "Login" link of the email to "developer"
 * Example #5: When we open the "Login" link of the email to "developer@example.com"
 */
When(/^(I |we )*open the "([^"]*)" link of the email to "([^"]*)"$/, async function (pronounCase, label, who) {
  const address = addressOf(this, who);
  const deadline = Date.now() + budget(this) * 2;
  let link = null;
  let mail = null;
  for (;;) {
    mail = await mailTo(this, address, { since: mailSince(this), timeout: Math.max(deadline - Date.now(), 1000) });
    link = mailLink(mail, label);
    if (link.href || Date.now() > deadline) break;
    await this.page.waitForTimeout(300);
  }
  if (!link.href) {
    throw friendly({ message: `The newest e-mail to ${address} ("${mail.subject}") has no link "${label}". Its links: ${listed(link.anchors.map((a) => a.text))}.`, hint: 'Name the link by the text of the button of the e-mail.' });
  }
  this.__mailLinkOpened = link.href;
  await open(this, link.href);
});
