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

const emailRegex = /^\S+@\S+\.\S+$/;

const mxUserIdRegex = /^@\S+:\S+$/;
const mxRoomIdRegex = /^!\S+:\S+$/;

import PropTypes from 'prop-types';
export const addressTypes = [
    'mx-user-id', 'mx-room-id', 'email',
];

// PropType definition for an object describing
// an address that can be invited to a room (which
// could be a third party identifier or a matrix ID)
// along with some additional information about the
// address / target.
export const UserAddressType = PropTypes.shape({
    addressType: PropTypes.oneOf(addressTypes).isRequired,
    address: PropTypes.string.isRequired,
    displayName: PropTypes.string,
    avatarMxc: PropTypes.string,
    // true if the address is known to be a valid address (eg. is a real
    // user we've seen) or false otherwise (eg. is just an address the
    // user has entered)
    isKnown: PropTypes.bool,
});

export function getAddressType(inputText) {
    const isEmailAddress = emailRegex.test(inputText);
    const isUserId = mxUserIdRegex.test(inputText);
    const isRoomId = mxRoomIdRegex.test(inputText);

    // sanity check the input for user IDs
    if (isEmailAddress) {
        return 'email';
    } else if (isUserId) {
        return 'mx-user-id';
    } else if (isRoomId) {
        return 'mx-room-id';
    } else {
        return null;
    }
}
