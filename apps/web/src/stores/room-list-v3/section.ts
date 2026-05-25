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
import SpaceStore from "../spaces/SpaceStore";

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
 * Union of all valid section tags (default + custom).
 */
export type SectionTag = CustomTag | DefaultTagID.Favourite | DefaultTagID.LowPriority | typeof CHATS_TAG;

/**
 * Ordered list of section tags (default + custom).
 */
export type CustomSections = SectionTag[];

/**
 * Returns true if the given space key corresponds to an enabled meta-space or a known top-level space room.
 */
function doesSpaceExist(spaceId: SpaceKey): boolean {
    if (isMetaSpace(spaceId)) return SpaceStore.instance.enabledMetaSpaces.includes(spaceId);
    return SpaceStore.instance.spacePanelSpaces.some((room) => room.roomId === spaceId);
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
 */
export function getOrderedCustomSections(): CustomSections {
    const sectionData = getCustomSectionData();
    const rawValue = SettingsStore.getValue("RoomList.OrderedCustomSections");
    const orderedSections: CustomSections = Array.isArray(rawValue) ? rawValue : [];
    return orderedSections.filter((tag) => tag in sectionData);
}

const DEFAULT_SECTION_TAGS = new Set<string>([DefaultTagID.Favourite, CHATS_TAG, DefaultTagID.LowPriority]);

/**
 * Returns the full ordered list of all sections (default + custom).
 * If the stored order includes all three default tags, it is used as-is (minus deleted custom sections),
 * with any new custom sections inserted before LowPriority.
 * Falls back to the canonical order when the stored value is empty or contains no default tags.
 */
export function getOrderedSections(): SectionTag[] {
    const customData = getCustomSectionData();
    const availableCustomTags = Object.keys(customData).filter(isCustomSectionTag) as CustomTag[];

    const rawValue = SettingsStore.getValue("RoomList.OrderedCustomSections");
    const tags: SectionTag[] = Array.isArray(rawValue) ? (rawValue as SectionTag[]) : [];

    // Keep only valid tags (remove deleted custom sections, keep all defaults)
    const result = tags.filter((t) => DEFAULT_SECTION_TAGS.has(t) || (isCustomSectionTag(t) && t in customData));

    // Ensure all 3 default tags are present
    for (const tag of [DefaultTagID.Favourite, CHATS_TAG, DefaultTagID.LowPriority] as SectionTag[]) {
        if (!result.includes(tag)) result.push(tag);
    }

    // Append any new custom tags not yet in the list, before LowPriority
    for (const tag of availableCustomTags) {
        if (!result.includes(tag)) {
            const lpIndex = result.indexOf(DefaultTagID.LowPriority);
            if (lpIndex === -1) {
                result.push(tag);
            } else {
                result.splice(lpIndex, 0, tag);
            }
        }
    }

    return result;
}

/**
 * Creates a new custom section by showing a dialog to the user to enter the section name.
 * If the user confirms, it generates a unique tag for the section, saves the section data in the settings, and updates the ordered list of sections.
 *
 * @param spaceId The space in which the section is being created. Used to control visibility of the empty section.
 * @return A promise that resolves to the new section tag if created, or undefined if cancelled.
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

    // Add the new section to the ordered list of sections
    const orderedSections = getOrderedCustomSections();
    orderedSections.push(tag);
    await SettingsStore.setValue("RoomList.OrderedCustomSections", null, SettingLevel.ACCOUNT, orderedSections);
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

    // Remove the section from the ordered list of sections
    const newOrderedSections = getOrderedCustomSections().filter((sectionTag) => sectionTag !== tag);
    await SettingsStore.setValue("RoomList.OrderedCustomSections", null, SettingLevel.ACCOUNT, newOrderedSections);

    // Remove the section data
    delete sectionData[tag];
    await SettingsStore.setValue("RoomList.CustomSectionData", null, SettingLevel.ACCOUNT, sectionData);
}

/**
 * Reorders sections by moving sourceTag after targetTag.
 * Works for both default and custom sections.
 * @param sourceTag - The tag of the section to move.
 * @param targetTag - The tag of the section to move after.
 */
export async function reorderSection(sourceTag: string, targetTag: string): Promise<void> {
    const ordered = getOrderedSections();
    const fromIndex = ordered.indexOf(sourceTag as SectionTag);

    if (fromIndex === -1 || !ordered.includes(targetTag as SectionTag) || sourceTag === targetTag) return;

    ordered.splice(fromIndex, 1);
    const newToIndex = ordered.indexOf(targetTag as SectionTag);
    ordered.splice(newToIndex + 1, 0, sourceTag as SectionTag);
    await SettingsStore.setValue("RoomList.OrderedCustomSections", null, SettingLevel.ACCOUNT, ordered);
}
