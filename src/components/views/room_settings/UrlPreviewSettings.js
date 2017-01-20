/*
Copyright 2016 OpenMarket Ltd

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

var q = require("q");
var React = require('react');
var MatrixClientPeg = require('../../../MatrixClientPeg');
var sdk = require("../../../index");
var Modal = require("../../../Modal");
var UserSettingsStore = require('../../../UserSettingsStore');


module.exports = React.createClass({
    displayName: 'UrlPreviewSettings',

    propTypes: {
        room: React.PropTypes.object,
    },

    getInitialState: function() {
        var cli = MatrixClientPeg.get();
        var roomState = this.props.room.currentState;

        var roomPreviewUrls = this.props.room.currentState.getStateEvents('org.matrix.room.preview_urls', '');
        var userPreviewUrls = this.props.room.getAccountData("org.matrix.room.preview_urls");

        return {
            globalDisableUrlPreview: (roomPreviewUrls && roomPreviewUrls.getContent().disable) || false,
            userDisableUrlPreview: (userPreviewUrls && (userPreviewUrls.getContent().disable === true)) || false,
            userEnableUrlPreview: (userPreviewUrls && (userPreviewUrls.getContent().disable === false)) || false,
        };
    },

    componentDidMount: function() {
        this.originalState = Object.assign({}, this.state);
    },

    saveSettings: function() {
        var promises = [];

        if (this.state.globalDisableUrlPreview !== this.originalState.globalDisableUrlPreview) {
            console.log("UrlPreviewSettings: Updating room's preview_urls state event");
            promises.push(
                MatrixClientPeg.get().sendStateEvent(
                    this.props.room.roomId, "org.matrix.room.preview_urls", {
                        disable: this.state.globalDisableUrlPreview
                    }, ""
                )
            );
        }

        var content = undefined;
        if (this.state.userDisableUrlPreview !== this.originalState.userDisableUrlPreview) {
            console.log("UrlPreviewSettings: Disabling user's per-room preview_urls");
            content = this.state.userDisableUrlPreview ? { disable : true } : {};
        }

        if (this.state.userEnableUrlPreview !== this.originalState.userEnableUrlPreview) {
            console.log("UrlPreviewSettings: Enabling user's per-room preview_urls");
            if (!content || content.disable === undefined) {
                content = this.state.userEnableUrlPreview ? { disable : false } : {};
            }
        }

        if (content) {
            promises.push(
                MatrixClientPeg.get().setRoomAccountData(
                    this.props.room.roomId, "org.matrix.room.preview_urls", content
                )
            );
        }

        console.log("UrlPreviewSettings: saveSettings: " + JSON.stringify(promises));

        return promises;
    },

    onGlobalDisableUrlPreviewChange: function() {
        this.setState({
            globalDisableUrlPreview: this.refs.globalDisableUrlPreview.checked ? true : false,
        });
    },

    onUserEnableUrlPreviewChange: function() {
        this.setState({
            userDisableUrlPreview: false,
            userEnableUrlPreview: this.refs.userEnableUrlPreview.checked ? true : false,
        });
    },

    onUserDisableUrlPreviewChange: function() {
        this.setState({
            userDisableUrlPreview: this.refs.userDisableUrlPreview.checked ? true : false,
            userEnableUrlPreview: false,
        });
    },

    render: function() {
        var self = this;
        var roomState = this.props.room.currentState;
        var cli = MatrixClientPeg.get();

        var maySetRoomPreviewUrls = roomState.mayClientSendStateEvent('org.matrix.room.preview_urls', cli);
        var disableRoomPreviewUrls;
        if (maySetRoomPreviewUrls) {
            disableRoomPreviewUrls =
                <label>
                    <input type="checkbox" ref="globalDisableUrlPreview"
                           onChange={ this.onGlobalDisableUrlPreviewChange }
                           checked={ this.state.globalDisableUrlPreview } />
                    Disable URL previews by default for participants in this room
                </label>;
        }
        else {
            disableRoomPreviewUrls =
                <label>
                    URL previews are { this.state.globalDisableUrlPreview ? "disabled" : "enabled" } by default for participants in this room.
                </label>;
        }

        return (
            <div className="mx_RoomSettings_toggles">
                <h3>URL Previews</h3>

                <label>
                    You have <a href="#/settings">{ UserSettingsStore.getUrlPreviewsDisabled() ? 'disabled' : 'enabled' }</a> URL previews by default.
                </label>
                { disableRoomPreviewUrls }
                <label>
                    <input type="checkbox" ref="userEnableUrlPreview"
                           onChange={ this.onUserEnableUrlPreviewChange }
                           checked={ this.state.userEnableUrlPreview } />
                    Enable URL previews for this room (affects only you)
                </label>
                <label>
                    <input type="checkbox" ref="userDisableUrlPreview"
                           onChange={ this.onUserDisableUrlPreviewChange }
                           checked={ this.state.userDisableUrlPreview } />
                    Disable URL previews for this room (affects only you)
                </label>
            </div>
        );

    }
});
