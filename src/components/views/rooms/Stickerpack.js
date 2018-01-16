/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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
import { _t } from '../../../languageHandler';
import Widgets from '../../../utils/widgets';
import AppTile from '../elements/AppTile';
import ContextualMenu from '../../structures/ContextualMenu';
import MatrixClientPeg from '../../../MatrixClientPeg';
import sdk from '../../../index';


export default class Stickerpack extends React.Component {
    constructor(props) {
        super(props);
        this.onShowStickersClick = this.onShowStickersClick.bind(this);
        this.onHideStickersClick = this.onHideStickersClick.bind(this);
        this.onFinished = this.onFinished.bind(this);

        this.defaultStickersContent = (
            <div className='mx_StickersContentPlaceholder'>
                <p>You don't currently have any stickerpacks enabled</p>
                <p>Click <a href=''>here</a> to add some!</p>
                <img src='img/stickerpack-placeholder.png' alt='Add a stickerpack' />
            </div>
        );
        this.popoverWidth = 300;
        this.popoverHeight = 300;

        this.state = {
            stickersContent: this.defaultStickersContent,
            showStickers: false,
        };
    }

    onComponentDidMount() {
        // Stickers
        // TODO - Add support for stickerpacks from multiple app stores.
        // Render content from multiple stickerpack sources, each within their own iframe, within the stickerpack UI element.
        const stickerpackWidget = Widgets.getStickerpackWidgets()[0];
        let stickersContent;

        // Load stickerpack content
        if (stickerpackWidget && stickerpackWidget.content && stickerpackWidget.content.url) {
            stickersContent = <div
                id='stickersContent'
                className='mx_StickersContent'
                style={{
                    border: 'none',
                    height: this.popoverHeight,
                    width: this.popoverWidth,
                }}
            >
                <AppTile
                    id={stickerpackWidget.id}
                    url={stickerpackWidget.content.url}
                    name={stickerpackWidget.content.name}
                    room={this.props.room}
                    type={stickerpackWidget.content.type}
                    fullWidth={true}
                    userId={stickerpackWidget.sender || MatrixClientPeg.get().credentials.userId}
                    creatorUserId={MatrixClientPeg.get().credentials.userId}
                    waitForIframeLoad={true}
                    show={true}
                    showMenubar={false}
                />
            </div>;
        } else {
            // Default content to show if stickerpack widget not added
            stickersContent = <p>Click here to add your first sitckerpack</p>;
        }
        this.setState({stickersContent});
    }

    onShowStickersClick(e) {
        const GenericElementContextMenu = sdk.getComponent('context_menus.GenericElementContextMenu');
        const buttonRect = e.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const x = buttonRect.right + window.pageXOffset - 37;
        const y = (buttonRect.top + (buttonRect.height / 2) + window.pageYOffset) - 19;
        // const self = this;
        ContextualMenu.createMenu(GenericElementContextMenu, {
            chevronOffset: 10,
            chevronFace: 'bottom',
            left: x,
            top: y,
            menuWidth: this.popoverWidth,
            menuHeight: this.popoverHeight,
            element: this.state.stickersContent,
            onFinished: this.onFinished,
        });


        this.setState({showStickers: true});
    }

    onHideStickersClick(ev) {
        this.setState({showStickers: false});
    }

    onFinished() {
        this.setState({showStickers: false});
    }

    render() {
        const TintableSvg = sdk.getComponent("elements.TintableSvg");
        let stickersButton;
        if (this.state.showStickers) {
            // Show hide-stickers button
            stickersButton =
                <div
                    id='stickersButton'
                    key="controls_hide_stickers"
                    className="mx_MessageComposer_stickers"
                    onClick={this.onHideStickersClick}
                    ref='target'
                    title={_t("Hide Stickers")}>
                    <TintableSvg src="img/icons-hide-stickers.svg" width="35" height="35" />
                </div>;
        } else {
            // Show show-stickers button
            stickersButton =
                <div
                    id='stickersButton'
                    key="constrols_show_stickers"
                    className="mx_MessageComposer_stickers"
                    onClick={this.onShowStickersClick}
                    title={_t("Show Stickers")}>
                    <TintableSvg src="img/icons-show-stickers.svg" width="35" height="35" />
                </div>;
        }
        return stickersButton;
    }
}
