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
    displayName: 'RoomUpgradeWarningBar',

    propTypes: {
        room: PropTypes.object.isRequired,
        recommendation: PropTypes.object.isRequired,
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
                    {_t(
                        "This room is running room version <roomVersion />, which this homeserver has " +
                        "marked as <i>unstable</i>.",
                        {},
                        {
                            "roomVersion": () => <code>{this.props.room.getVersion()}</code>,
                            "i": (sub) => <i>{sub}</i>,
                        },
                    )}
                </div>
                <div className="mx_RoomUpgradeWarningBar_body">
                    <p>
                        {_t(
                            "Upgrading this room will shut down the current instance of the room and create " +
                            "an upgraded room with the same name.",
                        )}
                    </p>
                    <p>
                        {_t(
                            "<b>Warning</b>: Upgrading a room will <i>not automatically migrate room members " +
                            "to the new version of the room.</i> We'll post a link to the new room in the old " +
                            "version of the room - room members will have to click this link to join the new room.",
                            {}, {
                                "b": (sub) => <b>{sub}</b>,
                                "i": (sub) => <i>{sub}</i>,
                            },
                        )}
                    </p>
                </div>
                <p className="mx_RoomUpgradeWarningBar_upgradelink">
                    <AccessibleButton onClick={this.onUpgradeClick}>
                        {_t("Upgrade this room to the recommended room version")}
                    </AccessibleButton>
                </p>
                <div className="mx_RoomUpgradeWarningBar_small">
                    {_t("Only room administrators will see this warning")}
                </div>
            </div>
        );
    },
});
