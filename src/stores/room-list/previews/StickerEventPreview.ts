/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { type IPreview } from "./IPreview";
import { type TagID } from "../models";
import { getSenderName, isSelf, shouldPrefixMessagesIn } from "./utils";
import { _t } from "../../../languageHandler";

export class StickerEventPreview implements IPreview {
    public getTextFor(event: MatrixEvent, tagId?: TagID, isThread?: boolean): string | null {
        const stickerName = event.getContent()["body"];
        if (!stickerName) return null;

        if (isThread || isSelf(event) || !shouldPrefixMessagesIn(event.getRoomId()!, tagId)) {
            return stickerName;
        } else {
            return _t("event_preview|m.sticker", { senderName: getSenderName(event), stickerName });
        }
    }
}
