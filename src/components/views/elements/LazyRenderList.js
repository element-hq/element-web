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

const OVERFLOW_ITEMS = 2;

export default function LazyRenderList(props) {
    const {items, itemHeight, scrollTop, height, renderItem} = props;

    const firstIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - OVERFLOW_ITEMS);
    const itemsAfterFirst = items.length - firstIdx;
    const amount = Math.min(Math.ceil(height / itemHeight) + OVERFLOW_ITEMS, itemsAfterFirst);
    const beforeSpace = firstIdx * itemHeight;
    const itemsAfter = itemsAfterFirst - amount;
    const afterSpace = itemsAfter * itemHeight;
    const renderedItems = items.slice(firstIdx, firstIdx + amount);

    return (<div style={{paddingTop: `${beforeSpace}px`, paddingBottom: `${afterSpace}px`}}>
        { renderedItems.map(renderItem) }
    </div>);
}
