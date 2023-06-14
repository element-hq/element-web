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

export class StickerEventPreview implements IPreview {
    public getTextFor(event: MatrixEvent, tagId?: TagID, isThread?: boolean): string | null {
        const stickerName = event.getContent()["body"];
        if (!stickerName) return null;

        if (isThread || isSelf(event) || !shouldPrefixMessagesIn(event.getRoomId()!, tagId)) {
            return stickerName;
        } else {
            return _t("%(senderName)s: %(stickerName)s", { senderName: getSenderName(event), stickerName });
        }
    }
}
