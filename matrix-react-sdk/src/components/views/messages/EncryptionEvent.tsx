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
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
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
    const isRoomEncrypted = MatrixClientPeg.get().isRoomEncrypted(roomId);

    const prevContent = mxEvent.getPrevContent() as IRoomEncryption;
    const content = mxEvent.getContent<IRoomEncryption>();

    // if no change happened then skip rendering this, a shallow check is enough as all known fields are top-level.
    if (!objectHasDiff(prevContent, content)) return null; // nop

    if (content.algorithm === ALGORITHM && isRoomEncrypted) {
        let subtitle: string;
        const dmPartner = DMRoomMap.shared().getUserIdForRoomId(roomId);
        const room = cli?.getRoom(roomId);
        if (prevContent.algorithm === ALGORITHM) {
            subtitle = _t("Some encryption parameters have been changed.");
        } else if (dmPartner) {
            const displayName = room?.getMember(dmPartner)?.rawDisplayName || dmPartner;
            subtitle = _t(
                "Messages here are end-to-end encrypted. " +
                    "Verify %(displayName)s in their profile - tap on their avatar.",
                { displayName },
            );
        } else if (room && isLocalRoom(room)) {
            subtitle = _t("Messages in this chat will be end-to-end encrypted.");
        } else {
            subtitle = _t(
                "Messages in this room are end-to-end encrypted. " +
                    "When people join, you can verify them in their profile, just tap on their avatar.",
            );
        }

        return (
            <EventTileBubble
                className="mx_cryptoEvent mx_cryptoEvent_icon"
                title={_t("Encryption enabled")}
                subtitle={subtitle}
                timestamp={timestamp}
            />
        );
    }

    if (isRoomEncrypted) {
        return (
            <EventTileBubble
                className="mx_cryptoEvent mx_cryptoEvent_icon"
                title={_t("Encryption enabled")}
                subtitle={_t("Ignored attempt to disable encryption")}
                timestamp={timestamp}
            />
        );
    }

    return (
        <EventTileBubble
            className="mx_cryptoEvent mx_cryptoEvent_icon mx_cryptoEvent_icon_warning"
            title={_t("Encryption not enabled")}
            subtitle={_t("The encryption used by this room isn't supported.")}
            ref={ref}
            timestamp={timestamp}
        />
    );
});

export default EncryptionEvent;
