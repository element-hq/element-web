/*
Copyright 2016 OpenMarket Ltd

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
import MultiInviter from './utils/MultiInviter';

const emailRegex = /^\S+@\S+\.\S+$/;

export function getAddressType(inputText) {
    const isEmailAddress = /^\S+@\S+\.\S+$/.test(inputText);
    const isMatrixId = inputText[0] === '@' && inputText.indexOf(":") > 0;

    // sanity check the input for user IDs
    if (isEmailAddress) {
        return 'email';
    } else if (isMatrixId) {
        return 'mx';
    } else {
        return null;
    }
}

export function inviteToRoom(roomId, addr) {
    const addrType = getAddressType(addr);

    if (addrType == 'email') {
        return MatrixClientPeg.get().inviteByEmail(roomId, addr);
    } else if (addrType == 'mx') {
        return MatrixClientPeg.get().invite(roomId, addr);
    } else {
        throw new Error('Unsupported address');
    }
}

/**
 * Invites multiple addresses to a room
 * Simpler interface to utils/MultiInviter but with
 * no option to cancel.
 *
 * @param {roomId} The ID of the room to invite to
 * @param {array} Array of strings of addresses to invite. May be matrix IDs or 3pids.
 * @returns Promise
 */
export function inviteMultipleToRoom(roomId, addrs) {
    const inviter = new MultiInviter(roomId);
    return inviter.invite(addrs);
}

