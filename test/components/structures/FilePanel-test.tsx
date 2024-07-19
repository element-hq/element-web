/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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
import { EventTimelineSet, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";
import { screen, render, waitFor } from "@testing-library/react";
import { mocked } from "jest-mock";

import FilePanel from "../../../src/components/structures/FilePanel";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { stubClient } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";

jest.mock("matrix-js-sdk/src/matrix", () => ({
    ...jest.requireActual("matrix-js-sdk/src/matrix"),
    TimelineWindow: jest.fn().mockReturnValue({
        load: jest.fn().mockResolvedValue(null),
        getEvents: jest.fn().mockReturnValue([]),
        canPaginate: jest.fn().mockReturnValue(false),
    }),
}));

describe("FilePanel", () => {
    beforeEach(() => {
        stubClient();
    });

    it("renders empty state", async () => {
        const cli = MatrixClientPeg.safeGet();
        const room = new Room("!room:server", cli, cli.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        const timelineSet = new EventTimelineSet(room);
        room.getOrCreateFilteredTimelineSet = jest.fn().mockReturnValue(timelineSet);
        mocked(cli.getRoom).mockReturnValue(room);

        const { asFragment } = render(
            <FilePanel roomId={room.roomId} onClose={jest.fn()} resizeNotifier={new ResizeNotifier()} />,
        );
        await waitFor(() => {
            expect(screen.getByText("No files visible in this room")).toBeInTheDocument();
        });
        expect(asFragment()).toMatchSnapshot();
    });
});
