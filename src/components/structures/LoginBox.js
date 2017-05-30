/*
Copyright 2017 Vector Creations Ltd

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
import { _t } from 'matrix-react-sdk/lib/languageHandler';
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');
var rate_limited_func = require('matrix-react-sdk/lib/ratelimitedfunc');
var AccessibleButton = require('matrix-react-sdk/lib/components/views/elements/AccessibleButton');

module.exports = React.createClass({
    displayName: 'LoginBox',

    propTypes: {
        collapsed: React.PropTypes.bool,
    },

    onToggleCollapse: function(show) {
        if (show) {
            dis.dispatch({
                action: 'show_left_panel',
            });
        }
        else {
            dis.dispatch({
                action: 'hide_left_panel',
            });
        }
    },

    onLoginClick: function() {
        dis.dispatch({ action: 'start_login' });
    },

    render: function() {
        var TintableSvg = sdk.getComponent('elements.TintableSvg');

        var toggleCollapse;
        if (this.props.collapsed) {
            toggleCollapse =
                <AccessibleButton className="mx_SearchBox_maximise" onClick={ this.onToggleCollapse.bind(this, true) }>
                    <TintableSvg src="img/maximise.svg" width="10" height="16" alt="Expand panel"/>
                </AccessibleButton>
        }
        else {
            toggleCollapse =
                <AccessibleButton className="mx_SearchBox_minimise" onClick={ this.onToggleCollapse.bind(this, false) }>
                    <TintableSvg src="img/minimise.svg" width="10" height="16" alt="Collapse panel"/>
                </AccessibleButton>
        }

        var loginButton;
        if (!this.props.collapsed) {
            loginButton = (
                <div className="mx_LoginBox_loginButton_wrapper">
                    <AccessibleButton className="mx_LoginBox_loginButton" element="button" onClick={this.onLoginClick}>
                        Login
                    </AccessibleButton>
                </div>
            );
        }

        var self = this;
        return (
            <div className="mx_SearchBox">
                { loginButton }
                { toggleCollapse }
            </div>
        );
    }
});
