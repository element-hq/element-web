/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { RoomEvent, type Room, RoomStateEvent, type MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";

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
import { type ActionPayload } from "../../../dispatcher/payloads";
import { type NonEmptyArray } from "../../../@types/common";
import { PollHistoryTab } from "../settings/tabs/room/PollHistoryTab";
import ErrorBoundary from "../elements/ErrorBoundary";
import { PeopleRoomSettingsTab } from "../settings/tabs/room/PeopleRoomSettingsTab";

export const enum RoomSettingsTab {
    General = "ROOM_GENERAL_TAB",
    People = "ROOM_PEOPLE_TAB",
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
    initialTabId?: RoomSettingsTab;
}

interface IState {
    room: Room;
    activeTabId: RoomSettingsTab;
}

class RoomSettingsDialog extends React.Component<IProps, IState> {
    private dispatcherRef?: string;

    public constructor(props: IProps) {
        super(props);

        const room = this.getRoom();
        this.state = { room, activeTabId: props.initialTabId || RoomSettingsTab.General };
    }

    public componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.safeGet().on(RoomEvent.Name, this.onRoomName);
        MatrixClientPeg.safeGet().on(RoomStateEvent.Events, this.onStateEvent);
        this.onRoomName();
    }

    public componentDidUpdate(): void {
        if (this.props.roomId !== this.state.room.roomId) {
            const room = this.getRoom();
            this.setState({ room });
        }
    }

    public componentWillUnmount(): void {
        dis.unregister(this.dispatcherRef);

        MatrixClientPeg.get()?.removeListener(RoomEvent.Name, this.onRoomName);
        MatrixClientPeg.get()?.removeListener(RoomStateEvent.Events, this.onStateEvent);
    }

    /**
     * Get room from client
     * @returns Room
     * @throws when room is not found
     */
    private getRoom(): Room {
        const room = MatrixClientPeg.safeGet().getRoom(this.props.roomId)!;

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

    private onStateEvent = (event: MatrixEvent): void => {
        if (event.getType() === EventType.RoomJoinRules) this.forceUpdate();
    };

    private onTabChange = (tabId: RoomSettingsTab): void => {
        this.setState({ activeTabId: tabId });
    };

    private getTabs(): NonEmptyArray<Tab<RoomSettingsTab>> {
        const tabs: Tab<RoomSettingsTab>[] = [];

        tabs.push(
            new Tab(
                RoomSettingsTab.General,
                _td("common|general"),
                "mx_RoomSettingsDialog_settingsIcon",
                <GeneralRoomSettingsTab room={this.state.room} />,
                "RoomSettingsGeneral",
            ),
        );
        if (SettingsStore.getValue("feature_ask_to_join") && this.state.room.getJoinRule() === "knock") {
            tabs.push(
                new Tab(
                    RoomSettingsTab.People,
                    _td("common|people"),
                    "mx_RoomSettingsDialog_peopleIcon",
                    <PeopleRoomSettingsTab room={this.state.room} />,
                ),
            );
        }
        if (SettingsStore.getValue("feature_group_calls")) {
            tabs.push(
                new Tab(
                    RoomSettingsTab.Voip,
                    _td("settings|voip|title"),
                    "mx_RoomSettingsDialog_voiceIcon",
                    <VoipRoomSettingsTab room={this.state.room} />,
                ),
            );
        }
        tabs.push(
            new Tab(
                RoomSettingsTab.Security,
                _td("room_settings|security|title"),
                "mx_RoomSettingsDialog_securityIcon",
                <SecurityRoomSettingsTab room={this.state.room} closeSettingsFn={() => this.props.onFinished(true)} />,
                "RoomSettingsSecurityPrivacy",
            ),
        );
        tabs.push(
            new Tab(
                RoomSettingsTab.Roles,
                _td("room_settings|permissions|title"),
                "mx_RoomSettingsDialog_rolesIcon",
                <RolesRoomSettingsTab room={this.state.room} />,
                "RoomSettingsRolesPermissions",
            ),
        );
        tabs.push(
            new Tab(
                RoomSettingsTab.Notifications,
                _td("notifications|enable_prompt_toast_title"),
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
                    _td("room_settings|bridges|title"),
                    "mx_RoomSettingsDialog_bridgesIcon",
                    <BridgeSettingsTab room={this.state.room} />,
                    "RoomSettingsBridges",
                ),
            );
        }

        tabs.push(
            new Tab(
                RoomSettingsTab.PollHistory,
                _td("right_panel|polls_button"),
                "mx_RoomSettingsDialog_pollsIcon",
                <PollHistoryTab room={this.state.room} onFinished={() => this.props.onFinished(true)} />,
            ),
        );

        if (SettingsStore.getValue(UIFeature.AdvancedSettings)) {
            tabs.push(
                new Tab(
                    RoomSettingsTab.Advanced,
                    _td("common|advanced"),
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
                title={_t("room_settings|title", { roomName })}
            >
                <div className="mx_SettingsDialog_content">
                    <TabbedView
                        tabs={this.getTabs()}
                        activeTabId={this.state.activeTabId}
                        screenName="RoomSettings"
                        onChange={this.onTabChange}
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
