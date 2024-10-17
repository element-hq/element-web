/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { _t } from "../../languageHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { getSenderName } from "../../utils/event/getSenderName";

export const textForVoiceBroadcastStoppedEventWithoutLink = (event: MatrixEvent): string => {
    const ownUserId = MatrixClientPeg.get()?.getUserId();

    if (ownUserId && ownUserId === event.getSender()) {
        return _t("event_preview|io.element.voice_broadcast_info|you", {});
    }

    return _t("event_preview|io.element.voice_broadcast_info|user", { senderName: getSenderName(event) });
};
