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

var classNames = require('classnames');
var React = require('react');
var ReactDOM = require('react-dom');

// Shamelessly ripped off Modal.js.  There's probably a better way
// of doing reusable widgets like dialog boxes & menus where we go and
// pass in a custom control as the actual body.

module.exports = {
    ContextualMenuContainerId: "mx_ContextualMenu_Container",

     propTypes: {
        menuWidth: React.PropTypes.number,
        menuHeight: React.PropTypes.number,
        chevronOffset: React.PropTypes.number,
    },

    getOrCreateContainer: function() {
        var container = document.getElementById(this.ContextualMenuContainerId);

        if (!container) {
            container = document.createElement("div");
            container.id = this.ContextualMenuContainerId;
            document.body.appendChild(container);
        }

        return container;
    },

    createMenu: function (Element, props) {
        var self = this;

        var closeMenu = function() {
            ReactDOM.unmountComponentAtNode(self.getOrCreateContainer());

            if (props && props.onFinished) {
                props.onFinished.apply(null, arguments);
            }
        };

        var position = {
            top: props.top,
        };

        var chevronOffset = {
            top: props.chevronOffset,
        }

        var chevron = null;
        if (props.left) {
            chevron = <div style={chevronOffset} className="mx_ContextualMenu_chevron_left"></div>
            position.left = props.left;
        } else {
            chevron = <div style={chevronOffset} className="mx_ContextualMenu_chevron_right"></div>
            position.right = props.right;
        }

        var className = 'mx_ContextualMenu_wrapper';

        var menuClasses = classNames({
            'mx_ContextualMenu': true,
            'mx_ContextualMenu_left': props.left,
            'mx_ContextualMenu_right': !props.left,
        });

        var menuSize = {};
        if (props.menuWidth) {
            menuSize.width = props.menuWidth;
        }

        if (props.menuHeight) {
            menuSize.height = props.menuHeight;
        }

        // FIXME: If a menu uses getDefaultProps it clobbers the onFinished
        // property set here so you can't close the menu from a button click!
        var menu = (
            <div className={className} style={position}>
                <div className={menuClasses} style={menuSize}>
                    {chevron}
                    <Element {...props} onFinished={closeMenu}/>
                </div>
                <div className="mx_ContextualMenu_background" onClick={closeMenu}></div>
            </div>
        );

        ReactDOM.render(menu, this.getOrCreateContainer());

        return {close: closeMenu};
    },
};
