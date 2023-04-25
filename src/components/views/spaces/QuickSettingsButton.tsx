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

import React from "react";
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
import { UserTab } from "../dialogs/UserTab";
import QuickThemeSwitcher from "./QuickThemeSwitcher";
import { Icon as PinUprightIcon } from "../../../../res/img/element-icons/room/pin-upright.svg";
import { Icon as EllipsisIcon } from "../../../../res/img/element-icons/room/ellipsis.svg";
import { Icon as MembersIcon } from "../../../../res/img/element-icons/room/members.svg";
import { Icon as FavoriteIcon } from "../../../../res/img/element-icons/roomlist/favorite.svg";
import SettingsStore from "../../../settings/SettingsStore";
import Modal from "../../../Modal";
import DevtoolsDialog from "../dialogs/DevtoolsDialog";
import { SdkContextClass } from "../../../contexts/SDKContext";

const QuickSettingsButton: React.FC<{
    isPanelCollapsed: boolean;
}> = ({ isPanelCollapsed = false }) => {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLDivElement>();

    const { [MetaSpace.Favourites]: favouritesEnabled, [MetaSpace.People]: peopleEnabled } =
        useSettingValue<Record<MetaSpace, boolean>>("Spaces.enabledMetaSpaces");

    let contextMenu: JSX.Element | undefined;
    if (menuDisplayed && handle.current) {
        contextMenu = (
            <ContextMenu
                {...alwaysAboveRightOf(handle.current.getBoundingClientRect(), ChevronFace.None, 16)}
                wrapperClassName="mx_QuickSettingsButton_ContextMenuWrapper"
                onFinished={closeMenu}
                managed={false}
                focusLock={true}
            >
                <h2>{_t("Quick settings")}</h2>

                <AccessibleButton
                    onClick={() => {
                        closeMenu();
                        defaultDispatcher.dispatch({ action: Action.ViewUserSettings });
                    }}
                    kind="primary_outline"
                >
                    {_t("All settings")}
                </AccessibleButton>

                {SettingsStore.getValue("developerMode") && SdkContextClass.instance.roomViewStore.getRoomId() && (
                    <AccessibleButton
                        onClick={() => {
                            closeMenu();
                            Modal.createDialog(
                                DevtoolsDialog,
                                {
                                    roomId: SdkContextClass.instance.roomViewStore.getRoomId()!,
                                },
                                "mx_DevtoolsDialog_wrapper",
                            );
                        }}
                        kind="danger_outline"
                    >
                        {_t("Developer tools")}
                    </AccessibleButton>
                )}

                <h4 className="mx_QuickSettingsButton_pinToSidebarHeading">
                    <PinUprightIcon className="mx_QuickSettingsButton_icon" />
                    {_t("Pin to sidebar")}
                </h4>

                <StyledCheckbox
                    className="mx_QuickSettingsButton_favouritesCheckbox"
                    checked={!!favouritesEnabled}
                    onChange={onMetaSpaceChangeFactory(MetaSpace.Favourites, "WebQuickSettingsPinToSidebarCheckbox")}
                >
                    <FavoriteIcon className="mx_QuickSettingsButton_icon" />
                    {_t("Favourites")}
                </StyledCheckbox>
                <StyledCheckbox
                    className="mx_QuickSettingsButton_peopleCheckbox"
                    checked={!!peopleEnabled}
                    onChange={onMetaSpaceChangeFactory(MetaSpace.People, "WebQuickSettingsPinToSidebarCheckbox")}
                >
                    <MembersIcon className="mx_QuickSettingsButton_icon" />
                    {_t("People")}
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
                    <EllipsisIcon className="mx_QuickSettingsButton_icon" />
                    {_t("More options")}
                </AccessibleButton>

                <QuickThemeSwitcher requestClose={closeMenu} />
            </ContextMenu>
        );
    }

    return (
        <>
            <AccessibleTooltipButton
                className={classNames("mx_QuickSettingsButton", { expanded: !isPanelCollapsed })}
                onClick={openMenu}
                title={_t("Quick settings")}
                inputRef={handle}
                forceHide={!isPanelCollapsed}
                aria-expanded={!isPanelCollapsed}
            >
                {!isPanelCollapsed ? _t("Settings") : null}
            </AccessibleTooltipButton>

            {contextMenu}
        </>
    );
};

export default QuickSettingsButton;
