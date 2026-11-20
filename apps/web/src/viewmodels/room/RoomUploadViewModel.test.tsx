/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import {
    type IEventRelation,
    type MatrixClient,
    type MatrixEvent,
    type Room,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";
import { render } from "test-utils-rtl";
import { vi, describe, it, expect, beforeEach, afterEach, afterAll, type MockedObject } from "vitest";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import { getRoomContext, mkEvent, mkStubRoom, stubClient, tearDownAfterTest } from "test-utils";

import { RoomUploadContextProvider, RoomUploadViewModel } from "./RoomUploadViewModel";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import defaultDispatcher, { MatrixDispatcher } from "../../dispatcher/dispatcher";
import ContentMessages from "../../ContentMessages";
import { ComposerApi } from "../../modules/ComposerApi";
import type { ComposerInsertFilesPayload } from "../../dispatcher/payloads/ComposerInsertFilePayload";
import { ScopedRoomContextProvider } from "../../contexts/ScopedRoomContext";
import { Action } from "../../dispatcher/actions";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { PosthogAnalytics } from "../../PosthogAnalytics";
import SettingsStore from "../../settings/SettingsStore";
import { type MediaCaption } from "../../utils/gallery";

const sendContentListToRoomSpy = vi.spyOn(ContentMessages.sharedInstance(), "sendContentListToRoom");

describe("RoomUploadViewModel", () => {
    let client: MockedObject<MatrixClient>;
    let room: MockedObject<Room>;
    let dis: MockedObject<MatrixDispatcher>;
    beforeEach(() => {
        vi.clearAllMocks();
        client = stubClient() as MockedObject<MatrixClient>;
        room = mkStubRoom("!room", undefined, undefined) as MockedObject<Room>;
        dis = {
            dispatch: vi.fn(),
        } as Partial<MatrixDispatcher> as MockedObject<MatrixDispatcher>;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    it.each([true, false])("handles state when room.maySendMessage = %s", (maySendMessage) => {
        room.maySendMessage.mockReturnValue(maySendMessage);
        const vm = new RoomUploadViewModel(
            room,
            client,
            TimelineRenderingType.Room,
            dis,
            undefined,
            undefined,
            () => {},
        );
        tearDownAfterTest(vm);
        expect(vm.getSnapshot().options).toHaveLength(maySendMessage ? 1 : 0);
        room.maySendMessage.mockReturnValue(!maySendMessage);
        room.emit(RoomEvent.CurrentStateUpdated, room, null as any, null as any);
        expect(vm.getSnapshot().options).toHaveLength(maySendMessage ? 0 : 1);
    });

    it("handles custom upload option", async () => {
        const compApi = new ComposerApi(new MatrixDispatcher());
        const replyEv = mkEvent({ type: "fake", content: {}, user: "any", event: true });
        const vm = new RoomUploadViewModel(
            room,
            client,
            TimelineRenderingType.Room,
            dis,
            replyEv,
            {
                rel_type: "any_type",
            },
            () => {},
            compApi,
        );
        tearDownAfterTest(vm);
        const onSelected = vi.fn();
        const icon = { myicon: 5 } as any;
        compApi.addFileUploadOption({
            type: "org.example.test",
            label: "My uploader",
            icon,
            onSelected,
        });
        // The module option must appear exactly once, alongside the built-in local option.
        expect(vm.getSnapshot().options).toEqual([
            expect.objectContaining({ type: "local" }),
            { type: "org.example.test", label: "My uploader", icon },
        ]);
        vm.onUploadOptionSelected("org.example.test");
        expect(onSelected).toHaveBeenCalledWith(
            room.roomId,
            { view: "room" },
            {
                inReplyToEventId: replyEv.getId(),
                relType: "any_type",
            },
        );
    });

    describe("uploads via input", () => {
        it("redirected if guest", async () => {
            client.isGuest.mockReturnValue(true);
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Room,
                dis,
                undefined,
                undefined,
                () => {},
            );
            tearDownAfterTest(vm);
            await vm.initiateViaInputFiles([] as unknown as FileList);
            expect(dis.dispatch).toHaveBeenCalledWith({ action: "require_registration" });
        });
        it("skips empty files", async () => {
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Room,
                dis,
                undefined,
                undefined,
                () => {},
            );
            tearDownAfterTest(vm);
            await vm.initiateViaInputFiles([] as unknown as FileList);
            expect(dis.dispatch).not.toHaveBeenCalled();
        });
        it("uploads with correct context", async () => {
            sendContentListToRoomSpy.mockResolvedValue(undefined);
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Thread,
                dis,
                undefined,
                undefined,
                () => {},
            );
            tearDownAfterTest(vm);
            const replyEvent = mkEvent({ event: true, type: "anything", user: "anyone", content: {} });
            vm.setReplyToEvent(replyEvent);
            const threadRelation: IEventRelation = { key: "foo" };
            vm.setThreadRelation(threadRelation);
            const fileList = [
                {
                    name: "fake.png",
                    size: 1024,
                    type: "image/png",
                },
            ] as unknown as FileList;
            await vm.initiateViaInputFiles(fileList);
            expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
                fileList,
                room.roomId,
                threadRelation,
                replyEvent,
                client,
                TimelineRenderingType.Thread,
            );
        });
    });

    describe("uploads via data transfer", () => {
        it("redirected if guest", async () => {
            client.isGuest.mockReturnValue(true);
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Room,
                dis,
                undefined,
                undefined,
                () => {},
            );
            tearDownAfterTest(vm);
            await vm.initiateViaDataTransfer({} as DataTransfer);
            expect(dis.dispatch).toHaveBeenCalledWith({ action: "require_registration" });
        });
        it("skips empty files", async () => {
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Room,
                dis,
                undefined,
                undefined,
                () => {},
            );
            tearDownAfterTest(vm);
            await vm.initiateViaDataTransfer({ files: [] as unknown as FileList } as DataTransfer);
            expect(dis.dispatch).not.toHaveBeenCalled();
        });
        it("uploads with correct context", async () => {
            sendContentListToRoomSpy.mockResolvedValue(undefined);
            const vm = new RoomUploadViewModel(
                room,
                client,
                TimelineRenderingType.Thread,
                dis,
                undefined,
                undefined,
                () => {},
            );
            tearDownAfterTest(vm);
            const replyEvent = mkEvent({ event: true, type: "anything", user: "anyone", content: {} });
            vm.setReplyToEvent(replyEvent);
            const threadRelation: IEventRelation = { key: "foo" };
            vm.setThreadRelation(threadRelation);
            const files = [
                {
                    name: "fake.png",
                    size: 1024,
                    type: "image/png",
                },
            ] as unknown as FileList;
            await vm.initiateViaDataTransfer({ files } as DataTransfer);
            expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
                files,
                room.roomId,
                threadRelation,
                replyEvent,
                client,
                TimelineRenderingType.Thread,
            );
        });
    });

    describe("attachments", () => {
        const image = new File(["image"], "photo.png", { type: "image/png" });
        const secondImage = new File(["second image"], "other.jpg", { type: "image/jpeg" });
        const video = new File(["video"], "clip.mp4", { type: "video/mp4" });
        const pdf = new File(["pdf"], "doc.pdf", { type: "application/pdf" });
        const audio = new File(["audio"], "song.ogg", { type: "audio/ogg" });
        const caption: MediaCaption = { body: "Look at these" };

        let galleryEnabled: boolean;
        let fetchUploadLimit: ReturnType<typeof vi.spyOn>;
        let sendGalleryToRoom: ReturnType<typeof vi.spyOn>;
        let trackEvent: ReturnType<typeof vi.spyOn>;
        const spies: Array<{ mockRestore(): void }> = [];

        beforeEach(() => {
            galleryEnabled = true;
            sendContentListToRoomSpy.mockResolvedValue(undefined);

            const getValue = SettingsStore.getValue.bind(SettingsStore);
            fetchUploadLimit = vi.spyOn(ContentMessages.sharedInstance(), "fetchUploadLimit").mockResolvedValue(null);
            sendGalleryToRoom = vi.spyOn(ContentMessages.sharedInstance(), "sendGalleryToRoom").mockResolvedValue();
            trackEvent = vi.spyOn(PosthogAnalytics.instance, "trackEvent").mockImplementation(() => {});
            spies.push(
                fetchUploadLimit,
                sendGalleryToRoom,
                trackEvent,
                vi
                    .spyOn(SettingsStore, "getValue")
                    .mockImplementation(((name: string, ...rest: unknown[]) =>
                        name === "feature_gallery_messages"
                            ? galleryEnabled
                            : (getValue as (...args: unknown[]) => unknown)(
                                  name,
                                  ...rest,
                              )) as typeof SettingsStore.getValue),
                vi.spyOn(URL, "createObjectURL").mockImplementation((file) => `blob:${(file as File).name}`),
                vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {}),
            );
        });

        afterEach(() => {
            while (spies.length) spies.pop()!.mockRestore();
        });

        function createVm(timelineRenderingType = TimelineRenderingType.Room): RoomUploadViewModel {
            return tearDownAfterTest(
                new RoomUploadViewModel(room, client, timelineRenderingType, dis, undefined, undefined, () => {}),
            );
        }

        const attachedNames = (vm: RoomUploadViewModel): string[] =>
            vm.attachments.getSnapshot().items.map((item) => item.name);

        it("starts without attachments", () => {
            const vm = createVm();

            expect(vm.hasAttachments).toBe(false);
            expect(vm.attachments.getSnapshot().items).toEqual([]);
            expect(vm.attachments.getItems()).toEqual([]);
        });

        it("sends files straight away and attaches nothing while gallery messages are disabled", async () => {
            galleryEnabled = false;
            const vm = createVm();

            await vm.initiateViaInputFiles([image, video]);

            expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
                [image, video],
                room.roomId,
                undefined,
                undefined,
                client,
                TimelineRenderingType.Room,
            );
            expect(vm.hasAttachments).toBe(false);
            expect(fetchUploadLimit).not.toHaveBeenCalled();
            expect(dis.dispatch).not.toHaveBeenCalled();
        });

        it("keeps picked images and videos in the composer instead of sending them", async () => {
            const vm = createVm(TimelineRenderingType.Thread);

            await vm.initiateViaInputFiles([image, video]);

            expect(vm.hasAttachments).toBe(true);
            expect(vm.attachments.getSnapshot().items).toEqual([
                expect.objectContaining({ name: "photo.png", type: "image", previewUrl: "blob:photo.png" }),
                expect.objectContaining({ name: "clip.mp4", type: "video", previewUrl: "blob:clip.mp4" }),
            ]);
            // Nothing is sent until the user sends the message
            expect(sendContentListToRoomSpy).not.toHaveBeenCalled();
            expect(sendGalleryToRoom).not.toHaveBeenCalled();
            // The user carries on writing in the composer the files were attached to
            expect(dis.dispatch).toHaveBeenCalledWith({
                action: Action.FocusSendMessageComposer,
                context: TimelineRenderingType.Thread,
            });
        });

        it("adds to the attachments already waiting", async () => {
            const vm = createVm();

            await vm.initiateViaInputFiles([image]);
            await vm.initiateViaInputFiles([video, secondImage]);

            expect(attachedNames(vm)).toEqual(["photo.png", "clip.mp4", "other.jpg"]);
        });

        it("attaches the media of a mixed selection and sends only the other files", async () => {
            const vm = createVm();
            const replyEvent = mkEvent({ event: true, type: "anything", user: "anyone", content: {} });
            vm.setReplyToEvent(replyEvent);
            const threadRelation: IEventRelation = { rel_type: "m.thread", event_id: "$root" };
            vm.setThreadRelation(threadRelation);

            await vm.initiateViaInputFiles([pdf, image, audio, video]);

            expect(attachedNames(vm)).toEqual(["photo.png", "clip.mp4"]);
            expect(sendContentListToRoomSpy).toHaveBeenCalledTimes(1);
            expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
                [pdf, audio],
                room.roomId,
                threadRelation,
                replyEvent,
                client,
                TimelineRenderingType.Room,
            );
        });

        it("sends a selection without images or videos the way it always was", async () => {
            const vm = createVm();

            await vm.initiateViaInputFiles([pdf, audio]);

            expect(vm.hasAttachments).toBe(false);
            expect(fetchUploadLimit).not.toHaveBeenCalled();
            expect(dis.dispatch).not.toHaveBeenCalled();
            expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
                [pdf, audio],
                room.roomId,
                undefined,
                undefined,
                client,
                TimelineRenderingType.Room,
            );
        });

        it("turns away files which are larger than the homeserver accepts", async () => {
            fetchUploadLimit.mockResolvedValue(6);
            const vm = createVm();

            // "image" is 5 bytes, "second image" is 12
            await vm.initiateViaInputFiles([image, secondImage]);

            expect(fetchUploadLimit).toHaveBeenCalledWith(client);
            expect(attachedNames(vm)).toEqual(["photo.png"]);
            expect(vm.attachments.getSnapshot().notice).toBeTruthy();
            expect(sendContentListToRoomSpy).not.toHaveBeenCalled();
        });

        it("accepts files of any size when the homeserver has no limit", async () => {
            // A limit learned for an earlier selection no longer applies
            fetchUploadLimit.mockResolvedValueOnce(6).mockResolvedValueOnce(null);
            const vm = createVm();

            await vm.initiateViaInputFiles([secondImage]);
            expect(vm.hasAttachments).toBe(false);

            await vm.initiateViaInputFiles([secondImage]);
            expect(attachedNames(vm)).toEqual(["other.jpg"]);
            expect(vm.attachments.getSnapshot().notice).toBeUndefined();
        });

        it("keeps dropped and pasted images and videos in the composer too", async () => {
            const vm = createVm();

            await vm.initiateViaDataTransfer({ files: [image, pdf, video] as unknown as FileList } as DataTransfer);

            expect(attachedNames(vm)).toEqual(["photo.png", "clip.mp4"]);
            expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
                [pdf],
                room.roomId,
                undefined,
                undefined,
                client,
                TimelineRenderingType.Room,
            );
            expect(dis.dispatch).toHaveBeenCalledWith({
                action: Action.FocusSendMessageComposer,
                context: TimelineRenderingType.Room,
            });
        });

        it("does not send anything for a drop of only images and videos", async () => {
            const vm = createVm();

            await vm.initiateViaDataTransfer({ files: [image] as unknown as FileList } as DataTransfer);

            expect(attachedNames(vm)).toEqual(["photo.png"]);
            expect(sendContentListToRoomSpy).not.toHaveBeenCalled();
        });

        it("still turns guests away", async () => {
            client.isGuest.mockReturnValue(true);
            const vm = createVm();

            await vm.initiateViaInputFiles([image]);
            await vm.initiateViaDataTransfer({ files: [image] as unknown as FileList } as DataTransfer);

            expect(dis.dispatch).toHaveBeenCalledWith({ action: "require_registration" });
            expect(vm.hasAttachments).toBe(false);
            expect(fetchUploadLimit).not.toHaveBeenCalled();
            expect(sendContentListToRoomSpy).not.toHaveBeenCalled();
        });

        it("attaches nothing once the composer has gone away", async () => {
            const { promise, resolve } = Promise.withResolvers<number | null>();
            fetchUploadLimit.mockReturnValue(promise);
            const vm = createVm();
            const onAddFiles = vi.spyOn(vm.attachments, "onAddFiles");

            const pending = vm.initiateViaInputFiles([image, pdf]);
            vm.dispose();
            resolve(null);
            await pending;

            expect(onAddFiles).not.toHaveBeenCalled();
            expect(dis.dispatch).not.toHaveBeenCalled();
            expect(sendContentListToRoomSpy).not.toHaveBeenCalled();
        });

        it("keeps files inserted by a module in the composer", async () => {
            const { getByTestId } = render(
                <MatrixClientContext.Provider value={client}>
                    <ScopedRoomContextProvider {...getRoomContext(room, {})}>
                        <RoomUploadContextProvider>
                            <p>Any child</p>
                        </RoomUploadContextProvider>
                    </ScopedRoomContextProvider>
                </MatrixClientContext.Provider>,
            );

            defaultDispatcher.dispatch(
                {
                    action: Action.ComposerFileInsert,
                    files: [image],
                    timelineRenderingType: TimelineRenderingType.Room,
                } satisfies ComposerInsertFilesPayload,
                true,
            );

            await vi.waitFor(() => expect(fetchUploadLimit).toHaveBeenCalledWith(client));
            expect(sendContentListToRoomSpy).not.toHaveBeenCalled();
            expect(getByTestId("room-upload-context-input")).toBeInTheDocument();
        });

        describe("sendAttachments", () => {
            it("sends nothing when no attachments are waiting", () => {
                const vm = createVm();

                expect(vm.sendAttachments(caption)).toBe(false);

                expect(sendGalleryToRoom).not.toHaveBeenCalled();
                expect(trackEvent).not.toHaveBeenCalled();
            });

            it("sends the waiting attachments as one message with the caption", async () => {
                const vm = createVm();
                await vm.initiateViaInputFiles([video, image, secondImage]);

                expect(vm.sendAttachments(caption)).toBe(true);

                await vi.waitFor(() => expect(sendGalleryToRoom).toHaveBeenCalledTimes(1));
                // In the order they were attached
                expect(sendGalleryToRoom).toHaveBeenCalledWith(
                    [video, image, secondImage],
                    caption,
                    room.roomId,
                    undefined,
                    client,
                    undefined,
                );
            });

            it("sends them in the thread and as the reply the composer is in", async () => {
                const vm = createVm(TimelineRenderingType.Thread);
                await vm.initiateViaInputFiles([image, video]);
                // The user starts a reply after attaching the files
                const replyEvent = mkEvent({ event: true, type: "anything", user: "anyone", content: {} });
                vm.setReplyToEvent(replyEvent);
                const threadRelation: IEventRelation = { rel_type: "m.thread", event_id: "$root" };
                vm.setThreadRelation(threadRelation);
                const formatted: MediaCaption = {
                    "body": "**hi** @bob",
                    "format": "org.matrix.custom.html",
                    "formatted_body": "<strong>hi</strong> @bob",
                    "m.mentions": { user_ids: ["@bob:server"] },
                };

                vm.sendAttachments(formatted);

                await vi.waitFor(() =>
                    expect(sendGalleryToRoom).toHaveBeenCalledWith(
                        [image, video],
                        formatted,
                        room.roomId,
                        threadRelation,
                        client,
                        replyEvent,
                    ),
                );
            });

            it("leaves the composer without attachments", async () => {
                const vm = createVm();
                await vm.initiateViaInputFiles([image, video]);

                vm.sendAttachments(caption);

                expect(vm.hasAttachments).toBe(false);
                expect(vm.attachments.getSnapshot().items).toEqual([]);
                // The previews are released
                expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo.png");
                expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:clip.mp4");
                // So sending again has nothing to send
                expect(vm.sendAttachments(caption)).toBe(false);
                await vi.waitFor(() => expect(sendGalleryToRoom).toHaveBeenCalledTimes(1));
            });

            it("tracks how many attachments of which kind were sent", async () => {
                const vm = createVm();
                await vm.initiateViaInputFiles([image, video, video]);

                vm.sendAttachments(caption);

                expect(trackEvent).toHaveBeenCalledWith({
                    eventName: "AttachmentSend",
                    isReply: false,
                    inThread: false,
                    count: 3,
                    kind: "local",
                    type: "video",
                });
            });

            it("tracks whether they were sent as a reply and in a thread", async () => {
                const vm = createVm(TimelineRenderingType.Thread);
                vm.setReplyToEvent(mkEvent({ event: true, type: "anything", user: "anyone", content: {} }));
                vm.setThreadRelation({ rel_type: "m.thread", event_id: "$root" });
                await vm.initiateViaInputFiles([image]);

                vm.sendAttachments(caption);

                expect(trackEvent).toHaveBeenCalledWith({
                    eventName: "AttachmentSend",
                    isReply: true,
                    inThread: true,
                    count: 1,
                    kind: "local",
                    type: "image",
                });
            });

            it("logs a failure to send rather than throwing", async () => {
                const warn = vi.spyOn(rootLogger.getChild("RoomUploadViewModel"), "warn").mockImplementation(() => {});
                spies.push(warn);
                const error = new Error("homeserver is down");
                sendGalleryToRoom.mockRejectedValue(error);
                const vm = createVm();
                await vm.initiateViaInputFiles([image]);

                expect(vm.sendAttachments(caption)).toBe(true);

                await vi.waitFor(() => expect(warn).toHaveBeenCalledWith("Failed to send attachments", error));
            });
        });

        it("releases the attachments when the composer goes away", async () => {
            const vm = createVm();
            await vm.initiateViaInputFiles([image]);

            vm.dispose();

            expect(vm.attachments.isDisposed).toBe(true);
            expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo.png");
        });
    });

    describe("RoomUploadContextProvider", () => {
        it("uploads when called via module API", async () => {
            sendContentListToRoomSpy.mockResolvedValue(undefined);
            render(
                <MatrixClientContext.Provider value={client}>
                    <ScopedRoomContextProvider {...getRoomContext(room, {})}>
                        <RoomUploadContextProvider>
                            <p>Any child</p>
                        </RoomUploadContextProvider>
                    </ScopedRoomContextProvider>
                </MatrixClientContext.Provider>,
            );
            const files = [
                {
                    name: "fake.png",
                    size: 1024,
                    type: "image/png",
                },
            ] as File[];
            defaultDispatcher.dispatch(
                {
                    action: Action.ComposerFileInsert,
                    files,
                    timelineRenderingType: TimelineRenderingType.Room,
                } satisfies ComposerInsertFilesPayload,
                true,
            );
            // The files are first checked for media to keep in the composer, which takes a tick.
            await vi.waitFor(() =>
                expect(sendContentListToRoomSpy).toHaveBeenCalledWith(
                    files,
                    room.roomId,
                    undefined,
                    undefined,
                    client,
                    TimelineRenderingType.Room,
                ),
            );
        });
    });

    describe("analytics", () => {
        let trackEvent: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            trackEvent = vi.spyOn(PosthogAnalytics.instance, "trackEvent").mockImplementation(() => {});
        });

        afterEach(() => {
            trackEvent.mockRestore();
        });

        function createVm(
            openUploadDialog: () => void,
            replyToEvent?: MatrixEvent,
            threadRelation?: IEventRelation,
            timelineRenderingType = TimelineRenderingType.Room,
        ): RoomUploadViewModel {
            const vm = new RoomUploadViewModel(
                room,
                client,
                timelineRenderingType,
                dis,
                replyToEvent,
                threadRelation,
                openUploadDialog,
            );
            return tearDownAfterTest(vm);
        }

        it("tracks AttachmentOpen and invokes the upload function when 'local' is selected", () => {
            const openUploadDialog = vi.fn();
            const vm = createVm(openUploadDialog);
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
            const replyToEvent = mkEvent({ event: true, type: "anything", user: "anyone", content: {} });
            const vm = createVm(vi.fn(), replyToEvent, { rel_type: "m.thread" });

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
            const vm = createVm(vi.fn());
            expect(() => vm.onUploadOptionSelected("unknown-module-type")).toThrow();
            expect(trackEvent).not.toHaveBeenCalled();
        });

        it("throws when the timeline rendering type is not Room or Thread", () => {
            const vm = createVm(vi.fn(), undefined, undefined, TimelineRenderingType.File);
            expect(() => vm.onUploadOptionSelected("local")).toThrow("TimelineRenderingType must be Room or Thread");
            expect(trackEvent).not.toHaveBeenCalled();
        });
    });
});
