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

import React from 'react';
import PropTypes from 'prop-types';
import TabbedView, {Tab} from "../../structures/TabbedView";
import {_t, _td} from "../../../languageHandler";
import AdvancedRoomSettingsTab from "../settings/tabs/room/AdvancedRoomSettingsTab";
import RolesRoomSettingsTab from "../settings/tabs/room/RolesRoomSettingsTab";
import GeneralRoomSettingsTab from "../settings/tabs/room/GeneralRoomSettingsTab";
import SecurityRoomSettingsTab from "../settings/tabs/room/SecurityRoomSettingsTab";
import NotificationSettingsTab from "../settings/tabs/room/NotificationSettingsTab";
import BridgeSettingsTab from "../settings/tabs/room/BridgeSettingsTab";
import * as sdk from "../../../index";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";
import SettingsStore from "../../../settings/SettingsStore";

export default class RoomSettingsDialog extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
        onFinished: PropTypes.func.isRequired,
    };

    componentDidMount() {
        this._dispatcherRef = dis.register(this._onAction);
    }

    componentWillUnmount() {
        if (this._dispatcherRef) dis.unregister(this._dispatcherRef);
    }

    _onAction = (payload) => {
        // When room changes below us, close the room settings
        // whilst the modal is open this can only be triggered when someone hits Leave Room
        if (payload.action === 'view_next_room') {
            this.props.onFinished();
        }
    };

    _getTabs() {
        const tabs = [];

        tabs.push(new Tab(
            _td("General"),
            "mx_RoomSettingsDialog_settingsIcon",
            <GeneralRoomSettingsTab roomId={this.props.roomId} />,
        ));
        tabs.push(new Tab(
            _td("Security & Privacy"),
            "mx_RoomSettingsDialog_securityIcon",
            <SecurityRoomSettingsTab roomId={this.props.roomId} />,
        ));
        tabs.push(new Tab(
            _td("Roles & Permissions"),
            "mx_RoomSettingsDialog_rolesIcon",
            <RolesRoomSettingsTab roomId={this.props.roomId} />,
        ));
        tabs.push(new Tab(
            _td("Notifications"),
            "mx_RoomSettingsDialog_notificationsIcon",
            <NotificationSettingsTab roomId={this.props.roomId} />,
        ));

        if (SettingsStore.isFeatureEnabled("feature_bridge_state")) {
            tabs.push(new Tab(
                _td("Bridges"),
                "mx_RoomSettingsDialog_bridgesIcon",
                <BridgeSettingsTab roomId={this.props.roomId} />,
            ));
        }

        tabs.push(new Tab(
            _td("Advanced"),
            "mx_RoomSettingsDialog_warningIcon",
            <AdvancedRoomSettingsTab roomId={this.props.roomId} closeSettingsFn={this.props.onFinished} />,
        ));

        return tabs;
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        const roomName = MatrixClientPeg.get().getRoom(this.props.roomId).name;
        return (
            <BaseDialog className='mx_RoomSettingsDialog' hasCancel={true}
                        onFinished={this.props.onFinished} title={_t("Room Settings - %(roomName)s", {roomName})}>
                <div className='ms_SettingsDialog_content'>
                    <TabbedView tabs={this._getTabs()} />
                </div>
            </BaseDialog>
        );
    }
}
