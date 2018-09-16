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

export const host = "matrix.to";
export const baseUrl = `https://${host}`;

export function makeEventPermalink(roomId, eventId) {
    return `${baseUrl}/#/${roomId}/${eventId}`;
}

export function makeUserPermalink(userId) {
    return `${baseUrl}/#/${userId}`;
}

export function makeRoomPermalink(roomId) {
    return `${baseUrl}/#/${roomId}`;
}

export function makeGroupPermalink(groupId) {
    return `${baseUrl}/#/${groupId}`;
}
