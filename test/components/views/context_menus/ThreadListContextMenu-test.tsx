/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { getByTestId, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import React from "react";

import ThreadListContextMenu, {
    ThreadListContextMenuProps,
} from "../../../../src/components/views/context_menus/ThreadListContextMenu";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { stubClient } from "../../../test-utils/test-utils";
import { mkThread } from "../../../test-utils/threads";

describe("ThreadListContextMenu", () => {
    const ROOM_ID = "!123:matrix.org";

    let room: Room;
    let mockClient: MatrixClient;
    let event: MatrixEvent;

    function getComponent(props: Partial<ThreadListContextMenuProps>) {
        return render(<ThreadListContextMenu mxEvent={event} {...props} />);
    }

    beforeEach(() => {
        jest.clearAllMocks();

        stubClient();
        mockClient = mocked(MatrixClientPeg.safeGet());

        room = new Room(ROOM_ID, mockClient, mockClient.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const res = mkThread({
            room,
            client: mockClient,
            authorId: mockClient.getUserId()!,
            participantUserIds: [mockClient.getUserId()!],
        });

        event = res.rootEvent;
    });

    it("does not render the permalink", async () => {
        const { container } = getComponent({});

        const btn = getByTestId(container, "threadlist-dropdown-button");
        await userEvent.click(btn);
        expect(screen.queryByTestId("copy-thread-link")).toBeNull();
    });

    it("does render the permalink", async () => {
        const { container } = getComponent({
            permalinkCreator: new RoomPermalinkCreator(room, room.roomId, false),
        });

        const btn = getByTestId(container, "threadlist-dropdown-button");
        await userEvent.click(btn);
        expect(screen.queryByTestId("copy-thread-link")).not.toBeNull();
    });
});
