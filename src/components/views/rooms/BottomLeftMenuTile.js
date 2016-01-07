/*
Copyright 2015, 2016 OpenMarket Ltd

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

var sdk = require('matrix-react-sdk')

module.exports = React.createClass({
    displayName: 'BottomLeftMenuTile',

    getInitialState: function() {
        return( { hover : false });
    },

    onMouseEnter: function() {
        this.setState( { hover : true });
    },

    onMouseLeave: function() {
        this.setState( { hover : false });
    },

    render: function() {
        var label;
        if (!this.props.collapsed) {
            label = <div className="mx_RoomTile_name">{ this.props.label }</div>;
        }
        else if (this.state.hover) {
            var RoomTooltip = sdk.getComponent("rooms.RoomTooltip");
            label = <RoomTooltip bottom={ true } label={ this.props.label }/>;
        }

        return (
            <div className="mx_RoomTile" onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave} onClick={this.props.onClick}>
                <div className="mx_RoomTile_avatar">
                    <img src={ this.props.img } width="26" height="26"/>
                </div>
                { label }
            </div>
        );
    }
});
