/*
Copyright 2019 - 2020 The Matrix.org Foundation C.I.C.

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

import FixedDistributor from "./fixed";
import ResizeItem from "../item";
import Resizer, { IConfig } from "../resizer";
import Sizer from "../sizer";

export interface ICollapseConfig extends IConfig {
    toggleSize: number;
    onCollapsed?(collapsed: boolean, id: string | null, element: HTMLElement): void;
    isItemCollapsed(element: HTMLElement): boolean;
}

class CollapseItem extends ResizeItem<ICollapseConfig> {
    public notifyCollapsed(collapsed: boolean): void {
        this.resizer.config?.onCollapsed?.(collapsed, this.id, this.domNode);
    }

    public get isCollapsed(): boolean {
        return this.resizer.config?.isItemCollapsed?.(this.domNode) ?? false;
    }
}

export default class CollapseDistributor extends FixedDistributor<ICollapseConfig, CollapseItem> {
    public static createItem(
        resizeHandle: HTMLDivElement,
        resizer: Resizer<ICollapseConfig>,
        sizer: Sizer,
        container?: HTMLElement,
    ): CollapseItem {
        return new CollapseItem(resizeHandle, resizer, sizer, container);
    }

    private readonly toggleSize: number | undefined;
    private isCollapsed: boolean;

    public constructor(item: CollapseItem) {
        super(item);
        this.toggleSize = item.resizer?.config?.toggleSize;
        this.isCollapsed = item.isCollapsed;
    }

    public resize(newSize: number): void {
        const isCollapsedSize = !!this.toggleSize && newSize < this.toggleSize;
        if (isCollapsedSize !== this.isCollapsed) {
            this.isCollapsed = isCollapsedSize;
            this.item.notifyCollapsed(isCollapsedSize);
        }
        if (!isCollapsedSize) {
            super.resize(newSize);
        }
    }
}
