class FixedDistributor {
    constructor(sizer, item) {
        this.sizer = sizer;
        this.item = item;
        this.beforeOffset = sizer.getItemOffset(this.item);
    }

    resize(offset) {
        const itemSize = offset - this.beforeOffset;
        this.sizer.setItemSize(this.item, itemSize);
        return itemSize;
    }

    finish(_offset) {
    }
}


class CollapseDistributor extends FixedDistributor {
    constructor(sizer, item, config) {
        super(sizer, item);
        this.toggleSize = config && config.toggleSize;
        this.onCollapsed = config && config.onCollapsed;
    }

    resize(offset) {
        let newSize = offset - this.sizer.getItemOffset(this.item);
        if (newSize < this.toggleSize) {
            this.item.classList.add("collapsed");
            if (this.onCollapsed) {
                this.onCollapsed(true, this.item);
            }
        }
        else {
            this.item.classList.remove("collapsed");
            if (this.onCollapsed) {
                this.onCollapsed(false, this.item);
            }
        }
        super.resize(newSize);
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

    finish(_offset) {

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
