/*
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2021 - 2022 Šimon Brandner <simon.bra.ag@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";

import { ICategory, CATEGORIES, CategoryName, KeyBindingAction } from "../../../../../accessibility/KeyboardShortcuts";
import SdkConfig from "../../../../../SdkConfig";
import { _t } from "../../../../../languageHandler";
import {
    getKeyboardShortcutDisplayName,
    getKeyboardShortcutValue,
} from "../../../../../accessibility/KeyboardShortcutUtils";
import { KeyboardShortcut } from "../../KeyboardShortcut";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsSubsection from "../../shared/SettingsSubsection";

interface IKeyboardShortcutRowProps {
    name: KeyBindingAction;
}

// Filter out the labs section if labs aren't enabled.
const visibleCategories = (Object.entries(CATEGORIES) as [CategoryName, ICategory][]).filter(
    ([categoryName]) => categoryName !== CategoryName.LABS || SdkConfig.get("show_labs_settings"),
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
            <SettingsSection heading={_t("Keyboard")}>
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
