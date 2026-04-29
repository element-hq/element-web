/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import Modal from "../../../../src/Modal";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { createSection, editSection, deleteSection } from "../../../../src/stores/room-list-v3/section";
import { CreateSectionDialog } from "../../../../src/components/views/dialogs/CreateSectionDialog";
import { RemoveSectionDialog } from "../../../../src/components/views/dialogs/RemoveSectionDialog";
import { MetaSpace } from "../../../../src/stores/spaces";

describe("section", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("createSection", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(null);
            jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
        });

        it.each([
            [false, "", undefined] as const,
            [true, "", undefined] as const,
            [true, "My Section", expect.stringMatching(/^element\.io\.section\./)],
        ])("returns %s when shouldCreate=%s and name='%s'", async (shouldCreate, name, expected) => {
            jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([shouldCreate, name]),
                close: jest.fn(),
            } as any);

            const result = await createSection(MetaSpace.Home);
            expect(result).toEqual(expected);
        });

        it("returns the new tag when section is created", async () => {
            jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([true, "My Section"]),
                close: jest.fn(),
            } as any);

            const result = await createSection(MetaSpace.Home);
            expect(result).toMatch(/^element\.io\.section\./);
        });

        it("opens the CreateSectionDialog", async () => {
            const createDialogSpy = jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([false, ""]),
                close: jest.fn(),
            } as any);

            await createSection(MetaSpace.Home);
            expect(createDialogSpy).toHaveBeenCalledWith(CreateSectionDialog);
        });

        it("saves section data and ordered sections at ACCOUNT level when confirmed", async () => {
            const existingTag = "element.io.section.existing";
            jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "element.io.prototype.RoomList.OrderedCustomSections") return { [MetaSpace.Home]: [existingTag] };
                return null;
            });
            jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([true, "My Section"]),
                close: jest.fn(),
            } as any);
            const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await createSection(MetaSpace.Home);

            const customDataCall = setValueSpy.mock.calls.find(
                ([name]) => name === "element.io.prototype.RoomList.CustomSectionData",
            );
            const savedSection = Object.values(
                customDataCall![3] as Record<string, { tag: string; name: string; spaceId: string }>,
            )[0];
            expect(savedSection.name).toBe("My Section");
            expect(savedSection.tag).toMatch(/^element\.io\.section\./);

            const orderedCall = setValueSpy.mock.calls.find(
                ([name]) => name === "element.io.prototype.RoomList.OrderedCustomSections",
            );
            const savedOrder = orderedCall![3] as Record<string, string[]>;
            expect(savedOrder[MetaSpace.Home][0]).toBe(existingTag);
            expect(savedOrder[MetaSpace.Home][1]).toMatch(/^element\.io\.section\./);
        });
    });

    describe("editSection", () => {
        const tag = "element.io.section.abc";
        const existingSectionData = { [tag]: { tag, name: "Old Name", spaceId: MetaSpace.Home } };

        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(existingSectionData);
            jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
        });

        it("does nothing if the section does not exist", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue({});
            const createDialogSpy = jest.spyOn(Modal, "createDialog");

            await editSection(tag);
            expect(createDialogSpy).not.toHaveBeenCalled();
        });

        it("opens the CreateSectionDialog with the current section name", async () => {
            const createDialogSpy = jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([false, ""]),
                close: jest.fn(),
            } as any);

            await editSection(tag);
            expect(createDialogSpy).toHaveBeenCalledWith(CreateSectionDialog, { sectionToEdit: "Old Name" });
        });

        it.each([
            [false, "New Name"],
            [true, ""],
            [true, "Old Name"],
        ])("does not save when shouldEdit=%s and name='%s'", async (shouldEdit, name) => {
            jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([shouldEdit, name]),
                close: jest.fn(),
            } as any);
            const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await editSection(tag);
            expect(setValueSpy).not.toHaveBeenCalled();
        });

        it("saves the new name when confirmed with a different name", async () => {
            jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([true, "New Name"]),
                close: jest.fn(),
            } as any);
            const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await editSection(tag);

            expect(setValueSpy).toHaveBeenCalledWith(
                "element.io.prototype.RoomList.CustomSectionData",
                null,
                expect.anything(),
                expect.objectContaining({ [tag]: { tag, name: "New Name", spaceId: MetaSpace.Home } }),
            );
        });
    });

    describe("deleteSection", () => {
        const tag = "element.io.section.abc";
        const otherTag = "element.io.section.other";

        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (setting): ReturnType<(typeof SettingsStore)["getValue"]> => {
                    if (setting === "element.io.prototype.RoomList.CustomSectionData")
                        return { [tag]: { tag, name: "My Section", spaceId: MetaSpace.Home } };
                    if (setting === "element.io.prototype.RoomList.OrderedCustomSections")
                        return { [MetaSpace.Home]: [otherTag, tag] };
                    return null;
                },
            );
            jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
        });

        it("does nothing if the section does not exist", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue({});
            const createDialogSpy = jest.spyOn(Modal, "createDialog");

            await deleteSection(tag, false);
            expect(createDialogSpy).not.toHaveBeenCalled();
        });

        it.each([
            [true, "empty"],
            [false, "non-empty"],
        ])("opens the RemoveSectionDialog with isEmpty=%s for %s section", async (isEmpty) => {
            const createDialogSpy = jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([false]),
                close: jest.fn(),
            } as any);

            await deleteSection(tag, isEmpty);
            expect(createDialogSpy).toHaveBeenCalledWith(RemoveSectionDialog, { isEmpty });
        });

        it("does not save when user cancels", async () => {
            jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([false]),
                close: jest.fn(),
            } as any);
            const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await deleteSection(tag, false);
            expect(setValueSpy).not.toHaveBeenCalled();
        });

        it("removes the section from ordered list and section data when confirmed", async () => {
            jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([true]),
                close: jest.fn(),
            } as any);
            const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await deleteSection(tag, false);

            const orderedCall = setValueSpy.mock.calls.find(
                ([name]) => name === "element.io.prototype.RoomList.OrderedCustomSections",
            );
            expect(orderedCall![3]).toEqual({ [MetaSpace.Home]: [otherTag] });

            const customDataCall = setValueSpy.mock.calls.find(
                ([name]) => name === "element.io.prototype.RoomList.CustomSectionData",
            );
            expect(customDataCall![3]).not.toHaveProperty(tag);
        });
    });
});
