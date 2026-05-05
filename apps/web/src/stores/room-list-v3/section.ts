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

type Tag = string;

/**
 * Prefix for custom section tags.
 */
export const CUSTOM_SECTION_TAG_PREFIX = "element.io.section.";

/**
 * Checks if a given tag is a custom section tag.
 * @param tag - The tag to check.
 * @returns True if the tag is a custom section tag, false otherwise.
 */
export function isCustomSectionTag(tag: string): boolean {
    return tag.startsWith(CUSTOM_SECTION_TAG_PREFIX);
}

/**
 * Structure of the custom section stored in the settings. The tag is used as a unique identifier for the section, and the name is given by the user.
 */
type CustomSection = {
    tag: Tag;
    name: string;
    /**
     * The ID of the space (or MetaSpace) in which this section was created.
     * Used to decide whether to show the section in a given context even when it has no rooms there yet.
     * Legacy sections created before this field was added will not have it set.
     */
    spaceId?: string;
};

/**
 * The custom sections data is stored as a record in the settings, where the key is the section tag and the value is the section data (name and tag).
 */
export type CustomSectionsData = Record<Tag, CustomSection>;
/**
 * Ordered list of custom section tags.
 */
export type OrderedCustomSections = Tag[];

/**
 * Persist a section setting value.
 *
 * Writes to DEVICE level (localStorage) first so the value survives tab switches
 * and server-write failures immediately. Then fires a background write to ACCOUNT
 * level so data syncs to other devices via account data.
 *
 * Reads already prefer DEVICE > ACCOUNT so the local value always wins on this device.
 */
async function saveSectionSetting(key: "RoomList.CustomSectionData" | "RoomList.OrderedCustomSections", value: unknown): Promise<void> {
    // Write to localStorage immediately — survives tab switches and server failures.
    await SettingsStore.setValue(key, null, SettingLevel.DEVICE, value);
    // Also write to account data for cross-device sync (fire-and-forget — DEVICE copy is the source of truth).
    SettingsStore.setValue(key, null, SettingLevel.ACCOUNT, value).catch((err) => {
        logger.warn(`Failed to sync section setting ${key} to account data:`, err);
    });
}

/**
 * Creates a new custom section by showing a dialog to the user to enter the section name.
 * If the user confirms, it generates a unique tag for the section, saves the section data in the settings, and updates the ordered list of sections.
 *
 * @param spaceId - The ID of the space (or MetaSpace) in which the section is being created.
 *                  Stored so the section stays visible in that context even while empty.
 * @return A promise that resolves to the new section tag if created, or undefined if cancelled.
 */
export async function createSection(spaceId: string): Promise<string | undefined> {
    const modal = Modal.createDialog(CreateSectionDialog);

    const [shouldCreateSection, sectionName] = await modal.finished;
    if (!shouldCreateSection || !sectionName) return undefined;

    const tag = `${CUSTOM_SECTION_TAG_PREFIX}${window.crypto.randomUUID()}`;
    const newSection: CustomSection = { tag, name: sectionName, spaceId };

    // Save the new section data — spread to avoid mutating the cached reference.
    const sectionData = { ...(SettingsStore.getValue("RoomList.CustomSectionData") || {}), [tag]: newSection };
    await saveSectionSetting("RoomList.CustomSectionData", sectionData);

    // Add the new section to the ordered list of sections — spread to avoid mutating the cached reference.
    const orderedSections = [...(SettingsStore.getValue("RoomList.OrderedCustomSections") || []), tag];
    await saveSectionSetting("RoomList.OrderedCustomSections", orderedSections);
    return tag;
}

/**
 * Edits an existing custom section by showing a dialog to the user to enter the new section name. If the user confirms, it updates the section data in the settings.
 * @param tag - The tag of the section to edit.
 */
export async function editSection(tag: string): Promise<void> {
    const sectionData = SettingsStore.getValue("RoomList.CustomSectionData") || {};
    const section = sectionData[tag];
    if (!section) {
        logger.info("Unknown section tag, cannot edit section", tag);
        return;
    }

    const modal = Modal.createDialog(CreateSectionDialog, { sectionToEdit: section.name });

    const [shouldEditSection, newName] = await modal.finished;
    const isSameName = newName === section.name;
    if (!shouldEditSection || !newName || isSameName) return;

    // Save the new name — spread to avoid mutating the cached reference.
    const updatedSectionData = { ...sectionData, [tag]: { ...section, name: newName } };
    await saveSectionSetting("RoomList.CustomSectionData", updatedSectionData);
}

/**
 * Deletes a custom section by showing a confirmation dialog to the user. If the user confirms, it removes the section data from the settings and updates the ordered list of sections.
 * @param tag - The tag of the section to delete.
 * @param isEmpty - Whether the section is empty (has no rooms). If the section is not empty, the confirmation dialog will show a warning message.
 */
export async function deleteSection(tag: string, isEmpty: boolean): Promise<void> {
    const sectionData = SettingsStore.getValue("RoomList.CustomSectionData");
    if (!sectionData[tag]) {
        logger.info("Unknown section tag, cannot delete section", tag);
        return;
    }

    const modal = Modal.createDialog(RemoveSectionDialog, { isEmpty });
    const [shouldRemoveSection] = await modal.finished;
    if (!shouldRemoveSection) return;

    // Remove the section from the ordered list of sections.
    const orderedSections = SettingsStore.getValue("RoomList.OrderedCustomSections");
    const newOrderedSections = orderedSections.filter((sectionTag) => sectionTag !== tag);
    await saveSectionSetting("RoomList.OrderedCustomSections", newOrderedSections);

    // Remove the section data — spread to avoid mutating the cached reference.
    const { [tag]: _removed, ...remainingSectionData } = sectionData;
    await saveSectionSetting("RoomList.CustomSectionData", remainingSectionData);
}
