/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import Modal from "../../../../src/Modal";
import SettingsStore from "../../../../src/settings/SettingsStore";
import {
    createSection,
    editSection,
    deleteSection,
    getCustomSectionData,
    getOrderedCustomSections,
    getOrderedReorderableSections,
    isDefaultSectionTag,
    isSectionExpanded,
    setSectionExpanded,
    CHATS_TAG,
    CUSTOM_SECTION_TAG_PREFIX,
    isSectionTag,
    reorderSection,
} from "../../../../src/stores/room-list-v3/section";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import { CreateSectionDialog } from "../../../../src/components/views/dialogs/CreateSectionDialog";
import { RemoveSectionDialog } from "../../../../src/components/views/dialogs/RemoveSectionDialog";
import { DefaultTagID } from "../../../../src/stores/room-list-v3/skip-list/tag";
import { MetaSpace } from "../../../../src/stores/spaces";
import { SDKContextClass } from "../../../../src/contexts/SDKContextClass.ts";

describe("section", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("getCustomSectionData", () => {
        const validTag = "element.io.section.valid";
        const invalidTag = "element.io.section.invalid";
        const validEntry = { tag: validTag, name: "Valid" };

        beforeEach(() => {
            // Default: no known spaces
            jest.spyOn(SDKContextClass.instance.spaceStore, "enabledMetaSpaces", "get").mockReturnValue([]);
            jest.spyOn(SDKContextClass.instance.spaceStore, "spacePanelSpaces", "get").mockReturnValue([]);
        });

        it.each([null, false, 42, "string", []] as const)("returns an empty object when the raw value is %p", (raw) => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(raw as any);
            expect(getCustomSectionData()).toEqual({});
        });

        it("returns valid entries and drops invalid ones, defaulting spaceId to MetaSpace.Home", () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue({
                [validTag]: validEntry,
                [invalidTag]: { tag: "element.io.section.mismatch", name: "Bad" },
            });
            expect(getCustomSectionData()).toEqual({ [validTag]: { ...validEntry, spaceId: MetaSpace.Home } });
        });

        it("drops entries that fail the isValidCustomSection check", () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue({
                "element.io.section.null-val": null,
                "element.io.section.str-val": "not-an-object",
                "element.io.section.bad-tag": { tag: "not-a-custom-tag", name: "Bad" },
                "element.io.section.bad-name": { tag: "element.io.section.bad-name", name: 42 },
            });
            expect(getCustomSectionData()).toEqual({});
        });

        it("defaults spaceId to MetaSpace.Home when spaceId is missing", () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue({ [validTag]: validEntry });
            expect(getCustomSectionData()[validTag].spaceId).toBe(MetaSpace.Home);
        });

        it("defaults spaceId to MetaSpace.Home when the stored space does not exist", () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue({
                [validTag]: { ...validEntry, spaceId: "!gone:server" },
            });
            // spacePanelSpaces is empty (default mock), so !gone:server is unknown
            expect(getCustomSectionData()[validTag].spaceId).toBe(MetaSpace.Home);
        });

        it("keeps spaceId when the meta-space is enabled", () => {
            jest.spyOn(SDKContextClass.instance.spaceStore, "enabledMetaSpaces", "get").mockReturnValue([
                MetaSpace.Home,
            ]);
            jest.spyOn(SettingsStore, "getValue").mockReturnValue({
                [validTag]: { ...validEntry, spaceId: MetaSpace.Home },
            });
            expect(getCustomSectionData()[validTag].spaceId).toBe(MetaSpace.Home);
        });

        it("keeps spaceId when the real space room exists", () => {
            const spaceId = "!space:server";
            jest.spyOn(SDKContextClass.instance.spaceStore, "spacePanelSpaces", "get").mockReturnValue([
                { roomId: spaceId } as Room,
            ]);
            jest.spyOn(SettingsStore, "getValue").mockReturnValue({
                [validTag]: { ...validEntry, spaceId },
            });
            expect(getCustomSectionData()[validTag].spaceId).toBe(spaceId);
        });
    });

    describe("getOrderedCustomSections", () => {
        const tag = "element.io.section.abc";

        beforeEach(() => {
            jest.spyOn(SDKContextClass.instance.spaceStore, "enabledMetaSpaces", "get").mockReturnValue([]);
            jest.spyOn(SDKContextClass.instance.spaceStore, "spacePanelSpaces", "get").mockReturnValue([]);
        });

        it("returns an empty array when the raw value is not an array", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.OrderedCustomSections") return "not-an-array";
                return null;
            });

            const result = getOrderedCustomSections();
            expect(result).toEqual([]);
        });

        it("removes unknown sections and saves the cleaned list", () => {
            const knownTag = "element.io.section.known";
            jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.CustomSectionData") return { [knownTag]: { tag: knownTag, name: "Known" } };
                if (setting === "RoomList.OrderedCustomSections") return [knownTag, tag];
                return null;
            });

            expect(getOrderedCustomSections()).toEqual([knownTag]);
        });
    });

    describe("isSectionExpanded", () => {
        const spaceId = "!space:server";
        const tag = "element.io.section.abc";

        it.each([
            { value: {}, result: true },
            { value: { "!other:server": { [tag]: false } }, result: true },
            { value: { [spaceId]: { "other.tag": false } }, result: true },
            { value: { [spaceId]: { [tag]: false } }, result: false },
        ])("returns the persisted state=$result when value=$value", ({ value, result }) => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(value);
            expect(isSectionExpanded(spaceId, tag)).toBe(result);
        });
    });

    describe("setSectionExpanded", () => {
        const spaceId = "!space:server";
        const tag = "element.io.section.abc";

        it("persists the state at the device level", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue({});
            const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await setSectionExpanded(spaceId, tag, false);

            expect(setValueSpy).toHaveBeenCalledWith("RoomList.SectionExpansionState", null, SettingLevel.DEVICE, {
                [spaceId]: { [tag]: false },
            });
        });

        it("merges with existing state for other spaces and tags", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue({
                "!other:server": { "other.tag": false },
                [spaceId]: { "existing.tag": true },
            });
            const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await setSectionExpanded(spaceId, tag, false);

            expect(setValueSpy).toHaveBeenCalledWith("RoomList.SectionExpansionState", null, SettingLevel.DEVICE, {
                "!other:server": { "other.tag": false },
                [spaceId]: { "existing.tag": true, [tag]: false },
            });
        });

        it("overwrites the previous state for the same space and tag", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue({ [spaceId]: { [tag]: false } });
            const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await setSectionExpanded(spaceId, tag, true);

            expect(setValueSpy).toHaveBeenCalledWith("RoomList.SectionExpansionState", null, SettingLevel.DEVICE, {
                [spaceId]: { [tag]: true },
            });
        });
    });

    describe("createSection", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(null);
            jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
            jest.spyOn(SDKContextClass.instance.spaceStore, "enabledMetaSpaces", "get").mockReturnValue([]);
            jest.spyOn(SDKContextClass.instance.spaceStore, "spacePanelSpaces", "get").mockReturnValue([]);
        });

        it.each([
            [false, "", undefined],
            [true, "", undefined],
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
                if (setting === "RoomList.OrderedCustomSections") return [existingTag];
                if (setting === "RoomList.CustomSectionData")
                    return { [existingTag]: { tag: existingTag, name: "Existing" } };
                return null;
            });
            jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([true, "My Section"]),
                close: jest.fn(),
            } as any);
            const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await createSection(MetaSpace.Home);

            const orderedCall = setValueSpy.mock.calls.find(([name]) => name === "RoomList.OrderedCustomSections");
            const savedOrder = orderedCall![3] as string[];
            // The new section is added just before CHATS_TAG, after the existing sections
            expect(savedOrder[0]).toBe(DefaultTagID.DM);
            expect(savedOrder[1]).toBe(existingTag);
            expect(savedOrder[2]).toMatch(/^element\.io\.section\./);
            expect(savedOrder[3]).toBe(CHATS_TAG);

            const newTag = savedOrder[2];
            const customDataCall = setValueSpy.mock.calls.find(([name]) => name === "RoomList.CustomSectionData");
            const savedSection = (customDataCall![3] as Record<string, { tag: string; name: string; spaceId: string }>)[
                newTag
            ];
            expect(savedSection.name).toBe("My Section");
            expect(savedSection.tag).toBe(newTag);
            expect(savedSection.spaceId).toBe(MetaSpace.Home);
        });
    });

    describe("editSection", () => {
        const tag = "element.io.section.abc";
        const existingSectionData = { [tag]: { tag, name: "Old Name" } };

        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(existingSectionData);
            jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
        });

        it("does nothing if the tag is not a custom section tag", async () => {
            const createDialogSpy = jest.spyOn(Modal, "createDialog");
            await editSection("m.favourite");
            expect(createDialogSpy).not.toHaveBeenCalled();
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
                "RoomList.CustomSectionData",
                null,
                expect.anything(),
                expect.objectContaining({ [tag]: expect.objectContaining({ tag, name: "New Name" }) }),
            );
        });
    });

    describe("deleteSection", () => {
        const tag = "element.io.section.abc";
        const otherTag = "element.io.section.other";

        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.CustomSectionData")
                    return { [tag]: { tag, name: "My Section" }, [otherTag]: { tag: otherTag, name: "Other Section" } };
                if (setting === "RoomList.OrderedCustomSections") return [otherTag, tag];
                return null;
            });
            jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
        });

        it("does nothing if the tag is not a custom section tag", async () => {
            const createDialogSpy = jest.spyOn(Modal, "createDialog");
            await deleteSection("m.favourite", false);
            expect(createDialogSpy).not.toHaveBeenCalled();
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

            const orderedCall = setValueSpy.mock.calls.find(([name]) => name === "RoomList.OrderedCustomSections");
            // The DM tag is prepended and CHATS_TAG appended because the stored order didn't
            // include them (legacy default positions).
            expect(orderedCall![3]).toEqual([DefaultTagID.DM, otherTag, CHATS_TAG]);

            const customDataCall = setValueSpy.mock.calls.find(([name]) => name === "RoomList.CustomSectionData");
            expect(customDataCall![3]).not.toHaveProperty(tag);
        });
    });

    describe("getOrderedReorderableSections", () => {
        const customTag = `${CUSTOM_SECTION_TAG_PREFIX}abc`;

        function mockStoredOrder(orderedTags: string[]): void {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.OrderedCustomSections") return orderedTags;
                if (setting === "RoomList.CustomSectionData") return { [customTag]: { tag: customTag, name: "A" } };
                return null;
            });
        }

        it.each<{ description: string; stored: string[]; expected: string[] }>([
            {
                description: "keeps the stored position of the People and Chats tags",
                stored: [customTag, CHATS_TAG, DefaultTagID.DM],
                expected: [customTag, CHATS_TAG, DefaultTagID.DM],
            },
            {
                description: "prepends the People tag and appends the Chats tag when they are missing",
                stored: [customTag],
                expected: [DefaultTagID.DM, customTag, CHATS_TAG],
            },
            {
                description: "drops unknown custom sections",
                stored: [DefaultTagID.DM, `${CUSTOM_SECTION_TAG_PREFIX}unknown`, CHATS_TAG],
                expected: [DefaultTagID.DM, CHATS_TAG],
            },
        ])("$description", ({ stored, expected }) => {
            mockStoredOrder(stored);
            expect(getOrderedReorderableSections()).toEqual(expected);
        });
    });

    describe("reorderSection", () => {
        const customTag = `${CUSTOM_SECTION_TAG_PREFIX}abc`;
        const customTag2 = `${CUSTOM_SECTION_TAG_PREFIX}def`;

        function mockSettings(
            orderedTags: string[],
            customData: Record<string, { tag: string; name: string }> = {},
        ): void {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.OrderedCustomSections") return orderedTags;
                if (setting === "RoomList.CustomSectionData") return customData;
                return null;
            });
        }

        it.each<{
            description: string;
            initial: string[];
            customData: Record<string, { tag: string; name: string }>;
            source: string;
            target: string;
            expected: string[];
        }>([
            {
                description: "a custom section after another custom section",
                initial: [customTag, customTag2],
                customData: {
                    [customTag]: { tag: customTag, name: "A" },
                    [customTag2]: { tag: customTag2, name: "B" },
                },
                source: customTag,
                target: customTag2,
                expected: [DefaultTagID.DM, customTag2, customTag, CHATS_TAG],
            },
            {
                description: "a custom section before another when dragging up",
                initial: [customTag2, customTag],
                customData: {
                    [customTag]: { tag: customTag, name: "A" },
                    [customTag2]: { tag: customTag2, name: "B" },
                },
                source: customTag,
                target: customTag2,
                expected: [DefaultTagID.DM, customTag, customTag2, CHATS_TAG],
            },
            {
                description: "a custom section past the Chats tag",
                initial: [customTag, customTag2, CHATS_TAG],
                customData: {
                    [customTag]: { tag: customTag, name: "A" },
                    [customTag2]: { tag: customTag2, name: "B" },
                },
                source: customTag,
                target: CHATS_TAG,
                expected: [DefaultTagID.DM, customTag2, CHATS_TAG, customTag],
            },
            {
                description: "the Chats tag above a custom section",
                initial: [customTag, customTag2, CHATS_TAG],
                customData: {
                    [customTag]: { tag: customTag, name: "A" },
                    [customTag2]: { tag: customTag2, name: "B" },
                },
                source: CHATS_TAG,
                target: customTag,
                expected: [DefaultTagID.DM, CHATS_TAG, customTag, customTag2],
            },
            {
                description: "the People tag past the Chats tag",
                initial: [DefaultTagID.DM, customTag, CHATS_TAG],
                customData: { [customTag]: { tag: customTag, name: "A" } },
                source: DefaultTagID.DM,
                target: CHATS_TAG,
                expected: [customTag, CHATS_TAG, DefaultTagID.DM],
            },
            {
                description: "a custom section above the People tag",
                initial: [DefaultTagID.DM, customTag, CHATS_TAG],
                customData: { [customTag]: { tag: customTag, name: "A" } },
                source: customTag,
                target: DefaultTagID.DM,
                expected: [customTag, DefaultTagID.DM, CHATS_TAG],
            },
        ])(
            "moves $description and saves the new order at ACCOUNT level",
            async ({ initial, customData, source, target, expected }) => {
                mockSettings(initial, customData);
                const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

                await reorderSection(source, target);

                expect(setValueSpy).toHaveBeenCalledWith(
                    "RoomList.OrderedCustomSections",
                    null,
                    expect.anything(),
                    expected,
                );
            },
        );

        it.each([
            {
                description: "source and target are the same",
                source: customTag,
                target: customTag,
            },
            {
                description: "source custom section is not in the ordered list",
                source: `${CUSTOM_SECTION_TAG_PREFIX}unknown`,
                target: customTag,
            },
            {
                description: "target custom section is not in the ordered list",
                source: customTag,
                target: `${CUSTOM_SECTION_TAG_PREFIX}unknown`,
            },
            {
                description: "source is a default section",
                source: DefaultTagID.Favourite,
                target: customTag,
            },
        ])("does nothing when $description", async ({ source, target }) => {
            mockSettings([customTag], { [customTag]: { tag: customTag, name: "A" } });
            const setValueSpy = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await reorderSection(source, target);

            expect(setValueSpy).not.toHaveBeenCalled();
        });
    });

    describe("isDefaultSectionTag", () => {
        it.each([DefaultTagID.Favourite, DefaultTagID.LowPriority, CHATS_TAG, DefaultTagID.DM])(
            "returns true for %s",
            (tag) => {
                expect(isDefaultSectionTag(tag)).toBe(true);
            },
        );

        it.each([DefaultTagID.Invite, "some.random.tag"])("returns false for %s", (tag) => {
            expect(isDefaultSectionTag(tag)).toBe(false);
        });
    });

    describe("isSectionTag", () => {
        it.each([
            DefaultTagID.Favourite,
            DefaultTagID.LowPriority,
            CHATS_TAG,
            DefaultTagID.DM,
            `${CUSTOM_SECTION_TAG_PREFIX}some-uuid`,
        ])("returns true for %s", (tag) => {
            expect(isSectionTag(tag)).toBe(true);
        });

        it.each([DefaultTagID.Invite, "some.random.tag"])("returns false for %s", (tag) => {
            expect(isSectionTag(tag)).toBe(false);
        });
    });
});
