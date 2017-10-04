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

import Modal from './Modal';
import sdk from './';
import MultiInviter from './utils/MultiInviter';
import { _t } from './languageHandler';
import MatrixClientPeg from './MatrixClientPeg';
import GroupStoreCache from './stores/GroupStoreCache';

export function showGroupInviteDialog(groupId) {
    const AddressPickerDialog = sdk.getComponent("dialogs.AddressPickerDialog");
    Modal.createTrackedDialog('Group Invite', '', AddressPickerDialog, {
        title: _t("Invite new group members"),
        description: _t("Who would you like to add to this group?"),
        placeholder: _t("Name or matrix ID"),
        button: _t("Invite to Group"),
        validAddressTypes: ['mx-user-id'],
        onFinished: (success, addrs) => {
            if (!success) return;

            _onGroupInviteFinished(groupId, addrs);
        },
    });
}

export function showGroupAddRoomDialog(groupId) {
    return new Promise((resolve, reject) => {
        const AddressPickerDialog = sdk.getComponent("dialogs.AddressPickerDialog");
        Modal.createTrackedDialog('Add Rooms to Group', '', AddressPickerDialog, {
            title: _t("Add rooms to the group"),
            description: _t("Which rooms would you like to add to this group?"),
            placeholder: _t("Room name or alias"),
            button: _t("Add to group"),
            pickerType: 'room',
            validAddressTypes: ['mx-room-id'],
            onFinished: (success, addrs) => {
                if (!success) return;

                _onGroupAddRoomFinished(groupId, addrs).then(resolve, reject);
            },
        });
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

function _onGroupAddRoomFinished(groupId, addrs) {
    const groupStore = GroupStoreCache.getGroupStore(MatrixClientPeg.get(), groupId);
    const errorList = [];
    return Promise.all(addrs.map((addr) => {
        return groupStore
            .addRoomToGroup(addr.address)
            .catch(() => { errorList.push(addr.address); })
            .reflect();
    })).then(() => {
        if (errorList.length === 0) {
            return;
        }
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createTrackedDialog(
            'Failed to add the following room to the group',
            '', ErrorDialog,
        {
            title: _t(
                "Failed to add the following rooms to %(groupId)s:",
                {groupId},
            ),
            description: errorList.join(", "),
        });
    });
}
