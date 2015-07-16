/*
Copyright 2015 OpenMarket Ltd

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

'use strict';

var React = require('react');

var PresetsController = require("../../../../../src/controllers/atoms/create_room/Presets");

module.exports = React.createClass({
    displayName: 'CreateRoomPresets',
    mixins: [PresetsController],

    onValueChanged: function(ev) {
        this.setState({preset: ev.target.value}, this.props.onChange);
    },

    render: function() {
        return (
            <select className="mx_Presets" onChange={this.onValueChanged} value={this.state.preset}>
                <option value={this.Presets.PrivateChat}>Private Chat</option>
                <option value={this.Presets.PublicChat}>Public Chat</option>
                <option value={this.Presets.Custom}>Custom</option>
            </select>
        );
    }
});
