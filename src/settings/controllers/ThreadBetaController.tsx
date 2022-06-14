/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import * as React from "react";
import { Thread } from "matrix-js-sdk/src/models/thread";

import SettingController from "./SettingController";
import PlatformPeg from "../../PlatformPeg";
import { SettingLevel } from "../SettingLevel";
import Modal from "../../Modal";
import QuestionDialog from "../../components/views/dialogs/QuestionDialog";
import { _t } from "../../languageHandler";

export default class ThreadBetaController extends SettingController {
    public async beforeChange(level: SettingLevel, roomId: string, newValue: any): Promise<boolean> {
        if (Thread.hasServerSideSupport || !newValue) return true; // Full support or user is disabling

        const { finished } = Modal.createDialog<[boolean]>(QuestionDialog, {
            title: _t("Partial Support for Threads"),
            description: <>
                <p>{ _t("Your homeserver does not currently support threads, so this feature may be unreliable. " +
                    "Some threaded messages may not be reliably available. <a>Learn more</a>.", {}, {
                    a: sub => (
                        <a href="https://element.io/help#threads" target="_blank" rel="noreferrer noopener">{ sub }</a>
                    ),
                }) }</p>
                <p>{ _t("Do you want to enable threads anyway?") }</p>
            </>,
            button: _t("Yes, enable"),
        });
        const [enable] = await finished;
        return enable;
    }

    public onChange(level: SettingLevel, roomId: string, newValue: any) {
        // Requires a reload as we change an option flag on the `js-sdk`
        // And the entire sync history needs to be parsed again
        PlatformPeg.get().reload();
    }
}
