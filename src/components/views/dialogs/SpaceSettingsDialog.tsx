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
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClient } from "matrix-js-sdk/src/client";

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
import { NonEmptyArray } from "../../../@types/common";

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
                _td("General"),
                "mx_SpaceSettingsDialog_generalIcon",
                <SpaceSettingsGeneralTab matrixClient={cli} space={space} />,
            ),
            new Tab(
                SpaceSettingsTab.Visibility,
                _td("Visibility"),
                "mx_SpaceSettingsDialog_visibilityIcon",
                <SpaceSettingsVisibilityTab matrixClient={cli} space={space} closeSettingsFn={onFinished} />,
            ),
            new Tab(
                SpaceSettingsTab.Roles,
                _td("Roles & Permissions"),
                "mx_RoomSettingsDialog_rolesIcon",
                <RolesRoomSettingsTab room={space} />,
            ),
            SettingsStore.getValue(UIFeature.AdvancedSettings)
                ? new Tab(
                      SpaceSettingsTab.Advanced,
                      _td("Advanced"),
                      "mx_RoomSettingsDialog_warningIcon",
                      <AdvancedRoomSettingsTab room={space} closeSettingsFn={onFinished} />,
                  )
                : null,
        ].filter(Boolean) as NonEmptyArray<Tab<SpaceSettingsTab>>;
    }, [cli, space, onFinished]);

    return (
        <BaseDialog
            title={_t("Settings - %(spaceName)s", { spaceName: space.name || _t("Unnamed Space") })}
            className="mx_SpaceSettingsDialog"
            contentId="mx_SpaceSettingsDialog"
            onFinished={onFinished}
            fixedWidth={false}
        >
            <div className="mx_SpaceSettingsDialog_content" id="mx_SpaceSettingsDialog">
                <TabbedView tabs={tabs} />
            </div>
        </BaseDialog>
    );
};

export default SpaceSettingsDialog;
