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
import ThemeWatcher from "../../../settings/watchers/ThemeWatcher";
import AppTile from "../elements/AppTile";
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
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import StickerpackPlaceholder from "../../../../res/img/stickerpack-placeholder.png";
import { SDKContext } from "../../../contexts/SDKContext.ts";

// This should be below the dialog level (4000), but above the rest of the UI (1000-2000).
// We sit in a context menu, so this should be given to the context menu.
const STICKERPICKER_Z_INDEX = 3500;

// Key to store the widget's AppTile under in PersistedElement
const PERSISTED_ELEMENT_KEY = "stickerPicker";

export type StickerPickerMode = "stickers" | "gifs";

interface IProps {
    room: Room;
    threadId?: string | null;
    isStickerPickerOpen: boolean;
    stickerPickerMode: StickerPickerMode;
    menuPosition?: any;
    setStickerPickerOpen: (isStickerPickerOpen: boolean) => void;
    setStickerPickerMode: (mode: StickerPickerMode) => void;
    openEmojiPicker: () => void;
}

interface IState {
    imError: string | null;
    stickerpickerWidget: UserWidget | null;
    widgetId: string | null;
}

export default class Stickerpicker extends React.PureComponent<IProps, IState> {
    public static contextType = SDKContext;
    declare public context: React.ContextType<typeof SDKContext>;

    public static defaultProps: Partial<IProps> = {
        threadId: null,
    };

    public static currentWidget?: UserWidget;

    private dispatcherRef?: string;

    private prevSentVisibility?: boolean;

    private popoverWidth = 700;
    private popoverHeight = 560;
    private pickerContentHeight = 520;
    // This is loaded by _acquireScalarClient on an as-needed basis.
    private scalarClient: ScalarAuthClient | null = null;

    public constructor(props: IProps) {
        super(props);
        this.state = {
            imError: null,
            stickerpickerWidget: null,
            widgetId: null,
        };
    }

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
        this.context.client?.on(ClientEvent.AccountData, this.updateWidget);

        this.context.rightPanelStore.on(UPDATE_EVENT, this.onRightPanelStoreUpdate);
        // Initialise widget state from current account data
        this.updateWidget();
    }

    public componentWillUnmount(): void {
        this.context.client?.removeListener(ClientEvent.AccountData, this.updateWidget);
        this.context.rightPanelStore.off(UPDATE_EVENT, this.onRightPanelStoreUpdate);
        window.removeEventListener("resize", this.onResize);
        dis.unregister(this.dispatcherRef);
    }

    public componentDidUpdate(prevProps: IProps): void {
        if (prevProps.stickerPickerMode !== this.props.stickerPickerMode) {
            PersistedElement.destroyElement(PERSISTED_ELEMENT_KEY);
            this.forceUpdate();
            return;
        }

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
        return (
            <AccessibleButton onClick={this.launchManageIntegrations} className="mx_Stickers_contentPlaceholder">
                <p>{_t("stickers|empty")}</p>
                <p className="mx_Stickers_addLink">{_t("stickers|empty_add_prompt")}</p>
                <img src={StickerpackPlaceholder} alt="" />
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

    private stickerPickerUrl(baseUrl: string): string {
        const url = new URL(baseUrl, window.location.href);
        const theme = new ThemeWatcher().getEffectiveTheme();
        url.searchParams.set("theme", theme.includes("dark") ? "dark" : "light");

        if (this.props.stickerPickerMode === "gifs") {
            url.searchParams.set("mode", "gifs");
        } else {
            url.searchParams.delete("mode");
        }

        return url.toString();
    }

    private renderPickerTabs(): JSX.Element {
        const stickerActive = this.props.stickerPickerMode === "stickers";
        const gifActive = this.props.stickerPickerMode === "gifs";

        return (
            <div className="mx_AshramPickerTabs" role="tablist" aria-label="Composer picker">
                <AccessibleButton
                    className="mx_AshramPickerTab"
                    onClick={this.props.openEmojiPicker}
                    role="tab"
                    aria-selected={false}
                >
                    Emoji
                </AccessibleButton>
                <AccessibleButton
                    className={`mx_AshramPickerTab ${stickerActive ? "mx_AshramPickerTab_active" : ""}`}
                    onClick={() => this.props.setStickerPickerMode("stickers")}
                    role="tab"
                    aria-selected={stickerActive}
                >
                    Stickers
                </AccessibleButton>
                <AccessibleButton
                    className={`mx_AshramPickerTab ${gifActive ? "mx_AshramPickerTab_active" : ""}`}
                    onClick={() => this.props.setStickerPickerMode("gifs")}
                    role="tab"
                    aria-selected={gifActive}
                >
                    GIFs
                </AccessibleButton>
            </div>
        );
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
                url: this.stickerPickerUrl(stickerpickerWidget.content.url),
                name: stickerpickerWidget.content.name,
                type: stickerpickerWidget.content.type,
                data: stickerpickerWidget.content.data,
                creatorUserId: stickerpickerWidget.content.creatorUserId || stickerpickerWidget.sender,
            };

            stickersContent = (
                <div className="mx_AshramPickerFrame">
                    {this.renderPickerTabs()}
                    <div className="mx_Stickers_content_container">
                        <div
                            id="stickersContent"
                            className="mx_Stickers_content"
                            style={{
                                border: "none",
                                height: this.pickerContentHeight,
                                width: this.popoverWidth,
                            }}
                        >
                            <PersistedElement persistKey={PERSISTED_ELEMENT_KEY} zIndex={STICKERPICKER_Z_INDEX}>
                                <AppTile
                                    app={stickerApp}
                                    room={this.props.room}
                                    threadId={this.props.threadId}
                                    fullWidth={true}
                                    userId={this.context.client?.credentials.userId ?? undefined}
                                    creatorUserId={
                                        stickerpickerWidget.sender ||
                                        this.context.client?.credentials.userId ||
                                        undefined
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
                            </PersistedElement>
                        </div>
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
                menuWidth={this.popoverWidth}
                menuHeight={this.popoverHeight}
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
