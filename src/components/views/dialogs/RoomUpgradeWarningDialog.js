/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import {_t} from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import * as sdk from "../../../index";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import Modal from "../../../Modal";

export default class RoomUpgradeWarningDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
        roomId: PropTypes.string.isRequired,
        targetVersion: PropTypes.string.isRequired,
    };

    constructor(props) {
        super(props);

        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        const joinRules = room ? room.currentState.getStateEvents("m.room.join_rules", "") : null;
        const isPrivate = joinRules ? joinRules.getContent()['join_rule'] !== 'public' : true;
        this.state = {
            currentVersion: room ? room.getVersion() : "1",
            isPrivate,
            inviteUsersToNewRoom: true,
        };
    }

    _onContinue = () => {
        this.props.onFinished({continue: true, invite: this.state.isPrivate && this.state.inviteUsersToNewRoom});
    };

    _onCancel = () => {
        this.props.onFinished({continue: false, invite: false});
    };

    _onInviteUsersToggle = (newVal) => {
        this.setState({inviteUsersToNewRoom: newVal});
    };

    _openBugReportDialog = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const BugReportDialog = sdk.getComponent("dialogs.BugReportDialog");
        Modal.createTrackedDialog('Bug Report Dialog', '', BugReportDialog, {});
    };

    render() {
        const brand = SdkConfig.get().brand;
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        let inviteToggle = null;
        if (this.state.isPrivate) {
            inviteToggle = (
                <LabelledToggleSwitch
                    value={this.state.inviteUsersToNewRoom}
                    onChange={this._onInviteUsersToggle}
                    label={_t("Automatically invite users")} />
            );
        }

        const title = this.state.isPrivate ? _t("Upgrade private room") : _t("Upgrade public room");

        return (
            <BaseDialog
                className='mx_RoomUpgradeWarningDialog'
                hasCancel={true}
                fixedWidth={false}
                onFinished={this.props.onFinished}
                title={title}
            >
                <div>
                    <p>
                        {_t(
                            "Upgrading a room is an advanced action and is usually recommended when a room " +
                            "is unstable due to bugs, missing features or security vulnerabilities.",
                        )}
                    </p>
                    <p>
                        {_t(
                            "This usually only affects how the room is processed on the server. If you're " +
                            "having problems with your %(brand)s, please <a>report a bug</a>.",
                            {
                                brand,
                            },
                            {
                                "a": (sub) => {
                                    return <a href='#' onClick={this._openBugReportDialog}>{sub}</a>;
                                },
                            },
                        )}
                    </p>
                    <p>
                        {_t(
                            "You'll upgrade this room from <oldVersion /> to <newVersion />.",
                            {},
                            {
                                oldVersion: () => <code>{this.state.currentVersion}</code>,
                                newVersion: () => <code>{this.props.targetVersion}</code>,
                            },
                        )}
                    </p>
                    {inviteToggle}
                </div>
                <DialogButtons
                    primaryButton={_t("Upgrade")}
                    onPrimaryButtonClick={this._onContinue}
                    cancelButton={_t("Cancel")}
                    onCancel={this._onCancel}
                />
            </BaseDialog>
        );
    }
}
