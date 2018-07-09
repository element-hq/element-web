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

// puppeteer helpers

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

// other helpers

function rnd_int(max) {
  return Math.ceil(Math.random()*max);
}

function riot_url(path) {
  return riotserver + path;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  try_get_innertext,
  new_page,
  log_console,
  log_xhr_requests,
  get_outer_html,
  print_elements,
  replace_input_text,
  rnd_int,
  riot_url,
  delay,
}