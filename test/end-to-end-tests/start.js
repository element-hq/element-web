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

const ElementSession = require('./src/session');
const scenario = require('./src/scenario');
const RestSessionCreator = require('./src/rest/creator');
const fs = require("fs");

const program = require('commander');
program
    .option('--no-logs', "don't output logs, document html on error", false)
    .option('--app-url [url]', "url to test", "http://localhost:5000")
    .option('--windowed', "dont run tests headless", false)
    .option('--slow-mo', "type at a human speed", false)
    .option('--dev-tools', "open chrome devtools in browser window", false)
    .option('--throttle-cpu [factor]', "factor to slow down the cpu with", parseFloat, 1.0)
    .option('--no-sandbox', "same as puppeteer arg", false)
    .option('--log-directory <dir>', 'a directory to dump html and network logs in when the tests fail')
    .parse(process.argv);

const hsUrl = 'http://localhost:5005';

async function runTests() {
    const sessions = [];
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
        'synapse/installations/consent/env/bin',
        hsUrl,
        __dirname,
    );

    async function createSession(username) {
        const session = await ElementSession.create(username, options, program.appUrl, hsUrl, program.throttleCpu);
        sessions.push(session);
        return session;
    }

    let failure = false;
    try {
        await scenario(createSession, restCreator);
    } catch (err) {
        failure = true;
        console.log('failure: ', err);
        if (program.logDirectory) {
            await writeLogs(sessions, program.logDirectory);
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

async function writeLogs(sessions, dir) {
    const logs = "";
    for (let i = 0; i < sessions.length; ++i) {
        const session = sessions[i];
        const userLogDir = `${dir}/${session.username}`;
        try {
            fs.mkdirSync(userLogDir);
        } catch (e) {
            // typically this will be EEXIST. If it's something worse, the next few
            // lines will fail too.
            console.warn(`non-fatal error creating ${userLogDir} :`, e.message);
        }
        const consoleLogName = `${userLogDir}/console.log`;
        const networkLogName = `${userLogDir}/network.log`;
        const appHtmlName = `${userLogDir}/app.html`;
        const documentHtml = await session.page.content();
        fs.writeFileSync(appHtmlName, documentHtml);
        fs.writeFileSync(networkLogName, session.networkLogs());
        fs.writeFileSync(consoleLogName, session.consoleLogs());
        await session.page.screenshot({path: `${userLogDir}/screenshot.png`});
    }
    return logs;
}

runTests().catch(function(err) {
    console.log(err);
    process.exit(-1);
});
