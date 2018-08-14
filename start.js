/*
Copyright 2018 New Vector Ltd

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

const assert = require('assert');
const RiotSession = require('./src/session');
const scenario = require('./src/scenario');

const riotserver = 'http://localhost:5000';

const noLogs = process.argv.indexOf("--no-logs") !== -1;
const debug = process.argv.indexOf("--debug") !== -1;

async function runTests() {
    let sessions = [];

    console.log("running tests ...");
    const options = {};
    if (debug) {
        options.slowMo = 20;
        options.headless = false;
    }
    if (process.env.CHROME_PATH) {
        const path = process.env.CHROME_PATH;
        console.log(`(using external chrome/chromium at ${path}, make sure it's compatible with puppeteer)`);
        options.executablePath = path;
    }

    async function createSession(username) {
        const session = await RiotSession.create(username, options, riotserver);
        sessions.push(session);
        return session;
    }

    let failure = false;
    try {
        await scenario(createSession);
    } catch(err) {
        failure = true;
        console.log('failure: ', err);
        if (!noLogs) {
            for(let i = 0; i < sessions.length; ++i) {
                const session = sessions[i];
                documentHtml = await session.page.content();
                console.log(`---------------- START OF ${session.username} LOGS ----------------`);
                console.log('---------------- console.log output:');
                console.log(session.consoleLogs());
                console.log('---------------- network requests:');
                console.log(session.networkLogs());
                console.log('---------------- document html:');
                console.log(documentHtml);
                console.log(`---------------- END OF ${session.username} LOGS   ----------------`);
            }
        }
    }

    // wait 5 minutes on failure if not running headless
    // to inspect what went wrong
    if (failure && options.headless === false) {
        await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
    }

    await Promise.all(sessions.map((session) => session.close()));

    if (failure) {
        process.exit(-1);
    } else {
        console.log('all tests finished successfully');
    }
}

runTests().catch(function(err) {
    console.log(err);
    process.exit(-1);
});