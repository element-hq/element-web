/*
Copyright 2024,2025 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import classNames from "classnames";
import { SettingsSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { IconButton, Text, Tooltip } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import ContextMenu, { alwaysAboveRightOf, ChevronFace, useContextMenu } from "../../structures/ContextMenu";
import AccessibleButton from "../elements/AccessibleButton";
import { useSettingValue } from "../../../hooks/useSettings";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import QuickThemeSwitcher from "./QuickThemeSwitcher";
import Modal from "../../../Modal";
import DevtoolsDialog from "../dialogs/DevtoolsDialog";
import { SdkContextClass } from "../../../contexts/SDKContext";
import { ReleaseAnnouncement } from "../../structures/ReleaseAnnouncement";

const QuickSettingsButton: React.FC<{
    isPanelCollapsed: boolean;
}> = ({ isPanelCollapsed = false }) => {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLButtonElement>();

    const currentRoomId = SdkContextClass.instance.roomViewStore.getRoomId();
    const developerModeEnabled = useSettingValue("developerMode");

    let contextMenu: JSX.Element | undefined;
    if (menuDisplayed && handle.current) {
        contextMenu = (
            <ContextMenu
                {...alwaysAboveRightOf(handle.current.getBoundingClientRect(), ChevronFace.None, 16)}
                wrapperClassName="mx_QuickSettingsButton_ContextMenuWrapper"
                // Eventually replace with a properly aria-labelled menu
                data-testid="quick-settings-menu"
                onFinished={closeMenu}
                managed={false}
                focusLock={true}
            >
                <h2>{_t("quick_settings|title")}</h2>

                <AccessibleButton
                    onClick={() => {
                        closeMenu();
                        defaultDispatcher.dispatch({ action: Action.ViewUserSettings });
                    }}
                    kind="primary_outline"
                >
                    {_t("quick_settings|all_settings")}
                </AccessibleButton>

                {currentRoomId && developerModeEnabled && (
                    <AccessibleButton
                        onClick={() => {
                            closeMenu();
                            Modal.createDialog(
                                DevtoolsDialog,
                                {
                                    roomId: currentRoomId,
                                },
                                "mx_DevtoolsDialog_wrapper",
                            );
                        }}
                        kind="danger_outline"
                    >
                        {_t("devtools|title")}
                    </AccessibleButton>
                )}

                <QuickThemeSwitcher requestClose={closeMenu} />
            </ContextMenu>
        );
    }

    let button = (
        <IconButton
            aria-label={_t("quick_settings|title")}
            className={classNames("mx_QuickSettingsButton", { expanded: !isPanelCollapsed })}
            onClick={openMenu}
            title={isPanelCollapsed ? _t("quick_settings|title") : undefined}
            ref={handle}
            aria-expanded={!isPanelCollapsed}
        >
            <>
                <SettingsSolidIcon />
                {/* This is dirty, but we need to add the label to the indicator icon */}
                {!isPanelCollapsed && (
                    <Text className="mx_QuickSettingsButton_label" as="span" size="md" title={_t("common|settings")}>
                        {_t("common|settings")}
                    </Text>
                )}
            </>
        </IconButton>
    );

    if (isPanelCollapsed) {
        button = (
            <Tooltip label={_t("quick_settings|title")} placement="right">
                {button}
            </Tooltip>
        );
    }

    return (
        <>
            <ReleaseAnnouncement
                feature="newRoomList_settings"
                header={_t("room_list|release_announcement|settings|title")}
                description={_t("room_list|release_announcement|settings|description")}
                closeLabel={_t("room_list|release_announcement|done")}
                placement="right"
            >
                {button}
            </ReleaseAnnouncement>

            {contextMenu}
        </>
    );
};

export default QuickSettingsButton;
