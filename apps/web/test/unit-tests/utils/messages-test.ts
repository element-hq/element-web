/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type IContent } from "matrix-js-sdk/src/matrix";
import { type MessageComposerUrlPreviewSnapshot } from "@element-hq/web-shared-components";
import { mocked } from "jest-mock";

import { attachMentions, attachUrlPreviews } from "../../../src/utils/messages";
import EditorModel from "../../../src/editor/model";
import { createTestClient, mkEvent } from "../../test-utils";
import { createPartCreator } from "../editor/mock";
import { type RoomMessageEventContent } from "../../../@types/url-preview";
import { uploadFile } from "../../../src/ContentMessages";

jest.mock("../../../src/ContentMessages", () => ({
    uploadFile: jest.fn(),
}));

// Typed mock reference so the mock-only matchers (toHaveBeenCalled etc.) resolve.
const uploadFileMock = mocked(uploadFile);

describe("attachUrlPreviews", () => {
    let client: MatrixClient;
    let fetchMock: jest.Mock;

    const makeContent = (): RoomMessageEventContent =>
        ({ msgtype: "m.text", body: "hi https://example.com" }) as RoomMessageEventContent;

    const snapshot = (image?: object): MessageComposerUrlPreviewSnapshot => ({
        previews: [
            {
                link: "https://example.com",
                showTooltipOnLink: false,
                title: "Example",
                siteName: "example.com",
                description: "desc",
                ...(image ? { image } : {}),
            } as any,
        ],
    });

    beforeEach(() => {
        jest.clearAllMocks();
        client = createTestClient();
        // fake fetch → returns something with a .blob(). Keep the mock reference
        // around so we can assert on it (global.fetch is typed as native fetch).
        fetchMock = jest.fn().mockResolvedValue({
            blob: async () => new Blob(["imgdata"], { type: "image/png" }),
        });
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    it("does nothing when there are no previews", async () => {
        const content = makeContent();
        await attachUrlPreviews(client, "!r:s", { previews: [] }, content);
        expect(content["com.beeper.linkpreviews"]).toBeUndefined();
        expect(uploadFileMock).not.toHaveBeenCalled();
    });

    it("attaches a preview with no image (no fetch/upload)", async () => {
        const content = makeContent();
        await attachUrlPreviews(client, "!r:s", snapshot(), content);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(uploadFileMock).not.toHaveBeenCalled();
        expect(content["com.beeper.linkpreviews"]).toEqual([
            expect.objectContaining({ "og:title": "Example", "og:image": undefined }),
        ]);
    });

    it("fetches + uploads the image, embeds the mxc url", async () => {
        uploadFileMock.mockResolvedValue({ url: "mxc://server/img" });
        const content = makeContent();
        await attachUrlPreviews(
            client,
            "!r:s",
            snapshot({
                imageThumb: "",
                imageFull: "https://example.com/full.png",
                imageType: "image/png",
                fileSize: 1234,
                width: 100,
                height: 50,
                playable: false,
            }),
            content,
        );

        expect(fetchMock).toHaveBeenCalledWith("https://example.com/full.png");
        expect(uploadFileMock).toHaveBeenCalledWith(client, "!r:s", expect.any(Blob));
        expect(content["com.beeper.linkpreviews"]![0]).toEqual(
            expect.objectContaining({
                "og:image": "mxc://server/img",
                "og:image:width": 100,
                "og:image:type": "image/png",
                "matrix:image:size": 1234,
            }),
        );
    });

    it("still attaches the preview when upload fails", async () => {
        uploadFileMock.mockRejectedValue(new Error("boom"));
        const content = makeContent();
        await attachUrlPreviews(
            client,
            "!r:s",
            snapshot({ imageThumb: "", imageFull: "https://x/f.png", playable: false }),
            content,
        );
        // error is swallowed by logger.error → og:image just stays undefined
        expect(content["com.beeper.linkpreviews"]![0]["og:image"]).toBeUndefined();
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
