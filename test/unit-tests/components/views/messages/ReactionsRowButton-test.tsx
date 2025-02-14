/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Beeper

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type IContent, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { render } from "jest-matrix-react";

import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { getMockClientWithEventEmitter } from "../../../../test-utils";
import ReactionsRowButton, { type IProps } from "../../../../../src/components/views/messages/ReactionsRowButton";

describe("ReactionsRowButton", () => {
    const userId = "@alice:server";
    const roomId = "!randomcharacters:aser.ver";
    const mockClient = getMockClientWithEventEmitter({
        mxcUrlToHttp: jest.fn().mockReturnValue("https://not.a.real.url"),
        getRoom: jest.fn(),
    });
    const room = new Room(roomId, mockClient, userId);

    const createProps = (relationContent: IContent): IProps => ({
        mxEvent: new MatrixEvent({
            room_id: roomId,
            event_id: "$test:example.com",
            content: { body: "test" },
        }),
        content: relationContent["m.relates_to"]?.key || "",
        count: 2,
        reactionEvents: [
            new MatrixEvent({
                type: "m.reaction",
                sender: "@user1:example.com",
                content: relationContent,
            }),
            new MatrixEvent({
                type: "m.reaction",
                sender: "@user2:example.com",
                content: relationContent,
            }),
        ],
        customReactionImagesEnabled: true,
    });

    beforeEach(function () {
        jest.clearAllMocks();
        mockClient.credentials = { userId: userId };
        mockClient.getRoom.mockImplementation((roomId: string): Room | null => {
            return roomId === room.roomId ? room : null;
        });
    });

    it("renders reaction row button emojis correctly", () => {
        const props = createProps({
            "m.relates_to": {
                event_id: "$user2:example.com",
                key: "👍",
                rel_type: "m.annotation",
            },
        });
        const root = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );
        expect(root.asFragment()).toMatchSnapshot();

        // Try hover and make sure that the ReactionsRowButtonTooltip works
        const reactionButton = root.getByRole("button");
        const event = new MouseEvent("mouseover", {
            bubbles: true,
            cancelable: true,
        });
        reactionButton.dispatchEvent(event);

        expect(root.asFragment()).toMatchSnapshot();
    });

    it("renders reaction row button custom image reactions correctly", () => {
        const props = createProps({
            "com.beeper.reaction.shortcode": ":test:",
            "shortcode": ":test:",
            "m.relates_to": {
                event_id: "$user1:example.com",
                key: "mxc://example.com/123456789",
                rel_type: "m.annotation",
            },
        });

        const root = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );
        expect(root.asFragment()).toMatchSnapshot();

        // Try hover and make sure that the ReactionsRowButtonTooltip works
        const reactionButton = root.getByRole("button");
        const event = new MouseEvent("mouseover", {
            bubbles: true,
            cancelable: true,
        });
        reactionButton.dispatchEvent(event);

        expect(root.asFragment()).toMatchSnapshot();
    });

    it("renders without a room", () => {
        mockClient.getRoom.mockImplementation(() => null);

        const props = createProps({});

        const root = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );

        expect(root.asFragment()).toMatchSnapshot();
    });
});
