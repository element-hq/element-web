/*
Copyright 2018 New Vector Ltd

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
import PropTypes from 'prop-types';
import sdk from '../../../index';
import Modal from '../../../Modal';

import { _t } from '../../../languageHandler';

module.exports = React.createClass({
    displayName: 'RoomUpgardeWarningBar',

    propTypes: {
        room: PropTypes.object.isRequired,
    },

    onUpgradeClick: function() {
        const RoomUpgradeDialog = sdk.getComponent('dialogs.RoomUpgradeDialog');
        Modal.createTrackedDialog('Upgrade Room Version', '', RoomUpgradeDialog, {room: this.props.room});
    },

    render: function() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return (
            <div className="mx_RoomUpgradeWarningBar">
                <div className="mx_RoomUpgradeWarningBar_header">
                    {_t("There is a known vulnerability affecting this room.")}
                </div>
                <div className="mx_RoomUpgradeWarningBar_body">
                    {_t("This room version is vulnerable to malicious modification of room state.")}
                </div>
                <p className="mx_RoomUpgradeWarningBar_upgradelink">
                    <AccessibleButton onClick={this.onUpgradeClick}>
                        {_t("Click here to upgrade to the latest room version and ensure room integrity is protected.")}
                    </AccessibleButton>
                </p>
                <div className="mx_RoomUpgradeWarningBar_small">
                    {_t("Only room administrators will see this warning")}
                </div>
            </div>
        );
    },
});
