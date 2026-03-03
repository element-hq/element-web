/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";
import { EventType, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import dis from "../../../../../src/dispatcher/dispatcher";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import {
    guessServerNameFromRoomId,
    RoomPredecessorTile,
} from "../../../../../src/components/views/messages/RoomPredecessorTile";
import { stubClient, upsertRoomStateEvents } from "../../../../test-utils/test-utils";
import { Action } from "../../../../../src/dispatcher/actions";
import { filterConsole, getRoomContext } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";

jest.mock("../../../../../src/dispatcher/dispatcher");

describe("<RoomPredecessorTile />", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";
    stubClient();
    const client = mocked(MatrixClientPeg.safeGet());

    function makeRoom({
        createEventHasPredecessor = false,
        predecessorEventExists = false,
        predecessorEventHasEventId = false,
        predecessorEventHasViaServers = false,
    }): Room {
        const room = new Room(roomId, client, userId);

        const createInfo = {
            type: EventType.RoomCreate,
            state_key: "",
            sender: userId,
            room_id: roomId,
            content: {},
            event_id: "$create",
        };

        if (createEventHasPredecessor) {
            createInfo.content = {
                predecessor: { room_id: "old_room_id", event_id: "$tombstone_event_id" },
            };
        }

        const createEvent = new MatrixEvent(createInfo);
        upsertRoomStateEvents(room, [createEvent]);

        if (predecessorEventExists) {
            const predecessorInfo = {
                type: EventType.RoomPredecessor,
                state_key: "",
                sender: userId,
                room_id: roomId,
                content: {
                    predecessor_room_id: "old_room_id_from_predecessor",
                    last_known_event_id: predecessorEventHasEventId
                        ? "$tombstone_event_id_from_predecessor"
                        : undefined,
                    via_servers: predecessorEventHasViaServers ? ["a.example.com", "b.example.com"] : undefined,
                },
                event_id: "$predecessor",
            };

            const predecessorEvent = new MatrixEvent(predecessorInfo);
            upsertRoomStateEvents(room, [predecessorEvent]);
        }
        return room;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        mocked(dis.dispatch).mockReset();
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
        stubClient();
    });

    afterAll(() => {
        jest.spyOn(SettingsStore, "getValue").mockRestore();
        jest.spyOn(SettingsStore, "setValue").mockRestore();
    });

    function renderTile(room: Room) {
        // Find this room's create event (it should have one!)
        const createEvent = room.currentState.getStateEvents("m.room.create")[0];
        expect(createEvent).toBeTruthy();

        return render(
            <ScopedRoomContextProvider {...getRoomContext(room, {})}>
                <RoomPredecessorTile mxEvent={createEvent} />
            </ScopedRoomContextProvider>,
        );
    }

    it("Renders as expected", () => {
        const roomCreate = renderTile(makeRoom({ createEventHasPredecessor: true }));
        expect(roomCreate.asFragment()).toMatchSnapshot();
    });

    it("Links to the old version of the room", () => {
        renderTile(makeRoom({ createEventHasPredecessor: true }));
        expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
            "href",
            "https://matrix.to/#/old_room_id/$tombstone_event_id",
        );
    });

    describe("(filtering warnings about no predecessor)", () => {
        filterConsole("RoomPredecessorTile unexpectedly used in a room with no predecessor.");

        it("Shows an empty div if there is no predecessor", () => {
            renderTile(makeRoom({}));
            expect(screen.queryByText("Click here to see older messages.", { exact: false })).toBeNull();
        });
    });

    it("Opens the old room on click", async () => {
        renderTile(makeRoom({ createEventHasPredecessor: true }));
        const link = screen.getByText("Click here to see older messages.");

        await act(() => userEvent.click(link));

        await waitFor(() =>
            expect(dis.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                event_id: "$tombstone_event_id",
                highlighted: true,
                room_id: "old_room_id",
                metricsTrigger: "Predecessor",
                metricsViaKeyboard: false,
            }),
        );
    });

    it("Ignores m.predecessor if labs flag is off", () => {
        renderTile(makeRoom({ createEventHasPredecessor: true, predecessorEventExists: true }));
        expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
            "href",
            "https://matrix.to/#/old_room_id/$tombstone_event_id",
        );
    });

    describe("If the predecessor room is not found", () => {
        filterConsole("Failed to find predecessor room with id old_room_id");

        beforeEach(() => {
            mocked(MatrixClientPeg.safeGet().getRoom).mockReturnValue(null);
        });

        it("Shows an error if there are no via servers", () => {
            renderTile(makeRoom({ createEventHasPredecessor: true, predecessorEventExists: true }));
            expect(screen.getByText("Can't find the old version of this room", { exact: false })).toBeInTheDocument();
        });
    });

    describe("When feature_dynamic_room_predecessors = true", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        afterEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReset();
        });

        it("Uses the create event if there is no m.predecessor", () => {
            renderTile(makeRoom({ createEventHasPredecessor: true }));
            expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
                "href",
                "https://matrix.to/#/old_room_id/$tombstone_event_id",
            );
        });

        it("Uses m.predecessor when it's there", () => {
            renderTile(makeRoom({ createEventHasPredecessor: true, predecessorEventExists: true }));
            expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
                "href",
                "https://matrix.to/#/old_room_id_from_predecessor",
            );
        });

        it("Links to the event in the room if event ID is provided", () => {
            renderTile(
                makeRoom({
                    createEventHasPredecessor: true,
                    predecessorEventExists: true,
                    predecessorEventHasEventId: true,
                }),
            );
            expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
                "href",
                "https://matrix.to/#/old_room_id_from_predecessor/$tombstone_event_id_from_predecessor",
            );
        });

        describe("If the predecessor room is not found", () => {
            filterConsole("Failed to find predecessor room with id old_room_id");

            beforeEach(() => {
                mocked(MatrixClientPeg.safeGet().getRoom).mockReturnValue(null);
            });

            it("Shows an error if there are no via servers", () => {
                renderTile(makeRoom({ createEventHasPredecessor: true, predecessorEventExists: true }));
                expect(
                    screen.getByText("Can't find the old version of this room", { exact: false }),
                ).toBeInTheDocument();
            });

            it("Shows a tile if there are via servers", () => {
                renderTile(
                    makeRoom({
                        createEventHasPredecessor: true,
                        predecessorEventExists: true,
                        predecessorEventHasViaServers: true,
                    }),
                );
                expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
                    "href",
                    "https://matrix.to/#/old_room_id_from_predecessor?via=a.example.com&via=b.example.com",
                );
            });

            it("Shows a tile linking to an event if there are via servers", () => {
                renderTile(
                    makeRoom({
                        createEventHasPredecessor: true,
                        predecessorEventExists: true,
                        predecessorEventHasEventId: true,
                        predecessorEventHasViaServers: true,
                    }),
                );
                expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
                    "href",
                    "https://matrix.to/#/old_room_id_from_predecessor/$tombstone_event_id_from_predecessor?via=a.example.com&via=b.example.com",
                );
            });
        });
    });
});

describe("guessServerNameFromRoomId", () => {
    it("Extracts the domain name from a standard room ID", () => {
        expect(guessServerNameFromRoomId("!436456:example.com")).toEqual("example.com");
    });

    it("Extracts the domain name and port when included", () => {
        expect(guessServerNameFromRoomId("!436456:example.com:8888")).toEqual("example.com:8888");
    });

    it("Handles an IPv4 address for server name", () => {
        expect(guessServerNameFromRoomId("!436456:127.0.0.1")).toEqual("127.0.0.1");
    });

    it("Handles an IPv4 address and port", () => {
        expect(guessServerNameFromRoomId("!436456:127.0.0.1:81")).toEqual("127.0.0.1:81");
    });

    it("Handles an IPv6 address for server name", () => {
        expect(guessServerNameFromRoomId("!436456:::1")).toEqual("::1");
    });

    it("Handles an IPv6 address and port", () => {
        expect(guessServerNameFromRoomId("!436456:::1:8080")).toEqual("::1:8080");
    });

    it("Returns null when the room ID contains no colon", () => {
        expect(guessServerNameFromRoomId("!436456")).toBeNull();
    });
});
