/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, render, renderHook, waitFor } from "test-utils-rtl";
import { type MatrixClient, PendingEventOrdering, Room, RoomMember, User, UserEvent } from "matrix-js-sdk/src/matrix";
import React from "react";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { getMockClientWithEventEmitter, stubClient } from "../../../../test/test-utils";
import DMRoomMap from "../../../utils/DMRoomMap";
import WithPresenceIndicator, { Presence, usePresence } from "./WithPresenceIndicator";
import { isPresenceEnabled } from "../../../utils/presence";
import { getJoinedNonFunctionalMembers } from "../../../utils/room/getJoinedNonFunctionalMembers";

vi.mock("../../../utils/presence");

vi.mock("../../../utils/room/getJoinedNonFunctionalMembers", () => ({
    getJoinedNonFunctionalMembers: vi.fn().mockReturnValue([1, 2]),
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
        mockClient = vi.mocked(MatrixClientPeg.safeGet());
        room = new Room(ROOM_ID, mockClient, mockClient.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const dmRoomMap = {
            getUserIdForRoomId: vi.fn(),
        } as unknown as DMRoomMap;
        vi.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders only child if presence is disabled", async () => {
        vi.mocked(isPresenceEnabled).mockReturnValue(false);
        const { container } = renderComponent();

        expect(container.children).toHaveLength(1);
        expect(container.children[0].tagName).toBe("SPAN");
    });

    it.each([
        ["online", "Online"],
        ["offline", "Offline"],
        ["unavailable", "Away"],
    ])("renders presence indicator with tooltip for DM rooms", async (presenceStr, renderedStr) => {
        vi.mocked(isPresenceEnabled).mockReturnValue(true);
        const DM_USER_ID = "@bob:foo.bar";
        const dmRoomMap = {
            getUserIdForRoomId: () => {
                return DM_USER_ID;
            },
        } as unknown as DMRoomMap;
        vi.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
        room.getMember = vi.fn((userId) => {
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
            getUserId: vi.fn().mockReturnValue("@alice:foo.bar"),
            getUser: vi.fn().mockReturnValue(null),
            store: { getPendingEvents: vi.fn().mockResolvedValue([]) },
        });
        room = new Room(ROOM_ID, mockClient as unknown as MatrixClient, mockClient.getUserId() ?? "");

        vi.mocked(isPresenceEnabled).mockReturnValue(true);
        vi.mocked(getJoinedNonFunctionalMembers).mockReturnValue([1, 2] as any);

        user = new User(DM_USER_ID);
        user.presence = "online";
        member = new RoomMember(ROOM_ID, DM_USER_ID);
        member.user = user;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns null when presence is disabled", () => {
        vi.mocked(isPresenceEnabled).mockReturnValue(false);
        const { result } = renderHook(() => usePresence(room, member));
        expect(result.current).toBeNull();
    });

    it("returns null when room does not have exactly 2 members", () => {
        vi.mocked(getJoinedNonFunctionalMembers).mockReturnValue([1] as any);
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
        vi.mocked(mockClient.getUser).mockImplementation((userId) => (userId === DM_USER_ID ? user : null));

        user.presence = "online";
        const { result } = renderHook(() => usePresence(room, member));
        expect(result.current).toBe("online");
    });

    it("updates via client-level UserEvent.Presence when member.user is not yet linked", async () => {
        member.user = undefined;
        vi.mocked(mockClient.getUser).mockImplementation((userId) => (userId === DM_USER_ID ? user : null));
        user.presence = "online";

        const { result } = renderHook(() => usePresence(room, member));
        expect(result.current).toBe(Presence.Online);

        act(() => {
            user.presence = "offline";
            mockClient.emit(UserEvent.Presence, null as any, user);
        });

        await waitFor(() => expect(result.current).toBe(Presence.Offline));
    });

    it("uses the canonical client user when the room member has a stale user reference", () => {
        const staleUser = new User(DM_USER_ID);
        staleUser.presence = "offline";
        member.user = staleUser;
        user.presence = "online";
        vi.mocked(mockClient.getUser).mockReturnValue(user);

        const { result } = renderHook(() => usePresence(room, member));

        expect(result.current).toBe(Presence.Online);
    });

    it("updates via client-level UserEvent.CurrentlyActive when member.user is not yet linked", async () => {
        member.user = undefined;
        vi.mocked(mockClient.getUser).mockImplementation((userId) => (userId === DM_USER_ID ? user : null));
        user.presence = "offline";
        user.currentlyActive = false;

        const { result } = renderHook(() => usePresence(room, member));
        expect(result.current).toBe(Presence.Offline);

        act(() => {
            user.currentlyActive = true;
            mockClient.emit(UserEvent.CurrentlyActive, null as any, user);
        });

        await waitFor(() => expect(result.current).toBe(Presence.Online));
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
