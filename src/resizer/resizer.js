/*
Copyright 2018 New Vector Ltd

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

import {Sizer} from "./sizer";

/*
classNames:
    // class on resize-handle
    handle: string
    // class on resize-handle
    reverse: string
    // class on resize-handle
    vertical: string
    // class on container
    resizing: string
*/

export class Resizer {
    constructor(container, distributorCtor, distributorCfg, sizerCtor = Sizer) {
        this.container = container;
        this.distributorCtor = distributorCtor;
        this.distributorCfg = distributorCfg;
        this.sizerCtor = sizerCtor;
        this.classNames = {
            handle: "resizer-handle",
            reverse: "resizer-reverse",
            vertical: "resizer-vertical",
            resizing: "resizer-resizing",
        };
        this._onMouseDown = this._onMouseDown.bind(this);
    }

    setClassNames(classNames) {
        this.classNames = classNames;
    }

    attach() {
        this.container.addEventListener("mousedown", this._onMouseDown, false);
    }

    detach() {
        this.container.removeEventListener("mousedown", this._onMouseDown, false);
    }

    /**
    Gives the distributor for a specific resize handle, as if you would have started
    to drag that handle. Can be used to manipulate the size of an item programmatically.
    @param {number} handleIndex the index of the resize handle in the container
    @return {Distributor} a new distributor for the given handle
    */
    forHandleAt(handleIndex) {
        const handles = this._getResizeHandles();
        const handle = handles[handleIndex];
        if (handle) {
            const {distributor} = this._createSizerAndDistributor(handle);
            return distributor;
        }
    }

    forHandleWithId(id) {
        const handles = this._getResizeHandles();
        const handle = handles.find((h) => h.getAttribute("data-id") === id);
        if (handle) {
            const {distributor} = this._createSizerAndDistributor(handle);
            return distributor;
        }
    }

    _isResizeHandle(el) {
        return el && el.classList.contains(this.classNames.handle);
    }

    _onMouseDown(event) {
        // use closest in case the resize handle contains
        // child dom nodes that can be the target
        const resizeHandle = event.target && event.target.closest(`.${this.classNames.handle}`);
        if (!resizeHandle || resizeHandle.parentElement !== this.container) {
            return;
        }
        // prevent starting a drag operation
        event.preventDefault();

        // mark as currently resizing
        if (this.classNames.resizing) {
            this.container.classList.add(this.classNames.resizing);
        }

        const {sizer, distributor} = this._createSizerAndDistributor(resizeHandle);

        const onMouseMove = (event) => {
            const offset = sizer.offsetFromEvent(event);
            distributor.resizeFromContainerOffset(offset);
        };

        const body = document.body;
        const onMouseUp = (event) => {
            if (this.classNames.resizing) {
                this.container.classList.remove(this.classNames.resizing);
            }
            body.removeEventListener("mouseup", onMouseUp, false);
            body.removeEventListener("mousemove", onMouseMove, false);
        };
        body.addEventListener("mouseup", onMouseUp, false);
        body.addEventListener("mousemove", onMouseMove, false);
    }

    _createSizerAndDistributor(resizeHandle) {
        const vertical = resizeHandle.classList.contains(this.classNames.vertical);
        const reverse = resizeHandle.classList.contains(this.classNames.reverse);

        // eslint-disable-next-line new-cap
        const sizer = new this.sizerCtor(this.container, vertical, reverse);

        const items = this._getResizableItems();
        const prevItem = resizeHandle.previousElementSibling;
        // if reverse, resize the item after the handle instead of before, so + 1
        const itemIndex = items.indexOf(prevItem) + (reverse ? 1 : 0);
        const item = items[itemIndex];
        const id = resizeHandle.getAttribute("data-id");
        // eslint-disable-next-line new-cap
        const distributor = new this.distributorCtor(
            sizer, item, id, this.distributorCfg,
            items, this.container);
        return {sizer, distributor};
    }

    _getResizableItems() {
        return Array.from(this.container.children).filter(el => {
            return !this._isResizeHandle(el) && (
                this._isResizeHandle(el.previousElementSibling) ||
                this._isResizeHandle(el.nextElementSibling));
        });
    }

    _getResizeHandles() {
        return Array.from(this.container.children).filter(el => {
            return this._isResizeHandle(el);
        });
    }
}
