/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import {
    type ICategory,
    CATEGORIES,
    CategoryName,
    type KeyBindingAction,
} from "../../../../../accessibility/KeyboardShortcuts";
import { _t } from "../../../../../languageHandler";
import {
    getKeyboardShortcutDisplayName,
    getKeyboardShortcutValue,
} from "../../../../../accessibility/KeyboardShortcutUtils";
import { KeyboardShortcut } from "../../KeyboardShortcut";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import { SettingsSubsection } from "../../shared/SettingsSubsection";
import { showLabsFlags } from "./LabsUserSettingsTab";

interface IKeyboardShortcutRowProps {
    name: KeyBindingAction;
}

// Filter out the labs section if labs aren't enabled.
const visibleCategories = (Object.entries(CATEGORIES) as [CategoryName, ICategory][]).filter(
    ([categoryName]) => categoryName !== CategoryName.LABS || showLabsFlags(),
);

const KeyboardShortcutRow: React.FC<IKeyboardShortcutRowProps> = ({ name }) => {
    const displayName = getKeyboardShortcutDisplayName(name);
    const value = getKeyboardShortcutValue(name);
    if (!displayName || !value) return null;

    return (
        <li className="mx_KeyboardShortcut_shortcutRow">
            {displayName}
            <KeyboardShortcut value={value} />
        </li>
    );
};

interface IKeyboardShortcutSectionProps {
    categoryName: CategoryName;
    category: ICategory;
}

const KeyboardShortcutSection: React.FC<IKeyboardShortcutSectionProps> = ({ categoryName, category }) => {
    if (!category.categoryLabel) return null;

    return (
        <SettingsSubsection heading={_t(category.categoryLabel)} key={categoryName}>
            <ul className="mx_KeyboardShortcut_shortcutList">
                {category.settingNames.map((shortcutName) => {
                    return <KeyboardShortcutRow key={shortcutName} name={shortcutName} />;
                })}
            </ul>
        </SettingsSubsection>
    );
};

const KeyboardUserSettingsTab: React.FC = () => {
    return (
        <SettingsTab>
            <SettingsSection>
                {visibleCategories.map(([categoryName, category]) => {
                    return (
                        <KeyboardShortcutSection key={categoryName} categoryName={categoryName} category={category} />
                    );
                })}
            </SettingsSection>
        </SettingsTab>
    );
};

export default KeyboardUserSettingsTab;
