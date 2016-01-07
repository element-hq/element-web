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

// Shamelessly ripped off Modal.js.  There's probably a better way
// of doing reusable widgets like dialog boxes & menus where we go and
// pass in a custom control as the actual body.

module.exports = {
    ContextualMenuContainerId: "mx_ContextualMenu_Container",

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

            if (props && props.onFinished) props.onFinished.apply(null, arguments);
        };

        var position = {
            top: props.top - 20,
        };

        var chevron = null;
        if (props.left) {
            chevron = <img className="mx_ContextualMenu_chevron_left" src="img/chevron-left.png" width="9" height="16" />
            position.left = props.left + 8;
        } else {
            chevron = <img className="mx_ContextualMenu_chevron_right" src="img/chevron-right.png" width="9" height="16" />
            position.right = props.right + 8;
        }

        var className = 'mx_ContextualMenu_wrapper';

        // FIXME: If a menu uses getDefaultProps it clobbers the onFinished
        // property set here so you can't close the menu from a button click!
        var menu = (
            <div className={className}>
                <div className="mx_ContextualMenu" style={position}>
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
