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
const riotserver = 'http://localhost:8080';
const homeserver = 'http://localhost:8008';
let browser = null;

jest.setTimeout(10000);

async function try_get_innertext(page, selector) {
  const field = await page.$(selector);
  if (field != null) {
    const text_handle = await field.getProperty('innerText');
    return await text_handle.jsonValue();
  }
  return null;
}

async function new_page() {
  const page = await browser.newPage();
  await page.setViewport({
    width: 1280,
    height: 800
  });
  return page;
}

function log_console(page) {
  let buffer = "";
  page.on('console', msg => {
    buffer += msg.text() + '\n';
  });
  return {
    logs() {
      return buffer;
    }
  }
}

function log_xhr_requests(page) {
  let buffer = "";
  page.on('request', req => {
    const type = req.resourceType();
    if (type === 'xhr' || type === 'fetch') {
      buffer += `${req.method()} ${req.url()} \n`;
      if (req.method() === "POST") {
        buffer += "  Post data: " + req.postData();
      }
    }
  });
  return {
    logs() {
      return buffer;
    }
  }
}

function rnd_int(max) {
  return Math.ceil(Math.random()*max);
}

function riot_url(path) {
  return riotserver + path;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function get_outer_html(element_handle) {
  const html_handle = await element_handle.getProperty('outerHTML');
  return await html_handle.jsonValue();
}

async function print_elements(label, elements) {
  console.log(label, await Promise.all(elements.map(get_outer_html)));
}

async function replace_input_text(input, text) {
  // click 3 times to select all text
  await input.click({clickCount: 3});
  // then remove it with backspace
  await input.press('Backspace');
  // and type the new text
  await input.type(text);
}

beforeAll(async () => {
  browser = await puppeteer.launch();
});

afterAll(() => {
  return browser.close();
})

test('test page loads', async () => {
  const page = await browser.newPage();
  await page.goto(riot_url('/'));
  const title = await page.title();
  expect(title).toBe("Riot");
});

test('test signup', async () => {
  const page = await new_page();
  const console_logs = log_console(page);
  const xhr_logs = log_xhr_requests(page);
  await page.goto(riot_url('/#/register'));
  //click 'Custom server' radio button
  await page.waitForSelector('#advanced', {visible: true, timeout: 500});
  await page.click('#advanced');

  const username = 'bruno-' + rnd_int(10000);
  const password = 'testtest';
  //fill out form
  await page.waitForSelector('.mx_ServerConfig', {visible: true, timeout: 500});
  const login_fields = await page.$$('.mx_Login_field');
  expect(login_fields.length).toBe(7);
  const username_field = login_fields[2];
  const password_field = login_fields[3];
  const password_repeat_field = login_fields[4];
  const hsurl_field = login_fields[5];
  await replace_input_text(username_field, username);
  await replace_input_text(password_field, password);
  await replace_input_text(password_repeat_field, password);
  await replace_input_text(hsurl_field, homeserver);
  //wait over a second because Registration/ServerConfig have a 1000ms
  //delay to internally set the homeserver url
  //see Registration::render and ServerConfig::props::delayTimeMs
  await delay(1200);
  /// focus on the button to make sure error validation
  /// has happened before checking the form is good to go
  const register_button = await page.$('.mx_Login_submit');
  await register_button.focus();
  //check no errors
  const error_text = await try_get_innertext(page, '.mx_Login_error');
  expect(error_text).toBeFalsy();
  //submit form
  await page.screenshot({path: "beforesubmit.png", fullPage: true});
  await register_button.click();

  //confirm dialog saying you cant log back in without e-mail
  await page.waitForSelector('.mx_QuestionDialog', {visible: true, timeout: 500});
  const continue_button = await page.$('.mx_QuestionDialog button.mx_Dialog_primary');
  print_elements('continue_button', [continue_button]);
  await continue_button.click();
  //wait for registration to finish so the hash gets set
  //onhashchange better?
  await delay(1000);
/*
  await page.screenshot({path: "afterlogin.png", fullPage: true});
  console.log('browser console logs:');
  console.log(console_logs.logs());
  console.log('xhr logs:');
  console.log(xhr_logs.logs());
*/


  //print_elements('page', await page.$('#matrixchat'));
//  await navigation_promise;

  //await page.waitForSelector('.mx_MatrixChat', {visible: true, timeout: 3000});
  const url = page.url();
  expect(url).toBe(riot_url('/#/home'));
});
