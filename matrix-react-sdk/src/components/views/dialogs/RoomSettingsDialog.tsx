/*
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2023 The Matrix.org Foundation C.I.C.


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
import { RoomEvent, Room } from "matrix-js-sdk/src/models/room";

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
import { PollHistoryTab } from "../settings/tabs/room/PollHistoryTab";
import ErrorBoundary from "../elements/ErrorBoundary";

export const enum RoomSettingsTab {
    General = "ROOM_GENERAL_TAB",
    Voip = "ROOM_VOIP_TAB",
    Security = "ROOM_SECURITY_TAB",
    Roles = "ROOM_ROLES_TAB",
    Notifications = "ROOM_NOTIFICATIONS_TAB",
    Bridges = "ROOM_BRIDGES_TAB",
    Advanced = "ROOM_ADVANCED_TAB",
    PollHistory = "ROOM_POLL_HISTORY_TAB",
}

interface IProps {
    roomId: string;
    onFinished: (success?: boolean) => void;
    initialTabId?: string;
}

interface IState {
    room: Room;
}

class RoomSettingsDialog extends React.Component<IProps, IState> {
    private dispatcherRef?: string;

    public constructor(props: IProps) {
        super(props);

        const room = this.getRoom();
        this.state = { room };
    }

    public componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.get().on(RoomEvent.Name, this.onRoomName);
        this.onRoomName();
    }

    public componentDidUpdate(): void {
        if (this.props.roomId !== this.state.room.roomId) {
            const room = this.getRoom();
            this.setState({ room });
        }
    }

    public componentWillUnmount(): void {
        if (this.dispatcherRef) {
            dis.unregister(this.dispatcherRef);
        }

        MatrixClientPeg.get().removeListener(RoomEvent.Name, this.onRoomName);
    }

    /**
     * Get room from client
     * @returns Room
     * @throws when room is not found
     */
    private getRoom(): Room {
        const room = MatrixClientPeg.get().getRoom(this.props.roomId)!;

        // something is really wrong if we encounter this
        if (!room) {
            throw new Error(`Cannot find room ${this.props.roomId}`);
        }
        return room;
    }

    private onAction = (payload: ActionPayload): void => {
        // When view changes below us, close the room settings
        // whilst the modal is open this can only be triggered when someone hits Leave Room
        if (payload.action === Action.ViewHomePage) {
            this.props.onFinished(true);
        }
    };

    private onRoomName = (): void => {
        // rerender when the room name changes
        this.forceUpdate();
    };

    private getTabs(): NonEmptyArray<Tab<RoomSettingsTab>> {
        const tabs: Tab<RoomSettingsTab>[] = [];

        tabs.push(
            new Tab(
                RoomSettingsTab.General,
                _td("General"),
                "mx_RoomSettingsDialog_settingsIcon",
                <GeneralRoomSettingsTab room={this.state.room} />,
                "RoomSettingsGeneral",
            ),
        );
        if (SettingsStore.getValue("feature_group_calls")) {
            tabs.push(
                new Tab(
                    RoomSettingsTab.Voip,
                    _td("Voice & Video"),
                    "mx_RoomSettingsDialog_voiceIcon",
                    <VoipRoomSettingsTab room={this.state.room} />,
                ),
            );
        }
        tabs.push(
            new Tab(
                RoomSettingsTab.Security,
                _td("Security & Privacy"),
                "mx_RoomSettingsDialog_securityIcon",
                <SecurityRoomSettingsTab room={this.state.room} closeSettingsFn={() => this.props.onFinished(true)} />,
                "RoomSettingsSecurityPrivacy",
            ),
        );
        tabs.push(
            new Tab(
                RoomSettingsTab.Roles,
                _td("Roles & Permissions"),
                "mx_RoomSettingsDialog_rolesIcon",
                <RolesRoomSettingsTab room={this.state.room} />,
                "RoomSettingsRolesPermissions",
            ),
        );
        tabs.push(
            new Tab(
                RoomSettingsTab.Notifications,
                _td("Notifications"),
                "mx_RoomSettingsDialog_notificationsIcon",
                (
                    <NotificationSettingsTab
                        roomId={this.state.room.roomId}
                        closeSettingsFn={() => this.props.onFinished(true)}
                    />
                ),
                "RoomSettingsNotifications",
            ),
        );

        if (SettingsStore.getValue("feature_bridge_state")) {
            tabs.push(
                new Tab(
                    RoomSettingsTab.Bridges,
                    _td("Bridges"),
                    "mx_RoomSettingsDialog_bridgesIcon",
                    <BridgeSettingsTab room={this.state.room} />,
                    "RoomSettingsBridges",
                ),
            );
        }

        tabs.push(
            new Tab(
                RoomSettingsTab.PollHistory,
                _td("Poll history"),
                "mx_RoomSettingsDialog_pollsIcon",
                <PollHistoryTab room={this.state.room} onFinished={() => this.props.onFinished(true)} />,
            ),
        );

        if (SettingsStore.getValue(UIFeature.AdvancedSettings)) {
            tabs.push(
                new Tab(
                    RoomSettingsTab.Advanced,
                    _td("Advanced"),
                    "mx_RoomSettingsDialog_warningIcon",
                    (
                        <AdvancedRoomSettingsTab
                            room={this.state.room}
                            closeSettingsFn={() => this.props.onFinished(true)}
                        />
                    ),
                    "RoomSettingsAdvanced",
                ),
            );
        }

        return tabs as NonEmptyArray<Tab<RoomSettingsTab>>;
    }

    public render(): React.ReactNode {
        const roomName = this.state.room.name;
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

const WrappedRoomSettingsDialog: React.FC<IProps> = (props) => (
    <ErrorBoundary>
        <RoomSettingsDialog {...props} />
    </ErrorBoundary>
);

export default WrappedRoomSettingsDialog;
