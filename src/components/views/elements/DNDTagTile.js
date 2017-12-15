/* eslint new-cap: "off" */
/*
Copyright 2017 New Vector Ltd.

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

import { DragSource, DropTarget } from 'react-dnd';

import TagTile from './TagTile';
import dis from '../../../dispatcher';
import { findDOMNode } from 'react-dom';

const tagTileSource = {
    canDrag: function(props, monitor) {
        return true;
    },

    beginDrag: function(props) {
        // Return the data describing the dragged item
        return {
            tag: props.tag,
        };
    },

    endDrag: function(props, monitor, component) {
        const dropResult = monitor.getDropResult();
        if (!monitor.didDrop() || !dropResult) {
            return;
        }
        props.onEndDrag();
    },
};

const tagTileTarget = {
    canDrop(props, monitor) {
        return true;
    },

    hover(props, monitor, component) {
        if (!monitor.canDrop()) return;
        const draggedY = monitor.getClientOffset().y;
        const {top, bottom} = findDOMNode(component).getBoundingClientRect();
        const targetY = (top + bottom) / 2;
        dis.dispatch({
            action: 'order_tag',
            tag: monitor.getItem().tag,
            targetTag: props.tag,
            // Note: we indicate that the tag should be after the target when
            // it's being dragged over the top half of the target.
            after: draggedY < targetY,
        });
    },

    drop(props) {
        // Return the data to be returned by getDropResult
        return {
            tag: props.tag,
        };
    },
};

export default
    DropTarget('TagTile', tagTileTarget, (connect, monitor) => ({
        connectDropTarget: connect.dropTarget(),
    }))(DragSource('TagTile', tagTileSource, (connect, monitor) => ({
        connectDragSource: connect.dragSource(),
    }))((props) => {
        const { connectDropTarget, connectDragSource, ...otherProps } = props;
        return connectDropTarget(connectDragSource(
            <div>
                <TagTile {...otherProps} />
            </div>,
        ));
    }));
