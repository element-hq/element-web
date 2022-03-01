/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { strict as assert } from 'assert';

import { ElementSession } from "../session";

export async function logout(session: ElementSession, assertLoginPage = true): Promise<void> {
    session.log.startGroup("logs out");

    session.log.step("navigates to user menu");
    const userButton = await session.query('.mx_UserMenu > div.mx_AccessibleButton');
    await userButton.click();
    session.log.done();

    session.log.step("clicks the 'Sign Out' button");
    const signOutButton = await session.query('.mx_UserMenu_contextMenu .mx_UserMenu_iconSignOut');
    await signOutButton.click();
    session.log.done();

    if (assertLoginPage) {
        const foundLoginUrl = await session.poll(async () => {
            const url = session.page.url();
            return url === session.url('/#/login');
        });
        assert(foundLoginUrl);
    }

    session.log.endGroup();
}
