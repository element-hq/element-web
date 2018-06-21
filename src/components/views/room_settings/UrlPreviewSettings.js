/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Travis Ralston
Copyright 2018 New Vector Ltd

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

import {MatrixClient} from "matrix-js-sdk";
const React = require('react');
import PropTypes from 'prop-types';
const sdk = require("../../../index");
import { _t, _td } from '../../../languageHandler';
import SettingsStore, {SettingLevel} from "../../../settings/SettingsStore";


module.exports = React.createClass({
    displayName: 'UrlPreviewSettings',

    propTypes: {
        room: PropTypes.object,
    },

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient).isRequired,
    },

    saveSettings: function() {
        const promises = [];
        if (this.refs.urlPreviewsRoom) promises.push(this.refs.urlPreviewsRoom.save());
        if (this.refs.urlPreviewsSelf) promises.push(this.refs.urlPreviewsSelf.save());
        return promises;
    },

    render: function() {
        const SettingsFlag = sdk.getComponent("elements.SettingsFlag");
        const roomId = this.props.room.roomId;
        const isEncrypted = this.context.matrixClient.isRoomEncrypted(roomId);

        let previewsForAccount = null;
        let previewsForRoom = null;


        if (!isEncrypted) {
            // Only show account setting state and room state setting state in non-e2ee rooms where they apply
            const accountEnabled = SettingsStore.getValueAt(SettingLevel.ACCOUNT, "urlPreviewsEnabled");
            if (accountEnabled) {
                previewsForAccount = (
                    _t("You have <a>enabled</a> URL previews by default.", {}, {
                        'a': (sub)=><a href="#/settings">{ sub }</a>,
                    })
                );
            } else if (accountEnabled) {
                previewsForAccount = (
                    _t("You have <a>disabled</a> URL previews by default.", {}, {
                        'a': (sub)=><a href="#/settings">{ sub }</a>,
                    })
                );
            }

            if (SettingsStore.canSetValue("urlPreviewsEnabled", roomId, "room")) {
                previewsForRoom = (
                    <label>
                        <SettingsFlag name="urlPreviewsEnabled"
                                      level={SettingLevel.ROOM}
                                      roomId={this.props.room.roomId}
                                      isExplicit={true}
                                      manualSave={true}
                                      ref="urlPreviewsRoom" />
                    </label>
                );
            } else {
                let str = _td("URL previews are enabled by default for participants in this room.");
                if (!SettingsStore.getValueAt(SettingLevel.ROOM, "urlPreviewsEnabled", roomId, /*explicit=*/true)) {
                    str = _td("URL previews are disabled by default for participants in this room.");
                }
                previewsForRoom = (<label>{ _t(str) }</label>);
            }
        } else {
            previewsForAccount = (
                _t("URL Previews default to off in End-to-End Encrypted rooms to protect your privacy. " +
                    "They are requested through your homeserver which could infer links which are otherwise encrypted")
            );
        }

        const previewsForRoomAccount = (
            <SettingsFlag name="urlPreviewsEnabled"
                          level={SettingLevel.ROOM_ACCOUNT}
                          roomId={this.props.room.roomId}
                          manualSave={true}
                          ref="urlPreviewsSelf"
            />
        );

        return (
            <div className="mx_RoomSettings_toggles">
                <h3>{ _t("URL Previews") }</h3>

                <label>{ previewsForAccount }</label>
                { previewsForRoom }
                <label>{ previewsForRoomAccount }</label>
            </div>
        );
    },
});
