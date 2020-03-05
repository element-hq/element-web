/*
Copyright 2018 Vector Creations Ltd
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
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';
import {Group} from 'matrix-js-sdk';
import GroupStore from "../../../stores/GroupStore";
import {MenuItem} from "../../structures/ContextMenu";

export default class GroupInviteTileContextMenu extends React.Component {
    static propTypes = {
        group: PropTypes.instanceOf(Group).isRequired,
        /* callback called when the menu is dismissed */
        onFinished: PropTypes.func,
    };

    constructor(props) {
        super(props);

        this._onClickReject = this._onClickReject.bind(this);
    }

    componentDidMount() {
        this._unmounted = false;
    }

    componentWillUnmount() {
        this._unmounted = true;
    }

    _onClickReject() {
        const QuestionDialog = sdk.getComponent('dialogs.QuestionDialog');
        Modal.createTrackedDialog('Reject community invite', '', QuestionDialog, {
            title: _t('Reject invitation'),
            description: _t('Are you sure you want to reject the invitation?'),
            onFinished: async (shouldLeave) => {
                if (!shouldLeave) return;

                // FIXME: controller shouldn't be loading a view :(
                const Loader = sdk.getComponent("elements.Spinner");
                const modal = Modal.createDialog(Loader, null, 'mx_Dialog_spinner');

                try {
                    await GroupStore.leaveGroup(this.props.group.groupId);
                } catch (e) {
                    console.error("Error rejecting community invite: ", e);
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog('Error rejecting invite', '', ErrorDialog, {
                        title: _t("Error"),
                        description: _t("Unable to reject invite"),
                    });
                } finally {
                    modal.close();
                }
            },
        });

        // Close the context menu
        if (this.props.onFinished) {
            this.props.onFinished();
        }
    }

    render() {
        return <div>
            <MenuItem className="mx_RoomTileContextMenu_leave" onClick={this._onClickReject}>
                <img className="mx_RoomTileContextMenu_tag_icon" src={require("../../../../res/img/icon_context_delete.svg")} width="15" height="15" alt="" />
                { _t('Reject') }
            </MenuItem>
        </div>;
    }
}
