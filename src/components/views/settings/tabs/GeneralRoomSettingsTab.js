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
import RoomProfileSettings from "../../room_settings/RoomProfileSettings";
import MatrixClientPeg from "../../../../MatrixClientPeg";
import sdk from "../../../../index";
import AccessibleButton from "../../elements/AccessibleButton";
import {MatrixClient} from "matrix-js-sdk";
import dis from "../../../../dispatcher";

export default class GeneralRoomSettingsTab extends React.Component {
    static childContextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    };

    static propTypes = {
        roomId: PropTypes.string.isRequired,
    };

    getChildContext() {
        return {
            matrixClient: MatrixClientPeg.get(),
        };
    }

    _saveAliases = (e) => {
        // TODO: Live modification?
        if (!this.refs.aliasSettings) return;
        this.refs.aliasSettings.saveSettings();
    };

    _saveGroups = (e) => {
        // TODO: Live modification?
        if (!this.refs.flairSettings) return;
        this.refs.flairSettings.saveSettings();
    };

    _onLeaveClick = () => {
        dis.dispatch({
            action: 'leave_room',
            room_id: this.props.roomId,
        });
    };

    render() {
        const AliasSettings = sdk.getComponent("room_settings.AliasSettings");
        const RelatedGroupSettings = sdk.getComponent("room_settings.RelatedGroupSettings");
        const UrlPreviewSettings = sdk.getComponent("room_settings.UrlPreviewSettings");

        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);

        const canSetAliases = true; // Previously, we arbitrarily only allowed admins to do this
        const canSetCanonical = room.currentState.mayClientSendStateEvent("m.room.canonical_alias", client);
        const canonicalAliasEv = room.currentState.getStateEvents("m.room.canonical_alias", '');
        const aliasEvents = room.currentState.getStateEvents("m.room.aliases");

        const canChangeGroups = room.currentState.mayClientSendStateEvent("m.room.related_groups", client);
        const groupsEvent = room.currentState.getStateEvents("m.room.related_groups", "");

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

                <span className='mx_SettingsTab_subheading'>{_t("Flair")}</span>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <RelatedGroupSettings ref="flairSettings" roomId={room.roomId}
                                          canSetRelatedGroups={canChangeGroups}
                                          relatedGroupsEvent={groupsEvent} />
                    <AccessibleButton onClick={this._saveGroups} kind='primary'>
                        {_t("Save")}
                    </AccessibleButton>
                </div>

                <span className='mx_SettingsTab_subheading'>{_t("URL Previews")}</span>
                <div className='mx_SettingsTab_section'>
                    <UrlPreviewSettings room={room} />
                </div>

                <span className='mx_SettingsTab_subheading'>{_t("Leave room")}</span>
                <div className='mx_SettingsTab_section'>
                    <AccessibleButton kind='danger' onClick={this._onLeaveClick}>
                        { _t('Leave room') }
                    </AccessibleButton>
                </div>
            </div>
        );
    }
}
