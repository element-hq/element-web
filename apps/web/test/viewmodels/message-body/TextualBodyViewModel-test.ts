/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    LINKIFIED_DATA_ATTRIBUTE,
    TextualBodyViewBodyWrapperKind,
    TextualBodyViewKind,
} from "@element-hq/web-shared-components";
import { MsgType, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { flushPromises, mkEvent } from "../../test-utils";
import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import { TextualBodyViewModel } from "../../../src/viewmodels/room/timeline/event-tile/body/TextualBodyViewModel";
import Modal from "../../../src/Modal";
import dispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { IntegrationManagers } from "../../../src/integrations/IntegrationManagers";
import * as permalinkUtils from "../../../src/utils/permalinks/Permalinks";
import QuestionDialog from "../../../src/components/views/dialogs/QuestionDialog";
import MessageEditHistoryDialog from "../../../src/components/views/dialogs/MessageEditHistoryDialog";

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
        jest.restoreAllMocks();
        window.location.hash = "";
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

    it("uses the notice kind and no action wrapper for non-string starter links", () => {
        const noticeEvent = createEvent({
            body: "Notice",
            msgtype: MsgType.Notice,
            data: {
                "org.matrix.neb.starter_link": 42,
            },
        });
        const vm = createVm({ mxEvent: noticeEvent });

        expect(vm.getSnapshot().kind).toBe(TextualBodyViewKind.NOTICE);
        expect(vm.getSnapshot().bodyWrapper).toBe(TextualBodyViewBodyWrapperKind.NONE);
        expect(vm.getSnapshot().bodyActionAriaLabel).toBeUndefined();
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

    it("updates id and edited marker from dedicated setters", () => {
        const event = createEvent({
            body: "edited",
            msgtype: MsgType.Text,
        });
        jest.spyOn(event, "replacingEventDate").mockReturnValue(new Date(1993, 7, 3));
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
        jest.spyOn(hiddenEvent, "messageVisibility").mockReturnValue({
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
        jest.spyOn(visibleEvent, "messageVisibility").mockReturnValue({
            visible: true,
        } as ReturnType<MatrixEvent["messageVisibility"]>);

        expect(() =>
            createVm({
                mxEvent: visibleEvent,
                isSeeingThroughMessageHiddenForModeration: true,
            }),
        ).toThrow("TextualBodyViewModel should only render pending moderation for hidden messages");
    });

    it("ignores linkified root clicks", () => {
        const vm = createVm();
        const preventDefault = jest.fn();
        const transformSpy = jest.spyOn(permalinkUtils, "tryTransformPermalinkToLocalHref");

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

        expect(transformSpy).not.toHaveBeenCalled();
        expect(preventDefault).not.toHaveBeenCalled();
    });

    it("rewrites permalink clicks to local hashes", () => {
        const vm = createVm();
        const preventDefault = jest.fn();
        const anchor = { href: "https://element.example/#/room/!room:example.org", nodeName: "A" };
        jest.spyOn(permalinkUtils, "tryTransformPermalinkToLocalHref").mockReturnValue("#/room/!room:example.org");

        vm.onRootClick({
            preventDefault,
            target: {
                nodeName: "SPAN",
                closest: jest.fn().mockReturnValue(anchor),
            },
        } as any);

        expect(preventDefault).toHaveBeenCalled();
        expect(window.location.hash).toBe("#/room/!room:example.org");
    });

    it("leaves external root clicks alone when no local permalink is found", () => {
        const vm = createVm();
        const preventDefault = jest.fn();
        const href = "https://example.org";
        jest.spyOn(permalinkUtils, "tryTransformPermalinkToLocalHref").mockReturnValue(href);

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

    it("does nothing for body actions without a starter link", () => {
        const vm = createVm();
        const preventDefault = jest.fn();
        const hasManagerSpy = jest.spyOn(IntegrationManagers.sharedInstance(), "hasManager");

        vm.onBodyActionClick({ preventDefault } as any);

        expect(preventDefault).toHaveBeenCalled();
        expect(hasManagerSpy).not.toHaveBeenCalled();
    });

    it("opens the no-manager dialog for starter links when integrations are unavailable", () => {
        const vm = createVm({
            mxEvent: createEvent({
                body: "Open the integration",
                msgtype: MsgType.Text,
                data: {
                    "org.matrix.neb.starter_link": "https://scalar.example/starter",
                },
            }),
        });
        const preventDefault = jest.fn();
        const managers = IntegrationManagers.sharedInstance();
        jest.spyOn(managers, "hasManager").mockReturnValue(false);
        const openNoManagerDialogSpy = jest.spyOn(managers, "openNoManagerDialog").mockImplementation(() => {});

        vm.onBodyActionClick({ preventDefault } as any);

        expect(preventDefault).toHaveBeenCalled();
        expect(openNoManagerDialogSpy).toHaveBeenCalled();
    });

    it("opens the scalar starter link after confirmation", async () => {
        const vm = createVm({
            mxEvent: createEvent({
                body: "Open the integration",
                msgtype: MsgType.Text,
                data: {
                    "org.matrix.neb.starter_link": "https://scalar.example/starter",
                },
            }),
        });
        const preventDefault = jest.fn();
        const managers = IntegrationManagers.sharedInstance();
        const connect = jest.fn().mockResolvedValue(undefined);
        const getStarterLink = jest.fn().mockReturnValue("https://scalar.example/complete");
        const scalarClient = { connect, getStarterLink };
        const integrationManager = {
            getScalarClient: jest.fn().mockReturnValue(scalarClient),
            uiUrl: "https://scalar.example/ui",
        };
        const popup = { opener: "initial" };

        jest.spyOn(managers, "hasManager").mockReturnValue(true);
        jest.spyOn(managers, "getPrimaryManager").mockReturnValue(integrationManager as any);
        jest.spyOn(Modal, "createDialog").mockReturnValue({
            close: jest.fn(),
            finished: Promise.resolve([true]),
        } as any);
        const openSpy = jest.spyOn(window, "open").mockImplementation(() => popup as any);

        vm.onBodyActionClick({ preventDefault } as any);
        await flushPromises();

        expect(connect).toHaveBeenCalled();
        expect(Modal.createDialog).toHaveBeenCalledWith(
            QuestionDialog,
            expect.objectContaining({
                button: expect.any(String),
                title: expect.any(String),
            }),
        );
        expect(openSpy).toHaveBeenCalledWith(
            "https://scalar.example/complete",
            "_blank",
            expect.stringContaining("width="),
        );
        expect(popup.opener).toBeNull();
    });

    it("does not open the scalar starter link when the dialog is cancelled", async () => {
        const vm = createVm({
            mxEvent: createEvent({
                body: "Open the integration",
                msgtype: MsgType.Text,
                data: {
                    "org.matrix.neb.starter_link": "https://scalar.example/starter",
                },
            }),
        });
        const managers = IntegrationManagers.sharedInstance();
        const scalarClient = {
            connect: jest.fn().mockResolvedValue(undefined),
            getStarterLink: jest.fn().mockReturnValue("https://scalar.example/complete"),
        };

        jest.spyOn(managers, "hasManager").mockReturnValue(true);
        jest.spyOn(managers, "getPrimaryManager").mockReturnValue({
            getScalarClient: jest.fn().mockReturnValue(scalarClient),
            uiUrl: "https://scalar.example/ui",
        } as any);
        jest.spyOn(Modal, "createDialog").mockReturnValue({
            close: jest.fn(),
            finished: Promise.resolve([false]),
        } as any);
        const openSpy = jest.spyOn(window, "open").mockImplementation(() => ({ opener: "initial" }) as any);

        vm.onBodyActionClick({ preventDefault: jest.fn() } as any);
        await flushPromises();

        expect(openSpy).not.toHaveBeenCalled();
    });

    it("opens the edit history dialog from the edited marker", () => {
        const event = createEvent({
            body: "edited",
            msgtype: MsgType.Text,
        });
        const vm = createVm({ mxEvent: event });
        const createDialogSpy = jest
            .spyOn(Modal, "createDialog")
            .mockImplementation(() => ({ close: jest.fn() }) as any);

        vm.onEditedMarkerClick();

        expect(createDialogSpy).toHaveBeenCalledWith(MessageEditHistoryDialog, { mxEvent: event });
    });

    it("dispatches composer insert for the emote sender using the current rendering type", () => {
        const event = createEvent({
            body: "waves",
            msgtype: MsgType.Emote,
        });
        const vm = createVm({ mxEvent: event });
        const dispatchSpy = jest.spyOn(dispatcher, "dispatch").mockImplementation(() => {});

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
