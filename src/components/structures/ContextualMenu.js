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

const classNames = require('classnames');
const React = require('react');
const ReactDOM = require('react-dom');

// Shamelessly ripped off Modal.js.  There's probably a better way
// of doing reusable widgets like dialog boxes & menus where we go and
// pass in a custom control as the actual body.

module.exports = {
    ContextualMenuContainerId: "mx_ContextualMenu_Container",

    propTypes: {
        menuWidth: React.PropTypes.number,
        menuHeight: React.PropTypes.number,
        chevronOffset: React.PropTypes.number,
        menuColour: React.PropTypes.string,
    },

    getOrCreateContainer: function() {
        let container = document.getElementById(this.ContextualMenuContainerId);

        if (!container) {
            container = document.createElement("div");
            container.id = this.ContextualMenuContainerId;
            document.body.appendChild(container);
        }

        return container;
    },

    createMenu: function(Element, props) {
        const self = this;

        const closeMenu = function() {
            ReactDOM.unmountComponentAtNode(self.getOrCreateContainer());

            if (props && props.onFinished) {
                props.onFinished.apply(null, arguments);
            }
        };

        const position = {
            top: props.top,
        };

        const chevronOffset = {};
        if (props.chevronOffset) {
            chevronOffset.top = props.chevronOffset;
        }

        // To override the default chevron colour, if it's been set
        let chevronCSS = "";
        if (props.menuColour) {
            chevronCSS = `
                .mx_ContextualMenu_chevron_left:after {
                    border-right-color: ${props.menuColour};
                }

                .mx_ContextualMenu_chevron_right:after {
                    border-left-color: ${props.menuColour};
                }
            `;
        }

        let chevron = null;
        if (props.left) {
            chevron = <div style={chevronOffset} className="mx_ContextualMenu_chevron_left"></div>;
            position.left = props.left;
        } else {
            chevron = <div style={chevronOffset} className="mx_ContextualMenu_chevron_right"></div>;
            position.right = props.right;
        }

        const className = 'mx_ContextualMenu_wrapper';

        const menuClasses = classNames({
            'mx_ContextualMenu': true,
            'mx_ContextualMenu_left': props.left,
            'mx_ContextualMenu_right': !props.left,
        });

        const menuStyle = {};
        if (props.menuWidth) {
            menuStyle.width = props.menuWidth;
        }

        if (props.menuHeight) {
            menuStyle.height = props.menuHeight;
        }

        if (props.menuColour) {
            menuStyle["backgroundColor"] = props.menuColour;
        }

        // FIXME: If a menu uses getDefaultProps it clobbers the onFinished
        // property set here so you can't close the menu from a button click!
        const menu = (
            <div className={className} style={position}>
                <div className={menuClasses} style={menuStyle}>
                    { chevron }
                    <Element {...props} onFinished={closeMenu} />
                </div>
                <div className="mx_ContextualMenu_background" onClick={closeMenu}></div>
                <style>{ chevronCSS }</style>
            </div>
        );

        ReactDOM.render(menu, this.getOrCreateContainer());

        return {close: closeMenu};
    },
};
