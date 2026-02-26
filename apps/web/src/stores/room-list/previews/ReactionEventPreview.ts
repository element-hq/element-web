/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { type IPreview } from "./IPreview";
import { type TagID } from "../models";
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
            return _t("event_preview|m.reaction|you", {
                reaction,
                message,
            });
        }

        return _t("event_preview|m.reaction|user", {
            sender: getSenderName(event),
            reaction,
            message,
        });
    }
}
