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
import {_t} from "../../../../languageHandler";
import MatrixClientPeg from "../../../../MatrixClientPeg";
import sdk from "../../../../index";
import LabelledToggleSwitch from "../../elements/LabelledToggleSwitch";
import {SettingLevel} from "../../../../settings/SettingsStore";
import Modal from "../../../../Modal";

export default class SecurityRoomSettingsTab extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
    };

    componentWillMount(): void {
        MatrixClientPeg.get().on("RoomState.events", this._onStateEvent);
    }

    componentWillUnmount(): void {
        MatrixClientPeg.get().removeListener("RoomState.events", this._onStateEvent);
    }

    _onStateEvent = (e) => {
        const refreshWhenTypes = ['m.room.join_rules', 'm.room.guest_access', 'm.room.history_visibility'];
        if (refreshWhenTypes.includes(e.getType())) this.forceUpdate();
    };

    _onEncryptionChange = (e) => {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createTrackedDialog('E2E Enable Warning', '', QuestionDialog, {
            title: _t('Warning!'),
            description: (
                <div>
                    <p>{ _t('End-to-end encryption is in beta and may not be reliable') }.</p>
                    <p>{ _t('You should not yet trust it to secure data') }.</p>
                    <p>{ _t('Devices will not yet be able to decrypt history from before they joined the room') }.</p>
                    <p>{ _t('Once encryption is enabled for a room it cannot be turned off again (for now)') }.</p>
                    <p>{ _t('Encrypted messages will not be visible on clients that do not yet implement encryption') }.</p>
                </div>
            ),
            onFinished: (confirm)=>{
                if (confirm) {
                    return MatrixClientPeg.get().sendStateEvent(
                        this.props.roomId, "m.room.encryption",
                        { algorithm: "m.megolm.v1.aes-sha2" },
                    );
                }
            },
        });
    };

    _fixGuestAccess = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const client = MatrixClientPeg.get();
        client.sendStateEvent(this.props.roomId, "m.room.join_rules", {join_rule: "invite"}, "");
        client.sendStateEvent(this.props.roomId, "m.room.guest_access", {guest_access: "can_join"}, "");
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

        const client = MatrixClientPeg.get();
        client.sendStateEvent(this.props.roomId, "m.room.join_rules", {join_rule: joinRule}, "");
        client.sendStateEvent(this.props.roomId, "m.room.guest_access", {guest_access: guestAccess}, "");
    };

    _onHistoryRadioToggle = (ev) => {
        MatrixClientPeg.get().sendStateEvent(this.props.roomId, "m.room.history_visibility", {
            history_visibility: ev.target.value,
        }, "");
    };

    _renderRoomAccess() {
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);
        const joinRule = room.currentState.getStateEvents("m.room.join_rules", "").getContent()['join_rule'];
        const guestAccess = room.currentState.getStateEvents("m.room.guest_access", "").getContent()['guest_access'];
        const aliasEvents = room.currentState.getStateEvents("m.room.aliases") || [];
        const hasAliases = aliasEvents.includes((ev) => (ev.getContent().aliases || []).length);

        const canChangeAccess = room.currentState.mayClientSendStateEvent("m.room.join_rules", client)
            && room.currentState.mayClientSendStateEvent("m.room.guest_access", client);

        let guestWarning = null;
        if (joinRule !== 'public' && guestAccess === 'forbidden') {
            guestWarning = (
                <div className='mx_SecurityRoomSettingsTab_warning'>
                    <img src={require("../../../../../res/img/warning.svg")} width={15} height={15} />
                    <span>
                        {_t("Guests cannot join this room even if explicitly invited.")}&nbsp;
                        <a href="" onClick={this._fixGuestAccess}>{_t("Click here to fix")}</a>
                    </span>
                </div>
            );
        }

        let aliasWarning = null;
        if (joinRule === 'public' && !hasAliases) {
            aliasWarning = (
                <div className='mx_SecurityRoomSettingsTab_warning'>
                    <img src={require("../../../../../res/img/warning.svg")} width={15} height={15} />
                    <span>
                        {_t("To link to this room, please add an alias.")}
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
        const room = client.getRoom(this.props.roomId);
        const state = room.currentState;
        const history = state.getStateEvents("m.room.history_visibility", "").getContent()['history_visibility'];
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
        const isEncrypted = client.isRoomEncrypted(this.props.roomId);
        const hasEncryptionPermission = room.currentState.mayClientSendStateEvent("m.room.encryption", client);
        const canEnableEncryption = !isEncrypted && hasEncryptionPermission;

        let encryptionSettings = null;
        if (isEncrypted) {
            encryptionSettings = <SettingsFlag name="blacklistUnverifiedDevices" level={SettingLevel.ROOM_DEVICE}
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
