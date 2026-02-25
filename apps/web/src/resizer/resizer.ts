/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { throttle } from "lodash";

import type FixedDistributor from "./distributors/fixed";
import type ResizeItem from "./item";
import type Sizer from "./sizer";

interface IClassNames {
    // class on resize-handle
    handle?: string;
    // class on resize-handle
    reverse?: string;
    // class on resize-handle
    vertical?: string;
    // class on container
    resizing?: string;
}

export interface IConfig {
    onResizeStart?(): void;
    onResizeStop?(): void;
    onResized?(size: number | null, id: string | null, element: HTMLElement): void;
    handler?: HTMLDivElement;
}

export default class Resizer<C extends IConfig, I extends ResizeItem<C> = ResizeItem<C>> {
    private classNames: IClassNames;

    // TODO move vertical/horizontal to config option/container class
    // as it doesn't make sense to mix them within one container/Resizer
    public constructor(
        public container: HTMLElement | null,
        private readonly distributorCtor: {
            new (item: I): FixedDistributor<C, I>;
            createItem(resizeHandle: HTMLDivElement, resizer: Resizer<C, I>, sizer: Sizer, container?: HTMLElement): I;
            createSizer(containerElement: HTMLElement | null, vertical: boolean, reverse: boolean): Sizer;
        },
        public readonly config?: C,
    ) {
        this.classNames = {
            handle: "resizer-handle",
            reverse: "resizer-reverse",
            vertical: "resizer-vertical",
            resizing: "resizer-resizing",
        };
    }

    public setClassNames(classNames: IClassNames): void {
        this.classNames = classNames;
    }

    public attach(): void {
        const attachment = this?.config?.handler?.parentElement ?? this.container;
        attachment?.addEventListener("mousedown", this.onMouseDown, false);
        window.addEventListener("resize", this.onResize);
    }

    public detach(): void {
        const attachment = this?.config?.handler?.parentElement ?? this.container;
        attachment?.removeEventListener("mousedown", this.onMouseDown, false);
        window.removeEventListener("resize", this.onResize);
    }

    /**
    Gives the distributor for a specific resize handle, as if you would have started
    to drag that handle. Can be used to manipulate the size of an item programmatically.
    @param {number} handleIndex the index of the resize handle in the container
    @return {FixedDistributor} a new distributor for the given handle
    */
    public forHandleAt(handleIndex: number): FixedDistributor<C, I> | undefined {
        const handles = this.getResizeHandles();
        const handle = handles[handleIndex];
        if (handle) {
            const { distributor } = this.createSizerAndDistributor(<HTMLDivElement>handle);
            return distributor;
        }
    }

    public forHandleWithId(id: string): FixedDistributor<C, I> | undefined {
        const handles = this.getResizeHandles();
        const handle = handles.find((h) => h.getAttribute("data-id") === id);
        if (handle) {
            const { distributor } = this.createSizerAndDistributor(<HTMLDivElement>handle);
            return distributor;
        }
    }

    public isReverseResizeHandle(el: HTMLElement): boolean {
        return el.classList.contains(this.classNames.reverse!);
    }

    public isResizeHandle(el: HTMLElement): boolean {
        return el.classList.contains(this.classNames.handle!);
    }

    private onMouseDown = (event: MouseEvent): void => {
        const LEFT_MOUSE_BUTTON = 0;
        if (event.button !== LEFT_MOUSE_BUTTON) {
            return;
        }
        // use closest in case the resize handle contains
        // child dom nodes that can be the target
        const resizeHandle = event.target && (<HTMLDivElement>event.target).closest(`.${this.classNames.handle}`);
        const hasHandler = this?.config?.handler;
        // prevent that stacked resizer's are both activated with one mouse event
        // (this is possible because the mouse events are connected to the containers not the handles)
        if (
            !resizeHandle || // if no resizeHandle exist / mouse event hit the container not the handle
            (!hasHandler && resizeHandle.parentElement !== this.container) || // no handler from config -> check if the containers match
            (hasHandler && resizeHandle !== hasHandler)
        ) {
            // handler from config -> check if the handlers match
            return;
        }

        // prevent starting a drag operation
        event.preventDefault();

        // mark as currently resizing
        if (this.classNames.resizing) {
            this.container?.classList?.add(this.classNames.resizing);
        }
        this.config?.onResizeStart?.();

        const { sizer, distributor } = this.createSizerAndDistributor(<HTMLDivElement>resizeHandle);
        distributor.start();

        const onMouseMove = (event: MouseEvent): void => {
            const offset = sizer.offsetFromEvent(event);
            distributor.resizeFromContainerOffset(offset);
        };

        const body = document.body;
        const finishResize = (): void => {
            if (this.classNames.resizing) {
                this.container?.classList?.remove(this.classNames.resizing);
            }
            distributor.finish();
            this.config?.onResizeStop?.();
            body.removeEventListener("mouseup", finishResize, false);
            document.removeEventListener("mouseleave", finishResize, false);
            body.removeEventListener("mousemove", onMouseMove, false);
        };
        body.addEventListener("mouseup", finishResize, false);
        document.addEventListener("mouseleave", finishResize, false);
        body.addEventListener("mousemove", onMouseMove, false);
    };

    private onResize = throttle(
        () => {
            const distributors = this.getDistributors();

            // relax all items if they had any overconstrained flexboxes
            distributors.forEach((d) => d.start());
            distributors.forEach((d) => d.finish());
        },
        100,
        { trailing: true, leading: true },
    );

    public getDistributors = (): FixedDistributor<C, I>[] => {
        return this.getResizeHandles().map((handle) => {
            const { distributor } = this.createSizerAndDistributor(<HTMLDivElement>handle);
            return distributor;
        });
    };

    private createSizerAndDistributor(resizeHandle: HTMLDivElement): {
        sizer: Sizer;
        distributor: FixedDistributor<C, I>;
    } {
        const vertical = resizeHandle.classList.contains(this.classNames.vertical!);
        const reverse = this.isReverseResizeHandle(resizeHandle);
        const Distributor = this.distributorCtor;
        const useItemContainer = this.config?.handler ? this.container : undefined;
        const sizer = Distributor.createSizer(this.container, vertical, reverse);
        const item = Distributor.createItem(resizeHandle, this, sizer, useItemContainer ?? undefined);
        const distributor = new Distributor(item);
        return { sizer, distributor };
    }

    private getResizeHandles(): HTMLElement[] {
        if (this?.config?.handler) {
            return [this.config.handler];
        }
        if (!this.container?.children) return [];
        return Array.from(this.container.querySelectorAll(`.${this.classNames.handle}`));
    }
}
