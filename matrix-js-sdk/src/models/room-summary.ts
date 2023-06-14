/*
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.

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

export interface IRoomSummary {
    "m.heroes": string[];
    "m.joined_member_count"?: number;
    "m.invited_member_count"?: number;
}

interface IInfo {
    /** The title of the room (e.g. `m.room.name`) */
    title: string;
    /** The description of the room (e.g. `m.room.topic`) */
    desc?: string;
    /** The number of joined users. */
    numMembers?: number;
    /** The list of aliases for this room. */
    aliases?: string[];
    /** The timestamp for this room. */
    timestamp?: number;
}

/**
 * Construct a new Room Summary. A summary can be used for display on a recent
 * list, without having to load the entire room list into memory.
 * @param roomId - Required. The ID of this room.
 * @param info - Optional. The summary info. Additional keys are supported.
 */
export class RoomSummary {
    public constructor(public readonly roomId: string, info?: IInfo) {}
}
