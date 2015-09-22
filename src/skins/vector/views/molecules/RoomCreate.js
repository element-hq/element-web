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
var classNames = require('classnames');

//var RoomCreateController = require('matrix-react-sdk/lib/controllers/molecules/RoomCreateController')

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');

module.exports = React.createClass({
    displayName: 'RoomCreate',
    // mixins: [RoomCreateController],
    render: function() {
        return (
            <div className="mx_RoomCreate">
                <div className="mx_RoomCreate_table">
                    <div className="mx_RoomTile">
                        <div className="mx_RoomTile_avatar">
                            <img src="img/create.png" width="32" height="32"/>
                        </div>
                        <div className="mx_RoomTile_name">Create new room</div>
                    </div>
                </div>
            </div>
        );
    }
});
