/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IContent } from "matrix-js-sdk/src/matrix";

import { attachMentions } from "../../../src/utils/messages";
import EditorModel from "../../../src/editor/model";
import { mkEvent } from "../../test-utils";
import { createPartCreator } from "../editor/mock";

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
