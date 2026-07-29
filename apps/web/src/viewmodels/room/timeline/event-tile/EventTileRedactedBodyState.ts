/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { formatFullDate } from "../../../../DateUtils";
import { _t } from "../../../../languageHandler";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { type RedactedBodyViewSnapshot } from "@element-hq/web-shared-components";

/** Converts a redacted event into the data required by the redacted body view. */
export function getRedactedBodyViewModelProps(mxEvent: MatrixEvent, showTwelveHour: boolean): RedactedBodyViewSnapshot {
    const redactedBecause = mxEvent.getUnsigned().redacted_because;
    
    const redactingUserId = redactedBecause?.sender;
    const redactingRoomId = mxEvent.getRoomId();
    const redactingRoom = redactingRoomId ? MatrixClientPeg.get()?.getRoom(redactingRoomId) : null;
    const redactingMember = redactingUserId ? redactingRoom?.getMember(redactingUserId) : undefined;
    
    const text =
        !redactingUserId || redactingUserId === mxEvent.getSender()
            ? _t("timeline|self_redaction")
            : _t("timeline|redaction", { name: redactingMember?.name ?? redactingUserId });

    const redactionTs = redactedBecause?.origin_server_ts;
    const tooltip = redactionTs
        ? _t("timeline|redacted|tooltip", {
              date: formatFullDate(new Date(redactionTs), showTwelveHour),
          })
        : undefined;

    return { text, tooltip };
}
