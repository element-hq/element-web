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

const assert = require('assert');

module.exports = async function createRoom(session, roomName) {
  session.log.step(`creates room ${roomName}`);
  //TODO: brittle selector
  const createRoomButton = await session.waitAndQuerySelector('.mx_RoleButton[aria-label="Create new room"]');
  await createRoomButton.click();

  const roomNameInput = await session.waitAndQuerySelector('.mx_CreateRoomDialog_input');
  await session.replaceInputText(roomNameInput, roomName);

  const createButton = await session.waitAndQuerySelector('.mx_Dialog_primary');
  await createButton.click();

  await session.waitForSelector('.mx_MessageComposer');
  session.log.done();
}