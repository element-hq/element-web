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

class RoomSizer extends Sizer {
    setItemSize(item, size) {
        item.style.maxHeight = `${Math.round(size)}px`;
    }
}

/*
class RoomSubList extends ResizeItem {
    collapsed() {

    }

    scrollSizes() {
        return {offsetHeight, scrollHeight};
    }

    id() {

    }
}
*/

const MIN_SIZE = 70;
// would be good to have a way in here to know if the item can be resized
//  - collapsed items can't be resized (.mx_RoomSubList_hidden)
//  - items at MIN_SIZE can't be resized smaller
//  - items at maxContentHeight can't be resized larger

// if you shrink the predecesor, and start dragging down again afterwards, which item has to grow?

class RoomDistributor {
    constructor(item) {
        this.item = item;
    }

    _handleSize() {
        return 1;
    }

    // returns the remainder of size it didn't consume for this item
    _sizeItem(item, size) {
        // if collapsed, do nothing and subtract own height
        if (item.domNode.classList.contains("mx_RoomSubList_hidden")) {
            return;
        } else if (size < MIN_SIZE) {
            item.setSize(MIN_SIZE);
        } else {
            const scrollItem = item.domNode.querySelector(".mx_RoomSubList_scroll");
            const headerHeight = item.size() - scrollItem.offsetHeight;
            const maxContentHeight = headerHeight + scrollItem.scrollHeight;
            // avoid flexbox growing larger than the content height
            if (size > maxContentHeight) {
                item.setSize(maxContentHeight);
            } else {
                item.setSize(size);
            }
        }
    }

    resize(size) {
        if (size < 0) {
            console.log("NEGATIVE SIZE RESIZE RESIZE RESIZE!!!", size);
        }
        let item = this.item;
        // move to item that is at position of cursor
        // this would happen if the cursor goes beyond the min-height
        while (item && size < 0) {
            item = item.previous();
            if (item) {
                size = item.size() - size - this._handleSize();
            }
        }
        // change size of item and previous items from here
        while(item && size > 0) {
            const itemSize = item.size();
            this._sizeItem(item, size);
            const delta = item.size() - itemSize;
            const remainder = size - delta;
            // pass remainder to previous item
            if (remainder !== 0) {
                item = item.previous();
                if (item) {
                    size = item.size() - remainder - this._handleSize();
                }
            } else {
                item = null;
            }
        }
    }

    resizeFromContainerOffset(containerOffset) {
        this.resize(containerOffset - this.item.offset());
    }
}

module.exports = {
    RoomSizer,
    RoomDistributor,
};
