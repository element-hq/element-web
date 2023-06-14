/*
Copyright 2017 - 2021 The Matrix.org Foundation C.I.C.

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

export enum AddressType {
    Email = "email",
    MatrixUserId = "mx-user-id",
    MatrixRoomId = "mx-room-id",
}

export function getAddressType(inputText: string): AddressType | null {
    if (emailRegex.test(inputText)) {
        return AddressType.Email;
    } else if (mxUserIdRegex.test(inputText)) {
        return AddressType.MatrixUserId;
    } else if (mxRoomIdRegex.test(inputText)) {
        return AddressType.MatrixRoomId;
    } else {
        return null;
    }
}
