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

const puppeteer = require('puppeteer');

class LogBuffer {
  constructor(page, eventName, eventMapper, reduceAsync=false, initialValue = "") {
    this.buffer = initialValue;
    page.on(eventName, (arg) => {
      const result = eventMapper(arg);
      if (reduceAsync) {
        result.then((r) => this.buffer += r);
      }
      else {
        this.buffer += result;
      }
    });
  }
}

class Logger {
  constructor(username) {
    this.username = username;
  }

  step(description) {
    process.stdout.write(` * ${this.username} ${description} ... `);
  }

  done() {
    process.stdout.write("done\n");
  }
}

module.exports = class RiotSession {
  constructor(browser, page, username, riotserver) {
    this.browser = browser;
    this.page = page;
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

  static async create(username, puppeteerOptions, riotserver) {
    const browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();
    await page.setViewport({
      width: 1280,
      height: 800
    });
    return new RiotSession(browser, page, username, riotserver);
  }

  async tryGetInnertext(selector) {
    const field = await this.page.$(selector);
    if (field != null) {
      const text_handle = await field.getProperty('innerText');
      return await text_handle.jsonValue();
    }
    return null;
  }

  async innerText(field) {
    const text_handle = await field.getProperty('innerText');
    return await text_handle.jsonValue();
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
      }
    }
  }

  async getOuterHTML(element_handle) {
    const html_handle = await element_handle.getProperty('outerHTML');
    return await html_handle.jsonValue();
  }

  async printElements(label, elements) {
    console.log(label, await Promise.all(elements.map(getOuterHTML)));
  }

  async replaceInputText(input, text) {
    // click 3 times to select all text
    await input.click({clickCount: 3});
    // then remove it with backspace
    await input.press('Backspace');
    // and type the new text
    await input.type(text);
  }

  // TODO: rename to waitAndQuery(Single)?
  async waitAndQuerySelector(selector, timeout = 500) {
    await this.page.waitForSelector(selector, {visible: true, timeout});
    return await this.page.$(selector);
  }

  async waitAndQueryAll(selector, timeout = 500) {
    await this.page.waitForSelector(selector, {visible: true, timeout});
    return await this.page.$$(selector);
  }

  waitForNewPage(timeout = 500) {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.browser.removeEventListener('targetcreated', callback);
        reject(new Error(`timeout of ${timeout}ms for waitForNewPage elapsed`));
      }, timeout);

      const callback = async (target) => {
        clearTimeout(timeoutHandle);
        const page = await target.page();
        resolve(page);
      };

      this.browser.once('targetcreated', callback);
    });
  }

  waitForSelector(selector) {
    return this.page.waitForSelector(selector);
  }

  goto(url) {
    return this.page.goto(url);
  }

  riotUrl(path) {
    return this.riotserver + path;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  close() {
    return this.browser.close();
  }
}
