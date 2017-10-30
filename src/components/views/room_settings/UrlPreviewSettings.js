/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Travis Ralston

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

const React = require('react');
const sdk = require("../../../index");
import { _t, _tJsx } from '../../../languageHandler';
import SettingsStore from "../../../settings/SettingsStore";


module.exports = React.createClass({
    displayName: 'UrlPreviewSettings',

    propTypes: {
        room: React.PropTypes.object,
    },

    saveSettings: function() {
        // TODO: {Travis} move toggle logic here instead of being 'live'
        return [];
    },

    render: function() {
        const SettingsCheckbox = sdk.getComponent("elements.SettingsCheckbox");
        const roomId = this.props.room.roomId;

        let previewsForAccount = null;
        if (SettingsStore.getValueAt("account", "urlPreviewsEnabled")) {
            previewsForAccount = (
                _tJsx("You have <a>enabled</a> URL previews by default.", /<a>(.*?)<\/a>/, (sub)=><a href="#/settings">{ sub }</a>)
            );
        } else {
            previewsForAccount = (
                _tJsx("You have <a>disabled</a> URL previews by default.", /<a>(.*?)<\/a>/, (sub)=><a href="#/settings">{ sub }</a>)
            );
        }

        // TODO: {Travis} This needs to be an explicit true/false for "room" only.
        let previewsForRoom = null;
        if (SettingsStore.canSetValue("urlPreviewsEnabled", roomId, "room")) {
            previewsForRoom = (
                <label>
                    <SettingsCheckbox name="urlPreviewsEnabled"
                                      level="room"
                                      roomId={this.props.room.roomId} />
                </label>
            );
        } else {
            let str = "URL previews are enabled by default for participants in this room.";
            if (!SettingsStore.getValueAt("room", "urlPreviewsEnabled")) {
                str = "URL previews are disabled by default for participants in this room.";
            }
            previewsForRoom = (<label>{ _t(str) }</label>);
        }

        let previewsForRoomAccount = (
            <SettingsCheckbox name="urlPreviewsEnabled"
                              level="room-account"
                              roomId={this.props.room.roomId}
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
