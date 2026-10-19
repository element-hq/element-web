/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { _t } from "../../languageHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { senderUserId } from "../stableIds";

export function getSenderName(event: MatrixEvent): string {
    if (event.sender?.name) return event.sender.name;

    // Without a member to name them, the sender is a stable ID (MSC4428): resolve it
    // rather than showing an opaque member key. There may be no client at all here —
    // this helper is called while logged out — in which case there is nothing to resolve
    // against and the old behaviour stands.
    const client = MatrixClientPeg.get();
    return (client ? senderUserId(client, event) : event.getSender()) ?? _t("common|someone");
}
