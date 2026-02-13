/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type JSX } from "react";
import { MatrixEventEvent, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    EncryptionEventState,
    type EncryptionEventViewSnapshot as EncryptionEventViewSnapshotInterface,
    type EncryptionEventViewModel as EncryptionEventViewModelInterface,
} from "@element-hq/web-shared-components";

import type { RoomEncryptionEventContent } from "matrix-js-sdk/src/types";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import DMRoomMap from "../../utils/DMRoomMap";
import { MEGOLM_ENCRYPTION_ALGORITHM } from "../../utils/crypto";
import { isLocalRoom } from "../../utils/localRoom/isLocalRoom";
import { objectHasDiff } from "../../utils/objects";

export interface EncryptionEventViewModelProps {
    mxEvent: MatrixEvent;
    timestamp?: JSX.Element;
}

export class EncryptionEventViewModel
    extends BaseViewModel<EncryptionEventViewSnapshotInterface, EncryptionEventViewModelProps>
    implements EncryptionEventViewModelInterface
{
    public constructor(props: EncryptionEventViewModelProps) {
        super(props, { state: EncryptionEventState.UNSUPPORTED, timestamp: props.timestamp });

        this.setEncryptionFromEvent();
        this.disposables.trackListener(
            this.props.mxEvent,
            MatrixEventEvent.SentinelUpdated,
            this.setEncryptionFromEvent,
        );
    }

    private setEncryptionFromEvent = (): void => {
        const prevContent = this.props.mxEvent.getPrevContent() as RoomEncryptionEventContent;
        const content = this.props.mxEvent.getContent<RoomEncryptionEventContent>();

        // if no change happened then skip rendering this, a shallow check is enough as all known fields are top-level.
        if (!objectHasDiff(prevContent, content)) return; // nop

        const cli = MatrixClientPeg.safeGet();
        const roomId = this.props.mxEvent.getRoomId();
        const room = roomId ? cli?.getRoom(roomId) : null;
        const isRoomLocal = isLocalRoom(room);
        const isRoomEncrypted = Boolean(room?.hasEncryptionStateEvent());

        // Keep mx_EventTileBubble and mx_cryptoEvent to support compatibility with existing timeline layout.
        const newSnapshot: EncryptionEventViewSnapshotInterface = {
            state: EncryptionEventState.UNSUPPORTED,
            simplified: undefined,
            userName: undefined,
            timestamp: this.props.timestamp,
            className: "mx_EventTileBubble mx_cryptoEvent",
        };

        if (isRoomEncrypted && content.algorithm === MEGOLM_ENCRYPTION_ALGORITHM) {
            const dmPartner = roomId ? DMRoomMap.shared().getUserIdForRoomId(roomId) : undefined;
            const stateEncrypted = Boolean(
                content["io.element.msc4362.encrypt_state_events"] && cli?.enableEncryptedStateEvents,
            );

            newSnapshot.state = EncryptionEventState.ENABLED;
            newSnapshot.simplified = stateEncrypted;

            if (prevContent.algorithm === MEGOLM_ENCRYPTION_ALGORITHM) {
                newSnapshot.state = EncryptionEventState.CHANGED;
            } else if (dmPartner) {
                newSnapshot.state = EncryptionEventState.ENABLED_DM;
                newSnapshot.userName = room?.getMember(dmPartner)?.rawDisplayName ?? dmPartner;
            } else if (isRoomLocal) {
                newSnapshot.state = EncryptionEventState.ENABLED_LOCAL;
            }
        } else if (isRoomEncrypted) {
            newSnapshot.state = EncryptionEventState.DISABLE_ATTEMPT;
        }

        this.snapshot.merge(newSnapshot);
    };
}
