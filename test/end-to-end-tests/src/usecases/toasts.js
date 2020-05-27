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

const assert = require('assert');

async function assertToast(session, expectedTitle) {
    const h2Element = await session.query('.mx_Toast_title h2');
    const toastTitle = await session.innerText(h2Element);
    assert(toastTitle, expectedTitle);
}

async function acceptToast(session, expectedTitle) {
    const foundToast = await assertToast(session, expectedTitle);
    if (!foundToast) {
        throw new Error("could not find expected toast");
    }

    const btn = await session.query('.mx_Toast_buttons .mx_AccessibleButton_kind_primary');
    await btn.click();
}

async function rejectToast(session, expectedTitle) {
    const foundToast = await assertToast(session, expectedTitle);
    if (!foundToast) {
        throw new Error("could not find expected toast");
    }

    const btn = await session.query('.mx_Toast_buttons .mx_AccessibleButton_kind_danger');
    await btn.click();
}

module.exports = {assertToast, acceptToast, rejectToast};
