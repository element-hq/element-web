/*
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
import PropTypes from 'prop-types';
import {_t} from "../../../languageHandler";
import sdk from "../../../index";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import MatrixClientPeg from "../../../MatrixClientPeg";

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

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        let inviteToggle = null;
        if (this.state.isPrivate) {
            inviteToggle = (
                <LabelledToggleSwitch
                    value={this.state.inviteUsersToNewRoom} toggleInFront={true}
                    onChange={this._onInviteUsersToggle}
                    label={_t("Invite joined members to the new room automatically")} />
            );
        }

        return (
            <BaseDialog className='mx_RoomUpgradeWarningDialog' hasCancel={true}
                        onFinished={this.props.onFinished}
                        title={_t("Room upgrade confirmation")}>
                <div>
                    <p>{_t("Upgrading a room can be destructive and isn't always necessary.")}</p>
                    <p>
                        {_t(
                            "Room upgrades are usually recommended when a room version is considered " +
                            "<i>unstable</i>. Unstable room versions might have bugs, missing features, or " +
                            "security vulnerabilities.",
                            {}, {
                                "i": (sub) => <i>{sub}</i>,
                            },
                        )}
                    </p>
                    <p>
                        {_t(
                            "Room upgrades usually only affect <i>server-side</i> processing of the " +
                            "room. If you're having problems with your Riot client, please file an issue " +
                            "with <issueLink />.",
                            {}, {
                                "i": (sub) => <i>{sub}</i>,
                                "issueLink": () => {
                                    return <a href="https://github.com/vector-im/riot-web/issues/new/choose"
                                              target="_blank" rel="noopener">
                                        https://github.com/vector-im/riot-web/issues/new/choose
                                    </a>;
                                },
                            },
                        )}
                    </p>
                    <p>
                        {_t(
                            "<b>Warning</b>: Upgrading a room will <i>not automatically migrate room " +
                            "members to the new version of the room.</i> We'll post a link to the new room " +
                            "in the old version of the room - room members will have to click this link to " +
                            "join the new room.",
                            {}, {
                                "b": (sub) => <b>{sub}</b>,
                                "i": (sub) => <i>{sub}</i>,
                            },
                        )}
                    </p>
                    <p>
                        {_t(
                            "Please confirm that you'd like to go forward with upgrading this room " +
                            "from <oldVersion /> to <newVersion />.",
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
                    primaryButton={_t("Continue")}
                    onPrimaryButtonClick={this._onContinue}
                    cancelButton={_t("Cancel")}
                    onCancel={this._onCancel}
                />
            </BaseDialog>
        );
    }
}
