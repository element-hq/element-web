/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { EventEmitter } from "node:events";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Room, MatrixClient, MatrixEvent, IEventRelation } from "matrix-js-sdk/src/matrix";
import type { MatrixDispatcher } from "../../dispatcher/dispatcher";

import { RoomUploadViewModel } from "./RoomUploadViewModel";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import { PosthogAnalytics } from "../../PosthogAnalytics";

describe("RoomUploadViewModel", () => {
    let room: Room;
    let client: MatrixClient;
    let dispatcher: MatrixDispatcher;
    let moduleComposerApi: any;
    let openUploadDialog: () => void;
    let trackEvent: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        room = Object.assign(new EventEmitter(), {
            roomId: "!room:example.org",
            maySendMessage: vi.fn().mockReturnValue(true),
        }) as unknown as Room;
        client = {
            isGuest: vi.fn().mockReturnValue(false),
        } as unknown as MatrixClient;
        dispatcher = { dispatch: vi.fn() } as unknown as MatrixDispatcher;
        moduleComposerApi = Object.assign(new EventEmitter(), {
            fileUploadOptions: [],
        });
        openUploadDialog = vi.fn<() => void>();
        trackEvent = vi.spyOn(PosthogAnalytics.instance, "trackEvent").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function createVm(
        replyToEvent?: MatrixEvent,
        threadRelation?: IEventRelation,
        timelineRenderingType = TimelineRenderingType.Room,
    ): RoomUploadViewModel {
        return new RoomUploadViewModel(
            room,
            client,
            timelineRenderingType,
            dispatcher,
            replyToEvent,
            threadRelation,
            openUploadDialog,
            moduleComposerApi,
        );
    }

    it("tracks AttachmentOpen and invokes the upload function when 'local' is selected", () => {
        const vm = createVm();
        vm.onUploadOptionSelected("local");

        expect(trackEvent).toHaveBeenCalledWith({
            eventName: "AttachmentOpen",
            isReply: false,
            inThread: false,
            kind: "local",
        });
        expect(openUploadDialog).toHaveBeenCalled();
    });

    it("marks the attachment as a reply and in-thread when applicable", () => {
        const replyToEvent = { getId: () => "$event" } as unknown as MatrixEvent;
        const threadRelation = { rel_type: "m.thread" } as unknown as IEventRelation;
        const vm = createVm(replyToEvent, threadRelation);

        vm.onUploadOptionSelected("local");

        expect(trackEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventName: "AttachmentOpen",
                isReply: true,
                inThread: true,
            }),
        );
    });

    it("throws for unknown upload types and does not track anything", () => {
        const vm = createVm();
        expect(() => vm.onUploadOptionSelected("unknown-module-type")).toThrow();
        expect(trackEvent).not.toHaveBeenCalled();
    });

    it("throws when the timeline rendering type is not Room or Thread", () => {
        const vm = createVm(undefined, undefined, TimelineRenderingType.File);
        expect(() => vm.onUploadOptionSelected("local")).toThrow("TimelineRenderingType must be Room or Thread");
        expect(trackEvent).not.toHaveBeenCalled();
    });
});
