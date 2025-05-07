/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseDistributor } from "./fixed";
import ResizeItem from "../item";
import { type IConfig } from "../resizer";
import type Resizer from "../resizer";
import type Sizer from "../sizer";

export interface ICollapseConfig extends IConfig {
    toggleSize: number;
    onCollapsed?(collapsed: boolean, id: string | null, element: HTMLElement): void;
    isItemCollapsed(element: HTMLElement): boolean;
}

export class CollapseItem extends ResizeItem<ICollapseConfig> {
    public notifyCollapsed(collapsed: boolean): void {
        this.resizer.config?.onCollapsed?.(collapsed, this.id, this.domNode);
    }

    public get isCollapsed(): boolean {
        return this.resizer.config?.isItemCollapsed?.(this.domNode) ?? false;
    }
}

export default class CollapseDistributor extends BaseDistributor<ICollapseConfig, CollapseItem> {
    public static createItem(
        resizeHandle: HTMLDivElement,
        resizer: Resizer<ICollapseConfig, CollapseItem>,
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
