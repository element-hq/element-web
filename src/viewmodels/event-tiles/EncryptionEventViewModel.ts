/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type JSX } from "react";
import { RoomStateEvent, type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    EncryptionEventState,
    type EncryptionEventViewSnapshot as EncryptionEventViewSnapshotInterface,
    type EncryptionEventViewModel as EncryptionEventViewModelInterface,
} from "@element-hq/web-shared-components";

import type { RoomEncryptionEventContent } from "matrix-js-sdk/src/types";
import DMRoomMap from "../../utils/DMRoomMap";
import { MEGOLM_ENCRYPTION_ALGORITHM } from "../../utils/crypto";
import { isLocalRoom } from "../../utils/localRoom/isLocalRoom";
import { isRoomEncrypted as isRoomEncryptedForRoom } from "../../hooks/useIsEncrypted";

export interface EncryptionEventViewModelProps {
    /** Caller-provided client. */
    cli: MatrixClient;
    /** Encryption state event to derive tile state from. */
    mxEvent: MatrixEvent;
    /** Optional timestamp element rendered in the tile footer slot. */
    timestamp?: JSX.Element;
}

export class EncryptionEventViewModel
    extends BaseViewModel<EncryptionEventViewSnapshotInterface, EncryptionEventViewModelProps>
    implements EncryptionEventViewModelInterface
{
    public constructor(props: EncryptionEventViewModelProps) {
        super(props, { state: EncryptionEventState.UNSUPPORTED, timestamp: props.timestamp });
        void this.setEncryptionFromEvent();

        const roomId = this.props.mxEvent.getRoomId()!;
        const room = this.props.cli.getRoom(roomId);
        if (room) {
            // Recompute when room state changes (including encryption state updates).
            this.disposables.trackListener(room, RoomStateEvent.Update, () => void this.setEncryptionFromEvent());
        }
    }

    private setEncryptionFromEvent = async (): Promise<void> => {
        const cli = this.props.cli;
        const roomId = this.props.mxEvent.getRoomId()!;
        const room = cli?.getRoom(roomId) ?? null;
        const isRoomLocal = isLocalRoom(room);
        const crypto = cli?.getCrypto();
        const isRoomEncrypted = Boolean(room && crypto && (await isRoomEncryptedForRoom(room, crypto)));

        const prevContent = this.props.mxEvent.getPrevContent() as RoomEncryptionEventContent;
        const content = this.props.mxEvent.getContent<RoomEncryptionEventContent>();

        // Keep legacy class names for compatibility with existing timeline layout and styling.
        const newSnapshot: EncryptionEventViewSnapshotInterface = {
            state: EncryptionEventState.UNSUPPORTED,
            encryptedStateEvents: undefined,
            userName: undefined,
            timestamp: this.props.timestamp,
            className: "mx_EventTileBubble mx_cryptoEvent mx_cryptoEvent_icon",
        };

        if (isRoomEncrypted && content.algorithm === MEGOLM_ENCRYPTION_ALGORITHM) {
            const dmPartner = roomId ? DMRoomMap.shared().getUserIdForRoomId(roomId) : undefined;
            const stateEncrypted = Boolean(
                content["io.element.msc4362.encrypt_state_events"] && cli?.enableEncryptedStateEvents,
            );

            newSnapshot.state = EncryptionEventState.ENABLED;
            newSnapshot.encryptedStateEvents = stateEncrypted;

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
        } else {
            // Unsupported branch matches legacy EncryptionEvent class usage (no icon class).
            newSnapshot.className = "mx_EventTileBubble mx_cryptoEvent";
        }

        this.snapshot.merge(newSnapshot);
    };
}
