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

// TODO: Simplify the class load when we pick an approach for the list layout

import { TagID } from "./models";

const TILE_HEIGHT_PX = 34;

export class LayoutUnit {
    constructor(public readonly multiplier: number) {
    }

    public convert(val: number): number {
        return Math.ceil(val * this.multiplier);
    }

    public normalizePixels(pixels: number): number {
        return this.convert(Math.ceil(pixels / this.multiplier));
    }

    public forNumTiles(n: number): number {
        const unitsPerTile = TILE_HEIGHT_PX / this.multiplier;
        return unitsPerTile * n;
    }
}

export const SMOOTH_RESIZE = new LayoutUnit(1);
export const CHUNKED_RESIZE = new LayoutUnit(TILE_HEIGHT_PX);

export class RoomListLayoutStore {
    public unit: LayoutUnit = SMOOTH_RESIZE;
    public minTilesShown = 1;

    /**
     * Minimum list height in pixels.
     */
    public get minListHeight(): number {
        return this.unit.forNumTiles(this.minTilesShown);
    }

    private getStorageKey(tagId: TagID) {
        return `mx_rlls_${tagId}_m_${this.unit.multiplier}`;
    }

    public setPixelHeight(tagId: TagID, pixels: number): void {
        localStorage.setItem(this.getStorageKey(tagId), JSON.stringify({pixels}));
    }

    public getPixelHeight(tagId: TagID): number {
        const stored = JSON.parse(localStorage.getItem(this.getStorageKey(tagId)));
        let storedHeight = 0;
        if (stored && stored.pixels) {
            storedHeight = stored.pixels;
        }
        return this.unit.normalizePixels(Math.max(this.minListHeight, storedHeight));
    }

    // TODO: Remove helper functions for design iteration

    public beSmooth() {
        this.unit = SMOOTH_RESIZE;
    }

    public beChunked() {
        this.unit = CHUNKED_RESIZE;
    }

    public beDifferent(multiplier: number) {
        this.unit = new LayoutUnit(multiplier);
    }
}
