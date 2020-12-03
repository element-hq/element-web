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
        const changeButton = await session.query('.mx_ServerPicker_change');
        await changeButton.click();

        const hsInputField = await session.query('.mx_ServerPickerDialog_otherHomeserver');
        await session.replaceInputText(hsInputField, homeserver);
        const nextButton = await session.query('.mx_ServerPickerDialog_continue');
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
    const continueButton = await session.query('.mx_RegistrationEmailPromptDialog button.mx_Dialog_primary');
    await continueButton.click();

    //find the privacy policy checkbox and check it
    const policyCheckbox = await session.query('.mx_InteractiveAuthEntryComponents_termsPolicy input');
    await policyCheckbox.click();

    //now click the 'Accept' button to agree to the privacy policy
    const acceptButton = await session.query('.mx_InteractiveAuthEntryComponents_termsSubmit');
    await acceptButton.click();

    //wait for registration to finish so the hash gets set
    //onhashchange better?

    const foundHomeUrl = await session.poll(async () => {
        const url = session.page.url();
        return url === session.url('/#/home');
    });
    assert(foundHomeUrl);
    session.log.done();
};
