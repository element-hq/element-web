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

/**
distributors translate a moving cursor into
CSS/DOM changes by calling the sizer

they have one method, `resize` that receives
the offset from the container edge of where
the mouse cursor is.
*/
class FixedDistributor {
    constructor(sizer, item, config) {
        this.sizer = sizer;
        this.item = item;
        this.beforeOffset = sizer.getItemOffset(this.item);
        this.onResized = config && config.onResized;
    }

    resize(offset) {
        const itemSize = offset - this.beforeOffset;
        this.sizer.setItemSize(this.item, itemSize);
        if (this.onResized) {
            this.onResized(itemSize, this.item);
        }
        return itemSize;
    }

    sizeFromOffset(offset) {
        return offset - this.beforeOffset;
    }
}


class CollapseDistributor extends FixedDistributor {
    constructor(sizer, item, config) {
        super(sizer, item, config);
        this.toggleSize = config && config.toggleSize;
        this.onCollapsed = config && config.onCollapsed;
        this.isCollapsed = false;
    }

    resize(offset) {
        const newSize = this.sizeFromOffset(offset);
        const isCollapsedSize = newSize < this.toggleSize;
        if (isCollapsedSize && !this.isCollapsed) {
            this.isCollapsed = true;
            if (this.onCollapsed) {
                this.onCollapsed(true, this.item);
            }
        } else if (!isCollapsedSize && this.isCollapsed) {
            if (this.onCollapsed) {
                this.onCollapsed(false, this.item);
            }
            this.isCollapsed = false;
        }
        if (!isCollapsedSize) {
            super.resize(offset);
        }
    }
}

module.exports = {
    FixedDistributor,
    CollapseDistributor,
};
