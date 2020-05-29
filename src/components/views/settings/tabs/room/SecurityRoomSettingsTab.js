/*
Copyright 2019 New Vector Ltd

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
import {_t} from "../../../../../languageHandler";
import {MatrixClientPeg} from "../../../../../MatrixClientPeg";
import * as sdk from "../../../../..";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import {SettingLevel} from "../../../../../settings/SettingsStore";
import Modal from "../../../../../Modal";
import QuestionDialog from "../../../dialogs/QuestionDialog";

export default class SecurityRoomSettingsTab extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
    };

    constructor() {
        super();

        this.state = {
            joinRule: "invite",
            guestAccess: "can_join",
            history: "shared",
            hasAliases: false,
            encrypted: false,
        };
    }

    // TODO: [REACT-WARNING] Move this to constructor
    async UNSAFE_componentWillMount(): void { // eslint-disable-line camelcase
        MatrixClientPeg.get().on("RoomState.events", this._onStateEvent);

        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        const state = room.currentState;

        const joinRule = this._pullContentPropertyFromEvent(
            state.getStateEvents("m.room.join_rules", ""),
            'join_rule',
            'invite',
        );
        const guestAccess = this._pullContentPropertyFromEvent(
            state.getStateEvents("m.room.guest_access", ""),
            'guest_access',
            'forbidden',
        );
        const history = this._pullContentPropertyFromEvent(
            state.getStateEvents("m.room.history_visibility", ""),
            'history_visibility',
            'shared',
        );
        const encrypted = MatrixClientPeg.get().isRoomEncrypted(this.props.roomId);
        this.setState({joinRule, guestAccess, history, encrypted});
        const hasAliases = await this._hasAliases();
        this.setState({hasAliases});
    }

    _pullContentPropertyFromEvent(event, key, defaultValue) {
        if (!event || !event.getContent()) return defaultValue;
        return event.getContent()[key] || defaultValue;
    }

    componentWillUnmount(): void {
        MatrixClientPeg.get().removeListener("RoomState.events", this._onStateEvent);
    }

    _onStateEvent = (e) => {
        const refreshWhenTypes = [
            'm.room.join_rules',
            'm.room.guest_access',
            'm.room.history_visibility',
            'm.room.encryption',
        ];
        if (refreshWhenTypes.includes(e.getType())) this.forceUpdate();
    };

    _onEncryptionChange = (e) => {
        Modal.createTrackedDialog('Enable encryption', '', QuestionDialog, {
            title: _t('Enable encryption?'),
            description: _t(
                "Once enabled, encryption for a room cannot be disabled. Messages sent in an encrypted " +
                "room cannot be seen by the server, only by the participants of the room. Enabling encryption " +
                "may prevent many bots and bridges from working correctly. <a>Learn more about encryption.</a>",
                {},
                {
                    'a': (sub) => {
                        return <a rel='noreferrer noopener' target='_blank'
                                  href='https://about.riot.im/help#end-to-end-encryption'>{sub}</a>;
                    },
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

    _fixGuestAccess = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const joinRule = "invite";
        const guestAccess = "can_join";

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

    _onRoomAccessRadioToggle = (ev) => {
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
        let joinRule = "invite";
        let guestAccess = "can_join";

        switch (ev.target.value) {
            case "invite_only":
                // no change - use defaults above
                break;
            case "public_no_guests":
                joinRule = "public";
                guestAccess = "forbidden";
                break;
            case "public_with_guests":
                joinRule = "public";
                guestAccess = "can_join";
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

    _onHistoryRadioToggle = (ev) => {
        const beforeHistory = this.state.history;
        this.setState({history: ev.target.value});
        MatrixClientPeg.get().sendStateEvent(this.props.roomId, "m.room.history_visibility", {
            history_visibility: ev.target.value,
        }, "").catch((e) => {
            console.error(e);
            this.setState({history: beforeHistory});
        });
    };

    _updateBlacklistDevicesFlag = (checked) => {
        MatrixClientPeg.get().getRoom(this.props.roomId).setBlacklistUnverifiedDevices(checked);
    };

    async _hasAliases() {
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

    _renderRoomAccess() {
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
                        <a href="" onClick={this._fixGuestAccess}>{_t("Click here to fix")}</a>
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
                <label>
                    <input type="radio" name="roomVis" value="invite_only"
                           disabled={!canChangeAccess}
                           onChange={this._onRoomAccessRadioToggle}
                           checked={joinRule !== "public"} />
                    {_t('Only people who have been invited')}
                </label>
                <label>
                    <input type="radio" name="roomVis" value="public_no_guests"
                           disabled={!canChangeAccess}
                           onChange={this._onRoomAccessRadioToggle}
                           checked={joinRule === "public" && guestAccess !== "can_join"} />
                    {_t('Anyone who knows the room\'s link, apart from guests')}
                </label>
                <label>
                    <input type="radio" name="roomVis" value="public_with_guests"
                           disabled={!canChangeAccess}
                           onChange={this._onRoomAccessRadioToggle}
                           checked={joinRule === "public" && guestAccess === "can_join"} />
                    {_t("Anyone who knows the room's link, including guests")}
                </label>
            </div>
        );
    }

    _renderHistory() {
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
                <label>
                    <input type="radio" name="historyVis" value="world_readable"
                           disabled={!canChangeHistory}
                           checked={history === "world_readable"}
                           onChange={this._onHistoryRadioToggle} />
                    {_t("Anyone")}
                </label>
                <label>
                    <input type="radio" name="historyVis" value="shared"
                           disabled={!canChangeHistory}
                           checked={history === "shared"}
                           onChange={this._onHistoryRadioToggle} />
                    {_t('Members only (since the point in time of selecting this option)')}
                </label>
                <label>
                    <input type="radio" name="historyVis" value="invited"
                           disabled={!canChangeHistory}
                           checked={history === "invited"}
                           onChange={this._onHistoryRadioToggle} />
                    {_t('Members only (since they were invited)')}
                </label>
                <label >
                    <input type="radio" name="historyVis" value="joined"
                           disabled={!canChangeHistory}
                           checked={history === "joined"}
                           onChange={this._onHistoryRadioToggle} />
                    {_t('Members only (since they joined)')}
                </label>
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
        if (isEncrypted) {
            encryptionSettings = <SettingsFlag name="blacklistUnverifiedDevices" level={SettingLevel.ROOM_DEVICE}
                                               onChange={this._updateBlacklistDevicesFlag}
                                               roomId={this.props.roomId} />;
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
                        <LabelledToggleSwitch value={isEncrypted} onChange={this._onEncryptionChange}
                                              label={_t("Encrypted")} disabled={!canEnableEncryption} />
                    </div>
                    {encryptionSettings}
                </div>

                <span className='mx_SettingsTab_subheading'>{_t("Who can access this room?")}</span>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    {this._renderRoomAccess()}
                </div>

                <span className='mx_SettingsTab_subheading'>{_t("Who can read history?")}</span>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    {this._renderHistory()}
                </div>
            </div>
        );
    }
}
