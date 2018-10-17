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

class FixedDistributor {
    constructor(sizer, item, config) {
        this.sizer = sizer;
        this.item = item;
        this.beforeOffset = sizer.getItemOffset(this.item);
        this.onResized = config.onResized;
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

class PercentageDistributor {

    constructor(sizer, item, _config, items, container) {
        this.container = container;
        this.totalSize = sizer.getTotalSize();
        this.sizer = sizer;

        const itemIndex = items.indexOf(item);
        this.beforeItems = items.slice(0, itemIndex);
        this.afterItems = items.slice(itemIndex);
        const percentages = PercentageDistributor._getPercentages(sizer, items);
        this.beforePercentages = percentages.slice(0, itemIndex);
        this.afterPercentages = percentages.slice(itemIndex);
    }

    resize(offset) {
        const percent = offset / this.totalSize;
        const beforeSum =
            this.beforePercentages.reduce((total, p) => total + p, 0);
        const beforePercentages =
            this.beforePercentages.map(p => (p / beforeSum) * percent);
        const afterSum =
            this.afterPercentages.reduce((total, p) => total + p, 0);
        const afterPercentages =
            this.afterPercentages.map(p => (p / afterSum) * (1 - percent));

        this.beforeItems.forEach((item, index) => {
            this.sizer.setItemPercentage(item, beforePercentages[index]);
        });
        this.afterItems.forEach((item, index) => {
            this.sizer.setItemPercentage(item, afterPercentages[index]);
        });
    }

    static _getPercentages(sizer, items) {
        const percentages = items.map(i => sizer.getItemPercentage(i));
        const setPercentages = percentages.filter(p => p !== null);
        const unsetCount = percentages.length - setPercentages.length;
        const setTotal = setPercentages.reduce((total, p) => total + p, 0);
        const implicitPercentage = (1 - setTotal) / unsetCount;
        return percentages.map(p => p === null ? implicitPercentage : p);
    }

    static setPercentage(el, percent) {
        el.style.flexGrow = Math.round(percent * 1000);
    }
}

module.exports = {
    FixedDistributor,
    CollapseDistributor,
    PercentageDistributor,
};
