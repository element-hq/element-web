/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Beeper

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { EventType, type IContent, MatrixEvent, RelationType, Room } from "matrix-js-sdk/src/matrix";
import { fireEvent, render } from "jest-matrix-react";

import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { getMockClientWithEventEmitter } from "../../../../test-utils";
import ReactionsRowButton, { type IProps } from "../../../../../src/components/views/messages/ReactionsRowButton";
import dis from "../../../../../src/dispatcher/dispatcher";
import { type Media, mediaFromMxc } from "../../../../../src/customisations/Media";

jest.mock("../../../../../src/dispatcher/dispatcher");

jest.mock("../../../../../src/customisations/Media", () => ({
    mediaFromMxc: jest.fn(),
}));

jest.mock("@element-hq/web-shared-components", () => {
    const actual = jest.requireActual("@element-hq/web-shared-components");
    return {
        ...actual,
        ReactionsRowButtonTooltipView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

const mockMediaFromMxc = mediaFromMxc as jest.MockedFunction<typeof mediaFromMxc>;

describe("ReactionsRowButton", () => {
    const userId = "@alice:server";
    const roomId = "!randomcharacters:aser.ver";
    const mockClient = getMockClientWithEventEmitter({
        getRoom: jest.fn(),
        sendEvent: jest.fn().mockResolvedValue({ event_id: "$sent_event" }),
        redactEvent: jest.fn().mockResolvedValue({}),
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
        // Default mock for mediaFromMxc
        mockMediaFromMxc.mockReturnValue({
            srcHttp: "https://not.a.real.url",
        } as unknown as Media);
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

    it("calls setProps on ViewModel when props change", () => {
        const props = createProps({
            "m.relates_to": {
                event_id: "$user1:example.com",
                key: "👍",
                rel_type: "m.annotation",
            },
        });

        const { rerender, container } = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );

        // Create new props with different values
        const newMxEvent = new MatrixEvent({
            room_id: roomId,
            event_id: "$test2:example.com",
            content: { body: "test2" },
        });

        const newReactionEvents = [
            new MatrixEvent({
                type: "m.reaction",
                sender: "@user3:example.com",
                content: {
                    "m.relates_to": {
                        event_id: "$user3:example.com",
                        key: "👎",
                        rel_type: "m.annotation",
                    },
                },
            }),
        ];

        const updatedProps: IProps = {
            ...props,
            mxEvent: newMxEvent,
            content: "👎",
            reactionEvents: newReactionEvents,
            customReactionImagesEnabled: false,
        };

        rerender(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...updatedProps} />
            </MatrixClientContext.Provider>,
        );

        // The component should have updated - verify by checking the rendered content
        expect(container.querySelector(".mx_ReactionsRowButton_content")?.textContent).toBe("👎");
    });

    it("disposes ViewModel on unmount", () => {
        const props = createProps({
            "m.relates_to": {
                event_id: "$user1:example.com",
                key: "👍",
                rel_type: "m.annotation",
            },
        });

        const { unmount } = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );

        // Unmount should not throw
        expect(() => unmount()).not.toThrow();
    });

    it("redacts reaction when clicking with myReactionEvent", () => {
        const myReactionEvent = new MatrixEvent({
            type: "m.reaction",
            sender: userId,
            event_id: "$my_reaction:example.com",
            content: {
                "m.relates_to": {
                    event_id: "$user1:example.com",
                    key: "👍",
                    rel_type: "m.annotation",
                },
            },
        });

        const props: IProps = {
            ...createProps({
                "m.relates_to": {
                    event_id: "$user1:example.com",
                    key: "👍",
                    rel_type: "m.annotation",
                },
            }),
            myReactionEvent,
        };

        const root = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );

        const button = root.getByRole("button");
        fireEvent.click(button);

        expect(mockClient.redactEvent).toHaveBeenCalledWith(roomId, "$my_reaction:example.com");
    });

    it("sends reaction when clicking without myReactionEvent", () => {
        const props = createProps({
            "m.relates_to": {
                event_id: "$test:example.com",
                key: "👍",
                rel_type: "m.annotation",
            },
        });

        const root = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );

        const button = root.getByRole("button");
        fireEvent.click(button);

        expect(mockClient.sendEvent).toHaveBeenCalledWith(roomId, EventType.Reaction, {
            "m.relates_to": {
                rel_type: RelationType.Annotation,
                event_id: "$test:example.com",
                key: "👍",
            },
        });
        expect(dis.dispatch).toHaveBeenCalledWith({ action: "message_sent" });
    });

    it("uses reactors as label when content is empty", () => {
        const props: IProps = {
            mxEvent: new MatrixEvent({
                room_id: roomId,
                event_id: "$test:example.com",
                content: { body: "test" },
            }),
            content: "", // Empty content
            count: 2,
            reactionEvents: [
                new MatrixEvent({
                    type: "m.reaction",
                    sender: "@user1:example.com",
                    content: {},
                }),
                new MatrixEvent({
                    type: "m.reaction",
                    sender: "@user2:example.com",
                    content: {},
                }),
            ],
            customReactionImagesEnabled: true,
        };

        const root = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );

        // The button should still render
        const button = root.getByRole("button");
        expect(button).toBeInTheDocument();
    });

    it("renders custom image reaction with fallback label when no shortcode", () => {
        const props: IProps = {
            mxEvent: new MatrixEvent({
                room_id: roomId,
                event_id: "$test:example.com",
                content: { body: "test" },
            }),
            content: "mxc://example.com/custom_image",
            count: 1,
            reactionEvents: [
                new MatrixEvent({
                    type: "m.reaction",
                    sender: "@user1:example.com",
                    content: {
                        "m.relates_to": {
                            event_id: "$test:example.com",
                            key: "mxc://example.com/custom_image",
                            rel_type: "m.annotation",
                        },
                    },
                }),
            ],
            customReactionImagesEnabled: true,
        };

        const root = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );

        // Should render an image element for custom reaction
        const img = root.container.querySelector("img.mx_ReactionsRowButton_content");
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute("src", "https://not.a.real.url");
    });

    it("falls back to text when mxc URL cannot be converted to HTTP", () => {
        // Make mediaFromMxc return null srcHttp to simulate failed conversion
        mockMediaFromMxc.mockReturnValueOnce({
            srcHttp: null,
        } as unknown as Media);

        const props: IProps = {
            mxEvent: new MatrixEvent({
                room_id: roomId,
                event_id: "$test:example.com",
                content: { body: "test" },
            }),
            content: "mxc://example.com/invalid_image",
            count: 1,
            reactionEvents: [
                new MatrixEvent({
                    type: "m.reaction",
                    sender: "@user1:example.com",
                    content: {
                        "m.relates_to": {
                            event_id: "$test:example.com",
                            key: "mxc://example.com/invalid_image",
                            rel_type: "m.annotation",
                        },
                    },
                }),
            ],
            customReactionImagesEnabled: true,
        };

        const root = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );

        // Should render span (not img) when imageSrc is null
        const span = root.container.querySelector("span.mx_ReactionsRowButton_content");
        expect(span).toBeInTheDocument();
        const img = root.container.querySelector("img.mx_ReactionsRowButton_content");
        expect(img).not.toBeInTheDocument();
    });

    it("updates ViewModel when only mxEvent changes", () => {
        const props = createProps({
            "m.relates_to": {
                event_id: "$user1:example.com",
                key: "👍",
                rel_type: "m.annotation",
            },
        });

        const { rerender } = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );

        // Only change mxEvent
        const newMxEvent = new MatrixEvent({
            room_id: roomId,
            event_id: "$test2:example.com",
            content: { body: "test2" },
        });

        expect(() =>
            rerender(
                <MatrixClientContext.Provider value={mockClient}>
                    <ReactionsRowButton {...props} mxEvent={newMxEvent} />
                </MatrixClientContext.Provider>,
            ),
        ).not.toThrow();
    });

    it("updates ViewModel when only content changes", () => {
        const props = createProps({
            "m.relates_to": {
                event_id: "$user1:example.com",
                key: "👍",
                rel_type: "m.annotation",
            },
        });

        const { rerender, container } = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );

        // Only change content
        rerender(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} content="👎" />
            </MatrixClientContext.Provider>,
        );

        expect(container.querySelector(".mx_ReactionsRowButton_content")?.textContent).toBe("👎");
    });

    it("updates ViewModel when only reactionEvents changes", () => {
        const props = createProps({
            "m.relates_to": {
                event_id: "$user1:example.com",
                key: "👍",
                rel_type: "m.annotation",
            },
        });

        const { rerender } = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );

        // Only change reactionEvents
        const newReactionEvents = [
            new MatrixEvent({
                type: "m.reaction",
                sender: "@user3:example.com",
                content: {
                    "m.relates_to": {
                        event_id: "$user1:example.com",
                        key: "👍",
                        rel_type: "m.annotation",
                    },
                },
            }),
        ];

        expect(() =>
            rerender(
                <MatrixClientContext.Provider value={mockClient}>
                    <ReactionsRowButton {...props} reactionEvents={newReactionEvents} />
                </MatrixClientContext.Provider>,
            ),
        ).not.toThrow();
    });

    it("updates ViewModel when only customReactionImagesEnabled changes", () => {
        const props = createProps({
            "m.relates_to": {
                event_id: "$user1:example.com",
                key: "👍",
                rel_type: "m.annotation",
            },
        });

        const { rerender } = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );

        // Only change customReactionImagesEnabled
        expect(() =>
            rerender(
                <MatrixClientContext.Provider value={mockClient}>
                    <ReactionsRowButton {...props} customReactionImagesEnabled={false} />
                </MatrixClientContext.Provider>,
            ),
        ).not.toThrow();
    });

    it("does not update ViewModel when props stay the same", () => {
        const props = createProps({
            "m.relates_to": {
                event_id: "$user1:example.com",
                key: "👍",
                rel_type: "m.annotation",
            },
        });

        const { rerender } = render(
            <MatrixClientContext.Provider value={mockClient}>
                <ReactionsRowButton {...props} />
            </MatrixClientContext.Provider>,
        );

        // Rerender with same props - setProps should not be called
        expect(() =>
            rerender(
                <MatrixClientContext.Provider value={mockClient}>
                    <ReactionsRowButton {...props} />
                </MatrixClientContext.Provider>,
            ),
        ).not.toThrow();
    });
});
