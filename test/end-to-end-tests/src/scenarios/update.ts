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

import { HTTPRequest } from "puppeteer";
import { strict as assert } from 'assert';

import { ElementSession } from "../session";

const NEW_VERSION = "some-new-version";

async function mockVersionHTTPResponse(session: ElementSession) {
    // Mock the HTTP response to return a new version to trigger auto-update behaviour
    await session.page.setRequestInterception(true);
    session.page.on('request', (request: HTTPRequest) => {
        if (request.isInterceptResolutionHandled()) return;
        const url = new URL(request.url());
        if (url.pathname === "/version") {
            request.respond({
                contentType: "text/html",
                status: 200,
                body: NEW_VERSION,
            });
        } else {
            request.continue();
        }
    });
}

export async function updateScenarios(session: ElementSession) {
    // Mock the HTTP response to return a newer version, then wait for the page to reload in response
    await mockVersionHTTPResponse(session);
    await session.goto(session.url('/'));
    await session.waitForReload();
    const newUrl = new URL(session.page.url());
    assert.equal(newUrl.searchParams.get("updated"), NEW_VERSION);
}
