/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import Resizer, { IConfig } from "./resizer";
import Sizer from "./sizer";

export default class ResizeItem<C extends IConfig> {
    public readonly domNode: HTMLElement;
    protected readonly id: string | null;
    protected reverse: boolean;

    public constructor(
        handle: HTMLElement,
        public readonly resizer: Resizer<C, any>,
        public readonly sizer: Sizer,
        public readonly container?: HTMLElement,
    ) {
        this.reverse = resizer.isReverseResizeHandle(handle);
        if (container) {
            this.domNode = container;
        } else {
            this.domNode = <HTMLElement>(this.reverse ? handle.nextElementSibling : handle.previousElementSibling);
        }
        this.id = handle.getAttribute("data-id");
    }

    private copyWith(
        handle: HTMLElement,
        resizer: Resizer<C, any>,
        sizer: Sizer,
        container?: HTMLElement,
    ): ResizeItem<C> {
        const Ctor = this.constructor as typeof ResizeItem;
        return new Ctor(handle, resizer, sizer, container);
    }

    private advance(forwards: boolean): ResizeItem<C> | undefined {
        // opposite direction from fromResizeHandle to get back to handle
        let handle: Element | null | undefined = this.reverse
            ? this.domNode.previousElementSibling
            : this.domNode.nextElementSibling;
        const moveNext = forwards !== this.reverse; // xor
        // iterate at least once to avoid infinite loop
        do {
            if (moveNext) {
                handle = handle?.nextElementSibling;
            } else {
                handle = handle?.previousElementSibling;
            }
        } while (handle && !this.resizer.isResizeHandle(<HTMLElement>handle));

        if (handle) {
            const nextHandle = this.copyWith(<HTMLElement>handle, this.resizer, this.sizer);
            nextHandle.reverse = this.reverse;
            return nextHandle;
        }
    }

    public next(): ResizeItem<C> | undefined {
        return this.advance(true);
    }

    public previous(): ResizeItem<C> | undefined {
        return this.advance(false);
    }

    public size(): number {
        return this.sizer.getItemSize(this.domNode);
    }

    public offset(): number {
        return this.sizer.getItemOffset(this.domNode);
    }

    public start(): void {
        this.sizer.start(this.domNode);
    }

    public finish(): void {
        this.sizer.finish(this.domNode);
    }

    public getSize(): string {
        return this.sizer.getDesiredItemSize(this.domNode);
    }

    public setRawSize(size: string): void {
        this.sizer.setItemSize(this.domNode, size);
    }

    public setSize(size: number): void {
        this.setRawSize(`${Math.round(size)}px`);
        this.resizer.config?.onResized?.(size, this.id, this.domNode);
    }

    public clearSize(): void {
        this.sizer.clearItemSize(this.domNode);
        this.resizer.config?.onResized?.(null, this.id, this.domNode);
    }

    public first(): ResizeItem<C> | undefined {
        if (!this.domNode.parentElement?.children) {
            return;
        }
        const firstHandle = Array.from(this.domNode.parentElement.children).find((el) => {
            return this.resizer.isResizeHandle(<HTMLElement>el);
        });
        if (firstHandle) {
            return this.copyWith(<HTMLElement>firstHandle, this.resizer, this.sizer);
        }
    }

    public last(): ResizeItem<C> | undefined {
        if (!this.domNode.parentElement?.children) {
            return;
        }
        const lastHandle = Array.from(this.domNode.parentElement.children)
            .reverse()
            .find((el) => {
                return this.resizer.isResizeHandle(<HTMLElement>el);
            });
        if (lastHandle) {
            return this.copyWith(<HTMLElement>lastHandle, this.resizer, this.sizer);
        }
    }
}
