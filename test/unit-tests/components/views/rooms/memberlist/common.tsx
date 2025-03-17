/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { act } from "react";
import { render, type RenderResult, waitFor } from "jest-matrix-react";
import {
    Room,
    type MatrixClient,
    type RoomState,
    RoomMember,
    User,
    EventType,
    RoomStateEvent,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import * as TestUtils from "../../../../../test-utils";
import { SDKContext } from "../../../../../../src/contexts/SDKContext";
import { TestSdkContext } from "../../../../TestSdkContext";
import MemberListView from "../../../../../../src/components/views/rooms/MemberList/MemberListView";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";

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
    root: RenderResult;
    memberListRoom: Room;
    adminUsers: RoomMember[];
    moderatorUsers: RoomMember[];
    defaultUsers: RoomMember[];
    reRender: () => Promise<void>;
};

export async function renderMemberList(
    enablePresence: boolean,
    roomSetup?: (room: Room) => void,
    usersPerLevel: number = 2,
): Promise<Rendered> {
    TestUtils.stubClient();
    const client = MatrixClientPeg.safeGet();
    client.hasLazyLoadMembersEnabled = () => false;

    // Make room
    const memberListRoom = createRoom(client);
    expect(memberListRoom.roomId).toBeTruthy();

    // Give the test an opportunity to make changes to room before first render
    roomSetup?.(memberListRoom);

    // Make users
    const adminUsers = [];
    const moderatorUsers = [];
    const defaultUsers = [];
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

    client.getRoom = (roomId) => {
        if (roomId === memberListRoom.roomId) return memberListRoom;
        else return null;
    };
    memberListRoom.currentState = {
        members: {},
        getMember: jest.fn(),
        getStateEvents: ((eventType, stateKey) => (stateKey === undefined ? [] : null)) as RoomState["getStateEvents"], // ignore 3pid invites
    } as unknown as RoomState;
    for (const member of [...adminUsers, ...moderatorUsers, ...defaultUsers]) {
        memberListRoom.currentState.members[member.userId] = member;
    }

    const context = new TestSdkContext();
    context.client = client;
    context.memberListStore.isPresenceEnabled = jest.fn().mockReturnValue(enablePresence);
    const root = render(
        <MatrixClientContext.Provider value={client}>
            <SDKContext.Provider value={context}>
                <MemberListView roomId={memberListRoom.roomId} onClose={() => {}} />
            </SDKContext.Provider>
        </MatrixClientContext.Provider>,
    );
    await waitFor(async () => {
        expect(root.container.querySelectorAll(".mx_MemberTileView")).toHaveLength(usersPerLevel * 3);
    });

    const reRender = createReRenderFunction(client, memberListRoom);

    return {
        client,
        root,
        memberListRoom,
        adminUsers,
        moderatorUsers,
        defaultUsers,
        reRender,
    };
}

function createReRenderFunction(client: MatrixClient, memberListRoom: Room): Rendered["reRender"] {
    return async function (): Promise<void> {
        await act(async () => {
            //@ts-ignore
            client.emit(RoomStateEvent.Events, {
                //@ts-ignore
                getType: () => EventType.RoomThirdPartyInvite,
                getRoomId: () => memberListRoom.roomId,
            });
        });
        await new Promise((r) => setTimeout(r, 1000));
    };
}
