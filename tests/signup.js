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

const helpers = require('../helpers');
const assert = require('assert');

module.exports = async function do_signup(page, username, password, homeserver) {
  const console_logs = helpers.log_console(page);
  const xhr_logs = helpers.log_xhr_requests(page);
  await page.goto(helpers.riot_url('/#/register'));
  //click 'Custom server' radio button
  await page.waitForSelector('#advanced', {visible: true, timeout: 500});
  await page.click('#advanced');

  //fill out form
  await page.waitForSelector('.mx_ServerConfig', {visible: true, timeout: 500});
  const login_fields = await page.$$('.mx_Login_field');
  assert.strictEqual(login_fields.length, 7);
  const username_field = login_fields[2];
  const password_field = login_fields[3];
  const password_repeat_field = login_fields[4];
  const hsurl_field = login_fields[5];
  await helpers.replace_input_text(username_field, username);
  await helpers.replace_input_text(password_field, password);
  await helpers.replace_input_text(password_repeat_field, password);
  await helpers.replace_input_text(hsurl_field, homeserver);
  //wait over a second because Registration/ServerConfig have a 1000ms
  //delay to internally set the homeserver url
  //see Registration::render and ServerConfig::props::delayTimeMs
  await helpers.delay(1200);
  /// focus on the button to make sure error validation
  /// has happened before checking the form is good to go
  const register_button = await page.$('.mx_Login_submit');
  await register_button.focus();
  //check no errors
  const error_text = await helpers.try_get_innertext(page, '.mx_Login_error');
  assert.strictEqual(!!error_text, false);
  //submit form
  await page.screenshot({path: "beforesubmit.png", fullPage: true});
  await register_button.click();

  //confirm dialog saying you cant log back in without e-mail
  await page.waitForSelector('.mx_QuestionDialog', {visible: true, timeout: 500});
  const continue_button = await page.$('.mx_QuestionDialog button.mx_Dialog_primary');
  //await helpers.print_elements('continue_button', [continue_button]);
  await continue_button.click();
  //wait for registration to finish so the hash gets set
  //onhashchange better?
  await helpers.delay(1000);
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
  assert.strictEqual(url, helpers.riot_url('/#/home'));
}