/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { ReactElement, useMemo } from "react";

import { _t } from "../../../languageHandler";
import { Action } from "../../../dispatcher/actions";
import { findNonHighContrastTheme, getOrderedThemes } from "../../../theme";
import Dropdown from "../elements/Dropdown";
import ThemeChoicePanel from "../settings/ThemeChoicePanel";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import dis from "../../../dispatcher/dispatcher";
import { RecheckThemePayload } from "../../../dispatcher/payloads/RecheckThemePayload";
import PosthogTrackers from "../../../PosthogTrackers";
import { NonEmptyArray } from "../../../@types/common";

type Props = {
    requestClose: () => void;
};

const MATCH_SYSTEM_THEME_ID = "MATCH_SYSTEM_THEME_ID";

const QuickThemeSwitcher: React.FC<Props> = ({ requestClose }) => {
    const orderedThemes = useMemo(getOrderedThemes, []);

    const themeState = ThemeChoicePanel.calculateThemeState();
    const nonHighContrast = findNonHighContrastTheme(themeState.theme);
    const theme = nonHighContrast ? nonHighContrast : themeState.theme;
    const { useSystemTheme } = themeState;

    const themeOptions = [
        {
            id: MATCH_SYSTEM_THEME_ID,
            name: _t("Match system"),
        },
        ...orderedThemes,
    ];

    const selectedTheme = useSystemTheme ? MATCH_SYSTEM_THEME_ID : theme;

    const onOptionChange = async (newTheme: string): Promise<void> => {
        PosthogTrackers.trackInteraction("WebQuickSettingsThemeDropdown");

        try {
            if (newTheme === MATCH_SYSTEM_THEME_ID) {
                await SettingsStore.setValue("use_system_theme", null, SettingLevel.DEVICE, true);
            } else {
                // The settings watcher doesn't fire until the echo comes back from the
                // server, so to make the theme change immediately we need to manually
                // do the dispatch now
                // XXX: The local echoed value appears to be unreliable, in particular
                // when settings custom themes(!) so adding forceTheme to override
                // the value from settings.
                dis.dispatch<RecheckThemePayload>({ action: Action.RecheckTheme, forceTheme: newTheme });
                await Promise.all([
                    SettingsStore.setValue("theme", null, SettingLevel.DEVICE, newTheme),
                    SettingsStore.setValue("use_system_theme", null, SettingLevel.DEVICE, false),
                ]);
            }
        } catch (_error) {
            dis.dispatch<RecheckThemePayload>({ action: Action.RecheckTheme });
        }

        requestClose();
    };

    return (
        <div className="mx_QuickThemeSwitcher">
            <h4 className="mx_QuickThemeSwitcher_heading">{_t("Theme")}</h4>
            <Dropdown
                id="mx_QuickSettingsButton_themePickerDropdown"
                onOptionChange={onOptionChange}
                value={selectedTheme}
                label={_t("Space selection")}
            >
                {
                    themeOptions.map((theme) => <div key={theme.id}>{theme.name}</div>) as NonEmptyArray<
                        ReactElement & { key: string }
                    >
                }
            </Dropdown>
        </div>
    );
};

export default QuickThemeSwitcher;
