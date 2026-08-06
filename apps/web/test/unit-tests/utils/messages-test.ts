/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IContent } from "matrix-js-sdk/src/matrix";
import { type MessageComposerUrlPreviewSnapshot } from "@element-hq/web-shared-components";

import { attachMentions, attachUrlPreviews } from "../../../src/utils/messages";
import EditorModel from "../../../src/editor/model";
import { mkEvent } from "../../test-utils";
import { createPartCreator } from "../editor/mock";
import { type RoomMessageEventContent } from "../../../@types/url-preview";
import SettingsStore from "../../../src/settings/SettingsStore";

describe("attachUrlPreviews", () => {
    beforeEach(() => {
        const original = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation(
            (setting) => setting === "feature_msc4095_url_preview_bundle" || original(setting),
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

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
        content: "https://example.com",
    });

    it("does nothing when there are no previews", () => {
        const content = makeContent();
        attachUrlPreviews({ previews: [], content: "" }, content);
        expect(content["com.beeper.linkpreviews"]).toBeUndefined();
    });

    it("attaches a preview with no image", () => {
        const content = makeContent();
        attachUrlPreviews(snapshot(), content);
        expect(content["com.beeper.linkpreviews"]).toEqual([
            expect.objectContaining({ "og:title": "Example", "og:image": undefined }),
        ]);
    });

    it("embeds the mxc url from the preview image", () => {
        const content = makeContent();
        attachUrlPreviews(
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

    describe("pills which the message does not end up linking to", () => {
        // The body is built before attachMentions runs, so these are the contents the composer
        // really hands it in each case.
        const model = (): EditorModel => new EditorModel([partsCreator.userPill("Bob", "@bob:test")], partsCreator);

        it("does not mention someone whose pill is inside a code block", () => {
            const content: IContent = {
                format: "org.matrix.custom.html",
                formatted_body: "<pre><code>[Bob](https://matrix.to/#/@bob:test)\n</code></pre>",
            };

            attachMentions("@alice:test", content, model(), undefined);

            expect(content["m.mentions"]).toEqual({});
        });

        it("does not mention someone whose pill was flattened into a spoiler", () => {
            const content: IContent = {
                format: "org.matrix.custom.html",
                formatted_body: "<span data-mx-spoiler>Bob</span>",
            };

            attachMentions("@alice:test", content, model(), undefined);

            expect(content["m.mentions"]).toEqual({});
        });

        it("still mentions someone the message links to", () => {
            const content: IContent = {
                format: "org.matrix.custom.html",
                formatted_body: '<a href="https://matrix.to/#/@bob:test">Bob</a>',
            };

            attachMentions("@alice:test", content, model(), undefined);

            expect(content["m.mentions"]).toEqual({ user_ids: ["@bob:test"] });
        });

        it("mentions someone pilled twice when only one of the two is in a code block", () => {
            const content: IContent = {
                format: "org.matrix.custom.html",
                formatted_body:
                    '<a href="https://matrix.to/#/@bob:test">Bob</a>' +
                    "<pre><code>[Bob](https://matrix.to/#/@bob:test)\n</code></pre>",
            };

            attachMentions("@alice:test", content, model(), undefined);

            expect(content["m.mentions"]).toEqual({ user_ids: ["@bob:test"] });
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
