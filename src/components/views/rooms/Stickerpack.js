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
import Modal from '../../../Modal';
import sdk from '../../../index';
import SdkConfig from '../../../SdkConfig';
import ScalarAuthClient from '../../../ScalarAuthClient';


export default class Stickerpack extends React.Component {
    constructor(props) {
        super(props);
        this.onShowStickersClick = this.onShowStickersClick.bind(this);
        this.onHideStickersClick = this.onHideStickersClick.bind(this);
        this.onFinished = this.onFinished.bind(this);
        this._launchManageIntegrations = this._launchManageIntegrations.bind(this);

        this.defaultStickersContent = (
            <div className='mx_Stickers_contentPlaceholder'>
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

    componentDidMount() {
        this.scalarClient = null;
        if (SdkConfig.get().integrations_ui_url && SdkConfig.get().integrations_rest_url) {
            this.scalarClient = new ScalarAuthClient();
            this.scalarClient.connect().then(() => {
                this.forceUpdate();
            }).catch((e) => {
                console.log("Failed to connect to integrations server");
                // TODO -- Handle Scalar errors
                //     this.setState({
                //         scalar_error: err,
                //     });
            });
        }

        // Stickers
        // TODO - Add support for stickerpacks from multiple app stores.
        // Render content from multiple stickerpack sources, each within their own iframe, within the stickerpack UI element.
        const stickerpackWidget = Widgets.getStickerpackWidgets()[0];
        console.warn('Stickerpack widget', stickerpackWidget);
        let stickersContent;

        // Load stickerpack content
        if (stickerpackWidget && stickerpackWidget.content && stickerpackWidget.content.url) {
            this.widgetId = stickerpackWidget.id;
            stickersContent = (
                <div
                    style={{
                        overflow: 'hidden',
                        height: '300px',
                    }}
                >
                    <div
                        id='stickersContent'
                        className='mx_Stickers_content'
                        style={{
                            border: 'none',
                            height: this.popoverHeight - 30,
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
                    </div>
                    <div style={{
                        height: '20px',
                        position: 'absolute',
                        bottom: '5px',
                        right: '19px',
                        width: '263px',
                        textAlign: 'right',
                        padding: '5px',
                        borderTop: '1px solid #999',
                    }}>
                        <span className='mx_Stickers_addLink' onClick={this._launchManageIntegrations} > { _t("Manage sticker packs") } </span>
                    </div>
                </div>
            );
        } else {
            // Default content to show if stickerpack widget not added
            stickersContent = <p>Click here to add your first sitckerpack</p>;
        }
        this.setState({stickersContent});
    }

    /**
     * Show the sticker picker overlay
     * If no stickerpacks have been added, show a link to the integration manager add sticker packs page.
     * @param  {Event} e Event that triggered the function
     */
    onShowStickersClick(e) {
        const GenericElementContextMenu = sdk.getComponent('context_menus.GenericElementContextMenu');
        const buttonRect = e.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const x = buttonRect.right + window.pageXOffset - 37;
        const y = (buttonRect.top + (buttonRect.height / 2) + window.pageYOffset) - 19;
        // const self = this;
        this.stickersMenu = ContextualMenu.createMenu(GenericElementContextMenu, {
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

    /**
     * Trigger hiding of the sticker picker overlay
     * @param  {Event} ev Event that triggered the function call
     */
    onHideStickersClick(ev) {
        this.stickersMenu.close();
    }

    /**
     * The stickers picker was hidden
     */
    onFinished() {
        this.setState({showStickers: false});
        this.stickersMenu = null;
    }

    /**
     * Launch the integrations manager on the stickers integration page
     */
    _launchManageIntegrations() {
        this.onFinished();
        const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
        const src = (this.scalarClient !== null && this.scalarClient.hasCredentials()) ?
                this.scalarClient.getScalarInterfaceUrlForRoom(
                    this.props.room.roomId,
                    'type_stickerpack',
                    this.widgetId,
                ) :
                null;
        Modal.createTrackedDialog('Integrations Manager', '', IntegrationsManager, {
            src: src,
        }, "mx_IntegrationsManager");
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
                    className="mx_MessageComposer_stickers mx_Stickers_hideStickers"
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
