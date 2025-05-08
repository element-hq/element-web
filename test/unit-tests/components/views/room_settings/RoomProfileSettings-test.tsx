/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";
import { EventType, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

import { mkStubRoom, stubClient } from "../../../../test-utils";
import RoomProfileSettings from "../../../../../src/components/views/room_settings/RoomProfileSettings";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";

const BASE64_GIF = "R0lGODlhAQABAAAAACw=";
const AVATAR_FILE = new File([Uint8Array.from(atob(BASE64_GIF), (c) => c.charCodeAt(0))], "avatar.gif", {
    type: "image/gif",
});

const ROOM_ID = "!floob:itty";

describe("RoomProfileSetting", () => {
    let client: MatrixClient;
    let room: Room;

    beforeEach(() => {
        const dmRoomMap = {
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);

        client = stubClient();
        room = mkStubRoom(ROOM_ID, "Test room", client);
    });

    it("handles uploading a room avatar", async () => {
        const user = userEvent.setup();
        mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://matrix.org/1234" });

        render(<RoomProfileSettings roomId={ROOM_ID} />);

        await user.upload(screen.getByAltText("Upload"), AVATAR_FILE);

        await user.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(client.uploadContent).toHaveBeenCalledWith(AVATAR_FILE));
        await waitFor(() =>
            expect(client.sendStateEvent).toHaveBeenCalledWith(
                ROOM_ID,
                EventType.RoomAvatar,
                {
                    url: "mxc://matrix.org/1234",
                },
                "",
            ),
        );
    });

    it("removes a room avatar", async () => {
        const user = userEvent.setup();

        mocked(client).getRoom.mockReturnValue(room);
        mocked(room).currentState.getStateEvents.mockImplementation(
            // @ts-ignore
            (type: string): MatrixEvent[] | MatrixEvent | null => {
                if (type === EventType.RoomAvatar) {
                    // @ts-ignore
                    return { getContent: () => ({ url: "mxc://matrix.org/1234" }) };
                }
                return null;
            },
        );

        render(<RoomProfileSettings roomId="!floob:itty" />);

        await user.click(screen.getByRole("button", { name: "Room avatar" }));
        await user.click(screen.getByRole("menuitem", { name: "Remove" }));
        await user.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() =>
            expect(client.sendStateEvent).toHaveBeenCalledWith("!floob:itty", EventType.RoomAvatar, {}, ""),
        );
    });

    it("cancels changes", async () => {
        const user = userEvent.setup();

        render(<RoomProfileSettings roomId="!floob:itty" />);

        const roomNameInput = screen.getByLabelText("Room Name");
        expect(roomNameInput).toHaveValue("");

        await user.type(roomNameInput, "My Room");
        expect(roomNameInput).toHaveValue("My Room");

        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(roomNameInput).toHaveValue("");
    });
});
