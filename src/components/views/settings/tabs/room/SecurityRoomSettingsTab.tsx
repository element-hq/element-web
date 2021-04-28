/*
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

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
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import {_t} from "../../../../../languageHandler";
import {MatrixClientPeg} from "../../../../../MatrixClientPeg";
import * as sdk from "../../../../..";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import Modal from "../../../../../Modal";
import QuestionDialog from "../../../dialogs/QuestionDialog";
import StyledRadioGroup from '../../../elements/StyledRadioGroup';
import {SettingLevel} from "../../../../../settings/SettingLevel";
import SettingsStore from "../../../../../settings/SettingsStore";
import {UIFeature} from "../../../../../settings/UIFeature";
import { replaceableComponent } from "../../../../../utils/replaceableComponent";

// Knock and private are reserved keywords which are not yet implemented.
enum JoinRule {
    Public = "public",
    Knock = "knock",
    Invite = "invite",
    Private = "private",
}

enum GuestAccess {
    CanJoin = "can_join",
    Forbidden = "forbidden",
}

enum HistoryVisibility {
    Invited = "invited",
    Joined = "joined",
    Shared = "shared",
    WorldReadable = "world_readable",
}

interface IProps {
    roomId: string;
}

interface IState {
    joinRule: JoinRule;
    guestAccess: GuestAccess;
    history: HistoryVisibility;
    hasAliases: boolean;
    encrypted: boolean;
}

@replaceableComponent("views.settings.tabs.room.SecurityRoomSettingsTab")
export default class SecurityRoomSettingsTab extends React.Component<IProps, IState> {
    constructor(props) {
        super(props);

        this.state = {
            joinRule: JoinRule.Invite,
            guestAccess: GuestAccess.CanJoin,
            history: HistoryVisibility.Shared,
            hasAliases: false,
            encrypted: false,
        };
    }

    // TODO: [REACT-WARNING] Move this to constructor
    async UNSAFE_componentWillMount() { // eslint-disable-line camelcase
        MatrixClientPeg.get().on("RoomState.events", this.onStateEvent);

        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        const state = room.currentState;

        const joinRule: JoinRule = this.pullContentPropertyFromEvent(
            state.getStateEvents("m.room.join_rules", ""),
            'join_rule',
            JoinRule.Invite,
        );
        const guestAccess: GuestAccess = this.pullContentPropertyFromEvent(
            state.getStateEvents("m.room.guest_access", ""),
            'guest_access',
            GuestAccess.Forbidden,
        );
        const history: HistoryVisibility = this.pullContentPropertyFromEvent(
            state.getStateEvents("m.room.history_visibility", ""),
            'history_visibility',
            HistoryVisibility.Shared,
        );
        const encrypted = MatrixClientPeg.get().isRoomEncrypted(this.props.roomId);
        this.setState({joinRule, guestAccess, history, encrypted});
        const hasAliases = await this.hasAliases();
        this.setState({hasAliases});
    }

    private pullContentPropertyFromEvent<T>(event: MatrixEvent, key: string, defaultValue: T): T {
        if (!event || !event.getContent()) return defaultValue;
        return event.getContent()[key] || defaultValue;
    }

    componentWillUnmount() {
        MatrixClientPeg.get().removeListener("RoomState.events", this.onStateEvent);
    }

    private onStateEvent = (e: MatrixEvent) => {
        const refreshWhenTypes = [
            'm.room.join_rules',
            'm.room.guest_access',
            'm.room.history_visibility',
            'm.room.encryption',
        ];
        if (refreshWhenTypes.includes(e.getType())) this.forceUpdate();
    };

    private onEncryptionChange = (e: React.ChangeEvent) => {
        Modal.createTrackedDialog('Enable encryption', '', QuestionDialog, {
            title: _t('Enable encryption?'),
            description: _t(
                "Once enabled, encryption for a room cannot be disabled. Messages sent in an encrypted " +
                "room cannot be seen by the server, only by the participants of the room. Enabling encryption " +
                "may prevent many bots and bridges from working correctly. <a>Learn more about encryption.</a>",
                {},
                {
                    a: sub => <a href="https://element.io/help#encryption"
                        rel="noreferrer noopener" target="_blank"
                    >{sub}</a>,
                },
            ),
            onFinished: (confirm) => {
                if (!confirm) {
                    this.setState({encrypted: false});
                    return;
                }

                const beforeEncrypted = this.state.encrypted;
                this.setState({encrypted: true});
                MatrixClientPeg.get().sendStateEvent(
                    this.props.roomId, "m.room.encryption",
                    { algorithm: "m.megolm.v1.aes-sha2" },
                ).catch((e) => {
                    console.error(e);
                    this.setState({encrypted: beforeEncrypted});
                });
            },
        });
    };

    private fixGuestAccess = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const joinRule = JoinRule.Invite;
        const guestAccess = GuestAccess.CanJoin;

        const beforeJoinRule = this.state.joinRule;
        const beforeGuestAccess = this.state.guestAccess;
        this.setState({joinRule, guestAccess});

        const client = MatrixClientPeg.get();
        client.sendStateEvent(this.props.roomId, "m.room.join_rules", {join_rule: joinRule}, "").catch((e) => {
            console.error(e);
            this.setState({joinRule: beforeJoinRule});
        });
        client.sendStateEvent(this.props.roomId, "m.room.guest_access", {guest_access: guestAccess}, "").catch((e) => {
            console.error(e);
            this.setState({guestAccess: beforeGuestAccess});
        });
    };

    private onRoomAccessRadioToggle = (roomAccess: string) => {
        //                         join_rule
        //                      INVITE  |  PUBLIC
        //        ----------------------+----------------
        // guest  CAN_JOIN   | inv_only | pub_with_guest
        // access ----------------------+----------------
        //        FORBIDDEN  | inv_only | pub_no_guest
        //        ----------------------+----------------

        // we always set guests can_join here as it makes no sense to have
        // an invite-only room that guests can't join.  If you explicitly
        // invite them, you clearly want them to join, whether they're a
        // guest or not.  In practice, guest_access should probably have
        // been implemented as part of the join_rules enum.
        let joinRule = JoinRule.Invite;
        let guestAccess = GuestAccess.CanJoin;

        switch (roomAccess) {
            case "invite_only":
                // no change - use defaults above
                break;
            case "public_no_guests":
                joinRule = JoinRule.Public;
                guestAccess = GuestAccess.Forbidden;
                break;
            case "public_with_guests":
                joinRule = JoinRule.Public;
                guestAccess = GuestAccess.CanJoin;
                break;
        }

        const beforeJoinRule = this.state.joinRule;
        const beforeGuestAccess = this.state.guestAccess;
        this.setState({joinRule, guestAccess});

        const client = MatrixClientPeg.get();
        client.sendStateEvent(this.props.roomId, "m.room.join_rules", {join_rule: joinRule}, "").catch((e) => {
            console.error(e);
            this.setState({joinRule: beforeJoinRule});
        });
        client.sendStateEvent(this.props.roomId, "m.room.guest_access", {guest_access: guestAccess}, "").catch((e) => {
            console.error(e);
            this.setState({guestAccess: beforeGuestAccess});
        });
    };

    private onHistoryRadioToggle = (history: HistoryVisibility) => {
        const beforeHistory = this.state.history;
        this.setState({history: history});
        MatrixClientPeg.get().sendStateEvent(this.props.roomId, "m.room.history_visibility", {
            history_visibility: history,
        }, "").catch((e) => {
            console.error(e);
            this.setState({history: beforeHistory});
        });
    };

    private updateBlacklistDevicesFlag = (checked: boolean) => {
        MatrixClientPeg.get().getRoom(this.props.roomId).setBlacklistUnverifiedDevices(checked);
    };

    private async hasAliases(): Promise<boolean> {
        const cli = MatrixClientPeg.get();
        if (await cli.doesServerSupportUnstableFeature("org.matrix.msc2432")) {
            const response = await cli.unstableGetLocalAliases(this.props.roomId);
            const localAliases = response.aliases;
            return Array.isArray(localAliases) && localAliases.length !== 0;
        } else {
            const room = cli.getRoom(this.props.roomId);
            const aliasEvents = room.currentState.getStateEvents("m.room.aliases") || [];
            const hasAliases = !!aliasEvents.find((ev) => (ev.getContent().aliases || []).length > 0);
            return hasAliases;
        }
    }

    private renderRoomAccess() {
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);
        const joinRule = this.state.joinRule;
        const guestAccess = this.state.guestAccess;

        const canChangeAccess = room.currentState.mayClientSendStateEvent("m.room.join_rules", client)
            && room.currentState.mayClientSendStateEvent("m.room.guest_access", client);

        let guestWarning = null;
        if (joinRule !== 'public' && guestAccess === 'forbidden') {
            guestWarning = (
                <div className='mx_SecurityRoomSettingsTab_warning'>
                    <img src={require("../../../../../../res/img/warning.svg")} width={15} height={15} />
                    <span>
                        {_t("Guests cannot join this room even if explicitly invited.")}&nbsp;
                        <a href="" onClick={this.fixGuestAccess}>{_t("Click here to fix")}</a>
                    </span>
                </div>
            );
        }

        let aliasWarning = null;
        if (joinRule === 'public' && !this.state.hasAliases) {
            aliasWarning = (
                <div className='mx_SecurityRoomSettingsTab_warning'>
                    <img src={require("../../../../../../res/img/warning.svg")} width={15} height={15} />
                    <span>
                        {_t("To link to this room, please add an address.")}
                    </span>
                </div>
            );
        }

        return (
            <div>
                {guestWarning}
                {aliasWarning}
                <StyledRadioGroup
                    name="roomVis"
                    value={joinRule}
                    onChange={this.onRoomAccessRadioToggle}
                    definitions={[
                        {
                            value: "invite_only",
                            disabled: !canChangeAccess,
                            label: _t('Only people who have been invited'),
                            checked: joinRule !== "public",
                        },
                        {
                            value: "public_no_guests",
                            disabled: !canChangeAccess,
                            label: _t('Anyone who knows the room\'s link, apart from guests'),
                            checked: joinRule === "public" && guestAccess !== "can_join",
                        },
                        {
                            value: "public_with_guests",
                            disabled: !canChangeAccess,
                            label: _t("Anyone who knows the room's link, including guests"),
                            checked: joinRule === "public" && guestAccess === "can_join",
                        },
                    ]}
                />
            </div>
        );
    }

    private renderHistory() {
        const client = MatrixClientPeg.get();
        const history = this.state.history;
        const state = client.getRoom(this.props.roomId).currentState;
        const canChangeHistory = state.mayClientSendStateEvent('m.room.history_visibility', client);

        return (
            <div>
                <div>
                    {_t('Changes to who can read history will only apply to future messages in this room. ' +
                        'The visibility of existing history will be unchanged.')}
                </div>
                <StyledRadioGroup
                    name="historyVis"
                    value={history}
                    onChange={this.onHistoryRadioToggle}
                    definitions={[
                        {
                            value: HistoryVisibility.WorldReadable,
                            disabled: !canChangeHistory,
                            label: _t("Anyone"),
                        },
                        {
                            value: HistoryVisibility.Shared,
                            disabled: !canChangeHistory,
                            label: _t('Members only (since the point in time of selecting this option)'),
                        },
                        {
                            value: HistoryVisibility.Invited,
                            disabled: !canChangeHistory,
                            label: _t('Members only (since they were invited)'),
                        },
                        {
                            value: HistoryVisibility.Joined,
                            disabled: !canChangeHistory,
                            label: _t('Members only (since they joined)'),
                        },
                    ]}
                />
            </div>
        );
    }

    render() {
        const SettingsFlag = sdk.getComponent("elements.SettingsFlag");

        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);
        const isEncrypted = this.state.encrypted;
        const hasEncryptionPermission = room.currentState.mayClientSendStateEvent("m.room.encryption", client);
        const canEnableEncryption = !isEncrypted && hasEncryptionPermission;

        let encryptionSettings = null;
        if (isEncrypted && SettingsStore.isEnabled("blacklistUnverifiedDevices")) {
            encryptionSettings = <SettingsFlag
                name="blacklistUnverifiedDevices"
                level={SettingLevel.ROOM_DEVICE}
                onChange={this.updateBlacklistDevicesFlag}
                roomId={this.props.roomId}
            />;
        }

        let historySection = (<>
            <span className='mx_SettingsTab_subheading'>{_t("Who can read history?")}</span>
            <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                {this.renderHistory()}
            </div>
        </>);
        if (!SettingsStore.getValue(UIFeature.RoomHistorySettings)) {
            historySection = null;
        }

        return (
            <div className="mx_SettingsTab mx_SecurityRoomSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Security & Privacy")}</div>

                <span className='mx_SettingsTab_subheading'>{_t("Encryption")}</span>
                <div className='mx_SettingsTab_section mx_SecurityRoomSettingsTab_encryptionSection'>
                    <div>
                        <div className='mx_SettingsTab_subsectionText'>
                            <span>{_t("Once enabled, encryption cannot be disabled.")}</span>
                        </div>
                        <LabelledToggleSwitch value={isEncrypted} onChange={this.onEncryptionChange}
                            label={_t("Encrypted")} disabled={!canEnableEncryption}
                        />
                    </div>
                    {encryptionSettings}
                </div>

                <span className='mx_SettingsTab_subheading'>{_t("Who can access this room?")}</span>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    {this.renderRoomAccess()}
                </div>

                {historySection}
            </div>
        );
    }
}
