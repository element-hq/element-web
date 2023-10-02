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

import React, { forwardRef, useContext } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { IRoomEncryption } from "matrix-js-sdk/src/crypto/RoomList";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import EventTileBubble from "./EventTileBubble";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import DMRoomMap from "../../../utils/DMRoomMap";
import { objectHasDiff } from "../../../utils/objects";
import { isLocalRoom } from "../../../utils/localRoom/isLocalRoom";

interface IProps {
    mxEvent: MatrixEvent;
    timestamp?: JSX.Element;
}

const ALGORITHM = "m.megolm.v1.aes-sha2";

const EncryptionEvent = forwardRef<HTMLDivElement, IProps>(({ mxEvent, timestamp }, ref) => {
    const cli = useContext(MatrixClientContext);
    const roomId = mxEvent.getRoomId()!;
    const isRoomEncrypted = MatrixClientPeg.safeGet().isRoomEncrypted(roomId);

    const prevContent = mxEvent.getPrevContent() as IRoomEncryption;
    const content = mxEvent.getContent<IRoomEncryption>();

    // if no change happened then skip rendering this, a shallow check is enough as all known fields are top-level.
    if (!objectHasDiff(prevContent, content)) return null; // nop

    if (content.algorithm === ALGORITHM && isRoomEncrypted) {
        let subtitle: string;
        const dmPartner = DMRoomMap.shared().getUserIdForRoomId(roomId);
        const room = cli?.getRoom(roomId);
        if (prevContent.algorithm === ALGORITHM) {
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
