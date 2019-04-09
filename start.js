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
const RestSessionCreator = require('./src/rest/creator');
const fs = require("fs");

const program = require('commander');
program
    .option('--no-logs', "don't output logs, document html on error", false)
    .option('--riot-url [url]', "riot url to test", "http://localhost:5000")
    .option('--windowed', "dont run tests headless", false)
    .option('--slow-mo', "run tests slower to follow whats going on", false)
    .option('--dev-tools', "open chrome devtools in browser window", false)
    .option('--no-sandbox', "same as puppeteer arg", false)
    .option('--error-log <n>', 'stdout, or a file to dump html and network logs in when the tests fail')
    .parse(process.argv);

const hsUrl = 'http://localhost:5005';

async function runTests() {
    let sessions = [];
    const options = {
        slowMo: program.slowMo ? 20 : undefined,
        devtools: program.devTools,
        headless: !program.windowed,
        args: [],
    };
    if (!program.sandbox) {
        options.args.push('--no-sandbox', '--disable-setuid-sandbox');
    }
    if (process.env.CHROME_PATH) {
        const path = process.env.CHROME_PATH;
        console.log(`(using external chrome/chromium at ${path}, make sure it's compatible with puppeteer)`);
        options.executablePath = path;
    }

    const restCreator = new RestSessionCreator(
        'synapse/installations/consent',
        hsUrl,
        __dirname
    );

    async function createSession(username) {
        const session = await RiotSession.create(username, options, program.riotUrl, hsUrl);
        sessions.push(session);
        return session;
    }

    let failure = false;
    try {
        await scenario(createSession, restCreator);
    } catch(err) {
        failure = true;
        console.log('failure: ', err);
        if (program.errorLog) {
            const logs = await createLogs(sessions);
            if (program.errorLog === "stdout") {
                process.stdout.write(logs);
            } else {
                console.log(`wrote logs to "${program.errorLog}"`);
                fs.writeFileSync(program.errorLog, logs);
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

async function createLogs(sessions) {
    let logs = "";
    for(let i = 0; i < sessions.length; ++i) {
        const session = sessions[i];
        documentHtml = await session.page.content();
        logs = logs + `---------------- START OF ${session.username} LOGS ----------------\n`;
        logs = logs + '\n---------------- console.log output:\n';
        logs = logs + session.consoleLogs();
        logs = logs + '\n---------------- network requests:\n';
        logs = logs + session.networkLogs();
        logs = logs + '\n---------------- document html:\n';
        logs = logs + documentHtml;
        logs = logs + `\n---------------- END OF ${session.username} LOGS   ----------------\n`;
    }
    return logs;
}

runTests().catch(function(err) {
    console.log(err);
    process.exit(-1);
});
