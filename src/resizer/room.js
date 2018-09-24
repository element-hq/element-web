import {Sizer} from "./sizer";
import {FixedDistributor} from "./distributors";

class RoomSizer extends Sizer {
    setItemSize(item, size) {
        const isString = typeof size === "string";
        const cl = item.classList;
        if (isString) {
            item.style.flex = null;
            if (size === "show-content") {
                cl.add("show-content");
                cl.remove("show-available");
                item.style.maxHeight = null;
            }
        } else {
            cl.add("show-available");
            //item.style.flex = `0 1 ${Math.round(size)}px`;
            item.style.maxHeight = `${Math.round(size)}px`;
        }
    }

}

class RoomDistributor extends FixedDistributor {
    resize(offset) {
        const itemSize = offset - this.sizer.getItemOffset(this.item);

        if (itemSize > this.item.scrollHeight) {
            this.sizer.setItemSize(this.item, "show-content");
        } else {
            this.sizer.setItemSize(this.item, itemSize);
        }
    }
}

module.exports = {
    RoomSizer,
    RoomDistributor,
};
