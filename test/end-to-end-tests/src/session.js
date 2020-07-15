/*
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

const puppeteer = require('puppeteer');
const Logger = require('./logger');
const LogBuffer = require('./logbuffer');
const {delay} = require('./util');

const DEFAULT_TIMEOUT = 20000;

module.exports = class RiotSession {
    constructor(browser, page, username, riotserver, hsUrl) {
        this.browser = browser;
        this.page = page;
        this.hsUrl = hsUrl;
        this.riotserver = riotserver;
        this.username = username;
        this.consoleLog = new LogBuffer(page, "console", (msg) => `${msg.text()}\n`);
        this.networkLog = new LogBuffer(page, "requestfinished", async (req) => {
            const type = req.resourceType();
            const response = await req.response();
            return `${type} ${response.status()} ${req.method()} ${req.url()} \n`;
        }, true);
        this.log = new Logger(this.username);
    }

    static async create(username, puppeteerOptions, riotserver, hsUrl, throttleCpuFactor = 1) {
        const browser = await puppeteer.launch(puppeteerOptions);
        const page = await browser.newPage();
        await page.setViewport({
            width: 1280,
            height: 800,
        });
        if (throttleCpuFactor !== 1) {
            const client = await page.target().createCDPSession();
            console.log("throttling cpu by a factor of", throttleCpuFactor);
            await client.send('Emulation.setCPUThrottlingRate', { rate: throttleCpuFactor });
        }
        return new RiotSession(browser, page, username, riotserver, hsUrl);
    }

    async tryGetInnertext(selector) {
        const field = await this.page.$(selector);
        if (field != null) {
            const textHandle = await field.getProperty('innerText');
            return await textHandle.jsonValue();
        }
        return null;
    }

    async getElementProperty(handle, property) {
        const propHandle = await handle.getProperty(property);
        return await propHandle.jsonValue();
    }

    innerText(field) {
        return this.getElementProperty(field, 'innerText');
    }

    getOuterHTML(field) {
        return this.getElementProperty(field, 'outerHTML');
    }

    isChecked(field) {
        return this.getElementProperty(field, 'checked');
    }

    consoleLogs() {
        return this.consoleLog.buffer;
    }

    networkLogs() {
        return this.networkLog.buffer;
    }

    logXHRRequests() {
        let buffer = "";
        this.page.on('requestfinished', async (req) => {
            const type = req.resourceType();
            const response = await req.response();
            //if (type === 'xhr' || type === 'fetch') {
                buffer += `${type} ${response.status()} ${req.method()} ${req.url()} \n`;
                // if (req.method() === "POST") {
                //   buffer += "  Post data: " + req.postData();
                // }
            //}
        });
        return {
            logs() {
                return buffer;
            },
        };
    }

    async printElements(label, elements) {
        console.log(label, await Promise.all(elements.map(this.getOuterHTML)));
    }

    async replaceInputText(input, text) {
        // click 3 times to select all text
        await input.click({clickCount: 3});
        // waiting here solves not having selected all the text by the 3x click above,
        // presumably because of the Field label animation.
        await this.delay(300);
        // then remove it with backspace
        await input.press('Backspace');
        // and type the new text
        await input.type(text);
    }

    query(selector, timeout = DEFAULT_TIMEOUT, hidden = false) {
        return this.page.waitForSelector(selector, {visible: true, timeout, hidden});
    }

    async queryAll(selector) {
        const timeout = DEFAULT_TIMEOUT;
        await this.query(selector, timeout);
        return await this.page.$$(selector);
    }

    waitForReload() {
        const timeout = DEFAULT_TIMEOUT;
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.browser.removeEventListener('domcontentloaded', callback);
                reject(new Error(`timeout of ${timeout}ms for waitForReload elapsed`));
            }, timeout);

            const callback = async () => {
                clearTimeout(timeoutHandle);
                resolve();
            };

            this.page.once('domcontentloaded', callback);
        });
    }

    waitForNewPage() {
        const timeout = DEFAULT_TIMEOUT;
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.browser.removeListener('targetcreated', callback);
                reject(new Error(`timeout of ${timeout}ms for waitForNewPage elapsed`));
            }, timeout);

            const callback = async (target) => {
                if (target.type() !== 'page') {
                    return;
                }
                this.browser.removeListener('targetcreated', callback);
                clearTimeout(timeoutHandle);
                const page = await target.page();
                resolve(page);
            };

            this.browser.on('targetcreated', callback);
        });
    }

    /** wait for a /sync request started after this call that gets a 200 response */
    async waitForNextSuccessfulSync() {
        const syncUrls = [];
        function onRequest(request) {
            if (request.url().indexOf("/sync") !== -1) {
                syncUrls.push(request.url());
            }
        }

        this.page.on('request', onRequest);

        await this.page.waitForResponse((response) => {
            return syncUrls.includes(response.request().url()) && response.status() === 200;
        });

        this.page.removeListener('request', onRequest);
    }

    goto(url) {
        return this.page.goto(url);
    }

    url(path) {
        return this.riotserver + path;
    }

    delay(ms) {
        return delay(ms);
    }

    async setOffline(enabled) {
        const description = enabled ? "offline" : "back online";
        this.log.step(`goes ${description}`);
        await this.page.setOfflineMode(enabled);
        this.log.done();
    }

    close() {
        return this.browser.close();
    }

    async poll(callback, interval = 100) {
        const timeout = DEFAULT_TIMEOUT;
        let waited = 0;
        while (waited < timeout) {
            await this.delay(interval);
            waited += interval;
            if (await callback()) {
                return true;
            }
        }
        return false;
    }
};
