/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";
import { flushPdfViewerState, getPdfViewerState, PDF_VIEWER_STATE_LIMIT, setPdfViewerState } from "./pdfViewerState";

const position = { page: 3, scale: 150, left: 20, top: 400 };

describe("pdfViewerState", () => {
    beforeEach(async () => {
        // A previous test may have left a write sitting in the debounce, and the timer it is waiting
        // on does not survive being swapped back to fake timers.
        flushPdfViewerState();
        await SettingsStore.setValue("pdfViewerState", null, SettingLevel.DEVICE, {});
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("reads back a position before it has been written out", () => {
        setPdfViewerState("mxc://example.org/one", position);

        // The write is still sitting in the debounce, but reopening the file in the meantime must
        // still land in the right place.
        expect(SettingsStore.getValue("pdfViewerState")).toEqual({});
        expect(getPdfViewerState("mxc://example.org/one")).toMatchObject(position);
    });

    it("coalesces a burst of positions into a single write", async () => {
        const setValue = vi.spyOn(SettingsStore, "setValue");

        for (let top = 0; top < 20; top++) setPdfViewerState("mxc://example.org/one", { ...position, top });

        await vi.runAllTimersAsync();

        expect(setValue).toHaveBeenCalledTimes(1);
        expect(SettingsStore.getValue("pdfViewerState")["mxc://example.org/one"]).toMatchObject({
            ...position,
            top: 19,
        });
    });

    it("writes a pending position out immediately when flushed", async () => {
        setPdfViewerState("mxc://example.org/one", position);
        flushPdfViewerState();
        await vi.runAllTimersAsync();

        expect(SettingsStore.getValue("pdfViewerState")["mxc://example.org/one"]).toMatchObject(position);
    });

    it("keeps positions for other files that were written in the meantime", async () => {
        setPdfViewerState("mxc://example.org/one", position);
        flushPdfViewerState();
        await vi.runAllTimersAsync();

        setPdfViewerState("mxc://example.org/two", { ...position, page: 9 });
        flushPdfViewerState();
        await vi.runAllTimersAsync();

        expect(Object.keys(SettingsStore.getValue("pdfViewerState"))).toEqual([
            "mxc://example.org/one",
            "mxc://example.org/two",
        ]);
    });

    it("drops the least recently read files once the map is full", async () => {
        for (let index = 0; index <= PDF_VIEWER_STATE_LIMIT; index++) {
            // Advance between writes so the entries have distinct timestamps to sort on.
            vi.setSystemTime(index * 1000);
            setPdfViewerState(`mxc://example.org/${index}`, position);
            flushPdfViewerState();
            await vi.runAllTimersAsync();
        }

        const stored = SettingsStore.getValue("pdfViewerState");

        expect(Object.keys(stored)).toHaveLength(PDF_VIEWER_STATE_LIMIT);
        expect(stored["mxc://example.org/0"]).toBeUndefined();
        expect(stored[`mxc://example.org/${PDF_VIEWER_STATE_LIMIT}`]).toBeDefined();
    });
});
