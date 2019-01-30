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

import FixedDistributor from "./fixed";

function clamp(height, min, max) {
    if (height > max) return max;
    if (height < min) return min;
    return height;
}

export class Layout {
    constructor(applyHeight, initialSizes, collapsedState, options) {
        // callback to set height of section
        this._applyHeight = applyHeight;
        // list of {id, count} objects,
        // determines sections and order of them
        this._sections = [];
        // stores collapsed by id
        this._collapsedState = Object.assign({}, collapsedState);
        // total available height to the layout
        // (including resize handles, ...)
        this._availableHeight = 0;
        // heights stored by section section id
        this._sectionHeights = Object.assign({}, initialSizes);
        // in-progress heights, while dragging. Committed on mouse-up.
        this._heights = [];
        // use while manually resizing to cancel
        // the resize for a given mouse position
        // when the previous resize made the layout
        // constrained
        this._clampedOffset = 0;
        // used while manually resizing, to clear
        // _clampedOffset when the direction of resizing changes
        this._lastOffset = 0;

        this._allowWhitespace = options && options.allowWhitespace;
        this._handleHeight = (options && options.handleHeight) || 0;
    }

    setAvailableHeight(newSize) {
        this._availableHeight = newSize;
        // needs more work
        this._applyNewSize();
    }

    expandSection(id, height) {
        this._collapsedState[id] = false;
        this._applyNewSize();
        this.openHandle(id).setHeight(height).finish();
    }

    collapseSection(id) {
        this._collapsedState[id] = true;
        this._applyNewSize();
    }

    update(sections, availableHeight, force = false) {
        let heightChanged = false;

        if (Number.isFinite(availableHeight) && availableHeight !== this._availableHeight) {
            heightChanged = true;
            this._availableHeight = availableHeight;
        }

        const sectionsChanged =
            sections.length !== this._sections.length ||
            sections.some((a, i) => {
                const b = this._sections[i];
                return a.id !== b.id || a.count !== b.count;
            });

        if (!heightChanged && !sectionsChanged && !force) {
            return;
        }

        this._sections = sections;
        const totalHeight = this._getAvailableHeight();
        const defaultHeight = Math.floor(totalHeight / this._sections.length);
        this._sections.forEach((section, i) => {
            if (!this._sectionHeights[section.id]) {
                this._sectionHeights[section.id] = clamp(
                    defaultHeight,
                    this._getMinHeight(i),
                    this._getMaxHeight(i),
                );
            }
        });
        this._applyNewSize();
    }

    openHandle(id) {
        const index = this._getSectionIndex(id);
        return new Handle(this, index, this._sectionHeights[id]);
    }

    _getAvailableHeight() {
        const nonCollapsedSectionCount = this._sections.reduce((count, section) => {
            const collapsed = this._collapsedState[section.id];
            return count + (collapsed ? 0 : 1);
        }, 0);
        return this._availableHeight - ((nonCollapsedSectionCount - 1) * this._handleHeight);
    }

    _applyNewSize() {
        const newHeight = this._getAvailableHeight();
        const currHeight = this._sections.reduce((sum, section) => {
            return sum + this._sectionHeights[section.id];
        }, 0);
        const offset = newHeight - currHeight;
        this._heights = this._sections.map((section) => this._sectionHeights[section.id]);
        const sections = this._sections.map((_, i) => i);
        this._applyOverflow(-offset, sections, true);
        this._applyHeights();
        this._commitHeights();
    }

    _getSectionIndex(id) {
        return this._sections.findIndex((s) => s.id === id);
    }

    _getMaxHeight(i) {
        const section = this._sections[i];
        const collapsed = this._collapsedState[section.id];

        if (collapsed) {
            return this._sectionHeight(0);
        } else if (!this._allowWhitespace) {
            return this._sectionHeight(section.count);
        } else {
            return 100000;
        }
    }

    _sectionHeight(count) {
        return 36 + (count === 0 ? 0 : 4 + (count * 34));
    }

    _getMinHeight(i) {
        const section = this._sections[i];
        const collapsed = this._collapsedState[section.id];
        const maxItems = collapsed ? 0 : 1;
        return this._sectionHeight(Math.min(section.count, maxItems));
    }

    _applyOverflow(overflow, sections, blend) {
        // take the given overflow amount, and applies it to the given sections.
        // calls itself recursively until it has distributed all the overflow
        // or run out of unclamped sections.

        const unclampedSections = [];

        let overflowPerSection = blend ? (overflow / sections.length) : overflow;
        for (const i of sections) {
            const newHeight = clamp(
                this._heights[i] - overflowPerSection,
                this._getMinHeight(i),
                this._getMaxHeight(i),
            );
            if (newHeight == this._heights[i] - overflowPerSection) {
                unclampedSections.push(i);
            }
            // when section is growing, overflow increases?
            // 100 -= 200 - 300
            // 100 -= -100
            // 200
            overflow -= this._heights[i] - newHeight;
            this._heights[i] = newHeight;
            if (!blend) {
                overflowPerSection = overflow;
                if (Math.abs(overflow) < 1.0) break;
            }
        }

        if (Math.abs(overflow) > 1.0 && unclampedSections.length > 0) {
            // we weren't able to distribute all the overflow so recurse and try again
            overflow = this._applyOverflow(overflow, unclampedSections, blend);
        }

        return overflow;
    }

    _rebalanceAbove(sectionIndex, overflowAbove) {
        if (Math.abs(overflowAbove) > 1.0) {
            const sections = [];
            for (let i = sectionIndex - 1; i >= 0; i--) {
                sections.push(i);
            }
            overflowAbove = this._applyOverflow(overflowAbove, sections);
        }
        return overflowAbove;
    }

    _rebalanceBelow(sectionIndex, overflowBelow) {
        if (Math.abs(overflowBelow) > 1.0) {
            const sections = [];
            for (let i = sectionIndex + 1; i < this._sections.length; i++) {
                sections.push(i);
            }
            overflowBelow = this._applyOverflow(overflowBelow, sections);
        }
        return overflowBelow;
    }

    // @param offset the amount the sectionIndex is moved from what is stored in _sectionHeights, positive if downwards
    // if we're constrained, return the offset we should be constrained at.
    _relayout(sectionIndex = 0, offset = 0, constrained = false) {
        this._heights = this._sections.map((section) => this._sectionHeights[section.id]);
        // are these the amounts the items above/below shrank/grew and need to be relayouted?
        let overflowAbove;
        let overflowBelow;
        const maxHeight = this._getMaxHeight(sectionIndex);
        const minHeight = this._getMinHeight(sectionIndex);
        // new height > max ?
        if (this._heights[sectionIndex] + offset > maxHeight) {
            // we're pulling downwards and constrained
            // overflowAbove = minus how much are we above max height
            overflowAbove = (maxHeight - this._heights[sectionIndex]) - offset;
            overflowBelow = offset;
        } else if (this._heights[sectionIndex] + offset < minHeight) { // new height < min?
            // we're pulling upwards and constrained
            overflowAbove = (minHeight - this._heights[sectionIndex]) - offset;
            overflowBelow = offset;
        } else {
            overflowAbove = 0;
            overflowBelow = offset;
        }
        this._heights[sectionIndex] = clamp(this._heights[sectionIndex] + offset, minHeight, maxHeight);

        // these are reassigned the amount of overflow that could not be rebalanced
        // meaning we dragged the handle too far and it can't follow the cursor anymore
        overflowAbove = this._rebalanceAbove(sectionIndex, overflowAbove);
        overflowBelow = this._rebalanceBelow(sectionIndex, overflowBelow);

        if (!constrained) { // to avoid risk of infinite recursion
            // clamp to avoid overflowing or underflowing the page
            if (Math.abs(overflowAbove) > 1.0) {
                // here we do the layout again with offset - the amount of space we took too much
                this._relayout(sectionIndex, offset + overflowAbove, true);
                return offset + overflowAbove;
            }

            if (Math.abs(overflowBelow) > 1.0) {
                // here we do the layout again with offset - the amount of space we took too much
                this._relayout(sectionIndex, offset - overflowBelow, true);
                return offset - overflowBelow;
            }
        }

        this._applyHeights();
        return undefined;
    }

    _applyHeights() {
        // apply the heights
        for (let i = 0; i < this._sections.length; i++) {
            const section = this._sections[i];
            this._applyHeight(section.id, this._heights[i]);
        }
    }

    _commitHeights() {
        this._sections.forEach((section, i) => {
            this._sectionHeights[section.id] = this._heights[i];
        });
    }

    _setUncommittedSectionHeight(sectionIndex, offset) {
        if (Math.sign(offset) != Math.sign(this._lastOffset)) {
            this._clampedOffset = undefined;
        }
        if (this._clampedOffset !== undefined) {
            if (offset < 0 && offset < this._clampedOffset) {
                return;
            }
            if (offset > 0 && offset > this._clampedOffset) {
                return;
            }
        }
        this._clampedOffset = this._relayout(sectionIndex, offset);
        this._lastOffset = offset;
    }
}

class Handle {
    constructor(layout, sectionIndex, height) {
        this._layout = layout;
        this._sectionIndex = sectionIndex;
        this._initialHeight = height;
    }

    setHeight(height) {
        this._layout._setUncommittedSectionHeight(
            this._sectionIndex,
            height - this._initialHeight,
        );
        return this;
    }

    finish() {
        this._layout._commitHeights();
        return this;
    }
}

export class Distributor extends FixedDistributor {
    constructor(item, cfg) {
        super(item);
        const layout = cfg.layout;
        this._handle = layout.openHandle(item.id);
    }

    finish() {
        this._handle.finish();
    }

    resize(height) {
        this._handle.setHeight(height);
    }
}
