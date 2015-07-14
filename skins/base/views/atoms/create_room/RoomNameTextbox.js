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

var RoomNameTextboxController = require("../../../../../src/controllers/atoms/create_room/RoomNameTextbox");

module.exports = React.createClass({
    displayName: 'RoomNameTextbox',
    mixins: [RoomNameTextboxController],

    onValueChanged: function(ev) {
        this.setState({room_name: ev.target.value})
    },

    render: function() {
        return (
            <input type="text" className="mx_RoomNameTextbox" placeholder="ex. MyNewRoom" onChange={this.onValueChanged}/>
        );
    }
});
