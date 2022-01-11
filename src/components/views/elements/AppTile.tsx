/*
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import url from 'url';
import React, { createRef } from 'react';
import classNames from 'classnames';
import { MatrixCapabilities } from "matrix-widget-api";
import { Room } from "matrix-js-sdk/src/models/room";
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from '../../../MatrixClientPeg';
import AccessibleButton from './AccessibleButton';
import { _t } from '../../../languageHandler';
import AppPermission from './AppPermission';
import AppWarning from './AppWarning';
import Spinner from './Spinner';
import dis from '../../../dispatcher/dispatcher';
import ActiveWidgetStore from '../../../stores/ActiveWidgetStore';
import SettingsStore from "../../../settings/SettingsStore";
import { aboveLeftOf, ContextMenuButton } from "../../structures/ContextMenu";
import PersistedElement, { getPersistKey } from "./PersistedElement";
import { WidgetType } from "../../../widgets/WidgetType";
import { StopGapWidget } from "../../../stores/widgets/StopGapWidget";
import { ElementWidgetActions } from "../../../stores/widgets/ElementWidgetActions";
import RoomWidgetContextMenu from "../context_menus/WidgetContextMenu";
import WidgetAvatar from "../avatars/WidgetAvatar";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import CallHandler from '../../../CallHandler';
import { IApp } from "../../../stores/WidgetStore";
import { WidgetLayoutStore, Container } from "../../../stores/widgets/WidgetLayoutStore";

interface IProps {
    app: IApp;
    // If room is not specified then it is an account level widget
    // which bypasses permission prompts as it was added explicitly by that user
    room: Room;
    threadId?: string | null;
    // Specifying 'fullWidth' as true will render the app tile to fill the width of the app drawer continer.
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
    pointerEvents?: string;
    widgetPageTitle?: string;
    hideMaximiseButton?: boolean;
}

interface IState {
    initialising: boolean; // True while we are mangling the widget URL
    // True while the iframe content is loading
    loading: boolean;
    // Assume that widget has permission to load if we are the user who
    // added it to the room, or if explicitly granted by the user
    hasPermissionToLoad: boolean;
    error: Error;
    menuDisplayed: boolean;
    widgetPageTitle: string;
    requiresClient: boolean;
}

@replaceableComponent("views.elements.AppTile")
export default class AppTile extends React.Component<IProps, IState> {
    public static defaultProps: Partial<IProps> = {
        waitForIframeLoad: true,
        showMenubar: true,
        showTitle: true,
        showPopout: true,
        handleMinimisePointerEvents: false,
        userWidget: false,
        miniMode: false,
        threadId: null,
    };

    private contextMenuButton = createRef<any>();
    private iframe: HTMLIFrameElement; // ref to the iframe (callback style)
    private allowedWidgetsWatchRef: string;
    private persistKey: string;
    private sgWidget: StopGapWidget;
    private dispatcherRef: string;

    constructor(props: IProps) {
        super(props);

        // The key used for PersistedElement
        this.persistKey = getPersistKey(this.props.app.id);
        try {
            this.sgWidget = new StopGapWidget(this.props);
            this.sgWidget.on("preparing", this.onWidgetPreparing);
            this.sgWidget.on("ready", this.onWidgetReady);
            // emits when the capabilites have been setup or changed
            this.sgWidget.on("capabilitiesNotified", this.onWidgetCapabilitiesNotified);
        } catch (e) {
            logger.log("Failed to construct widget", e);
            this.sgWidget = null;
        }

        this.state = this.getNewState(props);

        this.allowedWidgetsWatchRef = SettingsStore.watchSetting("allowedWidgets", null, this.onAllowedWidgetsChange);
    }

    // This is a function to make the impact of calling SettingsStore slightly less
    private hasPermissionToLoad = (props: IProps): boolean => {
        if (this.usingLocalWidget()) return true;
        if (!props.room) return true; // user widgets always have permissions

        const currentlyAllowedWidgets = SettingsStore.getValue("allowedWidgets", props.room.roomId);
        if (currentlyAllowedWidgets[props.app.eventId] === undefined) {
            return props.userId === props.creatorUserId;
        }
        return !!currentlyAllowedWidgets[props.app.eventId];
    };

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
            error: null,
            menuDisplayed: false,
            widgetPageTitle: this.props.widgetPageTitle,
            // requiresClient is initially set to true. This avoids the broken state of the popout
            // button being visible (for an instance) and then disappearing when the widget is loaded.
            // requiresClient <-> hide the popout button
            requiresClient: true,
        };
    }

    private onAllowedWidgetsChange = (): void => {
        const hasPermissionToLoad = this.hasPermissionToLoad(this.props);

        if (this.state.hasPermissionToLoad && !hasPermissionToLoad) {
            // Force the widget to be non-persistent (able to be deleted/forgotten)
            ActiveWidgetStore.instance.destroyPersistentWidget(this.props.app.id);
            PersistedElement.destroyElement(this.persistKey);
            if (this.sgWidget) this.sgWidget.stop();
        }

        this.setState({ hasPermissionToLoad });
    };

    private isMixedContent(): boolean {
        const parentContentProtocol = window.location.protocol;
        const u = url.parse(this.props.app.url);
        const childContentProtocol = u.protocol;
        if (parentContentProtocol === 'https:' && childContentProtocol !== 'https:') {
            logger.warn("Refusing to load mixed-content app:",
                parentContentProtocol, childContentProtocol, window.location, this.props.app.url);
            return true;
        }
        return false;
    }

    public componentDidMount(): void {
        // Only fetch IM token on mount if we're showing and have permission to load
        if (this.sgWidget && this.state.hasPermissionToLoad) {
            this.startWidget();
        }

        // Widget action listeners
        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentWillUnmount(): void {
        // Widget action listeners
        if (this.dispatcherRef) dis.unregister(this.dispatcherRef);

        // if it's not remaining on screen, get rid of the PersistedElement container
        if (!ActiveWidgetStore.instance.getWidgetPersistence(this.props.app.id)) {
            ActiveWidgetStore.instance.destroyPersistentWidget(this.props.app.id);
            PersistedElement.destroyElement(this.persistKey);
        }

        if (this.sgWidget) {
            this.sgWidget.stop();
        }

        SettingsStore.unwatchSetting(this.allowedWidgetsWatchRef);
    }

    private resetWidget(newProps: IProps): void {
        if (this.sgWidget) {
            this.sgWidget.stop();
        }
        try {
            this.sgWidget = new StopGapWidget(newProps);
            this.sgWidget.on("preparing", this.onWidgetPreparing);
            this.sgWidget.on("ready", this.onWidgetReady);
            this.startWidget();
        } catch (e) {
            logger.error("Failed to construct widget", e);
            this.sgWidget = null;
        }
    }

    private startWidget(): void {
        this.sgWidget.prepare().then(() => {
            this.setState({ initialising: false });
        });
    }

    private iframeRefChange = (ref: HTMLIFrameElement): void => {
        this.iframe = ref;
        if (ref) {
            try {
                if (this.sgWidget) {
                    this.sgWidget.start(ref);
                }
            } catch (e) {
                logger.error("Failed to start widget", e);
            }
        } else {
            this.resetWidget(this.props);
        }
    };

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public UNSAFE_componentWillReceiveProps(nextProps: IProps): void { // eslint-disable-line camelcase
        if (nextProps.app.url !== this.props.app.url) {
            this.getNewState(nextProps);
            if (this.state.hasPermissionToLoad) {
                this.resetWidget(nextProps);
            }
        }

        if (nextProps.widgetPageTitle !== this.props.widgetPageTitle) {
            this.setState({
                widgetPageTitle: nextProps.widgetPageTitle,
            });
        }
    }

    /**
     * Ends all widget interaction, such as cancelling calls and disabling webcams.
     * @private
     * @returns {Promise<*>} Resolves when the widget is terminated, or timeout passed.
     */
    private async endWidgetActions(): Promise<void> { // widget migration dev note: async to maintain signature
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
            this.iframe.src = 'about:blank';
        }

        if (WidgetType.JITSI.matches(this.props.app.type)) {
            CallHandler.instance.hangupCallApp(this.props.room.roomId);
        }

        // Delete the widget from the persisted store for good measure.
        PersistedElement.destroyElement(this.persistKey);
        ActiveWidgetStore.instance.destroyPersistentWidget(this.props.app.id);

        if (this.sgWidget) this.sgWidget.stop({ forceDestroy: true });
    }

    private onWidgetPreparing = (): void => {
        this.setState({ loading: false });
    };

    private onWidgetReady = (): void => {
        if (WidgetType.JITSI.matches(this.props.app.type)) {
            this.sgWidget.widgetApi.transport.send(ElementWidgetActions.ClientReady, {});
        }
    };

    private onWidgetCapabilitiesNotified = (): void => {
        this.setState({
            requiresClient: this.sgWidget.widgetApi.hasCapability(MatrixCapabilities.RequiresClient),
        });
    };

    private onAction = (payload): void => {
        if (payload.widgetId === this.props.app.id) {
            switch (payload.action) {
                case 'm.sticker':
                    if (this.sgWidget.widgetApi.hasCapability(MatrixCapabilities.StickerSending)) {
                        dis.dispatch({
                            action: 'post_sticker_message',
                            data: {
                                ...payload.data,
                                threadId: this.props.threadId,
                            },
                        });
                        dis.dispatch({ action: 'stickerpicker_close' });
                    } else {
                        logger.warn('Ignoring sticker message. Invalid capability');
                    }
                    break;
            }
        }
    };

    private grantWidgetPermission = (): void => {
        const roomId = this.props.room.roomId;
        logger.info("Granting permission for widget to load: " + this.props.app.eventId);
        const current = SettingsStore.getValue("allowedWidgets", roomId);
        current[this.props.app.eventId] = true;
        const level = SettingsStore.firstSupportedLevel("allowedWidgets");
        SettingsStore.setValue("allowedWidgets", roomId, level, current).then(() => {
            this.setState({ hasPermissionToLoad: true });

            // Fetch a token for the integration manager, now that we're allowed to
            this.startWidget();
        }).catch(err => {
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
        let title = '';
        if (this.state.widgetPageTitle && this.state.widgetPageTitle !== this.formatAppTileName()) {
            title = this.state.widgetPageTitle;
        }

        return (
            <span>
                <WidgetAvatar app={this.props.app} />
                <b>{ name }</b>
                <span>{ title ? titleSpacer : '' }{ title }</span>
            </span>
        );
    }

    // TODO replace with full screen interactions
    private onPopoutWidgetClick = (): void => {
        // Ensure Jitsi conferences are closed on pop-out, to not confuse the user to join them
        // twice from the same computer, which Jitsi can have problems with (audio echo/gain-loop).
        if (WidgetType.JITSI.matches(this.props.app.type)) {
            this.endWidgetActions().then(() => {
                if (this.iframe) {
                    // Reload iframe
                    this.iframe.src = this.sgWidget.embedUrl;
                }
            });
        }
        // Using Object.assign workaround as the following opens in a new window instead of a new tab.
        // window.open(this._getPopoutUrl(), '_blank', 'noopener=yes');
        Object.assign(document.createElement('a'),
            { target: '_blank', href: this.sgWidget.popoutUrl, rel: 'noreferrer noopener' }).click();
    };

    private onMaxMinWidgetClick = (): void => {
        const targetContainer =
            WidgetLayoutStore.instance.isInContainer(this.props.room, this.props.app, Container.Center)
                ? Container.Right
                : Container.Center;
        WidgetLayoutStore.instance.moveToContainer(this.props.room, this.props.app, targetContainer);
    };

    private onContextMenuClick = (): void => {
        this.setState({ menuDisplayed: true });
    };

    private closeContextMenu = (): void => {
        this.setState({ menuDisplayed: false });
    };

    public render(): JSX.Element {
        let appTileBody;

        // Note that there is advice saying allow-scripts shouldn't be used with allow-same-origin
        // because that would allow the iframe to programmatically remove the sandbox attribute, but
        // this would only be for content hosted on the same origin as the element client: anything
        // hosted on the same origin as the client will get the same access as if you clicked
        // a link to it.
        const sandboxFlags = "allow-forms allow-popups allow-popups-to-escape-sandbox " +
            "allow-same-origin allow-scripts allow-presentation";

        // Additional iframe feature pemissions
        // (see - https://sites.google.com/a/chromium.org/dev/Home/chromium-security/deprecating-permissions-in-cross-origin-iframes and https://wicg.github.io/feature-policy/)
        const iframeFeatures = "microphone; camera; encrypted-media; autoplay; display-capture; clipboard-write;";

        const appTileBodyClass = 'mx_AppTileBody' + (this.props.miniMode ? '_mini  ' : ' ');
        const appTileBodyStyles = {};
        if (this.props.pointerEvents) {
            appTileBodyStyles['pointerEvents'] = this.props.pointerEvents;
        }

        const loadingElement = (
            <div className="mx_AppLoading_spinner_fadeIn">
                <Spinner message={_t("Loading...")} />
            </div>
        );
        if (this.sgWidget === null) {
            appTileBody = (
                <div className={appTileBodyClass} style={appTileBodyStyles}>
                    <AppWarning errorMsg={_t("Error loading Widget")} />
                </div>
            );
        } else if (!this.state.hasPermissionToLoad) {
            // only possible for room widgets, can assert this.props.room here
            const isEncrypted = MatrixClientPeg.get().isRoomEncrypted(this.props.room.roomId);
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
        } else if (this.state.initialising) {
            appTileBody = (
                <div className={appTileBodyClass + (this.state.loading ? 'mx_AppLoading' : '')} style={appTileBodyStyles}>
                    { loadingElement }
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
                    <div className={appTileBodyClass + (this.state.loading ? 'mx_AppLoading' : '')} style={appTileBodyStyles}>
                        { this.state.loading && loadingElement }
                        <iframe
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
                    appTileBody = <div className="mx_AppTile_persistedWrapper">
                        <PersistedElement zIndex={this.props.miniMode ? 10 : 9}persistKey={this.persistKey}>
                            { appTileBody }
                        </PersistedElement>
                    </div>;
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
                <RoomWidgetContextMenu
                    {...aboveLeftOf(this.contextMenuButton.current.getBoundingClientRect(), null)}
                    app={this.props.app}
                    onFinished={this.closeContextMenu}
                    showUnpin={!this.props.userWidget}
                    userWidget={this.props.userWidget}
                    onEditClick={this.props.onEditClick}
                    onDeleteClick={this.props.onDeleteClick}
                />
            );
        }
        let maxMinButton;
        if (!this.props.hideMaximiseButton) {
            const widgetIsMaximised = WidgetLayoutStore.instance.
                isInContainer(this.props.room, this.props.app, Container.Center);
            maxMinButton = <AccessibleButton
                className={
                    "mx_AppTileMenuBar_iconButton"
                                    + (widgetIsMaximised
                                        ? " mx_AppTileMenuBar_iconButton_minWidget"
                                        : " mx_AppTileMenuBar_iconButton_maxWidget")
                }
                title={
                    widgetIsMaximised ? _t('Close'): _t('Maximise widget')
                }
                onClick={this.onMaxMinWidgetClick}
            />;
        }

        return <React.Fragment>
            <div className={appTileClasses} id={this.props.app.id}>
                { this.props.showMenubar &&
                    <div className="mx_AppTileMenuBar">
                        <span className="mx_AppTileMenuBarTitle" style={{ pointerEvents: (this.props.handleMinimisePointerEvents ? 'all' : "none") }}>
                            { this.props.showTitle && this.getTileTitle() }
                        </span>
                        <span className="mx_AppTileMenuBarWidgets">
                            { maxMinButton }
                            { (this.props.showPopout && !this.state.requiresClient) && <AccessibleButton
                                className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_popout"
                                title={_t('Popout widget')}
                                onClick={this.onPopoutWidgetClick}
                            /> }
                            <ContextMenuButton
                                className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_menu"
                                label={_t("Options")}
                                isExpanded={this.state.menuDisplayed}
                                inputRef={this.contextMenuButton}
                                onClick={this.onContextMenuClick}
                            />
                        </span>
                    </div> }
                { appTileBody }
            </div>

            { contextMenu }
        </React.Fragment>;
    }
}
