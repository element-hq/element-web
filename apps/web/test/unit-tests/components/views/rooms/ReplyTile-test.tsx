/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, fireEvent } from "jest-matrix-react";
import { EventType, MsgType, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import ReplyTile from "../../../../../src/components/views/rooms/ReplyTile";
import { mkEvent, mkRoom, stubClient } from "../../../../test-utils";

const mockGetEventDisplayInfo = jest.fn();
const mockRenderReplyTile = jest.fn();
const mockUseMediaVisible = jest.fn();
const mockSafeGet = jest.fn();

jest.mock("@element-hq/web-shared-components", () => {
    const ReactActual = jest.requireActual("react");
    const actual = jest.requireActual("@element-hq/web-shared-components");

    return {
        ...actual,
        ImageReplyBodyView: ({ children }: { children?: React.ReactNode }) =>
            ReactActual.createElement("div", { "data-testid": "image-reply-body-view" }, children),
        useCreateAutoDisposedViewModel: (createViewModel: () => unknown) => createViewModel(),
    };
});

jest.mock("../../../../../src/components/views/messages/SenderProfile", () => ({
    __esModule: true,
    default: () => <div data-testid="sender-profile" />,
}));

jest.mock("../../../../../src/components/views/avatars/MemberAvatar", () => ({
    __esModule: true,
    default: () => <div data-testid="member-avatar" />,
}));

jest.mock("../../../../../src/components/views/messages/MVoiceMessageBody", () => ({
    __esModule: true,
    default: () => <div data-testid="voice-message-body" />,
}));

jest.mock("../../../../../src/components/views/messages/MBodyFactory", () => ({
    __esModule: true,
    FileBodyViewFactory: () => <div data-testid="file-body" />,
    renderMBody: () => <div data-testid="file-body" />,
}));

jest.mock("../../../../../src/components/views/messages/MImageBody", () => {
    const ReactActual = jest.requireActual("react");

    class MockMImageBodyInner extends ReactActual.Component<any, any> {
        public state = {
            contentUrl: "https://example.org/image.png",
            thumbUrl: "https://example.org/thumb.png",
            error: this.props.mxEvent.getContent().body === "error" ? new Error("boom") : undefined,
        };

        public messageContent(
            contentUrl: string | null,
            _thumbUrl: string | null,
            _content: unknown,
            forcedHeight?: number,
        ): React.ReactNode {
            return this.wrapImage(
                contentUrl,
                ReactActual.createElement(
                    "button",
                    {
                        type: "button",
                        "data-testid": "reply-thumbnail",
                        "data-forced-height": String(forcedHeight),
                        onClick: this.onClick,
                    },
                    "thumbnail",
                ),
            );
        }

        public wrapImage(contentUrl: string | null | undefined, children: React.ReactNode): React.ReactNode {
            return ReactActual.createElement("a", { href: contentUrl, "data-testid": "wrapped-image" }, children);
        }

        public render(): React.ReactNode {
            return ReactActual.createElement("div", { "data-testid": "base-image-error" }, "base render");
        }
    }

    return {
        __esModule: true,
        MImageBodyInner: MockMImageBodyInner,
    };
});

jest.mock("../../../../../src/hooks/useMediaVisible", () => ({
    __esModule: true,
    useMediaVisible: (...args: unknown[]) => mockUseMediaVisible(...args),
}));

jest.mock("../../../../../src/utils/EventRenderingUtils", () => ({
    __esModule: true,
    getEventDisplayInfo: (...args: unknown[]) => mockGetEventDisplayInfo(...args),
}));

jest.mock("../../../../../src/events/EventTileFactory", () => ({
    __esModule: true,
    renderReplyTile: (...args: unknown[]) => mockRenderReplyTile(...args),
}));

jest.mock("../../../../../src/MatrixClientPeg", () => ({
    __esModule: true,
    MatrixClientPeg: {
        get: (...args: unknown[]) => mockSafeGet(...args),
        safeGet: (...args: unknown[]) => mockSafeGet(...args),
        unset: jest.fn(),
        replaceUsingCreds: jest.fn(),
    },
}));

jest.mock("../../../../../src/viewmodels/message-body/ImageReplyBodyViewModel", () => ({
    __esModule: true,
    ImageReplyBodyViewModel: class {
        public getSnapshot(): { isVisible: boolean } {
            return { isVisible: true };
        }

        public subscribe(): () => void {
            return () => undefined;
        }
    },
}));

describe("ReplyTile", () => {
    let client: MatrixClient;
    let room: Room;

    beforeEach(() => {
        client = stubClient();
        room = mkRoom(client, "!room:example.com");

        mockSafeGet.mockReturnValue(client);
        mockUseMediaVisible.mockReturnValue([true, jest.fn()]);
        mockGetEventDisplayInfo.mockReturnValue({
            hasRenderer: true,
            isInfoMessage: false,
            isSeeingThroughMessageHiddenForModeration: false,
        });
        mockRenderReplyTile.mockImplementation((props) => {
            const bodyOverride =
                props.overrideEventTypes?.[props.mxEvent.getType()] ??
                props.overrideBodyTypes?.[props.mxEvent.getContent().msgtype as string];

            if (!bodyOverride) {
                return <div data-testid="missing-reply-body" />;
            }

            return React.createElement(bodyOverride, props);
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    function makeImageEvent(body = "An image") {
        return mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: client.getUserId()!,
            room: room.roomId,
            content: {
                body,
                msgtype: MsgType.Image,
                info: {
                    w: 40,
                    h: 50,
                    mimetype: "image/png",
                },
                url: "mxc://server/image",
            },
        });
    }

    function makeStickerEvent(body = "A sticker") {
        return mkEvent({
            event: true,
            type: EventType.Sticker,
            user: client.getUserId()!,
            room: room.roomId,
            content: {
                body,
                info: {
                    w: 40,
                    h: 50,
                    mimetype: "image/png",
                },
                url: "mxc://server/sticker",
            },
        });
    }

    it("renders image replies through the compact shared wrapper without the image link wrapper", () => {
        render(<ReplyTile mxEvent={makeImageEvent()} />);

        const thumbnail = screen.getByTestId("reply-thumbnail");
        expect(thumbnail).toHaveAttribute("data-forced-height", "44");
        expect(screen.queryByTestId("wrapped-image")).not.toBeInTheDocument();
        expect(mockUseMediaVisible).toHaveBeenCalledTimes(1);

        fireEvent.click(thumbnail);
    });

    it("renders sticker replies through the compact shared wrapper", () => {
        render(<ReplyTile mxEvent={makeStickerEvent()} />);

        expect(screen.getByTestId("reply-thumbnail")).toBeInTheDocument();
        expect(screen.queryByTestId("wrapped-image")).not.toBeInTheDocument();
    });

    it("falls back to the base image-body render when the reply thumbnail is in an error state", () => {
        render(<ReplyTile mxEvent={makeImageEvent("error")} />);

        expect(screen.getByTestId("base-image-error")).toBeInTheDocument();
    });
});
