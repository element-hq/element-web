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
import Resizer, {IConfig} from "../resizer";
import Sizer from "../sizer";

export interface ICollapseConfig extends IConfig {
    toggleSize: number;
    onCollapsed?(collapsed: boolean, id: string, element: HTMLElement): void;
    isItemCollapsed(element: HTMLElement): boolean;
}

class CollapseItem extends ResizeItem<ICollapseConfig> {
    notifyCollapsed(collapsed: boolean) {
        const callback = this.resizer.config.onCollapsed;
        if (callback) {
            callback(collapsed, this.id, this.domNode);
        }
    }

    get isCollapsed() {
        const isItemCollapsed = this.resizer.config.isItemCollapsed;
        return isItemCollapsed(this.domNode);
    }
}

export default class CollapseDistributor extends FixedDistributor<ICollapseConfig, CollapseItem> {
    static createItem(resizeHandle: HTMLDivElement, resizer: Resizer<ICollapseConfig>, sizer: Sizer) {
        return new CollapseItem(resizeHandle, resizer, sizer);
    }

    private readonly toggleSize: number;
    private isCollapsed: boolean;

    constructor(item: CollapseItem) {
        super(item);
        this.toggleSize = item.resizer?.config?.toggleSize;
        this.isCollapsed = item.isCollapsed;
    }

    public resize(newSize: number) {
        const isCollapsedSize = newSize < this.toggleSize;
        if (isCollapsedSize && !this.isCollapsed) {
            this.isCollapsed = true;
            this.item.notifyCollapsed(true);
        } else if (!isCollapsedSize && this.isCollapsed) {
            this.item.notifyCollapsed(false);
            this.isCollapsed = false;
        }
        if (!isCollapsedSize) {
            super.resize(newSize);
        }
    }
}
