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

module.exports = async function sendMessage(session, message) {
    session.log.step(`writes "${message}" in room`);
    // this selector needs to be the element that has contenteditable=true,
    // not any if its parents, otherwise it behaves flaky at best.
    const composer = await session.query('.mx_SendMessageComposer');
    // sometimes the focus that type() does internally doesn't seem to work
    // and calling click before seems to fix it 🤷
    await composer.click();
    await composer.type(message);
    const text = await session.innerText(composer);
    assert.equal(text.trim(), message.trim());
    await composer.press("Enter");
    // wait for the message to appear sent
    await session.query(".mx_EventTile_last:not(.mx_EventTile_sending)");
    session.log.done();
};
