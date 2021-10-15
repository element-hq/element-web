/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

require('gfm.css/gfm.css');
require('highlight.js/styles/github.css');
require('katex/dist/katex.css');

require('./devcss');
import './modernizr';
import * as ReactDOM from "react-dom";
import React, { ChangeEvent, ReactElement } from 'react';
import * as sdk from 'matrix-react-sdk';
import { MatrixClientPeg } from "matrix-react-sdk/src/MatrixClientPeg";
import { PushProcessor } from 'matrix-js-sdk/src/pushprocessor';

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
        name: "DevicesPanel_2_devices_wide",
        fn: screenshotDevicesPanel2Devices,
        width: 1280,
        height: 800,
        cssClass: "mx_DevicesPanel",
    },
    {
        name: "DevicesPanel_2_devices_narrow",
        fn: screenshotDevicesPanel2Devices,
        width: 320,
        height: 256,
        cssClass: "mx_DevicesPanel",
    },
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

function screenshotDevicesPanel2Devices(): ReactElement {
    MatrixClientPeg.get().getDevices = get2Devices;
    const DevicesPanel = sdk.getComponent('views.settings.DevicesPanel');
    return <DevicesPanel />;
}

async function get2Devices() {
    return {
        devices: [
            {
                device_id: "ABCDEFGHIJ",
                display_name: "Element Firefox",
                last_seen_ip: "123.45.67.8",
                last_seen_ts: 1582772521000,
            },
            {
                device_id: "KLMNOPQRST",
                display_name: "Element Android",
                last_seen_ip: "123.45.67.9",
                last_seen_ts: 1580443506000,
            },
        ],
    };
}

function screenshotNotificationUserSettingsTab(): ReactElement {
    MatrixClientPeg.get().getPushRules = async () => {
        // @ts-expect-error I (andyb) think rewriteDefaultRules has the wrong type sig
        return PushProcessor.rewriteDefaultRules(pushRulesJson());
    };

    MatrixClientPeg.get().getPushers = async () => {
        return { pushers: [] };
    };
    MatrixClientPeg.get().getThreePids = async () => {
        return { threepids: [] };
    };

    const NotificationUserSettingsTab= sdk.getComponent(
        'views.settings.tabs.user.NotificationUserSettingsTab');
    return <NotificationUserSettingsTab />;
}

function pushRulesJson() {
    // This is a lightly-modified paste of the JSON returned from a GET
    // to /pushrules/

    /* eslint-disable */
    return {
        "global": {
            "underride": [
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.call.invite" },
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "sound", "value": "ring" },
                        { "set_tweak": "highlight", "value": false },
                    ],
                    "rule_id": ".m.rule.call",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "room_member_count", "is": "2" },
                        { "kind": "event_match", "key": "type", "pattern": "m.room.message" },
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "sound", "value": "default" },
                        { "set_tweak": "highlight", "value": false },
                    ],
                    "rule_id": ".m.rule.room_one_to_one",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "room_member_count", "is": "2" },
                        { "kind": "event_match", "key": "type", "pattern": "m.room.encrypted" },
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "sound", "value": "default" },
                        { "set_tweak": "highlight", "value": false },
                    ],
                    "rule_id": ".m.rule.encrypted_room_one_to_one",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.room.message" },
                    ],
                    "actions": [
                        "dont_notify",
                    ],
                    "rule_id": ".m.rule.message",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.room.encrypted" },
                    ],
                    "actions": [
                        "dont_notify",
                    ],
                    "rule_id": ".m.rule.encrypted",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "im.vector.modular.widgets" },
                        { "kind": "event_match", "key": "content.type", "pattern": "jitsi" },
                        { "kind": "event_match", "key": "state_key", "pattern": "*" },
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "highlight", "value": false },
                    ],
                    "rule_id": ".im.vector.jitsi",
                    "default": true,
                    "enabled": true,
                },
            ],
            "sender": [],
            "room": [],
            "content": [
                {
                    "actions": [
                        "notify",
                        { "set_tweak": "sound", "value": "default" },
                        { "set_tweak": "highlight" },
                    ],
                    "pattern": "username",
                    "rule_id": ".m.rule.contains_user_name",
                    "default": true,
                    "enabled": true,
                },
            ],
            "override": [
                {
                    "conditions": [],
                    "actions": [
                        "dont_notify"
                    ],
                    "rule_id": ".m.rule.master",
                    "default": true,
                    "enabled": false,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "content.msgtype", "pattern": "m.notice" }
                    ],
                    "actions": [
                        "dont_notify",
                    ],
                    "rule_id": ".m.rule.suppress_notices",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.room.member" },
                        { "kind": "event_match", "key": "content.membership", "pattern": "invite" },
                        { "kind": "event_match", "key": "state_key", "pattern": "@username:example.com" }
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "sound", "value": "default" },
                        { "set_tweak": "highlight", "value": false }
                    ],
                    "rule_id": ".m.rule.invite_for_me",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.room.member" }
                    ],
                    "actions": [
                        "dont_notify",
                    ],
                    "rule_id": ".m.rule.member_event",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "contains_display_name" }
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "sound", "value": "default" },
                        { "set_tweak": "highlight" }
                    ],
                    "rule_id": ".m.rule.contains_display_name",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "content.body", "pattern": "@room" },
                        { "kind": "sender_notification_permission", "key": "room" }
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "highlight", "value": true }
                    ],
                    "rule_id": ".m.rule.roomnotif",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.room.tombstone" },
                        { "kind": "event_match", "key": "state_key", "pattern": "" }
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "highlight", "value": true }
                    ],
                    "rule_id": ".m.rule.tombstone",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.reaction" }
                    ],
                    "actions": [
                        "dont_notify",
                    ],
                    "rule_id": ".m.rule.reaction",
                    "default": true,
                    "enabled": true,
                }
            ],
        },
        "device": {},
    };
    /* eslint-enable */
}

start().catch(err => {
    console.error(err);
});
