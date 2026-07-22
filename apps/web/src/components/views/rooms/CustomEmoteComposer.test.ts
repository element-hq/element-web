/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { mkEvent } from "test-utils";
import { type RoomMessageTextEventContent } from "matrix-js-sdk/src/types";

import { createEditContent } from "./EditMessageComposer";
import { createMessageContent } from "./SendMessageComposer";
import { createPartCreator } from "../../../editor/__mocks__";
import EditorModel from "../../../editor/model";
import { type CustomEmote, type ResolvedImagePack } from "../../../custom-emotes";

const pack: ResolvedImagePack = {
    roomId: "!room:example.org",
    stateKey: "pack",
    displayName: "Pack",
    source: "room",
    content: { images: {} },
};
const emote: CustomEmote = {
    shortcode: "wave",
    url: "mxc://example.org/wave",
    body: "A wave",
    pack,
    packSlug: "pack",
    sendToken: ":wave:",
};

describe("legacy composer custom emotes", () => {
    it("automatically resolves a typed unique shortcode", () => {
        const partCreator = createPartCreator();
        const model = new EditorModel([partCreator.plain(":wave:")], partCreator);
        const content = createMessageContent("@alice:example.org", model, undefined, undefined, [emote]);

        expect(content.body).toBe(":wave:");
        expect((content as RoomMessageTextEventContent).formatted_body).toContain("data-mx-emoticon");
    });

    it("sends a selected custom emote with a plaintext shortcode fallback", () => {
        const partCreator = createPartCreator();
        const model = new EditorModel(
            [partCreator.plain("Hello "), partCreator.customEmote("wave", "mxc://example.org/wave", "A wave")],
            partCreator,
        );
        const content = createMessageContent("@alice:example.org", model, undefined, undefined);
        const textContent = content as RoomMessageTextEventContent;

        expect(content.body).toBe("Hello :wave:");
        expect(textContent.formatted_body).toContain(
            '<img data-mx-emoticon src="mxc://example.org/wave" alt="A wave" title="wave" height="32" />',
        );
    });

    it("preserves a selected custom emote in replacement content", () => {
        const partCreator = createPartCreator();
        const model = new EditorModel(
            [partCreator.customEmote("wave", "mxc://example.org/wave", "A wave")],
            partCreator,
        );
        const editedEvent = mkEvent({
            event: true,
            type: "m.room.message",
            room: "!room:example.org",
            user: "@alice:example.org",
            content: { msgtype: "m.text", body: "old" },
        });
        editedEvent.sender = { userId: "@alice:example.org" } as typeof editedEvent.sender;

        const content = createEditContent(model, editedEvent);
        const textContent = content as RoomMessageTextEventContent & { "m.new_content": RoomMessageTextEventContent };
        expect(content.body).toBe("* :wave:");
        expect(textContent.formatted_body).toContain("data-mx-emoticon");
        expect(textContent["m.new_content"].body).toBe(":wave:");
        expect(textContent["m.new_content"].formatted_body).toContain('src="mxc://example.org/wave"');
    });
});
