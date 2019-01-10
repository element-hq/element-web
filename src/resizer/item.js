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

export default class ResizeItem {
    constructor(domNode, id, reverse, resizer, sizer) {
        this.domNode = domNode;
        this.id = id;
        this.reverse = reverse;
        this.resizer = resizer;
        this.sizer = sizer;
    }

    static fromResizeHandle(handle, resizer, sizer) {
        const id = handle.getAttribute("data-id");
        const reverse = resizer.isReverseResizeHandle(handle);
        const domNode = reverse ? handle.nextElementSibling : handle.previousElementSibling;
        return new ResizeItem(domNode, id, reverse, resizer, sizer);
    }

    _advance(forwards) {
        // opposite direction from fromResizeHandle to get back to handle
        let handle = this.reverse ?
            this.domNode.previousElementSibling :
            this.domNode.nextElementSibling;
        const moveNext = forwards !== this.reverse; // xor
        // iterate at least once to avoid infinite loop
        do {
            if (moveNext) {
                handle = handle.nextElementSibling;
            } else {
                handle = handle.previousElementSibling;
            }
        } while(handle && !this.resizer.isResizeHandle(handle));
        if (handle) {
            const nextHandle = ResizeItem.fromResizeHandle(handle, this.resizer, this.sizer);
            nextHandle.reverse = this.reverse;
            return nextHandle;
        }
    }

    next() {
        return this._advance(true);
    }

    previous() {
        return this._advance(false);
    }

    size() {
        return this.sizer.getItemSize(this.domNode);
    }

    offset() {
        return this.sizer.getItemOffset(this.domNode);
    }

    setSize(size) {
        this.sizer.setItemSize(this.domNode, size);
        const callback = this.resizer.distributorCtor.onResized;
        if (callback) {
            callback(size, this.id, this.domNode);
        }
    }

    clearSize() {
        this.sizer.clearItemSize(this.domNode);
        const callback = this.resizer.distributorCtor.onResized;
        if (callback) {
            callback(null, this.id, this.domNode);
        }
    }
}
