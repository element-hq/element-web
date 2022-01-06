/*
Copyright 2022 New Vector Ltd

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

// This file is a cut-down copy of index.ts.  It goes together with
// screenshots.html to create a page allowing you to choose a component,
// Which is rendered with example data, allowing us to take screenshots
// (using code in matrix-react-sdk/tests/end-to-end-tests/screenshots.js)
// and compare for any changes against previous versions.

import './modernizr';
import * as ReactDOM from "react-dom";
import React, { ChangeEvent, ReactElement } from 'react';
import { MatrixClientPeg } from "matrix-react-sdk/src/MatrixClientPeg";
import { screenshotNotificationUserSettingsTab } from './screenshots/notification_user_settings_tab';

let widthInput: HTMLInputElement;
let heightInput: HTMLInputElement;
let classInput: HTMLInputElement;

async function settled(...promises: Array<Promise<any>>) {
    for (const prom of promises) {
        try {
            await prom;
        } catch (e) {
            console.error(e);
        }
    }
}

async function start() {
    const {
        preparePlatform,
        loadSkin,
        loadLanguage,
        loadTheme,
    } = await import(
        /* webpackChunkName: "init" */
        /* webpackPreload: true */
        "./init");

    try {
        preparePlatform();
        const loadLanguagePromise = loadLanguage();
        const loadThemePromise = loadTheme();
        const loadSkinPromise = loadSkin();
        await settled(loadSkinPromise, loadThemePromise, loadLanguagePromise);

        await loadSkinPromise;
        await loadThemePromise;
        await loadLanguagePromise;

        await myLoadApp();
    } catch (err) {
        console.error(err);
    }
}

async function myLoadApp() {
    // We know that MatrixClientPeg is a MatrixClientPegClass
    await (MatrixClientPeg as any).createClient({});

    window.matrixChat = ReactDOM.render(
        <div>
            <input type="hidden" id="screenshot_width" value="" />
            <input type="hidden" id="screenshot_height" value="" />
            <input type="hidden" id="screenshot_class" value="" />
            <select id="select_screenshot" defaultValue="" onChange={selectChange}>
                <option value="">-- Choose component to screenshot --</option>
                {
                    screenshots.map((screenshot) =>
                        <option
                            value={screenshot.name}
                            key={screenshot.name}
                        >{ screenshot.name }</option>,
                    )
                }
            </select>
            <div id="screenshot" />
        </div>,
        document.getElementById('matrixchat'),
    );

    widthInput = document.getElementById("screenshot_width") as HTMLInputElement;
    heightInput = document.getElementById("screenshot_height") as HTMLInputElement;
    classInput = document.getElementById("screenshot_class") as HTMLInputElement;
}

function selectChange(event: ChangeEvent<HTMLSelectElement>) {
    const screenshot = screenshots.find((scr) => scr.name === event.target.value);
    if (screenshot) {
        widthInput["value"] = screenshot.width.toString();
        heightInput["value"] = screenshot.height.toString();
        classInput["value"] = screenshot.cssClass;
        ReactDOM.render(
            screenshot.fn() as ReactElement,
            document.getElementById('screenshot'),
        );
    }
}

/**
 * To add more screenshots, add a row to this table.
 *
 * Note: width, height and cssClass act as hints to the screenshotting code in
 * matrix-react-sdk about how to render the screenshot - they do not affect the
 * size or appearance if you visit the page in your browser.
 */
const screenshots = [
    {
        name: "NotificationUserSettingsTab_wide",
        fn: screenshotNotificationUserSettingsTab,
        width: 800,
        height: 800,
        cssClass: "mx_NotificationUserSettingsTab",
    },
    {
        name: "NotificationUserSettingsTab_narrow",
        fn: screenshotNotificationUserSettingsTab,
        width: 400,
        height: 800,
        cssClass: "mx_NotificationUserSettingsTab",
    },
];

start().catch(err => {
    console.error(err);
});
