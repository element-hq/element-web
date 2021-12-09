/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { useMemo } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import ContextMenu, { alwaysAboveRightOf, ChevronFace, useContextMenu } from "../../structures/ContextMenu";
import AccessibleButton from "../elements/AccessibleButton";
import StyledCheckbox from "../elements/StyledCheckbox";
import { MetaSpace } from "../../../stores/spaces";
import { useSettingValue } from "../../../hooks/useSettings";
import { onMetaSpaceChangeFactory } from "../settings/tabs/user/SidebarUserSettingsTab";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserSettingsDialog";
import { findNonHighContrastTheme, getOrderedThemes } from "../../../theme";
import Dropdown from "../elements/Dropdown";
import ThemeChoicePanel from "../settings/ThemeChoicePanel";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import dis from "../../../dispatcher/dispatcher";
import { RecheckThemePayload } from "../../../dispatcher/payloads/RecheckThemePayload";

const QuickSettingsButton = ({ isPanelCollapsed = false }) => {
    const orderedThemes = useMemo(getOrderedThemes, []);
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLDivElement>();

    const {
        [MetaSpace.Favourites]: favouritesEnabled,
        [MetaSpace.People]: peopleEnabled,
    } = useSettingValue<Record<MetaSpace, boolean>>("Spaces.enabledMetaSpaces");

    let contextMenu: JSX.Element;
    if (menuDisplayed) {
        const themeState = ThemeChoicePanel.calculateThemeState();
        const nonHighContrast = findNonHighContrastTheme(themeState.theme);
        const theme = nonHighContrast ? nonHighContrast : themeState.theme;

        contextMenu = <ContextMenu
            {...alwaysAboveRightOf(handle.current.getBoundingClientRect(), ChevronFace.None, 16)}
            wrapperClassName="mx_QuickSettingsButton_ContextMenuWrapper"
            onFinished={closeMenu}
            managed={false}
            focusLock={true}
        >
            <h2>{ _t("Quick settings") }</h2>

            <AccessibleButton
                onClick={() => {
                    closeMenu();
                    defaultDispatcher.dispatch({
                        action: Action.ViewUserSettings,
                        initialTabId: UserTab.Sidebar,
                    });
                }}
                kind="primary_outline"
            >
                { _t("All settings") }
            </AccessibleButton>

            <h4 className="mx_QuickSettingsButton_pinToSidebarHeading">{ _t("Pin to sidebar") }</h4>

            <StyledCheckbox
                className="mx_QuickSettingsButton_favouritesCheckbox"
                checked={!!favouritesEnabled}
                onChange={onMetaSpaceChangeFactory(MetaSpace.Favourites)}
            >
                { _t("Favourites") }
            </StyledCheckbox>
            <StyledCheckbox
                className="mx_QuickSettingsButton_peopleCheckbox"
                checked={!!peopleEnabled}
                onChange={onMetaSpaceChangeFactory(MetaSpace.People)}
            >
                { _t("People") }
            </StyledCheckbox>
            <AccessibleButton
                className="mx_QuickSettingsButton_moreOptionsButton"
                onClick={() => {
                    closeMenu();
                    defaultDispatcher.dispatch({
                        action: Action.ViewUserSettings,
                        initialTabId: UserTab.Sidebar,
                    });
                }}
            >
                { _t("More options") }
            </AccessibleButton>

            <div className="mx_QuickSettingsButton_themePicker">
                <h4>{ _t("Theme") }</h4>
                <Dropdown
                    id="mx_QuickSettingsButton_themePickerDropdown"
                    onOptionChange={async (newTheme: string) => {
                        // XXX: mostly copied from ThemeChoicePanel
                        // doing getValue in the .catch will still return the value we failed to set,
                        // so remember what the value was before we tried to set it so we can revert
                        // const oldTheme: string = SettingsStore.getValue("theme");
                        SettingsStore.setValue("theme", null, SettingLevel.DEVICE, newTheme).catch(() => {
                            dis.dispatch<RecheckThemePayload>({ action: Action.RecheckTheme });
                        });
                        // The settings watcher doesn't fire until the echo comes back from the
                        // server, so to make the theme change immediately we need to manually
                        // do the dispatch now
                        // XXX: The local echoed value appears to be unreliable, in particular
                        // when settings custom themes(!) so adding forceTheme to override
                        // the value from settings.
                        dis.dispatch<RecheckThemePayload>({ action: Action.RecheckTheme, forceTheme: newTheme });
                        closeMenu();
                    }}
                    value={theme}
                    label={_t("Space selection")}
                >
                    { orderedThemes.map((theme) => (
                        <div key={theme.id}>
                            { theme.name }
                        </div>
                    )) }
                </Dropdown>
            </div>
        </ContextMenu>;
    }

    return <>
        <AccessibleTooltipButton
            className={classNames("mx_QuickSettingsButton", { expanded: !isPanelCollapsed })}
            onClick={openMenu}
            title={_t("Quick settings")}
            inputRef={handle}
            forceHide={!isPanelCollapsed}
        >
            { !isPanelCollapsed ? _t("Settings") : null }
        </AccessibleTooltipButton>

        { contextMenu }
    </>;
};

export default QuickSettingsButton;
