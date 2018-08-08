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
const {acceptDialog} = require('./dialog');

async function setCheckboxSetting(session, checkbox, enabled) {
	const checked = await session.getElementProperty(checkbox, "checked");
	assert.equal(typeof checked, "boolean");
	if (checked !== enabled) {
		await checkbox.click();
		session.log.done();
		return true;
	} else {
		session.log.done("already set");
	}
}

module.exports = async function changeRoomSettings(session, settings) {
	session.log.startGroup(`changes the room settings`);
	/// XXX delay is needed here, possible because the header is being rerendered
	/// click doesn't do anything otherwise
	await session.delay(500);
	const settingsButton = await session.query(".mx_RoomHeader .mx_AccessibleButton[title=Settings]");
	await settingsButton.click();
	const checks = await session.waitAndQueryAll(".mx_RoomSettings_settings input[type=checkbox]");
	assert.equal(checks.length, 3);
	const e2eEncryptionCheck = checks[0];
	const sendToUnverifiedDevices = checks[1];
	const isDirectory = checks[2];

	if (typeof settings.directory === "boolean") {
		session.log.step(`sets directory listing to ${settings.directory}`);
		await setCheckboxSetting(session, isDirectory, settings.directory);
	}

	if (typeof settings.encryption === "boolean") {
		session.log.step(`sets room e2e encryption to ${settings.encryption}`);
		const clicked = await setCheckboxSetting(session, e2eEncryptionCheck, settings.encryption);
		// if enabling, accept beta warning dialog
		if (clicked && settings.encryption) {
			await acceptDialog(session, "encryption");
		}
	}

	if (settings.visibility) {
		session.log.step(`sets visibility to ${settings.visibility}`);
		const radios = await session.waitAndQueryAll(".mx_RoomSettings_settings input[type=radio]");
		assert.equal(radios.length, 7);
		const inviteOnly = radios[0];
		const publicNoGuests = radios[1];
		const publicWithGuests = radios[2];
		
		if (settings.visibility === "invite_only") {
			await inviteOnly.click();
		} else if (settings.visibility === "public_no_guests") {
			await publicNoGuests.click();
		} else if (settings.visibility === "public_with_guests") {
			await publicWithGuests.click();
		} else {
			throw new Error(`unrecognized room visibility setting: ${settings.visibility}`);
		}
		session.log.done();
	}

	const saveButton = await session.query(".mx_RoomHeader_wrapper .mx_RoomHeader_textButton");
	await saveButton.click();

	session.log.endGroup();
}