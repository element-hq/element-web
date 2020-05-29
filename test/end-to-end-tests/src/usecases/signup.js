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

module.exports = async function signup(session, username, password, homeserver) {
    session.log.step("signs up");
    await session.goto(session.url('/#/register'));
    // change the homeserver by clicking the advanced section
    if (homeserver) {
        const advancedButton = await session.query('.mx_ServerTypeSelector_type_Advanced');
        await advancedButton.click();

        // depending on what HS is configured as the default, the advanced registration
        // goes the HS/IS entry directly (for matrix.org) or takes you to the user/pass entry (not matrix.org).
        // To work with both, we look for the "Change" link in the user/pass entry but don't fail when we can't find it
        // As this link should be visible immediately, and to not slow down the case where it isn't present,
        // pick a lower timeout of 5000ms
        try {
            const changeHsField = await session.query('.mx_AuthBody_editServerDetails', 5000);
            if (changeHsField) {
                await changeHsField.click();
            }
        } catch (err) {}

        const hsInputField = await session.query('#mx_ServerConfig_hsUrl');
        await session.replaceInputText(hsInputField, homeserver);
        const nextButton = await session.query('.mx_Login_submit');
        // accept homeserver
        await nextButton.click();
    }
    //fill out form
    const usernameField = await session.query("#mx_RegistrationForm_username");
    const passwordField = await session.query("#mx_RegistrationForm_password");
    const passwordRepeatField = await session.query("#mx_RegistrationForm_passwordConfirm");
    await session.replaceInputText(usernameField, username);
    await session.replaceInputText(passwordField, password);
    await session.replaceInputText(passwordRepeatField, password);
    //wait 300ms because Registration/ServerConfig have a 250ms
    //delay to internally set the homeserver url
    //see Registration::render and ServerConfig::props::delayTimeMs
    await session.delay(300);
    /// focus on the button to make sure error validation
    /// has happened before checking the form is good to go
    const registerButton = await session.query('.mx_Login_submit');
    await registerButton.focus();
    // Password validation is async, wait for it to complete before submit
    await session.query(".mx_Field_valid #mx_RegistrationForm_password");
    //check no errors
    const errorText = await session.tryGetInnertext('.mx_Login_error');
    assert.strictEqual(errorText, null);
    //submit form
    //await page.screenshot({path: "beforesubmit.png", fullPage: true});
    await registerButton.click();

    //confirm dialog saying you cant log back in without e-mail
    const continueButton = await session.query('.mx_QuestionDialog button.mx_Dialog_primary');
    await continueButton.click();

    //find the privacy policy checkbox and check it
    const policyCheckbox = await session.query('.mx_InteractiveAuthEntryComponents_termsPolicy input');
    await policyCheckbox.click();

    //now click the 'Accept' button to agree to the privacy policy
    const acceptButton = await session.query('.mx_InteractiveAuthEntryComponents_termsSubmit');
    await acceptButton.click();

    //plow through cross-signing setup by entering arbitrary details
    //TODO: It's probably important for the tests to know the passphrase
    const xsigningPassphrase = 'a7eaXcjpa9!Yl7#V^h$B^%dovHUVX'; // https://xkcd.com/221/
    let passphraseField = await session.query('.mx_CreateSecretStorageDialog_passPhraseField input');
    await session.replaceInputText(passphraseField, xsigningPassphrase);
    await session.delay(1000); // give it a second to analyze our passphrase for security
    let xsignContButton = await session.query('.mx_CreateSecretStorageDialog .mx_Dialog_buttons .mx_Dialog_primary');
    await xsignContButton.click();

    //repeat passphrase entry
    passphraseField = await session.query('.mx_CreateSecretStorageDialog_passPhraseField input');
    await session.replaceInputText(passphraseField, xsigningPassphrase);
    await session.delay(1000); // give it a second to analyze our passphrase for security
    xsignContButton = await session.query('.mx_CreateSecretStorageDialog .mx_Dialog_buttons .mx_Dialog_primary');
    await xsignContButton.click();

    //ignore the recovery key
    //TODO: It's probably important for the tests to know the recovery key
    const copyButton = await session.query('.mx_CreateSecretStorageDialog_recoveryKeyButtons_copyBtn');
    await copyButton.click();

    //acknowledge that we copied the recovery key to a safe place
    const copyContinueButton = await session.query('.mx_CreateSecretStorageDialog .mx_Dialog_primary');
    await copyContinueButton.click();

    //acknowledge that we're done cross-signing setup and our keys are safe
    const doneOkButton = await session.query('.mx_CreateSecretStorageDialog .mx_Dialog_primary');
    await doneOkButton.click();

    //wait for registration to finish so the hash gets set
    //onhashchange better?

    const foundHomeUrl = await session.poll(async () => {
        const url = session.page.url();
        return url === session.url('/#/home');
    });
    assert(foundHomeUrl);
    session.log.done();
};
