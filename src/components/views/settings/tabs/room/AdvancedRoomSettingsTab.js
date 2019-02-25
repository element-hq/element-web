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
import MatrixClientPeg from "../../../../../MatrixClientPeg";
import sdk from "../../../../..";
import AccessibleButton from "../../../elements/AccessibleButton";
import Modal from "../../../../../Modal";

export default class AdvancedRoomSettingsTab extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
    };

    constructor() {
        super();

        this.state = {
            // This is eventually set to the value of room.getRecommendedVersion()
            upgradeRecommendation: null,
        };
    }

    componentWillMount() {
        // we handle lack of this object gracefully later, so don't worry about it failing here.
        MatrixClientPeg.get().getRoom(this.props.roomId).getRecommendedVersion().then((v) => {
            this.setState({upgradeRecommendation: v});
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

    render() {
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);

        let unfederatableSection;
        const createEvent = room.currentState.getStateEvents('m.room.create', '');
        if (createEvent && createEvent.getContent()['m.federate'] === false) {
            unfederatableSection = <div>{_t('This room is not accessible by remote Matrix servers')}</div>;
        }

        let roomUpgradeButton;
        if (this.state.upgradeRecommendation && this.state.upgradeRecommendation.needsUpgrade) {
            roomUpgradeButton = (
                <AccessibleButton onClick={this._upgradeRoom} kind='primary'>
                    {_t("Upgrade room to version %(ver)s", {ver: this.state.upgradeRecommendation.version})}
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
