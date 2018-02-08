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
        chevronFace: React.PropTypes.string, // top, bottom, left, right
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

        const closeMenu = function(...args) {
            ReactDOM.unmountComponentAtNode(self.getOrCreateContainer());

            if (props && props.onFinished) {
                props.onFinished.apply(null, args);
            }
        };

        // Close the menu on window resize
        const windowResize = function() {
            closeMenu();
        };

        const position = {};
        let chevronFace = null;

        if (props.top) {
            position.top = props.top;
        } else {
            position.bottom = props.bottom;
        }

        if (props.left) {
            position.left = props.left;
            chevronFace = 'left';
        } else {
            position.right = props.right;
            chevronFace = 'right';
        }

        const chevronOffset = {};
        if (props.chevronFace) {
            chevronFace = props.chevronFace;
        }
        if (chevronFace === 'top' || chevronFace === 'bottom') {
            chevronOffset.left = props.chevronOffset;
        } else {
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
                .mx_ContextualMenu_chevron_top:after {
                    border-left-color: ${props.menuColour};
                }
                .mx_ContextualMenu_chevron_bottom:after {
                    border-left-color: ${props.menuColour};
                }
            `;
        }

        const chevron = <div style={chevronOffset} className={"mx_ContextualMenu_chevron_" + chevronFace}></div>;
        const className = 'mx_ContextualMenu_wrapper';

        const menuClasses = classNames({
            'mx_ContextualMenu': true,
            'mx_ContextualMenu_left': chevronFace === 'left',
            'mx_ContextualMenu_right': chevronFace === 'right',
            'mx_ContextualMenu_top': chevronFace === 'top',
            'mx_ContextualMenu_bottom': chevronFace === 'bottom',
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

        if (!isNaN(Number(props.menuPaddingTop))) {
            menuStyle["paddingTop"] = props.menuPaddingTop;
        }

        // FIXME: If a menu uses getDefaultProps it clobbers the onFinished
        // property set here so you can't close the menu from a button click!
        const menu = (
            <div className={className} style={position}>
                <div className={menuClasses} style={menuStyle}>
                    { chevron }
                    <Element {...props} onFinished={closeMenu} onResize={windowResize} />
                </div>
                <div className="mx_ContextualMenu_background" onClick={closeMenu}></div>
                <style>{ chevronCSS }</style>
            </div>
        );

        ReactDOM.render(menu, this.getOrCreateContainer());

        return {close: closeMenu};
    },
};
