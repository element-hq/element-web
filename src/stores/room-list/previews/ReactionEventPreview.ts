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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { IPreview } from "./IPreview";
import { TagID } from "../models";
import { getSenderName, isSelf, shouldPrefixMessagesIn } from "./utils";
import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import DMRoomMap from "../../../utils/DMRoomMap";

export class ReactionEventPreview implements IPreview {
    public getTextFor(event: MatrixEvent, tagId?: TagID, isThread?: boolean): string {
        const showDms = SettingsStore.getValue("feature_roomlist_preview_reactions_dms");
        const showAll = SettingsStore.getValue("feature_roomlist_preview_reactions_all");

        // If we're not showing all reactions, see if we're showing DMs instead
        if (!showAll) {
            // If we're not showing reactions on DMs, or we are and the room isn't a DM, skip
            if (!(showDms && DMRoomMap.shared().getUserIdForRoomId(event.getRoomId()))) {
                return null;
            }
        }

        const relation = event.getRelation();
        if (!relation) return null; // invalid reaction (probably redacted)

        const reaction = relation.key;
        if (!reaction) return null; // invalid reaction (unknown format)

        if (isThread || isSelf(event) || !shouldPrefixMessagesIn(event.getRoomId(), tagId)) {
            return reaction;
        } else {
            return _t("%(senderName)s: %(reaction)s", { senderName: getSenderName(event), reaction });
        }
    }
}
