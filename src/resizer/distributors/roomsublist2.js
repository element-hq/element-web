/*
Copyright 2019 New Vector Ltd

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

const allowWhitespace = true;
const blendOverflow = false;
const handleHeight = 1;

function log(...params) {
    // console.log.apply(console, params);
}

function clamp(height, min, max) {
    //log(`clamping ${height} between ${min} and ${max}`);
    if (height > max) return max;
    if (height < min) return min;
    return height;
}

export class Layout {
    constructor(applyHeight, initialSizes, collapsedState) {
        this._applyHeight = applyHeight;
        this._sections = [];
        this._collapsedState = collapsedState || {};
        this._availableHeight = 0;
        // need to store heights by id so it doesn't get
        // assigned to wrong section when a section gets added?
        this._sectionHeights = initialSizes || {};
        this._originalHeights = [];
        this._heights = [];
    }

    setAvailableHeight(newSize) {
        this._availableHeight = newSize;
        // needs more work
        this._applyNewSize();
    }

    setCollapsed(id, collapsed) {
        this._collapsedState[id] = collapsed;
        this._applyNewSize();
    }
    // [{id, count}]
    setSections(sections) {
        this._sections = sections;
        this._applyNewSize();
    }

    openHandle(id) {
        return new Handle(this, this._getSectionIndex(id));
    }

    _getAvailableHeight() {
        const nonCollapsedSectionCount = this._sections.reduce((count, section) => {
            const collapsed = this._collapsedState[section.id];
            return count + (collapsed ? 0 : 1);
        });
        return this._availableHeight - ((nonCollapsedSectionCount - 1) * handleHeight);
    }

    _applyNewSize() {
        const height = this._getAvailableHeight();
        const sectionHeights = this._sections.map((section) => {
            return this._sectionHeight[section.id] || (height / this._sections.length);
        });
        const totalRequestedHeight = sectionHeights.reduce((sum, h) => h + sum, 0);
        const ratios = sectionHeights.map((h) => h / totalRequestedHeight);
        this._originalHeights = ratios.map((r) => r * height);
        this._heights = this._originalHeights.slice(0);
        this._relayout();
    }

    _getSectionIndex(id) {
        return this._sections.findIndex((s) => s.id === id);
    }

    _getMaxHeight(i) {
        const section = this._sections[i];
        const collapsed = this._collapsedState[section.id];

        if (collapsed) {
            return this._sectionHeight(0);
        } else {
            return this._sectionHeight(section.count);
        }
    }

    _sectionHeight(count) {
        return 36 + (count === 0 ? 0 : 4 + (count * 34));
    }

    _getMinHeight(i) {
        const section = this._sections[i];
        return this._sectionHeight(Math.min(section.count, 1));
    }

    _applyOverflow(overflow, sections) {
        //log("applyOverflow", overflow, sections);
        // take the given overflow amount, and applies it to the given sections.
        // calls itself recursively until it has distributed all the overflow
        // or run out of unclamped sections.

        let unclampedSections = [];

        let overflowPerSection = blendOverflow ? (overflow / sections.length) : overflow;
        for (const i of sections) {
            newHeight = clamp(this._heights[i] - overflow, this._getMinHeight(i), this._getMaxHeight(i));
            if (newHeight == this._heights[i] - overflow) {
                unclampedSections.push(i);
            }
            overflow -= this._heights[i] - newHeight;
            log(`heights[${i}] (${this._heights[i]}) - newHeight (${newHeight}) = ${this._heights[i] - newHeight}`);

            // log(`changing ${this._heights[i]} to ${newHeight}`);
            this._heights[i] = newHeight;

            //log(`for section ${i} overflow is ${overflow}`);

            if (!blendOverflow) {
                overflowPerSection = overflow;
                if (Math.abs(overflow) < 1.0) break;
            }
        }

        if (Math.abs(overflow) > 1.0 && unclampedSections.length > 0) {
            // we weren't able to distribute all the overflow so recurse and try again
            log("recursing with", overflow, unclampedSections);
            overflow = this._applyOverflow(overflow, unclampedSections);
        }

        return overflow;
    }

    _rebalanceAbove(overflowAbove) {
        if (Math.abs(overflowAbove) > 1.0) {
            log(`trying to rebalance upstream with ${overflowAbove}`);
            let sections = [];
            for (let i = anchor - 1; i >= 1; i--) {
                sections.push(i);
            }
            overflowAbove = this._applyOverflow(overflowAbove, sections);
        }
        return overflowAbove;
    }

    _rebalanceBelow(overflowBelow) {
        if (Math.abs(overflowBelow) > 1.0) {
            log(`trying to rebalance downstream with ${overflowBelow}`);
            let sections = [];
            for (let i = anchor + 1; i <= this._sections.length; i++) {
                sections.push(i);
            }
            overflowBelow = this._applyOverflow(overflowBelow, sections);
            //log(`rebalanced downstream with ${overflowBelow}`);
        }
        return overflowBelow;
    }

    // @param offset the amount the anchor is moved from what is stored in _originalHeights, positive if downwards
    // if we're clamped, return the offset we should be clamped at.
    _relayout(anchor = 0, offset = 0, clamped = false) {
        this._heights = this._originalHeights.slice(0);
        // are these the amounts the items above/below shrank/grew and need to be relayouted?
        let overflowAbove;
        let overflowBelow;
        const maxHeight = this._getMaxHeight(anchor);
        const minHeight = this._getMinHeight(anchor);
        // new height > max ?
        if (this._heights[anchor] + offset > maxHeight) {
            // we're pulling downwards and clamped
            // overflowAbove = minus how much are we above max height?
            overflowAbove = (maxHeight - this._heights[anchor]) - offset;
            overflowBelow = offset;
            log(`pulling downwards clamped at max: ${overflowAbove} ${overflowBelow}`);
        }
        // new height < min?
        else if (this._heights[anchor] + offset < minHeight) {
            // we're pulling upwards and clamped
            // overflowAbove = ??? (offset is negative here, so - offset will add)
            overflowAbove = (minHeight - this._heights[anchor]) - offset;
            overflowBelow = offset;
            log(`pulling upwards clamped at min: ${overflowAbove} ${overflowBelow}`);
        }
        else {
            overflowAbove = 0;
            overflowBelow = offset;
            log(`resizing the anchor: ${overflowAbove} ${overflowBelow}`);
        }
        this._heights[anchor] = clamp(this._heights[anchor] + offset, minHeight, maxHeight);

        // these are reassigned the amount of overflow that could not be rebalanced
        // meaning we dragged the handle too far and it can't follow the cursor anymore
        overflowAbove = this._rebalanceAbove(overflowAbove);
        overflowBelow = this._rebalanceBelow(overflowBelow);

        if (!clamped) { // to avoid risk of infinite recursion
            // clamp to avoid overflowing or underflowing the page
            if (Math.abs(overflowAbove) > 1.0) {
                log(`clamping with overflowAbove ${overflowAbove}`);
                // here we do the layout again with offset - the amount of space we took too much
                this._relayout(anchor, offset + overflowAbove, true);
                return offset + overflowAbove;
            }

            if (Math.abs(overflowBelow) > 1.0) {
                // here we do the layout again with offset - the amount of space we took too much
                log(`clamping with overflowBelow ${overflowBelow}`);
                this._relayout(anchor, offset - overflowBelow, true);
                return offset - overflowBelow;
            }
        }

        // apply the heights
        for (let i = 0; i < this._sections.length; i++) {
            const section = this._sections[i];
            this._applyHeight(section.id, this._heights[i]);
            // const roomSubList = document.getElementById(`roomSubList${i}`);
            // roomSubList.style.height = `${heights[i]}px`;
        }

        return undefined;
    }

    _commitHeights() {
        this._originalHeights = this._heights;
    }
}

class Handle {
    constructor(layout, anchor) {
        this._layout = layout;
        this._anchor = anchor;
    }

    setOffset(offset) {
        this._layout._relayout(this._anchor, offset);
    }

    finish() {
        this._layout._commitHeights();
    }
}

export class Distributor {
    constructor(item, cfg) {
        this._item = item;
        this._layout = cfg.layout;
        this._initialTop;
    }

    start() {
        this._handle = this._layout.openHandle(this._item.id);
        this._initialTop = this._item.getOffset();
    }

    finish() {
        this._handle.finish();
    }

    resize() {
        // not supported
    }

    resizeFromContainerOffset(containerOffset) {
        const offset = containerOffset - this._initialTop;
        this._handle.setOffset(offset);
    }
}
