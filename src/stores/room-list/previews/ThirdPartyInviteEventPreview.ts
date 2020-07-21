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
import { isValid3pidInvite } from "../../../RoomInvite";

export class ThirdPartyInviteEventPreview implements IPreview {
    public getTextFor(event: MatrixEvent, tagId?: TagID): string {
        if (!isValid3pidInvite(event)) {
            const targetName = event.getPrevContent().display_name || _t("Someone");
            if (isSelf(event)) {
                return _t("You uninvited %(targetName)s", {targetName});
            } else {
                return _t("%(senderName)s uninvited %(targetName)s", {senderName: getSenderName(event), targetName});
            }
        } else {
            const targetName = event.getContent().display_name;
            if (isSelf(event)) {
                return _t("You invited %(targetName)s", {targetName});
            } else {
                return _t("%(senderName)s invited %(targetName)s", {senderName: getSenderName(event), targetName});
            }
        }
    }
}
