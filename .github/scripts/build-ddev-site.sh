#!/usr/bin/env bash
# Builds the app the suite runs against: the current release of the official
# app starter (codeigniter4/appstarter) with the official auth library
# (codeigniter4/shield), in a DDEV project of type php with the public docroot
# (DDEV has no project type of its own for this framework).
#
# Settings (environment variables, all optional):
#   PROJECT_NAME      the DDEV project name                       (default codeignitersteps)
#   SITE_DIR          the project folder                          (default a new temporary folder)
#   PHP_VERSION       the PHP of the web container                (default 8.4)
#   ACCOUNT_PASSWORD  the password of the accounts below          (default Account-Pass-2026!)
#   ENVIRONMENT       production or development                   (default production)
#   ACCOUNTS_ONLY     1: build nothing, give the accounts of the app in SITE_DIR
#                     back their name, address, password, groups and state
#                     (after a run that was stopped half way)
#
# The accounts are configuration: this script creates them and cucumber.js names
# them; the features never create or delete users.
#   admin      admin@example.com      the "admin" group
#   developer  developer@example.com  the "developer" group (the "admin.settings" permission)
#   user       user@example.com       the "user" group (the one a new account gets)
#   banned     banned@example.com     the "user" group, banned
#
# Nothing is installed that the app starter and the auth library do not bring:
# no paid package, no trial, no sign-in to any service.
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-codeignitersteps}"
PHP_VERSION="${PHP_VERSION:-8.4}"
ACCOUNT_PASSWORD="${ACCOUNT_PASSWORD:-Account-Pass-2026!}"
ENVIRONMENT="${ENVIRONMENT:-production}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"

case "$ENVIRONMENT" in
  production|development) ;;
  *) echo "ENVIRONMENT must be production or development, not \"$ENVIRONMENT\"." >&2; exit 1 ;;
esac

# The accounts (see the header), written through the app's own user model by a
# seeder, so the password is hashed the way the app hashes it. Run again, it
# gives them back their name, address, password, groups and state.
write_accounts() {
  python3 -c '
import json, sys
password = sys.argv[1]
print(json.dumps([
    {"username": "admin", "email": "admin@example.com", "password": password, "groups": ["admin"], "banned": False},
    {"username": "developer", "email": "developer@example.com", "password": password, "groups": ["developer"], "banned": False},
    {"username": "user", "email": "user@example.com", "password": password, "groups": ["user"], "banned": False},
    {"username": "banned", "email": "banned@example.com", "password": password, "groups": ["user"], "banned": True},
]))' "$ACCOUNT_PASSWORD" > writable/test-accounts.json
  cp "$REPO_DIR/site/TestAccounts.php" app/Database/Seeds/TestAccounts.php
  ddev exec php spark db:seed TestAccounts
  rm -f app/Database/Seeds/TestAccounts.php writable/test-accounts.json
}

mkdir -p "$SITE_DIR"
cd "$SITE_DIR"

if [ "${ACCOUNTS_ONLY:-}" = "1" ]; then
  write_accounts
  exit 0
fi

# Node.js 24, the line of the Webship Workspace (the app itself needs none).
ddev config --project-type=php --docroot=public --project-name="$PROJECT_NAME" --php-version="$PHP_VERSION" --nodejs-version=24
ddev start -y

# The official app starter, with Composer in the web container.
ddev composer create-project codeigniter4/appstarter --no-interaction

SITE_URL="$(ddev describe -j | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['primary_url'])")"

# The settings of the app, in its .env: the address, no index.php in the
# addresses, the database of the DDEV project (db, db, db on the host db) and
# the sender of its mail. The mail goes out through the sendmail of the web
# container, which DDEV hands to its mail catcher (Mailpit).
cat > .env <<ENVEOF
CI_ENVIRONMENT = production
app.baseURL = '${SITE_URL}/'
app.indexPage = ''
database.default.hostname = db
database.default.database = db
database.default.username = db
database.default.password = db
database.default.DBDriver = MySQLi
database.default.port = 3306
email.fromEmail = 'noreply@example.com'
email.fromName = 'Webship test app'
ENVEOF

# The official auth library, set up by its own command: its configuration, the
# helpers, its routes, CSRF protection kept in the session, and its tables. The
# command asks before each change; with no answer it takes the default (yes).
ddev composer require codeigniter4/shield --no-interaction
ddev exec php spark shield:setup < /dev/null

# CSRF protection for every form: the filter the app starter ships commented
# out in app/Config/Filters.php, turned on the documented way.
sed -i "s#^            // 'csrf',#            'csrf',#" app/Config/Filters.php
grep -q "^            'csrf'," app/Config/Filters.php || { echo "Could not turn on the csrf filter in app/Config/Filters.php." >&2; exit 1; }

# The pages the test app adds to a new app (site/routes.php): a page for any
# signed-in account, one for the "admin" group, one for the "admin.settings"
# permission, guarded by the auth library's own filters, and an error nothing
# catches. Everything else is the app starter's and the auth library's.
cp "$REPO_DIR/site/TestFixtures.php" app/Controllers/TestFixtures.php
cp "$REPO_DIR/site/test_fixtures.php" app/Views/test_fixtures.php
cat "$REPO_DIR/site/routes.php" >> app/Config/Routes.php

write_accounts

# A test app behaves like a live one: an error renders the plain error page,
# never the debug page, and the pages carry no debug toolbar.
ddev exec php spark env "$ENVIRONMENT"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
FRAMEWORK="$(ddev exec php spark --version 2>/dev/null | grep -o 'v[0-9][0-9.]*' | head -1 || true)"
AUTH="$(ddev composer show codeigniter4/shield 2>/dev/null | awk '$1 == "versions" {print $NF}' || true)"
echo "Built the app starter ${FRAMEWORK:-(unknown version)} with the auth library ${AUTH:-(unknown version)} at $SITE_URL ($ENVIRONMENT)"
