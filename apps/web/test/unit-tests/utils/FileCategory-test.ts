/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import {
    FileCategory,
    FILE_CATEGORY_TABS,
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
        it("classifies m.image and m.video as Media", () => {
            expect(getFileCategory(mkMedia(MsgType.Image))).toBe(FileCategory.Media);
            expect(getFileCategory(mkMedia(MsgType.Video))).toBe(FileCategory.Media);
        });

        it("classifies m.file as Files", () => {
            expect(getFileCategory(mkMedia(MsgType.File))).toBe(FileCategory.Files);
        });

        it("classifies a plain m.audio as Music", () => {
            expect(getFileCategory(mkMedia(MsgType.Audio))).toBe(FileCategory.Music);
        });

        it("classifies a voice-flagged m.audio as Voice, not Music", () => {
            const voice = mkMedia(MsgType.Audio, { "org.matrix.msc3245.voice": {} });
            expect(getFileCategory(voice)).toBe(FileCategory.Voice);
        });

        it("classifies a legacy msc2516 voice m.audio as Voice", () => {
            const voice = mkMedia(MsgType.Audio, { "org.matrix.msc2516.voice": {} });
            expect(getFileCategory(voice)).toBe(FileCategory.Voice);
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
        it("matches any media event under the All tab", () => {
            expect(eventMatchesCategory(mkMedia(MsgType.Image), FileCategory.All)).toBe(true);
            expect(eventMatchesCategory(mkMedia(MsgType.File), FileCategory.All)).toBe(true);
            expect(eventMatchesCategory(mkMedia(MsgType.Audio), FileCategory.All)).toBe(true);
        });

        it("excludes non-media events even under the All tab", () => {
            expect(eventMatchesCategory(mkMedia(MsgType.Text), FileCategory.All)).toBe(false);
        });

        it("matches only the exact category for typed tabs", () => {
            const image = mkMedia(MsgType.Image);
            expect(eventMatchesCategory(image, FileCategory.Media)).toBe(true);
            expect(eventMatchesCategory(image, FileCategory.Files)).toBe(false);
            expect(eventMatchesCategory(image, FileCategory.Voice)).toBe(false);
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
            const filter = buildFileEventFilter(FileCategory.Media, "cat");
            expect(filter(mkMedia(MsgType.Image, { body: "cat.png" }))).toBe(true);
            // right category, wrong name
            expect(filter(mkMedia(MsgType.Image, { body: "dog.png" }))).toBe(false);
            // right name, wrong category
            expect(filter(mkMedia(MsgType.File, { body: "cat.png" }))).toBe(false);
        });

        it("with All + empty term passes every media event and rejects non-media", () => {
            const filter = buildFileEventFilter(FileCategory.All, "");
            expect(filter(mkMedia(MsgType.Video))).toBe(true);
            expect(filter(mkMedia(MsgType.Text))).toBe(false);
        });
    });

    describe("FILE_CATEGORY_TABS", () => {
        it("lists All first then the typed categories in display order", () => {
            expect(FILE_CATEGORY_TABS).toEqual([
                FileCategory.All,
                FileCategory.Media,
                FileCategory.Files,
                FileCategory.Music,
                FileCategory.Voice,
            ]);
        });
    });
});
