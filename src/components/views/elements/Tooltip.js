/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

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


import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import dis from '../../../dispatcher/dispatcher';
import classNames from 'classnames';

const MIN_TOOLTIP_HEIGHT = 25;

export default createReactClass({
    displayName: 'Tooltip',

    propTypes: {
        // Class applied to the element used to position the tooltip
        className: PropTypes.string,
        // Class applied to the tooltip itself
        tooltipClassName: PropTypes.string,
        // Whether the tooltip is visible or hidden.
        // The hidden state allows animating the tooltip away via CSS.
        // Defaults to visible if unset.
        visible: PropTypes.bool,
        // the react element to put into the tooltip
        label: PropTypes.node,
    },

    getDefaultProps() {
        return {
            visible: true,
        };
    },

    // Create a wrapper for the tooltip outside the parent and attach it to the body element
    componentDidMount: function() {
        this.tooltipContainer = document.createElement("div");
        this.tooltipContainer.className = "mx_Tooltip_wrapper";
        document.body.appendChild(this.tooltipContainer);
        window.addEventListener('scroll', this._renderTooltip, true);

        this.parent = ReactDOM.findDOMNode(this).parentNode;

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
        window.removeEventListener('scroll', this._renderTooltip, true);
    },

    _updatePosition(style) {
        const parentBox = this.parent.getBoundingClientRect();
        let offset = 0;
        if (parentBox.height > MIN_TOOLTIP_HEIGHT) {
            offset = Math.floor((parentBox.height - MIN_TOOLTIP_HEIGHT) / 2);
        } else {
            // The tooltip is larger than the parent height: figure out what offset
            // we need so that we're still centered.
            offset = Math.floor(parentBox.height - MIN_TOOLTIP_HEIGHT);
        }
        style.top = (parentBox.top - 2) + window.pageYOffset + offset;
        style.left = 6 + parentBox.right + window.pageXOffset;
        return style;
    },

    _renderTooltip: function() {
        // Add the parent's position to the tooltips, so it's correctly
        // positioned, also taking into account any window zoom
        // NOTE: The additional 6 pixels for the left position, is to take account of the
        // tooltips chevron
        const parent = ReactDOM.findDOMNode(this).parentNode;
        let style = {};
        style = this._updatePosition(style);
        // Hide the entire container when not visible. This prevents flashing of the tooltip
        // if it is not meant to be visible on first mount.
        style.display = this.props.visible ? "block" : "none";

        const tooltipClasses = classNames("mx_Tooltip", this.props.tooltipClassName, {
            "mx_Tooltip_visible": this.props.visible,
            "mx_Tooltip_invisible": !this.props.visible,
        });

        const tooltip = (
            <div className={tooltipClasses} style={style}>
                <div className="mx_Tooltip_chevron" />
                { this.props.label }
            </div>
        );

        // Render the tooltip manually, as we wish it not to be rendered within the parent
        this.tooltip = ReactDOM.render(tooltip, this.tooltipContainer);

        // Tell the roomlist about us so it can manipulate us if it wishes
        dis.dispatch({
            action: 'view_tooltip',
            tooltip: this.tooltip,
            parent: parent,
        });
    },

    render: function() {
        // Render a placeholder
        return (
            <div className={this.props.className} >
            </div>
        );
    },
});
