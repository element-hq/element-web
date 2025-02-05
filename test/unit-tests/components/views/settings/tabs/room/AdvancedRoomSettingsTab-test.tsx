/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, type RenderResult, screen } from "jest-matrix-react";
import { type MatrixClient, type Room, EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import AdvancedRoomSettingsTab from "../../../../../../../src/components/views/settings/tabs/room/AdvancedRoomSettingsTab";
import { mkEvent, mkStubRoom, stubClient } from "../../../../../../test-utils";
import dis from "../../../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../../../src/dispatcher/actions";
import { MatrixClientPeg } from "../../../../../../../src/MatrixClientPeg";
import SettingsStore from "../../../../../../../src/settings/SettingsStore";

jest.mock("../../../../../../../src/dispatcher/dispatcher");

describe("AdvancedRoomSettingsTab", () => {
    const roomId = "!room:example.com";
    let cli: MatrixClient;
    let room: Room;

    const renderTab = (): RenderResult => {
        return render(<AdvancedRoomSettingsTab room={room} closeSettingsFn={jest.fn()} />);
    };

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        room = mkStubRoom(roomId, "test room", cli);
        mocked(cli.getRoom).mockReturnValue(room);
        mocked(dis.dispatch).mockReset();
        mocked(room.findPredecessor).mockImplementation((msc3946: boolean) =>
            msc3946
                ? { roomId: "old_room_id_via_predecessor", viaServers: ["one.example.com", "two.example.com"] }
                : { roomId: "old_room_id", eventId: "tombstone_event_id" },
        );
    });

    it("should render as expected", () => {
        const tab = renderTab();
        expect(tab.asFragment()).toMatchSnapshot();
    });

    it("should display room ID", () => {
        const tab = renderTab();
        tab.getByText(roomId);
    });

    it("should display room version", () => {
        mocked(room.getVersion).mockReturnValue("custom_room_version_1");

        const tab = renderTab();
        tab.getByText("custom_room_version_1");
    });

    it("displays message when room cannot federate", () => {
        const createEvent = new MatrixEvent({
            sender: "@a:b.com",
            type: EventType.RoomCreate,
            content: { "m.federate": false },
            room_id: room.roomId,
            state_key: "",
        });
        jest.spyOn(room.currentState, "getStateEvents").mockImplementation((type) =>
            type === EventType.RoomCreate ? createEvent : null,
        );

        renderTab();
        expect(screen.getByText("This room is not accessible by remote Matrix servers")).toBeInTheDocument();
    });

    function mockStateEvents(room: Room) {
        const createEvent = mkEvent({
            event: true,
            user: "@a:b.com",
            type: EventType.RoomCreate,
            content: { predecessor: { room_id: "old_room_id", event_id: "tombstone_event_id" } },
            room: room.roomId,
        });

        // Because we're mocking Room.findPredecessor, it may not be necessary
        // to provide the actual event here, but we do need the create event,
        // and in future this may be needed, so included for symmetry.
        const predecessorEvent = mkEvent({
            event: true,
            user: "@a:b.com",
            type: EventType.RoomPredecessor,
            content: { predecessor_room_id: "old_room_id_via_predecessor" },
            room: room.roomId,
        });

        type GetStateEvents2Args = (eventType: EventType | string, stateKey: string) => MatrixEvent | null;

        const getStateEvents = jest.spyOn(
            room.currentState,
            "getStateEvents",
        ) as unknown as jest.MockedFunction<GetStateEvents2Args>;

        getStateEvents.mockImplementation((eventType: string | null, _key: string) => {
            switch (eventType) {
                case EventType.RoomCreate:
                    return createEvent;
                case EventType.RoomPredecessor:
                    return predecessorEvent;
                default:
                    return null;
            }
        });
    }

    it("should link to predecessor room", async () => {
        mockStateEvents(room);
        const tab = renderTab();
        const link = await tab.findByText("View older messages in test room.");
        fireEvent.click(link);
        expect(dis.dispatch).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            event_id: "tombstone_event_id",
            room_id: "old_room_id",
            metricsTrigger: "WebPredecessorSettings",
            metricsViaKeyboard: false,
        });
    });

    describe("When MSC3946 support is enabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue")
                .mockReset()
                .mockImplementation((settingName) => settingName === "feature_dynamic_room_predecessors");
        });

        it("should link to predecessor room via MSC3946 if enabled", async () => {
            mockStateEvents(room);
            const tab = renderTab();
            const link = await tab.findByText("View older messages in test room.");
            fireEvent.click(link);
            expect(dis.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                event_id: undefined,
                room_id: "old_room_id_via_predecessor",
                via_servers: ["one.example.com", "two.example.com"],
                metricsTrigger: "WebPredecessorSettings",
                metricsViaKeyboard: false,
            });
        });

        it("handles when room is a space", async () => {
            mockStateEvents(room);
            jest.spyOn(room, "isSpaceRoom").mockReturnValue(true);

            mockStateEvents(room);
            const tab = renderTab();
            const link = await tab.findByText("View older version of test room.");
            expect(link).toBeInTheDocument();
            expect(screen.getByText("Space information")).toBeInTheDocument();
        });
    });
});
