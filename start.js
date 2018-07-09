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
const helpers = require('./helpers');
const assert = require('assert');
const do_signup = require('./tests/signup');
const test_title = require('./tests/loads');
const join_room = require('./tests/join_room');

global.riotserver = 'http://localhost:8080';
global.homeserver = 'http://localhost:8008';
global.browser = null;

async function run_tests() {
  await start_session();

  process.stdout.write(`* testing riot loads ... `);
  await test_title();
  process.stdout.write('done\n');



  const page = await helpers.new_page();
  const username = 'bruno-' + helpers.rnd_int(10000);
  const password = 'testtest';
  process.stdout.write(`* signing up as ${username} ... `);
  await do_signup(page, username, password, homeserver);
  process.stdout.write('done\n');

  const room = 'test';
  process.stdout.write(`* joining room ${room} ... `);
  await join_room(page, room);
  process.stdout.write('done\n');

  await end_session();
}

async function start_session() {
  global.browser = await puppeteer.launch();
}

function end_session() {
  return browser.close();
}

function on_success() {
  console.log('all tests finished successfully');
}

function on_failure(err) {
  console.log('failure: ', err);
  process.exit(-1);
}

run_tests().then(on_success, on_failure);