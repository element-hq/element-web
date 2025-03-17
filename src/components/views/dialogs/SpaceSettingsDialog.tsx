/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useMemo } from "react";
import { type Room, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t, _td } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { useDispatcher } from "../../../hooks/useDispatcher";
import TabbedView, { Tab } from "../../structures/TabbedView";
import SpaceSettingsGeneralTab from "../spaces/SpaceSettingsGeneralTab";
import SpaceSettingsVisibilityTab from "../spaces/SpaceSettingsVisibilityTab";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import AdvancedRoomSettingsTab from "../settings/tabs/room/AdvancedRoomSettingsTab";
import RolesRoomSettingsTab from "../settings/tabs/room/RolesRoomSettingsTab";
import { Action } from "../../../dispatcher/actions";
import { type NonEmptyArray } from "../../../@types/common";

export enum SpaceSettingsTab {
    General = "SPACE_GENERAL_TAB",
    Visibility = "SPACE_VISIBILITY_TAB",
    Roles = "SPACE_ROLES_TAB",
    Advanced = "SPACE_ADVANCED_TAB",
}

interface IProps {
    matrixClient: MatrixClient;
    space: Room;
    onFinished(): void;
}

const SpaceSettingsDialog: React.FC<IProps> = ({ matrixClient: cli, space, onFinished }) => {
    useDispatcher(defaultDispatcher, (payload) => {
        if (payload.action === Action.AfterLeaveRoom && payload.room_id === space.roomId) {
            onFinished();
        }
    });

    const tabs = useMemo(() => {
        return [
            new Tab(
                SpaceSettingsTab.General,
                _td("common|general"),
                "mx_SpaceSettingsDialog_generalIcon",
                <SpaceSettingsGeneralTab matrixClient={cli} space={space} />,
            ),
            new Tab(
                SpaceSettingsTab.Visibility,
                _td("room_settings|visibility|title"),
                "mx_SpaceSettingsDialog_visibilityIcon",
                <SpaceSettingsVisibilityTab matrixClient={cli} space={space} closeSettingsFn={onFinished} />,
            ),
            new Tab(
                SpaceSettingsTab.Roles,
                _td("room_settings|permissions|title"),
                "mx_RoomSettingsDialog_rolesIcon",
                <RolesRoomSettingsTab room={space} />,
            ),
            SettingsStore.getValue(UIFeature.AdvancedSettings)
                ? new Tab(
                      SpaceSettingsTab.Advanced,
                      _td("common|advanced"),
                      "mx_RoomSettingsDialog_warningIcon",
                      <AdvancedRoomSettingsTab room={space} closeSettingsFn={onFinished} />,
                  )
                : null,
        ].filter(Boolean) as NonEmptyArray<Tab<SpaceSettingsTab>>;
    }, [cli, space, onFinished]);

    const [activeTabId, setActiveTabId] = React.useState(SpaceSettingsTab.General);

    return (
        <BaseDialog
            title={_t("space_settings|title", { spaceName: space.name || _t("common|unnamed_space") })}
            className="mx_SpaceSettingsDialog"
            contentId="mx_SpaceSettingsDialog"
            onFinished={onFinished}
            fixedWidth={false}
        >
            <div className="mx_SpaceSettingsDialog_content" id="mx_SpaceSettingsDialog">
                <TabbedView tabs={tabs} activeTabId={activeTabId} onChange={setActiveTabId} />
            </div>
        </BaseDialog>
    );
};

export default SpaceSettingsDialog;
