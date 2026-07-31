/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import {
    FileCategory,
    FILE_CATEGORY_FILTERS,
    getFileCategory,
    eventMatchesCategory,
    eventMatchesFileSearch,
    buildFileEventFilter,
} from "../../../src/utils/FileCategory";
import { mkEvent } from "../../test-utils";

const ROOM = "!room:server";
const USER = "@me:server";

function mkMedia(msgtype: string, content: Record<string, unknown> = {}): MatrixEvent {
    return mkEvent({
        type: "m.room.message",
        user: USER,
        room: ROOM,
        content: { msgtype, body: "file", ...content },
        event: true,
    });
}

describe("FileCategory", () => {
    describe("getFileCategory", () => {
        it("classifies m.image as Images and m.video as Videos", () => {
            expect(getFileCategory(mkMedia(MsgType.Image))).toBe(FileCategory.Images);
            expect(getFileCategory(mkMedia(MsgType.Video))).toBe(FileCategory.Videos);
        });

        it("classifies m.file as Documents", () => {
            expect(getFileCategory(mkMedia(MsgType.File))).toBe(FileCategory.Documents);
        });

        it("classifies a plain m.audio as Audio", () => {
            expect(getFileCategory(mkMedia(MsgType.Audio))).toBe(FileCategory.Audio);
        });

        it("classifies a voice-flagged m.audio as Audio too", () => {
            const voice = mkMedia(MsgType.Audio, { "org.matrix.msc3245.voice": {} });
            expect(getFileCategory(voice)).toBe(FileCategory.Audio);
        });

        it("classifies a legacy msc2516 voice m.audio as Audio", () => {
            const voice = mkMedia(MsgType.Audio, { "org.matrix.msc2516.voice": {} });
            expect(getFileCategory(voice)).toBe(FileCategory.Audio);
        });

        it("returns null for a non-media text message", () => {
            expect(getFileCategory(mkMedia(MsgType.Text))).toBeNull();
        });

        it("returns null for a non-message event type", () => {
            const sticker = mkEvent({ type: "m.sticker", user: USER, room: ROOM, content: { body: "x" }, event: true });
            expect(getFileCategory(sticker)).toBeNull();
        });
    });

    describe("eventMatchesCategory", () => {
        it("matches any media event when no category is selected", () => {
            expect(eventMatchesCategory(mkMedia(MsgType.Image), null)).toBe(true);
            expect(eventMatchesCategory(mkMedia(MsgType.File), null)).toBe(true);
            expect(eventMatchesCategory(mkMedia(MsgType.Audio), null)).toBe(true);
        });

        it("excludes non-media events even when no category is selected", () => {
            expect(eventMatchesCategory(mkMedia(MsgType.Text), null)).toBe(false);
        });

        it("matches only the exact category when one is selected", () => {
            const image = mkMedia(MsgType.Image);
            expect(eventMatchesCategory(image, FileCategory.Images)).toBe(true);
            expect(eventMatchesCategory(image, FileCategory.Documents)).toBe(false);
            expect(eventMatchesCategory(image, FileCategory.Videos)).toBe(false);
        });
    });

    describe("eventMatchesFileSearch", () => {
        it("matches everything for an empty or whitespace term", () => {
            const ev = mkMedia(MsgType.Image, { body: "vacation.png" });
            expect(eventMatchesFileSearch(ev, "")).toBe(true);
            expect(eventMatchesFileSearch(ev, "   ")).toBe(true);
        });

        it("matches the filename case-insensitively as a substring", () => {
            const ev = mkMedia(MsgType.Image, { body: "Vacation-Beach.png" });
            expect(eventMatchesFileSearch(ev, "beach")).toBe(true);
            expect(eventMatchesFileSearch(ev, "BEACH")).toBe(true);
            expect(eventMatchesFileSearch(ev, "mountain")).toBe(false);
        });

        it("searches both the filename field and the body caption", () => {
            // Split-format media: filename = real name, body = caption.
            const ev = mkMedia(MsgType.File, { filename: "report-q3.pdf", body: "the quarterly numbers" });
            expect(eventMatchesFileSearch(ev, "report-q3")).toBe(true);
            expect(eventMatchesFileSearch(ev, "quarterly")).toBe(true);
            expect(eventMatchesFileSearch(ev, "missing")).toBe(false);
        });
    });

    describe("buildFileEventFilter", () => {
        it("combines category and search with AND", () => {
            const filter = buildFileEventFilter(FileCategory.Images, "cat");
            expect(filter(mkMedia(MsgType.Image, { body: "cat.png" }))).toBe(true);
            // right category, wrong name
            expect(filter(mkMedia(MsgType.Image, { body: "dog.png" }))).toBe(false);
            // right name, wrong category
            expect(filter(mkMedia(MsgType.File, { body: "cat.png" }))).toBe(false);
        });

        it("with no category + empty term passes every media event and rejects non-media", () => {
            const filter = buildFileEventFilter(null, "");
            expect(filter(mkMedia(MsgType.Video))).toBe(true);
            expect(filter(mkMedia(MsgType.Text))).toBe(false);
        });

        it("still applies the search term when no category is selected", () => {
            const filter = buildFileEventFilter(null, "cat");
            expect(filter(mkMedia(MsgType.File, { body: "cat.pdf" }))).toBe(true);
            expect(filter(mkMedia(MsgType.Audio, { body: "dog.mp3" }))).toBe(false);
        });
    });

    describe("FILE_CATEGORY_FILTERS", () => {
        it("lists the categories in display order, with no 'all' entry", () => {
            expect(FILE_CATEGORY_FILTERS).toEqual([
                FileCategory.Documents,
                FileCategory.Images,
                FileCategory.Videos,
                FileCategory.Audio,
            ]);
        });
    });
});
