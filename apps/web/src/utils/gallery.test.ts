/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, it, expect } from "vitest";
import { EventType, type IContent, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import {
    GALLERY_MSGTYPE,
    type GalleryItem,
    MAX_GALLERY_ITEMS,
    captionFromMessageContent,
    galleryItemToMediaContent,
    getGalleryCaption,
    getGalleryItems,
    getGallerySummary,
    getEditableMediaItems,
    getMessageMediaCaption,
    getMessageMediaItems,
    isGalleryContent,
    isGalleryEvent,
    isGalleryFile,
    mediaContentToGalleryItem,
    splitGalleryItems,
} from "./gallery";

const image = (name: string, extra: Partial<GalleryItem> = {}): GalleryItem => ({
    itemtype: MsgType.Image,
    body: name,
    url: `mxc://server/${name}`,
    ...extra,
});

/** An item whose JSON takes up roughly the given number of bytes. */
const itemOfSize = (index: number, size: number): GalleryItem => image(`${index}.png`, { body: "x".repeat(size) });

describe("gallery", () => {
    describe("isGalleryContent", () => {
        it.each(["m.gallery", "dm.filament.gallery"])("recognises the %s msgtype", (msgtype) => {
            expect(isGalleryContent({ msgtype, body: "" })).toBe(true);
        });

        it.each([
            ["an image", { msgtype: "m.image", body: "image.png" }],
            ["content without a msgtype", { body: "hello" }],
            ["a msgtype which is not a string", { msgtype: { not: "a string" } }],
            ["no content", undefined],
        ])("does not take %s for a gallery", (_, content) => {
            expect(isGalleryContent(content as IContent | undefined)).toBe(false);
        });

        it("sends the unstable msgtype while the MSC is not merged", () => {
            expect(GALLERY_MSGTYPE.name).toBe("dm.filament.gallery");
        });
    });

    describe("isGalleryEvent", () => {
        it.each(["m.gallery", "dm.filament.gallery"])("recognises a room message of msgtype %s", (msgtype) => {
            const event = new MatrixEvent({ type: EventType.RoomMessage, content: { msgtype, body: "" } });
            expect(isGalleryEvent(event)).toBe(true);
        });

        it("ignores other room messages", () => {
            const event = new MatrixEvent({ type: EventType.RoomMessage, content: { msgtype: "m.text", body: "hi" } });
            expect(isGalleryEvent(event)).toBe(false);
        });

        it("ignores events of another type which carry the gallery msgtype", () => {
            const event = new MatrixEvent({ type: EventType.Sticker, content: { msgtype: "m.gallery", body: "" } });
            expect(isGalleryEvent(event)).toBe(false);
        });
    });

    describe("getGalleryItems", () => {
        it("returns the image and video items in order", () => {
            const first = image("a.png");
            const second: GalleryItem = {
                itemtype: MsgType.Video,
                body: "b.mp4",
                file: { url: "mxc://server/b" } as any,
            };

            expect(getGalleryItems({ msgtype: "m.gallery", itemtypes: [first, second] })).toEqual([first, second]);
        });

        it("leaves out items which cannot be displayed", () => {
            const good = image("good.png");
            const itemtypes = [
                null,
                "not an object",
                42,
                { itemtype: "m.audio", body: "song.ogg", url: "mxc://server/song" },
                { itemtype: "m.file", body: "doc.pdf", url: "mxc://server/doc" },
                { body: "no-type.png", url: "mxc://server/no-type" },
                { itemtype: "m.image", body: "no-media.png" },
                { itemtype: "m.image", body: "bad-url.png", url: 12 },
                { itemtype: "m.image", body: "bad-file.png", file: {} },
                good,
            ];

            expect(getGalleryItems({ msgtype: "m.gallery", itemtypes })).toEqual([good]);
        });

        it.each([
            ["missing", {}],
            ["not an array", { itemtypes: { 0: image("a.png") } }],
            ["absent because there is no content", undefined],
        ])("returns nothing when the items are %s", (_, content) => {
            expect(getGalleryItems(content)).toEqual([]);
        });
    });

    describe("getGalleryCaption", () => {
        it("returns the body as typed", () => {
            expect(getGalleryCaption({ body: " Our holiday " })).toBe(" Our holiday ");
        });

        it.each([
            ["an empty body", { body: "" }],
            ["a body of only whitespace", { body: " \n\t " }],
            ["a body which is not a string", { body: 12 }],
            ["a missing body", {}],
            ["no content", undefined],
        ])("returns undefined for %s", (_, content) => {
            expect(getGalleryCaption(content)).toBeUndefined();
        });
    });

    describe("galleryItemToMediaContent", () => {
        it("turns the itemtype into the msgtype and keeps everything else", () => {
            const item = image("a.png", { filename: "a.png", info: { w: 10, h: 20, mimetype: "image/png" } });

            const content = galleryItemToMediaContent(item);

            expect(content).toEqual({
                msgtype: "m.image",
                body: "a.png",
                filename: "a.png",
                url: "mxc://server/a.png",
                info: { w: 10, h: 20, mimetype: "image/png" },
            });
            expect(content).not.toHaveProperty("itemtype");
        });
    });

    describe("mediaContentToGalleryItem", () => {
        it("turns an image message into an item named after the file", () => {
            expect(
                mediaContentToGalleryItem({
                    "msgtype": "m.image",
                    "body": "a.png",
                    "url": "mxc://server/a.png",
                    "info": { w: 10, h: 20 },
                    "m.mentions": {},
                }),
            ).toEqual({ itemtype: "m.image", body: "a.png", url: "mxc://server/a.png", info: { w: 10, h: 20 } });
        });

        it("leaves the caption behind and names the item after the file", () => {
            const item = mediaContentToGalleryItem({
                msgtype: "m.video",
                body: "A caption",
                format: "org.matrix.custom.html",
                formatted_body: "A <b>caption</b>",
                filename: "clip.mp4",
                file: { url: "mxc://server/clip" },
            });

            expect(item).toEqual({ itemtype: "m.video", body: "clip.mp4", file: { url: "mxc://server/clip" } });
        });

        it("is the reverse of galleryItemToMediaContent", () => {
            const item = image("a.png", { info: { mimetype: "image/png" } });

            expect(mediaContentToGalleryItem(galleryItemToMediaContent(item))).toEqual(item);
        });

        it.each([
            ["a text message", { msgtype: "m.text", body: "Hello" }],
            ["a file", { msgtype: "m.file", body: "a.pdf", url: "mxc://server/a.pdf" }],
            ["audio", { msgtype: "m.audio", body: "a.ogg", url: "mxc://server/a.ogg" }],
            ["an image without media", { msgtype: "m.image", body: "a.png" }],
            ["a gallery", { msgtype: "dm.filament.gallery", body: "", itemtypes: [] }],
            ["nothing", undefined],
        ])("returns undefined for %s", (_name, content) => {
            expect(mediaContentToGalleryItem(content)).toBeUndefined();
        });
    });

    describe("getMessageMediaItems", () => {
        it.each(["dm.filament.gallery", "m.gallery"])("returns the items of a %s which can be displayed", (msgtype) => {
            const first = image("a.png");
            const video: GalleryItem = {
                itemtype: MsgType.Video,
                body: "b.mp4",
                file: { url: "mxc://server/b" },
            } as GalleryItem;

            expect(
                getMessageMediaItems({
                    msgtype,
                    body: "Our holiday",
                    itemtypes: [
                        first,
                        { itemtype: "m.file", body: "notes.pdf", url: "mxc://server/notes.pdf" },
                        video,
                        { itemtype: "m.image", body: "no-media.png" },
                    ],
                }),
            ).toEqual([first, video]);
        });

        it("returns the very items of the gallery, so that the ones which are kept can be told apart", () => {
            const first = image("a.png");

            expect(getMessageMediaItems({ msgtype: "dm.filament.gallery", body: "", itemtypes: [first] })![0]).toBe(
                first,
            );
        });

        it.each([
            ["without items", { msgtype: "dm.filament.gallery", body: "" }],
            ["with no items", { msgtype: "dm.filament.gallery", body: "", itemtypes: [] }],
            [
                "with only items which cannot be displayed",
                { msgtype: "m.gallery", body: "", itemtypes: [{ itemtype: "m.audio", url: "mxc://server/a" }] },
            ],
        ])("returns an empty list for a gallery %s", (_name, content) => {
            // Still a message with media: one whose every item is gone, not a text message.
            expect(getMessageMediaItems(content)).toEqual([]);
        });

        it.each([MsgType.Image, MsgType.Video])("returns the one item of an %s message", (msgtype) => {
            expect(
                getMessageMediaItems({
                    msgtype,
                    body: "A caption",
                    filename: "holiday.bin",
                    url: "mxc://server/holiday",
                    info: { size: 10 },
                }),
            ).toEqual([{ itemtype: msgtype, body: "holiday.bin", url: "mxc://server/holiday", info: { size: 10 } }]);
        });

        it.each([
            ["a text message", { msgtype: "m.text", body: "Hello" }],
            ["a file", { msgtype: "m.file", body: "a.pdf", url: "mxc://server/a.pdf" }],
            ["audio", { msgtype: "m.audio", body: "a.ogg", url: "mxc://server/a.ogg" }],
            ["an image without media", { msgtype: "m.image", body: "a.png" }],
            ["a message without a msgtype", { body: "Hello", url: "mxc://server/a" }],
            ["nothing", undefined],
        ])("returns undefined for %s", (_name, content) => {
            expect(getMessageMediaItems(content)).toBeUndefined();
        });
    });

    describe("getMessageMediaCaption", () => {
        it("returns the caption of a gallery", () => {
            expect(
                getMessageMediaCaption({
                    msgtype: "dm.filament.gallery",
                    body: "Our holiday",
                    itemtypes: [image("a.png")],
                }),
            ).toEqual({ body: "Our holiday" });
        });

        it("returns the formatting of the caption of a gallery", () => {
            expect(
                getMessageMediaCaption({
                    msgtype: "m.gallery",
                    body: "Our **holiday**",
                    format: "org.matrix.custom.html",
                    formatted_body: "Our <strong>holiday</strong>",
                    itemtypes: [image("a.png")],
                }),
            ).toEqual({
                body: "Our **holiday**",
                format: "org.matrix.custom.html",
                formatted_body: "Our <strong>holiday</strong>",
            });
        });

        it.each([
            ["an empty body", ""],
            ["a body of white space", " \n "],
            ["no body", undefined],
        ])("returns an empty caption for a gallery with %s", (_name, body) => {
            expect(
                getMessageMediaCaption({
                    msgtype: "dm.filament.gallery",
                    body,
                    // Formatting without text to format is not a caption.
                    format: "org.matrix.custom.html",
                    formatted_body: "<br>",
                    itemtypes: [image("a.png")],
                }),
            ).toEqual({ body: "" });
        });

        it.each([
            ["has no filename", { body: "a.png" }],
            ["is the same as the filename", { body: "a.png", filename: "a.png" }],
        ])("returns an empty caption for an image whose body %s", (_name, fields) => {
            // The body is the name of the file, not something the user wrote.
            expect(
                getMessageMediaCaption({
                    msgtype: "m.image",
                    url: "mxc://server/a.png",
                    format: "org.matrix.custom.html",
                    formatted_body: "<b>a.png</b>",
                    ...fields,
                }),
            ).toEqual({ body: "" });
        });

        it("returns the caption of an image whose body is not its file name", () => {
            expect(
                getMessageMediaCaption({
                    msgtype: "m.image",
                    body: "Look at *this*",
                    format: "org.matrix.custom.html",
                    formatted_body: "Look at <em>this</em>",
                    filename: "a.png",
                    url: "mxc://server/a.png",
                }),
            ).toEqual({
                body: "Look at *this*",
                format: "org.matrix.custom.html",
                formatted_body: "Look at <em>this</em>",
            });
        });

        it("returns the caption of a video without formatting", () => {
            expect(
                getMessageMediaCaption({
                    msgtype: "m.video",
                    body: "Watch this",
                    filename: "clip.mp4",
                    url: "mxc://server/clip",
                }),
            ).toEqual({ body: "Watch this" });
        });

        it.each([
            ["a gallery", { msgtype: "dm.filament.gallery", body: "Hi @bob", itemtypes: [] }],
            ["an image", { msgtype: "m.image", body: "Hi @bob", filename: "a.png", url: "mxc://server/a.png" }],
            ["an image without a caption", { msgtype: "m.image", body: "a.png", url: "mxc://server/a.png" }],
        ])("leaves out the mentions of %s", (_name, content) => {
            const caption = getMessageMediaCaption({ ...content, "m.mentions": { user_ids: ["@bob:server"] } });

            expect(caption).not.toHaveProperty("m.mentions");
        });

        it("returns an empty caption for nothing", () => {
            expect(getMessageMediaCaption(undefined)).toEqual({ body: "" });
        });

        it("returns the text of a text message, with its formatting", () => {
            expect(
                getMessageMediaCaption({
                    "msgtype": "m.text",
                    "body": "Hello **there**",
                    "format": "org.matrix.custom.html",
                    "formatted_body": "Hello <strong>there</strong>",
                    "m.mentions": { user_ids: ["@bob:server"] },
                }),
            ).toEqual({
                body: "Hello **there**",
                format: "org.matrix.custom.html",
                formatted_body: "Hello <strong>there</strong>",
            });
        });

        it("returns the plain text of a text message", () => {
            expect(getMessageMediaCaption({ msgtype: "m.text", body: "Hello" })).toEqual({ body: "Hello" });
        });

        it("returns an empty caption for a text message of white space", () => {
            expect(getMessageMediaCaption({ msgtype: "m.text", body: "  " })).toEqual({ body: "" });
        });

        it("does not take the body of an emote or notice as a caption", () => {
            expect(getMessageMediaCaption({ msgtype: "m.emote", body: "waves" })).toEqual({ body: "" });
            expect(getMessageMediaCaption({ msgtype: "m.notice", body: "Beep" })).toEqual({ body: "" });
        });
    });

    describe("getEditableMediaItems", () => {
        it("returns no items for a text message, which images and videos can be added to", () => {
            expect(getEditableMediaItems({ msgtype: "m.text", body: "Hello" })).toEqual([]);
        });

        it("returns the items of a gallery", () => {
            const first = image("a.png");
            const second = image("b.png");

            const items = getEditableMediaItems({
                msgtype: "dm.filament.gallery",
                body: "",
                itemtypes: [first, second],
            });

            expect(items).toEqual([first, second]);
            expect(items![0]).toBe(first);
        });

        it("returns the one item of an image message", () => {
            expect(getEditableMediaItems({ msgtype: "m.image", body: "a.png", url: "mxc://server/a.png" })).toEqual([
                { itemtype: "m.image", body: "a.png", url: "mxc://server/a.png" },
            ]);
        });

        it.each([
            ["an emote", { msgtype: "m.emote", body: "waves" }],
            ["a notice", { msgtype: "m.notice", body: "Beep" }],
            ["a file", { msgtype: "m.file", body: "a.pdf", url: "mxc://server/a.pdf" }],
            ["audio", { msgtype: "m.audio", body: "a.ogg", url: "mxc://server/a.ogg" }],
            ["a message without a msgtype", { body: "Hello" }],
            ["nothing", undefined],
        ])("returns undefined for %s", (_name, content) => {
            expect(getEditableMediaItems(content)).toBeUndefined();
        });
    });

    describe("getGallerySummary", () => {
        it("uses the caption when there is one", () => {
            expect(getGallerySummary({ body: "  Our holiday\n", itemtypes: [image("a.png")] })).toBe("Our holiday");
        });

        it("counts the items when there is no caption", () => {
            expect(getGallerySummary({ body: "", itemtypes: [image("a.png"), image("b.png")] })).toBe(
                "Gallery with 2 items",
            );
        });

        it("uses the singular for one item", () => {
            expect(getGallerySummary({ body: " ", itemtypes: [image("a.png")] })).toBe("Gallery with 1 item");
        });

        it("only counts the items which can be displayed", () => {
            const itemtypes = [image("a.png"), { itemtype: "m.file", body: "doc.pdf", url: "mxc://server/doc" }];
            expect(getGallerySummary({ body: "", itemtypes })).toBe("Gallery with 1 item");
        });
    });

    describe("captionFromMessageContent", () => {
        it("takes the body of a plain message", () => {
            expect(captionFromMessageContent({ msgtype: MsgType.Text, body: "Our holiday" })).toEqual({
                body: "Our holiday",
            });
        });

        it("carries over the formatted body of an HTML message", () => {
            expect(
                captionFromMessageContent({
                    msgtype: MsgType.Text,
                    body: "Our **holiday**",
                    format: "org.matrix.custom.html",
                    formatted_body: "Our <strong>holiday</strong>",
                }),
            ).toEqual({
                body: "Our **holiday**",
                format: "org.matrix.custom.html",
                formatted_body: "Our <strong>holiday</strong>",
            });
        });

        it("drops a formatted body in a format it does not know", () => {
            expect(
                captionFromMessageContent({
                    msgtype: MsgType.Text,
                    body: "Our holiday",
                    format: "org.example.other",
                    formatted_body: "<b>Our holiday</b>",
                }),
            ).toEqual({ body: "Our holiday" });
        });

        it.each([
            ["a format without a formatted body", { format: "org.matrix.custom.html" }],
            ["a formatted body without a format", { formatted_body: "<b>Our holiday</b>" }],
            ["a formatted body which is not text", { format: "org.matrix.custom.html", formatted_body: 42 }],
        ])("drops %s", (_description, formatting) => {
            expect(captionFromMessageContent({ msgtype: MsgType.Text, body: "Our holiday", ...formatting })).toEqual({
                body: "Our holiday",
            });
        });

        it("carries over the mentions", () => {
            const mentions = { user_ids: ["@bob:example.org"], room: true };

            expect(
                captionFromMessageContent({ "msgtype": MsgType.Text, "body": "Hi Bob", "m.mentions": mentions }),
            ).toEqual({ "body": "Hi Bob", "m.mentions": mentions });
        });

        it("carries over empty mentions, which say that nobody is mentioned", () => {
            expect(captionFromMessageContent({ "msgtype": MsgType.Text, "body": "Hi", "m.mentions": {} })).toEqual({
                "body": "Hi",
                "m.mentions": {},
            });
        });

        it("has no mentions when the message has none", () => {
            expect(captionFromMessageContent({ msgtype: MsgType.Text, body: "Hi" })).not.toHaveProperty("m.mentions");
        });

        it.each([undefined, null, 42, { text: "Hi" }])("has an empty body when the body is %j", (body) => {
            expect(captionFromMessageContent({ msgtype: MsgType.Text, body } as IContent)).toEqual({ body: "" });
        });

        it("leaves out everything else the message holds", () => {
            expect(
                captionFromMessageContent({
                    "msgtype": MsgType.Emote,
                    "body": "waves",
                    "m.relates_to": { "m.in_reply_to": { event_id: "$event" } },
                    "url": "mxc://server/file",
                }),
            ).toEqual({ body: "waves" });
        });
    });

    describe("isGalleryFile", () => {
        it.each([
            ["image/png", true],
            ["image/svg+xml", true],
            ["video/mp4", true],
            ["audio/ogg", false],
            ["application/pdf", false],
            ["", false],
        ])("for a file of type '%s' returns %s", (type, expected) => {
            expect(isGalleryFile(new File(["bytes"], "file", { type }))).toBe(expected);
        });
    });

    describe("splitGalleryItems", () => {
        it("keeps items which fit in one gallery together", () => {
            const items = [image("a.png"), image("b.png"), image("c.png")];

            expect(splitGalleryItems(items, { body: "caption" }, false)).toEqual([items]);
        });

        it("returns one empty gallery when there are no items", () => {
            expect(splitGalleryItems([], { body: "" }, false)).toEqual([[]]);
        });

        it("starts another gallery when the items outgrow one event", () => {
            // 10 items of about 10KB do not fit in the 64KB of an event.
            const items = Array.from({ length: 10 }, (_, index) => itemOfSize(index, 10_000));

            const galleries = splitGalleryItems(items, { body: "" }, false);

            expect(galleries.length).toBeGreaterThan(1);
            // Nothing is lost or reordered.
            expect(galleries.flat()).toEqual(items);
            for (const gallery of galleries) {
                expect(gallery.length).toBeGreaterThan(0);
                expect(new TextEncoder().encode(JSON.stringify(gallery)).length).toBeLessThan(65536);
            }
        });

        it("fits fewer items in an encrypted event", () => {
            // 5 items of about 10KB fit in a plain event, but not once encryption has inflated them.
            const items = Array.from({ length: 5 }, (_, index) => itemOfSize(index, 10_000));

            expect(splitGalleryItems(items, { body: "" }, false)).toHaveLength(1);

            const encrypted = splitGalleryItems(items, { body: "" }, true);
            expect(encrypted.length).toBeGreaterThan(1);
            expect(encrypted.flat()).toEqual(items);
        });

        it("counts the caption towards the first gallery", () => {
            const items = Array.from({ length: 5 }, (_, index) => itemOfSize(index, 10_000));
            const caption = { body: "c".repeat(15_000), format: "org.matrix.custom.html" as const };

            const galleries = splitGalleryItems(items, { ...caption, formatted_body: caption.body }, false);

            // Without the caption all five would fit: see the test above.
            expect(galleries.length).toBeGreaterThan(1);
            expect(galleries[0].length).toBeLessThan(5);
            expect(galleries.flat()).toEqual(items);
        });

        it("sends an item which is too large for any event on its own rather than dropping it", () => {
            const items = [image("a.png"), itemOfSize(1, 100_000), image("c.png")];

            const galleries = splitGalleryItems(items, { body: "" }, false);

            expect(galleries.flat()).toEqual(items);
            expect(galleries).toContainEqual([items[1]]);
        });

        it("never puts more than the maximum number of items in one gallery", () => {
            const items = Array.from({ length: MAX_GALLERY_ITEMS * 2 + 1 }, (_, index) => image(`${index}.png`));

            const galleries = splitGalleryItems(items, { body: "" }, false);

            expect(galleries.map((gallery) => gallery.length)).toEqual([MAX_GALLERY_ITEMS, MAX_GALLERY_ITEMS, 1]);
            expect(galleries.flat()).toEqual(items);
        });
    });
});
