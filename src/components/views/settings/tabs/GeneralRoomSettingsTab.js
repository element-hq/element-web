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
import RoomProfileSettings from "../RoomProfileSettings";
import MatrixClientPeg from "../../../../MatrixClientPeg";
import sdk from "../../../../index";
import AccessibleButton from "../../elements/AccessibleButton";

export default class GeneralRoomSettingsTab extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
    };

    _saveAliases = (e) => {
        // TODO: Live modification of aliases?
        if (!this.refs.aliasSettings) return;
        this.refs.aliasSettings.saveSettings();
    };

    render() {
        const AliasSettings = sdk.getComponent("room_settings.AliasSettings");

        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);

        const canSetAliases = true; // Previously, we arbitrarily only allowed admins to do this
        const canSetCanonical = room.currentState.mayClientSendStateEvent("m.room.canonical_alias", client);
        const canonicalAliasEv = room.currentState.getStateEvents("m.room.canonical_alias", '');
        const aliasEvents = room.currentState.getStateEvents("m.room.aliases");

        return (
            <div className="mx_SettingsTab mx_GeneralRoomSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("General")}</div>
                <div className='mx_SettingsTab_section mx_GeneralRoomSettingsTab_profileSection'>
                    <RoomProfileSettings roomId={this.props.roomId} />
                </div>

                <span className='mx_SettingsTab_subheading'>{_t("Room Addresses")}</span>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <AliasSettings ref="aliasSettings" roomId={this.props.roomId}
                                   canSetCanonicalAlias={canSetCanonical} canSetAliases={canSetAliases}
                                   canonicalAliasEvent={canonicalAliasEv} aliasEvents={aliasEvents} />
                    <AccessibleButton onClick={this._saveAliases} kind='primary'>
                        {_t("Save")}
                    </AccessibleButton>
                </div>
            </div>
        );
    }
}
