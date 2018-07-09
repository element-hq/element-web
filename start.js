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

const signup = require('./tests/signup');
const join = require('./tests/join');

global.riotserver = 'http://localhost:8080';
global.homeserver = 'http://localhost:8008';
global.browser = null;

async function runTests() {
  await startSession();
  const page = await helpers.newPage();
  const username = 'bruno-' + helpers.randomInt(10000);
  const password = 'testtest';
  process.stdout.write(`* signing up as ${username} ... `);
  await signup(page, username, password, homeserver);
  process.stdout.write('done\n');

  const room = 'test';
  process.stdout.write(`* joining room ${room} ... `);
  await join(page, room);
  process.stdout.write('done\n');

  await endSession();
}

async function startSession() {
  global.browser = await puppeteer.launch();
}

function endSession() {
  return browser.close();
}

function onSuccess() {
  console.log('all tests finished successfully');
}

function onFailure(err) {
  console.log('failure: ', err);
  process.exit(-1);
}

runTests().then(onSuccess, onFailure);