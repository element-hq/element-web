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
var ReactDOM = require('react-dom');

var dis = require('matrix-react-sdk/lib/dispatcher');

module.exports = React.createClass({
    displayName: 'RoomTooltip',

    componentDidMount: function() {
        var tooltip = ReactDOM.findDOMNode(this);
        if (!this.props.bottom) {
            // tell the roomlist about us so it can position us
            dis.dispatch({
                action: 'view_tooltip',
                tooltip: tooltip,
            });
        }
        else {
            tooltip.style.top = (70 + tooltip.parentElement.getBoundingClientRect().top) + "px";
            tooltip.style.display = "block";
        }
    },

    componentWillUnmount: function() {
        if (!this.props.bottom) {
            dis.dispatch({
                action: 'view_tooltip',
                tooltip: null,
            });
        }
    },

    render: function() {
        var label = this.props.room ? this.props.room.name : this.props.label;
        return (
            <div className="mx_RoomTooltip">
                 <img className="mx_RoomTooltip_chevron" src="img/chevron-left.png" width="9" height="16"/>
                 { label }
            </div>
        );
    }
});
