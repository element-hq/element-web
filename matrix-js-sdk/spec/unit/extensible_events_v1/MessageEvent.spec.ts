/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {
    ExtensibleAnyMessageEventContent,
    IPartialEvent,
    M_HTML,
    M_MESSAGE,
    M_TEXT,
} from "../../../src/@types/extensible_events";
import { MessageEvent } from "../../../src/extensible_events_v1/MessageEvent";
import { InvalidEventError } from "../../../src/extensible_events_v1/InvalidEventError";

describe("MessageEvent", () => {
    it("should parse m.text", () => {
        const input: IPartialEvent<ExtensibleAnyMessageEventContent> = {
            type: "org.example.message-like",
            content: {
                [M_TEXT.name]: "Text here",
            },
        };
        const message = new MessageEvent(input);
        expect(message.text).toBe("Text here");
        expect(message.html).toBeFalsy();
        expect(message.renderings.length).toBe(1);
        expect(message.renderings.some((r) => r.mimetype === "text/plain" && r.body === "Text here")).toBe(true);
    });

    it("should parse m.html", () => {
        const input: IPartialEvent<ExtensibleAnyMessageEventContent> = {
            type: "org.example.message-like",
            content: {
                [M_TEXT.name]: "Text here",
                [M_HTML.name]: "HTML here",
            },
        };
        const message = new MessageEvent(input);
        expect(message.text).toBe("Text here");
        expect(message.html).toBe("HTML here");
        expect(message.renderings.length).toBe(2);
        expect(message.renderings.some((r) => r.mimetype === "text/plain" && r.body === "Text here")).toBe(true);
        expect(message.renderings.some((r) => r.mimetype === "text/html" && r.body === "HTML here")).toBe(true);
    });

    it("should parse m.message", () => {
        const input: IPartialEvent<ExtensibleAnyMessageEventContent> = {
            type: "org.example.message-like",
            content: {
                [M_MESSAGE.name]: [
                    { body: "Text here", mimetype: "text/plain" },
                    { body: "HTML here", mimetype: "text/html" },
                    { body: "MD here", mimetype: "text/markdown" },
                ],

                // These should be ignored
                [M_TEXT.name]: "WRONG Text here",
                [M_HTML.name]: "WRONG HTML here",
            },
        };
        const message = new MessageEvent(input);
        expect(message.text).toBe("Text here");
        expect(message.html).toBe("HTML here");
        expect(message.renderings.length).toBe(3);
        expect(message.renderings.some((r) => r.mimetype === "text/plain" && r.body === "Text here")).toBe(true);
        expect(message.renderings.some((r) => r.mimetype === "text/html" && r.body === "HTML here")).toBe(true);
        expect(message.renderings.some((r) => r.mimetype === "text/markdown" && r.body === "MD here")).toBe(true);
    });

    it("should fail to parse missing text", () => {
        const input: IPartialEvent<ExtensibleAnyMessageEventContent> = {
            type: "org.example.message-like",
            content: {
                hello: "world",
            } as any, // force invalid type
        };
        expect(() => new MessageEvent(input)).toThrow(
            new InvalidEventError("Missing textual representation for event"),
        );
    });

    it("should fail to parse missing plain text in m.message", () => {
        const input: IPartialEvent<ExtensibleAnyMessageEventContent> = {
            type: "org.example.message-like",
            content: {
                [M_MESSAGE.name]: [{ body: "HTML here", mimetype: "text/html" }],
            },
        };
        expect(() => new MessageEvent(input)).toThrow(
            new InvalidEventError("m.message is missing a plain text representation"),
        );
    });

    it("should fail to parse non-array m.message", () => {
        const input: IPartialEvent<ExtensibleAnyMessageEventContent> = {
            type: "org.example.message-like",
            content: {
                [M_MESSAGE.name]: "invalid",
            } as any, // force invalid type
        };
        expect(() => new MessageEvent(input)).toThrow(new InvalidEventError("m.message contents must be an array"));
    });

    describe("from & serialize", () => {
        it("should serialize to a legacy fallback", () => {
            const message = MessageEvent.from("Text here", "HTML here");
            expect(message.text).toBe("Text here");
            expect(message.html).toBe("HTML here");
            expect(message.renderings.length).toBe(2);
            expect(message.renderings.some((r) => r.mimetype === "text/plain" && r.body === "Text here")).toBe(true);
            expect(message.renderings.some((r) => r.mimetype === "text/html" && r.body === "HTML here")).toBe(true);

            const serialized = message.serialize();
            expect(serialized.type).toBe("m.room.message");
            expect(serialized.content).toMatchObject({
                [M_MESSAGE.name]: [
                    { body: "Text here", mimetype: "text/plain" },
                    { body: "HTML here", mimetype: "text/html" },
                ],
                body: "Text here",
                msgtype: "m.text",
                format: "org.matrix.custom.html",
                formatted_body: "HTML here",
            });
        });

        it("should serialize non-html content to a legacy fallback", () => {
            const message = MessageEvent.from("Text here");
            expect(message.text).toBe("Text here");
            expect(message.renderings.length).toBe(1);
            expect(message.renderings.some((r) => r.mimetype === "text/plain" && r.body === "Text here")).toBe(true);

            const serialized = message.serialize();
            expect(serialized.type).toBe("m.room.message");
            expect(serialized.content).toMatchObject({
                [M_TEXT.name]: "Text here",
                body: "Text here",
                msgtype: "m.text",
                format: undefined,
                formatted_body: undefined,
            });
        });
    });
});
