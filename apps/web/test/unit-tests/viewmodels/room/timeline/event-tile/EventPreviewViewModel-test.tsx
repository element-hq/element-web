/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import { EventType, type MatrixClient, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { EventPreviewViewModel } from "../../../../../../src/viewmodels/room/timeline/event-tile/EventPreviewViewModel";
import { mkEvent, stubClient } from "../../../../../test-utils";

describe("EventPreviewViewModel", () => {
    const roomId = "!room:example.com";
    const userId = "@alice:example.com";

    let cli: MatrixClient;
    let decryptEventIfNeeded: jest.SpiedFunction<MatrixClient["decryptEventIfNeeded"]>;

    const makeMessageEvent = ({
        body = "Hello",
        msgtype = MsgType.Text,
    }: {
        body?: string;
        msgtype?: MsgType;
    } = {}): MatrixEvent =>
        mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: roomId,
            user: userId,
            content: {
                body,
                msgtype,
            },
        });

    beforeEach(() => {
        cli = stubClient();
        decryptEventIfNeeded = jest.spyOn(cli, "decryptEventIfNeeded").mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("generates a text preview and tooltip", async () => {
        const mxEvent = makeMessageEvent({ body: "Text preview" });
        const vm = new EventPreviewViewModel({ cli, mxEvent });

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Text preview"));

        expect(decryptEventIfNeeded).toHaveBeenCalledWith(mxEvent);
        expect(vm.getSnapshot()).toMatchObject({
            isVisible: true,
            previewContent: "Text preview",
            previewTooltip: "Text preview",
        });
    });

    it("generates prefixed media preview content", async () => {
        const mxEvent = makeMessageEvent({ body: "clip.mp4", msgtype: MsgType.Video });
        const vm = new EventPreviewViewModel({ cli, mxEvent });

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBeDefined());

        render(<>{vm.getSnapshot().previewContent}</>);

        expect(screen.getByText("Video:")).toBeInTheDocument();
        expect(screen.getByText("Video:").tagName).toBe("STRONG");
        expect(screen.getByText("clip.mp4")).toBeInTheDocument();
        expect(vm.getSnapshot().previewTooltip).toBeUndefined();
    });

    it("updates the preview when the event is replaced", async () => {
        const mxEvent = makeMessageEvent({ body: "Original" });
        const vm = new EventPreviewViewModel({ cli, mxEvent });

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Original"));

        const replacementEvent = new MatrixEvent({
            type: EventType.RoomMessage,
            room_id: roomId,
            sender: userId,
            content: {
                "body": "Edited",
                "msgtype": MsgType.Text,
                "m.new_content": {
                    body: "Edited",
                    msgtype: MsgType.Text,
                },
                "m.relates_to": {
                    rel_type: "m.replace",
                    event_id: mxEvent.getId(),
                },
            },
        });

        mxEvent.makeReplaced(replacementEvent);

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Edited"));
    });

    it("skips unchanged setter inputs and updates for a different event", async () => {
        const originalEvent = makeMessageEvent({ body: "Original" });
        const updatedEvent = makeMessageEvent({ body: "Updated" });
        const vm = new EventPreviewViewModel({ cli, mxEvent: originalEvent });
        const listener = jest.fn();

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Original"));
        decryptEventIfNeeded.mockClear();
        vm.subscribe(listener);

        vm.setEvent(originalEvent);
        vm.setClient(cli);

        expect(listener).not.toHaveBeenCalled();
        expect(decryptEventIfNeeded).not.toHaveBeenCalled();

        vm.setEvent(updatedEvent);

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Updated"));

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("removes event listeners when disposed", async () => {
        const mxEvent = makeMessageEvent({ body: "Original" });
        const vm = new EventPreviewViewModel({ cli, mxEvent });
        const listener = jest.fn();

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Original"));
        decryptEventIfNeeded.mockClear();
        vm.subscribe(listener);
        vm.dispose();

        const replacementEvent = new MatrixEvent({
            type: EventType.RoomMessage,
            room_id: roomId,
            sender: userId,
            content: {
                "body": "Edited",
                "msgtype": MsgType.Text,
                "m.new_content": {
                    body: "Edited",
                    msgtype: MsgType.Text,
                },
                "m.relates_to": {
                    rel_type: "m.replace",
                    event_id: mxEvent.getId(),
                },
            },
        });

        mxEvent.makeReplaced(replacementEvent);

        expect(listener).not.toHaveBeenCalled();
        expect(decryptEventIfNeeded).not.toHaveBeenCalled();
        expect(vm.getSnapshot().previewContent).toBe("Original");
    });
});
