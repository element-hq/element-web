/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import "vitest-canvas-mock";
import {
    type IContent,
    type ISendEventResponse,
    type MatrixClient,
    type MatrixEvent,
    MatrixError,
    RelationType,
    type UploadResponse,
} from "matrix-js-sdk/src/matrix";
import { type ImageInfo } from "matrix-js-sdk/src/types";
import encrypt, { type IEncryptedFile } from "matrix-encrypt-attachment";
import { createTestClient, flushPromises, mkEvent } from "test-utils";

import ContentMessages, { UploadCanceledError, uploadFile } from "./ContentMessages";
import { clearUploadedMediaCache, queryUploadedMediaCache } from "./utils/UploadedMediaCache";
import { doMaybeLocalRoomAction } from "./utils/local-room";
import { BlurhashEncoder } from "./BlurhashEncoder";
import Modal from "./Modal";
import ErrorDialog from "./components/views/dialogs/ErrorDialog";
import UploadConfirmDialog from "./components/views/dialogs/UploadConfirmDialog";
import { _t } from "./languageHandler";
import { PosthogAnalytics } from "./PosthogAnalytics";
import SettingsStore from "./settings/SettingsStore";
import defaultDispatcher from "./dispatcher/dispatcher";
import { Action } from "./dispatcher/actions";
import QuestionDialog from "./components/views/dialogs/QuestionDialog";
import { type GalleryItem, type MediaCaption } from "./utils/gallery";

vi.mock("matrix-encrypt-attachment", () => ({ default: { encryptAttachment: vi.fn().mockResolvedValue({}) } }));

vi.mock("./BlurhashEncoder", () => ({
    BlurhashEncoder: {
        instance: {
            getBlurhash: vi.fn(),
        },
    },
}));

vi.mock("./utils/local-room", () => ({
    doMaybeLocalRoomAction: vi.fn(),
}));

const createElement = document.createElement.bind(document);

vi.stubGlobal("OffscreenCanvas", undefined);

describe("ContentMessages", () => {
    const stickerUrl = "https://example.com/sticker";
    const roomId = "!room:example.com";
    const imageInfo = {} as unknown as ImageInfo;
    const text = "test sticker";
    let client: MatrixClient;
    let contentMessages: ContentMessages;
    let prom: Promise<ISendEventResponse>;

    beforeEach(() => {
        client = createTestClient();
        contentMessages = new ContentMessages();
        prom = Promise.resolve<ISendEventResponse>({ event_id: "$event_id" });
    });

    describe("sendStickerContentToRoom", () => {
        beforeEach(() => {
            vi.mocked(client.sendStickerMessage).mockReturnValue(prom);
            vi.mocked(doMaybeLocalRoomAction).mockImplementation(
                <T>(roomId: string, fn: (actualRoomId: string) => Promise<T>, client?: MatrixClient) => {
                    return fn(roomId);
                },
            );
        });

        it("should forward the call to doMaybeLocalRoomAction", async () => {
            await contentMessages.sendStickerContentToRoom(stickerUrl, roomId, null, imageInfo, text, client);
            expect(client.sendStickerMessage).toHaveBeenCalledWith(roomId, null, stickerUrl, imageInfo, text);
        });
    });

    describe("sendContentToRoom", () => {
        const roomId = "!roomId:server";
        beforeEach(() => {
            Object.defineProperty(global.Image.prototype, "src", {
                // Define the property setter
                configurable: true,
                set(src) {
                    window.setTimeout(() => this.onload());
                },
            });
            Object.defineProperty(global.Image.prototype, "height", {
                configurable: true,
                get() {
                    return 600;
                },
            });
            Object.defineProperty(global.Image.prototype, "width", {
                configurable: true,
                get() {
                    return 800;
                },
            });
            vi.mocked(doMaybeLocalRoomAction).mockImplementation(
                <T>(roomId: string, fn: (actualRoomId: string) => Promise<T>) => fn(roomId),
            );
            vi.mocked(BlurhashEncoder.instance.getBlurhash).mockResolvedValue("blurhashstring");
        });

        it("should use m.image for image files", async () => {
            vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/file" });
            const file = new File([], "fileName", { type: "image/jpeg" });
            await contentMessages.sendContentToRoom(file, roomId, undefined, client, undefined);
            expect(client.sendMessage).toHaveBeenCalledWith(
                roomId,
                null,
                expect.objectContaining({
                    url: "mxc://server/file",
                    msgtype: "m.image",
                }),
            );
        });

        it("should use m.image for PNG files which cannot be parsed but successfully thumbnail", async () => {
            vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/file" });
            const file = new File([], "fileName", { type: "image/png" });
            await contentMessages.sendContentToRoom(file, roomId, undefined, client, undefined);
            expect(client.sendMessage).toHaveBeenCalledWith(
                roomId,
                null,
                expect.objectContaining({
                    url: "mxc://server/file",
                    msgtype: "m.image",
                }),
            );
        });

        it("should fall back to m.file for invalid image files", async () => {
            vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/file" });
            const file = new File([], "fileName", { type: "image/jpeg" });
            vi.mocked(BlurhashEncoder.instance.getBlurhash).mockRejectedValue("NOT_AN_IMAGE");
            await contentMessages.sendContentToRoom(file, roomId, undefined, client, undefined);
            expect(client.sendMessage).toHaveBeenCalledWith(
                roomId,
                null,
                expect.objectContaining({
                    url: "mxc://server/file",
                    msgtype: "m.file",
                }),
            );
        });

        it("should use m.video for video files", async () => {
            vi.spyOn(document, "createElement").mockImplementation((tagName) => {
                const element = createElement(tagName);
                if (tagName === "video") {
                    (<HTMLVideoElement>element).load = vi.fn();
                    (<HTMLVideoElement>element).play = () => element.onloadeddata!(new Event("loadeddata"));
                    (<HTMLVideoElement>element).pause = vi.fn();
                    Object.defineProperty(element, "videoHeight", {
                        get() {
                            return 600;
                        },
                    });
                    Object.defineProperty(element, "videoWidth", {
                        get() {
                            return 800;
                        },
                    });
                    Object.defineProperty(element, "duration", {
                        get() {
                            return 123;
                        },
                    });
                }
                return element;
            });

            vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/file" });
            const file = new File([], "fileName", { type: "video/mp4" });
            await contentMessages.sendContentToRoom(file, roomId, undefined, client, undefined);
            expect(client.sendMessage).toHaveBeenCalledWith(
                roomId,
                null,
                expect.objectContaining({
                    url: "mxc://server/file",
                    msgtype: "m.video",
                    info: expect.objectContaining({
                        duration: 123000,
                    }),
                }),
            );
        });

        it("should use m.audio for audio files", async () => {
            vi.spyOn(document, "createElement").mockImplementation((tagName) => {
                const element = createElement(tagName);
                if (tagName === "audio") {
                    Object.defineProperty(element, "duration", {
                        get() {
                            return 621;
                        },
                    });
                    Object.defineProperty(element, "src", {
                        set() {
                            element.onloadedmetadata!(new Event("loadedmetadata"));
                        },
                    });
                }
                return element;
            });

            vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/file" });
            const file = new File([], "fileName", { type: "audio/mp3" });
            await contentMessages.sendContentToRoom(file, roomId, undefined, client, undefined);
            expect(client.sendMessage).toHaveBeenCalledWith(
                roomId,
                null,
                expect.objectContaining({
                    url: "mxc://server/file",
                    msgtype: "m.audio",
                    info: expect.objectContaining({
                        duration: 621000,
                    }),
                }),
            );
        });

        it("should fall back to m.file for invalid audio files", async () => {
            vi.spyOn(document, "createElement").mockImplementation((tagName) => {
                const element = createElement(tagName);
                if (tagName === "audio") {
                    Object.defineProperty(element, "src", {
                        set() {
                            element.onerror!("fail");
                        },
                    });
                }
                return element;
            });
            vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/file" });
            const file = new File([], "fileName", { type: "audio/mp3" });
            await contentMessages.sendContentToRoom(file, roomId, undefined, client, undefined);
            expect(client.sendMessage).toHaveBeenCalledWith(
                roomId,
                null,
                expect.objectContaining({
                    url: "mxc://server/file",
                    msgtype: "m.file",
                }),
            );
        });

        it("should default to name 'Attachment' if file doesn't have a name", async () => {
            vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/file" });
            const file = new File([], "", { type: "text/plain" });
            await contentMessages.sendContentToRoom(file, roomId, undefined, client, undefined);
            expect(client.sendMessage).toHaveBeenCalledWith(
                roomId,
                null,
                expect.objectContaining({
                    url: "mxc://server/file",
                    msgtype: "m.file",
                    body: "Attachment",
                }),
            );
        });

        it("should keep RoomUpload's total and loaded values up to date", async () => {
            vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/file" });
            const file = new File([], "", { type: "text/plain" });
            const prom = contentMessages.sendContentToRoom(file, roomId, undefined, client, undefined);
            const [upload] = contentMessages.getCurrentUploads();

            expect(upload.loaded).toBe(0);
            expect(upload.total).toBe(file.size);
            await flushPromises();
            const { progressHandler } = vi.mocked(client.uploadContent).mock.calls[0][1]!;
            progressHandler!({ loaded: 123, total: 1234 });
            expect(upload.loaded).toBe(123);
            expect(upload.total).toBe(1234);
            await prom;
        });

        it("properly handles replies", async () => {
            vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/file" });
            const file = new File([], "fileName", { type: "image/jpeg" });
            const replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@bob:test",
                room: roomId,
                content: {},
                event: true,
            });
            await contentMessages.sendContentToRoom(file, roomId, undefined, client, replyToEvent);
            expect(client.sendMessage).toHaveBeenCalledWith(
                roomId,
                null,
                expect.objectContaining({
                    "url": "mxc://server/file",
                    "msgtype": "m.image",
                    "m.mentions": {
                        user_ids: ["@bob:test"],
                    },
                }),
            );
        });

        it("handles 413 error", async () => {
            vi.mocked(client.uploadContent).mockRejectedValue(
                new MatrixError(
                    {
                        errcode: "M_TOO_LARGE",
                        error: "File size limit exceeded",
                    },
                    413,
                ),
            );
            const file = new File([], "fileName", { type: "image/jpeg" });
            const dialogSpy = vi.spyOn(Modal, "createDialog");
            await contentMessages.sendContentToRoom(file, roomId, undefined, client, undefined);
            expect(dialogSpy).toHaveBeenCalledWith(
                ErrorDialog,
                expect.objectContaining({
                    description: _t("upload_failed_size", { fileName: "fileName" }),
                }),
            );
            dialogSpy.mockRestore();
        });
    });

    describe("getCurrentUploads", () => {
        const file1 = new File([], "file1");
        const file2 = new File([], "file2");
        const roomId = "!roomId:server";

        beforeEach(() => {
            vi.mocked(doMaybeLocalRoomAction).mockImplementation(
                <T>(roomId: string, fn: (actualRoomId: string) => Promise<T>) => fn(roomId),
            );
        });

        it("should return only uploads for the given relation", async () => {
            const relation = {
                rel_type: RelationType.Thread,
                event_id: "!threadId:server",
            };
            const p1 = contentMessages.sendContentToRoom(file1, roomId, relation, client, undefined);
            const p2 = contentMessages.sendContentToRoom(file2, roomId, undefined, client, undefined);

            const uploads = contentMessages.getCurrentUploads(relation);
            expect(uploads).toHaveLength(1);
            expect(uploads[0].relation).toEqual(relation);
            expect(uploads[0].fileName).toEqual("file1");
            await Promise.all([p1, p2]);
        });

        it("should return only uploads for no relation when not passed one", async () => {
            const relation = {
                rel_type: RelationType.Thread,
                event_id: "!threadId:server",
            };
            const p1 = contentMessages.sendContentToRoom(file1, roomId, relation, client, undefined);
            const p2 = contentMessages.sendContentToRoom(file2, roomId, undefined, client, undefined);

            const uploads = contentMessages.getCurrentUploads();
            expect(uploads).toHaveLength(1);
            expect(uploads[0].relation).toEqual(undefined);
            expect(uploads[0].fileName).toEqual("file2");
            await Promise.all([p1, p2]);
        });
    });

    describe("cancelUpload", () => {
        it("should cancel in-flight upload", async () => {
            const deferred = Promise.withResolvers<UploadResponse>();
            vi.mocked(client.uploadContent).mockReturnValue(deferred.promise);
            const file1 = new File([], "file1");
            const prom = contentMessages.sendContentToRoom(file1, roomId, undefined, client, undefined);
            await flushPromises();
            const { abortController } = vi.mocked(client.uploadContent).mock.calls[0][1]!;
            expect(abortController!.signal.aborted).toBeFalsy();
            const [upload] = contentMessages.getCurrentUploads();
            contentMessages.cancelUpload(upload);
            expect(abortController!.signal.aborted).toBeTruthy();
            deferred.resolve({} as UploadResponse);
            await prom;
        });
    });
});

describe("uploadFile", () => {
    let client: MatrixClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = createTestClient();
    });

    it("should not encrypt the file if the room isn't encrypted", async () => {
        vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/file" });
        const progressHandler = vi.fn();
        const file = new Blob([]);

        const res = await uploadFile(client, "!roomId:server", file, progressHandler);

        expect(res.url).toBe("mxc://server/file");
        expect(res.file).toBeFalsy();
        expect(encrypt.encryptAttachment).not.toHaveBeenCalled();
        expect(client.uploadContent).toHaveBeenCalledWith(file, expect.objectContaining({ progressHandler }));
    });

    it("should encrypt the file if the room is encrypted", async () => {
        vi.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(true);
        vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/file" });
        vi.mocked(encrypt.encryptAttachment).mockResolvedValue({
            data: new ArrayBuffer(123),
            info: {} as IEncryptedFile,
        });
        const progressHandler = vi.fn();
        const file = new Blob(["123"]);

        const res = await uploadFile(client, "!roomId:server", file, progressHandler);

        expect(res.url).toBeFalsy();
        expect(res.file).toEqual(
            expect.objectContaining({
                url: "mxc://server/file",
            }),
        );
        expect(encrypt.encryptAttachment).toHaveBeenCalled();
        expect(client.uploadContent).toHaveBeenCalledWith(
            expect.any(Blob),
            expect.objectContaining({
                progressHandler,
                includeFilename: false,
                type: "application/octet-stream",
            }),
        );
        expect(vi.mocked(client.uploadContent).mock.calls[0][0]).not.toBe(file);
    });

    it("should keep the uploaded file so it does not have to be downloaded again", async () => {
        clearUploadedMediaCache();
        vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/plain" });
        const file = new Blob(["hello"]);

        await uploadFile(client, "!roomId:server", file);

        expect(queryUploadedMediaCache("mxc://server/plain")).toBe(file);
    });

    it("should keep the plaintext of an encrypted upload rather than the ciphertext", async () => {
        clearUploadedMediaCache();
        vi.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(true);
        vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/encrypted" });
        vi.mocked(encrypt.encryptAttachment).mockResolvedValue({
            data: new ArrayBuffer(123),
            info: {} as IEncryptedFile,
        });
        const file = new Blob(["hello"]);

        await uploadFile(client, "!roomId:server", file);

        expect(queryUploadedMediaCache("mxc://server/encrypted")).toBe(file);
    });

    it("should throw UploadCanceledError upon aborting the upload", async () => {
        vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://foo/bar" });
        const file = new Blob([]);
        const controller = new AbortController();
        controller.abort();

        await expect(uploadFile(client, "!roomId:server", file, undefined, controller)).rejects.toThrow(
            UploadCanceledError,
        );
    });
});

describe("sendContentListToRoom analytics", () => {
    const roomId = "!roomId:server";
    let client: MatrixClient;
    let contentMessages: ContentMessages;
    let trackEvent: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        client = createTestClient();
        vi.mocked(client.getMediaConfig).mockResolvedValue({});
        vi.mocked(doMaybeLocalRoomAction).mockImplementation(
            <T>(roomId: string, fn: (actualRoomId: string) => Promise<T>) => fn(roomId),
        );
        contentMessages = new ContentMessages();
        vi.spyOn(contentMessages, "sendContentToRoom").mockResolvedValue(undefined);
        trackEvent = vi.spyOn(PosthogAnalytics.instance, "trackEvent").mockImplementation(() => {});
        // Automatically continue through the per-file confirmation dialog.
        vi.spyOn(Modal, "createDialog").mockImplementation((component: unknown, ...rest: any[]) => {
            if (component === UploadConfirmDialog) {
                return { finished: Promise.resolve([true, false]) } as any;
            }
            // Any other dialog (e.g. the fetching-media-config spinner) never resolves on its own.
            return { finished: new Promise(() => {}), close: vi.fn() } as any;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function mkFile(type: string, name = "file"): File {
        return new File(["content"], name, { type });
    }

    it("tracks AttachmentSend with the most common file type when files are sent", async () => {
        const files = [mkFile("image/png", "a.png"), mkFile("image/jpeg", "b.jpg"), mkFile("video/mp4", "c.mp4")];
        await contentMessages.sendContentListToRoom(files, roomId, undefined, undefined, client);

        expect(trackEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventName: "AttachmentSend",
                count: 3,
                kind: "local",
                type: "image",
            }),
        );
    });

    it("marks the attachment as a reply and in-thread when applicable", async () => {
        const replyToEvent = { getId: () => "$event" } as any;
        const relation = { rel_type: "m.thread" } as any;
        await contentMessages.sendContentListToRoom([mkFile("text/plain")], roomId, relation, replyToEvent, client);

        expect(trackEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventName: "AttachmentSend",
                isReply: true,
                inThread: true,
            }),
        );
    });

    it("tracks AttachmentCancel when the user cancels at the confirmation dialog", async () => {
        vi.spyOn(Modal, "createDialog").mockImplementation((component: unknown) => {
            if (component === UploadConfirmDialog) {
                return { finished: Promise.resolve([false, false]) } as any;
            }
            return { finished: new Promise(() => {}), close: vi.fn() } as any;
        });

        await contentMessages.sendContentListToRoom([mkFile("text/plain")], roomId, undefined, undefined, client);

        expect(trackEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventName: "AttachmentCancel",
                kind: "local",
                stage: "Confirmation",
            }),
        );
        expect(contentMessages.sendContentToRoom).not.toHaveBeenCalled();
    });
});

describe("gallery messages", () => {
    const roomId = "!roomId:server";
    const GALLERY_MSGTYPE = "dm.filament.gallery";
    const createElement = document.createElement.bind(document);

    let client: MatrixClient;
    let contentMessages: ContentMessages;
    let settings: Record<string, unknown>;
    let createDialog: ReturnType<typeof vi.spyOn>;
    let dispatch: ReturnType<typeof vi.spyOn>;
    let trackEvent: ReturnType<typeof vi.spyOn>;
    /** A caption as the composer builds it when the user wrote no text. */
    const noCaption: MediaCaption = { body: "" };
    /** The answers the user gives, in order, when asked whether to retry a failed upload. */
    let retryAnswers: boolean[];

    function mkFile(name: string, type = "image/jpeg", content = "content"): File {
        return new File([content], name, { type });
    }

    function dialogCalls(component: unknown): any[] {
        return createDialog.mock.calls.filter(([dialog]: unknown[]) => dialog === component);
    }

    function dispatchedActions(): string[] {
        return dispatch.mock.calls.map(([payload]: any[]) => payload.action);
    }

    /** The contents of the messages sent so far, in order. */
    function sentContents(): IContent[] {
        return vi.mocked(client.sendMessage).mock.calls.map((call) => call[2] as IContent);
    }

    /** The names of the files uploaded so far, in order. Thumbnails have no name. */
    function uploadedNames(): Array<string | undefined> {
        return vi.mocked(client.uploadContent).mock.calls.map(([file]) => (file as File).name);
    }

    beforeEach(() => {
        client = createTestClient();
        vi.mocked(client.getMediaConfig).mockResolvedValue({});
        vi.mocked(client.uploadContent).mockImplementation(async (file) => ({
            content_uri: `mxc://server/${(file as File).name ?? "thumbnail"}`,
        }));
        vi.mocked(doMaybeLocalRoomAction).mockImplementation(
            <T>(roomId: string, fn: (actualRoomId: string) => Promise<T>) => fn(roomId),
        );
        vi.mocked(BlurhashEncoder.instance.getBlurhash).mockResolvedValue("blurhashstring");
        contentMessages = new ContentMessages();

        // Images load, unless their name says that they are broken.
        vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => `blob:${(blob as File).name}`);
        Object.defineProperty(global.Image.prototype, "src", {
            configurable: true,
            set(src: string) {
                window.setTimeout(() => (src.includes("broken") ? this.onerror(new Event("error")) : this.onload()));
            },
        });
        Object.defineProperty(global.Image.prototype, "height", { configurable: true, get: () => 600 });
        Object.defineProperty(global.Image.prototype, "width", { configurable: true, get: () => 800 });
        // Videos load their first frame as soon as they are played.
        vi.spyOn(document, "createElement").mockImplementation((tagName) => {
            const element = createElement(tagName);
            if (tagName === "video") {
                (<HTMLVideoElement>element).load = vi.fn();
                (<HTMLVideoElement>element).play = () => element.onloadeddata!(new Event("loadeddata"));
                (<HTMLVideoElement>element).pause = vi.fn();
                Object.defineProperty(element, "videoHeight", { get: () => 600 });
                Object.defineProperty(element, "videoWidth", { get: () => 800 });
                Object.defineProperty(element, "duration", { get: () => 123 });
            }
            return element;
        });

        settings = {};
        const getValue = SettingsStore.getValue.bind(SettingsStore) as (...args: unknown[]) => unknown;
        vi.spyOn(SettingsStore, "getValue").mockImplementation(((name: string, ...rest: unknown[]) =>
            name in settings ? settings[name] : getValue(name, ...rest)) as typeof SettingsStore.getValue);

        retryAnswers = [];
        createDialog = vi.spyOn(Modal, "createDialog").mockImplementation(((component: unknown) => {
            if (component === UploadConfirmDialog) return { finished: Promise.resolve([true, false]) };
            if (component === QuestionDialog) return { finished: Promise.resolve([retryAnswers.shift() ?? false]) };
            // Any other dialog (e.g. the fetching-media-config spinner) never resolves on its own.
            return { finished: new Promise(() => {}), close: vi.fn() };
        }) as any);
        dispatch = vi.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});
        trackEvent = vi.spyOn(PosthogAnalytics.instance, "trackEvent").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.mocked(BlurhashEncoder.instance.getBlurhash).mockReset();
    });

    describe("sendContentListToRoom", () => {
        it("confirms and sends every file on its own, whether or not gallery messages are enabled", async () => {
            // Images and videos only become a gallery when they wait in the composer, which does not come through here.
            settings.feature_gallery_messages = true;
            const sendContentToRoom = vi.spyOn(contentMessages, "sendContentToRoom").mockResolvedValue(undefined);
            const sendGalleryToRoom = vi.spyOn(contentMessages, "sendGalleryToRoom").mockResolvedValue(undefined);
            const files = [mkFile("a.jpg"), mkFile("b.mp4", "video/mp4"), mkFile("c.pdf", "application/pdf")];

            await contentMessages.sendContentListToRoom(files, roomId, undefined, undefined, client);

            expect(dialogCalls(UploadConfirmDialog).map(([, props]) => props)).toEqual([
                { file: files[0], currentIndex: 0, totalFiles: 3 },
                { file: files[1], currentIndex: 1, totalFiles: 3 },
                { file: files[2], currentIndex: 2, totalFiles: 3 },
            ]);
            expect(sendGalleryToRoom).not.toHaveBeenCalled();
            expect(sendContentToRoom.mock.calls.map(([file]: unknown[]) => file)).toEqual(files);
            expect(trackEvent).toHaveBeenCalledWith(expect.objectContaining({ eventName: "AttachmentSend", count: 3 }));
        });
    });

    describe("fetchUploadLimit", () => {
        it("asks the homeserver for the limit, once", async () => {
            vi.mocked(client.getMediaConfig).mockResolvedValue({ "m.upload.size": 5000 });

            await expect(contentMessages.fetchUploadLimit(client)).resolves.toBe(5000);
            await expect(contentMessages.fetchUploadLimit(client)).resolves.toBe(5000);

            expect(client.getMediaConfig).toHaveBeenCalledTimes(1);
            expect(contentMessages.getUploadLimit()).toBe(5000);
        });

        it("returns null when the homeserver has no limit", async () => {
            vi.mocked(client.getMediaConfig).mockResolvedValue({});

            await expect(contentMessages.fetchUploadLimit(client)).resolves.toBeNull();
        });

        it("returns null when the homeserver cannot say what the limit is", async () => {
            vi.mocked(client.getMediaConfig).mockRejectedValue(new Error("not supported"));

            await expect(contentMessages.fetchUploadLimit(client)).resolves.toBeNull();
            // Not asked again: no limit is a valid answer.
            await contentMessages.fetchUploadLimit(client);
            expect(client.getMediaConfig).toHaveBeenCalledTimes(1);
        });
    });

    describe("sendGalleryToRoom", () => {
        it("sends several files as one gallery message", async () => {
            const files = [mkFile("a.jpg", "image/jpeg", "a"), mkFile("b.mp4", "video/mp4", "bb"), mkFile("c.jpg")];

            await contentMessages.sendGalleryToRoom(files, noCaption, roomId, undefined, client, undefined);

            expect(client.sendMessage).toHaveBeenCalledTimes(1);
            expect(client.sendMessage).toHaveBeenCalledWith(roomId, null, {
                "msgtype": GALLERY_MSGTYPE,
                "body": "",
                "itemtypes": [
                    {
                        itemtype: "m.image",
                        body: "a.jpg",
                        url: "mxc://server/a.jpg",
                        info: expect.objectContaining({ size: 1, mimetype: "image/jpeg", w: 800, h: 600 }),
                    },
                    {
                        itemtype: "m.video",
                        body: "b.mp4",
                        url: "mxc://server/b.mp4",
                        info: expect.objectContaining({
                            size: 2,
                            mimetype: "video/mp4",
                            duration: 123000,
                            thumbnail_url: "mxc://server/thumbnail",
                        }),
                    },
                    {
                        itemtype: "m.image",
                        body: "c.jpg",
                        url: "mxc://server/c.jpg",
                        info: expect.objectContaining({ size: 7, mimetype: "image/jpeg" }),
                    },
                ],
                "m.mentions": {},
            });
            expect(dispatchedActions()).toContain("message_sent");
        });

        it("sends the caption the composer wrote as the body, with its formatting", async () => {
            const files = [mkFile("a.jpg"), mkFile("b.jpg")];

            await contentMessages.sendGalleryToRoom(
                files,
                {
                    body: "Our **holiday** photos",
                    format: "org.matrix.custom.html",
                    formatted_body: "Our <strong>holiday</strong> photos",
                },
                roomId,
                undefined,
                client,
                undefined,
            );

            expect(sentContents()).toEqual([
                expect.objectContaining({
                    msgtype: GALLERY_MSGTYPE,
                    body: "Our **holiday** photos",
                    format: "org.matrix.custom.html",
                    formatted_body: "Our <strong>holiday</strong> photos",
                }),
            ]);
        });

        it("sends a plain caption without a formatted body", async () => {
            const files = [mkFile("a.jpg"), mkFile("b.jpg")];

            await contentMessages.sendGalleryToRoom(
                files,
                { body: "Our holiday photos" },
                roomId,
                undefined,
                client,
                undefined,
            );

            const [content] = sentContents();
            expect(content.body).toBe("Our holiday photos");
            expect(content).not.toHaveProperty("format");
            expect(content).not.toHaveProperty("formatted_body");
        });

        it("does not format the caption itself: that is up to whoever wrote it", async () => {
            const files = [mkFile("a.jpg"), mkFile("b.jpg")];

            await contentMessages.sendGalleryToRoom(
                files,
                { body: "Our **holiday** photos" },
                roomId,
                undefined,
                client,
                undefined,
            );

            const [content] = sentContents();
            expect(content.body).toBe("Our **holiday** photos");
            expect(content).not.toHaveProperty("format");
            expect(content).not.toHaveProperty("formatted_body");
        });

        it("sends the mentions of the caption as they are", async () => {
            const replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@bob:test",
                room: roomId,
                content: {},
                event: true,
            });
            // The composer worked these out, and they already account for the reply.
            const mentions = { user_ids: ["@carol:test", "@bob:test"], room: true };

            await contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg"), mkFile("b.jpg")],
                { "body": "Hi Carol", "m.mentions": mentions },
                roomId,
                undefined,
                client,
                replyToEvent,
            );

            const [content] = sentContents();
            expect(content["m.mentions"]).toEqual(mentions);
            expect(content["m.relates_to"]).toEqual({ "m.in_reply_to": { event_id: replyToEvent.getId() } });
        });

        it("works out the mentions for a caption which comes without any", async () => {
            const replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@bob:test",
                room: roomId,
                content: {},
                event: true,
            });

            await contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg"), mkFile("b.jpg")],
                { body: "Hi" },
                roomId,
                undefined,
                client,
                replyToEvent,
            );

            expect(sentContents()[0]["m.mentions"]).toEqual({ user_ids: ["@bob:test"] });
        });

        it("sends the gallery to the thread it was composed in", async () => {
            const relation = { rel_type: RelationType.Thread, event_id: "$thread" };

            await contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg"), mkFile("b.jpg")],
                noCaption,
                roomId,
                relation,
                client,
                undefined,
            );

            expect(client.sendMessage).toHaveBeenCalledWith(
                roomId,
                "$thread",
                expect.objectContaining({ "msgtype": GALLERY_MSGTYPE, "m.relates_to": relation }),
            );
        });

        it("sends the gallery as a reply", async () => {
            const replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@bob:test",
                room: roomId,
                content: {},
                event: true,
            });

            await contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg"), mkFile("b.jpg")],
                noCaption,
                roomId,
                undefined,
                client,
                replyToEvent,
            );

            expect(client.sendMessage).toHaveBeenCalledWith(
                roomId,
                null,
                expect.objectContaining({
                    "msgtype": GALLERY_MSGTYPE,
                    "m.mentions": { user_ids: ["@bob:test"] },
                    "m.relates_to": { "m.in_reply_to": { event_id: replyToEvent.getId() } },
                }),
            );
        });

        it("sends a single file as an ordinary image message with its caption", async () => {
            await contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg")],
                { body: "Just *one*", format: "org.matrix.custom.html", formatted_body: "Just <em>one</em>" },
                roomId,
                undefined,
                client,
                undefined,
            );

            expect(client.sendMessage).toHaveBeenCalledTimes(1);
            expect(client.sendMessage).toHaveBeenCalledWith(
                roomId,
                null,
                expect.objectContaining({
                    "msgtype": "m.image",
                    "url": "mxc://server/a.jpg",
                    // The caption takes the place of the file name, which moves to `filename`.
                    "body": "Just *one*",
                    "filename": "a.jpg",
                    "format": "org.matrix.custom.html",
                    "formatted_body": "Just <em>one</em>",
                    "m.mentions": {},
                }),
            );
        });

        it("sends the mentions of the caption of a single file as they are", async () => {
            const replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@bob:test",
                room: roomId,
                content: {},
                event: true,
            });
            const mentions = { user_ids: ["@carol:test", "@bob:test"] };

            await contentMessages.sendContentToRoom(
                mkFile("a.jpg"),
                roomId,
                undefined,
                client,
                replyToEvent,
                undefined,
                {
                    "body": "Hi Carol",
                    "m.mentions": mentions,
                },
            );

            const [content] = sentContents();
            expect(content).toEqual(
                expect.objectContaining({ msgtype: "m.image", body: "Hi Carol", filename: "a.jpg" }),
            );
            expect(content["m.mentions"]).toEqual(mentions);
            expect(content["m.relates_to"]).toEqual({ "m.in_reply_to": { event_id: replyToEvent.getId() } });
        });

        it("works out the mentions for the caption of a single file which comes without any", async () => {
            const replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@bob:test",
                room: roomId,
                content: {},
                event: true,
            });

            await contentMessages.sendContentToRoom(
                mkFile("a.jpg"),
                roomId,
                undefined,
                client,
                replyToEvent,
                undefined,
                {
                    body: "Hi",
                },
            );

            const [content] = sentContents();
            expect(content.body).toBe("Hi");
            expect(content["m.mentions"]).toEqual({ user_ids: ["@bob:test"] });
        });

        it("sends a single file without a caption the way it always was", async () => {
            await contentMessages.sendGalleryToRoom([mkFile("a.jpg")], noCaption, roomId, undefined, client, undefined);
            await contentMessages.sendContentToRoom(mkFile("a.jpg"), roomId, undefined, client, undefined);

            const [withEmptyCaption, withoutCaption] = sentContents();
            expect(withEmptyCaption).toEqual(expect.objectContaining({ msgtype: "m.image", body: "a.jpg" }));
            expect(withEmptyCaption).not.toHaveProperty("filename");
            expect(withEmptyCaption).not.toHaveProperty("formatted_body");
            expect(withEmptyCaption).not.toHaveProperty("itemtypes");
            // An empty caption changes nothing about the message.
            expect(withEmptyCaption).toEqual(withoutCaption);
        });

        it("keeps the mentions of the composer for a single file sent without any text", async () => {
            // The composer always works out the mentions, which for a reply name the person replied to.
            await contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg")],
                { "body": "", "m.mentions": { user_ids: ["@bob:test"] } },
                roomId,
                undefined,
                client,
                undefined,
            );

            const [content] = sentContents();
            expect(content).toEqual(expect.objectContaining({ msgtype: "m.image", body: "a.jpg" }));
            expect(content).not.toHaveProperty("filename");
            expect(content["m.mentions"]).toEqual({ user_ids: ["@bob:test"] });
        });

        it("encrypts the items in an encrypted room", async () => {
            vi.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(true);
            const encrypted = { data: new ArrayBuffer(8), info: {} as IEncryptedFile };
            const encryptAttachment = vi.mocked(encrypt.encryptAttachment);
            encryptAttachment.mockClear();
            encryptAttachment.mockResolvedValueOnce(encrypted).mockResolvedValueOnce(encrypted);
            vi.mocked(client.uploadContent).mockResolvedValueOnce({ content_uri: "mxc://server/first" });
            vi.mocked(client.uploadContent).mockResolvedValueOnce({ content_uri: "mxc://server/second" });

            await contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg"), mkFile("b.jpg")],
                noCaption,
                roomId,
                undefined,
                client,
                undefined,
            );

            expect(encrypt.encryptAttachment).toHaveBeenCalledTimes(2);
            const [content] = sentContents();
            expect(content.itemtypes).toHaveLength(2);
            for (const item of content.itemtypes as GalleryItem[]) {
                expect(item.url).toBeUndefined();
                expect(item.file?.url).toMatch(/^mxc:\/\/server\/(first|second)$/);
            }
            expect(new Set(content.itemtypes.map((item: GalleryItem) => item.file!.url)).size).toBe(2);
        });

        it("leaves a file which is not an image after all out of the gallery and sends it as a file", async () => {
            const files = [mkFile("a.jpg"), mkFile("broken.jpg"), mkFile("c.jpg")];

            await contentMessages.sendGalleryToRoom(files, { body: "Caption" }, roomId, undefined, client, undefined);

            const contents = sentContents();
            expect(contents).toHaveLength(2);
            expect(contents[0].msgtype).toBe(GALLERY_MSGTYPE);
            expect(contents[0].body).toBe("Caption");
            expect(contents[0].itemtypes.map((item: GalleryItem) => item.body)).toEqual(["a.jpg", "c.jpg"]);
            // The file follows the gallery, as a message of its own.
            expect(contents[1]).toEqual(
                expect.objectContaining({ msgtype: "m.file", body: "broken.jpg", url: "mxc://server/broken.jpg" }),
            );
        });

        it("shows the upload of all the files as one upload", async () => {
            const uploads = new Map<string, PromiseWithResolvers<UploadResponse>>();
            vi.mocked(client.uploadContent).mockImplementation((file) => {
                const deferred = Promise.withResolvers<UploadResponse>();
                uploads.set((file as File).name, deferred);
                return deferred.promise;
            });
            const files = [mkFile("a.jpg", "image/jpeg", "1"), mkFile("b.jpg", "image/jpeg", "22"), mkFile("c.jpg")];

            const prom = contentMessages.sendGalleryToRoom(files, noCaption, roomId, undefined, client, undefined);

            const currentUploads = contentMessages.getCurrentUploads();
            expect(currentUploads).toHaveLength(1);
            const [upload] = currentUploads;
            expect(upload.roomId).toBe(roomId);
            expect(upload.fileName).toBe("3 items");
            expect(upload.loaded).toBe(0);
            expect(upload.total).toBe(1 + 2 + 7);
            expect(dispatch).toHaveBeenCalledWith({ action: Action.UploadStarted, upload });

            await vi.waitFor(() => expect(client.uploadContent).toHaveBeenCalledTimes(3));
            const progressHandlers = new Map(
                vi.mocked(client.uploadContent).mock.calls.map(([file, opts]) => [(file as File).name, opts!]),
            );
            progressHandlers.get("a.jpg")!.progressHandler!({ loaded: 1, total: 1 });
            expect(upload.loaded).toBe(1);
            expect(upload.total).toBe(10);
            // The total reported by the upload replaces the size of the file.
            progressHandlers.get("c.jpg")!.progressHandler!({ loaded: 5, total: 20 });
            expect(upload.loaded).toBe(6);
            expect(upload.total).toBe(1 + 2 + 20);
            expect(dispatch).toHaveBeenCalledWith({ action: Action.UploadProgress, upload });
            expect(dispatchedActions()).not.toContain(Action.UploadFinished);
            expect(client.sendMessage).not.toHaveBeenCalled();

            for (const [name, deferred] of uploads) deferred.resolve({ content_uri: `mxc://server/${name}` });
            await prom;

            expect(dispatch).toHaveBeenCalledWith({ action: Action.UploadFinished, upload });
            expect(contentMessages.getCurrentUploads()).toHaveLength(0);
            expect(client.sendMessage).toHaveBeenCalledTimes(1);
        });

        it("shows the upload in the thread the gallery is sent to", async () => {
            const relation = { rel_type: RelationType.Thread, event_id: "$thread" };
            const deferred = Promise.withResolvers<UploadResponse>();
            vi.mocked(client.uploadContent).mockReturnValue(deferred.promise);

            const prom = contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg"), mkFile("b.jpg")],
                noCaption,
                roomId,
                relation,
                client,
                undefined,
            );

            expect(contentMessages.getCurrentUploads(relation)).toHaveLength(1);
            expect(contentMessages.getCurrentUploads()).toHaveLength(0);
            deferred.resolve({ content_uri: "mxc://server/file" });
            await prom;
        });

        it("sends nothing when the upload is cancelled", async () => {
            const deferred = Promise.withResolvers<UploadResponse>();
            vi.mocked(client.uploadContent).mockReturnValue(deferred.promise);

            const prom = contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg"), mkFile("b.jpg"), mkFile("c.jpg")],
                noCaption,
                roomId,
                undefined,
                client,
                undefined,
            );
            await vi.waitFor(() => expect(client.uploadContent).toHaveBeenCalledTimes(3));
            const [upload] = contentMessages.getCurrentUploads();

            contentMessages.cancelUpload(upload);

            // One cancellation stops the upload of every file.
            for (const [, opts] of vi.mocked(client.uploadContent).mock.calls) {
                expect(opts!.abortController!.signal.aborted).toBe(true);
            }
            expect(contentMessages.getCurrentUploads()).toHaveLength(0);
            deferred.resolve({ content_uri: "mxc://server/file" });
            await prom;

            expect(client.sendMessage).not.toHaveBeenCalled();
            expect(dialogCalls(QuestionDialog)).toHaveLength(0);
            expect(dispatchedActions()).toContain(Action.UploadCanceled);
            expect(dispatchedActions()).not.toContain(Action.UploadFailed);
            expect(dispatchedActions()).not.toContain(Action.UploadFinished);
        });

        it("offers to retry a failed upload and only uploads what is missing", async () => {
            let failures = 1;
            vi.mocked(client.uploadContent).mockImplementation(async (file) => {
                const { name } = file as File;
                if (name === "b.jpg" && failures-- > 0) throw new Error("network down");
                return { content_uri: `mxc://server/${name}` };
            });
            retryAnswers = [true];

            await contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg"), mkFile("b.jpg"), mkFile("c.jpg")],
                noCaption,
                roomId,
                undefined,
                client,
                undefined,
            );

            expect(dialogCalls(QuestionDialog)).toEqual([
                [
                    QuestionDialog,
                    {
                        title: _t("upload_failed_title"),
                        description: _t("gallery|upload_failed", { count: 1 }),
                        button: _t("action|retry"),
                    },
                ],
            ]);
            expect(dispatchedActions()).toContain(Action.UploadFailed);
            // The files which went through the first time are not uploaded again.
            expect([...uploadedNames()].sort()).toEqual(["a.jpg", "b.jpg", "b.jpg", "c.jpg"]);
            expect(uploadedNames().at(-1)).toBe("b.jpg");
            // The retry shows as an upload of its own, which finishes.
            expect(dispatchedActions().filter((action) => action === Action.UploadStarted)).toHaveLength(2);
            expect(dispatchedActions().filter((action) => action === Action.UploadFinished)).toHaveLength(1);
            expect(contentMessages.getCurrentUploads()).toHaveLength(0);

            const contents = sentContents();
            expect(contents).toHaveLength(1);
            expect(contents[0].itemtypes.map((item: GalleryItem) => item.url)).toEqual([
                "mxc://server/a.jpg",
                "mxc://server/b.jpg",
                "mxc://server/c.jpg",
            ]);
        });

        it("keeps offering to retry for as long as the upload fails", async () => {
            vi.mocked(client.uploadContent).mockRejectedValue(new Error("network down"));
            retryAnswers = [true, true, false];

            await contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg"), mkFile("b.jpg")],
                noCaption,
                roomId,
                undefined,
                client,
                undefined,
            );

            expect(dialogCalls(QuestionDialog)).toHaveLength(3);
            expect(dialogCalls(QuestionDialog)[0][1].description).toBe(_t("gallery|upload_failed", { count: 2 }));
            expect(client.sendMessage).not.toHaveBeenCalled();
        });

        it("sends nothing when the user gives up after a failed upload", async () => {
            vi.mocked(client.uploadContent).mockRejectedValue(new Error("network down"));
            retryAnswers = [false];

            await contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg"), mkFile("b.jpg")],
                noCaption,
                roomId,
                undefined,
                client,
                undefined,
            );

            expect(dialogCalls(QuestionDialog)).toHaveLength(1);
            expect(client.sendMessage).not.toHaveBeenCalled();
            expect(contentMessages.getCurrentUploads()).toHaveLength(0);
            expect(dispatchedActions()).not.toContain(Action.UploadFinished);
        });

        it("forgets the upload limit when the server says a file is too large", async () => {
            vi.mocked(client.getMediaConfig).mockResolvedValue({ "m.upload.size": 5000 });
            await contentMessages.sendContentListToRoom([], roomId, undefined, undefined, client);
            expect(contentMessages.getUploadLimit()).toBe(5000);
            vi.mocked(client.uploadContent).mockRejectedValue(
                new MatrixError({ errcode: "M_TOO_LARGE", error: "File size limit exceeded" }, 413),
            );

            await contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg"), mkFile("b.jpg")],
                noCaption,
                roomId,
                undefined,
                client,
                undefined,
            );

            // So that the limit is fetched again before the next upload.
            expect(contentMessages.getUploadLimit()).toBeNull();
            expect(client.sendMessage).not.toHaveBeenCalled();
        });

        it("keeps the upload limit when an upload fails for another reason", async () => {
            vi.mocked(client.getMediaConfig).mockResolvedValue({ "m.upload.size": 5000 });
            await contentMessages.sendContentListToRoom([], roomId, undefined, undefined, client);
            vi.mocked(client.uploadContent).mockRejectedValue(new Error("network down"));

            await contentMessages.sendGalleryToRoom(
                [mkFile("a.jpg"), mkFile("b.jpg")],
                noCaption,
                roomId,
                undefined,
                client,
                undefined,
            );

            expect(contentMessages.getUploadLimit()).toBe(5000);
        });

        it("leaves a gallery which fails to send to the timeline", async () => {
            vi.mocked(client.sendMessage).mockRejectedValue(new Error("event too large"));

            await expect(
                contentMessages.sendGalleryToRoom(
                    [mkFile("a.jpg"), mkFile("b.jpg")],
                    noCaption,
                    roomId,
                    undefined,
                    client,
                    undefined,
                ),
            ).resolves.toBeUndefined();

            expect(client.sendMessage).toHaveBeenCalledTimes(1);
            expect(dispatchedActions()).not.toContain("message_sent");
            // No dialog: the unsent message offers to retry where it is shown.
            expect(createDialog).not.toHaveBeenCalled();
        });

        it("splits a gallery which does not fit in one event, with the caption on the first message", async () => {
            let counter = 0;
            vi.mocked(client.uploadContent).mockImplementation(async () => ({
                content_uri: `mxc://server/${counter++}`,
            }));
            // Long file names make for large items: around 3 KB each, of which some 20 fit in an event.
            const names = Array.from(
                { length: 25 },
                (_, index) => `${String(index).padStart(2, "0")}-${"x".repeat(3000)}.jpg`,
            );

            const replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@bob:test",
                room: roomId,
                content: {},
                event: true,
            });
            const mentions = { user_ids: ["@carol:test", "@bob:test"] };

            await contentMessages.sendGalleryToRoom(
                names.map((name) => mkFile(name)),
                {
                    "body": "Too many to fit",
                    "format": "org.matrix.custom.html",
                    "formatted_body": "Too <em>many</em> to fit",
                    "m.mentions": mentions,
                },
                roomId,
                undefined,
                client,
                replyToEvent,
            );

            const contents = sentContents();
            expect(contents.length).toBeGreaterThan(1);
            for (const content of contents) {
                expect(content.msgtype).toBe(GALLERY_MSGTYPE);
                expect(content.itemtypes.length).toBeGreaterThan(0);
                expect(new TextEncoder().encode(JSON.stringify(content)).length).toBeLessThan(65536);
            }
            // Every item is sent once, in order.
            expect(contents.flatMap((content) => content.itemtypes.map((item: GalleryItem) => item.body))).toEqual(
                names,
            );
            expect(contents[0].body).toBe("Too many to fit");
            expect(contents[0].formatted_body).toBe("Too <em>many</em> to fit");
            expect(contents[0]["m.mentions"]).toEqual(mentions);
            for (const content of contents.slice(1)) {
                expect(content.body).toBe("");
                expect(content).not.toHaveProperty("format");
                expect(content).not.toHaveProperty("formatted_body");
                // The people mentioned in the caption are only mentioned once, with the caption.
                expect(content["m.mentions"]).toEqual({ user_ids: ["@bob:test"] });
            }
        });
    });

    describe("editMediaMessage", () => {
        const first: GalleryItem = {
            itemtype: "m.image" as GalleryItem["itemtype"],
            body: "first.jpg",
            url: "mxc://server/first",
            info: { mimetype: "image/jpeg", size: 10 },
        };
        const second: GalleryItem = {
            itemtype: "m.video" as GalleryItem["itemtype"],
            body: "second.mp4",
            url: "mxc://server/second",
            info: { mimetype: "video/mp4", size: 20 },
        };
        /** The caption of the gallery made by `mkGalleryEvent`, as the editor hands it back unchanged. */
        const before: MediaCaption = { body: "Before" };

        function mkGalleryEvent(content: IContent = {}): MatrixEvent {
            return mkEvent({
                type: "m.room.message",
                user: "@userId:matrix.org",
                room: roomId,
                id: "$gallery",
                content: {
                    "msgtype": GALLERY_MSGTYPE,
                    "body": "Before",
                    "itemtypes": [first, second],
                    "m.mentions": { user_ids: ["@bob:test"] },
                    ...content,
                },
                event: true,
            });
        }

        function mkImageEvent(content: IContent = {}): MatrixEvent {
            return mkEvent({
                type: "m.room.message",
                user: "@userId:matrix.org",
                room: roomId,
                id: "$image",
                content: {
                    "msgtype": "m.image",
                    "body": "first.jpg",
                    "url": "mxc://server/first",
                    "info": { mimetype: "image/jpeg", size: 10 },
                    "m.mentions": {},
                    ...content,
                },
                event: true,
            });
        }

        /** The `m.new_content` of the only edit which was sent. */
        function sentNewContent(): IContent {
            expect(client.sendMessage).toHaveBeenCalledTimes(1);
            return sentContents()[0]["m.new_content"] as IContent;
        }

        describe("for a single image or video message", () => {
            it("keeps it an image message when a caption is added", async () => {
                await contentMessages.editMediaMessage(mkImageEvent(), client, [first], { body: "Now with words" });

                expect(client.uploadContent).not.toHaveBeenCalled();
                expect(client.sendMessage).toHaveBeenCalledTimes(1);
                expect(client.sendMessage).toHaveBeenCalledWith(roomId, null, {
                    // The fallback is text: it does not repeat the media.
                    "msgtype": "m.text",
                    "body": "* Now with words",
                    "m.mentions": {},
                    "m.new_content": {
                        "msgtype": "m.image",
                        // The caption takes the body, and the file name moves to `filename`.
                        "body": "Now with words",
                        "filename": "first.jpg",
                        "url": "mxc://server/first",
                        "info": { mimetype: "image/jpeg", size: 10 },
                        "m.mentions": {},
                    },
                    "m.relates_to": { rel_type: "m.replace", event_id: "$image" },
                });
                expect(dispatchedActions()).toContain("message_sent");
            });

            it("sends the formatting of the caption as the editor made it", async () => {
                // Not markdown to this code: the text is not rendered again here.
                const caption: MediaCaption = {
                    body: "Now in **bold**",
                    format: "org.matrix.custom.html",
                    formatted_body: "Now in <b>bold</b>, the editor's way",
                };

                await contentMessages.editMediaMessage(mkImageEvent(), client, [first], caption);

                expect(sentNewContent()).toEqual(
                    expect.objectContaining({
                        msgtype: "m.image",
                        body: "Now in **bold**",
                        format: "org.matrix.custom.html",
                        formatted_body: "Now in <b>bold</b>, the editor's way",
                        filename: "first.jpg",
                    }),
                );
            });

            it("does not render markdown in a caption which comes without formatting", async () => {
                await contentMessages.editMediaMessage(mkImageEvent(), client, [first], { body: "Now in **bold**" });

                const newContent = sentNewContent();
                expect(newContent.body).toBe("Now in **bold**");
                expect(newContent).not.toHaveProperty("format");
                expect(newContent).not.toHaveProperty("formatted_body");
            });

            it("changes the caption of a captioned image", async () => {
                const event = mkImageEvent({ body: "Look", filename: "first.jpg" });

                await contentMessages.editMediaMessage(event, client, [first], { body: "Look again" });

                expect(sentContents()[0].body).toBe("* Look again");
                expect(sentNewContent()).toEqual(
                    expect.objectContaining({ msgtype: "m.image", body: "Look again", filename: "first.jpg" }),
                );
            });

            it("goes back to the file name as the body when the caption is removed", async () => {
                const event = mkImageEvent({ body: "Look", filename: "first.jpg" });

                await contentMessages.editMediaMessage(event, client, [first], noCaption);

                // The fallback names the file, as there is no text to show.
                expect(sentContents()[0].body).toBe("* first.jpg");
                expect(sentNewContent()).toEqual({
                    "msgtype": "m.image",
                    "body": "first.jpg",
                    "url": "mxc://server/first",
                    "info": { mimetype: "image/jpeg", size: 10 },
                    "m.mentions": {},
                });
            });

            it("becomes a gallery when an item is added", async () => {
                const added = mkFile("added.jpg");

                await contentMessages.editMediaMessage(mkImageEvent(), client, [first, added], { body: "Two now" });

                expect(uploadedNames()).toEqual(["added.jpg"]);
                expect(sentContents()[0].body).toBe("* Two now");
                expect(sentNewContent()).toEqual({
                    "msgtype": GALLERY_MSGTYPE,
                    "body": "Two now",
                    "itemtypes": [
                        first,
                        expect.objectContaining({
                            itemtype: "m.image",
                            body: "added.jpg",
                            url: "mxc://server/added.jpg",
                        }),
                    ],
                    "m.mentions": {},
                });
            });

            it("becomes a gallery without a caption when an item is added and nothing is written", async () => {
                await contentMessages.editMediaMessage(mkImageEvent(), client, [first, mkFile("added.jpg")], noCaption);

                // The fallback describes the gallery, as there is no text to show.
                expect(sentContents()[0].body).toBe("* Gallery with 2 items");
                const newContent = sentNewContent();
                expect(newContent.msgtype).toBe(GALLERY_MSGTYPE);
                expect(newContent.body).toBe("");
                expect(newContent.itemtypes).toHaveLength(2);
            });

            it("stays a single message of the new file when the image is swapped for another", async () => {
                const replacement = mkFile("other.jpg");

                await contentMessages.editMediaMessage(mkImageEvent(), client, [replacement], noCaption);

                const newContent = sentNewContent();
                expect(newContent).toEqual(
                    expect.objectContaining({ msgtype: "m.image", body: "other.jpg", url: "mxc://server/other.jpg" }),
                );
                expect(newContent).not.toHaveProperty("itemtypes");
                expect(newContent).not.toHaveProperty("filename");
            });

            it("becomes a video message when the image is swapped for a video", async () => {
                const replacement = mkFile("clip.mp4", "video/mp4");

                await contentMessages.editMediaMessage(mkImageEvent(), client, [replacement], { body: "Watch" });

                expect(sentNewContent()).toEqual(
                    expect.objectContaining({ msgtype: "m.video", body: "Watch", filename: "clip.mp4" }),
                );
            });

            it("becomes a text message when the image is removed and text is left", async () => {
                const caption: MediaCaption = {
                    body: "Only *words* now",
                    format: "org.matrix.custom.html",
                    formatted_body: "Only <em>words</em> now",
                };

                await contentMessages.editMediaMessage(mkImageEvent(), client, [], caption);

                expect(client.uploadContent).not.toHaveBeenCalled();
                expect(sentContents()[0].body).toBe("* Only *words* now");
                expect(sentNewContent()).toEqual({
                    "msgtype": "m.text",
                    "body": "Only *words* now",
                    "format": "org.matrix.custom.html",
                    "formatted_body": "Only <em>words</em> now",
                    "m.mentions": {},
                });
            });

            it("sends nothing when the image is removed and no text is left", async () => {
                await contentMessages.editMediaMessage(mkImageEvent(), client, [], noCaption);

                expect(client.sendMessage).not.toHaveBeenCalled();
            });

            it("sends nothing when nothing was changed", async () => {
                // The body of an image without a caption is its file name, which is not a caption.
                await contentMessages.editMediaMessage(mkImageEvent(), client, [first], noCaption);

                expect(client.sendMessage).not.toHaveBeenCalled();
                expect(client.uploadContent).not.toHaveBeenCalled();
            });

            it("sends nothing when the caption of a captioned image was not changed", async () => {
                const event = mkImageEvent({
                    body: "Look",
                    format: "org.matrix.custom.html",
                    formatted_body: "<b>Look</b>",
                    filename: "first.jpg",
                });

                await contentMessages.editMediaMessage(event, client, [first], {
                    body: "Look",
                    format: "org.matrix.custom.html",
                    formatted_body: "<b>Look</b>",
                });

                expect(client.sendMessage).not.toHaveBeenCalled();
            });

            it("sends an edit when only the formatting of the caption changed", async () => {
                const event = mkImageEvent({
                    body: "Look",
                    format: "org.matrix.custom.html",
                    formatted_body: "<b>Look</b>",
                    filename: "first.jpg",
                });

                await contentMessages.editMediaMessage(event, client, [first], { body: "Look" });

                const newContent = sentNewContent();
                expect(newContent.body).toBe("Look");
                expect(newContent).not.toHaveProperty("formatted_body");
            });

            it.each([
                ["a text message", { msgtype: "m.text", body: "Hello", url: undefined }],
                ["a file", { msgtype: "m.file", body: "a.pdf" }],
                ["an image without media", { url: undefined }],
            ])("does nothing for %s", async (_name, content) => {
                await contentMessages.editMediaMessage(mkImageEvent(content), client, [mkFile("added.jpg")], {
                    body: "Changed",
                });

                expect(client.uploadContent).not.toHaveBeenCalled();
                expect(client.sendMessage).not.toHaveBeenCalled();
            });
        });

        it("sends nothing when nothing was changed", async () => {
            await contentMessages.editMediaMessage(mkGalleryEvent(), client, [first, second], before);

            expect(client.sendMessage).not.toHaveBeenCalled();
            expect(client.uploadContent).not.toHaveBeenCalled();
        });

        it("sends nothing when a gallery without a caption was not changed", async () => {
            await contentMessages.editMediaMessage(mkGalleryEvent({ body: "" }), client, [first, second], noCaption);

            expect(client.sendMessage).not.toHaveBeenCalled();
        });

        it("sends nothing when every item and the caption were removed", async () => {
            await contentMessages.editMediaMessage(mkGalleryEvent(), client, [], noCaption);

            expect(client.sendMessage).not.toHaveBeenCalled();
        });

        it("becomes a text message when every item is removed and the caption is kept", async () => {
            await contentMessages.editMediaMessage(mkGalleryEvent(), client, [], before);

            expect(sentContents()[0].body).toBe("* Before");
            expect(sentNewContent()).toEqual({
                "msgtype": "m.text",
                "body": "Before",
                // Whoever the gallery mentioned is still mentioned.
                "m.mentions": { user_ids: ["@bob:test"] },
            });
        });

        it("becomes an image or video message when only one item is left", async () => {
            await contentMessages.editMediaMessage(mkGalleryEvent(), client, [second], { body: "After" });

            expect(client.uploadContent).not.toHaveBeenCalled();
            expect(client.sendMessage).toHaveBeenCalledTimes(1);
            expect(client.sendMessage).toHaveBeenCalledWith(roomId, null, {
                "msgtype": "m.text",
                "body": "* After",
                "m.mentions": {},
                "m.new_content": {
                    "msgtype": "m.video",
                    "body": "After",
                    "filename": "second.mp4",
                    "url": "mxc://server/second",
                    "info": { mimetype: "video/mp4", size: 20 },
                    "m.mentions": { user_ids: ["@bob:test"] },
                },
                "m.relates_to": { rel_type: "m.replace", event_id: "$gallery" },
            });
            expect(dispatchedActions()).toContain("message_sent");
        });

        it("names the one item which is left after its file when there is no caption", async () => {
            await contentMessages.editMediaMessage(mkGalleryEvent(), client, [first], noCaption);

            expect(sentContents()[0].body).toBe("* first.jpg");
            const newContent = sentNewContent();
            expect(newContent).toEqual(expect.objectContaining({ msgtype: "m.image", body: "first.jpg" }));
            expect(newContent).not.toHaveProperty("filename");
            expect(newContent).not.toHaveProperty("itemtypes");
        });

        it("stays a gallery when an item is removed and several are left", async () => {
            const third: GalleryItem = { ...first, body: "third.jpg", url: "mxc://server/third" };
            const event = mkGalleryEvent({ itemtypes: [first, second, third] });

            await contentMessages.editMediaMessage(event, client, [first, third], before);

            expect(client.sendMessage).toHaveBeenCalledWith(roomId, null, {
                // The fallback is text: repeating the items would halve how many fit in the event.
                "msgtype": "m.text",
                "body": "* Before",
                "m.mentions": {},
                "m.new_content": {
                    "msgtype": GALLERY_MSGTYPE,
                    "body": "Before",
                    "itemtypes": [first, third],
                    "m.mentions": { user_ids: ["@bob:test"] },
                },
                "m.relates_to": { rel_type: "m.replace", event_id: "$gallery" },
            });
        });

        it("sends an edit when only the caption changed", async () => {
            const caption: MediaCaption = {
                body: "Now in **bold**",
                format: "org.matrix.custom.html",
                formatted_body: "Now in <strong>bold</strong>",
            };

            await contentMessages.editMediaMessage(mkGalleryEvent(), client, [first, second], caption);

            expect(sentNewContent()).toEqual({
                "msgtype": GALLERY_MSGTYPE,
                "body": "Now in **bold**",
                "format": "org.matrix.custom.html",
                "formatted_body": "Now in <strong>bold</strong>",
                "itemtypes": [first, second],
                "m.mentions": { user_ids: ["@bob:test"] },
            });
        });

        it("describes the gallery in the fallback when the caption is removed", async () => {
            await contentMessages.editMediaMessage(mkGalleryEvent(), client, [first, second], noCaption);

            const [content] = sentContents();
            expect(content.body).toBe("* Gallery with 2 items");
            expect(content["m.new_content"].body).toBe("");
            expect(content["m.new_content"]).not.toHaveProperty("formatted_body");
        });

        describe("mentions", () => {
            it("mentions who the caption mentions, in place of who the message mentioned", async () => {
                const caption: MediaCaption = { "body": "After", "m.mentions": { user_ids: ["@carol:test"] } };

                await contentMessages.editMediaMessage(mkGalleryEvent(), client, [first, second], caption);

                expect(sentNewContent()["m.mentions"]).toEqual({ user_ids: ["@carol:test"] });
            });

            it("mentions nobody when the caption says that it mentions nobody", async () => {
                const caption: MediaCaption = { "body": "After", "m.mentions": {} };

                await contentMessages.editMediaMessage(mkGalleryEvent(), client, [first, second], caption);

                expect(sentNewContent()["m.mentions"]).toEqual({});
            });

            it("keeps the mentions of the message when the caption comes without any", async () => {
                await contentMessages.editMediaMessage(mkGalleryEvent(), client, [first, second], { body: "After" });

                expect(sentNewContent()["m.mentions"]).toEqual({ user_ids: ["@bob:test"] });
            });

            it("sets empty mentions when neither the caption nor the message has any", async () => {
                const event = mkGalleryEvent({ "m.mentions": undefined });

                await contentMessages.editMediaMessage(event, client, [first, second], { body: "After" });

                expect(sentNewContent()["m.mentions"]).toEqual({});
            });

            it("notifies only the people who are newly mentioned", async () => {
                const caption: MediaCaption = {
                    "body": "After",
                    "m.mentions": { user_ids: ["@bob:test", "@carol:test"] },
                };

                await contentMessages.editMediaMessage(mkGalleryEvent(), client, [first, second], caption, {
                    user_ids: ["@carol:test"],
                });

                const [content] = sentContents();
                expect(content["m.mentions"]).toEqual({ user_ids: ["@carol:test"] });
                expect(content["m.new_content"]["m.mentions"]).toEqual({ user_ids: ["@bob:test", "@carol:test"] });
            });

            it("notifies nobody about the edit unless told who is newly mentioned", async () => {
                const caption: MediaCaption = { "body": "After", "m.mentions": { user_ids: ["@carol:test"] } };

                await contentMessages.editMediaMessage(mkGalleryEvent(), client, [first, second], caption);

                expect(sentContents()[0]["m.mentions"]).toEqual({});
            });
        });

        it("uploads the files which were added and keeps the items in the order they were given", async () => {
            const added = mkFile("added.jpg", "image/jpeg", "new");

            await contentMessages.editMediaMessage(mkGalleryEvent(), client, [first, added, second], before);

            expect(uploadedNames()).toEqual(["added.jpg"]);
            const [content] = sentContents();
            expect(content["m.relates_to"]).toEqual({ rel_type: "m.replace", event_id: "$gallery" });
            expect(content["m.new_content"].itemtypes).toEqual([
                first,
                {
                    itemtype: "m.image",
                    body: "added.jpg",
                    url: "mxc://server/added.jpg",
                    info: expect.objectContaining({ size: 3, mimetype: "image/jpeg" }),
                },
                second,
            ]);
        });

        it("sends an edit when one item was swapped for another, though the number of items is the same", async () => {
            const added = mkFile("added.jpg");

            await contentMessages.editMediaMessage(mkGalleryEvent(), client, [first, added], before);

            expect(sentNewContent().itemtypes).toEqual([
                first,
                expect.objectContaining({ body: "added.jpg", url: "mxc://server/added.jpg" }),
            ]);
        });

        it("leaves out a file which turns out not to be an image", async () => {
            const broken = mkFile("broken.jpg");

            await contentMessages.editMediaMessage(mkGalleryEvent(), client, [first, second, broken], {
                body: "After",
            });

            expect(sentNewContent()).toEqual(expect.objectContaining({ body: "After", itemtypes: [first, second] }));
        });

        it("shows the upload of the added files as one upload, and sends once it is done", async () => {
            const deferred = Promise.withResolvers<UploadResponse>();
            vi.mocked(client.uploadContent).mockReturnValue(deferred.promise);
            const items = [first, second, mkFile("added.jpg"), mkFile("another.jpg")];

            const prom = contentMessages.editMediaMessage(mkGalleryEvent(), client, items, before);

            await vi.waitFor(() => expect(client.uploadContent).toHaveBeenCalledTimes(2));
            expect(contentMessages.getCurrentUploads()).toHaveLength(1);
            expect(client.sendMessage).not.toHaveBeenCalled();

            deferred.resolve({ content_uri: "mxc://server/added" });
            await prom;

            expect(contentMessages.getCurrentUploads()).toHaveLength(0);
            expect(dispatchedActions()).toEqual(
                expect.arrayContaining([Action.UploadStarted, Action.UploadFinished, "message_sent"]),
            );
            expect(sentNewContent().itemtypes).toHaveLength(4);
        });

        it("sends the edit to the thread the gallery is in", async () => {
            const threadRelation = { rel_type: RelationType.Thread, event_id: "$root" };
            const event = mkGalleryEvent({ "m.relates_to": threadRelation });
            const added = mkFile("added.jpg");
            const deferred = Promise.withResolvers<UploadResponse>();
            vi.mocked(client.uploadContent).mockReturnValue(deferred.promise);

            const prom = contentMessages.editMediaMessage(event, client, [first, second, added], before);

            // The progress of the upload is shown in the thread too.
            await vi.waitFor(() => expect(client.uploadContent).toHaveBeenCalledTimes(1));
            expect(contentMessages.getCurrentUploads(threadRelation)).toHaveLength(1);
            expect(contentMessages.getCurrentUploads()).toHaveLength(0);
            deferred.resolve({ content_uri: "mxc://server/added" });
            await prom;

            expect(client.sendMessage).toHaveBeenCalledWith(
                roomId,
                "$root",
                expect.objectContaining({ "m.relates_to": { rel_type: "m.replace", event_id: "$gallery" } }),
            );
        });

        it("sends no edit when the upload of an added file is cancelled", async () => {
            const deferred = Promise.withResolvers<UploadResponse>();
            vi.mocked(client.uploadContent).mockReturnValue(deferred.promise);

            const prom = contentMessages.editMediaMessage(
                mkGalleryEvent(),
                client,
                [first, second, mkFile("added.jpg")],
                before,
            );
            await vi.waitFor(() => expect(client.uploadContent).toHaveBeenCalledTimes(1));
            contentMessages.cancelUpload(contentMessages.getCurrentUploads()[0]);
            deferred.reject(new Error("aborted"));
            await prom;

            expect(client.sendMessage).not.toHaveBeenCalled();
            // The user cancelled: there is nothing to ask them.
            expect(dialogCalls(QuestionDialog)).toHaveLength(0);
            expect(contentMessages.getCurrentUploads()).toHaveLength(0);
        });

        it("sends no edit when the upload of an added file fails and the user gives up", async () => {
            vi.mocked(client.uploadContent).mockRejectedValue(new Error("network down"));
            retryAnswers = [false];

            await contentMessages.editMediaMessage(
                mkGalleryEvent(),
                client,
                [first, second, mkFile("added.jpg")],
                before,
            );

            expect(dialogCalls(QuestionDialog)).toHaveLength(1);
            expect(client.sendMessage).not.toHaveBeenCalled();
        });

        it("uploads again the file which failed when the user retries, then sends the edit", async () => {
            vi.mocked(client.uploadContent)
                .mockRejectedValueOnce(new Error("network down"))
                .mockResolvedValueOnce({ content_uri: "mxc://server/added" });
            retryAnswers = [true];

            await contentMessages.editMediaMessage(
                mkGalleryEvent(),
                client,
                [first, second, mkFile("added.jpg")],
                before,
            );

            expect(uploadedNames()).toEqual(["added.jpg", "added.jpg"]);
            expect(dialogCalls(QuestionDialog)).toHaveLength(1);
            expect(sentNewContent().itemtypes).toEqual([
                first,
                second,
                expect.objectContaining({ body: "added.jpg", url: "mxc://server/added" }),
            ]);
        });

        it("leaves an edit which fails to send to the timeline", async () => {
            vi.mocked(client.sendMessage).mockRejectedValue(new Error("event too large"));

            await expect(
                contentMessages.editMediaMessage(mkGalleryEvent(), client, [first, second], { body: "After" }),
            ).resolves.toBeUndefined();

            expect(client.sendMessage).toHaveBeenCalledTimes(1);
            expect(dispatchedActions()).not.toContain("message_sent");
        });

        it("does nothing for an event which has not been sent to a room", async () => {
            const event = mkGalleryEvent();
            vi.spyOn(event, "getRoomId").mockReturnValue(undefined);

            await contentMessages.editMediaMessage(event, client, [first, mkFile("added.jpg")], { body: "After" });

            expect(createDialog).not.toHaveBeenCalled();
            expect(client.uploadContent).not.toHaveBeenCalled();
            expect(client.sendMessage).not.toHaveBeenCalled();
        });

        it("does nothing for an event without an ID", async () => {
            const event = mkGalleryEvent();
            vi.spyOn(event, "getId").mockReturnValue(undefined);

            await contentMessages.editMediaMessage(event, client, [first], { body: "After" });

            expect(client.sendMessage).not.toHaveBeenCalled();
        });
    });
});
