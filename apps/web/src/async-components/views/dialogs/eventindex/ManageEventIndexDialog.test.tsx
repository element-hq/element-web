/*
Copyright 2026 Hiroshi Shinaoka
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "test-utils-rtl";
import { flushPromises } from "test-utils";

import ManageEventIndexDialog from "./ManageEventIndexDialog";
import Modal from "../../../../Modal";
import EventIndexPeg from "../../../../indexing/EventIndexPeg";
import SettingsStore from "../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../settings/SettingLevel";
import SdkConfig from "../../../../SdkConfig";

describe("<ManageEventIndexDialog />", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const mockEventIndex = {
        getStats: vi.fn().mockResolvedValue({ size: 1234, eventCount: 12, roomCount: 2 }),
        crawlingRooms: vi.fn().mockReturnValue({
            crawlingRooms: new Set(["!room1:example.org"]),
            totalRooms: new Set(["!room1:example.org", "!room2:example.org"]),
        }),
        currentRoom: vi.fn().mockReturnValue({ name: "Room A" }),
        on: vi.fn(),
        removeListener: vi.fn(),
    };

    function setUpDefaults(tokenizerMode: "ngram" | "language" = "language"): void {
        vi.spyOn(SdkConfig, "get").mockReturnValue({ brand: "Element" } as any);
        vi.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
        vi.spyOn(SettingsStore, "getValueAt").mockImplementation((_level, settingName): any => {
            if (settingName === "tokenizerMode") return tokenizerMode;
            if (settingName === "crawlerSleepTime") return 3000;
            return undefined;
        });
        vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined as any);
    }

    it("closes directly when tokenizer mode is unchanged", async () => {
        setUpDefaults("language");
        const onFinished = vi.fn();
        const createDialogSpy = vi.spyOn(Modal, "createDialog").mockReturnValue({} as any);

        render(<ManageEventIndexDialog onFinished={onFinished} />);
        await flushPromises();

        fireEvent.click(screen.getByRole("button", { name: /done/i }));

        expect(createDialogSpy).not.toHaveBeenCalled();
        expect(onFinished).toHaveBeenCalled();
    });

    it("shows tokenizer mode as radio options with descriptions", async () => {
        setUpDefaults("language");

        render(<ManageEventIndexDialog onFinished={vi.fn()} />);
        await flushPromises();

        expect(screen.getByRole("heading", { name: "Search tokenizer mode" })).toBeInTheDocument();
        expect(screen.getByRole("radio", { name: "N-gram" })).toBeInTheDocument();
        expect(screen.getByRole("radio", { name: "Language-based" })).toBeChecked();
        expect(
            screen.getByText(
                "Supports all languages including those without word boundaries. Works with mixed languages.",
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                "Single language support based on your UI language. Only works with some languages (English, German, etc.).",
            ),
        ).toBeInTheDocument();
    });

    it("opens confirm dialog and saves tokenizer mode when confirmed", async () => {
        setUpDefaults("language");
        const onFinished = vi.fn();
        const setValueSpy = vi.spyOn(SettingsStore, "setValue");
        const initEventIndexSpy = vi.spyOn(EventIndexPeg, "initEventIndex").mockResolvedValue(true);

        vi.spyOn(Modal, "createDialog").mockReturnValue({
            finished: Promise.resolve([true]),
        } as any);

        render(<ManageEventIndexDialog onFinished={onFinished} />);
        await flushPromises();

        fireEvent.click(screen.getByRole("radio", { name: "N-gram" }));
        fireEvent.click(screen.getByRole("button", { name: /done/i }));

        await waitFor(() =>
            expect(setValueSpy).toHaveBeenCalledWith("tokenizerMode", null, SettingLevel.DEVICE, "ngram"),
        );
        expect(initEventIndexSpy).toHaveBeenCalled();
        expect(onFinished).toHaveBeenCalled();
    });

    it("opens confirm dialog and reverts tokenizer mode when cancelled", async () => {
        setUpDefaults("language");
        const onFinished = vi.fn();
        const setValueSpy = vi.spyOn(SettingsStore, "setValue");

        vi.spyOn(Modal, "createDialog").mockReturnValue({
            finished: Promise.resolve([false]),
        } as any);

        render(<ManageEventIndexDialog onFinished={onFinished} />);
        await flushPromises();

        fireEvent.click(screen.getByRole("radio", { name: "N-gram" }));
        fireEvent.click(screen.getByRole("button", { name: /done/i }));

        await waitFor(() =>
            expect(setValueSpy).toHaveBeenCalledWith("tokenizerMode", null, SettingLevel.DEVICE, "language"),
        );
        expect(onFinished).toHaveBeenCalled();
    });
});
