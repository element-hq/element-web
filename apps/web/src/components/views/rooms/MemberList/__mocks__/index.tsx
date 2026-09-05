/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { act } from "react";
import { render, type RenderResult, waitFor } from "test-utils-rtl";
// Import VirtuosoMockContext from shared-components to ensure context compatibility
// with the ListView component which also imports from shared-components
import { VirtuosoMockContext } from "@element-hq/web-shared-components";
import {
    Room,
    type MatrixClient,
    type MatrixEvent,
    type RoomState,
    RoomMember,
    User,
    EventType,
    RoomStateEvent,
    RoomEvent,
    TypedEventEmitter,
} from "matrix-js-sdk/src/matrix";
import {
    type CallMembership,
    type MatrixRTCSession,
    MatrixRTCSessionEvent,
    type MatrixRTCSessionEventHandlerMap,
} from "matrix-js-sdk/src/matrixrtc";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { vi, expect } from "vitest";

import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import * as TestUtils from "test-utils";
import { SDKContext } from "../../../../../contexts/SDKContext";
import { TestSDKContext } from "../../../../../../test/unit-tests/TestSDKContext";
import MemberListView from "../MemberListView";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import { type Call, CallEvent } from "../../../../../models/Call";
import { CallStore } from "../../../../../stores/CallStore";

// Adapt RTC test memberships to the Call API consumed by the real useCall hooks.
function createCall(room: Room, session: MatrixRTCSession): Call {
    const call = new TypedEventEmitter() as unknown as Call;
    const getParticipants = (): Map<RoomMember, Set<string>> => {
        const participants = new Map<RoomMember, Set<string>>();
        for (const membership of session.memberships) {
            const member = room.currentState.members[membership.userId];
            if (!member) continue;
            const devices = participants.get(member) ?? new Set<string>();
            devices.add(membership.deviceId);
            participants.set(member, devices);
        }
        return participants;
    };
    Object.defineProperty(call, "participants", { get: getParticipants });
    session.on(MatrixRTCSessionEvent.MembershipsChanged, () => {
        call.emit(CallEvent.Participants, getParticipants(), new Map());
    });
    return call;
}

export function createRoom(client: MatrixClient, opts = {}) {
    const roomId = "!" + Math.random().toString().slice(2, 10) + ":domain";
    const room = new Room(roomId, client, client.getUserId()!);
    room.updateMyMembership(KnownMembership.Join);
    if (opts) {
        Object.assign(room, opts);
    }
    return room;
}

export type Rendered = {
    client: MatrixClient;
    context: TestSDKContext;
    root: RenderResult;
    memberListRoom: Room;
    adminUsers: RoomMember[];
    moderatorUsers: RoomMember[];
    defaultUsers: RoomMember[];
    invitedUsers: RoomMember[];
    call: Call;
    otherRoomCall: Call;
    roomSession: MatrixRTCSession;
    otherRoomSession: MatrixRTCSession;
    reRender: () => Promise<void>;
};

export async function renderMemberList(
    enablePresence: boolean,
    roomSetup?: (room: Room) => void,
    usersPerLevel: number = 2,
    threePidEvents: MatrixEvent[] = [],
    callMemberships: CallMembership[] = [],
    otherRoomCallMemberships: CallMembership[] = [],
    invitedUserCount: number = 0,
    beforeRender?: (
        context: TestSDKContext,
        roomSession: MatrixRTCSession,
        memberListRoom: Room,
    ) => void | Promise<void>,
): Promise<Rendered> {
    TestUtils.stubClient();
    const client = MatrixClientPeg.safeGet();
    client.hasLazyLoadMembersEnabled = () => false;
    const roomSession = new TypedEventEmitter<
        MatrixRTCSessionEvent,
        MatrixRTCSessionEventHandlerMap
    >() as unknown as MatrixRTCSession;
    roomSession.memberships = callMemberships;
    const otherRoomSession = new TypedEventEmitter<
        MatrixRTCSessionEvent,
        MatrixRTCSessionEventHandlerMap
    >() as unknown as MatrixRTCSession;
    otherRoomSession.memberships = otherRoomCallMemberships;

    // Make room
    const memberListRoom = createRoom(client);
    client.matrixRTC.getRoomSession = vi
        .fn()
        .mockImplementation((room: Room) => (room === memberListRoom ? roomSession : otherRoomSession));
    expect(memberListRoom.roomId).toBeTruthy();

    // Give the test an opportunity to make changes to room before first render
    roomSetup?.(memberListRoom);

    // Make users
    const adminUsers = [];
    const moderatorUsers = [];
    const defaultUsers = [];
    const invitedUsers = [];
    for (let i = 0; i < usersPerLevel; i++) {
        const adminUser = new RoomMember(memberListRoom.roomId, `@admin${i}:localhost`);
        adminUser.membership = KnownMembership.Join;
        adminUser.powerLevel = 100;
        adminUser.user = User.createUser(adminUser.userId, client);
        adminUser.user.currentlyActive = true;
        adminUser.user.presence = "online";
        adminUser.user.lastPresenceTs = 1000;
        adminUser.user.lastActiveAgo = 10;
        adminUsers.push(adminUser);

        const moderatorUser = new RoomMember(memberListRoom.roomId, `@moderator${i}:localhost`);
        moderatorUser.membership = KnownMembership.Join;
        moderatorUser.powerLevel = 50;
        moderatorUser.user = User.createUser(moderatorUser.userId, client);
        moderatorUser.user.currentlyActive = true;
        moderatorUser.user.presence = "online";
        moderatorUser.user.lastPresenceTs = 1000;
        moderatorUser.user.lastActiveAgo = 10;
        moderatorUsers.push(moderatorUser);

        const defaultUser = new RoomMember(memberListRoom.roomId, `@default${i}:localhost`);
        defaultUser.membership = KnownMembership.Join;
        defaultUser.powerLevel = 0;
        defaultUser.user = User.createUser(defaultUser.userId, client);
        defaultUser.user.currentlyActive = true;
        defaultUser.user.presence = "online";
        defaultUser.user.lastPresenceTs = 1000;
        defaultUser.user.lastActiveAgo = 10;
        defaultUsers.push(defaultUser);
    }
    for (let i = 0; i < invitedUserCount; i++) {
        const invitedUser = new RoomMember(memberListRoom.roomId, `@invited${i}:localhost`);
        invitedUser.membership = KnownMembership.Invite;
        invitedUser.user = User.createUser(invitedUser.userId, client);
        invitedUsers.push(invitedUser);
    }

    client.getRoom = (roomId) => {
        if (roomId === memberListRoom.roomId) return memberListRoom;
        else return null;
    };
    memberListRoom.currentState = {
        members: {},
        getMember: vi.fn(),
        getStateEvents: TestUtils.mockStateEventImplementation(threePidEvents),
        getInviteForThreePidToken: vi.fn().mockReturnValue(null),
        getInvitedMemberCount: vi.fn(
            () =>
                Object.values(memberListRoom.currentState.members).filter(
                    (member) => member.membership === KnownMembership.Invite,
                ).length,
        ),
        getJoinedMemberCount: vi.fn(
            () =>
                Object.values(memberListRoom.currentState.members).filter(
                    (member) => member.membership === KnownMembership.Join,
                ).length,
        ),
        on: vi.fn(),
        off: vi.fn(),
    } as unknown as RoomState;
    for (const member of [...adminUsers, ...moderatorUsers, ...defaultUsers, ...invitedUsers]) {
        memberListRoom.currentState.members[member.userId] = member;
    }

    const call = createCall(memberListRoom, roomSession);
    const otherRoomCall = createCall(memberListRoom, otherRoomSession);
    vi.spyOn(CallStore.instance, "getCall").mockImplementation((roomId) =>
        roomId === memberListRoom.roomId ? call : otherRoomCall,
    );

    const context = new TestSDKContext();
    context._client = client;
    context.memberListStore.isPresenceEnabled = vi.fn().mockReturnValue(enablePresence);
    await beforeRender?.(context, roomSession, memberListRoom);
    const root = render(
        <MatrixClientContext.Provider value={client}>
            <SDKContext.Provider value={context}>
                <MemberListView roomId={memberListRoom.roomId} onClose={() => {}} />
            </SDKContext.Provider>
        </MatrixClientContext.Provider>,
        {
            wrapper: ({ children }) => (
                <VirtuosoMockContext.Provider value={{ viewportHeight: 600, itemHeight: 56 }}>
                    <>{children}</>
                </VirtuosoMockContext.Provider>
            ),
        },
    );
    await waitFor(async () => {
        expect(root.container.querySelectorAll(".mx_MemberTileView")).toHaveLength(
            usersPerLevel * 3 + invitedUserCount + threePidEvents.length,
        );
    });

    const reRender = createReRenderFunction(client, memberListRoom);

    return {
        client,
        context,
        root,
        memberListRoom,
        adminUsers,
        moderatorUsers,
        defaultUsers,
        invitedUsers,
        call,
        otherRoomCall,
        roomSession,
        otherRoomSession,
        reRender,
    };
}

function createReRenderFunction(client: MatrixClient, memberListRoom: Room): Rendered["reRender"] {
    return async function (): Promise<void> {
        await act(async () => {
            // Refresh counts after tests add or remove members directly in the mocked state.
            memberListRoom.emit(RoomEvent.Summary, {
                "m.heroes": [],
                "m.joined_member_count": memberListRoom.getJoinedMemberCount(),
                "m.invited_member_count": memberListRoom.getInvitedMemberCount(),
            });
            //@ts-ignore
            client.emit(RoomStateEvent.Events, {
                //@ts-ignore
                getType: () => EventType.RoomThirdPartyInvite,
                getRoomId: () => memberListRoom.roomId,
            });
        });
    };
}
