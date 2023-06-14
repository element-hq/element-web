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

import ResizeItem from "../item";
import Sizer from "../sizer";
import Resizer, { IConfig } from "../resizer";

/**
distributors translate a moving cursor into
CSS/DOM changes by calling the sizer

they have two methods:
    `resize` receives then new item size
    `resizeFromContainerOffset` receives resize handle location
        within the container bounding box. For internal use.
        This method usually ends up calling `resize` once the start offset is subtracted.
*/
export default class FixedDistributor<C extends IConfig, I extends ResizeItem<any> = ResizeItem<C>> {
    public static createItem(resizeHandle: HTMLDivElement, resizer: Resizer, sizer: Sizer): ResizeItem {
        return new ResizeItem(resizeHandle, resizer, sizer);
    }

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
