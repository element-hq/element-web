/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { getByTestId, render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { type MatrixClient, PendingEventOrdering, type MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { stubClient, clientAndSDKContextRenderOptions } from "test-utils";
import { mkThread } from "test-utils/threads";

import ThreadListContextMenu, { type ThreadListContextMenuProps } from "./ThreadListContextMenu";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { SDKContextClass } from "../../../contexts/SDKContextClass.ts";

describe("ThreadListContextMenu", () => {
    const ROOM_ID = "!123:matrix.org";

    let room: Room;
    let mockClient: MatrixClient;
    let event: MatrixEvent;

    function getComponent(props: Partial<ThreadListContextMenuProps>) {
        return render(
            <ThreadListContextMenu mxEvent={event} {...props} />,
            clientAndSDKContextRenderOptions(mockClient, SDKContextClass.instance),
        );
    }

    beforeEach(() => {
        vi.clearAllMocks();

        stubClient();
        mockClient = vi.mocked(MatrixClientPeg.safeGet());

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
