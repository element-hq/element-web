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

export enum DefaultTagID {
    Invite = "im.vector.fake.invite",
    Untagged = "im.vector.fake.recent", // legacy: used to just be 'recent rooms' but now it's all untagged rooms
    Archived = "im.vector.fake.archived",
    LowPriority = "m.lowpriority",
    Favourite = "m.favourite",
    DM = "im.vector.fake.direct",
    ServerNotice = "m.server_notice",
    Suggested = "im.vector.fake.suggested",
    SavedItems = "im.vector.fake.saved_items",
}

export const OrderedDefaultTagIDs = [
    DefaultTagID.Invite,
    DefaultTagID.Favourite,
    DefaultTagID.SavedItems,
    DefaultTagID.DM,
    DefaultTagID.Untagged,
    DefaultTagID.LowPriority,
    DefaultTagID.ServerNotice,
    DefaultTagID.Suggested,
    DefaultTagID.Archived,
];

export type TagID = string | DefaultTagID;

export enum RoomUpdateCause {
    Timeline = "TIMELINE",
    PossibleTagChange = "POSSIBLE_TAG_CHANGE",
    PossibleMuteChange = "POSSIBLE_MUTE_CHANGE",
    ReadReceipt = "READ_RECEIPT",
    NewRoom = "NEW_ROOM",
    RoomRemoved = "ROOM_REMOVED",
}
