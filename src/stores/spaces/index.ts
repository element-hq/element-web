/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room, type HierarchyRoom } from "matrix-js-sdk/src/matrix";

import { _t } from "../../languageHandler";

// The consts & types are moved out here to prevent cyclical imports

export const UPDATE_TOP_LEVEL_SPACES = Symbol("top-level-spaces");
export const UPDATE_INVITED_SPACES = Symbol("invited-spaces");
export const UPDATE_SELECTED_SPACE = Symbol("selected-space");
export const UPDATE_HOME_BEHAVIOUR = Symbol("home-behaviour");
export const UPDATE_SUGGESTED_ROOMS = Symbol("suggested-rooms");
// Space Key will be emitted when a Space's children change

export enum MetaSpace {
    Home = "home-space",
    Favourites = "favourites-space",
    People = "people-space",
    Orphans = "orphans-space",
    VideoRooms = "video-rooms-space",
}

export const getMetaSpaceName = (spaceKey: MetaSpace, allRoomsInHome = false): string => {
    switch (spaceKey) {
        case MetaSpace.Home:
            return allRoomsInHome ? _t("common|all_chats") : _t("common|home");
        case MetaSpace.Favourites:
            return _t("common|favourites");
        case MetaSpace.People:
            return _t("common|people");
        case MetaSpace.Orphans:
            return _t("common|orphan_rooms");
        case MetaSpace.VideoRooms:
            return _t("voip|metaspace_video_rooms|conference_room_section");
    }
};

export type SpaceKey = MetaSpace | Room["roomId"];

export interface ISuggestedRoom extends HierarchyRoom {
    viaServers: string[];
}

export function isMetaSpace(spaceKey?: SpaceKey): spaceKey is MetaSpace {
    return (
        spaceKey === MetaSpace.Home ||
        spaceKey === MetaSpace.Favourites ||
        spaceKey === MetaSpace.People ||
        spaceKey === MetaSpace.Orphans ||
        spaceKey === MetaSpace.VideoRooms
    );
}
