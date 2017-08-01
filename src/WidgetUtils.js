/*
Copyright 2017 Vector Creations Ltd

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

export default class WidgetUtils {

    /* Returns true if user is able to send state events to modify widgets in this room
     * @param roomId -- The ID of the room to check
     * @return Boolean -- true if the user can modify widgets in this room
     * @throws Error -- specifies the error reason
     */
    static canUserModifyWidgets(roomId) {
        if (!roomId) {
            console.warn('No room ID specified');
            return false;
        }

        const client = MatrixClientPeg.get();
        if (!client) {
            console.warn('User must be be logged in');
            return false;
        }

        const room = client.getRoom(roomId);
        if (!room) {
            console.warn(`Room ID ${roomId} is not recognised`);
            return false;
        }

        const me = client.credentials.userId;
        if (!me) {
            console.warn('Failed to get user ID');
            return false;
        }

        const member = room.getMember(me);
        if (!member || member.membership !== "join") {
            console.warn(`User ${me} is not in room ${roomId}`);
            return false;
        }

        return room.currentState.maySendStateEvent('im.vector.modular.widgets', me);
    }
}
