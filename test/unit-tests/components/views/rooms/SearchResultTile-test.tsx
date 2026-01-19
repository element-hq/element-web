/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { MatrixEvent, Room, EventType } from "matrix-js-sdk/src/matrix";
import { fireEvent } from "@testing-library/react";
import { render, type RenderResult } from "jest-matrix-react";

import { stubClient, withClientContextRenderOptions } from "../../../../test-utils";
import SearchResultTile from "../../../../../src/components/views/rooms/SearchResultTile";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import dis from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";

const ROOM_ID = "!qPewotXpIctQySfjSy:localhost";

type Props = React.ComponentPropsWithoutRef<typeof SearchResultTile>;

describe("SearchResultTile", () => {
    beforeAll(() => {
        stubClient();
        const cli = MatrixClientPeg.safeGet();

        const room = new Room(ROOM_ID, cli, "@bob:example.org");
        jest.spyOn(cli, "getRoom").mockReturnValue(room);
    });

    function renderComponent(props: Partial<Props>): RenderResult {
        const defaultEvent = new MatrixEvent({
            content: {
                body: "This is an example text message",
                msgtype: "m.text",
            },
            event_id: "$example:localhost",
            origin_server_ts: 1432735824653,
            room_id: ROOM_ID,
            sender: "@example:example.org",
            type: EventType.RoomMessage,
        });

        return render(
            <SearchResultTile resultEvent={defaultEvent} {...props} />,
            withClientContextRenderOptions(MatrixClientPeg.safeGet()),
        );
    }

    it("renders the result event and jump button", () => {
        const { container } = renderComponent({
            resultEvent: new MatrixEvent({
                type: EventType.CallInvite,
                sender: "@user1:server",
                room_id: ROOM_ID,
                origin_server_ts: 1432735824652,
                content: { call_id: "call.1" },
                event_id: "$1:server",
            }),
        });

        const tile = container.querySelector<HTMLElement>(".mx_EventTile");
        expect(tile?.dataset.eventId).toBe("$1:server");
        expect(container.querySelector(".mx_SearchResultTile_jump")).toBeTruthy();
    });

    it("dispatches ViewRoom when clicking the jump button", () => {
        const event = new MatrixEvent({
            content: { body: "Hello", msgtype: "m.text" },
            event_id: "$jump:localhost",
            origin_server_ts: 1432735824653,
            room_id: ROOM_ID,
            sender: "@example:example.org",
            type: EventType.RoomMessage,
        });

        const dispatchSpy = jest.spyOn(dis, "dispatch");
        const { container } = renderComponent({ resultEvent: event });

        const jumpButton = container.querySelector<HTMLButtonElement>(".mx_SearchResultTile_jump");
        expect(jumpButton).toBeTruthy();
        fireEvent.click(jumpButton!);

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                action: Action.ViewRoom,
                event_id: "$jump:localhost",
                highlighted: true,
                room_id: ROOM_ID,
            }),
        );
        dispatchSpy.mockRestore();
    });
});
