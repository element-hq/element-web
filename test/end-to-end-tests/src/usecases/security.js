/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

const { acceptToast } = require("./toasts");

async function setupSecureBackup(session) {
    session.log.step("sets up Secure Backup");

    await acceptToast(session, "Set up Secure Backup");

    // Continue with the default (generate a security key)
    const xsignContButton = await session.query('.mx_CreateSecretStorageDialog .mx_Dialog_buttons .mx_Dialog_primary');
    await xsignContButton.click();

    //ignore the recovery key
    //TODO: It's probably important for the tests to know the recovery key
    const copyButton = await session.query('.mx_CreateSecretStorageDialog_recoveryKeyButtons_copyBtn');
    await copyButton.click();

    //acknowledge that we copied the recovery key to a safe place
    const copyContinueButton = await session.query(
        '.mx_CreateSecretStorageDialog .mx_Dialog_buttons .mx_Dialog_primary',
    );
    await copyContinueButton.click();

    session.log.done();
}

module.exports = { setupSecureBackup };
