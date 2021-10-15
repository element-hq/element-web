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
import { Room } from 'matrix-js-sdk/src/models/room';
import { _t, _td } from '../../../languageHandler';
import AppTile from '../elements/AppTile';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import dis from '../../../dispatcher/dispatcher';
import AccessibleButton from '../elements/AccessibleButton';
import WidgetUtils, { IWidgetEvent } from '../../../utils/WidgetUtils';
import PersistedElement from "../elements/PersistedElement";
import { IntegrationManagers } from "../../../integrations/IntegrationManagers";
import SettingsStore from "../../../settings/SettingsStore";
import { ChevronFace, ContextMenu } from "../../structures/ContextMenu";
import { WidgetType } from "../../../widgets/WidgetType";
import { Action } from "../../../dispatcher/actions";
import { WidgetMessagingStore } from "../../../stores/widgets/WidgetMessagingStore";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { ActionPayload } from '../../../dispatcher/payloads';
import ScalarAuthClient from '../../../ScalarAuthClient';
import GenericElementContextMenu from "../context_menus/GenericElementContextMenu";
import { IApp } from "../../../stores/WidgetStore";

import { logger } from "matrix-js-sdk/src/logger";

// This should be below the dialog level (4000), but above the rest of the UI (1000-2000).
// We sit in a context menu, so this should be given to the context menu.
const STICKERPICKER_Z_INDEX = 3500;

// Key to store the widget's AppTile under in PersistedElement
const PERSISTED_ELEMENT_KEY = "stickerPicker";

interface IProps {
    room: Room;
    showStickers: boolean;
    menuPosition?: any;
    setShowStickers: (showStickers: boolean) => void;
}

interface IState {
    imError: string;
    stickerpickerX: number;
    stickerpickerY: number;
    stickerpickerChevronOffset?: number;
    stickerpickerWidget: IWidgetEvent;
    widgetId: string;
}

@replaceableComponent("views.rooms.Stickerpicker")
export default class Stickerpicker extends React.PureComponent<IProps, IState> {
    static currentWidget;

    private dispatcherRef: string;

    private prevSentVisibility: boolean;

    private popoverWidth = 300;
    private popoverHeight = 300;
    // This is loaded by _acquireScalarClient on an as-needed basis.
    private scalarClient: ScalarAuthClient = null;

    constructor(props: IProps) {
        super(props);
        this.state = {
            imError: null,
            stickerpickerX: null,
            stickerpickerY: null,
            stickerpickerWidget: null,
            widgetId: null,
        };
    }

    private acquireScalarClient(): Promise<void | ScalarAuthClient> {
        if (this.scalarClient) return Promise.resolve(this.scalarClient);
        // TODO: Pick the right manager for the widget
        if (IntegrationManagers.sharedInstance().hasManager()) {
            this.scalarClient = IntegrationManagers.sharedInstance().getPrimaryManager().getScalarClient();
            return this.scalarClient.connect().then(() => {
                this.forceUpdate();
                return this.scalarClient;
            }).catch((e) => {
                this.imError(_td("Failed to connect to integration manager"), e);
            });
        } else {
            IntegrationManagers.sharedInstance().openNoManagerDialog();
        }
    }

    private removeStickerpickerWidgets = async (): Promise<void> => {
        const scalarClient = await this.acquireScalarClient();
        logger.log('Removing Stickerpicker widgets');
        if (this.state.widgetId) {
            if (scalarClient) {
                scalarClient.disableWidgetAssets(WidgetType.STICKERPICKER, this.state.widgetId).then(() => {
                    logger.log('Assets disabled');
                }).catch((err) => {
                    logger.error('Failed to disable assets');
                });
            } else {
                logger.error("Cannot disable assets: no scalar client");
            }
        } else {
            logger.warn('No widget ID specified, not disabling assets');
        }

        this.props.setShowStickers(false);
        WidgetUtils.removeStickerpickerWidgets().then(() => {
            this.forceUpdate();
        }).catch((e) => {
            logger.error('Failed to remove sticker picker widget', e);
        });
    };

    public componentDidMount(): void {
        // Close the sticker picker when the window resizes
        window.addEventListener('resize', this.onResize);

        this.dispatcherRef = dis.register(this.onWidgetAction);

        // Track updates to widget state in account data
        MatrixClientPeg.get().on('accountData', this.updateWidget);

        // Initialise widget state from current account data
        this.updateWidget();
    }

    public componentWillUnmount(): void {
        const client = MatrixClientPeg.get();
        if (client) client.removeListener('accountData', this.updateWidget);

        window.removeEventListener('resize', this.onResize);
        if (this.dispatcherRef) {
            dis.unregister(this.dispatcherRef);
        }
    }

    public componentDidUpdate(prevProps: IProps, prevState: IState): void {
        this.sendVisibilityToWidget(this.props.showStickers);
    }

    private imError(errorMsg: string, e: Error): void {
        logger.error(errorMsg, e);
        this.setState({
            imError: _t(errorMsg),
        });
        this.props.setShowStickers(false);
    }

    private updateWidget = (): void => {
        const stickerpickerWidget = WidgetUtils.getStickerpickerWidgets()[0];
        if (!stickerpickerWidget) {
            Stickerpicker.currentWidget = null;
            this.setState({ stickerpickerWidget: null, widgetId: null });
            return;
        }

        const currentWidget = Stickerpicker.currentWidget;
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

        Stickerpicker.currentWidget = stickerpickerWidget;
        this.setState({
            stickerpickerWidget,
            widgetId: stickerpickerWidget ? stickerpickerWidget.id : null,
        });
    };

    private onWidgetAction = (payload: ActionPayload): void => {
        switch (payload.action) {
            case "user_widget_updated":
                this.forceUpdate();
                break;
            case "stickerpicker_close":
                this.props.setShowStickers(false);
                break;
            case Action.AfterRightPanelPhaseChange:
            case "show_left_panel":
            case "hide_left_panel":
                this.props.setShowStickers(false);
                break;
        }
    };

    private defaultStickerpickerContent(): JSX.Element {
        return (
            <AccessibleButton onClick={this.launchManageIntegrations}
                className='mx_Stickers_contentPlaceholder'>
                <p>{ _t("You don't currently have any stickerpacks enabled") }</p>
                <p className='mx_Stickers_addLink'>{ _t("Add some now") }</p>
                <img src={require("../../../../res/img/stickerpack-placeholder.png")} alt="" />
            </AccessibleButton>
        );
    }

    private errorStickerpickerContent(): JSX.Element {
        return (
            <div style={{ textAlign: "center" }} className="error">
                <p> { this.state.imError } </p>
            </div>
        );
    }

    private sendVisibilityToWidget(visible: boolean): void {
        if (!this.state.stickerpickerWidget) return;
        const messaging = WidgetMessagingStore.instance.getMessagingForId(this.state.stickerpickerWidget.id);
        if (messaging && visible !== this.prevSentVisibility) {
            messaging.updateVisibility(visible).catch(err => {
                logger.error("Error updating widget visibility: ", err);
            });
            this.prevSentVisibility = visible;
        }
    }

    public getStickerpickerContent(): JSX.Element {
        // Handle integration manager errors
        if (this.state.imError) {
            return this.errorStickerpickerContent();
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

        // Load stickerpack content
        if (stickerpickerWidget && stickerpickerWidget.content && stickerpickerWidget.content.url) {
            // Set default name
            stickerpickerWidget.content.name = stickerpickerWidget.content.name || _t("Stickerpack");

            // FIXME: could this use the same code as other apps?
            const stickerApp: IApp = {
                id: stickerpickerWidget.id,
                url: stickerpickerWidget.content.url,
                name: stickerpickerWidget.content.name,
                type: stickerpickerWidget.content.type,
                data: stickerpickerWidget.content.data,
                roomId: stickerpickerWidget.content.roomId,
                eventId: stickerpickerWidget.content.eventId,
                avatar_url: stickerpickerWidget.content.avatar_url,
                creatorUserId: stickerpickerWidget.content.creatorUserId,
            };

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
                        <PersistedElement persistKey={PERSISTED_ELEMENT_KEY} zIndex={STICKERPICKER_Z_INDEX}>
                            <AppTile
                                app={stickerApp}
                                room={this.props.room}
                                fullWidth={true}
                                userId={MatrixClientPeg.get().credentials.userId}
                                creatorUserId={stickerpickerWidget.sender || MatrixClientPeg.get().credentials.userId}
                                waitForIframeLoad={true}
                                showMenubar={true}
                                onEditClick={this.launchManageIntegrations}
                                onDeleteClick={this.removeStickerpickerWidgets}
                                showTitle={false}
                                showPopout={false}
                                handleMinimisePointerEvents={true}
                                userWidget={true}
                            />
                        </PersistedElement>
                    </div>
                </div>
            );
        } else {
            // Default content to show if stickerpicker widget not added
            stickersContent = this.defaultStickerpickerContent();
        }
        return stickersContent;
    }

    // Dev note: this isn't jsdoc because it's angry.
    /*
     * Show the sticker picker overlay
     * If no stickerpacks have been added, show a link to the integration manager add sticker packs page.
     */
    private onShowStickersClick = (e: React.MouseEvent<HTMLElement>): void => {
        if (!SettingsStore.getValue("integrationProvisioning")) {
            // Intercept this case and spawn a warning.
            return IntegrationManagers.sharedInstance().showDisabledDialog();
        }

        // XXX: Simplify by using a context menu that is positioned relative to the sticker picker button

        const buttonRect = e.currentTarget.getBoundingClientRect();

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
        //  (2 = context menu borders)
        const stickerpickerChevronOffset = Math.max(10, 2 + window.pageXOffset + buttonRect.left - x);

        const y = (buttonRect.top + (buttonRect.height / 2) + window.pageYOffset) - 19;

        this.props.setShowStickers(true);
        this.setState({
            stickerpickerX: x,
            stickerpickerY: y,
            stickerpickerChevronOffset,
        });
    };

    /**
     * Called when the window is resized
     */
    private onResize = (): void => {
        if (this.props.showStickers) {
            this.props.setShowStickers(false);
        }
    };

    /**
     * The stickers picker was hidden
     */
    private onFinished = (): void => {
        if (this.props.showStickers) {
            this.props.setShowStickers(false);
        }
    };

    /**
     * Launch the integration manager on the stickers integration page
     */
    private launchManageIntegrations = (): void => {
        // TODO: Open the right integration manager for the widget
        if (SettingsStore.getValue("feature_many_integration_managers")) {
            IntegrationManagers.sharedInstance().openAll(
                this.props.room,
                `type_${WidgetType.STICKERPICKER.preferred}`,
                this.state.widgetId,
            );
        } else {
            IntegrationManagers.sharedInstance().getPrimaryManager().open(
                this.props.room,
                `type_${WidgetType.STICKERPICKER.preferred}`,
                this.state.widgetId,
            );
        }
    };

    public render(): JSX.Element {
        if (!this.props.showStickers) return null;

        return <ContextMenu
            chevronOffset={this.state.stickerpickerChevronOffset}
            chevronFace={ChevronFace.Bottom}
            left={this.state.stickerpickerX}
            top={this.state.stickerpickerY}
            menuWidth={this.popoverWidth}
            menuHeight={this.popoverHeight}
            onFinished={this.onFinished}
            menuPaddingTop={0}
            menuPaddingLeft={0}
            menuPaddingRight={0}
            zIndex={STICKERPICKER_Z_INDEX}
            {...this.props.menuPosition}
        >
            <GenericElementContextMenu element={this.getStickerpickerContent()} onResize={this.onFinished} />
        </ContextMenu>;
    }
}
