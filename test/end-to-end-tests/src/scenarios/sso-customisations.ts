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

import { strict as assert } from "assert";

import { ElementSession } from "../session";
import { logout } from "../usecases/logout";
import { applyConfigChange } from "../util";

export async function ssoCustomisationScenarios(session: ElementSession): Promise<void> {
    console.log(" injecting logout customisations for SSO scenarios:");

    await session.delay(1000); // wait for dialogs to close
    await applyConfigChange(session, {
        // we redirect to config.json because it's a predictable page that isn't Element
        // itself. We could use example.org, matrix.org, or something else, however this
        // puts dependency of external infrastructure on our tests. In the same vein, we
        // don't really want to figure out how to ship a `test-landing.html` page when
        // running with an uncontrolled Element (via `./run.sh --app-url http://localhost:8080`).
        // Using the config.json is just as fine, and we can search for strategic names.
        'logout_redirect_url': '/config.json',
    });

    await logoutCanCauseRedirect(session);
}

async function logoutCanCauseRedirect(session: ElementSession): Promise<void> {
    await logout(session, false); // we'll check the login page ourselves, so don't assert

    session.log.step("waits for redirect to config.json (as external page)");
    const foundLoginUrl = await session.poll(async () => {
        const url = session.page.url();
        return url === session.url('/config.json');
    });
    assert(foundLoginUrl);
    session.log.done();
}
