/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    type CommonOngoingCallTileViewAction,
    type RoomOngoingCallTileViewSnapshot,
} from "@element-hq/web-shared-components";
import { MatrixEventEvent, type MatrixEvent, type RoomMember, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { type Props, BaseOngoingCallViewModel } from "./BaseOngoingCallTileViewModel";
import { getDeclinedEvents } from "../../common";
import { type GetRelationsForEvent } from "../../../../../../../components/views/rooms/EventTile";

/**
 * Check if this call is declined by our user.
 */
function isCallDeclinedByOwnUser(
    notificationEvent: MatrixEvent,
    getRelationsForEvent: GetRelationsForEvent | undefined,
    cli: MatrixClient,
): boolean {
    const declinedEvents = getDeclinedEvents(notificationEvent, getRelationsForEvent);
    const ownUserId = cli.getUserId();
    return declinedEvents?.some((event) => event.getSender() === ownUserId) ?? false;
}

/**
 * View model for an ongoing call in a non DM room.
 */
export class RoomOngoingCallTileViewModel
    extends BaseOngoingCallViewModel<RoomOngoingCallTileViewSnapshot>
    implements CommonOngoingCallTileViewAction
{
    public constructor(props: Props) {
        // Get the call in the room
        const call = props.callStore.getCall(props.roomId);
        if (!call) {
            throw new Error(`No call in room ${props.roomId}`);
        }
        const totalParticipants = call.participants.size;
        const isCallDeclined = isCallDeclinedByOwnUser(props.mxEvent, props.getRelationsForEvent, props.cli);
        super(props, { totalParticipants, isCallIgnored: isCallDeclined });

        // When a relation is added to the event, recompute the state.
        this.disposables.trackListener(props.mxEvent, MatrixEventEvent.RelationsCreated, () => {
            this.onRelationsCreated();
        });
    }

    /**
     * Recompute the snapshot when a relation is added to the notification event.
     * We do this so that we know if our user has declined (ignored) this call.
     */
    private onRelationsCreated(): void {
        const isCallIgnored = isCallDeclinedByOwnUser(
            this.props.mxEvent,
            this.props.getRelationsForEvent,
            this.props.cli,
        );
        this.snapshot.merge({ isCallIgnored });
    }

    protected onParticipantsChange(participants: Map<RoomMember, Set<string>>): void {
        const totalParticipants = participants.size;
        super.onParticipantsChange(participants, { totalParticipants });
    }
}
