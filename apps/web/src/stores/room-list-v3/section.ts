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
import { type SpaceKey } from "../spaces";

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
    /** The space or metaspace this section belongs to. */
    spaceId: SpaceKey;
};

/**
 * The custom sections data is stored as a record in the settings, where the key is the section tag and the value is the section data (name, tag and spaceId).
 */
export type CustomSectionsData = Record<Tag, CustomSection>;
/**
 * Ordered list of custom section tags, keyed by space/metaspace ID.
 */
export type OrderedCustomSections = Record<SpaceKey, Tag[]>;

/**
 * Creates a new custom section by showing a dialog to the user to enter the section name.
 * If the user confirms, it generates a unique tag for the section, saves the section data in the settings, and updates the ordered list of sections.
 *
 * @param spaceId - The space or metaspace this section is being created in.
 * @return A promise that resolves to the new section tag if created, or undefined if cancelled.
 */
export async function createSection(spaceId: SpaceKey): Promise<string | undefined> {
    const modal = Modal.createDialog(CreateSectionDialog);

    const [shouldCreateSection, sectionName] = await modal.finished;
    if (!shouldCreateSection || !sectionName) return undefined;

    const tag = `${CUSTOM_SECTION_TAG_PREFIX}${window.crypto.randomUUID()}`;
    const newSection: CustomSection = { tag, name: sectionName, spaceId };

    // Save the new section data
    const sectionData = SettingsStore.getValue("RoomList.CustomSectionData") || {};
    sectionData[tag] = newSection;
    await SettingsStore.setValue("RoomList.CustomSectionData", null, SettingLevel.ACCOUNT, sectionData);

    // Add the new section to the ordered list of sections for this space
    const orderedSections: OrderedCustomSections = SettingsStore.getValue("RoomList.OrderedCustomSections") || {};
    const spaceSections = orderedSections[spaceId] ?? [];
    spaceSections.push(tag);
    orderedSections[spaceId] = spaceSections;
    await SettingsStore.setValue("RoomList.OrderedCustomSections", null, SettingLevel.ACCOUNT, orderedSections);
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
    const sectionData = SettingsStore.getValue("RoomList.CustomSectionData");
    if (!sectionData[tag]) {
        logger.info("Unknown section tag, cannot delete section", tag);
        return;
    }

    const modal = Modal.createDialog(RemoveSectionDialog, { isEmpty });
    const [shouldRemoveSection] = await modal.finished;
    if (!shouldRemoveSection) return;

    // Remove the section from the ordered list of sections for its space
    const spaceId = sectionData[tag].spaceId;
    const orderedSections: OrderedCustomSections = SettingsStore.getValue("RoomList.OrderedCustomSections") || {};
    if (orderedSections[spaceId]) {
        orderedSections[spaceId] = orderedSections[spaceId].filter((sectionTag) => sectionTag !== tag);
    }
    await SettingsStore.setValue("RoomList.OrderedCustomSections", null, SettingLevel.ACCOUNT, orderedSections);

    // Remove the section data
    delete sectionData[tag];
    await SettingsStore.setValue("RoomList.CustomSectionData", null, SettingLevel.ACCOUNT, sectionData);
}
