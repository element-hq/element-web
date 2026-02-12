/*
Copyright 2018-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type Room, ClientEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { type IWidget } from "matrix-widget-api";

import { _t, _td } from "../../../languageHandler";
import AppTile from "../elements/AppTile";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";
import AccessibleButton from "../elements/AccessibleButton";
import WidgetUtils, { type UserWidget } from "../../../utils/WidgetUtils";
import PersistedElement from "../elements/PersistedElement";
import { IntegrationManagers } from "../../../integrations/IntegrationManagers";
import ContextMenu, { ChevronFace } from "../../structures/ContextMenu";
import { WidgetType } from "../../../widgets/WidgetType";
import { WidgetMessagingStore } from "../../../stores/widgets/WidgetMessagingStore";
import { type ActionPayload } from "../../../dispatcher/payloads";
import type ScalarAuthClient from "../../../ScalarAuthClient";
import GenericElementContextMenu from "../context_menus/GenericElementContextMenu";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";

// This should be below the dialog level (4000), but above the rest of the UI (1000-2000).
// We sit in a context menu, so this should be given to the context menu.
const STICKERPICKER_Z_INDEX = 3500;

// Key to store the widget's AppTile under in PersistedElement
const PERSISTED_ELEMENT_KEY = "stickerPicker";

// Minimum size in pixels sticker picker is allowed to be
const PICKER_MIN_SIZE = 250;
const PICKER_DEFAULT_SIZE = 300;

interface IProps {
    room: Room;
    threadId?: string | null;
    isStickerPickerOpen: boolean;
    menuPosition?: any;
    setStickerPickerOpen: (isStickerPickerOpen: boolean) => void;
}

interface IState {
    imError: string | null;
    stickerpickerWidget: UserWidget | null;
    widgetId: string | null;
    popoverWidth: number;
    popoverHeight: number;
}

export default class Stickerpicker extends React.PureComponent<IProps, IState> {
    public static defaultProps: Partial<IProps> = {
        threadId: null,
    };

    public static currentWidget?: UserWidget;

    private dispatcherRef?: string;

    private prevSentVisibility?: boolean;

    // This is loaded by _acquireScalarClient on an as-needed basis.
    private scalarClient: ScalarAuthClient | null = null;

    public constructor(props: IProps) {
        super(props);
        this.state = {
            imError: null,
            stickerpickerWidget: null,
            widgetId: null,
            popoverWidth: PICKER_DEFAULT_SIZE,
            popoverHeight: PICKER_DEFAULT_SIZE,
        };
    }

    // fields used during resize drag
    private resizeStartX?: number;
    private resizeStartY?: number;
    private resizeStartWidth?: number;
    private resizeStartHeight?: number;

    private async acquireScalarClient(): Promise<void | undefined | null | ScalarAuthClient> {
        if (this.scalarClient) return Promise.resolve(this.scalarClient);
        // TODO: Pick the right manager for the widget
        if (IntegrationManagers.sharedInstance().hasManager()) {
            this.scalarClient = IntegrationManagers.sharedInstance().getPrimaryManager()?.getScalarClient() ?? null;
            return this.scalarClient
                ?.connect()
                .then(() => {
                    this.forceUpdate();
                    return this.scalarClient;
                })
                .catch((e) => {
                    this.imError(_td("integration_manager|error_connecting_heading"), e);
                });
        } else {
            IntegrationManagers.sharedInstance().openNoManagerDialog();
        }
    }

    private removeStickerpickerWidgets = async (): Promise<void> => {
        const scalarClient = await this.acquireScalarClient();
        logger.log("Removing Stickerpicker widgets");
        if (this.state.widgetId) {
            if (scalarClient) {
                scalarClient
                    .disableWidgetAssets(WidgetType.STICKERPICKER, this.state.widgetId)
                    .then(() => {
                        logger.log("Assets disabled");
                    })
                    .catch(() => {
                        logger.error("Failed to disable assets");
                    });
            } else {
                logger.error("Cannot disable assets: no scalar client");
            }
        } else {
            logger.warn("No widget ID specified, not disabling assets");
        }

        this.props.setStickerPickerOpen(false);
        WidgetUtils.removeStickerpickerWidgets(this.props.room.client)
            .then(() => {
                this.forceUpdate();
            })
            .catch((e) => {
                logger.error("Failed to remove sticker picker widget", e);
            });
    };

    public componentDidMount(): void {
        // Close the sticker picker when the window resizes
        window.addEventListener("resize", this.onResize);

        this.dispatcherRef = dis.register(this.onAction);

        // Track updates to widget state in account data
        MatrixClientPeg.safeGet().on(ClientEvent.AccountData, this.updateWidget);

        RightPanelStore.instance.on(UPDATE_EVENT, this.onRightPanelStoreUpdate);

        let pickerWidth = parseInt(window.localStorage.getItem("mx_stickerpicker_width")!, 10);
        let pickerHeight = parseInt(window.localStorage.getItem("mx_stickerpicker_height")!, 10);
        // If the user has not set a size, or if the size is less than the minimum width,
        // set a default size.
        if (isNaN(pickerWidth) || pickerWidth < PICKER_MIN_SIZE) {
            pickerWidth = PICKER_DEFAULT_SIZE;
        }
        if (isNaN(pickerHeight) || pickerHeight < PICKER_MIN_SIZE) {
            pickerHeight = PICKER_DEFAULT_SIZE;
        }
        this.setState({ popoverWidth: pickerWidth, popoverHeight: pickerHeight });

        // Initialise widget state from current account data
        this.updateWidget();
    }

    public componentWillUnmount(): void {
        const client = MatrixClientPeg.get();
        if (client) client.removeListener(ClientEvent.AccountData, this.updateWidget);
        RightPanelStore.instance.off(UPDATE_EVENT, this.onRightPanelStoreUpdate);
        window.removeEventListener("resize", this.onResize);
        // clean up any possible document-level resize listeners
        document.removeEventListener("mousemove", this.onResizeHandleMouseMove as any);
        document.removeEventListener("mouseup", this.onResizeHandleMouseUp as any);
        document.removeEventListener("touchmove", this.onResizeHandleTouchMove as any);
        document.removeEventListener("touchend", this.onResizeHandleTouchEnd as any);
        dis.unregister(this.dispatcherRef);
    }

    public componentDidUpdate(): void {
        this.sendVisibilityToWidget(this.props.isStickerPickerOpen);
    }

    private imError(errorMsg: TranslationKey, e: Error): void {
        logger.error(errorMsg, e);
        this.setState({
            imError: _t(errorMsg),
        });
        this.props.setStickerPickerOpen(false);
    }

    private updateWidget = (): void => {
        const stickerpickerWidget = WidgetUtils.getStickerpickerWidgets(this.props.room.client)[0];
        if (!stickerpickerWidget) {
            Stickerpicker.currentWidget = undefined;
            this.setState({ stickerpickerWidget: null, widgetId: null });
            return;
        }

        const currentWidget = Stickerpicker.currentWidget;
        const currentUrl = currentWidget?.content?.url ?? null;
        const newUrl = stickerpickerWidget?.content?.url ?? null;

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

    private onAction = (payload: ActionPayload): void => {
        switch (payload.action) {
            case "user_widget_updated":
                this.forceUpdate();
                break;
            case "stickerpicker_close":
                this.props.setStickerPickerOpen(false);
                break;
            case "show_left_panel":
            case "hide_left_panel":
                this.props.setStickerPickerOpen(false);
                break;
        }
    };

    private onRightPanelStoreUpdate = (): void => {
        this.props.setStickerPickerOpen(false);
    };

    private defaultStickerpickerContent(): JSX.Element {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const imgSrc = require("../../../../res/img/stickerpack-placeholder.png");
        return (
            <AccessibleButton onClick={this.launchManageIntegrations} className="mx_Stickers_contentPlaceholder">
                <p>{_t("stickers|empty")}</p>
                <p className="mx_Stickers_addLink">{_t("stickers|empty_add_prompt")}</p>
                <img src={imgSrc} alt="" />
            </AccessibleButton>
        );
    }

    private errorStickerpickerContent(): JSX.Element {
        return (
            <div style={{ textAlign: "center" }} className="error">
                <p> {this.state.imError} </p>
            </div>
        );
    }

    private sendVisibilityToWidget(visible: boolean): void {
        if (!this.state.stickerpickerWidget) return;
        const messaging = WidgetMessagingStore.instance.getMessagingForUid(
            WidgetUtils.calcWidgetUid(this.state.stickerpickerWidget.id),
        );
        if (messaging?.widgetApi && visible !== this.prevSentVisibility) {
            messaging.widgetApi.updateVisibility(visible).catch((err) => {
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
        let stickersContent: JSX.Element | undefined;

        // Use a separate ReactDOM tree to render the AppTile separately so that it persists and does
        // not unmount when we (a) close the sticker picker (b) switch rooms. It's properties are still
        // updated.

        // Load stickerpack content
        if (!!stickerpickerWidget?.content?.url) {
            // Set default name
            stickerpickerWidget.content.name = stickerpickerWidget.content.name || _t("common|stickerpack");

            // FIXME: could this use the same code as other apps?
            const stickerApp: IWidget = {
                id: stickerpickerWidget.id,
                url: stickerpickerWidget.content.url,
                name: stickerpickerWidget.content.name,
                type: stickerpickerWidget.content.type,
                data: stickerpickerWidget.content.data,
                creatorUserId: stickerpickerWidget.content.creatorUserId || stickerpickerWidget.sender,
            };

            stickersContent = (
                <div className="mx_Stickers_content_container">
                    <div
                        id="stickersContent"
                        className="mx_Stickers_content"
                        style={{
                            border: "none",
                            height: this.state.popoverHeight,
                            width: this.state.popoverWidth,
                        }}
                    >
                        <PersistedElement persistKey={PERSISTED_ELEMENT_KEY} zIndex={STICKERPICKER_Z_INDEX}>
                            <AppTile
                                app={stickerApp}
                                room={this.props.room}
                                threadId={this.props.threadId}
                                fullWidth={true}
                                userId={MatrixClientPeg.safeGet().credentials.userId!}
                                creatorUserId={
                                    stickerpickerWidget.sender || MatrixClientPeg.safeGet().credentials.userId!
                                }
                                waitForIframeLoad={true}
                                showMenubar={true}
                                onEditClick={this.launchManageIntegrations}
                                onDeleteClick={this.removeStickerpickerWidgets}
                                showTitle={false}
                                showPopout={false}
                                handleMinimisePointerEvents={true}
                                userWidget={true}
                                showLayoutButtons={false}
                            />
                            <div
                                className="mx_Stickers_resizeHandle"
                                onMouseDown={this.onResizeHandleMouseDown}
                                onTouchStart={this.onResizeHandleTouchStart}
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

    /**
     * Called when the window is resized
     */
    private onResize = (): void => {
        if (this.props.isStickerPickerOpen) {
            this.props.setStickerPickerOpen(false);
        }
    };

    private handleResizeStart = (x: number, y: number): void => {
        this.resizeStartX = x;
        this.resizeStartY = y;
        this.resizeStartWidth = this.state.popoverWidth;
        this.resizeStartHeight = this.state.popoverHeight;
    };
    private handleResizeMove = (x: number, y: number): void => {
        if (this.resizeStartX === undefined || this.resizeStartY === undefined) return;
        const dx = this.resizeStartX - x;
        const dy = this.resizeStartY - y;
        const newW = Math.max(PICKER_MIN_SIZE, (this.resizeStartWidth || PICKER_DEFAULT_SIZE) + dx);
        const newH = Math.max(PICKER_MIN_SIZE, (this.resizeStartHeight || PICKER_DEFAULT_SIZE) + dy);
        this.setState({ popoverWidth: newW, popoverHeight: newH });
    };
    private handleResizeEnd = (): void => {
        this.resizeStartX = undefined;
        this.resizeStartY = undefined;

        window.localStorage.setItem("mx_stickerpicker_width", this.state.popoverWidth.toString());
        window.localStorage.setItem("mx_stickerpicker_height", this.state.popoverHeight.toString());
    };

    private onResizeHandleMouseDown = (ev: React.MouseEvent): void => {
        ev.preventDefault();
        this.handleResizeStart(ev.clientX, ev.clientY);
        document.addEventListener("mousemove", this.onResizeHandleMouseMove as any);
        document.addEventListener("mouseup", this.onResizeHandleMouseUp as any);
    };

    private onResizeHandleTouchStart = (ev: React.TouchEvent): void => {
        ev.preventDefault();
        const t = ev.touches[0];
        this.handleResizeStart(t.clientX, t.clientY);
        document.addEventListener("touchmove", this.onResizeHandleTouchMove as any, { passive: false } as any);
        document.addEventListener("touchend", this.onResizeHandleTouchEnd as any);
    };

    private onResizeHandleMouseMove = (ev: MouseEvent): void => {
        this.handleResizeMove(ev.clientX, ev.clientY);
    };

    private onResizeHandleTouchMove = (ev: TouchEvent): void => {
        ev.preventDefault();
        const t = ev.touches[0];
        this.handleResizeMove(t.clientX, t.clientY);
    };

    private onResizeHandleMouseUp = (): void => {
        document.removeEventListener("mousemove", this.onResizeHandleMouseMove as any);
        document.removeEventListener("mouseup", this.onResizeHandleMouseUp as any);
        this.handleResizeEnd();
    };

    private onResizeHandleTouchEnd = (): void => {
        document.removeEventListener("touchmove", this.onResizeHandleTouchMove as any);
        document.removeEventListener("touchend", this.onResizeHandleTouchEnd as any);
        this.handleResizeEnd();
    };

    /**
     * The stickers picker was hidden
     */
    private onFinished = (): void => {
        if (this.props.isStickerPickerOpen) {
            this.props.setStickerPickerOpen(false);
        }
    };

    /**
     * Launch the integration manager on the stickers integration page
     */
    private launchManageIntegrations = (): void => {
        // noinspection JSIgnoredPromiseFromCall
        IntegrationManagers.sharedInstance()
            ?.getPrimaryManager()
            ?.open(this.props.room, `type_${WidgetType.STICKERPICKER.preferred}`, this.state.widgetId ?? undefined);
    };

    public render(): React.ReactNode {
        if (!this.props.isStickerPickerOpen) return null;

        return (
            <ContextMenu
                chevronFace={ChevronFace.Bottom}
                menuWidth={this.state.popoverWidth}
                menuHeight={this.state.popoverHeight}
                onFinished={this.onFinished}
                menuPaddingTop={0}
                menuPaddingLeft={0}
                menuPaddingRight={0}
                zIndex={STICKERPICKER_Z_INDEX}
                mountAsChild={true}
                {...this.props.menuPosition}
            >
                <GenericElementContextMenu element={this.getStickerpickerContent()} onResize={this.onFinished} />
            </ContextMenu>
        );
    }
}
