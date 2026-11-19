<?php

// Creates the accounts the suite logs in as, or gives them back their name,
// address, password, groups and state: the build script copies this seeder into
// the app (app/Database/Seeds/) and runs it once, then removes it again.
// Accounts are configuration: cucumber.js names them, a feature never creates
// or deletes one.
//
//   php spark db:seed TestAccounts
//
// It reads writable/test-accounts.json:
//   [{"username": "admin", "email": "admin@example.com", "password": "…", "groups": ["admin"], "banned": false}, …]

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;

class TestAccounts extends Seeder
{
    public function run(): void
    {
        $file     = WRITEPATH . 'test-accounts.json';
        $accounts = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
        $users    = model(UserModel::class);

        foreach ($accounts as $account) {
            $user = $users->findByCredentials(['email' => $account['email']]);
            if ($user === null) {
                $user = new User([
                    'username' => $account['username'],
                    'email'    => $account['email'],
                    'password' => $account['password'],
                ]);
                $users->save($user);
                $user = $users->findById($users->getInsertID());
            } else {
                $user->fill([
                    'username' => $account['username'],
                    'email'    => $account['email'],
                    'password' => $account['password'],
                ]);
                $users->save($user);
            }

            $user->activate();
            $user->syncGroups(...$account['groups']);
            if (! empty($account['banned'])) {
                $user->ban();
            } else {
                $user->unBan();
            }

            printf(
                "  %s <%s> %s%s\n",
                $user->username,
                $user->email,
                implode(', ', $account['groups']),
                empty($account['banned']) ? '' : ' (banned)',
            );
        }
    }
}
