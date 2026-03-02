/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
implements DOM/CSS operations for resizing.
The sizer determines what CSS mechanism is used for sizing items, like flexbox, ...
*/
export default class Sizer {
    public constructor(
        protected readonly container: HTMLElement,
        protected readonly vertical: boolean,
        protected readonly reverse: boolean,
    ) {}

    /**
        @param {Element} item the dom element being resized
        @return {number} how far the edge of the item is from the edge of the container
    */
    public getItemOffset(item: HTMLElement): number {
        const offset = (this.vertical ? item.offsetTop : item.offsetLeft) - this.getOffset();
        if (this.reverse) {
            return this.getTotalSize() - (offset + this.getItemSize(item));
        } else {
            return offset;
        }
    }

    /**
        @param {Element} item the dom element being resized
        @return {number} the width/height of an item in the container
    */
    public getItemSize(item: HTMLElement): number {
        return this.vertical ? item.offsetHeight : item.offsetWidth;
    }

    /** @return {number} the width/height of the container */
    public getTotalSize(): number {
        return this.vertical ? this.container.offsetHeight : this.container.offsetWidth;
    }

    /** @return {number} container offset to offsetParent */
    private getOffset(): number {
        return this.vertical ? this.container.offsetTop : this.container.offsetLeft;
    }

    /** @return {number} container offset to document */
    private getPageOffset(): number {
        let element = this.container;
        let offset = 0;
        while (element) {
            const pos = this.vertical ? element.offsetTop : element.offsetLeft;
            offset = offset + pos;
            element = <HTMLElement>element.offsetParent;
        }
        return offset;
    }

    public getDesiredItemSize(item: HTMLElement): string {
        if (this.vertical) {
            return item.style.height;
        } else {
            return item.style.width;
        }
    }

    public setItemSize(item: HTMLElement, size: string): void {
        if (this.vertical) {
            item.style.height = size;
        } else {
            item.style.width = size;
        }
    }

    public clearItemSize(item: HTMLElement): void {
        if (this.vertical) {
            item.style.removeProperty("height");
        } else {
            item.style.removeProperty("width");
        }
    }

    public start(item: HTMLElement): void {}

    public finish(item: HTMLElement): void {}

    /**
        @param {MouseEvent} event the mouse event
        @return {number} the distance between the cursor and the edge of the container,
            along the applicable axis (vertical or horizontal)
    */
    public offsetFromEvent(event: MouseEvent): number {
        const pos = this.vertical ? event.pageY : event.pageX;
        if (this.reverse) {
            return this.getPageOffset() + this.getTotalSize() - pos;
        } else {
            return pos - this.getPageOffset();
        }
    }
}
