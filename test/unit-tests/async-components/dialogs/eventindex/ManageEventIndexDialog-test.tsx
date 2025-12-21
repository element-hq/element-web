/*
Copyright 2025 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen } from "jest-matrix-react";

import ManageEventIndexDialog from "../../../../../src/async-components/views/dialogs/eventindex/ManageEventIndexDialog";
import Modal from "../../../../../src/Modal";
import EventIndexPeg from "../../../../../src/indexing/EventIndexPeg";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";
import SdkConfig from "../../../../../src/SdkConfig";
import { flushPromises } from "../../../../test-utils";

describe("<ManageEventIndexDialog />", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    const mockEventIndex = {
        getStats: jest.fn().mockResolvedValue({ size: 1234, eventCount: 12, roomCount: 2 }),
        crawlingRooms: jest.fn().mockReturnValue({
            crawlingRooms: new Set(["!room1:example.org"]),
            totalRooms: new Set(["!room1:example.org", "!room2:example.org"]),
        }),
        currentRoom: jest.fn().mockReturnValue({ name: "Room A" }),
        on: jest.fn(),
        removeListener: jest.fn(),
    };

    function setUpDefaults(tokenizerMode: "ngram" | "language" = "language"): void {
        jest.spyOn(SdkConfig, "get").mockReturnValue({ brand: "Element" } as any);
        jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
        jest.spyOn(SettingsStore, "getValueAt").mockImplementation((_level, settingName): any => {
            if (settingName === "tokenizerMode") return tokenizerMode;
            if (settingName === "crawlerSleepTime") return 3000;
            return undefined;
        });
        jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined as any);
    }

    it("closes directly when tokenizer mode is unchanged", async () => {
        setUpDefaults("language");
        const onFinished = jest.fn();
        const createDialogSpy = jest.spyOn(Modal, "createDialog").mockReturnValue({} as any);

        render(<ManageEventIndexDialog onFinished={onFinished} />);
        await flushPromises();

        fireEvent.click(screen.getByRole("button", { name: /done/i }));

        expect(createDialogSpy).not.toHaveBeenCalled();
        expect(onFinished).toHaveBeenCalled();
    });

    it("opens confirm dialog and saves tokenizer mode when confirmed", async () => {
        setUpDefaults("language");
        const onFinished = jest.fn();
        const setValueSpy = jest.spyOn(SettingsStore, "setValue");

        jest.spyOn(Modal, "createDialog").mockImplementation((_Component, props?: any) => {
            props?.onFinished(true);
            return {} as any;
        });

        render(<ManageEventIndexDialog onFinished={onFinished} />);
        await flushPromises();

        fireEvent.change(screen.getByRole("combobox"), { target: { value: "ngram" } });
        fireEvent.click(screen.getByRole("button", { name: /done/i }));
        await flushPromises();

        expect(setValueSpy).toHaveBeenCalledWith("tokenizerMode", null, SettingLevel.DEVICE, "ngram");
        expect(onFinished).toHaveBeenCalled();
    });

    it("opens confirm dialog and reverts tokenizer mode when cancelled", async () => {
        setUpDefaults("language");
        const onFinished = jest.fn();
        const setValueSpy = jest.spyOn(SettingsStore, "setValue");

        jest.spyOn(Modal, "createDialog").mockImplementation((_Component, props?: any) => {
            props?.onFinished(false);
            return {} as any;
        });

        render(<ManageEventIndexDialog onFinished={onFinished} />);
        await flushPromises();

        fireEvent.change(screen.getByRole("combobox"), { target: { value: "ngram" } });
        fireEvent.click(screen.getByRole("button", { name: /done/i }));
        await flushPromises();

        expect(setValueSpy).toHaveBeenCalledWith("tokenizerMode", null, SettingLevel.DEVICE, "language");
        expect(onFinished).toHaveBeenCalled();
    });
});
