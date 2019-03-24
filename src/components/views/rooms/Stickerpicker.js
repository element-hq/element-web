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
import { _t } from '../../../languageHandler';
import AppTile from '../elements/AppTile';
import MatrixClientPeg from '../../../MatrixClientPeg';
import Modal from '../../../Modal';
import sdk from '../../../index';
import SdkConfig from '../../../SdkConfig';
import ScalarAuthClient from '../../../ScalarAuthClient';
import dis from '../../../dispatcher';
import AccessibleButton from '../elements/AccessibleButton';
import WidgetUtils from '../../../utils/WidgetUtils';
import ActiveWidgetStore from '../../../stores/ActiveWidgetStore';
import PersistedElement from "../elements/PersistedElement";

const widgetType = 'm.stickerpicker';

// We sit in a context menu, so the persisted element container needs to float
// above it, so it needs a greater z-index than the ContextMenu
const STICKERPICKER_Z_INDEX = 5000;

// Key to store the widget's AppTile under in PersistedElement
const PERSISTED_ELEMENT_KEY = "stickerPicker";

export default class Stickerpicker extends React.Component {
    constructor(props) {
        super(props);
        this._onShowStickersClick = this._onShowStickersClick.bind(this);
        this._onHideStickersClick = this._onHideStickersClick.bind(this);
        this._launchManageIntegrations = this._launchManageIntegrations.bind(this);
        this._removeStickerpickerWidgets = this._removeStickerpickerWidgets.bind(this);
        this._updateWidget = this._updateWidget.bind(this);
        this._onWidgetAction = this._onWidgetAction.bind(this);
        this._onResize = this._onResize.bind(this);
        this._onFinished = this._onFinished.bind(this);

        this.popoverWidth = 300;
        this.popoverHeight = 300;

        this.state = {
            showStickers: false,
            imError: null,
            stickerpickerX: null,
            stickerpickerY: null,
            stickerpickerWidget: null,
            widgetId: null,
        };
    }

    _removeStickerpickerWidgets() {
        console.warn('Removing Stickerpicker widgets');
        if (this.state.widgetId) {
            this.scalarClient.disableWidgetAssets(widgetType, this.state.widgetId).then(() => {
                console.warn('Assets disabled');
            }).catch((err) => {
                console.error('Failed to disable assets');
            });
        } else {
            console.warn('No widget ID specified, not disabling assets');
        }

        this.setState({showStickers: false});
        WidgetUtils.removeStickerpickerWidgets().then(() => {
            this.forceUpdate();
        }).catch((e) => {
            console.error('Failed to remove sticker picker widget', e);
        });
    }

    componentDidMount() {
        // Close the sticker picker when the window resizes
        window.addEventListener('resize', this._onResize);

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
            this.dispatcherRef = dis.register(this._onWidgetAction);
        }

        // Track updates to widget state in account data
        MatrixClientPeg.get().on('accountData', this._updateWidget);

        // Initialise widget state from current account data
        this._updateWidget();
    }

    componentWillUnmount() {
        const client = MatrixClientPeg.get();
        if (client) client.removeListener('accountData', this._updateWidget);

        window.removeEventListener('resize', this._onResize);
        if (this.dispatcherRef) {
            dis.unregister(this.dispatcherRef);
        }
    }

    componentDidUpdate(prevProps, prevState) {
        this._sendVisibilityToWidget(this.state.showStickers);
    }

    _imError(errorMsg, e) {
        console.error(errorMsg, e);
        this.setState({
            showStickers: false,
            imError: errorMsg,
        });
    }

    _updateWidget() {
        const stickerpickerWidget = WidgetUtils.getStickerpickerWidgets()[0];

        const currentWidget = this.state.stickerpickerWidget;
        let currentUrl = null;
        if (currentWidget && currentWidget.content && currentWidget.content.url) {
            currentUrl = currentWidget.content.url;
        }

        let newUrl = null;
        if (stickerpickerWidget && stickerpickerWidget.content && stickerpickerWidget.content.url) {
            newUrl = stickerpickerWidget.content.url;
        }

        if (newUrl !== currentUrl) {
            // Destroy the existing frame so a new one can be created
            PersistedElement.destroyElement(PERSISTED_ELEMENT_KEY);
        }

        this.setState({
            stickerpickerWidget,
            widgetId: stickerpickerWidget ? stickerpickerWidget.id : null,
        });
    }

    _onWidgetAction(payload) {
        switch (payload.action) {
            case "user_widget_updated":
                this.forceUpdate();
                break;
            case "stickerpicker_close":
                this.setState({showStickers: false});
                break;
            case "show_right_panel":
            case "hide_right_panel":
            case "show_left_panel":
            case "hide_left_panel":
                this.setState({showStickers: false});
                break;
        }
    }

    _defaultStickerpickerContent() {
        return (
            <AccessibleButton onClick={this._launchManageIntegrations}
                className='mx_Stickers_contentPlaceholder'>
                <p>{ _t("You don't currently have any stickerpacks enabled") }</p>
                <p className='mx_Stickers_addLink'>{ _t("Add some now") }</p>
                <img src={require("../../../../res/img/stickerpack-placeholder.png")} alt="" />
            </AccessibleButton>
        );
    }

    _errorStickerpickerContent() {
        return (
            <div style={{"text-align": "center"}} className="error">
                <p> { this.state.imError } </p>
            </div>
        );
    }

    _sendVisibilityToWidget(visible) {
        if (!this.state.stickerpickerWidget) return;
        const widgetMessaging = ActiveWidgetStore.getWidgetMessaging(this.state.stickerpickerWidget.id);
        if (widgetMessaging && visible !== this._prevSentVisibility) {
            widgetMessaging.sendVisibility(visible);
            this._prevSentVisibility = visible;
        }
    }

    _getStickerpickerContent() {
        // Handle Integration Manager errors
        if (this.state._imError) {
            return this._errorStickerpickerContent();
        }

        // Stickers
        // TODO - Add support for Stickerpickers from multiple app stores.
        // Render content from multiple stickerpack sources, each within their
        // own iframe, within the stickerpicker UI element.
        const stickerpickerWidget = this.state.stickerpickerWidget;
        let stickersContent;

        // Use a separate ReactDOM tree to render the AppTile separately so that it persists and does
        // not unmount when we (a) close the sticker picker (b) switch rooms. It's properties are still
        // updated.
        const PersistedElement = sdk.getComponent("elements.PersistedElement");

        // Load stickerpack content
        if (stickerpickerWidget && stickerpickerWidget.content && stickerpickerWidget.content.url) {
            // Set default name
            stickerpickerWidget.content.name = stickerpickerWidget.name || _t("Stickerpack");

            stickersContent = (
                <div className='mx_Stickers_content_container'>
                    <div
                        id='stickersContent'
                        className='mx_Stickers_content'
                        style={{
                            border: 'none',
                            height: this.popoverHeight,
                            width: this.popoverWidth,
                        }}
                    >
                    <PersistedElement persistKey={PERSISTED_ELEMENT_KEY} style={{zIndex: STICKERPICKER_Z_INDEX}}>
                        <AppTile
                            id={stickerpickerWidget.id}
                            url={stickerpickerWidget.content.url}
                            name={stickerpickerWidget.content.name}
                            room={this.props.room}
                            type={stickerpickerWidget.content.type}
                            fullWidth={true}
                            userId={MatrixClientPeg.get().credentials.userId}
                            creatorUserId={stickerpickerWidget.sender || MatrixClientPeg.get().credentials.userId}
                            waitForIframeLoad={true}
                            show={true}
                            showMenubar={true}
                            onEditClick={this._launchManageIntegrations}
                            onDeleteClick={this._removeStickerpickerWidgets}
                            showTitle={false}
                            showMinimise={true}
                            showDelete={false}
                            showCancel={false}
                            showPopout={false}
                            onMinimiseClick={this._onHideStickersClick}
                            handleMinimisePointerEvents={true}
                            whitelistCapabilities={['m.sticker', 'visibility']}
                            userWidget={true}
                        />
                    </PersistedElement>
                    </div>
                </div>
            );
        } else {
            // Default content to show if stickerpicker widget not added
            stickersContent = this._defaultStickerpickerContent();
        }
        return stickersContent;
    }

    /**
     * Show the sticker picker overlay
     * If no stickerpacks have been added, show a link to the integration manager add sticker packs page.
     * @param  {Event} e Event that triggered the function
     */
    _onShowStickersClick(e) {
        // XXX: Simplify by using a context menu that is positioned relative to the sticker picker button

        const buttonRect = e.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        let x = buttonRect.right + window.pageXOffset - 41;

        // Amount of horizontal space between the right of menu and the right of the viewport
        //  (10 = amount needed to make chevron centrally aligned)
        const rightPad = 10;

        // When the sticker picker would be displayed off of the viewport, adjust x
        //  (302 = width of context menu, including borders)
        x = Math.min(x, document.body.clientWidth - (302 + rightPad));

        // Offset the chevron location, which is relative to the left of the context menu
        //  (10 = offset when context menu would not be displayed off viewport)
        //  (8 = value required in practice (possibly 10 - 2 where the 2 = context menu borders)
        const stickerPickerChevronOffset = Math.max(10, 8 + window.pageXOffset + buttonRect.left - x);

        const y = (buttonRect.top + (buttonRect.height / 2) + window.pageYOffset) - 19;

        this.setState({
            showStickers: true,
            stickerPickerX: x,
            stickerPickerY: y,
            stickerPickerChevronOffset,
        });
    }

    /**
     * Trigger hiding of the sticker picker overlay
     * @param  {Event} ev Event that triggered the function call
     */
    _onHideStickersClick(ev) {
        this.setState({showStickers: false});
    }

    /**
     * Called when the window is resized
     */
    _onResize() {
        this.setState({showStickers: false});
    }

    /**
     * The stickers picker was hidden
     */
    _onFinished() {
        this.setState({showStickers: false});
    }

    /**
     * Launch the integrations manager on the stickers integration page
     */
    _launchManageIntegrations() {
        const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
        this.scalarClient.connect().done(() => {
            const src = (this.scalarClient !== null && this.scalarClient.hasCredentials()) ?
                this.scalarClient.getScalarInterfaceUrlForRoom(
                    this.props.room,
                    'type_' + widgetType,
                    this.state.widgetId,
                ) :
                null;
            Modal.createTrackedDialog('Integrations Manager', '', IntegrationsManager, {
                src: src,
            }, "mx_IntegrationsManager");
            this.setState({showStickers: false});
        }, (err) => {
            this.setState({imError: err});
            console.error('Error ensuring a valid scalar_token exists', err);
        });
    }

    render() {
        const ContextualMenu = sdk.getComponent('structures.ContextualMenu');
        const GenericElementContextMenu = sdk.getComponent('context_menus.GenericElementContextMenu');
        let stickersButton;

        const stickerPicker = <ContextualMenu
            elementClass={GenericElementContextMenu}
            chevronOffset={this.state.stickerPickerChevronOffset}
            chevronFace={'bottom'}
            left={this.state.stickerPickerX}
            top={this.state.stickerPickerY}
            menuWidth={this.popoverWidth}
            menuHeight={this.popoverHeight}
            element={this._getStickerpickerContent()}
            onFinished={this._onFinished}
            menuPaddingTop={0}
            menuPaddingLeft={0}
            menuPaddingRight={0}
        />;

        if (this.state.showStickers) {
            // Show hide-stickers button
            stickersButton =
                <AccessibleButton
                    id='stickersButton'
                    key="controls_hide_stickers"
                    className="mx_MessageComposer_button mx_MessageComposer_stickers mx_Stickers_hideStickers"
                    onClick={this._onHideStickersClick}
                    title={_t("Hide Stickers")}
                >
                </AccessibleButton>;
        } else {
            // Show show-stickers button
            stickersButton =
                <AccessibleButton
                    id='stickersButton'
                    key="controls_show_stickers"
                    className="mx_MessageComposer_button mx_MessageComposer_stickers"
                    onClick={this._onShowStickersClick}
                    title={_t("Show Stickers")}
                >
                </AccessibleButton>;
        }
        return <div>
            {stickersButton}
            {this.state.showStickers && stickerPicker}
        </div>;
    }
}
