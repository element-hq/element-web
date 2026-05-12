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
 * Retrieves the custom sections data from the settings.
 * Invalid or malformed entries are dropped and the cleaned data is persisted back to settings.
 */
export function getCustomSectionData(): CustomSectionsData {
    const raw = SettingsStore.getValue("RoomList.CustomSectionData");
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        // The data is malformed, reset it in background
        SettingsStore.setValue("RoomList.CustomSectionData", null, SettingLevel.ACCOUNT, {});
        return {};
    }

    const result: CustomSectionsData = {};
    let hasInvalid = false;
    for (const [key, value] of Object.entries(raw)) {
        if (!isValidCustomSection(value) || value.tag !== key) {
            logger.warn("Dropping invalid custom section", key, value);
            hasInvalid = true;
            continue;
        }
        result[key as CustomTag] = value;
    }
    // If there were invalid entries, persist the cleaned data back to settings
    if (hasInvalid) SettingsStore.setValue("RoomList.CustomSectionData", null, SettingLevel.ACCOUNT, result);

    return result;
}

/**
 * Retrieves the ordered list of custom section tags from the settings.
 * If the settings contain tags that are not present in the custom section data, they will be filtered out and the settings will be updated to remove the unknown tags.
 */
export async function getOrderedCustomSections(): Promise<OrderedCustomSections> {
    const sectionData = getCustomSectionData();
    const rawValue = SettingsStore.getValue("RoomList.OrderedCustomSections");
    const orderedSections: OrderedCustomSections = Array.isArray(rawValue) ? rawValue : [];
    const knownSections = orderedSections.filter((tag) => tag in sectionData);
    if (knownSections.length !== orderedSections.length) {
        // Some sections were not found in the section data
        await SettingsStore.setValue("RoomList.OrderedCustomSections", null, SettingLevel.ACCOUNT, knownSections);
    }
    return knownSections;
}

/**
 * Creates a new custom section by showing a dialog to the user to enter the section name.
 * If the user confirms, it generates a unique tag for the section, saves the section data in the settings, and updates the ordered list of sections.
 *
 * @return A promise that resolves to the new section tag if created, or undefined if cancelled.
 */
export async function createSection(): Promise<string | undefined> {
    const modal = Modal.createDialog(CreateSectionDialog);

    const [shouldCreateSection, sectionName] = await modal.finished;
    if (!shouldCreateSection || !sectionName) return undefined;

    const tag: CustomTag = `${CUSTOM_SECTION_TAG_PREFIX}${window.crypto.randomUUID()}`;
    const newSection: CustomSection = { tag, name: sectionName };

    // Save the new section data
    const sectionData = getCustomSectionData();
    sectionData[tag] = newSection;
    await SettingsStore.setValue("RoomList.CustomSectionData", null, SettingLevel.ACCOUNT, sectionData);

    // Add the new section to the ordered list of sections
    const orderedSections = await getOrderedCustomSections();
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
    const newOrderedSections = (await getOrderedCustomSections()).filter((sectionTag) => sectionTag !== tag);
    await SettingsStore.setValue("RoomList.OrderedCustomSections", null, SettingLevel.ACCOUNT, newOrderedSections);

    // Remove the section data
    delete sectionData[tag];
    await SettingsStore.setValue("RoomList.CustomSectionData", null, SettingLevel.ACCOUNT, sectionData);
}
