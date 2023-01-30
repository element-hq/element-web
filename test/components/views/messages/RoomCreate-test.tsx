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
import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";

import dis from "../../../../src/dispatcher/dispatcher";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { RoomCreate } from "../../../../src/components/views/messages/RoomCreate";
import { stubClient } from "../../../test-utils/test-utils";
import { Action } from "../../../../src/dispatcher/actions";

jest.mock("../../../../src/dispatcher/dispatcher");

describe("<RoomCreate />", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";
    const createEvent = new MatrixEvent({
        type: EventType.RoomCreate,
        sender: userId,
        room_id: roomId,
        content: {
            predecessor: { room_id: "old_room_id", event_id: "tombstone_event_id" },
        },
        event_id: "$create",
    });

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

    it("Renders as expected", () => {
        const roomCreate = render(<RoomCreate mxEvent={createEvent} />);
        expect(roomCreate.asFragment()).toMatchSnapshot();
    });

    it("Links to the old version of the room", () => {
        render(<RoomCreate mxEvent={createEvent} />);
        expect(screen.getByText("Click here to see older messages.")).toHaveAttribute(
            "href",
            "https://matrix.to/#/old_room_id/tombstone_event_id",
        );
    });

    it("Opens the old room on click", async () => {
        render(<RoomCreate mxEvent={createEvent} />);
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
});
