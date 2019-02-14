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

const OVERFLOW_ITEMS = 20;
const OVERFLOW_MARGIN = 5;

class ItemRange {
    constructor(topCount, renderCount, bottomCount) {
        this.topCount = topCount;
        this.renderCount = renderCount;
        this.bottomCount = bottomCount;
    }

    contains(range) {
        return range.topCount >= this.topCount &&
            (range.topCount + range.renderCount) <= (this.topCount + this.renderCount);
    }

    expand(amount) {
        const topGrow = Math.min(amount, this.topCount);
        const bottomGrow = Math.min(amount, this.bottomCount);
        return new ItemRange(
            this.topCount - topGrow,
            this.renderCount + topGrow + bottomGrow,
            this.bottomCount - bottomGrow,
        );
    }
}

export default class LazyRenderList extends React.Component {
    constructor(props) {
        super(props);
        const renderRange = LazyRenderList.getVisibleRangeFromProps(props).expand(OVERFLOW_ITEMS);
        this.state = {renderRange};
    }

    static getVisibleRangeFromProps(props) {
        const {items, itemHeight, scrollTop, height} = props;
        const length = items ? items.length : 0;
        const topCount = Math.max(0, Math.floor(scrollTop / itemHeight));
        const itemsAfterTop = length - topCount;
        const renderCount = Math.min(Math.ceil(height / itemHeight), itemsAfterTop);
        const bottomCount = itemsAfterTop - renderCount;
        return new ItemRange(topCount, renderCount, bottomCount);
    }

    componentWillReceiveProps(props) {
        const state = this.state;
        const range = LazyRenderList.getVisibleRangeFromProps(props);
        const intersectRange = range.expand(OVERFLOW_MARGIN);

        const prevSize = this.props.items ? this.props.items.length : 0;
        const listHasChangedSize = props.items.length !== prevSize;
        // only update renderRange if the list has shrunk/grown and we need to adjust padding or
        // if the new range isn't contained by the old anymore
        if (listHasChangedSize || !state.renderRange || !state.renderRange.contains(intersectRange)) {
            this.setState({renderRange: range.expand(OVERFLOW_ITEMS)});
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        const itemsChanged = nextProps.items !== this.props.items;
        const rangeChanged = nextState.renderRange !== this.state.renderRange;
        return itemsChanged || rangeChanged;
    }

    render() {
        const {itemHeight, items, renderItem} = this.props;

        const {renderRange} = this.state;
        const paddingTop = renderRange.topCount * itemHeight;
        const paddingBottom = renderRange.bottomCount * itemHeight;
        const renderedItems = (items || []).slice(
            renderRange.topCount,
            renderRange.topCount + renderRange.renderCount,
        );

        return (<div style={{paddingTop: `${paddingTop}px`, paddingBottom: `${paddingBottom}px`}}>
            { renderedItems.map(renderItem) }
        </div>);
    }
}
