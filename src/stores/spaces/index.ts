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

import { Room } from "matrix-js-sdk/src/models/room";
import { IHierarchyRoom } from "matrix-js-sdk/src/@types/spaces";

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
}

export const getMetaSpaceName = (spaceKey: MetaSpace, allRoomsInHome = false): string => {
    switch (spaceKey) {
        case MetaSpace.Home:
            return allRoomsInHome ? _t("All rooms") : _t("Home");
        case MetaSpace.Favourites:
            return _t("Favourites");
        case MetaSpace.People:
            return _t("People");
        case MetaSpace.Orphans:
            return _t("Other rooms");
    }
};

export type SpaceKey = MetaSpace | Room["roomId"];

export interface ISuggestedRoom extends IHierarchyRoom {
    viaServers: string[];
}

export function isMetaSpace(spaceKey?: SpaceKey): boolean {
    return (
        spaceKey === MetaSpace.Home ||
        spaceKey === MetaSpace.Favourites ||
        spaceKey === MetaSpace.People ||
        spaceKey === MetaSpace.Orphans
    );
}
