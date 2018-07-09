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

module.exports = async function join_room(page, room_name) {
  //TODO: brittle selector
  const directory_button = await helpers.wait_and_query_selector(page, '.mx_RoleButton[aria-label="Room directory"]');
  await directory_button.click();

  const room_input = await helpers.wait_and_query_selector(page, '.mx_DirectorySearchBox_input');
  await helpers.replace_input_text(room_input, room_name);

  const first_room_label = await helpers.wait_and_query_selector(page, '.mx_RoomDirectory_table .mx_RoomDirectory_name:first-child');
  await first_room_label.click();

  const join_link = await helpers.wait_and_query_selector(page, '.mx_RoomPreviewBar_join_text a');
  await join_link.click();

  await page.waitForSelector('.mx_MessageComposer');
}