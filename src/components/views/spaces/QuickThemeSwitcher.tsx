/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement, useMemo } from "react";

import { _t } from "../../../languageHandler";
import { Action } from "../../../dispatcher/actions";
import { findNonHighContrastTheme, getOrderedThemes } from "../../../theme";
import Dropdown from "../elements/Dropdown";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import dis from "../../../dispatcher/dispatcher";
import { type RecheckThemePayload } from "../../../dispatcher/payloads/RecheckThemePayload";
import PosthogTrackers from "../../../PosthogTrackers";
import { type NonEmptyArray } from "../../../@types/common";
import { useTheme } from "../../../hooks/useTheme";

type Props = {
    requestClose: () => void;
};

const MATCH_SYSTEM_THEME_ID = "MATCH_SYSTEM_THEME_ID";

const QuickThemeSwitcher: React.FC<Props> = ({ requestClose }) => {
    const orderedThemes = useMemo(() => getOrderedThemes(), []);

    const themeState = useTheme();
    const nonHighContrast = findNonHighContrastTheme(themeState.theme);
    const theme = nonHighContrast ? nonHighContrast : themeState.theme;
    const { systemThemeActivated } = themeState;

    const themeOptions = [
        {
            id: MATCH_SYSTEM_THEME_ID,
            name: _t("theme|match_system"),
        },
        ...orderedThemes,
    ];

    const selectedTheme = systemThemeActivated ? MATCH_SYSTEM_THEME_ID : theme;

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
        } catch {
            dis.dispatch<RecheckThemePayload>({ action: Action.RecheckTheme });
        }

        requestClose();
    };

    return (
        <div className="mx_QuickThemeSwitcher">
            <h4 className="mx_QuickThemeSwitcher_heading">{_t("common|theme")}</h4>
            <Dropdown
                id="mx_QuickSettingsButton_themePickerDropdown"
                onOptionChange={onOptionChange}
                value={selectedTheme}
                label={_t("common|theme")}
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
