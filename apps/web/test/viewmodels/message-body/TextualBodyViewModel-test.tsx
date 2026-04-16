/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { TextualBodyViewBodyWrapperKind, TextualBodyViewKind } from "@element-hq/web-shared-components";
import { MsgType, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { mkEvent } from "../../test-utils";
import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import { TextualBodyViewModel } from "../../../src/viewmodels/room/timeline/event-tile/body/TextualBodyViewModel";

describe("TextualBodyViewModel", () => {
    const createEvent = (
        content: Record<string, unknown>,
        overrides?: Partial<{ room: string; user: string }>,
    ): MatrixEvent =>
        mkEvent({
            event: true,
            type: "m.room.message",
            room: overrides?.room ?? "!room:example.com",
            user: overrides?.user ?? "@alice:example.com",
            content,
        });

    const createVm = (
        overrides?: Partial<ConstructorParameters<typeof TextualBodyViewModel>[0]>,
    ): TextualBodyViewModel =>
        new TextualBodyViewModel({
            mxEvent: createEvent({
                body: "Hello world",
                msgtype: MsgType.Text,
            }),
            timelineRenderingType: TimelineRenderingType.Room,
            ...overrides,
        });

    it("computes the initial snapshot from props", () => {
        const event = createEvent({
            body: "Caption",
            msgtype: MsgType.Image,
        });
        jest.spyOn(event, "replacingEventDate").mockReturnValue(new Date(1993, 7, 3));
        jest.spyOn(event, "messageVisibility").mockReturnValue({
            visible: false,
            reason: "copyright",
        } as ReturnType<MatrixEvent["messageVisibility"]>);

        const vm = createVm({
            id: "event-id",
            mxEvent: event,
            highlightLink: "https://example.com",
            replacingEventId: "$replacement",
            isSeeingThroughMessageHiddenForModeration: true,
        });
        const snapshot = vm.getSnapshot();

        expect(snapshot.id).toBe("event-id");
        expect(snapshot.kind).toBe(TextualBodyViewKind.CAPTION);
        expect(snapshot.bodyWrapper).toBe(TextualBodyViewBodyWrapperKind.LINK);
        expect(snapshot.bodyLinkHref).toBe("https://example.com");
        expect(snapshot.showEditedMarker).toBe(true);
        expect(snapshot.editedMarkerText).toContain("edited");
        expect(snapshot.showPendingModerationMarker).toBe(true);
        expect(snapshot.pendingModerationText).toContain("copyright");
    });

    it("updates message-derived fields when the event changes", () => {
        const vm = createVm();
        const emoteEvent = createEvent(
            {
                body: "waves",
                msgtype: MsgType.Emote,
                data: {
                    "org.matrix.neb.starter_link": "https://scalar.example/starter",
                },
            },
            { user: "@bob:example.com" },
        );
        emoteEvent.sender = { name: "Bob" } as MatrixEvent["sender"];

        vm.setEvent(emoteEvent);

        expect(vm.getSnapshot().kind).toBe(TextualBodyViewKind.EMOTE);
        expect(vm.getSnapshot().bodyWrapper).toBe(TextualBodyViewBodyWrapperKind.ACTION);
        expect(vm.getSnapshot().emoteSenderName).toBe("Bob");
    });

    it("updates wrapper state when the highlight link changes", () => {
        const starterLinkEvent = createEvent({
            body: "Open the integration",
            msgtype: MsgType.Text,
            data: {
                "org.matrix.neb.starter_link": "https://scalar.example/starter",
            },
        });
        const vm = createVm({ mxEvent: starterLinkEvent });

        expect(vm.getSnapshot().bodyWrapper).toBe(TextualBodyViewBodyWrapperKind.ACTION);

        vm.setHighlightLink("https://element.io");
        expect(vm.getSnapshot().bodyWrapper).toBe(TextualBodyViewBodyWrapperKind.LINK);
        expect(vm.getSnapshot().bodyLinkHref).toBe("https://element.io");

        vm.setHighlightLink(undefined);
        expect(vm.getSnapshot().bodyWrapper).toBe(TextualBodyViewBodyWrapperKind.ACTION);
    });

    it("updates the moderation marker from the dedicated setter", () => {
        const hiddenEvent = createEvent({
            body: "hidden",
            msgtype: MsgType.Text,
        });
        jest.spyOn(hiddenEvent, "messageVisibility").mockReturnValue({
            visible: false,
            reason: "spam",
        } as ReturnType<MatrixEvent["messageVisibility"]>);

        const vm = createVm({ mxEvent: hiddenEvent });

        vm.setIsSeeingThroughMessageHiddenForModeration(true);

        expect(vm.getSnapshot().showPendingModerationMarker).toBe(true);
        expect(vm.getSnapshot().pendingModerationText).toContain("spam");
    });

    it("does not emit for unchanged setter values", () => {
        const mxEvent = createEvent({
            body: "Hello world",
            msgtype: MsgType.Text,
        });
        const vm = createVm({ mxEvent });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setId(undefined);
        vm.setEvent(mxEvent);
        vm.setHighlightLink(undefined);
        vm.setReplacingEventId(undefined);
        vm.setIsSeeingThroughMessageHiddenForModeration(undefined);
        vm.setTimelineRenderingType(TimelineRenderingType.Room);

        expect(listener).not.toHaveBeenCalled();
    });
});
