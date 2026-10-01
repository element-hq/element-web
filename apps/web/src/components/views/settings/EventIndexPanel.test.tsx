/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, within } from "test-utils-rtl";
import { clearAllModals, flushPromises, getMockClientWithEventEmitter } from "test-utils";

import EventIndexPanel from "./EventIndexPanel";
import EventIndexPeg from "../../../indexing/EventIndexPeg";
import EventIndex from "../../../indexing/EventIndex";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";

describe("<EventIndexPanel />", () => {
    getMockClientWithEventEmitter({
        getRooms: vi.fn().mockReturnValue([]),
    });

    const getComponent = () => render(<EventIndexPanel />);

    beforeEach(() => {
        vi.spyOn(EventIndexPeg, "get").mockRestore();
        vi.spyOn(EventIndexPeg, "platformHasSupport").mockReturnValue(false);
        vi.spyOn(EventIndexPeg, "supportIsInstalled").mockReturnValue(false);
        vi.spyOn(EventIndexPeg, "initEventIndex").mockClear().mockResolvedValue(true);
        vi.spyOn(EventIndexPeg, "deleteEventIndex").mockClear();
        vi.spyOn(SettingsStore, "getValueAt").mockReturnValue(false);
        vi.spyOn(SettingsStore, "setValue").mockClear();

        // @ts-ignore private property
        EventIndexPeg.error = null;
    });

    afterEach(async () => {
        await clearAllModals();
    });

    describe("when event index is initialised", () => {
        it("renders event index information", () => {
            vi.spyOn(EventIndexPeg, "get").mockReturnValue(new EventIndex());

            const { container } = getComponent();

            expect(container).toMatchSnapshot();
        });

        it("opens event index management dialog", async () => {
            vi.spyOn(EventIndexPeg, "get").mockReturnValue(new EventIndex());
            getComponent();

            fireEvent.click(screen.getByText("Manage"));

            const dialog = await screen.findByRole("dialog");
            expect(within(dialog).getByText("Message search")).toBeInTheDocument();

            // close the modal
            fireEvent.click(within(dialog).getByText("Done"));
        });
    });

    describe("when event indexing is fully supported and enabled but not initialised", () => {
        beforeEach(() => {
            vi.spyOn(EventIndexPeg, "supportIsInstalled").mockReturnValue(true);
            vi.spyOn(EventIndexPeg, "platformHasSupport").mockReturnValue(true);
            vi.spyOn(SettingsStore, "getValueAt").mockReturnValue(true);

            // @ts-ignore private property
            EventIndexPeg.error = new Error("Test error message");
        });

        it("displays an error when no event index is found and enabling not in progress", () => {
            getComponent();

            expect(screen.getByText("Message search initialisation failed")).toBeInTheDocument();
        });

        it("displays an error from the event index", () => {
            getComponent();

            expect(screen.getByText("Test error message")).toBeInTheDocument();
        });

        it("asks for confirmation when resetting seshat", async () => {
            getComponent();

            fireEvent.click(screen.getByText("Reset"));

            // wait for reset modal to open
            await screen.findByText("Reset event store?");
            const dialog = await screen.findByRole("dialog");

            expect(within(dialog).getByText("Reset event store?")).toBeInTheDocument();
            fireEvent.click(within(dialog).getByText("Cancel"));

            // didn't reset
            expect(SettingsStore.setValue).not.toHaveBeenCalled();
            expect(EventIndexPeg.deleteEventIndex).not.toHaveBeenCalled();
        });

        it("resets seshat", async () => {
            getComponent();

            fireEvent.click(screen.getByText("Reset"));

            // wait for reset modal to open
            await screen.findByText("Reset event store?");
            const dialog = await screen.findByRole("dialog");

            fireEvent.click(within(dialog).getByText("Reset event store"));

            await flushPromises();

            expect(SettingsStore.setValue).toHaveBeenCalledWith(
                "enableEventIndexing",
                null,
                SettingLevel.DEVICE,
                false,
            );
            expect(EventIndexPeg.deleteEventIndex).toHaveBeenCalled();

            await clearAllModals();
        });
    });

    describe("when event indexing is supported but not enabled", () => {
        it("renders enable text", () => {
            vi.spyOn(EventIndexPeg, "supportIsInstalled").mockReturnValue(true);

            getComponent();

            expect(
                screen.getByText("Securely cache encrypted messages locally for them to appear in search results."),
            ).toBeInTheDocument();
        });
        it("enables event indexing on enable button click", async () => {
            vi.spyOn(EventIndexPeg, "supportIsInstalled").mockReturnValue(true);
            let deferredInitEventIndex: PromiseWithResolvers<boolean> | undefined;
            vi.spyOn(EventIndexPeg, "initEventIndex").mockImplementation(() => {
                deferredInitEventIndex = Promise.withResolvers<boolean>();
                return deferredInitEventIndex.promise;
            });

            getComponent();

            fireEvent.click(screen.getByText("Enable"));

            await flushPromises();
            // spinner shown while enabling
            expect(screen.getByLabelText("Loading…")).toBeInTheDocument();

            // add an event indx to the peg and resolve the init promise
            vi.spyOn(EventIndexPeg, "get").mockReturnValue(new EventIndex());
            expect(EventIndexPeg.initEventIndex).toHaveBeenCalled();
            deferredInitEventIndex!.resolve(true);
            await flushPromises();
            expect(SettingsStore.setValue).toHaveBeenCalledWith("enableEventIndexing", null, SettingLevel.DEVICE, true);

            // message for enabled event index
            expect(
                screen.getByText(
                    "Securely cache encrypted messages locally for them to appear in search results, using 0 Bytes to store messages from 0 rooms.",
                ),
            ).toBeInTheDocument();
        });
    });

    describe("when event indexing is supported but not installed", () => {
        it("renders link to install seshat", () => {
            vi.spyOn(EventIndexPeg, "supportIsInstalled").mockReturnValue(false);
            vi.spyOn(EventIndexPeg, "platformHasSupport").mockReturnValue(true);

            const { container } = getComponent();

            expect(container).toMatchSnapshot();
        });
    });

    describe("when event indexing is not supported", () => {
        it("renders link to download a desktop client", () => {
            vi.spyOn(EventIndexPeg, "platformHasSupport").mockReturnValue(false);

            const { container } = getComponent();

            expect(container).toMatchSnapshot();
        });
    });
});
