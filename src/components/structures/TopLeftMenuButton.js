/*
Copyright 2018 New Vector Ltd

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
import PropTypes from 'prop-types';
import sdk from '../../index';
import * as ContextualMenu from './ContextualMenu';
import {TopLeftMenu} from './TopLeftMenu';

export class TopLeftMenuButton extends React.Component {

    static propTypes = {
        collapsed: PropTypes.bool.isRequired,
    };

    static displayName = 'TopLeftMenuButton';

    constructor() {
        super();
        this.state = {
            menuDisplayed: false,
        };
    }

    render() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const avatarHeight = 28;
        const name = "My stuff";

        return (
            <div className="mx_TopLeftMenuButton">
                <BaseAvatar
                    className="mx_TopLeftMenuButton_avatar"
                    name={name}
                    width={avatarHeight}
                    height={avatarHeight}
                />
                <div className="mx_TopLeftMenuButton_name" onClick={this.onToggleMenu}>
                    { name }
                </div>
                <img className="mx_TopLeftMenuButton_chevron" src="img/topleft-chevron.svg" width="11" height="6" />
            </div>
        );
    }

    onToggleMenu(e) {
        e.preventDefault();
        e.stopPropagation();

        const elementRect = e.target.parentElement.getBoundingClientRect();
        const x = elementRect.left;
        const y = elementRect.top + elementRect.height;

        ContextualMenu.createMenu(TopLeftMenu, {
            chevronFace: "none",
            left: x,
            top: y,
            onFinished: () => {
                this.setState({ menuDisplayed: false });
            },
        });
        this.setState({ menuDisplayed: true });
    }
}
