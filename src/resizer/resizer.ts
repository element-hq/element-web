/*
Copyright 2018 - 2020 The Matrix.org Foundation C.I.C.

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

import { throttle } from "lodash";

import FixedDistributor from "./distributors/fixed";
import ResizeItem from "./item";
import Sizer from "./sizer";

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

export default class Resizer<C extends IConfig = IConfig> {
    private classNames: IClassNames;

    // TODO move vertical/horizontal to config option/container class
    // as it doesn't make sense to mix them within one container/Resizer
    public constructor(
        public container: HTMLElement | null,
        private readonly distributorCtor: {
            new (item: ResizeItem): FixedDistributor<C, any>;
            createItem(
                resizeHandle: HTMLDivElement,
                resizer: Resizer,
                sizer: Sizer,
                container?: HTMLElement,
            ): ResizeItem;
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
    public forHandleAt(handleIndex: number): FixedDistributor<C> | undefined {
        const handles = this.getResizeHandles();
        const handle = handles[handleIndex];
        if (handle) {
            const { distributor } = this.createSizerAndDistributor(<HTMLDivElement>handle);
            return distributor;
        }
    }

    public forHandleWithId(id: string): FixedDistributor<C> | undefined {
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

    public getDistributors = (): FixedDistributor<any, ResizeItem<any>>[] => {
        return this.getResizeHandles().map((handle) => {
            const { distributor } = this.createSizerAndDistributor(<HTMLDivElement>handle);
            return distributor;
        });
    };

    private createSizerAndDistributor(resizeHandle: HTMLDivElement): {
        sizer: Sizer;
        distributor: FixedDistributor<any>;
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
