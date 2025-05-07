/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import ResizeItem from "../item";
import Sizer from "../sizer";
import { type IConfig } from "../resizer";
import type Resizer from "../resizer";

export abstract class BaseDistributor<C extends IConfig, I extends ResizeItem<C> = ResizeItem<C>> {
    public static createSizer(containerElement: HTMLElement, vertical: boolean, reverse: boolean): Sizer {
        return new Sizer(containerElement, vertical, reverse);
    }

    private readonly beforeOffset: number;

    public constructor(public readonly item: I) {
        this.beforeOffset = item.offset();
    }

    public get size(): string {
        return this.item.getSize();
    }

    public set size(size: string) {
        this.item.setRawSize(size);
    }

    public resize(size: number): void {
        this.item.setSize(size);
    }

    public resizeFromContainerOffset(offset: number): void {
        this.resize(offset - this.beforeOffset);
    }

    public start(): void {
        this.item.start();
    }

    public finish(): void {
        this.item.finish();
    }
}

/**
distributors translate a moving cursor into
CSS/DOM changes by calling the sizer

they have two methods:
    `resize` receives then new item size
    `resizeFromContainerOffset` receives resize handle location
        within the container bounding box. For internal use.
        This method usually ends up calling `resize` once the start offset is subtracted.
*/
export default class FixedDistributor<
    C extends IConfig,
    I extends ResizeItem<C> = ResizeItem<C>,
> extends BaseDistributor<C, I> {
    public static createItem(resizeHandle: HTMLDivElement, resizer: Resizer<any>, sizer: Sizer): ResizeItem<any> {
        return new ResizeItem(resizeHandle, resizer, sizer);
    }
}
