/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { User } from "matrix-js-sdk/src/models/user";

import { ActionPayload } from "../payloads";
import { Action } from "../actions";

export interface ViewUserPayload extends ActionPayload {
    action: Action.ViewUser;

    /**
     * The member to view. May be null or falsy to indicate that no member
     * should be shown (hide whichever relevant components).
     */
    member?: RoomMember | User;
}
