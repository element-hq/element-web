/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { logger } from "matrix-js-sdk/src/logger";

import { SettingLevel } from "../../settings/SettingLevel";
import SettingsStore from "../../settings/SettingsStore";
import Modal from "../../Modal";
import { CreateSectionDialog } from "../../components/views/dialogs/CreateSectionDialog";
import { RemoveSectionDialog } from "../../components/views/dialogs/RemoveSectionDialog";
import { DefaultTagID, type TagID } from "./skip-list/tag";
import { isMetaSpace, MetaSpace, type SpaceKey } from "../spaces";
import { SDKContextClass } from "../../contexts/SDKContextClass.ts";

/**
 * A synthetic tag used to represent the "Chats" section, which contains
 * every room that does not belong to any other explicit tag section.
 */
export const CHATS_TAG = "chats";

/**
 * Prefix for custom section tags.
 */
export const CUSTOM_SECTION_TAG_PREFIX = "element.io.section.";

type CustomTag = `${typeof CUSTOM_SECTION_TAG_PREFIX}${string}`;

/**
 * Checks if a given tag is a custom section tag.
 * @param tag - The tag to check.
 * @returns True if the tag is a custom section tag, false otherwise.
 */
export function isCustomSectionTag(tag: string): tag is CustomTag {
    return tag.startsWith(CUSTOM_SECTION_TAG_PREFIX);
}

/**
 * Checks if a given tag is a default section tag.
 * @param tagId - The tag to check.
 * @returns True if the tag is a default section tag, false otherwise.
 */
export function isDefaultSectionTag(tagId: TagID): boolean {
    return tagId === DefaultTagID.Favourite || tagId === DefaultTagID.LowPriority || tagId === CHATS_TAG;
}

/**
 * Checks if a given tag is a section tag.
 * @param tagId - The tag to check.
 * @returns True if the tag is a section tag, false otherwise.
 */
export function isSectionTag(tagId: TagID): boolean {
    return isCustomSectionTag(tagId) || isDefaultSectionTag(tagId);
}

/**
 * Structure of the custom section stored in the settings. The tag is used as a unique identifier for the section, and the name is given by the user.
 */
type CustomSection = {
    tag: CustomTag;
    name: string;
    /** The space in which this section was created. Used to control visibility of empty sections. */
    spaceId?: SpaceKey;
};

/**
 * Type guard to check if a value is a valid CustomSection object.
 */
function isValidCustomSection(value: unknown): value is CustomSection {
    return (
        typeof value === "object" &&
        value !== null &&
        isCustomSectionTag((value as Record<string, unknown>).tag as string) &&
        typeof (value as Record<string, unknown>).name === "string"
    );
}

/**
 * The custom sections data is stored as a record in the settings, where the key is the section tag and the value is the section data (name and tag).
 */
export type CustomSectionsData = Record<CustomTag, CustomSection>;

/**
 * Ordered list of custom section tags.
 */
export type OrderedCustomSections = CustomTag[];

/**
 * Tags that can be reordered relative to each other (everything except Favourite and LowPriority,
 * which are pinned to the top and bottom respectively).
 */
export type ReorderableSection = CustomTag | typeof CHATS_TAG;

/**
 * Returns true if the given tag is a tag that can be reordered (custom section or the Chats tag).
 */
function isReorderableSection(tag: string, customData: CustomSectionsData): tag is ReorderableSection {
    return tag === CHATS_TAG || (isCustomSectionTag(tag) && tag in customData);
}

/**
 * Returns true if the given space key corresponds to an enabled meta-space or a known top-level space room.
 */
function doesSpaceExist(spaceId: SpaceKey): boolean {
    if (isMetaSpace(spaceId)) return SDKContextClass.instance.spaceStore.enabledMetaSpaces.includes(spaceId);
    return SDKContextClass.instance.spaceStore.spacePanelSpaces.some((room) => room.roomId === spaceId);
}

/**
 * Retrieves the custom sections data from the settings.
 * Invalid or malformed entries are dropped and the cleaned data is persisted back to settings.
 */
export function getCustomSectionData(): CustomSectionsData {
    const raw = SettingsStore.getValue("RoomList.CustomSectionData");
    // Data are malformed
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};

    return Object.fromEntries(
        Object.entries(raw)
            .filter(([key, value]) => isValidCustomSection(value) && value.tag === key)
            .map(([key, value]) => [
                key,
                {
                    ...value,
                    // Default to MetaSpace.Home for legacy sections (no spaceId) or if the stored space no longer exists
                    spaceId: value.spaceId && doesSpaceExist(value.spaceId) ? value.spaceId : MetaSpace.Home,
                },
            ]),
    ) as CustomSectionsData;
}

/**
 * Retrieves the ordered list of custom section tags from the settings.
 * If the settings contain tags that are not present in the custom section data, they will be filtered out and the settings will be updated to remove the unknown tags.
 *
 * @knipignore - exported for tests
 */
export function getOrderedCustomSections(): OrderedCustomSections {
    const sectionData = getCustomSectionData();
    const rawValue = SettingsStore.getValue("RoomList.OrderedCustomSections");
    const orderedSections = Array.isArray(rawValue) ? rawValue : [];
    return orderedSections.filter((tag): tag is CustomTag => isCustomSectionTag(tag) && tag in sectionData);
}

/**
 * Returns the ordered list of reorderable section tags (custom sections + the Chats tag).
 * Favourite and LowPriority are not included — they are pinned at the top and bottom respectively.
 *
 * If `CHATS_TAG` is missing from the stored order (e.g. legacy data or a freshly created custom
 * section), it is appended at the end so that custom sections sit above Chats by default.
 */
export function getOrderedReorderableSections(): ReorderableSection[] {
    const sectionData = getCustomSectionData();
    const rawValue = SettingsStore.getValue("RoomList.OrderedCustomSections");
    const stored = Array.isArray(rawValue) ? rawValue : [];

    const result = stored.filter((tag): tag is ReorderableSection => isReorderableSection(tag, sectionData));
    if (!result.includes(CHATS_TAG)) result.push(CHATS_TAG);
    return result;
}

/**
 * Creates a new custom section by showing a dialog to the user to enter the section name.
 * If the user confirms, it generates a unique tag for the section, saves the section data in the settings, and updates the ordered list of sections.
 *
 * @param spaceId The space in which the section is being created. Used to control visibility of the empty section.
 * @returns A promise that resolves to the new section tag if created, or undefined if cancelled.
 */
export async function createSection(spaceId: SpaceKey): Promise<string | undefined> {
    const modal = Modal.createDialog(CreateSectionDialog);

    const [shouldCreateSection, sectionName] = await modal.finished;
    if (!shouldCreateSection || !sectionName) return undefined;

    const tag: CustomTag = `${CUSTOM_SECTION_TAG_PREFIX}${window.crypto.randomUUID()}`;
    const newSection: CustomSection = { tag, name: sectionName, spaceId };

    // Save the new section data
    const sectionData = getCustomSectionData();
    sectionData[tag] = newSection;
    await SettingsStore.setValue("RoomList.CustomSectionData", null, SettingLevel.ACCOUNT, sectionData);

    // Add the new section to the ordered list of reorderable sections, just before CHATS_TAG
    // so that newly-created sections appear above Chats by default.
    const reorderable = getOrderedReorderableSections();
    const chatsIndex = reorderable.indexOf(CHATS_TAG);
    reorderable.splice(chatsIndex === -1 ? reorderable.length : chatsIndex, 0, tag);
    await SettingsStore.setValue("RoomList.OrderedCustomSections", null, SettingLevel.ACCOUNT, reorderable);
    return tag;
}

/**
 * Edits an existing custom section by showing a dialog to the user to enter the new section name. If the user confirms, it updates the section data in the settings.
 * @param tag - The tag of the section to edit.
 */
export async function editSection(tag: string): Promise<void> {
    if (!isCustomSectionTag(tag)) {
        logger.info("Unknown section tag, cannot edit section", tag);
        return;
    }
    const sectionData = getCustomSectionData();
    const section = sectionData[tag];
    if (!section) {
        logger.info("Unknown section tag, cannot edit section", tag);
        return;
    }

    const modal = Modal.createDialog(CreateSectionDialog, { sectionToEdit: section.name });

    const [shouldEditSection, newName] = await modal.finished;
    const isSameName = newName === section.name;
    if (!shouldEditSection || !newName || isSameName) return;

    // Save the new name
    sectionData[tag].name = newName;
    await SettingsStore.setValue("RoomList.CustomSectionData", null, SettingLevel.ACCOUNT, sectionData);
}

/**
 * Deletes a custom section by showing a confirmation dialog to the user. If the user confirms, it removes the section data from the settings and updates the ordered list of sections.
 * @param tag - The tag of the section to delete.
 * @param isEmpty - Whether the section is empty (has no rooms). If the section is not empty, the confirmation dialog will show a warning message.
 */
export async function deleteSection(tag: string, isEmpty: boolean): Promise<void> {
    if (!isCustomSectionTag(tag)) {
        logger.info("Unknown section tag, cannot delete section", tag);
        return;
    }
    const sectionData = getCustomSectionData();
    if (!sectionData[tag]) {
        logger.info("Unknown section tag, cannot delete section", tag);
        return;
    }

    const modal = Modal.createDialog(RemoveSectionDialog, { isEmpty });
    const [shouldRemoveSection] = await modal.finished;
    if (!shouldRemoveSection) return;

    // Remove the section from the ordered list of reorderable sections (preserves CHATS_TAG position)
    const newOrderedSections = getOrderedReorderableSections().filter((sectionTag) => sectionTag !== tag);
    await SettingsStore.setValue("RoomList.OrderedCustomSections", null, SettingLevel.ACCOUNT, newOrderedSections);

    // Remove the section data
    delete sectionData[tag];
    await SettingsStore.setValue("RoomList.CustomSectionData", null, SettingLevel.ACCOUNT, sectionData);
}

/**
 * Reorders sections by moving sourceTag relative to targetTag within the set of reorderable
 * sections (custom sections and the Chats tag). Favourite and LowPriority are not reorderable
 * and are rejected as either source or target.
 *
 * If the source was below the target, it is inserted before the target; otherwise after.
 * @param sourceTag - The tag of the section to move.
 * @param targetTag - The tag of the section to move relative to.
 */
export async function reorderSection(sourceTag: string, targetTag: string): Promise<void> {
    const ordered = getOrderedReorderableSections();
    const fromIndex = ordered.indexOf(sourceTag as ReorderableSection);

    if (fromIndex === -1 || !ordered.includes(targetTag as ReorderableSection) || sourceTag === targetTag) return;

    const toIndex = ordered.indexOf(targetTag as ReorderableSection);
    const insertBefore = fromIndex > toIndex;

    ordered.splice(fromIndex, 1);
    const newToIndex = ordered.indexOf(targetTag as ReorderableSection);
    ordered.splice(insertBefore ? newToIndex : newToIndex + 1, 0, sourceTag as ReorderableSection);
    await SettingsStore.setValue("RoomList.OrderedCustomSections", null, SettingLevel.ACCOUNT, ordered);
}
