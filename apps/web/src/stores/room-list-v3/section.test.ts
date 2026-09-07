/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { type Room } from "matrix-js-sdk/src/matrix";

import Modal from "../../Modal";
import SettingsStore from "../../settings/SettingsStore";
import {
    createSection,
    editSection,
    deleteSection,
    getCustomSectionData,
    getOrderedCustomSections,
    getOrderedReorderableSections,
    getOrderedSectionTags,
    isDefaultSectionTag,
    isSectionExpanded,
    setSectionExpanded,
    CHATS_TAG,
    CUSTOM_SECTION_TAG_PREFIX,
    isSectionTag,
    reorderSection,
} from "./section";
import { SettingLevel } from "../../settings/SettingLevel";
import { CreateSectionDialog } from "../../components/views/dialogs/CreateSectionDialog";
import { RemoveSectionDialog } from "../../components/views/dialogs/RemoveSectionDialog";
import { DefaultTagID } from "./skip-list/tag";
import { MetaSpace } from "../spaces";
import { SDKContextClass } from "../../contexts/SDKContextClass.ts";
import { mkStubRoom } from "test-utils";
import { tagRoom } from "../../utils/room/tagRoom.ts";

vi.mock("../../utils/room/tagRoom.ts", () => ({
    tagRoom: vi.fn(),
}));

describe("section", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.mocked(tagRoom).mockClear();
    });

    /**
     * Make the given rooms resolvable through the client.
     * @param roomIds - The ids of the rooms the client knows about.
     */
    function setupRooms(roomIds: string[]): void {
        const rooms = roomIds.map((roomId) => mkStubRoom(roomId, roomId));
        vi.spyOn(SDKContextClass.instance, "client", "get").mockReturnValue({
            getRoom: (roomId: string) => rooms.find((room) => room.roomId === roomId) ?? null,
        } as any);
    }

    describe("getCustomSectionData", () => {
        const validTag = "element.io.section.valid";
        const invalidTag = "element.io.section.invalid";
        const validEntry = { tag: validTag, name: "Valid" };

        beforeEach(() => {
            // Default: no known spaces
            vi.spyOn(SDKContextClass.instance.spaceStore, "enabledMetaSpaces", "get").mockReturnValue([]);
            vi.spyOn(SDKContextClass.instance.spaceStore, "spacePanelSpaces", "get").mockReturnValue([]);
        });

        it.each([null, false, 42, "string", []] as const)("returns an empty object when the raw value is %p", (raw) => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue(raw as any);
            expect(getCustomSectionData()).toEqual({});
        });

        it("returns valid entries and drops invalid ones, defaulting spaceId to MetaSpace.Home", () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue({
                [validTag]: validEntry,
                [invalidTag]: { tag: "element.io.section.mismatch", name: "Bad" },
            });
            expect(getCustomSectionData()).toEqual({ [validTag]: { ...validEntry, spaceId: MetaSpace.Home } });
        });

        it("drops entries that fail the isValidCustomSection check", () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue({
                "element.io.section.null-val": null,
                "element.io.section.str-val": "not-an-object",
                "element.io.section.bad-tag": { tag: "not-a-custom-tag", name: "Bad" },
                "element.io.section.bad-name": { tag: "element.io.section.bad-name", name: 42 },
            });
            expect(getCustomSectionData()).toEqual({});
        });

        it("defaults spaceId to MetaSpace.Home when spaceId is missing", () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue({ [validTag]: validEntry });
            expect(getCustomSectionData()[validTag].spaceId).toBe(MetaSpace.Home);
        });

        it("defaults spaceId to MetaSpace.Home when the stored space does not exist", () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue({
                [validTag]: { ...validEntry, spaceId: "!gone:server" },
            });
            // spacePanelSpaces is empty (default mock), so !gone:server is unknown
            expect(getCustomSectionData()[validTag].spaceId).toBe(MetaSpace.Home);
        });

        it("keeps spaceId when the meta-space is enabled", () => {
            vi.spyOn(SDKContextClass.instance.spaceStore, "enabledMetaSpaces", "get").mockReturnValue([MetaSpace.Home]);
            vi.spyOn(SettingsStore, "getValue").mockReturnValue({
                [validTag]: { ...validEntry, spaceId: MetaSpace.Home },
            });
            expect(getCustomSectionData()[validTag].spaceId).toBe(MetaSpace.Home);
        });

        it("keeps spaceId when the real space room exists", () => {
            const spaceId = "!space:server";
            vi.spyOn(SDKContextClass.instance.spaceStore, "spacePanelSpaces", "get").mockReturnValue([
                { roomId: spaceId } as Room,
            ]);
            vi.spyOn(SettingsStore, "getValue").mockReturnValue({
                [validTag]: { ...validEntry, spaceId },
            });
            expect(getCustomSectionData()[validTag].spaceId).toBe(spaceId);
        });
    });

    describe("getOrderedCustomSections", () => {
        const tag = "element.io.section.abc";

        beforeEach(() => {
            vi.spyOn(SDKContextClass.instance.spaceStore, "enabledMetaSpaces", "get").mockReturnValue([]);
            vi.spyOn(SDKContextClass.instance.spaceStore, "spacePanelSpaces", "get").mockReturnValue([]);
        });

        it("returns an empty array when the raw value is not an array", () => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.OrderedCustomSections") return "not-an-array";
                return null;
            });

            const result = getOrderedCustomSections();
            expect(result).toEqual([]);
        });

        it("removes unknown sections and saves the cleaned list", () => {
            const knownTag = "element.io.section.known";
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
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
            vi.spyOn(SettingsStore, "getValue").mockReturnValue(value);
            expect(isSectionExpanded(spaceId, tag)).toBe(result);
        });
    });

    describe("setSectionExpanded", () => {
        const spaceId = "!space:server";
        const tag = "element.io.section.abc";

        it("persists the state at the device level", async () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue({});
            const setValueSpy = vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await setSectionExpanded(spaceId, tag, false);

            expect(setValueSpy).toHaveBeenCalledWith("RoomList.SectionExpansionState", null, SettingLevel.DEVICE, {
                [spaceId]: { [tag]: false },
            });
        });

        it("merges with existing state for other spaces and tags", async () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue({
                "!other:server": { "other.tag": false },
                [spaceId]: { "existing.tag": true },
            });
            const setValueSpy = vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await setSectionExpanded(spaceId, tag, false);

            expect(setValueSpy).toHaveBeenCalledWith("RoomList.SectionExpansionState", null, SettingLevel.DEVICE, {
                "!other:server": { "other.tag": false },
                [spaceId]: { "existing.tag": true, [tag]: false },
            });
        });

        it("overwrites the previous state for the same space and tag", async () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue({ [spaceId]: { [tag]: false } });
            const setValueSpy = vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await setSectionExpanded(spaceId, tag, true);

            expect(setValueSpy).toHaveBeenCalledWith("RoomList.SectionExpansionState", null, SettingLevel.DEVICE, {
                [spaceId]: { [tag]: true },
            });
        });
    });

    describe("createSection", () => {
        beforeEach(() => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue(null);
            vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
            vi.spyOn(SDKContextClass.instance.spaceStore, "enabledMetaSpaces", "get").mockReturnValue([]);
            vi.spyOn(SDKContextClass.instance.spaceStore, "spacePanelSpaces", "get").mockReturnValue([]);
        });

        it.each([
            [undefined, undefined],
            ["", undefined],
            ["My Section", expect.stringMatching(/^element\.io\.section\./)],
        ])("returns %s when the dialog is finished with name='%s'", async (name, expected) => {
            vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([name]),
                close: vi.fn(),
            } as any);

            const result = await createSection(MetaSpace.Home);
            expect(result).toEqual(expected);
        });

        it("returns the new tag when section is created", async () => {
            vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve(["My Section"]),
                close: vi.fn(),
            } as any);

            const result = await createSection(MetaSpace.Home);
            expect(result).toMatch(/^element\.io\.section\./);
        });

        it("opens the CreateSectionDialog", async () => {
            const createDialogSpy = vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([undefined]),
                close: vi.fn(),
            } as any);

            await createSection(MetaSpace.Home, "!preselected:example.org");
            expect(createDialogSpy).toHaveBeenCalledWith(CreateSectionDialog, {
                preselectedRoomId: "!preselected:example.org",
            });
        });

        it("tags the rooms chosen in the dialog with the new section", async () => {
            vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve(["My Section", ["!picked:example.org"]]),
                close: vi.fn(),
            } as any);

            const room = mkStubRoom("!picked:example.org", "Picked");
            room.tags = {};
            vi.spyOn(SDKContextClass.instance, "client", "get").mockReturnValue({
                getRoom: () => room,
            } as any);

            const newTag = await createSection(MetaSpace.Home);

            expect(tagRoom).toHaveBeenCalledWith(room, newTag);
        });

        it("saves section data and ordered sections at ACCOUNT level when confirmed", async () => {
            const existingTag = "element.io.section.existing";
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.OrderedCustomSections") return [existingTag];
                if (setting === "RoomList.CustomSectionData")
                    return { [existingTag]: { tag: existingTag, name: "Existing" } };
                return null;
            });
            vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve(["My Section"]),
                close: vi.fn(),
            } as any);
            const setValueSpy = vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

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
            vi.spyOn(SettingsStore, "getValue").mockReturnValue(existingSectionData);
            vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
        });

        it("does nothing if the tag is not a custom section tag", async () => {
            const createDialogSpy = vi.spyOn(Modal, "createDialog");
            await editSection("m.favourite");
            expect(createDialogSpy).not.toHaveBeenCalled();
        });

        it("does nothing if the section does not exist", async () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue({});
            const createDialogSpy = vi.spyOn(Modal, "createDialog");

            await editSection(tag);
            expect(createDialogSpy).not.toHaveBeenCalled();
        });

        it("opens the CreateSectionDialog with the current section name", async () => {
            const createDialogSpy = vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([undefined]),
                close: vi.fn(),
            } as any);

            await editSection(tag);
            expect(createDialogSpy).toHaveBeenCalledWith(CreateSectionDialog, {
                sectionToEdit: { tag, name: "Old Name", spaceId: MetaSpace.Home },
            });
        });

        it.each([[undefined], [""], ["Old Name"]])("does not save when the name is '%s'", async (name) => {
            vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([name]),
                close: vi.fn(),
            } as any);
            const setValueSpy = vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await editSection(tag);
            expect(setValueSpy).not.toHaveBeenCalled();
        });

        it("saves the new name when confirmed with a different name", async () => {
            vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve(["New Name"]),
                close: vi.fn(),
            } as any);
            const setValueSpy = vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await editSection(tag);

            expect(setValueSpy).toHaveBeenCalledWith(
                "RoomList.CustomSectionData",
                null,
                expect.anything(),
                expect.objectContaining({ [tag]: expect.objectContaining({ tag, name: "New Name" }) }),
            );
        });

        it("tags the rooms added to the section and untags the ones removed from it", async () => {
            setupRooms(["!added:example.org", "!removed:example.org"]);
            vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve(["New Name", ["!added:example.org"], ["!removed:example.org"]]),
                close: vi.fn(),
            } as any);

            await editSection(tag);

            expect(tagRoom).toHaveBeenCalledTimes(2);
            expect(tagRoom).toHaveBeenCalledWith(expect.objectContaining({ roomId: "!added:example.org" }), tag);
            expect(tagRoom).toHaveBeenCalledWith(expect.objectContaining({ roomId: "!removed:example.org" }), tag);
        });

        it("applies the room changes even when the name is unchanged", async () => {
            setupRooms(["!added:example.org"]);
            vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve(["Old Name", ["!added:example.org"], []]),
                close: vi.fn(),
            } as any);
            const setValueSpy = vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await editSection(tag);

            expect(tagRoom).toHaveBeenCalledWith(expect.objectContaining({ roomId: "!added:example.org" }), tag);
            expect(setValueSpy).not.toHaveBeenCalled();
        });
    });

    describe("deleteSection", () => {
        const tag = "element.io.section.abc";
        const otherTag = "element.io.section.other";

        beforeEach(() => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.CustomSectionData")
                    return { [tag]: { tag, name: "My Section" }, [otherTag]: { tag: otherTag, name: "Other Section" } };
                if (setting === "RoomList.OrderedCustomSections") return [otherTag, tag];
                return null;
            });
            vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
        });

        it("does nothing if the tag is not a custom section tag", async () => {
            const createDialogSpy = vi.spyOn(Modal, "createDialog");
            await deleteSection("m.favourite", false);
            expect(createDialogSpy).not.toHaveBeenCalled();
        });

        it("does nothing if the section does not exist", async () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue({});
            const createDialogSpy = vi.spyOn(Modal, "createDialog");

            await deleteSection(tag, false);
            expect(createDialogSpy).not.toHaveBeenCalled();
        });

        it.each([
            [true, "empty"],
            [false, "non-empty"],
        ])("opens the RemoveSectionDialog with isEmpty=%s for %s section", async (isEmpty) => {
            const createDialogSpy = vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([false]),
                close: vi.fn(),
            } as any);

            await deleteSection(tag, isEmpty);
            expect(createDialogSpy).toHaveBeenCalledWith(RemoveSectionDialog, { isEmpty });
        });

        it("does not save when user cancels", async () => {
            vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([false]),
                close: vi.fn(),
            } as any);
            const setValueSpy = vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await deleteSection(tag, false);
            expect(setValueSpy).not.toHaveBeenCalled();
        });

        it("removes the section from ordered list and section data when confirmed", async () => {
            vi.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([true]),
                close: vi.fn(),
            } as any);
            const setValueSpy = vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            await deleteSection(tag, false);

            const orderedCall = setValueSpy.mock.calls.find(([name]) => name === "RoomList.OrderedCustomSections");
            // The DM tag is prepended and CHATS_TAG appended because the stored order didn't
            // include them (legacy default positions).
            expect(orderedCall![3]).toEqual([DefaultTagID.DM, otherTag, CHATS_TAG]);

            const customDataCall = setValueSpy.mock.calls.find(([name]) => name === "RoomList.CustomSectionData");
            expect(customDataCall![3]).not.toHaveProperty(tag);
        });
    });

    describe("ordered sections", () => {
        const customTag = `${CUSTOM_SECTION_TAG_PREFIX}abc`;

        function mockStoredOrder(orderedTags: string[], showPeopleSection = false): void {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                if (setting === "RoomList.OrderedCustomSections") return orderedTags;
                if (setting === "RoomList.CustomSectionData") return { [customTag]: { tag: customTag, name: "A" } };
                if (setting === "RoomList.showPeopleSection") return showPeopleSection;
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
        ])("getOrderedReorderableSections $description", ({ stored, expected }) => {
            mockStoredOrder(stored);
            expect(getOrderedReorderableSections()).toEqual(expected);
        });

        it.each<{ description: string; stored: string[]; showPeopleSection: boolean; expected: string[] }>([
            {
                description: "pins Favourite at the top and LowPriority at the bottom",
                stored: [customTag, CHATS_TAG],
                showPeopleSection: false,
                expected: [DefaultTagID.Favourite, customTag, CHATS_TAG, DefaultTagID.LowPriority],
            },
            {
                description: "includes the People tag when the setting is enabled",
                stored: [customTag, CHATS_TAG],
                showPeopleSection: true,
                expected: [DefaultTagID.Favourite, DefaultTagID.DM, customTag, CHATS_TAG, DefaultTagID.LowPriority],
            },
            {
                description: "drops the People tag when the setting is disabled, keeping the other sections in order",
                stored: [customTag, CHATS_TAG, DefaultTagID.DM],
                showPeopleSection: false,
                expected: [DefaultTagID.Favourite, customTag, CHATS_TAG, DefaultTagID.LowPriority],
            },
            {
                description: "keeps the stored position of the People tag when the setting is enabled",
                stored: [customTag, CHATS_TAG, DefaultTagID.DM],
                showPeopleSection: true,
                expected: [DefaultTagID.Favourite, customTag, CHATS_TAG, DefaultTagID.DM, DefaultTagID.LowPriority],
            },
        ])("getOrderedSectionTags $description", ({ stored, showPeopleSection, expected }) => {
            mockStoredOrder(stored, showPeopleSection);
            expect(getOrderedSectionTags()).toEqual(expected);
        });
    });

    describe("reorderSection", () => {
        const customTag = `${CUSTOM_SECTION_TAG_PREFIX}abc`;
        const customTag2 = `${CUSTOM_SECTION_TAG_PREFIX}def`;

        function mockSettings(
            orderedTags: string[],
            customData: Record<string, { tag: string; name: string }> = {},
        ): void {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
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
                const setValueSpy = vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

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
            const setValueSpy = vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

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
