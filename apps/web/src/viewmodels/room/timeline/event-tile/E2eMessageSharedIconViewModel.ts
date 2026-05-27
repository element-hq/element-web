/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventTimeline, RoomStateEvent, type MatrixClient, type RoomState } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type E2eMessageSharedIconViewModel as E2eMessageSharedIconViewModelInterface,
    type E2eMessageSharedIconViewSnapshot,
} from "@element-hq/web-shared-components";

export interface E2eMessageSharedIconViewModelProps {
    /** Matrix client used to look up room membership state. */
    client: MatrixClient;
    /** The ID of the room containing the event whose keys were shared. */
    roomId: string;
    /** The ID of the user who shared the keys. */
    keyForwardingUserId: string;
}

export class E2eMessageSharedIconViewModel
    extends BaseViewModel<E2eMessageSharedIconViewSnapshot, E2eMessageSharedIconViewModelProps>
    implements E2eMessageSharedIconViewModelInterface
{
    public constructor(props: E2eMessageSharedIconViewModelProps) {
        super(props, E2eMessageSharedIconViewModel.computeSnapshot(props));
        this.setupRoomStateListener();
    }

    private updateSnapshotFromProps = (): void => {
        this.snapshot.merge(E2eMessageSharedIconViewModel.computeSnapshot(this.props));
    };

    private setupRoomStateListener(): void {
        const roomState = this.getForwardRoomState();
        if (!roomState) return;

        this.disposables.trackListener(roomState, RoomStateEvent.Events, this.updateSnapshotFromProps);
    }

    private getForwardRoomState(): RoomState | undefined {
        return this.props.client.getRoom(this.props.roomId)?.getLiveTimeline()?.getState(EventTimeline.FORWARDS);
    }

    private static computeSnapshot(props: E2eMessageSharedIconViewModelProps): E2eMessageSharedIconViewSnapshot {
        const displayName = E2eMessageSharedIconViewModel.getDisplayName(props);

        return {
            displayName,
            userId: props.keyForwardingUserId,
        };
    }

    private static getDisplayName(props: E2eMessageSharedIconViewModelProps): string {
        const roomState = props.client.getRoom(props.roomId)?.getLiveTimeline()?.getState(EventTimeline.FORWARDS);
        const forwardingMember = roomState?.getMember(props.keyForwardingUserId);

        return forwardingMember?.rawDisplayName ?? props.keyForwardingUserId;
    }
}
