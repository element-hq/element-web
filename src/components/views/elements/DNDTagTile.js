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
import { ContextMenu, toRightOf, useContextMenu } from "../../structures/ContextMenu";
import * as sdk from '../../../index';

export default function DNDTagTile(props) {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu();

    let contextMenu = null;
    if (menuDisplayed && handle.current) {
        const elementRect = handle.current.getBoundingClientRect();
        const TagTileContextMenu = sdk.getComponent('context_menus.TagTileContextMenu');
        contextMenu = (
            <ContextMenu {...toRightOf(elementRect)} onFinished={closeMenu}>
                <TagTileContextMenu tag={props.tag} onFinished={closeMenu} />
            </ContextMenu>
        );
    }
    return <div>
        <Draggable
            key={props.tag}
            draggableId={props.tag}
            index={props.index}
            type="draggable-TagTile"
        >
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                >
                    <TagTile
                        {...props}
                        contextMenuButtonRef={handle}
                        menuDisplayed={menuDisplayed}
                        openMenu={openMenu}
                    />
                </div>
            )}
        </Draggable>
        {contextMenu}
    </div>;
}
