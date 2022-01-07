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

import * as puppeteer from 'puppeteer';

import { Logger } from './logger';
import { LogBuffer } from './logbuffer';
import { delay } from './util';

const DEFAULT_TIMEOUT = 20000;

interface XHRLogger {
    logs: () => string;
}

export class ElementSession {
    readonly consoleLog: LogBuffer<puppeteer.ConsoleMessage>;
    readonly networkLog: LogBuffer<puppeteer.HTTPRequest>;
    readonly log: Logger;

    constructor(readonly browser: puppeteer.Browser, readonly page: puppeteer.Page, readonly username: string,
                readonly elementServer: string, readonly hsUrl: string) {
        this.consoleLog = new LogBuffer(page, "console",
            async (msg: puppeteer.ConsoleMessage) => Promise.resolve(`${msg.text()}\n`));
        this.networkLog = new LogBuffer(page,
            "requestfinished", async (req: puppeteer.HTTPRequest) => {
                const type = req.resourceType();
                const response = await req.response();
                return `${type} ${response.status()} ${req.method()} ${req.url()} \n`;
            });
        this.log = new Logger(this.username);
    }

    public static async create(username: string, puppeteerOptions: Parameters<typeof puppeteer.launch>[0],
        elementServer: string, hsUrl: string, throttleCpuFactor = 1): Promise<ElementSession> {
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
        return new ElementSession(browser, page, username, elementServer, hsUrl);
    }

    public async tryGetInnertext(selector: string): Promise<string> {
        const field = await this.page.$(selector);
        if (field != null) {
            const textHandle = await field.getProperty('innerText');
            return await textHandle.jsonValue();
        }
        return null;
    }

    public async getElementProperty(handle: puppeteer.ElementHandle, property: string): Promise<string> {
        const propHandle = await handle.getProperty(property);
        return await propHandle.jsonValue();
    }

    public innerText(field: puppeteer.ElementHandle): Promise<string> {
        return this.getElementProperty(field, 'innerText');
    }

    public getOuterHTML(field: puppeteer.ElementHandle): Promise<string> {
        return this.getElementProperty(field, 'outerHTML');
    }

    public isChecked(field: puppeteer.ElementHandle): Promise<string> {
        return this.getElementProperty(field, 'checked');
    }

    public consoleLogs(): string {
        return this.consoleLog.buffer;
    }

    public networkLogs(): string {
        return this.networkLog.buffer;
    }

    public logXHRRequests(): XHRLogger {
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

    public async printElements(label: string, elements: puppeteer.ElementHandle[] ): Promise<void> {
        console.log(label, await Promise.all(elements.map(this.getOuterHTML)));
    }

    public async replaceInputText(input: puppeteer.ElementHandle, text: string): Promise<void> {
        // click 3 times to select all text
        await input.click({ clickCount: 3 });
        // waiting here solves not having selected all the text by the 3x click above,
        // presumably because of the Field label animation.
        await this.delay(300);
        // then remove it with backspace
        await input.press('Backspace');
        // and type the new text
        await input.type(text);
    }

    public query(selector: string, timeout: number = DEFAULT_TIMEOUT,
        hidden = false): Promise<puppeteer.ElementHandle> {
        return this.page.waitForSelector(selector, { visible: true, timeout, hidden });
    }

    public async queryAll(selector: string): Promise<puppeteer.ElementHandle[]> {
        const timeout = DEFAULT_TIMEOUT;
        await this.query(selector, timeout);
        return await this.page.$$(selector);
    }

    public waitForReload(): Promise<void> {
        const timeout = DEFAULT_TIMEOUT;
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.page.off('domcontentloaded', callback);
                reject(new Error(`timeout of ${timeout}ms for waitForReload elapsed`));
            }, timeout);

            const callback = async () => {
                clearTimeout(timeoutHandle);
                resolve();
            };

            this.page.once('domcontentloaded', callback);
        });
    }

    public waitForNewPage(): Promise<void> {
        const timeout = DEFAULT_TIMEOUT;
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.browser.off('targetcreated', callback);
                reject(new Error(`timeout of ${timeout}ms for waitForNewPage elapsed`));
            }, timeout);

            const callback = async (target) => {
                if (target.type() !== 'page') {
                    return;
                }
                this.browser.off('targetcreated', callback);
                clearTimeout(timeoutHandle);
                const page = await target.page();
                resolve(page);
            };

            this.browser.on('targetcreated', callback);
        });
    }

    /** wait for a /sync request started after this call that gets a 200 response */
    public async waitForNextSuccessfulSync(): Promise<void> {
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

        this.page.off('request', onRequest);
    }

    public goto(url: string): Promise<puppeteer.HTTPResponse> {
        return this.page.goto(url);
    }

    public url(path: string): string {
        return this.elementServer + path;
    }

    public delay(ms: number) {
        return delay(ms);
    }

    public async setOffline(enabled: boolean): Promise<void> {
        const description = enabled ? "offline" : "back online";
        this.log.step(`goes ${description}`);
        await this.page.setOfflineMode(enabled);
        this.log.done();
    }

    public async close(): Promise<void> {
        return this.browser.close();
    }

    public async poll(callback: () => Promise<boolean>, interval = 100): Promise<boolean> {
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
}
