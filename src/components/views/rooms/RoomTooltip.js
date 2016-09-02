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

    propTypes: {
        component: React.PropTypes.object.isRequired,
        room: React.PropTypes.object,
        label: React.PropTypes.string,
    },

    // Create a wrapper for the tooltip outside the main matrix element
    componentDidMount: function() {
        this.tooltipContainer = document.createElement("div");
        this.tooltipContainer.className = "mx_RoomTileTooltip_wrapper";
        document.body.appendChild(this.tooltipContainer);

        this._renderTooltip();

        // tell the roomlist about us so it can position us
        dis.dispatch({
            action: 'view_tooltip',
            tooltip: this.tooltip,
            parent: this.props.component ? ReactDOM.findDOMNode(this.props.component) : null,
        });
    },

    // Remove the wrapper element, as the tooltip has finished using it
    componentWillUnmount: function() {
        dis.dispatch({
            action: 'view_tooltip',
            tooltip: null,
            parent: null,
        });

        ReactDOM.unmountComponentAtNode(this.tooltipContainer);
        document.body.removeChild(this.tooltipContainer);
    },

    _renderTooltip: function() {
        var label = this.props.room ? this.props.room.name : this.props.label;
        var tooltip = (
            <div className="mx_RoomTooltip">
                 <img className="mx_RoomTooltip_chevron" src="img/chevron-left.png" width="9" height="16"/>
                 { label }
            </div>
        );

        this.tooltip = ReactDOM.render(tooltip, this.tooltipContainer);
    },

    render: function() {
        // Render a placeholder
        return (
            <div className="mx_RoomToolTip_placeholder" >
            </div>
        );
    }
});
