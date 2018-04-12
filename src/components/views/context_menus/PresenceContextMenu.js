/*
Copyright 2017 Travis Ralston

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
import { _t, _td } from '../../../languageHandler';
import sdk from '../../../index';

const STATUS_LABELS = {
    "online": _td("Online"),
    "unavailable": _td("Away"),
    "offline": _td("Appear Offline"),
};

const PresenceContextMenuOption = React.createClass({
    displayName: 'PresenceContextMenuOption',

    propTypes: {
        forStatus: React.PropTypes.string.isRequired,
        isCurrent: React.PropTypes.bool,
        onChange: React.PropTypes.func.isRequired,
    },

    onClick: function() {
        if (this.isCurrent) return;
        this.props.onChange(this.props.forStatus);
    },

    render: function() {
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");

        const indicatorClasses = "mx_PresenceContextMenuOption_indicator "
            + "mx_PresenceContextMenuOption_indicator_" + this.props.forStatus;

        let classNames = "mx_PresenceContextMenuOption";
        if (this.props.isCurrent) classNames += " mx_PresenceContextMenuOption_current";

        return (
            <AccessibleButton className={classNames} element="div" onClick={this.onClick}>
                <div className={indicatorClasses}></div>
                { _t(STATUS_LABELS[this.props.forStatus]) }
            </AccessibleButton>
        );
    },
});

module.exports = React.createClass({
    displayName: 'PresenceContextMenu',

    propTypes: {
        // "online", "unavailable", or "offline"
        currentStatus: React.PropTypes.string.isRequired,

        // Called when the user wants to change their status.
        // Args: (newStatus:string)
        onChange: React.PropTypes.func.isRequired,

        // callback called when the menu is dismissed
        onFinished: React.PropTypes.func,
    },

    getInitialState() {
        return {
            currentStatus: this.props.currentStatus,
        };
    },

    onChange: function(newStatus) {
        this.props.onChange(newStatus);
        this.setState({currentStatus: newStatus});
    },

    render: function() {
        const statusElements = [];
        for (let status of Object.keys(STATUS_LABELS)) {
            statusElements.push((
                <PresenceContextMenuOption forStatus={status} key={status}
                                           onChange={this.onChange}
                                           isCurrent={status === this.state.currentStatus} />
            ));
        }

        return (
            <div>
                { statusElements }
            </div>
        );
    },
});
