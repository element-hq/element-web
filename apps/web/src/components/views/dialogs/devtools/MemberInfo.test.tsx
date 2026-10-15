/*
Copyright 2026 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, vi, type MockedObject } from "vitest";
import { type MatrixClient, MatrixEvent, Room, EventType } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { render, screen } from "test-utils-rtl";
import { stubClient } from "test-utils";

import MemberInfoExplorer from "./MemberInfo";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { DevtoolsContext } from "./BaseTool";

describe("<MemberInfoExplorer />", () => {
    const roomId = "!room:localhost";
    const ALICE = "@alice:localhost";
    const BOB = "@bob:localhost";
    const ALICE_KEY = "@euEdVN1DimRHWErEnH3KVVNXduH3SiqMW7yMfO7qVOg";
    const BOB_KEY = "@oG9tWFba7ul1sREui6GTYvJDW8qkoTAxMNWsIexIu-g";
    let cli: MockedObject<MatrixClient>;

    beforeEach(() => {
        cli = stubClient() as MockedObject<MatrixClient>;
        vi.spyOn(cli, "getUserId").mockReturnValue(ALICE);
        vi.spyOn(cli, "getSafeUserId").mockReturnValue(ALICE);
    });

    function member(stableId: string, displayname: string, localpart?: string): MatrixEvent {
        return new MatrixEvent({
            type: EventType.RoomMember,
            sender: stableId,
            state_key: stableId,
            room_id: roomId,
            event_id: `$m-${stableId}`,
            content: {
                membership: KnownMembership.Join,
                displayname,
                ...(localpart ? { localpart, domain: "localhost" } : {}),
            },
        });
    }

    function renderFor(room: Room): ReturnType<typeof render> {
        return render(
            <MatrixClientContext.Provider value={cli}>
                <DevtoolsContext.Provider value={{ room }}>
                    <MemberInfoExplorer onBack={() => {}} setTool={() => {}} />
                </DevtoolsContext.Provider>
            </MatrixClientContext.Provider>,
        );
    }

    it("resolves each member key to the user behind it", () => {
        const room = new Room(roomId, cli, ALICE);
        room.applyMemberInfo({ [ALICE_KEY]: { user_id: ALICE }, [BOB_KEY]: { user_id: BOB } }, true);
        room.currentState.setStateEvents([member(ALICE_KEY, "alice"), member(BOB_KEY, "bob")]);

        renderFor(room);

        expect(screen.getByText(BOB_KEY)).toBeInTheDocument();
        expect(screen.getByText(BOB)).toBeInTheDocument();
        expect(screen.getAllByText("member_info")).toHaveLength(2);
        // Our own key is called out, so you can tell which row is you.
        expect(screen.getByText(/\(you\)/)).toBeInTheDocument();
    });

    it("marks an ordinary room's members as having no mapping", () => {
        const room = new Room(roomId, cli, ALICE);
        room.currentState.setStateEvents([member(ALICE, "alice"), member(BOB, "bob")]);

        renderFor(room);

        expect(screen.getAllByText(/Implicit/)).toHaveLength(2);
        expect(screen.queryByText("member_info")).not.toBeInTheDocument();
    });

    it("shows a member the server cannot name as an unknown user", () => {
        const room = new Room(roomId, cli, ALICE);
        room.applyMemberInfo({ [BOB_KEY]: { user_id: null } }, true);
        room.currentState.setStateEvents([member(BOB_KEY, "bob")]);

        renderFor(room);

        expect(screen.getByText("Unknown user")).toBeInTheDocument();
    });

    it("includes a mapping entry with no member event loaded", () => {
        // e.g. learnt from /joined_members before lazy-loaded members arrived.
        const room = new Room(roomId, cli, ALICE);
        room.applyMemberInfo({ [BOB_KEY]: { user_id: BOB } }, true);

        renderFor(room);

        expect(screen.getByText(BOB_KEY)).toBeInTheDocument();
        expect(screen.getByText(BOB)).toBeInTheDocument();
    });
});
