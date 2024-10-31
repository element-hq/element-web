/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ReactNode } from "react";
import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import AccessibleButton from "../../components/views/elements/AccessibleButton";
import { highlightEvent } from "../../utils/EventUtils";
import { _t } from "../../languageHandler";
import { getSenderName } from "../../utils/event/getSenderName";

export const textForVoiceBroadcastStoppedEvent = (event: MatrixEvent, client: MatrixClient): (() => ReactNode) => {
    return (): ReactNode => {
        const ownUserId = MatrixClientPeg.get()?.getUserId();
        const startEventId = event.getRelation()?.event_id;
        const roomId = event.getRoomId();

        const templateTags = {
            a: (text: string) =>
                startEventId && roomId ? (
                    <AccessibleButton kind="link_inline" onClick={(): void => highlightEvent(roomId, startEventId)}>
                        {text}
                    </AccessibleButton>
                ) : (
                    text
                ),
        };

        if (ownUserId && ownUserId === event.getSender()) {
            return _t("timeline|io.element.voice_broadcast_info|you", {}, templateTags);
        }

        return _t("timeline|io.element.voice_broadcast_info|user", { senderName: getSenderName(event) }, templateTags);
    };
};
