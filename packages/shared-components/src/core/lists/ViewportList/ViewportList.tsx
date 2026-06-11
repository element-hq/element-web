/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type HTMLAttributes, type JSX, useEffect, useState } from "react";

class ItemRange {
    public constructor(
        public topCount: number,
        public renderCount: number,
        public bottomCount: number,
    ) {}

    public contains(range: ItemRange): boolean {
        // don't contain empty ranges
        // as it will prevent clearing the list
        // once it is scrolled far enough out of view
        if (!range.renderCount && this.renderCount) {
            return false;
        }
        return (
            range.topCount >= this.topCount && range.topCount + range.renderCount <= this.topCount + this.renderCount
        );
    }

    public expand(amount: number): ItemRange {
        // don't expand ranges that won't render anything
        if (this.renderCount === 0) {
            return this;
        }

        const topGrow = Math.min(amount, this.topCount);
        const bottomGrow = Math.min(amount, this.bottomCount);
        return new ItemRange(
            this.topCount - topGrow,
            this.renderCount + topGrow + bottomGrow,
            this.bottomCount - bottomGrow,
        );
    }

    public totalSize(): number {
        return this.topCount + this.renderCount + this.bottomCount;
    }
}

export interface ViewportListProps<T> extends HTMLAttributes<HTMLElement> {
    /** The type of the HTML element. @default div*/
    as?: keyof JSX.IntrinsicElements;
    // height in pixels of the component returned by `renderItem`
    itemHeight: number;
    // function to turn an element of `items` into a react component
    renderItem: (item: T) => JSX.Element;
    // scrollTop of the viewport (minus the height of any content above this list like other `ViewportList`s)
    scrollTop: number;
    // the height of the viewport this content is scrolled in
    height: number;
    // all items for the list. These should not be react components, see `renderItem`.
    items?: T[];
    // the amount of items to scroll before causing a rerender,
    // should typically be less than `overflowItems` unless applying
    // margins in the parent component when using multiple ViewportList in one viewport.
    // use 0 to only rerender when items will come into view.
    overflowMargin?: number;
    // the amount of items to add at the top and bottom to render,
    // so not every scroll of causes a rerender.
    overflowItems?: number;
}

const getVisibleRangeFromProps = <T,>(props: ViewportListProps<T>): ItemRange => {
    const { items, itemHeight, scrollTop, height } = props;
    const length = items ? items.length : 0;
    const topCount = Math.min(Math.max(0, Math.floor(scrollTop / itemHeight)), length);
    const itemsAfterTop = length - topCount;
    const visibleItems = height !== 0 ? Math.ceil(height / itemHeight) : 0;
    const renderCount = Math.min(visibleItems, itemsAfterTop);
    const bottomCount = itemsAfterTop - renderCount;
    return new ItemRange(topCount, renderCount, bottomCount);
};

const getDerivedRenderRangeFromProps = <T,>(
    props: ViewportListProps<T>,
    currentRenderRange: ItemRange | undefined,
): ItemRange | null => {
    const overflowMargin = props.overflowMargin ?? 5;
    const overflowItems = props.overflowItems ?? 20;
    const range = getVisibleRangeFromProps(props);
    const intersectRange = range.expand(overflowMargin);
    const renderRange = range.expand(overflowItems);
    const listHasChangedSize = !!currentRenderRange && renderRange.totalSize() !== currentRenderRange.totalSize();
    // only update render Range if the list has shrunk/grown and we need to adjust padding OR
    // if the new range + overflowMargin isn't contained by the old anymore
    if (listHasChangedSize || !currentRenderRange || !currentRenderRange.contains(intersectRange)) {
        return renderRange;
    }
    return null;
};

/**
 * A list that only renders the items around the current viewport.
 */
export function ViewportList<T = unknown>(props: ViewportListProps<T>): JSX.Element {
    const {
        as = "div",
        itemHeight,
        items,
        renderItem,
        overflowItems = 20,
        overflowMargin = 5,
        scrollTop,
        height,
        className,
        role,
        style,
        ...restProps
    } = props;
    // These props drive virtualization only and should not be forwarded to the DOM.
    void scrollTop;
    void height;
    const [renderRange, setRenderRange] = useState<ItemRange>(() => {
        const initialRenderRange = getDerivedRenderRangeFromProps(
            {
                ...props,
                overflowItems,
                overflowMargin,
            },
            undefined,
        );
        return initialRenderRange ?? new ItemRange(0, 0, items?.length ?? 0);
    });

    const derivedRenderRange = getDerivedRenderRangeFromProps(
        {
            ...props,
            overflowItems,
            overflowMargin,
        },
        renderRange,
    );
    const rangeToRender = derivedRenderRange ?? renderRange;
    const { topCount, renderCount, bottomCount } = rangeToRender;

    useEffect(() => {
        if (derivedRenderRange) {
            setRenderRange(derivedRenderRange);
        }
    }, [derivedRenderRange]);

    const paddingTop = topCount * itemHeight;
    const paddingBottom = bottomCount * itemHeight;
    const renderedItems = (items || []).slice(topCount, topCount + renderCount);

    const elementProps = {
        ...restProps,
        style: {
            ...style,
            paddingTop: `${paddingTop}px`,
            paddingBottom: `${paddingBottom}px`,
        },
        className,
        role,
    };

    return React.createElement(as, elementProps, renderedItems.map(renderItem));
}
