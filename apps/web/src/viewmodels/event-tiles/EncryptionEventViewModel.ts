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
import { isRoomEncrypted } from "../../hooks/useIsEncrypted";
import { objectHasDiff } from "../../utils/objects";

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
        super(
            props,
            EncryptionEventViewModel.calculateSnapshot(props, EncryptionEventViewModel.getInitialIsEncrypted(props)),
        );
        void this.refreshSnapshotFromEvent();

        const roomId = this.props.mxEvent.getRoomId()!;
        const room = this.props.cli.getRoom(roomId);
        if (room) {
            // Recompute when room state changes (including encryption state updates).
            this.disposables.trackListener(room, RoomStateEvent.Update, () => void this.refreshSnapshotFromEvent());
        }
    }

    private refreshSnapshotFromEvent = async (): Promise<void> => {
        const roomId = this.props.mxEvent.getRoomId()!;
        const room = this.props.cli.getRoom(roomId);
        const crypto = this.props.cli.getCrypto();
        const isEncrypted = Boolean(room && crypto && (await isRoomEncrypted(room, crypto)));
        const nextSnapshot = EncryptionEventViewModel.calculateSnapshot(this.props, isEncrypted);

        if (objectHasDiff(this.snapshot.current, nextSnapshot)) {
            this.snapshot.set(nextSnapshot);
        }
    };

    private static getInitialIsEncrypted(props: EncryptionEventViewModelProps): boolean {
        const roomId = props.mxEvent.getRoomId()!;
        const room = props.cli.getRoom(roomId);
        if (!room) return false;

        if (isLocalRoom(room)) {
            const localRoom = room as { isEncryptionEnabled?: () => boolean };
            return Boolean(localRoom.isEncryptionEnabled?.());
        }

        return room.hasEncryptionStateEvent();
    }

    private static calculateSnapshot(
        props: EncryptionEventViewModelProps,
        isEncrypted: boolean,
    ): EncryptionEventViewSnapshotInterface {
        // Keep legacy class names for compatibility with existing timeline layout and styling.
        const newSnapshot: EncryptionEventViewSnapshotInterface = {
            state: EncryptionEventState.CHANGED,
            encryptedStateEvents: undefined,
            userName: undefined,
            timestamp: props.timestamp,
            className: "mx_EventTileBubble mx_cryptoEvent mx_cryptoEvent_icon",
        };

        const content = props.mxEvent.getContent<RoomEncryptionEventContent>();
        if (isEncrypted && content.algorithm === MEGOLM_ENCRYPTION_ALGORITHM) {
            const roomId = props.mxEvent.getRoomId()!;
            const room = props.cli.getRoom(roomId);
            const isRoomLocal = isLocalRoom(room);
            const prevContent = props.mxEvent.getPrevContent() as RoomEncryptionEventContent;
            const dmPartner = roomId ? DMRoomMap.shared().getUserIdForRoomId(roomId) : undefined;
            const stateEncrypted = Boolean(
                content["io.element.msc4362.encrypt_state_events"] && props.cli.enableEncryptedStateEvents,
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
        } else if (isEncrypted) {
            newSnapshot.state = EncryptionEventState.DISABLE_ATTEMPT;
        } else {
            newSnapshot.state = EncryptionEventState.UNSUPPORTED;
            // Unsupported branch matches legacy EncryptionEvent class usage (no icon class).
            newSnapshot.className = "mx_EventTileBubble mx_cryptoEvent";
        }

        return newSnapshot;
    }
}
