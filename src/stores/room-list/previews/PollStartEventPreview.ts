/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, type PollStartEventContent } from "matrix-js-sdk/src/matrix";
import { InvalidEventError } from "matrix-js-sdk/src/extensible_events_v1/InvalidEventError";
import { PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";

import { type IPreview } from "./IPreview";
import { type TagID } from "../models";
import { _t, sanitizeForTranslation } from "../../../languageHandler";
import { getSenderName, isSelf, shouldPrefixMessagesIn } from "./utils";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

export class PollStartEventPreview implements IPreview {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    public getTextFor(event: MatrixEvent, tagId?: TagID, isThread?: boolean): string | null {
        let eventContent = event.getContent();

        if (event.isRelation("m.replace")) {
            // It's an edit, generate the preview on the new text
            eventContent = event.getContent()["m.new_content"];
        }

        // Check we have the information we need, and bail out if not
        if (!eventContent) {
            return null;
        }

        try {
            const poll = new PollStartEvent({
                type: event.getType(),
                content: eventContent as PollStartEventContent,
            });

            let question = poll.question.text.trim();
            question = sanitizeForTranslation(question);

            if (isThread || isSelf(event) || !shouldPrefixMessagesIn(event.getRoomId()!, tagId)) {
                return question;
            } else {
                return _t("event_preview|m.text", { senderName: getSenderName(event), message: question });
            }
        } catch (e) {
            if (e instanceof InvalidEventError) {
                return null;
            }
            throw e; // re-throw unknown errors
        }
    }
}
