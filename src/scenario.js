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


const signup = require('./tests/signup');
const join = require('./tests/join');
const sendMessage = require('./tests/send-message');
const receiveMessage = require('./tests/receive-message');
const createRoom = require('./tests/create-room');
const changeRoomSettings = require('./tests/room-settings');
const acceptServerNoticesInviteAndConsent = require('./tests/server-notices-consent');

module.exports = async function scenario(createSession) {
  async function createUser(username) {
    const session = await createSession(username);
    await signup(session, session.username, 'testtest');
    const noticesName = "Server Notices";
    await acceptServerNoticesInviteAndConsent(session, noticesName);
    return session;
  }

  const alice = await createUser("alice");
  const bob = await createUser("bob");

  await createDirectoryRoomAndTalk(alice, bob);
}

async function createDirectoryRoomAndTalk(alice, bob) {
  console.log(" creating a public room and join through directory:");
  const room = 'test';
  const message = "hi Alice!";
  await createRoom(alice, room);
  await changeRoomSettings(alice, {directory: true, visibility: "public_no_guests"});
  await join(bob, room);
  await sendMessage(bob, message);
  await receiveMessage(alice, {sender: "bob", body: message});
} 

async function createE2ERoomAndTalk(alice, bob) {
  await createRoom(bob, "secrets");
  await changeRoomSettings(bob, {encryption: true});
  await invite(bob, "@alice:localhost");
  await acceptInvite(alice, "secrets");
}