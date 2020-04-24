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

import React, {createRef} from 'react';
import { Draggable } from 'react-beautiful-dnd';
import {ContextMenu, toRightOf} from "../../structures/ContextMenu";
import * as sdk from '../../../index';

export default class DNDTagTile extends React.Component {
    constructor() {
        super();
        this.state = {
            menuDisplayed: false,
        };

        this.openMenu = this.openMenu.bind(this);
        this.closeMenu = this.closeMenu.bind(this);
    }

    componentDidMount() {
        this._contextMenuButton = createRef();
    }

    openMenu() {
        this.setState({
            menuDisplayed: true,
        });
    }

    closeMenu() {
        console.log("Closig menu");
        this.setState({
            menuDisplayed: false,
        });
    }

    getContextMenu() {
        const elementRect = this._contextMenuButton.current.getBoundingClientRect();
        const TagTileContextMenu = sdk.getComponent('context_menus.TagTileContextMenu');
        return (
            <ContextMenu {...toRightOf(elementRect)} onFinished={this.closeMenu}>
                <TagTileContextMenu tag={this.props.tag} onFinished={this.closeMenu} />
            </ContextMenu>
        );
    }

    render(props) {
        return <div>
            <Draggable
                key={this.props.tag}
                draggableId={this.props.tag}
                index={this.props.index}
                type="draggable-TagTile"
            >
                { (provided, snapshot) => (
                    <div>
                        <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                        >
                           <TagTile
                            {...this.props}
                               contextMenuButtonRef= {this._contextMenuButton}
                               menuDisplayed={this.state.menuDisplayed}
                               openMenu={this.openMenu}
                            />
                        </div>
                        { provided.placeholder }
                    </div>
                ) }
            </Draggable>
                    {this.state.menuDisplayed && this.getContextMenu()}
        </div>;
    }
}
