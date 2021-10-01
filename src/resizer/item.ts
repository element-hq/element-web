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

import Resizer, { IConfig } from "./resizer";
import Sizer from "./sizer";

export default class ResizeItem<C extends IConfig = IConfig> {
    public readonly domNode: HTMLElement;
    protected readonly id: string;
    protected reverse: boolean;

    constructor(
        handle: HTMLElement,
        public readonly resizer: Resizer<C>,
        public readonly sizer: Sizer,
        public readonly container?: HTMLElement,
    ) {
        this.reverse = resizer.isReverseResizeHandle(handle);
        if (container) {
            this.domNode = <HTMLElement>(container);
        } else {
            this.domNode = <HTMLElement>(this.reverse ? handle.nextElementSibling : handle.previousElementSibling);
        }
        this.id = handle.getAttribute("data-id");
    }

    private copyWith(handle: HTMLElement, resizer: Resizer, sizer: Sizer, container?: HTMLElement) {
        const Ctor = this.constructor as typeof ResizeItem;
        return new Ctor(handle, resizer, sizer, container);
    }

    private advance(forwards: boolean) {
        // opposite direction from fromResizeHandle to get back to handle
        let handle = this.reverse ? this.domNode.previousElementSibling : this.domNode.nextElementSibling;
        const moveNext = forwards !== this.reverse; // xor
        // iterate at least once to avoid infinite loop
        do {
            if (moveNext) {
                handle = handle.nextElementSibling;
            } else {
                handle = handle.previousElementSibling;
            }
        } while (handle && !this.resizer.isResizeHandle(<HTMLElement>handle));

        if (handle) {
            const nextHandle = this.copyWith(<HTMLElement>handle, this.resizer, this.sizer);
            nextHandle.reverse = this.reverse;
            return nextHandle;
        }
    }

    public next() {
        return this.advance(true);
    }

    public previous() {
        return this.advance(false);
    }

    public size() {
        return this.sizer.getItemSize(this.domNode);
    }

    public offset() {
        return this.sizer.getItemOffset(this.domNode);
    }

    public start() {
        this.sizer.start(this.domNode);
    }

    public finish() {
        this.sizer.finish(this.domNode);
    }

    public getSize() {
        return this.sizer.getDesiredItemSize(this.domNode);
    }

    public setRawSize(size: string) {
        this.sizer.setItemSize(this.domNode, size);
    }

    public setSize(size: number) {
        this.setRawSize(`${Math.round(size)}px`);
        const callback = this.resizer.config.onResized;
        if (callback) {
            callback(size, this.id, this.domNode);
        }
    }

    public clearSize() {
        this.sizer.clearItemSize(this.domNode);
        const callback = this.resizer.config.onResized;
        if (callback) {
            callback(null, this.id, this.domNode);
        }
    }

    public first() {
        const firstHandle = Array.from(this.domNode.parentElement.children).find(el => {
            return this.resizer.isResizeHandle(<HTMLElement>el);
        });
        if (firstHandle) {
            return this.copyWith(<HTMLElement>firstHandle, this.resizer, this.sizer);
        }
    }

    public last() {
        const lastHandle = Array.from(this.domNode.parentElement.children).reverse().find(el => {
            return this.resizer.isResizeHandle(<HTMLElement>el);
        });
        if (lastHandle) {
            return this.copyWith(<HTMLElement>lastHandle, this.resizer, this.sizer);
        }
    }
}
