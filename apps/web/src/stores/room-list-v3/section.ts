/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { v4 as uuidv4 } from "uuid";

import { SettingLevel } from "../../settings/SettingLevel";
import SettingsStore from "../../settings/SettingsStore";
import Modal from "../../Modal";
import { CreateSectionDialog } from "../../components/views/dialogs/CreateSectionDialog";

type Tag = string;

/**
 * Structure of the custom section stored in the settings. The tag is used as a unique identifier for the section, and the name is given by the user.
 */
type CustomSection = {
    tag: Tag;
    name: string;
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
 * Creates a new custom section by showing a dialog to the user to enter the section name.
 * If the user confirms, it generates a unique tag for the section, saves the section data in the settings, and updates the ordered list of sections.
 *
 * @return A promise that resolves to true if the section was created, or false if the user cancelled the creation or if there was an error.
 */
export async function createSection(): Promise<boolean> {
    const modal = Modal.createDialog(CreateSectionDialog);

    const [shouldCreateSection, sectionName] = await modal.finished;
    if (!shouldCreateSection || !sectionName) return false;

    const tag = `element.io.section.${uuidv4()}`;
    const newSection: CustomSection = { tag, name: sectionName };

    // Save the new section data
    const sectionData = SettingsStore.getValue("RoomList.CustomSectionData") || {};
    sectionData[tag] = newSection;
    await SettingsStore.setValue("RoomList.CustomSectionData", null, SettingLevel.ACCOUNT, sectionData);

    // Add the new section to the ordered list of sections
    const orderedSections = SettingsStore.getValue("RoomList.OrderedCustomSections") || [];
    orderedSections.push(tag);
    await SettingsStore.setValue("RoomList.OrderedCustomSections", null, SettingLevel.ACCOUNT, orderedSections);
    return true;
}
