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
import dis from '../../../dispatcher';

export default class Stickerpicker extends React.Component {
    constructor(props) {
        super(props);
        this.onShowStickersClick = this.onShowStickersClick.bind(this);
        this.onHideStickersClick = this.onHideStickersClick.bind(this);
        this.onFinished = this.onFinished.bind(this);
        this._launchManageIntegrations = this._launchManageIntegrations.bind(this);
        this._removeStickerpickerWidgets = this._removeStickerpickerWidgets.bind(this);
        this._onWidgetAction = this._onWidgetAction.bind(this);

        this.defaultStickersContent = (
            <div className='mx_Stickers_contentPlaceholder'>
                <p>{ _t("You don't currently have any stickerpacks enabled") }</p>
                <p>{ _t("Click") } <span className='mx_Stickers_addLink' onClick={this._launchManageIntegrations} > { _t("here") }</span> { _t("to add some!") }</p>
                <img src='img/stickerpack-placeholder.png' alt={_t('Add a stickerpack')} />
            </div>
        );
        this.popoverWidth = 300;
        this.popoverHeight = 300;

        this.state = {
            stickersContent: this.defaultStickersContent,
            showStickers: false,
            imError: null,
        };
    }

    _removeStickerpickerWidgets() {
        console.warn('Removing Stickerpicker widgets');
        if (this.widgetId) {
            this.scalarClient.disableWidgetAssets('stickerpack', this.widgetId).then(() => {
                console.warn('Assets disabled');
            }).catch((err) => {
                console.error('Failed to disable assets');
            });
        } else {
            console.warn('No widget ID specified, not disabling assets');
        }
        Widgets.removeStickerpickerWidgets();
        this._getStickerPickerWidget();
        setTimeout(() => this.stickersMenu.close());
    }

    componentDidMount() {
        this.scalarClient = null;
        if (SdkConfig.get().integrations_ui_url && SdkConfig.get().integrations_rest_url) {
            this.scalarClient = new ScalarAuthClient();
            this.scalarClient.connect().then(() => {
                this.forceUpdate();
            }).catch((e) => {
                this._imError("Failed to connect to integrations server", e);
            });
        }

        if (!this.state.imError) {
            this._getStickerPickerWidget();
            this.dispatcherRef = dis.register(this._onWidgetAction);
        }
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
    }

    _imError(errorMsg, e) {
        console.error(errorMsg, e);
        const imErrorContent = <div style={{"text-align": "center"}} className="error"><p> { errorMsg } </p></div>;
        this.setState({
            showStickers: false,
            imError: errorMsg,
            stickersContent: imErrorContent,
        });
    }

    _onWidgetAction(payload) {
        if (payload.action === "user_widget_updated") {
            this._getStickerPickerWidget();
            return;
        } else if (payload.action === "stickerpicker_close") {
          setTimeout(() => this.stickersMenu.close());
        }
    }

    _getStickerPickerWidget() {
        // Stickers
        // TODO - Add support for Stickerpickers from multiple app stores.
        // Render content from multiple stickerpack sources, each within their own iframe, within the stickerpicker UI element.
        const stickerpickerWidget = Widgets.getStickerpickerWidgets()[0];
        let stickersContent;

        // Load stickerpack content
        if (stickerpickerWidget && stickerpickerWidget.content && stickerpickerWidget.content.url) {
            // Set default name
            stickerpickerWidget.content.name = stickerpickerWidget.name || "Stickerpack";
            this.widgetId = stickerpickerWidget.id;

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
                            height: this.popoverHeight,
                            width: this.popoverWidth,
                        }}
                    >
                        <AppTile
                            id={stickerpickerWidget.id}
                            url={stickerpickerWidget.content.url}
                            name={stickerpickerWidget.content.name}
                            room={this.props.room}
                            type={stickerpickerWidget.content.type}
                            fullWidth={true}
                            userId={stickerpickerWidget.sender || MatrixClientPeg.get().credentials.userId}
                            creatorUserId={MatrixClientPeg.get().credentials.userId}
                            waitForIframeLoad={true}
                            show={true}
                            showMenubar={true}
                            onEditClick={this._launchManageIntegrations}
                            onDeleteClick={this._removeStickerpickerWidgets}
                            showTitle={false}
                            showMinimise={false}
                        />
                    </div>
                </div>
            );
        } else {
            // Default content to show if stickerpicker widget not added
            console.warn("No available sticker picker widgets");
            stickersContent = this.defaultStickersContent;
            this.widgetId = null;
            this.forceUpdate();
        }
        this.setState({
            showStickers: false,
            stickersContent: stickersContent,
        });
    }

    /**
     * Show the sticker picker overlay
     * If no stickerpacks have been added, show a link to the integration manager add sticker packs page.
     * @param  {Event} e Event that triggered the function
     */
    onShowStickersClick(e) {
        this._getStickerPickerWidget();
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
            menuPaddingTop: 0,
        });


        this.setState({showStickers: true});
    }

    /**
     * Trigger hiding of the sticker picker overlay
     * @param  {Event} ev Event that triggered the function call
     */
    onHideStickersClick(ev) {
        setTimeout(() => this.stickersMenu.close());
    }

    /**
     * The stickers picker was hidden
     */
    onFinished() {
        this.setState({showStickers: false});
    }

    /**
     * Launch the integrations manager on the stickers integration page
     */
    _launchManageIntegrations() {
        const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
        const src = (this.scalarClient !== null && this.scalarClient.hasCredentials()) ?
                this.scalarClient.getScalarInterfaceUrlForRoom(
                    this.props.room,
                    'type_stickerpack',
                    this.widgetId,
                ) :
                null;
        Modal.createTrackedDialog('Integrations Manager', '', IntegrationsManager, {
            src: src,
        }, "mx_IntegrationsManager");

        // Wrap this in a timeout in order to avoid the DOM node from being pulled from under its feet
        setTimeout(() => this.stickersMenu.close());
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
