/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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
