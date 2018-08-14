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


async function getMessageFromTile(eventTile) {
}

module.exports = async function receiveMessage(session, message) {
  session.log.step(`receives message "${message.body}" from ${message.sender} in room`);
  // wait for a response to come in that contains the message
  // crude, but effective
  await session.page.waitForResponse(async (response) => {
    const body = await response.text();
    return body.indexOf(message.body) !== -1;
  });
  // wait a bit for the incoming event to be rendered
  await session.delay(100);
  let lastTile = await session.query(".mx_EventTile_last");
  const senderElement = await lastTile.$(".mx_SenderProfile_name");
  const bodyElement = await lastTile.$(".mx_EventTile_body");
  const sender = await(await senderElement.getProperty("innerText")).jsonValue();
  const body = await(await bodyElement.getProperty("innerText")).jsonValue();
  
  assert.equal(body, message.body);
  assert.equal(sender, message.sender);
  session.log.done();
}