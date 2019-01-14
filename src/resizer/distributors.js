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

import ResizeItem from "./item";
import Sizer from "./sizer";

/**
distributors translate a moving cursor into
CSS/DOM changes by calling the sizer

they have two methods:
    `resize` receives then new item size
    `resizeFromContainerOffset` receives resize handle location
        within the container bounding box. For internal use.
        This method usually ends up calling `resize` once the start offset is subtracted.
the offset from the container edge of where
the mouse cursor is.
*/
export class FixedDistributor {
    static createItem(resizeHandle, resizer, sizer) {
        return new ResizeItem(resizeHandle, resizer, sizer);
    }

    static createSizer(containerElement, vertical, reverse) {
        return new Sizer(containerElement, vertical, reverse);
    }

    constructor(item) {
        this.item = item;
        this.beforeOffset = item.offset();
    }

    resize(size) {
        this.item.setSize(size);
    }

    resizeFromContainerOffset(offset) {
        this.resize(offset - this.beforeOffset);
    }

    start() {}

    finish() {}
}

class CollapseItem extends ResizeItem {
    notifyCollapsed(collapsed) {
        const callback = this.resizer.config.onCollapsed;
        if (callback) {
            callback(collapsed, this.id, this.domNode);
        }
    }
}

export class CollapseDistributor extends FixedDistributor {
    static createItem(resizeHandle, resizer, sizer) {
        return new CollapseItem(resizeHandle, resizer, sizer);
    }

    constructor(item, config) {
        super(item);
        this.toggleSize = config && config.toggleSize;
        this.isCollapsed = false;
    }

    resize(newSize) {
        const isCollapsedSize = newSize < this.toggleSize;
        if (isCollapsedSize && !this.isCollapsed) {
            this.isCollapsed = true;
            this.item.notifyCollapsed(true);
        } else if (!isCollapsedSize && this.isCollapsed) {
            this.item.notifyCollapsed(false);
            this.isCollapsed = false;
        }
        if (!isCollapsedSize) {
            super.resize(newSize);
        }
    }
}
