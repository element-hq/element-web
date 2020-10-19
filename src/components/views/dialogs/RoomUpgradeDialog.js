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
import * as sdk from '../../../index';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import Modal from '../../../Modal';
import { _t } from '../../../languageHandler';

export default class RoomUpgradeDialog extends React.Component {
    static propTypes = {
        room: PropTypes.object.isRequired,
        onFinished: PropTypes.func.isRequired,
    };

    state = {
        busy: true,
    };

    async componentDidMount() {
        const recommended = await this.props.room.getRecommendedVersion();
        this._targetVersion = recommended.version;
        this.setState({busy: false});
    }

    _onCancelClick = () => {
        this.props.onFinished(false);
    };

    _onUpgradeClick = () => {
        this.setState({busy: true});
        MatrixClientPeg.get().upgradeRoom(this.props.room.roomId, this._targetVersion).then(() => {
            this.props.onFinished(true);
        }).catch((err) => {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to upgrade room', '', ErrorDialog, {
                title: _t("Failed to upgrade room"),
                description: ((err && err.message) ? err.message : _t("The room upgrade could not be completed")),
            });
        }).finally(() => {
            this.setState({busy: false});
        });
    };

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        const Spinner = sdk.getComponent('views.elements.Spinner');

        let buttons;
        if (this.state.busy) {
            buttons = <Spinner />;
        } else {
            buttons = <DialogButtons
                primaryButton={_t(
                    'Upgrade this room to version %(version)s',
                    {version: this._targetVersion},
                )}
                primaryButtonClass="danger"
                hasCancel={true}
                onPrimaryButtonClick={this._onUpgradeClick}
                focus={this.props.focus}
                onCancel={this._onCancelClick}
            />;
        }

        return (
            <BaseDialog className="mx_RoomUpgradeDialog"
                onFinished={this.props.onFinished}
                title={_t("Upgrade Room Version")}
                contentId='mx_Dialog_content'
                hasCancel={true}
            >
                <p>
                    {_t(
                        "Upgrading this room requires closing down the current " +
                        "instance of the room and creating a new room in its place. " +
                        "To give room members the best possible experience, we will:",
                    )}
                </p>
                <ol>
                    <li>{_t("Create a new room with the same name, description and avatar")}</li>
                    <li>{_t("Update any local room aliases to point to the new room")}</li>
                    <li>{_t("Stop users from speaking in the old version of the room, and post a message advising users to move to the new room")}</li>
                    <li>{_t("Put a link back to the old room at the start of the new room so people can see old messages")}</li>
                </ol>
                {buttons}
            </BaseDialog>
        );
    }
}
