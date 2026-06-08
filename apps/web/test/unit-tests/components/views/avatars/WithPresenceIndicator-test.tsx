/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, render, renderHook, waitFor } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { type MatrixClient, PendingEventOrdering, Room, RoomMember, User, UserEvent } from "matrix-js-sdk/src/matrix";
import React from "react";

import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { getMockClientWithEventEmitter, stubClient } from "../../../../test-utils";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import WithPresenceIndicator, {
    Presence,
    usePresence,
} from "../../../../../src/components/views/avatars/WithPresenceIndicator";
import { isPresenceEnabled } from "../../../../../src/utils/presence";
import { getJoinedNonFunctionalMembers } from "../../../../../src/utils/room/getJoinedNonFunctionalMembers";

jest.mock("../../../../../src/utils/presence");

jest.mock("../../../../../src/utils/room/getJoinedNonFunctionalMembers", () => ({
    getJoinedNonFunctionalMembers: jest.fn().mockReturnValue([1, 2]),
}));

describe("WithPresenceIndicator", () => {
    const ROOM_ID = "roomId";

    let mockClient: MatrixClient;
    let room: Room;

    function renderComponent() {
        return render(
            <WithPresenceIndicator room={room}>
                <span />
            </WithPresenceIndicator>,
        );
    }

    beforeEach(() => {
        stubClient();
        mockClient = mocked(MatrixClientPeg.safeGet());
        room = new Room(ROOM_ID, mockClient, mockClient.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const dmRoomMap = {
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders only child if presence is disabled", async () => {
        mocked(isPresenceEnabled).mockReturnValue(false);
        const { container } = renderComponent();

        expect(container.children).toHaveLength(1);
        expect(container.children[0].tagName).toBe("SPAN");
    });

    it.each([
        ["online", "Online"],
        ["offline", "Offline"],
        ["unavailable", "Away"],
    ])("renders presence indicator with tooltip for DM rooms", async (presenceStr, renderedStr) => {
        mocked(isPresenceEnabled).mockReturnValue(true);
        const DM_USER_ID = "@bob:foo.bar";
        const dmRoomMap = {
            getUserIdForRoomId: () => {
                return DM_USER_ID;
            },
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
        room.getMember = jest.fn((userId) => {
            const member = new RoomMember(room.roomId, userId);
            member.user = new User(userId);
            member.user.presence = presenceStr;
            return member;
        });

        const { asFragment } = renderComponent();

        expect(asFragment()).toMatchSnapshot();
    });
});

describe("usePresence", () => {
    const ROOM_ID = "roomId";
    const DM_USER_ID = "@bob:foo.bar";

    let mockClient: ReturnType<typeof getMockClientWithEventEmitter>;
    let room: Room;
    let member: RoomMember;
    let user: User;

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({
            getUserId: jest.fn().mockReturnValue("@alice:foo.bar"),
            getUser: jest.fn().mockReturnValue(null),
            store: { getPendingEvents: jest.fn().mockResolvedValue([]) },
        });
        room = new Room(ROOM_ID, mockClient as unknown as MatrixClient, mockClient.getUserId() ?? "");

        mocked(isPresenceEnabled).mockReturnValue(true);
        mocked(getJoinedNonFunctionalMembers).mockReturnValue([1, 2] as any);

        user = new User(DM_USER_ID);
        user.presence = "online";
        member = new RoomMember(ROOM_ID, DM_USER_ID);
        member.user = user;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("returns null when presence is disabled", () => {
        mocked(isPresenceEnabled).mockReturnValue(false);
        const { result } = renderHook(() => usePresence(room, member));
        expect(result.current).toBeNull();
    });

    it("returns null when room does not have exactly 2 members", () => {
        mocked(getJoinedNonFunctionalMembers).mockReturnValue([1] as any);
        const { result } = renderHook(() => usePresence(room, member));
        expect(result.current).toBeNull();
    });

    it("returns null when member is null", () => {
        const { result } = renderHook(() => usePresence(room, null));
        expect(result.current).toBeNull();
    });

    it.each([
        ["online", Presence.Online],
        ["offline", Presence.Offline],
        ["unavailable", Presence.Away],
        ["busy", Presence.Busy],
    ])("returns correct presence for user with '%s' presence state", (presenceStr, expectedPresence) => {
        user.presence = presenceStr;
        const { result } = renderHook(() => usePresence(room, member));
        expect(result.current).toBe(expectedPresence);
    });

    it("returns Online when user.currentlyActive is true regardless of presence string", () => {
        user.presence = "offline";
        user.currentlyActive = true;
        const { result } = renderHook(() => usePresence(room, member));
        expect(result.current).toBe(Presence.Online);
    });

    it("updates when UserEvent.Presence fires on member.user", async () => {
        user.presence = "online";
        const { result } = renderHook(() => usePresence(room, member));
        expect(result.current).toBe(Presence.Online);

        act(() => {
            user.presence = "offline";
            user.emit(UserEvent.Presence, null as any, user);
        });

        await waitFor(() => expect(result.current).toBe(Presence.Offline));
    });

    it("updates when UserEvent.CurrentlyActive fires on member.user", async () => {
        user.presence = "offline";
        user.currentlyActive = false;
        const { result } = renderHook(() => usePresence(room, member));
        expect(result.current).toBe(Presence.Offline);

        act(() => {
            user.currentlyActive = true;
            user.emit(UserEvent.CurrentlyActive, null as any, user);
        });

        await waitFor(() => expect(result.current).toBe(Presence.Online));
    });

    it("returns correct presence when member.user is not linked but client has user data", () => {
        member.user = undefined;
        mocked(mockClient.getUser).mockImplementation((userId) => (userId === DM_USER_ID ? user : null));

        user.presence = "online";
        const { result } = renderHook(() => usePresence(room, member));
        expect(result.current).toBe("online");
    });

    it("updates via client-level UserEvent.Presence when member.user is not yet linked", async () => {
        member.user = undefined;
        mocked(mockClient.getUser).mockImplementation((userId) => (userId === DM_USER_ID ? user : null));
        user.presence = "online";

        const { result } = renderHook(() => usePresence(room, member));
        expect(result.current).toBe(Presence.Online);

        act(() => {
            user.presence = "offline";
            mockClient.emit(UserEvent.Presence, null as any, user);
        });

        await waitFor(() => expect(result.current).toBe(Presence.Offline));
    });

    it("does not update when client emits UserEvent.Presence for a different user", async () => {
        user.presence = "online";
        const { result } = renderHook(() => usePresence(room, member));
        expect(result.current).toBe(Presence.Online);

        act(() => {
            const otherUser = new User("@other:foo.bar");
            otherUser.presence = "offline";
            mockClient.emit(UserEvent.Presence, null as any, otherUser);
        });

        expect(result.current).toBe(Presence.Online);
    });
});
