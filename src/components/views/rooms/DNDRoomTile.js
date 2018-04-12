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
import RoomTile from '../../../components/views/rooms/RoomTile';

import classNames from 'classnames';

export default class DNDRoomTile extends React.PureComponent {
    constructor() {
        super();
        this.getClassName = this.getClassName.bind(this);
    }

    getClassName(isDragging) {
        return classNames({
            "mx_DNDRoomTile": true,
            "mx_DNDRoomTile_dragging": isDragging,
        });
    }

    render() {
        const props = this.props;

        return <div>
            <Draggable
                key={props.room.roomId}
                draggableId={props.tagName + '_' + props.room.roomId}
                index={props.index}
                type="draggable-RoomTile"
            >
                { (provided, snapshot) => {
                    return (
                        <div>
                            <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                            >
                                <div className={this.getClassName(snapshot.isDragging)}>
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
