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
        item.style.flexBasis = `${Math.round(size)}px`;
        item.classList.add("resized-sized");
        // const total = this.getTotalSize();
        // const percent = size / total;
        // const growFactor = Math.round(1 + (percent * 100));
        // item.style.flexGrow = `${growFactor}`;
    }

    clearItemSize(item) {
        item.style.flexBasis = null;
        item.classList.remove("resized-sized");
    }
}

/*
class RoomSubList extends ResizeItem {
    collapsed() {

    }

    id() {

    }

    maxSize() {

    }

    minSize() {

    }
}
*/

const MIN_SIZE = 74;
// would be good to have a way in here to know if the item can be resized
//  - collapsed items can't be resized (.mx_RoomSubList_hidden)
//  - items at MIN_SIZE can't be resized smaller
//  - items at maxContentHeight can't be resized larger

// if you shrink the predecesor, and start dragging down again afterwards, which item has to grow?
/*
    either items before (starting from first or last)
    or
*/
class RoomDistributor {
    constructor(item) {
        this.item = item;
    }

    _handleSize() {
        return 1;
    }

    _isCollapsed(item) {
        return item.domNode.classList.contains("mx_RoomSubList_hidden");
    }

    _contentSize(item) {
        const scrollItem = item.domNode.querySelector(".mx_RoomSubList_scroll");
        const header = item.domNode.querySelector(".mx_RoomSubList_labelContainer");
        const headerHeight = item.sizer.getItemSize(header);
        return headerHeight + scrollItem.scrollHeight;
    }

    _isSized(item) {
        return item.domNode.classList.contains("resized-sized");
    }

    resize(size, interactive = false) {
        // console.log("*** starting resize session with size", size);

        // grow/shrink items after first?
        // const itemSize = this.item.size();
        // //
        // if (size < itemSize) {
        //     let nextItem = this.item.next();
        //     while (nextItem)
        // }

        if (false && interactive) {
            const nextItem = this.item.next();
            if (nextItem) {
                // let item = nextItem;
                // let hasUnsizedProceedingItem = false;
                // while (item) {
                //     if (this._isSized(item)) {
                //         hasUnsizedProceedingItem = true;
                //         item = null;
                //     } else {
                //         item = item.next();
                //     }
                // }
                // if (!hasUnsizedProceedingItem) {
                    nextItem.clearSize();
                // }
            }
        }

        let item = this.item;
        while (item) {
            // TODO: collapsed
            if (this._isCollapsed(item)) {
                item = item.previous();
            }
            else if (size <= MIN_SIZE) {
                item.setSize(MIN_SIZE);
                const remainder = MIN_SIZE - size;
                item = item.previous();
                if (item) {
                    size = item.size() - remainder - this._handleSize();
                }
            }
            else {
                const contentSize = this._contentSize(item);
                if (size > contentSize) {
                    item.setSize(contentSize);
                    const remainder = size - contentSize;
                    item = item.previous();
                    if (item) {
                        size = item.size() + remainder; // todo: handle size here?
                    }
                }
                else {
                    item.setSize(size);
                    item = null;
                    size = 0;
                }
            }
        }
    }

    resizeFromContainerOffset(containerOffset) {
        this.resize(containerOffset - this.item.offset(), true);
    }
}

module.exports = {
    RoomSizer,
    RoomDistributor,
};
