/*
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020 - 2022 The Matrix.org Foundation C.I.C.

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

import React, { ContextType, createRef, CSSProperties, MutableRefObject, ReactNode } from "react";
import classNames from "classnames";
import { IWidget, MatrixCapabilities } from "matrix-widget-api";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { logger } from "matrix-js-sdk/src/logger";
import { ApprovalOpts, WidgetLifecycle } from "@matrix-org/react-sdk-module-api/lib/lifecycles/WidgetLifecycle";

import AccessibleButton from "./AccessibleButton";
import { _t } from "../../../languageHandler";
import AppPermission from "./AppPermission";
import AppWarning from "./AppWarning";
import Spinner from "./Spinner";
import dis from "../../../dispatcher/dispatcher";
import ActiveWidgetStore from "../../../stores/ActiveWidgetStore";
import SettingsStore from "../../../settings/SettingsStore";
import { aboveLeftOf, ContextMenuButton } from "../../structures/ContextMenu";
import PersistedElement, { getPersistKey } from "./PersistedElement";
import { WidgetType } from "../../../widgets/WidgetType";
import { ElementWidget, StopGapWidget } from "../../../stores/widgets/StopGapWidget";
import { WidgetContextMenu } from "../context_menus/WidgetContextMenu";
import WidgetAvatar from "../avatars/WidgetAvatar";
import LegacyCallHandler from "../../../LegacyCallHandler";
import { IApp, isAppWidget } from "../../../stores/WidgetStore";
import { Icon as CollapseIcon } from "../../../../res/img/element-icons/minimise-collapse.svg";
import { Icon as MaximiseIcon } from "../../../../res/img/element-icons/maximise-expand.svg";
import { Icon as MinimiseIcon } from "../../../../res/img/element-icons/minus-button.svg";
import { Icon as PopoutIcon } from "../../../../res/img/feather-customised/widget/external-link.svg";
import { Icon as MenuIcon } from "../../../../res/img/element-icons/room/ellipsis.svg";
import { Container, WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import WidgetUtils from "../../../utils/WidgetUtils";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { ActionPayload } from "../../../dispatcher/payloads";
import { Action } from "../../../dispatcher/actions";
import { ElementWidgetCapabilities } from "../../../stores/widgets/ElementWidgetCapabilities";
import { WidgetMessagingStore } from "../../../stores/widgets/WidgetMessagingStore";
import { SdkContextClass } from "../../../contexts/SDKContext";
import { ModuleRunner } from "../../../modules/ModuleRunner";
import { parseUrl } from "../../../utils/UrlUtils";

interface IProps {
    app: IWidget | IApp;
    // If room is not specified then it is an account level widget
    // which bypasses permission prompts as it was added explicitly by that user
    room?: Room;
    threadId?: string | null;
    // Specifying 'fullWidth' as true will render the app tile to fill the width of the app drawer container.
    // This should be set to true when there is only one widget in the app drawer, otherwise it should be false.
    fullWidth?: boolean;
    // Optional. If set, renders a smaller view of the widget
    miniMode?: boolean;
    // UserId of the current user
    userId: string;
    // UserId of the entity that added / modified the widget
    creatorUserId: string;
    waitForIframeLoad: boolean;
    showMenubar?: boolean;
    // Optional onEditClickHandler (overrides default behaviour)
    onEditClick?: () => void;
    // Optional onDeleteClickHandler (overrides default behaviour)
    onDeleteClick?: () => void;
    // Optionally hide the tile title
    showTitle?: boolean;
    // Optionally handle minimise button pointer events (default false)
    handleMinimisePointerEvents?: boolean;
    // Optionally hide the popout widget icon
    showPopout?: boolean;
    // Is this an instance of a user widget
    userWidget: boolean;
    // sets the pointer-events property on the iframe
    pointerEvents?: CSSProperties["pointerEvents"];
    widgetPageTitle?: string;
    showLayoutButtons?: boolean;
    // Handle to manually notify the PersistedElement that it needs to move
    movePersistedElement?: MutableRefObject<(() => void) | undefined>;
}

interface IState {
    initialising: boolean; // True while we are mangling the widget URL
    // True while the iframe content is loading
    loading: boolean;
    // Assume that widget has permission to load if we are the user who
    // added it to the room, or if explicitly granted by the user
    hasPermissionToLoad: boolean;
    // Wait for user profile load to display correct name
    isUserProfileReady: boolean;
    error: Error | null;
    menuDisplayed: boolean;
    requiresClient: boolean;
}

export default class AppTile extends React.Component<IProps, IState> {
    public static contextType = MatrixClientContext;
    public context!: ContextType<typeof MatrixClientContext>;

    public static defaultProps: Partial<IProps> = {
        waitForIframeLoad: true,
        showMenubar: true,
        showTitle: true,
        showPopout: true,
        handleMinimisePointerEvents: false,
        userWidget: false,
        miniMode: false,
        threadId: null,
        showLayoutButtons: true,
    };

    private contextMenuButton = createRef<any>();
    private iframe?: HTMLIFrameElement; // ref to the iframe (callback style)
    private allowedWidgetsWatchRef?: string;
    private persistKey: string;
    private sgWidget: StopGapWidget | null;
    private dispatcherRef?: string;
    private unmounted = false;

    public constructor(props: IProps) {
        super(props);

        // Tiles in miniMode are floating, and therefore not docked
        if (!this.props.miniMode) {
            ActiveWidgetStore.instance.dockWidget(
                this.props.app.id,
                isAppWidget(this.props.app) ? this.props.app.roomId : null,
            );
        }

        // The key used for PersistedElement
        this.persistKey = getPersistKey(WidgetUtils.getWidgetUid(this.props.app));
        try {
            this.sgWidget = new StopGapWidget(this.props);
            this.setupSgListeners();
        } catch (e) {
            logger.log("Failed to construct widget", e);
            this.sgWidget = null;
        }

        this.state = this.getNewState(props);
    }

    private watchUserReady = (): void => {
        if (OwnProfileStore.instance.isProfileInfoFetched) {
            return;
        }
        OwnProfileStore.instance.once(UPDATE_EVENT, this.onUserReady);
    };

    private onUserReady = (): void => {
        this.setState({ isUserProfileReady: true });
    };

    // This is a function to make the impact of calling SettingsStore slightly less
    private hasPermissionToLoad = (props: IProps): boolean => {
        if (this.usingLocalWidget()) return true;
        if (!props.room) return true; // user widgets always have permissions
        const opts: ApprovalOpts = { approved: undefined };
        ModuleRunner.instance.invoke(WidgetLifecycle.PreLoadRequest, opts, new ElementWidget(this.props.app));
        if (opts.approved) return true;

        const currentlyAllowedWidgets = SettingsStore.getValue("allowedWidgets", props.room.roomId);
        const allowed =
            isAppWidget(props.app) &&
            props.app.eventId !== undefined &&
            (currentlyAllowedWidgets[props.app.eventId] ?? false);
        return allowed || props.userId === props.creatorUserId;
    };

    private onUserLeftRoom(): void {
        const isActiveWidget = ActiveWidgetStore.instance.getWidgetPersistence(
            this.props.app.id,
            isAppWidget(this.props.app) ? this.props.app.roomId : null,
        );
        if (isActiveWidget) {
            // We just left the room that the active widget was from.
            if (this.props.room && SdkContextClass.instance.roomViewStore.getRoomId() !== this.props.room.roomId) {
                // If we are not actively looking at the room then destroy this widget entirely.
                this.endWidgetActions();
            } else if (WidgetType.JITSI.matches(this.props.app.type)) {
                // If this was a Jitsi then reload to end call.
                this.reload();
            } else {
                // Otherwise just cancel its persistence.
                ActiveWidgetStore.instance.destroyPersistentWidget(
                    this.props.app.id,
                    isAppWidget(this.props.app) ? this.props.app.roomId : null,
                );
            }
        }
    }

    private onMyMembership = (room: Room, membership: string): void => {
        if ((membership === "leave" || membership === "ban") && room.roomId === this.props.room?.roomId) {
            this.onUserLeftRoom();
        }
    };

    private determineInitialRequiresClientState(): boolean {
        try {
            const mockWidget = new ElementWidget(this.props.app);
            const widgetApi = WidgetMessagingStore.instance.getMessaging(mockWidget, this.props.room?.roomId);
            if (widgetApi) {
                // Load value from existing API to prevent resetting the requiresClient value on layout changes.
                return widgetApi.hasCapability(ElementWidgetCapabilities.RequiresClient);
            }
        } catch {
            // fallback to true
        }

        // requiresClient is initially set to true. This avoids the broken state of the popout
        // button being visible (for an instance) and then disappearing when the widget is loaded.
        // requiresClient <-> hide the popout button
        return true;
    }

    /**
     * Set initial component state when the App wUrl (widget URL) is being updated.
     * Component props *must* be passed (rather than relying on this.props).
     * @param  {Object} newProps The new properties of the component
     * @return {Object} Updated component state to be set with setState
     */
    private getNewState(newProps: IProps): IState {
        return {
            initialising: true, // True while we are mangling the widget URL
            // True while the iframe content is loading
            loading: this.props.waitForIframeLoad && !PersistedElement.isMounted(this.persistKey),
            // Assume that widget has permission to load if we are the user who
            // added it to the room, or if explicitly granted by the user
            hasPermissionToLoad: this.hasPermissionToLoad(newProps),
            isUserProfileReady: OwnProfileStore.instance.isProfileInfoFetched,
            error: null,
            menuDisplayed: false,
            requiresClient: this.determineInitialRequiresClientState(),
        };
    }

    private onAllowedWidgetsChange = (): void => {
        const hasPermissionToLoad = this.hasPermissionToLoad(this.props);

        if (this.state.hasPermissionToLoad && !hasPermissionToLoad) {
            // Force the widget to be non-persistent (able to be deleted/forgotten)
            ActiveWidgetStore.instance.destroyPersistentWidget(
                this.props.app.id,
                isAppWidget(this.props.app) ? this.props.app.roomId : null,
            );
            PersistedElement.destroyElement(this.persistKey);
            this.sgWidget?.stopMessaging();
        }

        this.setState({ hasPermissionToLoad });
    };

    private isMixedContent(): boolean {
        const parentContentProtocol = window.location.protocol;
        const u = parseUrl(this.props.app.url);
        const childContentProtocol = u.protocol;
        if (parentContentProtocol === "https:" && childContentProtocol !== "https:") {
            logger.warn(
                "Refusing to load mixed-content app:",
                parentContentProtocol,
                childContentProtocol,
                window.location,
                this.props.app.url,
            );
            return true;
        }
        return false;
    }

    public componentDidMount(): void {
        // Only fetch IM token on mount if we're showing and have permission to load
        if (this.sgWidget && this.state.hasPermissionToLoad) {
            this.startWidget();
        }
        this.watchUserReady();

        if (this.props.room) {
            this.context.on(RoomEvent.MyMembership, this.onMyMembership);
        }

        this.allowedWidgetsWatchRef = SettingsStore.watchSetting("allowedWidgets", null, this.onAllowedWidgetsChange);
        // Widget action listeners
        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentWillUnmount(): void {
        this.unmounted = true;

        if (!this.props.miniMode) {
            ActiveWidgetStore.instance.undockWidget(
                this.props.app.id,
                isAppWidget(this.props.app) ? this.props.app.roomId : null,
            );
        }

        // Only tear down the widget if no other component is keeping it alive,
        // because we support moving widgets between containers, in which case
        // another component will keep it loaded throughout the transition
        if (
            !ActiveWidgetStore.instance.isLive(
                this.props.app.id,
                isAppWidget(this.props.app) ? this.props.app.roomId : null,
            )
        ) {
            this.endWidgetActions();
        }

        // Widget action listeners
        if (this.dispatcherRef) dis.unregister(this.dispatcherRef);

        if (this.props.room) {
            this.context.off(RoomEvent.MyMembership, this.onMyMembership);
        }

        if (this.allowedWidgetsWatchRef) SettingsStore.unwatchSetting(this.allowedWidgetsWatchRef);
        OwnProfileStore.instance.removeListener(UPDATE_EVENT, this.onUserReady);
    }

    private setupSgListeners(): void {
        this.sgWidget?.on("preparing", this.onWidgetPreparing);
        // emits when the capabilities have been set up or changed
        this.sgWidget?.on("capabilitiesNotified", this.onWidgetCapabilitiesNotified);
    }

    private stopSgListeners(): void {
        if (!this.sgWidget) return;
        this.sgWidget.off("preparing", this.onWidgetPreparing);
        this.sgWidget.off("capabilitiesNotified", this.onWidgetCapabilitiesNotified);
    }

    private resetWidget(newProps: IProps): void {
        this.sgWidget?.stopMessaging();
        this.stopSgListeners();

        try {
            this.sgWidget = new StopGapWidget(newProps);
            this.setupSgListeners();
            this.startWidget();
        } catch (e) {
            logger.error("Failed to construct widget", e);
            this.sgWidget = null;
        }
    }

    private startWidget(): void {
        this.sgWidget?.prepare().then(() => {
            if (this.unmounted) return;
            this.setState({ initialising: false });
        });
    }

    private startMessaging(): void {
        try {
            this.sgWidget?.startMessaging(this.iframe!);
        } catch (e) {
            logger.error("Failed to start widget", e);
        }
    }

    private iframeRefChange = (ref: HTMLIFrameElement): void => {
        this.iframe = ref;
        if (this.unmounted) return;
        if (ref) {
            this.startMessaging();
        } else {
            this.resetWidget(this.props);
        }
    };

    public componentDidUpdate(prevProps: IProps): void {
        if (prevProps.app.url !== this.props.app.url) {
            this.getNewState(this.props);
            if (this.state.hasPermissionToLoad) {
                this.resetWidget(this.props);
            }
        }
    }

    /**
     * Ends all widget interaction, such as cancelling calls and disabling webcams.
     * @private
     * @returns {Promise<*>} Resolves when the widget is terminated, or timeout passed.
     */
    private async endWidgetActions(): Promise<void> {
        // widget migration dev note: async to maintain signature
        // HACK: This is a really dirty way to ensure that Jitsi cleans up
        // its hold on the webcam. Without this, the widget holds a media
        // stream open, even after death. See https://github.com/vector-im/element-web/issues/7351
        if (this.iframe) {
            // In practice we could just do `+= ''` to trick the browser
            // into thinking the URL changed, however I can foresee this
            // being optimized out by a browser. Instead, we'll just point
            // the iframe at a page that is reasonably safe to use in the
            // event the iframe doesn't wink away.
            // This is relative to where the Element instance is located.
            this.iframe.src = "about:blank";
        }

        if (WidgetType.JITSI.matches(this.props.app.type) && this.props.room) {
            LegacyCallHandler.instance.hangupCallApp(this.props.room.roomId);
        }

        // Delete the widget from the persisted store for good measure.
        PersistedElement.destroyElement(this.persistKey);
        ActiveWidgetStore.instance.destroyPersistentWidget(
            this.props.app.id,
            isAppWidget(this.props.app) ? this.props.app.roomId : null,
        );

        this.sgWidget?.stopMessaging({ forceDestroy: true });
    }

    private onWidgetPreparing = (): void => {
        this.setState({ loading: false });
    };

    private onWidgetCapabilitiesNotified = (): void => {
        this.setState({
            requiresClient: !!this.sgWidget?.widgetApi?.hasCapability(ElementWidgetCapabilities.RequiresClient),
        });
    };

    private onAction = (payload: ActionPayload): void => {
        switch (payload.action) {
            case "m.sticker":
                if (
                    payload.widgetId === this.props.app.id &&
                    this.sgWidget?.widgetApi?.hasCapability(MatrixCapabilities.StickerSending)
                ) {
                    dis.dispatch({
                        action: "post_sticker_message",
                        data: {
                            ...payload.data,
                            threadId: this.props.threadId,
                        },
                    });
                    dis.dispatch({ action: "stickerpicker_close" });
                } else {
                    logger.warn("Ignoring sticker message. Invalid capability");
                }
                break;

            case Action.AfterLeaveRoom:
                if (payload.room_id === this.props.room?.roomId) {
                    // call this before we get it echoed down /sync, so it doesn't hang around as long and look jarring
                    this.onUserLeftRoom();
                }
                break;
        }
    };

    private grantWidgetPermission = (): void => {
        const roomId = this.props.room?.roomId;
        const eventId = isAppWidget(this.props.app) ? this.props.app.eventId : undefined;
        logger.info("Granting permission for widget to load: " + eventId);
        const current = SettingsStore.getValue("allowedWidgets", roomId);
        if (eventId !== undefined) current[eventId] = true;
        const level = SettingsStore.firstSupportedLevel("allowedWidgets")!;
        SettingsStore.setValue("allowedWidgets", roomId ?? null, level, current)
            .then(() => {
                this.setState({ hasPermissionToLoad: true });

                // Fetch a token for the integration manager, now that we're allowed to
                this.startWidget();
            })
            .catch((err) => {
                logger.error(err);
                // We don't really need to do anything about this - the user will just hit the button again.
            });
    };

    private formatAppTileName(): string {
        let appTileName = "No name";
        if (this.props.app.name && this.props.app.name.trim()) {
            appTileName = this.props.app.name.trim();
        }
        return appTileName;
    }

    /**
     * Whether we're using a local version of the widget rather than loading the
     * actual widget URL
     * @returns {bool} true If using a local version of the widget
     */
    private usingLocalWidget(): boolean {
        return WidgetType.JITSI.matches(this.props.app.type);
    }

    private getTileTitle(): JSX.Element {
        const name = this.formatAppTileName();
        const titleSpacer = <span>&nbsp;-&nbsp;</span>;
        let title = "";
        if (this.props.widgetPageTitle && this.props.widgetPageTitle !== this.formatAppTileName()) {
            title = this.props.widgetPageTitle;
        }

        return (
            <span>
                <WidgetAvatar app={this.props.app} />
                <b>{name}</b>
                <span>
                    {title ? titleSpacer : ""}
                    {title}
                </span>
            </span>
        );
    }

    private reload(): void {
        this.endWidgetActions().then(() => {
            // reset messaging
            this.resetWidget(this.props);
            this.startMessaging();

            if (this.iframe && this.sgWidget) {
                // Reload iframe
                this.iframe.src = this.sgWidget.embedUrl;
            }
        });
    }

    // TODO replace with full screen interactions
    private onPopoutWidgetClick = (): void => {
        // Ensure Jitsi conferences are closed on pop-out, to not confuse the user to join them
        // twice from the same computer, which Jitsi can have problems with (audio echo/gain-loop).
        if (WidgetType.JITSI.matches(this.props.app.type)) {
            this.reload();
        }
        // Using Object.assign workaround as the following opens in a new window instead of a new tab.
        // window.open(this._getPopoutUrl(), '_blank', 'noopener=yes');
        Object.assign(document.createElement("a"), {
            target: "_blank",
            href: this.sgWidget?.popoutUrl,
            rel: "noreferrer noopener",
        }).click();
    };

    private onToggleMaximisedClick = (): void => {
        if (!this.props.room) return; // ignore action - it shouldn't even be visible
        const targetContainer = WidgetLayoutStore.instance.isInContainer(
            this.props.room,
            this.props.app,
            Container.Center,
        )
            ? Container.Top
            : Container.Center;
        WidgetLayoutStore.instance.moveToContainer(this.props.room, this.props.app, targetContainer);
    };

    private onMinimiseClicked = (): void => {
        if (!this.props.room) return; // ignore action - it shouldn't even be visible
        WidgetLayoutStore.instance.moveToContainer(this.props.room, this.props.app, Container.Right);
    };

    private onContextMenuClick = (): void => {
        this.setState({ menuDisplayed: true });
    };

    private closeContextMenu = (): void => {
        this.setState({ menuDisplayed: false });
    };

    public render(): React.ReactNode {
        let appTileBody: JSX.Element;

        // Note that there is advice saying allow-scripts shouldn't be used with allow-same-origin
        // because that would allow the iframe to programmatically remove the sandbox attribute, but
        // this would only be for content hosted on the same origin as the element client: anything
        // hosted on the same origin as the client will get the same access as if you clicked
        // a link to it.
        const sandboxFlags =
            "allow-forms allow-popups allow-popups-to-escape-sandbox " +
            "allow-same-origin allow-scripts allow-presentation allow-downloads";

        // Additional iframe feature permissions
        // (see - https://sites.google.com/a/chromium.org/dev/Home/chromium-security/deprecating-permissions-in-cross-origin-iframes and https://wicg.github.io/feature-policy/)
        const iframeFeatures =
            "microphone; camera; encrypted-media; autoplay; display-capture; clipboard-write; " + "clipboard-read;";

        const appTileBodyClass = classNames({
            mx_AppTileBody: !this.props.miniMode,
            mx_AppTileBody_mini: this.props.miniMode,
            mx_AppTile_loading: this.state.loading,
        });
        const appTileBodyStyles: CSSProperties = {};
        if (this.props.pointerEvents) {
            appTileBodyStyles.pointerEvents = this.props.pointerEvents;
        }

        const loadingElement = (
            <div className="mx_AppTileBody_fadeInSpinner">
                <Spinner message={_t("Loading…")} />
            </div>
        );

        const widgetTitle = WidgetUtils.getWidgetName(this.props.app);

        if (this.sgWidget === null) {
            appTileBody = (
                <div className={appTileBodyClass} style={appTileBodyStyles}>
                    <AppWarning errorMsg={_t("Error loading Widget")} />
                </div>
            );
        } else if (!this.state.hasPermissionToLoad && this.props.room) {
            // only possible for room widgets, can assert this.props.room here
            const isEncrypted = this.context.isRoomEncrypted(this.props.room.roomId);
            appTileBody = (
                <div className={appTileBodyClass} style={appTileBodyStyles}>
                    <AppPermission
                        roomId={this.props.room.roomId}
                        creatorUserId={this.props.creatorUserId}
                        url={this.sgWidget.embedUrl}
                        isRoomEncrypted={isEncrypted}
                        onPermissionGranted={this.grantWidgetPermission}
                    />
                </div>
            );
        } else if (this.state.initialising || !this.state.isUserProfileReady) {
            appTileBody = (
                <div className={appTileBodyClass} style={appTileBodyStyles}>
                    {loadingElement}
                </div>
            );
        } else {
            if (this.isMixedContent()) {
                appTileBody = (
                    <div className={appTileBodyClass} style={appTileBodyStyles}>
                        <AppWarning errorMsg={_t("Error - Mixed content")} />
                    </div>
                );
            } else {
                appTileBody = (
                    <div className={appTileBodyClass} style={appTileBodyStyles}>
                        {this.state.loading && loadingElement}
                        <iframe
                            title={widgetTitle}
                            allow={iframeFeatures}
                            ref={this.iframeRefChange}
                            src={this.sgWidget.embedUrl}
                            allowFullScreen={true}
                            sandbox={sandboxFlags}
                        />
                    </div>
                );

                if (!this.props.userWidget) {
                    // All room widgets can theoretically be allowed to remain on screen, so we
                    // wrap them all in a PersistedElement from the get-go. If we wait, the iframe
                    // will be re-mounted later, which means the widget has to start over, which is
                    // bad.

                    // Also wrap the PersistedElement in a div to fix the height, otherwise
                    // AppTile's border is in the wrong place

                    // For persisted apps in PiP we want the zIndex to be higher then for other persisted apps (100)
                    // otherwise there are issues that the PiP view is drawn UNDER another widget (Persistent app) when dragged around.
                    const zIndexAboveOtherPersistentElements = 101;

                    appTileBody = (
                        <div className="mx_AppTile_persistedWrapper">
                            <PersistedElement
                                zIndex={this.props.miniMode ? zIndexAboveOtherPersistentElements : 9}
                                persistKey={this.persistKey}
                                moveRef={this.props.movePersistedElement}
                            >
                                {appTileBody}
                            </PersistedElement>
                        </div>
                    );
                }
            }
        }

        let appTileClasses;
        if (this.props.miniMode) {
            appTileClasses = { mx_AppTile_mini: true };
        } else if (this.props.fullWidth) {
            appTileClasses = { mx_AppTileFullWidth: true };
        } else {
            appTileClasses = { mx_AppTile: true };
        }
        appTileClasses = classNames(appTileClasses);

        let contextMenu;
        if (this.state.menuDisplayed) {
            contextMenu = (
                <WidgetContextMenu
                    {...aboveLeftOf(this.contextMenuButton.current.getBoundingClientRect())}
                    app={this.props.app}
                    onFinished={this.closeContextMenu}
                    showUnpin={!this.props.userWidget}
                    userWidget={this.props.userWidget}
                    onEditClick={this.props.onEditClick}
                    onDeleteClick={this.props.onDeleteClick}
                />
            );
        }

        const layoutButtons: ReactNode[] = [];
        if (this.props.showLayoutButtons) {
            const isMaximised =
                this.props.room &&
                WidgetLayoutStore.instance.isInContainer(this.props.room, this.props.app, Container.Center);

            layoutButtons.push(
                <AccessibleButton
                    key="toggleMaximised"
                    className="mx_AppTileMenuBar_widgets_button"
                    title={isMaximised ? _t("Un-maximise") : _t("Maximise")}
                    onClick={this.onToggleMaximisedClick}
                >
                    {isMaximised ? (
                        <CollapseIcon className="mx_Icon mx_Icon_12" />
                    ) : (
                        <MaximiseIcon className="mx_Icon mx_Icon_12" />
                    )}
                </AccessibleButton>,
            );

            layoutButtons.push(
                <AccessibleButton
                    key="minimise"
                    className="mx_AppTileMenuBar_widgets_button"
                    title={_t("Minimise")}
                    onClick={this.onMinimiseClicked}
                >
                    <MinimiseIcon className="mx_Icon mx_Icon_12" />
                </AccessibleButton>,
            );
        }

        return (
            <React.Fragment>
                <div className={appTileClasses} id={this.props.app.id}>
                    {this.props.showMenubar && (
                        <div className="mx_AppTileMenuBar">
                            <span
                                className="mx_AppTileMenuBar_title"
                                style={{ pointerEvents: this.props.handleMinimisePointerEvents ? "all" : "none" }}
                            >
                                {this.props.showTitle && this.getTileTitle()}
                            </span>
                            <span className="mx_AppTileMenuBar_widgets">
                                {layoutButtons}
                                {this.props.showPopout && !this.state.requiresClient && (
                                    <AccessibleButton
                                        className="mx_AppTileMenuBar_widgets_button"
                                        title={_t("Popout widget")}
                                        onClick={this.onPopoutWidgetClick}
                                    >
                                        <PopoutIcon className="mx_Icon mx_Icon_12 mx_Icon--stroke" />
                                    </AccessibleButton>
                                )}
                                <ContextMenuButton
                                    className="mx_AppTileMenuBar_widgets_button"
                                    label={_t("Options")}
                                    isExpanded={this.state.menuDisplayed}
                                    inputRef={this.contextMenuButton}
                                    onClick={this.onContextMenuClick}
                                >
                                    <MenuIcon className="mx_Icon mx_Icon_12" />
                                </ContextMenuButton>
                            </span>
                        </div>
                    )}
                    {appTileBody}
                </div>

                {contextMenu}
            </React.Fragment>
        );
    }
}
