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

import {MatrixClientPeg} from '../MatrixClientPeg';
import { _t } from '../languageHandler';

export function getNameForEventRoom(userId, roomId) {
    const client = MatrixClientPeg.get();
    const room = client.getRoom(roomId);
    const member = room && room.getMember(userId);
    return member ? member.name : userId;
}

export function userLabelForEventRoom(userId, roomId) {
    const name = getNameForEventRoom(userId, roomId);
    if (name !== userId) {
        return _t("%(name)s (%(userId)s)", {name, userId});
    } else {
        return userId;
    }
}
