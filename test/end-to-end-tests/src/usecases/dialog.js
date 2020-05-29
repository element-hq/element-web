/*
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

async function assertDialog(session, expectedTitle) {
    const titleElement = await session.query(".mx_Dialog .mx_Dialog_title");
    const dialogHeader = await session.innerText(titleElement);
    assert.equal(dialogHeader, expectedTitle);
}

async function acceptDialog(session, expectedTitle) {
    const foundDialog = await acceptDialogMaybe(session, expectedTitle);
    if (!foundDialog) {
        throw new Error("could not find a dialog");
    }
}

async function acceptDialogMaybe(session, expectedTitle) {
    let primaryButton = null;
    try {
        primaryButton = await session.query(".mx_Dialog .mx_Dialog_primary");
    } catch (err) {
        return false;
    }
    if (expectedTitle) {
        await assertDialog(session, expectedTitle);
    }
    await primaryButton.click();
    return true;
}

module.exports = {
    assertDialog,
    acceptDialog,
    acceptDialogMaybe,
};
