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

module.exports = async function createRoom(page, roomName) {
  //TODO: brittle selector
  const createRoomButton = await helpers.waitAndQuerySelector(page, '.mx_RoleButton[aria-label="Create new room"]');
  await createRoomButton.click();

  const roomNameInput = await helpers.waitAndQuerySelector(page, '.mx_CreateRoomDialog_input');
  await helpers.replaceInputText(roomNameInput, roomName);

  const createButton = await helpers.waitAndQuerySelector(page, '.mx_Dialog_primary');
  await createButton.click();

  await page.waitForSelector('.mx_MessageComposer');
}