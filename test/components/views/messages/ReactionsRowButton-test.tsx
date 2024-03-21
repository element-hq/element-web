/*
Copyright 2023 Beeper

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
import { IContent, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { render } from "@testing-library/react";

import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { getMockClientWithEventEmitter } from "../../../test-utils";
import ReactionsRowButton, { IProps } from "../../../../src/components/views/messages/ReactionsRowButton";

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
});
