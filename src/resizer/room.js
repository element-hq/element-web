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
import {FixedDistributor} from "./distributors";

class RoomSizer extends Sizer {
    setItemSize(item, size) {
        const isString = typeof size === "string";
        const cl = item.classList;
        if (isString) {
            if (size === "resized-all") {
                cl.add("resized-all");
                cl.remove("resized-sized");
                item.style.maxHeight = null;
            }
        } else {
            cl.add("resized-sized");
            cl.remove("resized-all");
            item.style.maxHeight = `${Math.round(size)}px`;
        }
    }
}

class RoomDistributor extends FixedDistributor {
    resize(itemSize) {
        const scrollItem = this.item.querySelector(".mx_RoomSubList_scroll");
        if (!scrollItem) {
            return; //FIXME: happens when starting the page on a community url, taking the safe way out for now
        }
        const fixedHeight = this.item.offsetHeight - scrollItem.offsetHeight;
        if (itemSize > (fixedHeight + scrollItem.scrollHeight)) {
            super.resize("resized-all");
        } else {
            super.resize(itemSize);
        }
    }

    resizeFromContainerOffset(offset) {
        return this.resize(offset - this.sizer.getItemOffset(this.item));
    }
}

module.exports = {
    RoomSizer,
    RoomDistributor,
};
