/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const getSpaceCollapsedKey = (roomId: string, parents?: Set<string>): string => {
    const separator = "/";
    let path = "";
    if (parents) {
        for (const entry of parents.entries()) {
            path += entry + separator;
        }
    }
    return `mx_space_collapsed_${path + roomId}`;
};

export default class SpaceTreeLevelLayoutStore {
    private static internalInstance: SpaceTreeLevelLayoutStore;

    public static get instance(): SpaceTreeLevelLayoutStore {
        if (!SpaceTreeLevelLayoutStore.internalInstance) {
            SpaceTreeLevelLayoutStore.internalInstance = new SpaceTreeLevelLayoutStore();
        }
        return SpaceTreeLevelLayoutStore.internalInstance;
    }

    public setSpaceCollapsedState(roomId: string, parents: Set<string> | undefined, collapsed: boolean): void {
        // XXX: localStorage doesn't allow booleans
        localStorage.setItem(getSpaceCollapsedKey(roomId, parents), collapsed.toString());
    }

    public getSpaceCollapsedState(roomId: string, parents: Set<string> | undefined, fallback: boolean): boolean {
        const collapsedLocalStorage = localStorage.getItem(getSpaceCollapsedKey(roomId, parents));
        // XXX: localStorage doesn't allow booleans
        return collapsedLocalStorage ? collapsedLocalStorage === "true" : fallback;
    }
}
