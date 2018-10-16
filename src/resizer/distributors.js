class FixedDistributor {
    constructor(container, items, handleIndex, direction, sizer) {
        this.item = items[handleIndex + direction];
        this.beforeOffset = sizer.getItemOffset(this.item);
        this.sizer = sizer;
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
    constructor(container, items, handleIndex, direction, sizer, toggleSize) {
        super(container, items, handleIndex, direction, sizer);
        this.toggleSize = toggleSize;
    }

    resize(offset) {
        let newSize = offset - this.sizer.getItemOffset(this.item);
        if (newSize < this.toggleSize) {
            this.item.classList.add("collapsed");
        }
        else {
            this.item.classList.remove("collapsed");
        }
        super.resize(newSize);
    }
}

class PercentageDistributor {

    constructor(container, items, handleIndex, direction, sizer) {
        this.container = container;
        this.totalSize = sizer.getTotalSize();
        this.sizer = sizer;

        this.beforeItems = items.slice(0, handleIndex);
        this.afterItems = items.slice(handleIndex);
        const percentages = PercentageDistributor._getPercentages(sizer, items);
        this.beforePercentages = percentages.slice(0, handleIndex);
        this.afterPercentages = percentages.slice(handleIndex);
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
