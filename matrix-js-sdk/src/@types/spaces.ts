/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { IPublicRoomsChunkRoom } from "../client";
import { RoomType } from "./event";
import { IStrippedState } from "../sync-accumulator";

// Types relating to Rooms of type `m.space` and related APIs

/* eslint-disable camelcase */
export interface IHierarchyRelation extends IStrippedState {
    origin_server_ts: number;
    content: {
        order?: string;
        suggested?: boolean;
        via?: string[];
    };
}

export interface IHierarchyRoom extends IPublicRoomsChunkRoom {
    room_type?: RoomType | string;
    children_state: IHierarchyRelation[];
}
/* eslint-enable camelcase */
