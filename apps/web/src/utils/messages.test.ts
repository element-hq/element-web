/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { type IContent, EventStatus, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type EncryptedFile } from "matrix-js-sdk/src/types";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestClient, mkEvent, mkRoom, stubClient } from "test-utils";
import { type MessageComposerUrlPreviewSnapshot } from "@element-hq/web-shared-components";
import { type UrlPreview } from "shared-types";
import fetchMock from "@fetch-mock/vitest";

import { attachMentions, attachUrlPreviews } from "./messages";
import EditorModel from "../editor/model";
import { createPartCreator } from "../editor/__mocks__";
import { type RoomMessageEventContent } from "../../@types/url-preview";
import SettingsStore from "../settings/SettingsStore";
import { uploadFile } from "../ContentMessages";

vi.mock("../ContentMessages", () => ({ uploadFile: vi.fn() }));

describe("attachUrlPreviews", () => {
    const mxClient = createTestClient();
    const mxRoom = mkRoom(mxClient, "test-room");

    beforeEach(() => {
        const original = SettingsStore.getValue;
        vi.spyOn(SettingsStore, "getValue").mockImplementation(
            (setting) => setting === "feature_msc4095_url_preview_bundle" || original(setting),
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const makeContent = (): RoomMessageEventContent =>
        ({ msgtype: "m.text", body: "hi https://example.com" }) as RoomMessageEventContent;

    const snapshot = (image?: object): MessageComposerUrlPreviewSnapshot => ({
        entries: [
            {
                status: "loaded",
                matched_url: "https://example.com",
                include: true,
                preview: {
                    link: "https://example.com",
                    showTooltipOnLink: false,
                    title: "Example",
                    siteName: "example.com",
                    description: "desc",
                    ...(image ? { image } : {}),
                } as UrlPreview,
            },
        ],
        content: "https://example.com",
        contentLinks: new Set(["https://example.com"]),
        isModified: false,
    });

    it("does nothing when there are no previews", async () => {
        const content = makeContent();
        await attachUrlPreviews(
            mxClient,
            mxRoom,
            { entries: [], content: "", contentLinks: new Set(), isModified: false },
            content,
            false,
        );
        expect(content["com.beeper.linkpreviews"]).toBeUndefined();
    });

    it("attaches a preview with no image", async () => {
        const content = makeContent();
        await attachUrlPreviews(mxClient, mxRoom, snapshot(), content, true);
        expect(content["com.beeper.linkpreviews"]).toEqual([expect.objectContaining({ "og:title": "Example" })]);
        expect(content["com.beeper.linkpreviews"]![0]["og:image"]).toBeUndefined();
    });

    it("embeds the mxc url from the preview image", async () => {
        const content = makeContent();
        await attachUrlPreviews(
            mxClient,
            mxRoom,
            snapshot({
                imageThumb: "",
                imageFull: "https://example.com/full.png",
                mxcImageFull: "mxc://server/img",
                imageType: "image/png",
                fileSize: 1234,
                width: 100,
                height: 50,
                playable: false,
            }),
            content,
            true,
        );

        expect(content["com.beeper.linkpreviews"]![0]).toEqual(
            expect.objectContaining({
                "og:image": "mxc://server/img",
                "og:image:width": 100,
                "og:image:type": "image/png",
                "matrix:image:size": 1234,
            }),
        );
    });

    it("reuses the bundled EncryptedFile instead of re-uploading when editing in an encrypted room", async () => {
        vi.spyOn(mxRoom, "hasEncryptionStateEvent").mockReturnValue(true);
        // the encrypted path shows a pending event while it uploads
        mxRoom.addPendingEvent = vi.fn();
        mxRoom.updatePendingEvent = vi.fn();
        mxRoom.removePendingEvent = vi.fn();
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const encryptedFile = { url: "mxc://server/encrypted-img" } as unknown as EncryptedFile;

        const content = makeContent();
        await attachUrlPreviews(
            mxClient,
            mxRoom,
            snapshot({
                imageThumb: "blob:http://localhost/thumb",
                imageFull: "blob:http://localhost/full",
                mxcImageFull: "mxc://server/encrypted-img",
                imageType: "image/png",
                width: 100,
                height: 50,
                playable: false,
            }),
            content,
            true,
            new Map([["https://example.com", encryptedFile]]),
        );

        expect(content["com.beeper.linkpreviews"]![0]["beeper:image:encryption"]).toBe(encryptedFile);
        expect(content["com.beeper.linkpreviews"]![0]["og:image"]).toBeUndefined();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("does not attach a bundle when the setting is disabled", async () => {
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        const content = makeContent();
        expect(await attachUrlPreviews(mxClient, mxRoom, snapshot(), content, true)).toBe(false);
        expect(content["com.beeper.linkpreviews"]).toBeUndefined();
    });

    // The bundle only describes links that are in the body, so a body with none gets no bundle even
    // when the composer still had previews loaded.
    it("does not attach a bundle when the message has no links", async () => {
        const content = makeContent();
        await attachUrlPreviews(mxClient, mxRoom, snapshot(), content, false);
        expect(content["com.beeper.linkpreviews"]).toBeUndefined();
    });

    // Removing a preview in the composer clears its `include`, and a preview that never finished
    // loading has nothing to attach.
    it("skips previews that are excluded or still loading", async () => {
        const content = makeContent();
        const snap = snapshot();
        await attachUrlPreviews(
            mxClient,
            mxRoom,
            {
                ...snap,
                entries: [
                    { ...snap.entries[0], include: false },
                    { status: "loading", include: true, matched_url: "https://loading.example.com" },
                    { status: "failed", include: true, matched_url: "https://failed.example.com" },
                ],
            },
            content,
            true,
        );
        expect(content["com.beeper.linkpreviews"]).toEqual([]);
    });

    it("merges additionalBundleContent into the bundle", async () => {
        const content = makeContent();
        const snap = snapshot();
        const entry = snap.entries[0] as { preview: UrlPreview };
        entry.preview.additionalBundleContent = { "og:title": "From the module", "custom:field": 7 };

        await attachUrlPreviews(mxClient, mxRoom, snap, content, true);

        expect(content["com.beeper.linkpreviews"]![0]).toEqual(
            expect.objectContaining({ "og:title": "From the module", "custom:field": 7 }),
        );
    });
});

describe("attachUrlPreviews in an encrypted room", () => {
    const IMAGE_HTTP_URL = "https://server.example.com/_matrix/media/download/img";

    const ENCRYPTED_FILE = {
        url: "mxc://server/encrypted",
        iv: "iv",
        hashes: { sha256: "sha256" },
        v: "v2",
        key: { alg: "A256CTR", ext: true, k: "k", key_ops: ["encrypt", "decrypt"], kty: "oct" },
    } as EncryptedFile;

    const IMAGE = {
        imageThumb: "",
        imageFull: "https://example.com/full.png",
        mxcImageFull: "mxc://server/img",
        imageType: "image/png",
        fileSize: 1234,
        width: 100,
        height: 50,
        playable: false,
    };

    let mxClient: ReturnType<typeof stubClient>;
    let mxRoom: ReturnType<typeof mkRoom>;
    /** The fake "sending" event put in the timeline while the images upload. */
    let pendingEvent: MatrixEvent | undefined;

    beforeEach(() => {
        // The peg is what `mediaFromMxc` resolves the preview image against.
        mxClient = stubClient();
        // eslint-disable-next-line no-restricted-properties
        vi.mocked(mxClient.mxcUrlToHttp).mockReturnValue(IMAGE_HTTP_URL);
        mxClient.makeTxnId = vi.fn().mockReturnValue("txn-1");

        mxRoom = mkRoom(mxClient, "!test-room:example.com");
        vi.mocked(mxRoom.hasEncryptionStateEvent).mockReturnValue(true);
        pendingEvent = undefined;
        mxRoom.addPendingEvent = vi.fn((event: MatrixEvent) => {
            pendingEvent = event;
        });
        mxRoom.updatePendingEvent = vi.fn();
        mxRoom.removePendingEvent = vi.fn();

        const original = SettingsStore.getValue;
        vi.spyOn(SettingsStore, "getValue").mockImplementation(
            (setting) => setting === "feature_msc4095_url_preview_bundle" || original(setting),
        );

        fetchMock.get(IMAGE_HTTP_URL, { body: "image bytes" });
        vi.mocked(uploadFile).mockResolvedValue({ file: ENCRYPTED_FILE });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.mocked(uploadFile).mockReset();
    });

    const makeContent = (): RoomMessageEventContent =>
        ({ msgtype: "m.text", body: "hi https://example.com" }) as RoomMessageEventContent;

    const snapshot = (image?: object): MessageComposerUrlPreviewSnapshot => ({
        entries: [
            {
                status: "loaded",
                matched_url: "https://example.com",
                include: true,
                preview: {
                    link: "https://example.com",
                    showTooltipOnLink: false,
                    title: "Example",
                    siteName: "example.com",
                    description: "desc",
                    ...(image ? { image } : {}),
                } as UrlPreview,
            },
        ],
        content: "https://example.com",
        contentLinks: new Set(["https://example.com"]),
        isModified: false,
    });

    // The homeserver must not be handed the preview image as plaintext, so it is downloaded,
    // re-uploaded encrypted, and referenced by `beeper:image:encryption` instead of `og:image`.
    it("uploads the preview image and references it as an encrypted file", async () => {
        const content = makeContent();
        expect(await attachUrlPreviews(mxClient, mxRoom, snapshot(IMAGE), content, true)).toBe(false);

        expect(fetchMock.callHistory.called(IMAGE_HTTP_URL)).toBe(true);
        expect(uploadFile).toHaveBeenCalledWith(
            mxClient,
            mxRoom.roomId,
            expect.any(Blob),
            undefined,
            expect.any(AbortController),
        );

        const bundled = content["com.beeper.linkpreviews"]![0];
        expect(bundled["beeper:image:encryption"]).toEqual(ENCRYPTED_FILE);
        // The plaintext mxc:// URL must not leak into the bundle.
        expect(bundled["og:image"]).toBeUndefined();
        // The dimensions are not secret and are still needed to size the tile.
        expect(bundled["og:image:width"]).toBe(100);
        expect(bundled["og:image:height"]).toBe(50);
        expect(bundled["og:image:type"]).toBe("image/png");
    });

    // The composer is cleared as soon as the user hits enter, so without a placeholder the message
    // would vanish for as long as the image upload takes.
    it("shows a sending message in the timeline while the image uploads, then removes it", async () => {
        await attachUrlPreviews(mxClient, mxRoom, snapshot(IMAGE), makeContent(), true);

        expect(mxRoom.addPendingEvent).toHaveBeenCalledWith(expect.anything(), "txn-1");
        expect(pendingEvent!.getContent()).toEqual(expect.objectContaining({ body: "hi https://example.com" }));
        expect(pendingEvent!.getRoomId()).toEqual(mxRoom.roomId);
        // ENCRYPTING rather than SENDING, so the tile does not show a send failure.
        expect(mxRoom.updatePendingEvent).toHaveBeenCalledWith(pendingEvent, EventStatus.ENCRYPTING);
        // Once the real message is on its way, the placeholder is gone.
        expect(mxRoom.removePendingEvent).toHaveBeenCalledWith(pendingEvent!.getId());
    });

    // With no image there is nothing to upload, so the send is not delayed and needs no placeholder.
    it("does not show a sending message when no preview has an image", async () => {
        await attachUrlPreviews(mxClient, mxRoom, snapshot(), makeContent(), true);

        expect(mxRoom.addPendingEvent).not.toHaveBeenCalled();
        expect(mxRoom.removePendingEvent).not.toHaveBeenCalled();
        expect(uploadFile).not.toHaveBeenCalled();
    });

    // Cancelling the placeholder means the user no longer wants the message sent at all, so the
    // caller is told to abandon the send rather than going ahead once the upload finishes.
    it("reports the send as cancelled when the pending event is cancelled mid-upload", async () => {
        vi.mocked(uploadFile).mockImplementation(async () => {
            pendingEvent!.setStatus(EventStatus.CANCELLED);
            return { file: ENCRYPTED_FILE };
        });

        const content = makeContent();
        expect(await attachUrlPreviews(mxClient, mxRoom, snapshot(IMAGE), content, true)).toBe(true);
    });

    it("aborts the in-flight upload when the pending event is cancelled", async () => {
        let signal: AbortSignal | undefined;
        vi.mocked(uploadFile).mockImplementation(async (_client, _roomId, _blob, _progress, controller) => {
            signal = controller!.signal;
            pendingEvent!.setStatus(EventStatus.CANCELLED);
            return { file: ENCRYPTED_FILE };
        });

        await attachUrlPreviews(mxClient, mxRoom, snapshot(IMAGE), makeContent(), true);

        expect(signal!.aborted).toBe(true);
    });

    // A status change that is not a cancellation must not abandon the send.
    it("does not report a cancellation for other status changes", async () => {
        vi.mocked(uploadFile).mockImplementation(async () => {
            pendingEvent!.setStatus(EventStatus.SENT);
            return { file: ENCRYPTED_FILE };
        });

        expect(await attachUrlPreviews(mxClient, mxRoom, snapshot(IMAGE), makeContent(), true)).toBe(false);
    });

    // Losing the image is better than losing the message, so the rest of the bundle still goes out.
    it("attaches the preview without an image when the upload returns no encrypted file", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.mocked(uploadFile).mockResolvedValue({ url: "mxc://server/plain" });

        const content = makeContent();
        expect(await attachUrlPreviews(mxClient, mxRoom, snapshot(IMAGE), content, true)).toBe(false);

        const bundled = content["com.beeper.linkpreviews"]![0];
        expect(bundled["beeper:image:encryption"]).toBeUndefined();
        expect(bundled["og:image"]).toBeUndefined();
        expect(bundled["og:title"]).toBe("Example");
        expect(consoleError).toHaveBeenCalled();
    });

    it("attaches the preview without an image when the upload fails", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.mocked(uploadFile).mockRejectedValue(new Error("Forced test failure"));

        const content = makeContent();
        expect(await attachUrlPreviews(mxClient, mxRoom, snapshot(IMAGE), content, true)).toBe(false);

        expect(content["com.beeper.linkpreviews"]![0]["beeper:image:encryption"]).toBeUndefined();
        expect(consoleError).toHaveBeenCalledWith(new Error("Forced test failure"));
    });

    // An abort is the expected outcome of the user cancelling, not something to log.
    it("does not log when the upload fails because the send was cancelled", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.mocked(uploadFile).mockImplementation(async (_client, _roomId, _blob, _progress, controller) => {
            pendingEvent!.setStatus(EventStatus.CANCELLED);
            controller!.abort();
            throw new Error("Upload aborted");
        });

        expect(await attachUrlPreviews(mxClient, mxRoom, snapshot(IMAGE), makeContent(), true)).toBe(true);
        expect(consoleError).not.toHaveBeenCalled();
    });

    it("attaches the preview without an image when the download fails", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        fetchMock.removeRoutes();
        fetchMock.get(IMAGE_HTTP_URL, { throws: new Error("Forced test failure") });

        const content = makeContent();
        await attachUrlPreviews(mxClient, mxRoom, snapshot(IMAGE), content, true);

        expect(content["com.beeper.linkpreviews"]![0]["beeper:image:encryption"]).toBeUndefined();
        expect(uploadFile).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalled();
    });

    // Unencrypted rooms take the plain mxc:// path even though the same code runs.
    it("embeds the plain mxc url when the room is not encrypted", async () => {
        vi.mocked(mxRoom.hasEncryptionStateEvent).mockReturnValue(false);

        const content = makeContent();
        await attachUrlPreviews(mxClient, mxRoom, snapshot(IMAGE), content, true);

        expect(content["com.beeper.linkpreviews"]![0]["og:image"]).toBe("mxc://server/img");
        expect(content["com.beeper.linkpreviews"]![0]["beeper:image:encryption"]).toBeUndefined();
        expect(uploadFile).not.toHaveBeenCalled();
        expect(mxRoom.addPendingEvent).not.toHaveBeenCalled();
    });
});

describe("attachMentions", () => {
    const partsCreator = createPartCreator();

    it("no mentions", () => {
        const model = new EditorModel([], partsCreator);
        const content: IContent = {};
        attachMentions("@alice:test", content, model, undefined);
        expect(content).toEqual({
            "m.mentions": {},
        });
    });

    it("test user mentions", () => {
        const model = new EditorModel([partsCreator.userPill("Bob", "@bob:test")], partsCreator);
        const content: IContent = {};
        attachMentions("@alice:test", content, model, undefined);
        expect(content).toEqual({
            "m.mentions": { user_ids: ["@bob:test"] },
        });
    });

    it("test reply", () => {
        // Replying to an event adds the sender to the list of mentioned users.
        const model = new EditorModel([], partsCreator);
        let replyToEvent = mkEvent({
            type: "m.room.message",
            user: "@bob:test",
            room: "!abc:test",
            content: { "m.mentions": {} },
            event: true,
        });
        let content: IContent = {};
        attachMentions("@alice:test", content, model, replyToEvent);
        expect(content).toEqual({
            "m.mentions": { user_ids: ["@bob:test"] },
        });

        // It no longer adds any other mentioned users
        replyToEvent = mkEvent({
            type: "m.room.message",
            user: "@bob:test",
            room: "!abc:test",
            content: { "m.mentions": { user_ids: ["@alice:test", "@charlie:test"] } },
            event: true,
        });
        content = {};
        attachMentions("@alice:test", content, model, replyToEvent);
        expect(content).toEqual({
            "m.mentions": { user_ids: ["@bob:test"] },
        });
    });

    it("test room mention", () => {
        const model = new EditorModel([partsCreator.atRoomPill("@room")], partsCreator);
        const content: IContent = {};
        attachMentions("@alice:test", content, model, undefined);
        expect(content).toEqual({
            "m.mentions": { room: true },
        });
    });

    it("test reply to room mention", () => {
        // Replying to a room mention shouldn't automatically be a room mention.
        const model = new EditorModel([], partsCreator);
        const replyToEvent = mkEvent({
            type: "m.room.message",
            user: "@alice:test",
            room: "!abc:test",
            content: { "m.mentions": { room: true } },
            event: true,
        });
        const content: IContent = {};
        attachMentions("@alice:test", content, model, replyToEvent);
        expect(content).toEqual({
            "m.mentions": {},
        });
    });

    it("test broken mentions", () => {
        // Replying to a room mention shouldn't automatically be a room mention.
        const model = new EditorModel([], partsCreator);
        const replyToEvent = mkEvent({
            type: "m.room.message",
            user: "@alice:test",
            room: "!abc:test",
            // @ts-ignore - Purposefully testing invalid data.
            content: { "m.mentions": { user_ids: "@bob:test" } },
            event: true,
        });
        const content: IContent = {};
        attachMentions("@alice:test", content, model, replyToEvent);
        expect(content).toEqual({
            "m.mentions": {},
        });
    });

    describe("attachMentions with edit", () => {
        it("no mentions", () => {
            const model = new EditorModel([], partsCreator);
            const content: IContent = { "m.new_content": {} };
            const prevContent: IContent = {};
            attachMentions("@alice:test", content, model, undefined, prevContent);
            expect(content).toEqual({
                "m.mentions": {},
                "m.new_content": { "m.mentions": {} },
            });
        });

        it("mentions do not propagate", () => {
            const model = new EditorModel([], partsCreator);
            const content: IContent = { "m.new_content": {} };
            const prevContent: IContent = {
                "m.mentions": { user_ids: ["@bob:test"], room: true },
            };
            attachMentions("@alice:test", content, model, undefined, prevContent);
            expect(content).toEqual({
                "m.mentions": {},
                "m.new_content": { "m.mentions": {} },
            });
        });

        it("test user mentions", () => {
            const model = new EditorModel([partsCreator.userPill("Bob", "@bob:test")], partsCreator);
            const content: IContent = { "m.new_content": {} };
            const prevContent: IContent = {};
            attachMentions("@alice:test", content, model, undefined, prevContent);
            expect(content).toEqual({
                "m.mentions": { user_ids: ["@bob:test"] },
                "m.new_content": { "m.mentions": { user_ids: ["@bob:test"] } },
            });
        });

        it("test prev user mentions", () => {
            const model = new EditorModel([partsCreator.userPill("Bob", "@bob:test")], partsCreator);
            const content: IContent = { "m.new_content": {} };
            const prevContent: IContent = { "m.mentions": { user_ids: ["@bob:test"] } };
            attachMentions("@alice:test", content, model, undefined, prevContent);
            expect(content).toEqual({
                "m.mentions": {},
                "m.new_content": { "m.mentions": { user_ids: ["@bob:test"] } },
            });
        });

        it("test room mention", () => {
            const model = new EditorModel([partsCreator.atRoomPill("@room")], partsCreator);
            const content: IContent = { "m.new_content": {} };
            const prevContent: IContent = {};
            attachMentions("@alice:test", content, model, undefined, prevContent);
            expect(content).toEqual({
                "m.mentions": { room: true },
                "m.new_content": { "m.mentions": { room: true } },
            });
        });

        it("test prev room mention", () => {
            const model = new EditorModel([partsCreator.atRoomPill("@room")], partsCreator);
            const content: IContent = { "m.new_content": {} };
            const prevContent: IContent = { "m.mentions": { room: true } };
            attachMentions("@alice:test", content, model, undefined, prevContent);
            expect(content).toEqual({
                "m.mentions": {},
                "m.new_content": { "m.mentions": { room: true } },
            });
        });

        it("test broken mentions", () => {
            // Replying to a room mention shouldn't automatically be a room mention.
            const model = new EditorModel([], partsCreator);
            const content: IContent = { "m.new_content": {} };
            // @ts-ignore - Purposefully testing invalid data.
            const prevContent: IContent = { "m.mentions": { user_ids: "@bob:test" } };
            attachMentions("@alice:test", content, model, undefined, prevContent);
            expect(content).toEqual({
                "m.mentions": {},
                "m.new_content": { "m.mentions": {} },
            });
        });
    });
});
