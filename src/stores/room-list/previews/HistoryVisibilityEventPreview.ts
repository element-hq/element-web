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

import { IPreview } from "./IPreview";
import { TagID } from "../models";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { getSenderName, isSelf } from "./utils";
import { _t } from "../../../languageHandler";

export class HistoryVisibilityEventPreview implements IPreview {
    public getTextFor(event: MatrixEvent, tagId?: TagID): string {
        const visibility = event.getContent()['history_visibility'];
        const isUs = isSelf(event);

        if (visibility === 'invited' || visibility === 'joined') {
            return isUs
                ? _t("You made history visible to new members")
                : _t("%(senderName)s made history visible to new members", {senderName: getSenderName(event)});
        } else if (visibility === 'world_readable') {
            return isUs
                ? _t("You made history visible to anyone")
                : _t("%(senderName)s made history visible to anyone", {senderName: getSenderName(event)});
        } else { // shared, default
            return isUs
                ? _t("You made history visible to future members")
                : _t("%(senderName)s made history visible to future members", {senderName: getSenderName(event)});
        }
    }
}
