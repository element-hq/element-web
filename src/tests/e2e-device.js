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

module.exports = async function getE2EDeviceFromSettings(session) {
  session.log.step(`gets e2e device/key from settings`);
  const settingsButton = await session.query('.mx_BottomLeftMenu_settings');
  await settingsButton.click();
  const deviceAndKey = await session.waitAndQueryAll(".mx_UserSettings_section.mx_UserSettings_cryptoSection code");
  assert.equal(deviceAndKey.length, 2);
  const id = await (await deviceAndKey[0].getProperty("innerText")).jsonValue();
  const key = await (await deviceAndKey[1].getProperty("innerText")).jsonValue();
  const closeButton = await session.query(".mx_RoomHeader_cancelButton");
  await closeButton.click();
  session.log.done();
  return {id, key};
}