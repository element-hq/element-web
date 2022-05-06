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

import React from 'react';
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { DeviceInfo } from "matrix-js-sdk/src/crypto/deviceinfo";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { UserTrustLevel } from 'matrix-js-sdk/src/crypto/CrossSigning';

import dis from "../../../dispatcher/dispatcher";
import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { Action } from "../../../dispatcher/actions";
import EntityTile, { PowerStatus } from "./EntityTile";
import MemberAvatar from "./../avatars/MemberAvatar";
import DisambiguatedProfile from "../messages/DisambiguatedProfile";
import UserIdentifierCustomisations from '../../../customisations/UserIdentifier';

interface IProps {
    member: RoomMember;
    showPresence?: boolean;
}

interface IState {
    isRoomEncrypted: boolean;
    e2eStatus: string;
}

export default class MemberTile extends React.Component<IProps, IState> {
    private userLastModifiedTime: number;
    private memberLastModifiedTime: number;

    static defaultProps = {
        showPresence: true,
    };

    constructor(props) {
        super(props);

        this.state = {
            isRoomEncrypted: false,
            e2eStatus: null,
        };
    }

    componentDidMount() {
        const cli = MatrixClientPeg.get();

        const { roomId } = this.props.member;
        if (roomId) {
            const isRoomEncrypted = cli.isRoomEncrypted(roomId);
            this.setState({
                isRoomEncrypted,
            });
            if (isRoomEncrypted) {
                cli.on(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
                cli.on(CryptoEvent.DeviceVerificationChanged, this.onDeviceVerificationChanged);
                this.updateE2EStatus();
            } else {
                // Listen for room to become encrypted
                cli.on(RoomStateEvent.Events, this.onRoomStateEvents);
            }
        }
    }

    componentWillUnmount() {
        const cli = MatrixClientPeg.get();

        if (cli) {
            cli.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
            cli.removeListener(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
            cli.removeListener(CryptoEvent.DeviceVerificationChanged, this.onDeviceVerificationChanged);
        }
    }

    private onRoomStateEvents = (ev: MatrixEvent): void => {
        if (ev.getType() !== EventType.RoomEncryption) return;
        const { roomId } = this.props.member;
        if (ev.getRoomId() !== roomId) return;

        // The room is encrypted now.
        const cli = MatrixClientPeg.get();
        cli.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
        this.setState({
            isRoomEncrypted: true,
        });
        this.updateE2EStatus();
    };

    private onUserTrustStatusChanged = (userId: string, trustStatus: UserTrustLevel): void => {
        if (userId !== this.props.member.userId) return;
        this.updateE2EStatus();
    };

    private onDeviceVerificationChanged = (userId: string, deviceId: string, deviceInfo: DeviceInfo): void => {
        if (userId !== this.props.member.userId) return;
        this.updateE2EStatus();
    };

    private async updateE2EStatus(): Promise<void> {
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

    shouldComponentUpdate(nextProps: IProps, nextState: IState): boolean {
        if (
            this.memberLastModifiedTime === undefined ||
            this.memberLastModifiedTime < nextProps.member.getLastModifiedTime()
        ) {
            return true;
        }
        if (
            nextProps.member.user &&
            (this.userLastModifiedTime === undefined ||
            this.userLastModifiedTime < nextProps.member.user.getLastModifiedTime())
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

    private onClick = (): void => {
        dis.dispatch({
            action: Action.ViewUser,
            member: this.props.member,
            push: true,
        });
    };

    private getDisplayName(): string {
        return this.props.member.name;
    }

    private getPowerLabel(): string {
        return _t("%(userName)s (power %(powerLevelNumber)s)", {
            userName: UserIdentifierCustomisations.getDisplayUserIdentifier(
                this.props.member.userId, { roomId: this.props.member.roomId },
            ),
            powerLevelNumber: this.props.member.powerLevel,
        }).trim();
    }

    render() {
        const member = this.props.member;
        const name = this.getDisplayName();
        const presenceState = member.user ? member.user.presence : null;

        const av = (
            <MemberAvatar member={member} width={36} height={36} aria-hidden="true" />
        );

        if (member.user) {
            this.userLastModifiedTime = member.user.getLastModifiedTime();
        }
        this.memberLastModifiedTime = member.getLastModifiedTime();

        const powerStatusMap = new Map([
            [100, PowerStatus.Admin],
            [50, PowerStatus.Moderator],
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

        const nameJSX = (
            <DisambiguatedProfile
                member={member}
                fallbackName={name || ""}
            />
        );

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
                nameJSX={nameJSX}
                powerStatus={powerStatus}
                showPresence={this.props.showPresence}
                e2eStatus={e2eStatus}
                onClick={this.onClick}
            />
        );
    }
}
