/*
+Copyright 2024 New Vector Ltd.
+Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

+/*
+Copyright 2024 New Vector Ltd.
+Copyright 2022 The Matrix.org Foundation C.I.C.
+
+SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
+Please see LICENSE files in the repository root for full details.
+*/
+
+import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
+import { MsgType } from "matrix-js-sdk/src/matrix";
+import { initOnce } from "@vector-im/matrix-wysiwyg";
+import { type RoomMessageTextEventContent } from "matrix-js-sdk/src/types";
+
+import { filterConsole, mkEvent } from "test-utils";
+import { createMessageContent, EMOTE_PREFIX } from "./createMessageContent";
+import { type CustomEmote, type ResolvedImagePack } from "../../../../../custom-emotes";
+
+beforeAll(initOnce, 10000);
+
+const pack: ResolvedImagePack = {
+    roomId: "!room:example.org",
+    stateKey: "pack",
+    displayName: "Pack",
+    source: "room",
+    content: { images: {} },
+};
+const emote: CustomEmote = {
+    shortcode: "wave",
+    url: "mxc://example.org/wave",
+    body: "A wave",
+    pack,
+    packSlug: "pack",
+    sendToken: ":wave:",
+};
+
+describe("createMessageContent", () => {
+    const message = "<em><b>hello</b> world</em>";
+
+    afterEach(() => {
+        vi.resetAllMocks();
+    });
+
+    describe("Richtext composer input", () => {
+        filterConsole(
+            "WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm`",
+        );
+
+        it("Should create html message", async () => {
+            // When
+            const content = await createMessageContent(message, true, {});
+
+            // Then
+            expect(content).toEqual({
+                body: "*__hello__ world*",
+                format: "org.matrix.custom.html",
+                formatted_body: message,
+                msgtype: "m.text",
+            });
+        });
+
+        it("Should add relation to message", async () => {
+            // When
+            const relation = {
+                rel_type: "m.thread",
+                event_id: "myFakeThreadId",
+            };
+            const content = await createMessageContent(message, true, { relation });
+
+            // Then
+            expect(content).toEqual({
+                "body": "*__hello__ world*",
+                "format": "org.matrix.custom.html",
+                "formatted_body": message,
+                "msgtype": "m.text",
+                "m.relates_to": {
+                    event_id: "myFakeThreadId",
+                    rel_type: "m.thread",
+                },
+            });
+        });
+
+        it("Should add fields related to edition", async () => {
+            // When
+            const editedEvent = mkEvent({
+                type: "m.room.message",
+                room: "myfakeroom",
+                user: "myfakeuser2",
+                content: {
+                    "msgtype": "m.text",
+                    "body": "First message",
+                    "formatted_body": "<b>First Message</b>",
+                    "m.relates_to": {
+                        "m.in_reply_to": {
+                            event_id: "eventId",
+                        },
+                    },
+                },
+                event: true,
+            });
+            const content = await createMessageContent(message, true, { editedEvent });
+
+            // Then
+            expect(content).toEqual({
+                "body": "* *__hello__ world*",
+                "format": "org.matrix.custom.html",
+                "formatted_body": `* ${message}`,
+                "msgtype": "m.text",
+                "m.new_content": {
+                    body: "*__hello__ world*",
+                    format: "org.matrix.custom.html",
+                    formatted_body: message,
+                    msgtype: "m.text",
+                },
+                "m.relates_to": {
+                    event_id: editedEvent.getId(),
+                    rel_type: "m.replace",
+                },
+            });
+        });
+
+        it("Should strip the /me prefix from a message", async () => {
+            const textBody = "some body text";
+            const content = await createMessageContent(EMOTE_PREFIX + textBody, true, {});
+
+            expect(content).toMatchObject({ body: textBody, formatted_body: textBody });
+        });
+
+        it("Should strip single / from message prefixed with //", async () => {
+            const content = await createMessageContent("//twoSlashes", true, {});
+
+            expect(content).toMatchObject({ body: "/twoSlashes", formatted_body: "/twoSlashes" });
+        });
+
+        it("Should set the content type to MsgType.Emote when /me prefix is used", async () => {
+            const textBody = "some body text";
+            const content = await createMessageContent(EMOTE_PREFIX + textBody, true, {});
+
+            expect(content).toMatchObject({ msgtype: MsgType.Emote });
+        });
+
+        describe("custom emotes", () => {
+            it("decorates rich messages outside code and links", async () => {
+                const content = await createMessageContent(
+                    '<p>Hello :wave:</p><pre><code>:wave:</code></pre><a href="https://example.org">:wave:</a>',
+                    true,
+                    { customEmotes: [emote] },
+                );
+                const textContent = content as RoomMessageTextEventContent;
+
+                expect(content.body).toBe("Hello :wave::wave::wave:");
+                expect(textContent.formatted_body).toContain('src="mxc://example.org/wave"');
+                expect(textContent.formatted_body).toContain("<code>:wave:</code>");
+                expect(textContent.formatted_body).toContain('<a href="https://example.org">:wave:</a>');
+            });
+
+            it("decorates both fallback and replacement content when editing", async () => {
+                const editedEvent = mkEvent({
+                    event: true,
+                    type: "m.room.message",
+                    room: "!room:example.org",
+                    user: "@alice:example.org",
+                    content: { msgtype: "m.text", body: "old" },
+                });
+                const content = await createMessageContent("<p>:wave:</p>", true, {
+                    customEmotes: [emote],
+                    editedEvent,
+                });
+                const textContent = content as RoomMessageTextEventContent & {
+                    "m.new_content": RoomMessageTextEventContent;
+                };
+
+                expect(textContent.formatted_body).toContain("data-mx-emoticon");
+                expect(textContent["m.new_content"].formatted_body).toContain("data-mx-emoticon");
+                expect(textContent["m.new_content"].body).toBe(":wave:");
+            });
+
+            it("leaves removed emotes as literal text", async () => {
+                const content = await createMessageContent("<p>:wave:</p>", true, { customEmotes: [] });
+                expect((content as RoomMessageTextEventContent).formatted_body).toBe("<p>:wave:</p>");
+                expect(content.body).toBe(":wave:");
+            });
+
+            it("preserves an edited emote after its pack is removed", async () => {
+                const editedEvent = mkEvent({
+                    event: true,
+                    type: "m.room.message",
+                    room: "!room:example.org",
+                    user: "@alice:example.org",
+                    content: {
+                        msgtype: "m.text",
+                        body: ":wave:",
+                        format: "org.matrix.custom.html",
+                        formatted_body:
+                            '<img data-mx-emoticon src="mxc://example.org/original" alt="Original wave" title="wave" height="32">',
+                    },
+                });
+                const content = await createMessageContent("<p>:wave/edited-1:</p>", true, {
+                    customEmotes: [],
+                    editedEvent,
+                });
+                const textContent = content as RoomMessageTextEventContent & {
+                    "m.new_content": RoomMessageTextEventContent;
+                };
+
+                expect(textContent["m.new_content"].body).toBe(":wave:");
+                expect(textContent["m.new_content"].formatted_body).toContain('src="mxc://example.org/original"');
+            });
+        });
+    });
+
+    describe("Plaintext composer input", () => {
+        it("Should replace at-room mentions with `@room` in body", async () => {
+            const messageComposerState = `<a href="#" contenteditable="false" data-mention-type="at-room" style="some styling">@room</a> `;
+
+            const content = await createMessageContent(messageComposerState, false, {});
+            expect(content).toMatchObject({ body: "@room " });
+        });
+
+        it("Should replace user mentions with user name in body", async () => {
+            const messageComposerState = `<a href="https://matrix.to/#/@test_user:element.io" contenteditable="false" data-mention-type="user" style="some styling">a test user</a> `;
+
+            const content = await createMessageContent(messageComposerState, false, {});
+
+            expect(content).toMatchObject({ body: "a test user " });
+        });
+
+        it("Should replace room mentions with room mxid in body", async () => {
+            const messageComposerState = `<a href="https://matrix.to/#/#test_room:element.io" contenteditable="false" data-mention-type="room" style="some styling">@test_room </a>`;
+
+            const content = await createMessageContent(messageComposerState, false, {});
+
+            expect(content).toMatchObject({
+                body: "#test_room:element.io ",
+            });
+        });
+    });
+});
    });
});
