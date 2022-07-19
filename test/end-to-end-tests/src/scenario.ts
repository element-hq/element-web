/*
Copyright 2018 New Vector Ltd
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

import { signup } from './usecases/signup';
import { toastScenarios } from './scenarios/toast';
import { ElementSession } from "./session";

export async function scenario(createSession: (s: string) => Promise<ElementSession>): Promise<void> {
    let firstUser = true;
    async function createUser(username: string) {
        const session = await createSession(username);
        if (firstUser) {
            // only show browser version for first browser opened
            console.log(`running tests on ${await session.browser.version()} ...`);
            firstUser = false;
        }
        // ported to cyprus (registration test)
        await signup(session, session.username, 'testsarefun!!!', session.hsUrl);
        return session;
    }

    const alice = await createUser("alice");
    const bob = await createUser("bob");

    await toastScenarios(alice, bob);
}
