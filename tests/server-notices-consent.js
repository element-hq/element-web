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

module.exports = async function acceptServerNoticesInviteAndConsent(page, name) {
  //TODO: brittle selector
  const invitesHandles = await helpers.waitAndQueryAll(page, '.mx_RoomTile_name.mx_RoomTile_invite');
  const invitesWithText = await Promise.all(invitesHandles.map(async (inviteHandle) => {
  	const text = await helpers.innerText(page, inviteHandle);
  	return {inviteHandle, text};
  }));
  const inviteHandle = invitesWithText.find(({inviteHandle, text}) => {
	return text.trim() === name;
  }).inviteHandle;

  await inviteHandle.click();

  const acceptInvitationLink = await helpers.waitAndQuerySelector(page, ".mx_RoomPreviewBar_join_text a:first-child");
  await acceptInvitationLink.click();

  const consentLink = await helpers.waitAndQuerySelector(page, ".mx_EventTile_body a", 1000);

  const termsPagePromise = helpers.waitForNewPage();
  await consentLink.click();
  const termsPage = await termsPagePromise;
  const acceptButton = await termsPage.$('input[type=submit]');
  await acceptButton.click();
  await helpers.delay(500); //TODO yuck, timers
} 