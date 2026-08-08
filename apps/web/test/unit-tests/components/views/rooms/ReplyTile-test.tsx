/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { EventType, MsgType } from "matrix-js-sdk/src/matrix";

import ReplyTile from "../../../../../src/components/views/rooms/ReplyTile";
import { renderReplyTile } from "../../../../../src/events/EventTileFactory";
import { VideoBodyFactory } from "../../../../../src/components/views/messages/MBodyFactory";
import { mkEvent, stubClient } from "../../../../test-utils";
import dis from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";

jest.mock("../../../../../src/events/EventTileFactory", () => {
    const actual = jest.requireActual("../../../../../src/events/EventTileFactory");
    return {
        ...actual,
        renderReplyTile: jest.fn(() => null),
    };
});
jest.mock("../../../../../src/components/views/messages/SenderProfile", () => jest.fn(() => null));
jest.mock("../../../../../src/components/views/avatars/MemberAvatar", () => jest.fn(() => null));

describe("ReplyTile", () => {
    beforeEach(() => {
        stubClient();
        jest.mocked(renderReplyTile).mockClear().mockReturnValue(null);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders video replies with the video body", () => {
        const mxEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: "@alice:server",
            room: "!room:server",
            id: "$video",
            content: {
                body: "video.mp4",
                msgtype: MsgType.Video,
                url: "mxc://server/video",
                info: {
                    mimetype: "video/mp4",
                    w: 640,
                    h: 360,
                },
            },
        });

        render(<ReplyTile mxEvent={mxEvent} />);

        expect(renderReplyTile).toHaveBeenCalledWith(
            expect.objectContaining({
                overrideBodyTypes: expect.objectContaining({
                    [MsgType.Video]: VideoBodyFactory,
                }),
            }),
            false,
        );
    });

    describe("clicking a reply", () => {
        const mkTextEvent = () =>
            mkEvent({
                event: true,
                type: EventType.RoomMessage,
                user: "@alice:server",
                room: "!room:server",
                id: "$text",
                content: { body: "hello", msgtype: MsgType.Text },
            });

        // The quoted body is injected as markup rather than as JSX because React refuses to nest an
        // anchor inside the anchor which wraps the whole tile, and the test setup turns that warning
        // into a failure.
        const renderWithBody = (html: string) => {
            jest.mocked(renderReplyTile).mockReturnValue(
                <div className="mx_EventTile_body" dangerouslySetInnerHTML={{ __html: html }} />,
            );
            return render(<ReplyTile mxEvent={mkTextEvent()} />);
        };

        const clickOn = (element: Element): MouseEvent => {
            const click = new MouseEvent("click", { bubbles: true, cancelable: true });
            element.dispatchEvent(click);
            return click;
        };

        it("follows a link the click landed inside rather than jumping to the replied-to message", () => {
            const dispatch = jest.spyOn(dis, "dispatch");
            const { container } = renderWithBody('<a href="https://example.com/foo"><b id="inner">docs</b></a>');

            const click = clickOn(container.querySelector("#inner")!);

            expect(click.defaultPrevented).toBe(false);
            expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ action: Action.ViewRoom }));
        });

        it("jumps to the replied-to message when the click was not on a link", () => {
            const dispatch = jest.spyOn(dis, "dispatch");
            const { container } = renderWithBody('<b id="plain">docs</b>');

            const click = clickOn(container.querySelector("#plain")!);

            expect(click.defaultPrevented).toBe(true);
            expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ action: Action.ViewRoom }));
        });
    });
});
