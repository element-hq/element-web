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


async function acceptDialog(session, expectedContent) {
	const foundDialog = await acceptDialogMaybe(session, expectedContent);
	if (!foundDialog) {
		throw new Error("could not find a dialog");
	}
}

async function acceptDialogMaybe(session, expectedContent) {
	let dialog = null;
	try {
		dialog = await session.waitAndQuery(".mx_QuestionDialog", 100);
	} catch(err) {
		return false;
	}
	if (expectedContent) {
		const contentElement = await dialog.$(".mx_Dialog_content");
		const content = await (await contentElement.getProperty("innerText")).jsonValue();
		assert.ok(content.indexOf(expectedContent) !== -1);
	}
	const primaryButton = await dialog.$(".mx_Dialog_primary");
	await primaryButton.click();
	return true;
}

module.exports = {
	acceptDialog,
	acceptDialogMaybe,
};