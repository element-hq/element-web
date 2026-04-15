/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import Modal from "../../../../src/Modal";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { createSection } from "../../../../src/stores/room-list-v3/section";
import { CreateSectionDialog } from "../../../../src/components/views/dialogs/CreateSectionDialog";

describe("createSection", () => {
    beforeEach(() => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(null);
        jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each([
        [false, "", false],
        [true, "", false],
        [true, "My Section", true],
    ])("returns %s when shouldCreate=%s and name='%s'", async (shouldCreate, name, expected) => {
        jest.spyOn(Modal, "createDialog").mockReturnValue({
            finished: Promise.resolve([shouldCreate, name]),
            close: jest.fn(),
        } as any);

        const result = await createSection();
        expect(result).toBe(expected);
    });

    it("opens the CreateSectionDialog", async () => {
        const createDialogSpy = jest.spyOn(Modal, "createDialog").mockReturnValue({
            finished: Promise.resolve([false, ""]),
            close: jest.fn(),
        } as any);

        await createSection();
        expect(createDialogSpy).toHaveBeenCalledWith(CreateSectionDialog);
    });

    it("saves section data and ordered sections at ACCOUNT level when confirmed", async () => {
        const existingTag = "element.io.section.existing";
        jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            if (setting === "RoomList.OrderedCustomSections") return [existingTag];
            return null;
        });
        jest.spyOn(Modal, "createDialog").mockReturnValue({
            finished: Promise.resolve([true, "My Section"]),
            close: jest.fn(),
        } as any);
        const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

        await createSection();

        const customDataCall = setValueSpy.mock.calls.find(([name]) => name === "RoomList.CustomSectionData");
        const savedSection = Object.values(customDataCall![3] as Record<string, { tag: string; name: string }>)[0];
        expect(savedSection.name).toBe("My Section");
        expect(savedSection.tag).toMatch(/^element\.io\.section\./);

        const orderedCall = setValueSpy.mock.calls.find(([name]) => name === "RoomList.OrderedCustomSections");
        const savedOrder = orderedCall![3] as string[];
        expect(savedOrder[0]).toBe(existingTag);
        expect(savedOrder[1]).toMatch(/^element\.io\.section\./);
    });
});
