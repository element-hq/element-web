/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    CallDirection,
    CallType as SharedComponentsCallType,
    type CommonOngoingCallTileViewSnapshot,
} from "@element-hq/web-shared-components";
import {
    EventTimeline,
    EventType,
    type RoomMember,
    type MatrixEvent,
    type MatrixClient,
} from "matrix-js-sdk/src/matrix";
import { CallType } from "matrix-js-sdk/src/webrtc/call";

import { type CallStore } from "../../../../../../../stores/CallStore";
import { MemberAvatarViewModel } from "../../../../../../../components/viewmodels/avatars/MemberAvatarViewModel";
import { FacePileViewModel } from "../../../../../../../components/viewmodels/avatars/FacePileViewModel";
import { CallEvent, type ElementCall } from "../../../../../../../models/Call";
import { placeCall } from "../../../../../../../utils/room/placeCall";
import { PlatformCallType } from "../../../../../../../hooks/room/useRoomCall";
import { type GetRelationsForEvent } from "../../../../../../../components/views/rooms/EventTile";
import { getIntentFromEvent } from "../../common";
import { DurationViewModel } from "./components/DurationViewModel";

export interface Props {
    /**
     * The id of the room.
     */
    roomId: string;
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
}

function getCallOrThrow(store: CallStore, roomId: string): ElementCall {
    const call = store.getCall(roomId);
    if (!call) {
        throw new Error(`No call in room ${roomId}`);
    }
    return call as ElementCall;
}

/**
 * Whether this call has participants other than who started the call.
 */
function doesCallHaveOtherParticipants(notificationEvent: MatrixEvent, participants: RoomMember[]): boolean {
    return Array.from(participants).some((participant) => participant.userId !== notificationEvent.sender?.userId);
}

function computeSnapshot(props: Props): CommonOngoingCallTileViewSnapshot {
    const mxEvent = props.mxEvent;
    const callStore = props.callStore;
    const cli = props.cli;
    const roomId = mxEvent.getRoomId();
    if (!roomId) {
        throw new Error("RTCNotification event has no room associated with it!");
    }

    // Get the call in the room
    const call = getCallOrThrow(callStore, roomId);

    // Find the mx-id of the user who started this call
    const startedUserId = mxEvent.getSender();
    if (!startedUserId) {
        throw new Error("RTCNotification event has no sender associated with it!");
    }

    // Get room-member from mx-id
    const participants = Array.from(call.participants.keys());
    const callHasOtherParticipants = doesCallHaveOtherParticipants(props.mxEvent, participants);

    const room = cli.getRoom(roomId);
    if (!room) {
        throw new Error(`Cannot find room ${roomId}`);
    }

    const startedMember = mxEvent.sender;
    if (!startedMember) {
        // This should never happen but just to be safe ...
        throw new Error("Event does not have a sender!");
    }
    const startedByDisplayName = startedMember.name;

    // We know we're joined to this call if there's an active call in the room
    const isJoined = !!callStore.getActiveCall(roomId);

    const callDirection = cli.getUserId() === startedUserId ? CallDirection.Outgoing : CallDirection.Incoming;

    // Create the avatar vms
    const facePileViewModel = new FacePileViewModel({ size: 20, members: participants, cli });
    const memberAvatarViewModel = new MemberAvatarViewModel({ member: startedMember, size: 20, cli });

    const isJoinable = !!room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.mayClientSendStateEvent(EventType.GroupCallMemberPrefix, room.client);

    const callStartTs = call.session.getOldestMembership()?.createdTs();
    let durationViewModel: DurationViewModel | undefined;
    if (callStartTs) {
        durationViewModel = new DurationViewModel({ callStartTs });
    }

    return {
        startedByDisplayName,
        isJoined,
        isJoinable,
        facePileViewModel,
        memberAvatarViewModel,
        callDirection,
        durationViewModel,
        callHasOtherParticipants,
    };
}

/**
 * A base view model for an ongoing call in the timeline.
 */
export class BaseOngoingCallViewModel<
    T extends CommonOngoingCallTileViewSnapshot = CommonOngoingCallTileViewSnapshot,
> extends BaseViewModel<T, Props> {
    public constructor(props: Props, extraSnapshot: Partial<T> = {}) {
        const snapshot = { ...computeSnapshot(props), ...extraSnapshot };
        super(props, snapshot as T);
        this.disposables.track(snapshot.facePileViewModel as BaseViewModel<unknown, unknown>);
        this.disposables.track(snapshot.memberAvatarViewModel as BaseViewModel<unknown, unknown>);
        this.setupListener();
    }

    private setupListener(): void {
        const call = getCallOrThrow(this.props.callStore, this.props.roomId);
        this.disposables.trackListener(call, CallEvent.Participants, ((participants: Map<RoomMember, Set<string>>) => {
            this.onParticipantsChange(participants);
        }) as (...args: unknown[]) => void);
    }

    /**
     * Join the call associated with this tile.
     * @param event The button click event
     */
    public join(event?: React.MouseEvent<HTMLButtonElement>): void {
        const roomId = this.props.roomId;
        const room = this.props.cli.getRoom(roomId);
        if (!room) {
            throw new Error(`Cannot find room ${roomId}`);
        }
        const callType = getIntentFromEvent(this.props.mxEvent);
        const type = callType === SharedComponentsCallType.Voice ? CallType.Voice : CallType.Video;
        placeCall(room, type, PlatformCallType.ElementCall, event?.shiftKey || undefined, type === CallType.Voice);
    }

    /**
     * Recomputes the snapshot when the call participants are updated.
     */
    protected onParticipantsChange(participants: Map<RoomMember, Set<string>>, extraSnapshot: Partial<T> = {}): void {
        const roomId = this.props.roomId;
        const isJoined = !!this.props.callStore.getActiveCall(roomId);
        const members = Array.from(participants.keys());
        const callHasOtherParticipants = doesCallHaveOtherParticipants(this.props.mxEvent, members);
        (this.getSnapshot().facePileViewModel as FacePileViewModel).updateMembers(members);
        this.snapshot.merge({ isJoined, callHasOtherParticipants, ...extraSnapshot } as Partial<T>);
    }
}
