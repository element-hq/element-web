/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import SettingsStore from "../../../settings/SettingsStore";
import React from 'react';
import PropTypes from 'prop-types';
import * as sdk from "../../../index";
import dis from "../../../dispatcher/dispatcher";
import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import {Action} from "../../../dispatcher/actions";

export default class MemberTile extends React.Component {
    static propTypes = {
        member: PropTypes.any.isRequired, // RoomMember
        showPresence: PropTypes.bool,
    };

    static defaultProps = {
        showPresence: true,
    };

    constructor(props) {
        super(props);

        this.state = {
            statusMessage: this.getStatusMessage(),
            isRoomEncrypted: false,
            e2eStatus: null,
        };
    }

    componentDidMount() {
        const cli = MatrixClientPeg.get();

        if (SettingsStore.getValue("feature_custom_status")) {
            const { user } = this.props.member;
            if (user) {
                user.on("User._unstable_statusMessage", this._onStatusMessageCommitted);
            }
        }

        const { roomId } = this.props.member;
        if (roomId) {
            const isRoomEncrypted = cli.isRoomEncrypted(roomId);
            this.setState({
                isRoomEncrypted,
            });
            if (isRoomEncrypted) {
                cli.on("userTrustStatusChanged", this.onUserTrustStatusChanged);
                cli.on("deviceVerificationChanged", this.onDeviceVerificationChanged);
                this.updateE2EStatus();
            } else {
                // Listen for room to become encrypted
                cli.on("RoomState.events", this.onRoomStateEvents);
            }
        }
    }

    componentWillUnmount() {
        const cli = MatrixClientPeg.get();

        const { user } = this.props.member;
        if (user) {
            user.removeListener(
                "User._unstable_statusMessage",
                this._onStatusMessageCommitted,
            );
        }

        if (cli) {
            cli.removeListener("RoomState.events", this.onRoomStateEvents);
            cli.removeListener("userTrustStatusChanged", this.onUserTrustStatusChanged);
            cli.removeListener("deviceVerificationChanged", this.onDeviceVerificationChanged);
        }
    }

    onRoomStateEvents = ev => {
        if (ev.getType() !== "m.room.encryption") return;
        const { roomId } = this.props.member;
        if (ev.getRoomId() !== roomId) return;

        // The room is encrypted now.
        const cli = MatrixClientPeg.get();
        cli.removeListener("RoomState.events", this.onRoomStateEvents);
        this.setState({
            isRoomEncrypted: true,
        });
        this.updateE2EStatus();
    };

    onUserTrustStatusChanged = (userId, trustStatus) => {
        if (userId !== this.props.member.userId) return;
        this.updateE2EStatus();
    };

    onDeviceVerificationChanged = (userId, deviceId, deviceInfo) => {
        if (userId !== this.props.member.userId) return;
        this.updateE2EStatus();
    };

    async updateE2EStatus() {
        const cli = MatrixClientPeg.get();
        const { userId } = this.props.member;
        const isMe = userId === cli.getUserId();
        const userTrust = cli.checkUserTrust(userId);
        if (!userTrust.isCrossSigningVerified()) {
            this.setState({
                e2eStatus: userTrust.wasCrossSigningVerified() ? "warning" : "normal",
            });
            return;
        }

        const devices = cli.getStoredDevicesForUser(userId);
        const anyDeviceUnverified = devices.some(device => {
            const { deviceId } = device;
            // For your own devices, we use the stricter check of cross-signing
            // verification to encourage everyone to trust their own devices via
            // cross-signing so that other users can then safely trust you.
            // For other people's devices, the more general verified check that
            // includes locally verified devices can be used.
            const deviceTrust = cli.checkDeviceTrust(userId, deviceId);
            return isMe ? !deviceTrust.isCrossSigningVerified() : !deviceTrust.isVerified();
        });
        this.setState({
            e2eStatus: anyDeviceUnverified ? "warning" : "verified",
        });
    }

    getStatusMessage() {
        const { user } = this.props.member;
        if (!user) {
            return "";
        }
        return user._unstable_statusMessage;
    }

    _onStatusMessageCommitted = () => {
        // The `User` object has observed a status message change.
        this.setState({
            statusMessage: this.getStatusMessage(),
        });
    };

    shouldComponentUpdate(nextProps, nextState) {
        if (
            this.member_last_modified_time === undefined ||
            this.member_last_modified_time < nextProps.member.getLastModifiedTime()
        ) {
            return true;
        }
        if (
            nextProps.member.user &&
            (this.user_last_modified_time === undefined ||
            this.user_last_modified_time < nextProps.member.user.getLastModifiedTime())
        ) {
            return true;
        }
        if (
            nextState.isRoomEncrypted !== this.state.isRoomEncrypted ||
            nextState.e2eStatus !== this.state.e2eStatus
        ) {
            return true;
        }
        return false;
    }

    onClick = e => {
        dis.dispatch({
            action: Action.ViewUser,
            member: this.props.member,
        });
    };

    _getDisplayName() {
        return this.props.member.name;
    }

    getPowerLabel() {
        return _t("%(userName)s (power %(powerLevelNumber)s)", {
            userName: this.props.member.userId,
            powerLevelNumber: this.props.member.powerLevel,
        });
    }

    render() {
        const MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        const EntityTile = sdk.getComponent('rooms.EntityTile');

        const member = this.props.member;
        const name = this._getDisplayName();
        const presenceState = member.user ? member.user.presence : null;

        let statusMessage = null;
        if (member.user && SettingsStore.getValue("feature_custom_status")) {
            statusMessage = this.state.statusMessage;
        }

        const av = (
            <MemberAvatar member={member} width={36} height={36} aria-hidden="true" />
        );

        if (member.user) {
            this.user_last_modified_time = member.user.getLastModifiedTime();
        }
        this.member_last_modified_time = member.getLastModifiedTime();

        const powerStatusMap = new Map([
            [100, EntityTile.POWER_STATUS_ADMIN],
            [50, EntityTile.POWER_STATUS_MODERATOR],
        ]);

        // Find the nearest power level with a badge
        let powerLevel = this.props.member.powerLevel;
        for (const [pl] of powerStatusMap) {
            if (this.props.member.powerLevel >= pl) {
                powerLevel = pl;
                break;
            }
        }

        const powerStatus = powerStatusMap.get(powerLevel);

        let e2eStatus;
        if (this.state.isRoomEncrypted) {
            e2eStatus = this.state.e2eStatus;
        }

        return (
            <EntityTile
                {...this.props}
                presenceState={presenceState}
                presenceLastActiveAgo={member.user ? member.user.lastActiveAgo : 0}
                presenceLastTs={member.user ? member.user.lastPresenceTs : 0}
                presenceCurrentlyActive={member.user ? member.user.currentlyActive : false}
                avatarJsx={av}
                title={this.getPowerLabel()}
                name={name}
                powerStatus={powerStatus}
                showPresence={this.props.showPresence}
                subtextLabel={statusMessage}
                e2eStatus={e2eStatus}
                onClick={this.onClick}
            />
        );
    }
}
