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


const {acceptDialog} = require('./tests/dialog');
const signup = require('./tests/signup');
const join = require('./tests/join');
const sendMessage = require('./tests/send-message');
const acceptInvite = require('./tests/accept-invite');
const invite = require('./tests/invite');
const receiveMessage = require('./tests/receive-message');
const createRoom = require('./tests/create-room');
const changeRoomSettings = require('./tests/room-settings');
const acceptServerNoticesInviteAndConsent = require('./tests/server-notices-consent');
const getE2EDeviceFromSettings = require('./tests/e2e-device');
const verifyDeviceForUser = require("./tests/verify-device");

module.exports = async function scenario(createSession) {
  async function createUser(username) {
    const session = await createSession(username);
    await signup(session, session.username, 'testtest');
    await acceptServerNoticesInviteAndConsent(session);
    return session;
  }

  const alice = await createUser("alice");
  const bob = await createUser("bob");

  await createDirectoryRoomAndTalk(alice, bob);
  await createE2ERoomAndTalk(alice, bob);
}

async function createDirectoryRoomAndTalk(alice, bob) {
  console.log(" creating a public room and join through directory:");
  const room = 'test';
  await createRoom(alice, room);
  await changeRoomSettings(alice, {directory: true, visibility: "public_no_guests"});
  await join(bob, room);
  const bobMessage = "hi Alice!";
  await sendMessage(bob, bobMessage);
  await receiveMessage(alice, {sender: "bob", body: bobMessage});
  const aliceMessage = "hi Bob, welcome!"
  await sendMessage(alice, aliceMessage);
  await receiveMessage(bob, {sender: "alice", body: aliceMessage});
}

async function createE2ERoomAndTalk(alice, bob) {
  console.log(" creating an e2e encrypted room and join through invite:");
  const room = "secrets";
  await createRoom(bob, room);
  await changeRoomSettings(bob, {encryption: true});
  await invite(bob, "@alice:localhost");
  await acceptInvite(alice, room);
  const bobDevice = await getE2EDeviceFromSettings(bob);
  // wait some time for the encryption warning dialog
  // to appear after closing the settings
  await bob.delay(500);
  await acceptDialog(bob, "encryption");
  const aliceDevice = await getE2EDeviceFromSettings(alice);
  // wait some time for the encryption warning dialog
  // to appear after closing the settings
  await alice.delay(500);
  await acceptDialog(alice, "encryption");
  await verifyDeviceForUser(bob, "alice", aliceDevice);
  await verifyDeviceForUser(alice, "bob", bobDevice);
  const aliceMessage = "Guess what I just heard?!"
  await sendMessage(alice, aliceMessage);
  await receiveMessage(bob, {sender: "alice", body: aliceMessage, encrypted: true});
  const bobMessage = "You've got to tell me!";
  await sendMessage(bob, bobMessage);
  await receiveMessage(alice, {sender: "bob", body: bobMessage, encrypted: true});
}
