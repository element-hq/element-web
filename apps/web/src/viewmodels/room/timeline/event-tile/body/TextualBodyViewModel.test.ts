/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import {
    LINKIFIED_DATA_ATTRIBUTE,
    TextualBodyViewBodyWrapperKind,
    TextualBodyViewKind,
} from "@element-hq/web-shared-components";
import { MsgType, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { vi, describe, it, expect, afterEach } from "vitest";
import { mkEvent } from "test-utils";

import { TimelineRenderingType } from "../../../../../contexts/RoomContext";
import { TextualBodyViewModel } from "./TextualBodyViewModel";
import Modal from "../../../../../Modal";
import dispatcher from "../../../../../dispatcher/dispatcher";
import { Action } from "../../../../../dispatcher/actions";
import * as permalinkUtils from "../../../../../utils/permalinks/Permalinks";
import MessageEditHistoryDialog from "../../../../../components/views/dialogs/MessageEditHistoryDialog";

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

    afterEach(() => {
        vi.restoreAllMocks();
        window.location.hash = "";
    });

    it("computes the initial snapshot from props", () => {
        const event = createEvent({
            body: "Caption",
            msgtype: MsgType.Image,
        });
        vi.spyOn(event, "replacingEventDate").mockReturnValue(new Date(1993, 7, 3));
        vi.spyOn(event, "messageVisibility").mockReturnValue({
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
            },
            { user: "@bob:example.com" },
        );
        emoteEvent.sender = { name: "Bob" } as MatrixEvent["sender"];

        vm.setEvent(emoteEvent);

        expect(vm.getSnapshot().kind).toBe(TextualBodyViewKind.EMOTE);
        expect(vm.getSnapshot().emoteSenderName).toBe("Bob");
    });

    it("updates wrapper state when the highlight link changes", () => {
        const vm = createVm();

        expect(vm.getSnapshot().bodyWrapper).toBe(TextualBodyViewBodyWrapperKind.NONE);

        vm.setHighlightLink("https://element.io");
        expect(vm.getSnapshot().bodyWrapper).toBe(TextualBodyViewBodyWrapperKind.LINK);
        expect(vm.getSnapshot().bodyLinkHref).toBe("https://element.io");

        vm.setHighlightLink(undefined);
        expect(vm.getSnapshot().bodyWrapper).toBe(TextualBodyViewBodyWrapperKind.NONE);
    });

    it("uses the notice kind for notice messages", () => {
        const noticeEvent = createEvent({
            body: "Notice",
            msgtype: MsgType.Notice,
        });
        const vm = createVm({ mxEvent: noticeEvent });

        expect(vm.getSnapshot().kind).toBe(TextualBodyViewKind.NOTICE);
    });

    it("updates the moderation marker from the dedicated setter", () => {
        const hiddenEvent = createEvent({
            body: "hidden",
            msgtype: MsgType.Text,
        });
        vi.spyOn(hiddenEvent, "messageVisibility").mockReturnValue({
            visible: false,
            reason: "spam",
        } as ReturnType<MatrixEvent["messageVisibility"]>);

        const vm = createVm({ mxEvent: hiddenEvent });

        vm.setIsSeeingThroughMessageHiddenForModeration(true);

        expect(vm.getSnapshot().showPendingModerationMarker).toBe(true);
        expect(vm.getSnapshot().pendingModerationText).toContain("spam");
    });

    it("updates id and edited marker from dedicated setters", () => {
        const event = createEvent({
            body: "edited",
            msgtype: MsgType.Text,
        });
        vi.spyOn(event, "replacingEventDate").mockReturnValue(new Date(1993, 7, 3));
        const vm = createVm({ mxEvent: event });

        vm.setId("updated-id");
        vm.setReplacingEventId("$edit");

        expect(vm.getSnapshot().id).toBe("updated-id");
        expect(vm.getSnapshot().showEditedMarker).toBe(true);
        expect(vm.getSnapshot().editedMarkerText).toContain("edited");

        vm.setReplacingEventId(undefined);

        expect(vm.getSnapshot().showEditedMarker).toBe(false);
        expect(vm.getSnapshot().editedMarkerTooltip).toBeUndefined();
    });

    it("renders the generic pending moderation text when there is no reason", () => {
        const hiddenEvent = createEvent({
            body: "hidden",
            msgtype: MsgType.Text,
        });
        vi.spyOn(hiddenEvent, "messageVisibility").mockReturnValue({
            visible: false,
            reason: null,
        } as ReturnType<MatrixEvent["messageVisibility"]>);
        const vm = createVm({ mxEvent: hiddenEvent });

        vm.setIsSeeingThroughMessageHiddenForModeration(true);

        expect(vm.getSnapshot().showPendingModerationMarker).toBe(true);
        expect(vm.getSnapshot().pendingModerationText).toMatch(/^\(.+\)$/);
        expect(vm.getSnapshot().pendingModerationText).not.toContain("undefined");
    });

    it("throws when pending moderation is requested for a visible message", () => {
        const visibleEvent = createEvent({
            body: "visible",
            msgtype: MsgType.Text,
        });
        vi.spyOn(visibleEvent, "messageVisibility").mockReturnValue({
            visible: true,
        } as ReturnType<MatrixEvent["messageVisibility"]>);

        expect(() =>
            createVm({
                mxEvent: visibleEvent,
                isSeeingThroughMessageHiddenForModeration: true,
            }),
        ).toThrow("TextualBodyViewModel should only render pending moderation for hidden messages");
    });

    it("rewrites linkified permalink clicks to local hashes", () => {
        const vm = createVm();
        const preventDefault = vi.fn();
        vi.spyOn(permalinkUtils, "tryTransformPermalinkToLocalHref").mockReturnValue("#/room/#room:example.org");

        vm.onRootClick({
            preventDefault,
            target: {
                dataset: {
                    [LINKIFIED_DATA_ATTRIBUTE]: "true",
                },
                href: "https://matrix.to/#/#room:example.org",
                nodeName: "A",
            },
        } as any);

        expect(preventDefault).toHaveBeenCalled();
        expect(window.location.hash).toBe("#/room/#room:example.org");
    });

    it("shows linkified user IDs in the right panel", () => {
        const vm = createVm();
        const preventDefault = vi.fn();
        const dispatchSpy = vi.spyOn(dispatcher, "dispatch").mockImplementation(() => {});

        vm.onRootClick({
            preventDefault,
            target: {
                dataset: {
                    [LINKIFIED_DATA_ATTRIBUTE]: "true",
                },
                href: "https://matrix.to/#/@user:example.org",
                nodeName: "A",
            },
        } as any);

        expect(preventDefault).toHaveBeenCalled();
        expect(dispatchSpy).toHaveBeenCalledWith({
            action: Action.ViewUser,
            member: expect.objectContaining({ userId: "@user:example.org" }),
        });
        expect(window.location.hash).toBe("");
    });

    it("ignores root clicks which were already handled", () => {
        const vm = createVm();
        const transformSpy = vi.spyOn(permalinkUtils, "tryTransformPermalinkToLocalHref");

        vm.onRootClick({
            defaultPrevented: true,
            target: {
                href: "https://matrix.to/#/@user:example.org",
                nodeName: "A",
            },
        } as any);

        expect(transformSpy).not.toHaveBeenCalled();
        expect(window.location.hash).toBe("");
    });

    it("leaves linkified ordinary links alone", () => {
        const vm = createVm();
        const preventDefault = vi.fn();

        vm.onRootClick({
            preventDefault,
            target: {
                dataset: {
                    [LINKIFIED_DATA_ATTRIBUTE]: "true",
                },
                href: "https://example.org",
                nodeName: "A",
            },
        } as any);

        expect(preventDefault).not.toHaveBeenCalled();
        expect(window.location.hash).toBe("");
    });

    it("rewrites permalink clicks to local hashes", () => {
        const vm = createVm();
        const preventDefault = vi.fn();
        const anchor = { href: "https://element.example/#/room/!room:example.org", nodeName: "A" };
        vi.spyOn(permalinkUtils, "tryTransformPermalinkToLocalHref").mockReturnValue("#/room/!room:example.org");

        vm.onRootClick({
            preventDefault,
            target: {
                nodeName: "SPAN",
                closest: vi.fn().mockReturnValue(anchor),
            },
        } as any);

        expect(preventDefault).toHaveBeenCalled();
        expect(window.location.hash).toBe("#/room/!room:example.org");
    });

    it("leaves external root clicks alone when no local permalink is found", () => {
        const vm = createVm();
        const preventDefault = vi.fn();
        const href = "https://example.org";
        vi.spyOn(permalinkUtils, "tryTransformPermalinkToLocalHref").mockReturnValue(href);

        vm.onRootClick({
            preventDefault,
            target: {
                href,
                nodeName: "A",
            },
        } as any);

        expect(preventDefault).not.toHaveBeenCalled();
        expect(window.location.hash).toBe("");
    });

    it("opens the edit history dialog from the edited marker", () => {
        const event = createEvent({
            body: "edited",
            msgtype: MsgType.Text,
        });
        const vm = createVm({ mxEvent: event });
        const createDialogSpy = vi.spyOn(Modal, "createDialog").mockImplementation(() => ({ close: vi.fn() }) as any);

        vm.onEditedMarkerClick();

        expect(createDialogSpy).toHaveBeenCalledWith(MessageEditHistoryDialog, { mxEvent: event });
    });

    it("dispatches composer insert for the emote sender using the current rendering type", () => {
        const event = createEvent({
            body: "waves",
            msgtype: MsgType.Emote,
        });
        const vm = createVm({ mxEvent: event });
        const dispatchSpy = vi.spyOn(dispatcher, "dispatch").mockImplementation(() => {});

        vm.setTimelineRenderingType(TimelineRenderingType.Thread);
        vm.onEmoteSenderClick();

        expect(dispatchSpy).toHaveBeenCalledWith({
            action: Action.ComposerInsert,
            timelineRenderingType: TimelineRenderingType.Thread,
            userId: event.getSender(),
        });
    });

    it("does not emit for unchanged setter values", () => {
        const mxEvent = createEvent({
            body: "Hello world",
            msgtype: MsgType.Text,
        });
        const vm = createVm({ mxEvent });
        const listener = vi.fn();
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
