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
import { getSenderName, isSelf } from "./utils";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { MessagePreviewStore } from "../MessagePreviewStore";

export class ReactionEventPreview implements IPreview {
    public getTextFor(event: MatrixEvent, tagId?: TagID, isThread?: boolean): string | null {
        const roomId = event.getRoomId();
        if (!roomId) return null; // not a room event

        const relation = event.getRelation();
        if (!relation) return null; // invalid reaction (probably redacted)

        const reaction = relation.key;
        if (!reaction) return null; // invalid reaction (unknown format)

        const cli = MatrixClientPeg.get();
        const room = cli?.getRoom(roomId);
        const relatedEvent = relation.event_id ? room?.findEventById(relation.event_id) : null;
        if (!relatedEvent) return null;

        const message = MessagePreviewStore.instance.generatePreviewForEvent(relatedEvent);
        if (isSelf(event)) {
            return _t("You reacted %(reaction)s to %(message)s", {
                reaction,
                message,
            });
        }

        return _t("%(sender)s reacted %(reaction)s to %(message)s", {
            sender: getSenderName(event),
            reaction,
            message,
        });
    }
}
