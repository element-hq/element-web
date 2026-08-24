/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { act, render, screen, waitFor, type RenderOptions } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { test, describe, beforeEach, afterEach, expect, vi, type Mocked } from "vitest";
import {
    EventType,
    type MatrixClient,
    type MatrixEvent,
    PendingEventOrdering,
    Room,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";

import { ThreadHeader } from "./ThreadHeader";
import { mkEvent, mkMessage, stubClient } from "../../../../test/test-utils";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import RoomContext, { type RoomContextType } from "../../../contexts/RoomContext";
import { ScopedRoomContextProvider } from "../../../contexts/ScopedRoomContext";
import { SDKContext } from "../../../contexts/SDKContext";
import { SDKContextClass } from "../../../contexts/SDKContextClass";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import DMRoomMap from "../../../utils/DMRoomMap";
import { CallStore } from "../../../stores/CallStore";

vi.mock("../../../hooks/right-panel/useCurrentPhase", () => ({
    useCurrentPhase: () => ({ currentPhase: null, isOpen: false }),
}));

describe("<ThreadHeader />", () => {
    const roomId = "!room:server.org";
    let client: MatrixClient;
    let room: Room;
    let threadRoot: MatrixEvent;
    let roomContext: RoomContextType;
    let setCardSpy: Mocked<RightPanelStore["setCard"]>;

    const roomViewStore = {
        isViewingCall: vi.fn().mockReturnValue(false),
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
    };

    beforeEach(() => {
        client = stubClient();
        room = new Room(roomId, client, "@alice:server.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        room.name = "Github";
        threadRoot = mkMessage({ event: true, room: roomId, user: "@bob:server.org", msg: "Ship it on Friday?" });
        DMRoomMap.setShared({
            getUserIdForRoomId: vi.fn(),
        } as unknown as DMRoomMap);
        setCardSpy = vi.spyOn(RightPanelStore.instance, "setCard");
        vi.spyOn(CallStore.instance, "getCall").mockReturnValue(null);
        vi.spyOn(CallStore.instance, "getConfiguredRTCTransports").mockReturnValue([]);
        roomContext = { ...RoomContext, roomId, roomViewStore } as unknown as RoomContextType;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const wrapper = (): RenderOptions => ({
        wrapper: ({ children }) => (
            <SDKContext.Provider value={SDKContextClass.instance}>
                <MatrixClientContext.Provider value={client}>
                    <ScopedRoomContextProvider {...roomContext}>{children}</ScopedRoomContextProvider>
                </MatrixClientContext.Provider>
            </SDKContext.Provider>
        ),
    });

    const renderHeader = (onBack = vi.fn()): (() => void) => {
        render(<ThreadHeader room={room} threadRoot={threadRoot} onBack={onBack} />, wrapper());
        return onBack;
    };

    test("identifies the thread by the message it started from", () => {
        renderHeader();

        expect(screen.getByText("Thread")).toBeInTheDocument();
        expect(screen.getByText("Ship it on Friday?")).toBeInTheDocument();
    });

    test("names the thread and its room in a single heading for assistive technology", () => {
        renderHeader();

        expect(screen.getByRole("heading", { name: "Thread in Github: Ship it on Friday?" })).toBeInTheDocument();
    });

    test("follows the thread root when it is redacted", async () => {
        renderHeader();
        expect(screen.getByText("Ship it on Friday?")).toBeInTheDocument();

        act(() => {
            threadRoot.makeRedacted(
                mkEvent({
                    event: true,
                    type: EventType.RoomRedaction,
                    room: roomId,
                    user: "@bob:server.org",
                    content: {},
                    redacts: threadRoot.getId(),
                }),
                room,
            );
            room.emit(RoomEvent.Redaction, threadRoot, room);
        });

        await waitFor(() => expect(screen.getByRole("heading", { name: "Thread in Github" })).toBeInTheDocument());
        expect(screen.queryByText("Ship it on Friday?")).not.toBeInTheDocument();
    });

    test("names the room the back affordance returns to", async () => {
        const onBack = renderHeader();

        await userEvent.click(screen.getByRole("button", { name: "Back to Github" }));
        expect(onBack).toHaveBeenCalled();
    });

    test("keeps the threads list reachable from inside a thread", async () => {
        renderHeader();

        await userEvent.click(screen.getByRole("button", { name: "Threads" }));
        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.ThreadPanel });
    });

    test("keeps the room's own quick actions in reach", () => {
        renderHeader();

        expect(screen.getByRole("button", { name: "Room info" })).toBeInTheDocument();
    });
});
