/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { forwardRef } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import type { RoomEncryptionEventContent } from "matrix-js-sdk/src/types";
import { _t } from "../../../languageHandler";
import EventTileBubble from "./EventTileBubble";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import DMRoomMap from "../../../utils/DMRoomMap";
import { objectHasDiff } from "../../../utils/objects";
import { isLocalRoom } from "../../../utils/localRoom/isLocalRoom";
import { MEGOLM_ENCRYPTION_ALGORITHM } from "../../../utils/crypto";
import { useIsEncrypted } from "../../../hooks/useIsEncrypted.ts";

interface IProps {
    mxEvent: MatrixEvent;
    timestamp?: JSX.Element;
}

const EncryptionEvent = forwardRef<HTMLDivElement, IProps>(({ mxEvent, timestamp }, ref) => {
    const cli = useMatrixClientContext();
    const roomId = mxEvent.getRoomId()!;
    const isRoomEncrypted = useIsEncrypted(cli, cli.getRoom(roomId) || undefined);

    const prevContent = mxEvent.getPrevContent() as RoomEncryptionEventContent;
    const content = mxEvent.getContent<RoomEncryptionEventContent>();

    // if no change happened then skip rendering this, a shallow check is enough as all known fields are top-level.
    if (!objectHasDiff(prevContent, content)) return null; // nop

    if (content.algorithm === MEGOLM_ENCRYPTION_ALGORITHM && isRoomEncrypted) {
        let subtitle: string;
        const dmPartner = DMRoomMap.shared().getUserIdForRoomId(roomId);
        const room = cli?.getRoom(roomId);
        if (prevContent.algorithm === MEGOLM_ENCRYPTION_ALGORITHM) {
            subtitle = _t("timeline|m.room.encryption|parameters_changed");
        } else if (dmPartner) {
            const displayName = room?.getMember(dmPartner)?.rawDisplayName || dmPartner;
            subtitle = _t("timeline|m.room.encryption|enabled_dm", { displayName });
        } else if (room && isLocalRoom(room)) {
            subtitle = _t("timeline|m.room.encryption|enabled_local");
        } else {
            subtitle = _t("timeline|m.room.encryption|enabled");
        }

        return (
            <EventTileBubble
                className="mx_cryptoEvent mx_cryptoEvent_icon"
                title={_t("common|encryption_enabled")}
                subtitle={subtitle}
                timestamp={timestamp}
            />
        );
    }

    if (isRoomEncrypted) {
        return (
            <EventTileBubble
                className="mx_cryptoEvent mx_cryptoEvent_icon"
                title={_t("common|encryption_enabled")}
                subtitle={_t("timeline|m.room.encryption|disable_attempt")}
                timestamp={timestamp}
            />
        );
    }

    return (
        <EventTileBubble
            className="mx_cryptoEvent mx_cryptoEvent_icon mx_cryptoEvent_icon_warning"
            title={_t("timeline|m.room.encryption|disabled")}
            subtitle={_t("timeline|m.room.encryption|unsupported")}
            ref={ref}
            timestamp={timestamp}
        />
    );
});

export default EncryptionEvent;
