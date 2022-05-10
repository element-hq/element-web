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

import { range } from './util';
import { signup } from './usecases/signup';
import { toastScenarios } from './scenarios/toast';
import { roomDirectoryScenarios } from './scenarios/directory';
import { lazyLoadingScenarios } from './scenarios/lazy-loading';
import { e2eEncryptionScenarios } from './scenarios/e2e-encryption';
import { ElementSession } from "./session";
import { RestSessionCreator } from "./rest/creator";
import { RestMultiSession } from "./rest/multi";
import { spacesScenarios } from './scenarios/spaces';
import { RestSession } from "./rest/session";
import { stickerScenarios } from './scenarios/sticker';
import { userViewScenarios } from "./scenarios/user-view";
import { ssoCustomisationScenarios } from "./scenarios/sso-customisations";
import { updateScenarios } from "./scenarios/update";

export async function scenario(createSession: (s: string) => Promise<ElementSession>,
    restCreator: RestSessionCreator): Promise<void> {
    let firstUser = true;
    async function createUser(username) {
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
    await userViewScenarios(alice, bob);
    await roomDirectoryScenarios(alice, bob);
    await e2eEncryptionScenarios(alice, bob);
    console.log("create REST users:");
    const charlies = await createRestUsers(restCreator);
    await lazyLoadingScenarios(alice, bob, charlies);
    // do spaces scenarios last as the rest of the alice/bob tests may get confused by spaces
    await spacesScenarios(alice, bob);

    // we spawn another session for stickers, partially because it involves injecting
    // a custom sticker picker widget for the account, although mostly because for these
    // tests to scale, they probably need to be split up more, which means running each
    // scenario with it's own session (and will make it easier to find relevant logs),
    // so lets move in this direction (although at some point we'll also need to start
    // closing them as we go rather than leaving them all open until the end).
    const stickerSession = await createSession("sally");
    await stickerScenarios("sally", "ilikestickers", stickerSession, restCreator);

    // we spawn yet another session for SSO stuff because it involves authentication and
    // logout, which can/does affect other tests dramatically. See notes above regarding
    // stickers for the performance loss of doing this.
    const ssoSession = await createUser("enterprise_erin");
    await ssoCustomisationScenarios(ssoSession);

    // Create a new window to test app auto-updating
    const updateSession = await createSession("update");
    await updateScenarios(updateSession);
}

async function createRestUsers(restCreator: RestSessionCreator): Promise<RestMultiSession> {
    const usernames = range(1, 10).map((i) => `charly-${i}`);
    const charlies = await restCreator.createSessionRange(usernames, "testtest", "charly-1..10");
    await charlies.setDisplayName((s: RestSession) => `Charly #${s.userName().split('-')[1]}`);
    return charlies;
}
