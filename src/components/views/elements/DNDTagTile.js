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

import TagTile from './TagTile';

import React from 'react';
import { Draggable } from 'react-beautiful-dnd';

export default function DNDTagTile(props) {
    return <div>
        <Draggable
            key={props.tag}
            draggableId={props.tag}
            index={props.index}
            type="draggable-TagTile"
        >
            { (provided, snapshot) => (
                <div>
                    <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                    >
                        <TagTile {...props} />
                    </div>
                    { provided.placeholder }
                </div>
            ) }
        </Draggable>
    </div>;
}
