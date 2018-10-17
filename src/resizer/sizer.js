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

class Sizer {
    constructor(container, vertical, reverse) {
        this.container = container;
        this.reverse = reverse;
        this.vertical = vertical;
    }

    getItemPercentage(item) {
        /*
        const flexGrow = window.getComputedStyle(item).flexGrow;
        if (flexGrow === "") {
            return null;
        }
        return parseInt(flexGrow) / 1000;
        */
        const style = window.getComputedStyle(item);
        const sizeStr = this.vertical ? style.height : style.width;
        const size = parseInt(sizeStr, 10);
        return size / this.getTotalSize();
    }

    setItemPercentage(item, percent) {
        item.style.flexGrow = Math.round(percent * 1000);
    }

    /** returns how far the edge of the item is from the edge of the container */
    getItemOffset(item) {
        const offset = (this.vertical ? item.offsetTop : item.offsetLeft) - this._getOffset();
        if (this.reverse) {
            return this.getTotalSize() - (offset + this.getItemSize(item));
        } else {
            return offset;
        }
    }

    /** returns the width/height of an item in the container */
    getItemSize(item) {
        return this.vertical ? item.offsetHeight : item.offsetWidth;
    }

    /** returns the width/height of the container */
    getTotalSize() {
        return this.vertical ? this.container.offsetHeight : this.container.offsetWidth;
    }

    /** container offset to offsetParent */
    _getOffset() {
        return this.vertical ? this.container.offsetTop : this.container.offsetLeft;
    }

    setItemSize(item, size) {
        if (this.vertical) {
            item.style.height = `${Math.round(size)}px`;
        } else {
            item.style.width = `${Math.round(size)}px`;
        }
    }

    /** returns the position of cursor at event relative to the edge of the container */
    offsetFromEvent(event) {
        const pos = this.vertical ? event.pageY : event.pageX;
        if (this.reverse) {
            return (this._getOffset() + this.getTotalSize()) - pos;
        } else {
            return pos - this._getOffset();
        }
    }
}

module.exports = {Sizer};
