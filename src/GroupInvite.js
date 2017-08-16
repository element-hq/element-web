/*
Copyright 2017 New Vector Ltd

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

import MatrixClientPeg from './MatrixClientPeg';
import Modal from './Modal';
import sdk from './';
import MultiInviter from './utils/MultiInviter';
import { _t } from './languageHandler';
import Promise from 'bluebird';

export function showGroupInviteDialog(groupId) {
    const UserPickerDialog = sdk.getComponent("dialogs.UserPickerDialog");
    Modal.createTrackedDialog('Group Invite', '', UserPickerDialog, {
        title: _t('Invite new group members'),
        description: _t("Who would you like to add to this group?"),
        placeholder: _t("Name or matrix ID"),
        button: _t("Invite to Group"),
        validAddressTypes: ['mx'],
        onFinished: (shouldInvite, addrs) => {
            if (!shouldInvite) return;

            _onGroupInviteFinished(groupId, addrs);
        },
    });
}

function _onGroupInviteFinished(groupId, addrs) {
    const multiInviter = new MultiInviter(groupId);

    const addrTexts = addrs.map((addr) => addr.address);

    multiInviter.invite(addrTexts).then((completionStates) => {
        // Show user any errors
        const errorList = [];
        for (const addr of Object.keys(completionStates)) {
            if (addrs[addr] === "error") {
                errorList.push(addr);
            }
        }

        if (errorList.length > 0) {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to invite the following users to the group', '', ErrorDialog, {
                title: _t("Failed to invite the following users to %(groupId)s:", {groupId: groupId}),
                description: errorList.join(", "),
            });
        }
    }).catch((err) => {
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createTrackedDialog('Failed to invite users to group', '', ErrorDialog, {
            title: _t("Failed to invite users group"),
            description: _t("Failed to invite users to %(groupId)s", {groupId: groupId}),
        });
    });
}

