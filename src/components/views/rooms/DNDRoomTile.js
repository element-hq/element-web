/*
Copyright 2015, 2016 OpenMarket Ltd

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

import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import RoomTile from 'matrix-react-sdk/lib/components/views/rooms/RoomTile';

export default class DNDRoomTile extends React.Component {
    constructor() {
        super();
        this.getStyle = this.getStyle.bind(this);
    }

    getStyle(isDragging) {
        const result = {
            transform: isDragging ? "scale(1.05, 1.05)" : "none",
            transition: "transform 0.2s",
        };
        return result;
    }

    render() {
        const props = this.props;

        return <div>
            <Draggable
                key={props.room.roomId}
                draggableId={props.tagName + '_' + props.room.roomId}
                index={props.index}
            >
                { (provided, snapshot) => {
                    return (
                        <div>
                            <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                            >
                                <div style={this.getStyle(snapshot.isDragging)}>
                                    <RoomTile {...props} />
                                </div>
                            </div>
                            { provided.placeholder }
                        </div>
                    );
                } }
            </Draggable>
        </div>;
    }
}
