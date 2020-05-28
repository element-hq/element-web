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
import AccessibleButton from "../../../elements/AccessibleButton";
import Modal from "../../../../../Modal";
import dis from "../../../../../dispatcher/dispatcher";

export default class AdvancedRoomSettingsTab extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
        closeSettingsFn: PropTypes.func.isRequired,
    };

    constructor() {
        super();

        this.state = {
            // This is eventually set to the value of room.getRecommendedVersion()
            upgradeRecommendation: null,
        };
    }

    // TODO: [REACT-WARNING] Move this to constructor
    UNSAFE_componentWillMount() { // eslint-disable-line camelcase
        // we handle lack of this object gracefully later, so don't worry about it failing here.
        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        room.getRecommendedVersion().then((v) => {
            const tombstone = room.currentState.getStateEvents("m.room.tombstone", "");

            const additionalStateChanges = {};
            const createEvent = room.currentState.getStateEvents("m.room.create", "");
            const predecessor = createEvent ? createEvent.getContent().predecessor : null;
            if (predecessor && predecessor.room_id) {
                additionalStateChanges['oldRoomId'] = predecessor.room_id;
                additionalStateChanges['oldEventId'] = predecessor.event_id;
                additionalStateChanges['hasPreviousRoom'] = true;
            }


            this.setState({
                upgraded: tombstone && tombstone.getContent().replacement_room,
                upgradeRecommendation: v,
                ...additionalStateChanges,
            });
        });
    }

    _upgradeRoom = (e) => {
        const RoomUpgradeDialog = sdk.getComponent('dialogs.RoomUpgradeDialog');
        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        Modal.createTrackedDialog('Upgrade Room Version', '', RoomUpgradeDialog, {room: room});
    };

    _openDevtools = (e) => {
        const DevtoolsDialog = sdk.getComponent('dialogs.DevtoolsDialog');
        Modal.createDialog(DevtoolsDialog, {roomId: this.props.roomId});
    };

    _onOldRoomClicked = (e) => {
        e.preventDefault();
        e.stopPropagation();

        dis.dispatch({
            action: 'view_room',
            room_id: this.state.oldRoomId,
            event_id: this.state.oldEventId,
        });
        this.props.closeSettingsFn();
    };

    render() {
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);

        let unfederatableSection;
        const createEvent = room.currentState.getStateEvents('m.room.create', '');
        if (createEvent && createEvent.getContent()['m.federate'] === false) {
            unfederatableSection = <div>{_t('This room is not accessible by remote Matrix servers')}</div>;
        }

        let roomUpgradeButton;
        if (this.state.upgradeRecommendation && this.state.upgradeRecommendation.needsUpgrade && !this.state.upgraded) {
            roomUpgradeButton = (
                <div>
                    <p className='mx_SettingsTab_warningText'>
                        {_t(
                            "<b>Warning</b>: Upgrading a room will <i>not automatically migrate room members " +
                            "to the new version of the room.</i> We'll post a link to the new room in the old " +
                            "version of the room - room members will have to click this link to join the new room.",
                            {}, {
                                "b": (sub) => <b>{sub}</b>,
                                "i": (sub) => <i>{sub}</i>,
                            },
                        )}
                    </p>
                    <AccessibleButton onClick={this._upgradeRoom} kind='primary'>
                        {_t("Upgrade this room to the recommended room version")}
                    </AccessibleButton>
                </div>
            );
        }

        let oldRoomLink;
        if (this.state.hasPreviousRoom) {
            let name = _t("this room");
            const room = MatrixClientPeg.get().getRoom(this.props.roomId);
            if (room && room.name) name = room.name;
            oldRoomLink = (
                <AccessibleButton element='a' onClick={this._onOldRoomClicked}>
                    {_t("View older messages in %(roomName)s.", {roomName: name})}
                </AccessibleButton>
            );
        }

        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Advanced")}</div>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <span className='mx_SettingsTab_subheading'>{_t("Room information")}</span>
                    <div>
                        <span>{_t("Internal room ID:")}</span>&nbsp;
                        {this.props.roomId}
                    </div>
                    {unfederatableSection}
                </div>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <span className='mx_SettingsTab_subheading'>{_t("Room version")}</span>
                    <div>
                        <span>{_t("Room version:")}</span>&nbsp;
                        {room.getVersion()}
                    </div>
                    {oldRoomLink}
                    {roomUpgradeButton}
                </div>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <span className='mx_SettingsTab_subheading'>{_t("Developer options")}</span>
                    <AccessibleButton onClick={this._openDevtools} kind='primary'>
                        {_t("Open Devtools")}
                    </AccessibleButton>
                </div>
            </div>
        );
    }
}
