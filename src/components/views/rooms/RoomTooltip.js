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
        // The 'parent' can either be a React component or a DOM element
        parent: React.PropTypes.object.isRequired,

        // The tooltip is derived from either the room name or a label
        room: React.PropTypes.object,
        label: React.PropTypes.string,

        // The tooltip position can be tweaked by passing in additional positional information
        top: React.PropTypes.number,
        botom: React.PropTypes.number,
        left: React.PropTypes.number,
        right: React.PropTypes.number,
    },

    // Create a wrapper for the tooltip outside the parent and attach to the body element
    componentDidMount: function() {
        this.tooltipContainer = document.createElement("div");
        this.tooltipContainer.className = "mx_RoomTileTooltip_wrapper";
        document.body.appendChild(this.tooltipContainer);

        this._renderTooltip();
    },

    componentDidUpdate: function() {
        this._renderTooltip();
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

    _isDOMElement: function(obj) {
        return (obj && typeof obj === "object" && obj instanceof HTMLElement);
    },

    _isReactComponent: function(obj) {
        var ReactComponentPrototype = React.Component.prototype;
        var ReactClassComponentPrototype = (Object.getPrototypeOf(Object.getPrototypeOf(new (React.createClass({ render () {} }))())));

        return (obj && typeof obj === "object" && (ReactComponentPrototype.isPrototypeOf(obj) || ReactClassComponentPrototype.isPrototypeOf(obj)));
    },

    _renderTooltip: function() {
        var label = this.props.room ? this.props.room.name : this.props.label;
        var style = {};
        if (this.props.top) { style.top = this.props.top; }
        if (this.props.bottom) { style.bottom = this.props.bottom; }
        if (this.props.left) { style.left = this.props.left; }
        if (this.props.right) { style.right = this.props.right; }

        let parent;
        if (this._isDOMElement(this.props.parent)) {
            parent = this.props.parent;
        } else if (this._isReactComponent(this.props.parent)) {
            parent = ReactDOM.findDOMNode(this.props.parent);
        } else {
            parent = null;
        }

        // If a parent exist, add the parents position to the tooltips, so it's correctly
        // positioned, also taking into account any window zoom
        // NOTE: The additional 6 pixels for the left position, is to take account of the
        // tooltips chevron
        if (parent) {
            style.top = (+style.top || 0) + parent.getBoundingClientRect().top + window.pageYOffset;
            style.left = (+style.left || 0) + 6 + parent.getBoundingClientRect().right + window.pageXOffset;
            style.display = "block";

            var tooltip = (
                <div className="mx_RoomTooltip" style={style} >
                     <img className="mx_RoomTooltip_chevron" src="img/chevron-left.png" width="9" height="16"/>
                     { label }
                </div>
            );

            // Render the tooltip manually, as we wish it to not be render within the parent
            this.tooltip = ReactDOM.render(tooltip, this.tooltipContainer);

            // tell the roomlist about us so it can position us
            dis.dispatch({
                action: 'view_tooltip',
                tooltip: this.tooltip,
                parent: parent,
            });
        }
    },

    render: function() {
        // Render a placeholder
        return (
            <div className="mx_RoomToolTip_placeholder" >
            </div>
        );
    }
});
