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

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');

var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');

module.exports = React.createClass({
    displayName: 'RoomTooltip',

    componentDidMount: function() {
        // tell the roomlist about us
        dis.dispatch({
            action: 'view_tooltip',
            tooltip: this.getDOMNode(),
        });
    },

    componentDidUnmount: function() {
        dis.dispatch({
            action: 'view_tooltip',
            tooltip: null,
        });
    },

    render: function() {
        return (
            <div className="mx_RoomTooltip">
                 <img className="mx_RoomTooltip_chevron" src="img/chevron-left.png" width="9" height="16"/>
                 { this.props.room.name }
            </div>
        );
    }
});
