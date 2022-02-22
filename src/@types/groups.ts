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

export const CreateEventField = "io.element.migrated_from_community";

export interface IGroupRoom {
    displayname: string;
    name?: string;
    roomId: string;
    canonicalAlias?: string;
    avatarUrl?: string;
    topic?: string;
    numJoinedMembers?: number;
    worldReadable?: boolean;
    guestCanJoin?: boolean;
    isPublic?: boolean;
}

/* eslint-disable camelcase */
export interface IGroupSummary {
    profile: {
        avatar_url?: string;
        is_openly_joinable?: boolean;
        is_public?: boolean;
        long_description: string;
        name: string;
        short_description: string;
    };
    rooms_section: {
        rooms: unknown[];
        categories: Record<string, unknown>;
        total_room_count_estimate: number;
    };
    user: {
        is_privileged: boolean;
        is_public: boolean;
        is_publicised: boolean;
        membership: string;
    };
    users_section: {
        users: unknown[];
        roles: Record<string, unknown>;
        total_user_count_estimate: number;
    };
}
/* eslint-enable camelcase */
