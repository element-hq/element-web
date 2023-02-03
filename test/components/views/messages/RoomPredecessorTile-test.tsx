/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";
import { EventType, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import dis from "../../../../src/dispatcher/dispatcher";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { RoomPredecessorTile } from "../../../../src/components/views/messages/RoomPredecessorTile";
import { stubClient, upsertRoomStateEvents } from "../../../test-utils/test-utils";
import { Action } from "../../../../src/dispatcher/actions";
import RoomContext from "../../../../src/contexts/RoomContext";
import { getRoomContext } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";

jest.mock("../../../../src/dispatcher/dispatcher");

describe("<RoomPredecessorTile />", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";
    const createEvent = new MatrixEvent({
        type: EventType.RoomCreate,
        state_key: "",
        sender: userId,
        room_id: roomId,
        content: {
            predecessor: { room_id: "old_room_id", event_id: "tombstone_event_id" },
        },
        event_id: "$create",
    });
    const createEventWithoutPredecessor = new MatrixEvent({
        type: EventType.RoomCreate,
        state_key: "",
        sender: userId,
        room_id: roomId,
        content: {},
        event_id: "$create",
    });
    const predecessorEvent = new MatrixEvent({
        type: EventType.RoomPredecessor,
        state_key: "",
        sender: userId,
        room_id: roomId,
        content: {
            predecessor_room_id: "old_room_id_from_predecessor",
        },
        event_id: "$create",
    });
    const predecessorEventWithEventId = new MatrixEvent({
        type: EventType.RoomPredecessor,
        state_key: "",
        sender: userId,
        room_id: roomId,
        content: {
            predecessor_room_id: "old_room_id_from_predecessor",
            last_known_event_id: "tombstone_event_id_from_predecessor",
        },
        event_id: "$create",
    });
    stubClient();
    const client = mocked(MatrixClientPeg.get());
    const roomJustCreate = new Room(roomId, client, userId);
    upsertRoomStateEvents(roomJustCreate, [createEvent]);
    const roomCreateAndPredecessor = new Room(roomId, client, userId);
    upsertRoomStateEvents(roomCreateAndPredecessor, [createEvent, predecessorEvent]);
    const roomCreateAndPredecessorWithEventId = new Room(roomId, client, userId);
    upsertRoomStateEvents(roomCreateAndPredecessorWithEventId, [createEvent, predecessorEventWithEventId]);
    const roomNoPredecessors = new Room(roomId, client, userId);
    upsertRoomStateEvents(roomNoPredecessors, [createEventWithoutPredecessor]);

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
        return render(
            <RoomContext.Provider value={getRoomContext(room, {})}>
                <RoomPredecessorTile mxEvent={createEvent} />
            </RoomContext.Provider>,
        );
    }

    it("Renders as expected", () => {
        const roomCreate = renderTile(roomJustCreate);
        expect(roomCreate.asFragment()).toMatchSnapshot();
    });

    it("Links to the old version of the room", () => {
        renderTile(roomJustCreate);
        expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
            "href",
            "https://matrix.to/#/old_room_id/tombstone_event_id",
        );
    });

    it("Shows an empty div if there is no predecessor", () => {
        renderTile(roomNoPredecessors);
        expect(screen.queryByText("Click here to see older messages.", { exact: false })).toBeNull();
    });

    it("Opens the old room on click", async () => {
        renderTile(roomJustCreate);
        const link = screen.getByText("Click here to see older messages.");

        await act(() => userEvent.click(link));

        await waitFor(() =>
            expect(dis.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                event_id: "tombstone_event_id",
                highlighted: true,
                room_id: "old_room_id",
                metricsTrigger: "Predecessor",
                metricsViaKeyboard: false,
            }),
        );
    });

    it("Ignores m.predecessor if labs flag is off", () => {
        renderTile(roomCreateAndPredecessor);
        expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
            "href",
            "https://matrix.to/#/old_room_id/tombstone_event_id",
        );
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
            renderTile(roomJustCreate);
            expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
                "href",
                "https://matrix.to/#/old_room_id/tombstone_event_id",
            );
        });

        it("Uses m.predecessor when it's there", () => {
            renderTile(roomCreateAndPredecessor);
            expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
                "href",
                "https://matrix.to/#/old_room_id_from_predecessor",
            );
        });

        it("Links to the event in the room if event ID is provided", () => {
            renderTile(roomCreateAndPredecessorWithEventId);
            expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
                "href",
                "https://matrix.to/#/old_room_id_from_predecessor/tombstone_event_id_from_predecessor",
            );
        });
    });
});
