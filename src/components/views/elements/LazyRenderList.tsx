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

import React from "react";

class ItemRange {
    public constructor(public topCount: number, public renderCount: number, public bottomCount: number) {}

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

interface IProps<T> {
    // height in pixels of the component returned by `renderItem`
    itemHeight: number;
    // function to turn an element of `items` into a react component
    renderItem: (item: T) => JSX.Element;
    // scrollTop of the viewport (minus the height of any content above this list like other `LazyRenderList`s)
    scrollTop: number;
    // the height of the viewport this content is scrolled in
    height: number;
    // all items for the list. These should not be react components, see `renderItem`.
    items?: T[];
    // the amount of items to scroll before causing a rerender,
    // should typically be less than `overflowItems` unless applying
    // margins in the parent component when using multiple LazyRenderList in one viewport.
    // use 0 to only rerender when items will come into view.
    overflowMargin: number;
    // the amount of items to add at the top and bottom to render,
    // so not every scroll of causes a rerender.
    overflowItems: number;

    element?: string;
    className?: string;
    role?: string;
}

interface IState {
    renderRange: ItemRange;
}

export default class LazyRenderList<T = any> extends React.Component<IProps<T>, IState> {
    public static defaultProps: Partial<IProps<unknown>> = {
        overflowItems: 20,
        overflowMargin: 5,
    };

    public constructor(props: IProps<T>) {
        super(props);

        this.state = LazyRenderList.getDerivedStateFromProps(props, {} as IState) as IState;
    }

    public static getDerivedStateFromProps(props: IProps<unknown>, state: IState): Partial<IState> | null {
        const range = LazyRenderList.getVisibleRangeFromProps(props);
        const intersectRange = range.expand(props.overflowMargin);
        const renderRange = range.expand(props.overflowItems);
        const listHasChangedSize = !!state.renderRange && renderRange.totalSize() !== state.renderRange.totalSize();
        // only update render Range if the list has shrunk/grown and we need to adjust padding OR
        // if the new range + overflowMargin isn't contained by the old anymore
        if (listHasChangedSize || !state.renderRange || !state.renderRange.contains(intersectRange)) {
            return { renderRange };
        }
        return null;
    }

    private static getVisibleRangeFromProps(props: IProps<unknown>): ItemRange {
        const { items, itemHeight, scrollTop, height } = props;
        const length = items ? items.length : 0;
        const topCount = Math.min(Math.max(0, Math.floor(scrollTop / itemHeight)), length);
        const itemsAfterTop = length - topCount;
        const visibleItems = height !== 0 ? Math.ceil(height / itemHeight) : 0;
        const renderCount = Math.min(visibleItems, itemsAfterTop);
        const bottomCount = itemsAfterTop - renderCount;
        return new ItemRange(topCount, renderCount, bottomCount);
    }

    public render(): React.ReactNode {
        const { itemHeight, items, renderItem } = this.props;
        const { renderRange } = this.state;
        const { topCount, renderCount, bottomCount } = renderRange;

        const paddingTop = topCount * itemHeight;
        const paddingBottom = bottomCount * itemHeight;
        const renderedItems = (items || []).slice(topCount, topCount + renderCount);

        const element = this.props.element || "div";
        const elementProps = {
            style: { paddingTop: `${paddingTop}px`, paddingBottom: `${paddingBottom}px` },
            className: this.props.className,
            role: this.props.role,
        };
        return React.createElement(element, elementProps, renderedItems.map(renderItem));
    }
}
