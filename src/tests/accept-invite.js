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
const {acceptDialogMaybe} = require('./dialog');

module.exports = async function acceptInvite(session, name) {
  session.log.step(`accepts "${name}" invite`);
  //TODO: brittle selector
  const invitesHandles = await session.waitAndQueryAll('.mx_RoomTile_name.mx_RoomTile_invite', 1000);
  const invitesWithText = await Promise.all(invitesHandles.map(async (inviteHandle) => {
  	const text = await session.innerText(inviteHandle);
  	return {inviteHandle, text};
  }));
  const inviteHandle = invitesWithText.find(({inviteHandle, text}) => {
	return text.trim() === name;
  }).inviteHandle;

  await inviteHandle.click();

  const acceptInvitationLink = await session.waitAndQuery(".mx_RoomPreviewBar_join_text a:first-child");
  await acceptInvitationLink.click();

  // accept e2e warning dialog
  try {
    acceptDialogMaybe(session, "encryption");
  } catch(err) {}

  session.log.done();
}