/*
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import { RoomEvent } from "matrix-js-sdk/src/models/room";

import TabbedView, { Tab } from "../../structures/TabbedView";
import { _t, _td } from "../../../languageHandler";
import AdvancedRoomSettingsTab from "../settings/tabs/room/AdvancedRoomSettingsTab";
import RolesRoomSettingsTab from "../settings/tabs/room/RolesRoomSettingsTab";
import GeneralRoomSettingsTab from "../settings/tabs/room/GeneralRoomSettingsTab";
import SecurityRoomSettingsTab from "../settings/tabs/room/SecurityRoomSettingsTab";
import NotificationSettingsTab from "../settings/tabs/room/NotificationSettingsTab";
import BridgeSettingsTab from "../settings/tabs/room/BridgeSettingsTab";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import BaseDialog from "./BaseDialog";
import { Action } from "../../../dispatcher/actions";
import { VoipRoomSettingsTab } from "../settings/tabs/room/VoipRoomSettingsTab";
import { ActionPayload } from "../../../dispatcher/payloads";
import { NonEmptyArray } from "../../../@types/common";

export const ROOM_GENERAL_TAB = "ROOM_GENERAL_TAB";
export const ROOM_VOIP_TAB = "ROOM_VOIP_TAB";
export const ROOM_SECURITY_TAB = "ROOM_SECURITY_TAB";
export const ROOM_ROLES_TAB = "ROOM_ROLES_TAB";
export const ROOM_NOTIFICATIONS_TAB = "ROOM_NOTIFICATIONS_TAB";
export const ROOM_BRIDGES_TAB = "ROOM_BRIDGES_TAB";
export const ROOM_ADVANCED_TAB = "ROOM_ADVANCED_TAB";

interface IProps {
    roomId: string;
    onFinished: (success?: boolean) => void;
    initialTabId?: string;
}

interface IState {
    roomName: string;
}

export default class RoomSettingsDialog extends React.Component<IProps, IState> {
    private dispatcherRef: string;

    public constructor(props: IProps) {
        super(props);
        this.state = { roomName: "" };
    }

    public componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.get().on(RoomEvent.Name, this.onRoomName);
        this.onRoomName();
    }

    public componentWillUnmount(): void {
        if (this.dispatcherRef) {
            dis.unregister(this.dispatcherRef);
        }

        MatrixClientPeg.get().removeListener(RoomEvent.Name, this.onRoomName);
    }

    private onAction = (payload: ActionPayload): void => {
        // When view changes below us, close the room settings
        // whilst the modal is open this can only be triggered when someone hits Leave Room
        if (payload.action === Action.ViewHomePage) {
            this.props.onFinished(true);
        }
    };

    private onRoomName = (): void => {
        this.setState({
            roomName: MatrixClientPeg.get().getRoom(this.props.roomId)?.name ?? "",
        });
    };

    private getTabs(): NonEmptyArray<Tab> {
        const tabs: Tab[] = [];

        tabs.push(
            new Tab(
                ROOM_GENERAL_TAB,
                _td("General"),
                "mx_RoomSettingsDialog_settingsIcon",
                <GeneralRoomSettingsTab roomId={this.props.roomId} />,
                "RoomSettingsGeneral",
            ),
        );
        if (SettingsStore.getValue("feature_group_calls")) {
            tabs.push(
                new Tab(
                    ROOM_VOIP_TAB,
                    _td("Voice & Video"),
                    "mx_RoomSettingsDialog_voiceIcon",
                    <VoipRoomSettingsTab roomId={this.props.roomId} />,
                ),
            );
        }
        tabs.push(
            new Tab(
                ROOM_SECURITY_TAB,
                _td("Security & Privacy"),
                "mx_RoomSettingsDialog_securityIcon",
                (
                    <SecurityRoomSettingsTab
                        roomId={this.props.roomId}
                        closeSettingsFn={() => this.props.onFinished(true)}
                    />
                ),
                "RoomSettingsSecurityPrivacy",
            ),
        );
        tabs.push(
            new Tab(
                ROOM_ROLES_TAB,
                _td("Roles & Permissions"),
                "mx_RoomSettingsDialog_rolesIcon",
                <RolesRoomSettingsTab roomId={this.props.roomId} />,
                "RoomSettingsRolesPermissions",
            ),
        );
        tabs.push(
            new Tab(
                ROOM_NOTIFICATIONS_TAB,
                _td("Notifications"),
                "mx_RoomSettingsDialog_notificationsIcon",
                (
                    <NotificationSettingsTab
                        roomId={this.props.roomId}
                        closeSettingsFn={() => this.props.onFinished(true)}
                    />
                ),
                "RoomSettingsNotifications",
            ),
        );

        if (SettingsStore.getValue("feature_bridge_state")) {
            tabs.push(
                new Tab(
                    ROOM_BRIDGES_TAB,
                    _td("Bridges"),
                    "mx_RoomSettingsDialog_bridgesIcon",
                    <BridgeSettingsTab roomId={this.props.roomId} />,
                    "RoomSettingsBridges",
                ),
            );
        }

        if (SettingsStore.getValue(UIFeature.AdvancedSettings)) {
            tabs.push(
                new Tab(
                    ROOM_ADVANCED_TAB,
                    _td("Advanced"),
                    "mx_RoomSettingsDialog_warningIcon",
                    (
                        <AdvancedRoomSettingsTab
                            roomId={this.props.roomId}
                            closeSettingsFn={() => this.props.onFinished(true)}
                        />
                    ),
                    "RoomSettingsAdvanced",
                ),
            );
        }

        return tabs as NonEmptyArray<Tab>;
    }

    public render(): React.ReactNode {
        const roomName = this.state.roomName;
        return (
            <BaseDialog
                className="mx_RoomSettingsDialog"
                hasCancel={true}
                onFinished={this.props.onFinished}
                title={_t("Room Settings - %(roomName)s", { roomName })}
            >
                <div className="mx_SettingsDialog_content">
                    <TabbedView
                        tabs={this.getTabs()}
                        initialTabId={this.props.initialTabId}
                        screenName="RoomSettings"
                    />
                </div>
            </BaseDialog>
        );
    }
}
