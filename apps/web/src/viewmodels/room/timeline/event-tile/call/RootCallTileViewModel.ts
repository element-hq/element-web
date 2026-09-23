/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { BaseViewModel, type ViewModel, type RootCallTileViewSnapshot } from "@element-hq/web-shared-components";

import type { GetRelationsForEvent } from "../../../../../components/views/rooms/EventTile";
import { type CallStore, CallStoreEvent } from "../../../../../stores/CallStore";
import { RoomOngoingCallTileViewModel } from "./tiles/ongoing/RoomOngoingCallTileViewModel";
import { DmOngoingCallTileViewModel } from "./tiles/ongoing/DmOngoingCallTileViewModel";
import { DmTombstoneCallTileViewModel } from "./tiles/tombstone/DmTombstoneCallTileViewModel";
import { RoomTombstoneCallTileViewModel } from "./tiles/tombstone/RoomTombstoneCallTileViewModel";
import {
    LatestRtcNotificationEventUpdate,
    type LatestRtcNotificationEventStore,
} from "../../../../../stores/LatestRtcNotificationEventStore";
import { JitsiCall } from "../../../../../models/Call";
import type LegacyCallHandler from "../../../../../LegacyCallHandler.tsx";

interface Props {
    /**
     * Event of type `org.matrix.msc4075.rtc.notification`.
     */
    mxEvent: MatrixEvent;

    /**
     * Helper to fetch related events from a given event.
     */
    getRelationsForEvent?: GetRelationsForEvent;

    /**
     * The {@link MatrixClient} object to access js-sdk API.
     */
    cli: MatrixClient;

    /**
     * {@link CallStore} to access calls in a room.
     */
    callStore: CallStore;

    /**
     * {@link LegacyCallHandler} to handle calls in a room.
     */
    legacyCallHandler: LegacyCallHandler;

    /**
     * {@link LatestRtcNotificationEventStore} to track the latest notification event id.
     */
    latestRtcNotificationEventStore: LatestRtcNotificationEventStore;
}

function computeSnapshot(props: Props): RootCallTileViewSnapshot {
    const cli = props.cli;
    const notificationEvent = props.mxEvent;

    // Get the room where this call is taking place
    const roomId = props.mxEvent.getRoomId();
    if (!roomId) throw new Error("Notification event does not have associated room-id");
    const room = cli.getRoom(roomId);
    if (!room) throw new Error(`No room with id ${roomId}`);

    const lastId = props.latestRtcNotificationEventStore.getLatestEventId(roomId);
    const isLastNotificationEvent = lastId === notificationEvent.getId();
    const isLocalEvent = notificationEvent.getId()?.startsWith("~");

    // Check if there's an ongoing call
    const call = props.callStore.getCall(roomId);
    const hasOngoingCall = !!call && !(call instanceof JitsiCall);

    // This is the same logic used for hiding/showing the voice call button.
    const isDmRoom = room.getMembers().length <= 2;

    /**
     * We know we should render the ongoing tile if:
     * - There's an ongoing call in this room
     * - This is the last call tile in the room or a local call tile.
     */
    if ((isLastNotificationEvent || isLocalEvent) && hasOngoingCall) {
        if (isDmRoom) {
            return {
                tileType: "ongoing-call-dm",
                tileViewModel: new DmOngoingCallTileViewModel({
                    mxEvent: notificationEvent,
                    roomId,
                    getRelationsForEvent: props.getRelationsForEvent,
                    callStore: props.callStore,
                    cli: props.cli,
                    legacyCallHandler: props.legacyCallHandler,
                }),
            };
        }
        return {
            tileType: "ongoing-call-room",
            tileViewModel: new RoomOngoingCallTileViewModel({
                roomId,
                mxEvent: notificationEvent,
                getRelationsForEvent: props.getRelationsForEvent,
                callStore: props.callStore,
                cli: props.cli,
                legacyCallHandler: props.legacyCallHandler,
            }),
        };
    }

    if (isDmRoom) {
        return {
            tileType: "tombstone-call-dm",
            tileViewModel: new DmTombstoneCallTileViewModel({
                mxEvent: notificationEvent,
                getRelationsForEvent: props.getRelationsForEvent,
                cli: props.cli,
            }),
        };
    } else
        return {
            tileType: "tombstone-call-room",
            tileViewModel: new RoomTombstoneCallTileViewModel({ mxEvent: notificationEvent }),
        };
}

/**
 * The root call tile view model which decides what call tile should be rendered.
 */
export class RootCallTileViewModel extends BaseViewModel<RootCallTileViewSnapshot, Props> {
    public constructor(props: Props) {
        const snapshot = computeSnapshot(props);
        super(props, snapshot);
        this.trackViewModel(snapshot.tileViewModel);
        this.addListener();
    }

    private addListener(): void {
        // Recompute the state on changes to the call in this room
        this.disposables.trackListener(
            this.props.callStore,
            CallStoreEvent.Call,
            this.onCallStoreEvent as (...args: unknown[]) => void,
        );

        // Recompute the state when the latest rtc notification event in this room changes
        this.disposables.trackListener(this.props.latestRtcNotificationEventStore, LatestRtcNotificationEventUpdate, ((
            roomId: string,
            eventId: string,
        ) => {
            if (roomId === this.props.mxEvent.getRoomId() && eventId === this.props.mxEvent.getId()) {
                this.recomputeSnapshot();
            }
        }) as (...args: unknown[]) => void);
    }

    private onCallStoreEvent = (_: unknown, roomId: string): void => {
        if (roomId === this.props.mxEvent.getRoomId()) {
            this.recomputeSnapshot();
        }
    };

    private recomputeSnapshot(): void {
        const snapshot = computeSnapshot(this.props);
        const currentTileType = this.getSnapshot().tileType;
        if (currentTileType === snapshot.tileType) {
            /**
             * We're already rendering the correct vm if the tile type did not change.
             * So dispose thew new vm and return.
             */
            (snapshot.tileViewModel as BaseViewModel<unknown, unknown>).dispose();
            return;
        }

        this.trackViewModel(snapshot.tileViewModel);
        this.snapshot.set(snapshot);
    }

    private trackViewModel(vm: ViewModel<unknown>): void {
        // ViewModel type has no dispose method, so this needs a type assertion.
        this.disposables.track(vm as BaseViewModel<unknown, unknown>);
    }
}
