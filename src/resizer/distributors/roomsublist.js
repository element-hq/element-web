/*
Copyright 2019 New Vector Ltd

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

import Sizer from "../sizer";
import ResizeItem from "../item";

class RoomSizer extends Sizer {
    setItemSize(item, size) {
        item.style.maxHeight = `${Math.round(size)}px`;
        item.classList.add("resized-sized");
    }

    clearItemSize(item) {
        item.style.maxHeight = null;
        item.classList.remove("resized-sized");
    }
}

class RoomSubListItem extends ResizeItem {
    isCollapsed() {
        return this.domNode.classList.contains("mx_RoomSubList_hidden");
    }

    maxSize() {
        const header = this.domNode.querySelector(".mx_RoomSubList_labelContainer");
        const scrollItem = this.domNode.querySelector(".mx_RoomSubList_scroll");
        const headerHeight = this.sizer.getItemSize(header);
        return headerHeight + (scrollItem ? scrollItem.scrollHeight : 0);
    }

    minSize() {
        const isNotEmpty = this.domNode.classList.contains("mx_RoomSubList_nonEmpty");
        return isNotEmpty ? 74 : 31; //size of header + 1? room tile (see room sub list css)
    }

    isSized() {
        return this.domNode.classList.contains("resized-sized");
    }
}

export default class RoomSubListDistributor {
    static createItem(resizeHandle, resizer, sizer) {
        return new RoomSubListItem(resizeHandle, resizer, sizer);
    }

    static createSizer(containerElement, vertical, reverse) {
        return new RoomSizer(containerElement, vertical, reverse);
    }

    constructor(item) {
        this.item = item;
    }

    _handleSize() {
        return 1;
    }

    resize(size) {
        //console.log("*** starting resize session with size", size);
        let item = this.item;
        while (item) {
            const minSize = item.minSize();
            if (item.isCollapsed()) {
                item = item.previous();
            } else if (size <= minSize) {
                //console.log("  - resizing", item.id, "to min size", minSize);
                item.setSize(minSize);
                const remainder = minSize - size;
                item = item.previous();
                if (item) {
                    size = item.size() - remainder - this._handleSize();
                }
            } else {
                const maxSize = item.maxSize();
                if (size > maxSize) {
                    // console.log("  - resizing", item.id, "to maxSize", maxSize);
                    item.setSize(maxSize);
                    const remainder = size - maxSize;
                    item = item.previous();
                    if (item) {
                        size = item.size() + remainder; // todo: handle size here?
                    }
                } else {
                    //console.log("  - resizing", item.id, "to size", size);
                    item.setSize(size);
                    item = null;
                    size = 0;
                }
            }
        }
        //console.log("*** ending resize session");
    }

    resizeFromContainerOffset(containerOffset) {
        this.resize(containerOffset - this.item.offset());
    }

    start() {
        // set all max-height props to the actual height.
        let item = this.item.first();
        const sizes = [];
        while (item) {
            if (!item.isCollapsed()) {
                sizes.push(item.size());
            } else {
                sizes.push(100);
            }
            item = item.next();
        }
        item = this.item.first();
        sizes.forEach((size) => {
            item.setSize(size);
            item = item.next();
        });
    }

    finish() {
    }
}
