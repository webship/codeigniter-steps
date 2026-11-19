<?php

// The pages the test app adds to a new app: an app guards its own pages with
// the filters of the auth library (the examples of its authorization guide),
// and the suite needs one page of each kind, and one error nothing catches.
// The build script copies this controller into the app (app/Controllers/) and
// adds its routes (site/routes.php).

namespace App\Controllers;

class TestFixtures extends BaseController
{
    /** The account page: any signed-in account (filter "session"). */
    public function account(): string
    {
        return $this->page('Your account');
    }

    /** The admin area: the "admin" and "superadmin" groups (filter "group:admin,superadmin"). */
    public function admin(): string
    {
        return $this->page('Admin area');
    }

    /** The site settings: the "admin.settings" permission (filter "permission:admin.settings"). */
    public function settings(): string
    {
        return $this->page('Site settings');
    }

    /** An error nothing catches: the 500 page in production, the debug page in development. */
    public function serverError(): string
    {
        throw new \RuntimeException('The test app raised this error on purpose.');
    }

    private function page(string $title): string
    {
        return view('test_fixtures', ['title' => $title, 'user' => auth()->user()]);
    }
}
