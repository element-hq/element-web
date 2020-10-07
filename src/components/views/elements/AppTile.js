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
import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import AccessibleButton from './AccessibleButton';
import Modal from '../../../Modal';
import { _t } from '../../../languageHandler';
import * as sdk from '../../../index';
import AppPermission from './AppPermission';
import AppWarning from './AppWarning';
import Spinner from './Spinner';
import WidgetUtils from '../../../utils/WidgetUtils';
import dis from '../../../dispatcher/dispatcher';
import ActiveWidgetStore from '../../../stores/ActiveWidgetStore';
import classNames from 'classnames';
import SettingsStore from "../../../settings/SettingsStore";
import {aboveLeftOf, ContextMenu, ContextMenuButton} from "../../structures/ContextMenu";
import PersistedElement from "./PersistedElement";
import {WidgetType} from "../../../widgets/WidgetType";
import {SettingLevel} from "../../../settings/SettingLevel";
import WidgetStore from "../../../stores/WidgetStore";
import {Action} from "../../../dispatcher/actions";
import {StopGapWidget} from "../../../stores/widgets/StopGapWidget";
import {ElementWidgetActions} from "../../../stores/widgets/ElementWidgetActions";
import {MatrixCapabilities} from "matrix-widget-api";

export default class AppTile extends React.Component {
    constructor(props) {
        super(props);

        // The key used for PersistedElement
        this._persistKey = 'widget_' + this.props.app.id;
        this._sgWidget = new StopGapWidget(this.props);
        this._sgWidget.on("ready", this._onWidgetReady);
        this.iframe = null; // ref to the iframe (callback style)

        this.state = this._getNewState(props);

        this._onAction = this._onAction.bind(this);
        this._onEditClick = this._onEditClick.bind(this);
        this._onDeleteClick = this._onDeleteClick.bind(this);
        this._onRevokeClicked = this._onRevokeClicked.bind(this);
        this._onSnapshotClick = this._onSnapshotClick.bind(this);
        this.onClickMenuBar = this.onClickMenuBar.bind(this);
        this._onMinimiseClick = this._onMinimiseClick.bind(this);
        this._grantWidgetPermission = this._grantWidgetPermission.bind(this);
        this._revokeWidgetPermission = this._revokeWidgetPermission.bind(this);
        this._onPopoutWidgetClick = this._onPopoutWidgetClick.bind(this);
        this._onReloadWidgetClick = this._onReloadWidgetClick.bind(this);

        this._contextMenuButton = createRef();
        this._menu_bar = createRef();
    }

    /**
     * Set initial component state when the App wUrl (widget URL) is being updated.
     * Component props *must* be passed (rather than relying on this.props).
     * @param  {Object} newProps The new properties of the component
     * @return {Object} Updated component state to be set with setState
     */
    _getNewState(newProps) {
        // This is a function to make the impact of calling SettingsStore slightly less
        const hasPermissionToLoad = () => {
            if (this._usingLocalWidget()) return true;

            const currentlyAllowedWidgets = SettingsStore.getValue("allowedWidgets", newProps.room.roomId);
            return !!currentlyAllowedWidgets[newProps.app.eventId];
        };

        return {
            initialising: true, // True while we are mangling the widget URL
            // True while the iframe content is loading
            loading: this.props.waitForIframeLoad && !PersistedElement.isMounted(this._persistKey),
            // Assume that widget has permission to load if we are the user who
            // added it to the room, or if explicitly granted by the user
            hasPermissionToLoad: newProps.userId === newProps.creatorUserId || hasPermissionToLoad(),
            error: null,
            deleting: false,
            widgetPageTitle: newProps.widgetPageTitle,
            menuDisplayed: false,
        };
    }

    isMixedContent() {
        const parentContentProtocol = window.location.protocol;
        const u = url.parse(this.props.app.url);
        const childContentProtocol = u.protocol;
        if (parentContentProtocol === 'https:' && childContentProtocol !== 'https:') {
            console.warn("Refusing to load mixed-content app:",
            parentContentProtocol, childContentProtocol, window.location, this.props.app.url);
            return true;
        }
        return false;
    }

    componentDidMount() {
        // Only fetch IM token on mount if we're showing and have permission to load
        if (this.props.show && this.state.hasPermissionToLoad) {
            this._startWidget();
        }

        // Widget action listeners
        this.dispatcherRef = dis.register(this._onAction);
    }

    componentWillUnmount() {
        // Widget action listeners
        if (this.dispatcherRef) dis.unregister(this.dispatcherRef);

        // if it's not remaining on screen, get rid of the PersistedElement container
        if (!ActiveWidgetStore.getWidgetPersistence(this.props.app.id)) {
            ActiveWidgetStore.destroyPersistentWidget(this.props.app.id);
            PersistedElement.destroyElement(this._persistKey);
        }

        if (this._sgWidget) {
            this._sgWidget.stop();
        }
    }

    _resetWidget(newProps) {
        if (this._sgWidget) {
            this._sgWidget.stop();
        }
        this._sgWidget = new StopGapWidget(newProps);
        this._sgWidget.on("ready", this._onWidgetReady);
        this._startWidget();
    }

    _startWidget() {
        this._sgWidget.prepare().then(() => {
            this.setState({initialising: false});
        });
    }

    _iframeRefChange = (ref) => {
        this.iframe = ref;
        if (ref) {
            this._sgWidget.start(ref);
        } else {
            this._resetWidget(this.props);
        }
    };

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps(nextProps) { // eslint-disable-line camelcase
        if (nextProps.app.url !== this.props.app.url) {
            this._getNewState(nextProps);
            if (this.props.show && this.state.hasPermissionToLoad) {
                this._resetWidget(nextProps);
            }
        }

        if (nextProps.show && !this.props.show) {
            // We assume that persisted widgets are loaded and don't need a spinner.
            if (this.props.waitForIframeLoad && !PersistedElement.isMounted(this._persistKey)) {
                this.setState({
                    loading: true,
                });
            }
            // Start the widget now that we're showing if we already have permission to load
            if (this.state.hasPermissionToLoad) {
                this._startWidget();
            }
        }

        if (nextProps.widgetPageTitle !== this.props.widgetPageTitle) {
            this.setState({
                widgetPageTitle: nextProps.widgetPageTitle,
            });
        }
    }

    _canUserModify() {
        // User widgets should always be modifiable by their creator
        if (this.props.userWidget && MatrixClientPeg.get().credentials.userId === this.props.creatorUserId) {
            return true;
        }
        // Check if the current user can modify widgets in the current room
        return WidgetUtils.canUserModifyWidgets(this.props.room.roomId);
    }

    _onEditClick() {
        console.log("Edit widget ID ", this.props.app.id);
        if (this.props.onEditClick) {
            this.props.onEditClick();
        } else {
            WidgetUtils.editWidget(this.props.room, this.props.app);
        }
    }

    _onSnapshotClick() {
        this._sgWidget.widgetApi.takeScreenshot().then(data => {
            dis.dispatch({
                action: 'picture_snapshot',
                file: data.screenshot,
            });
        }).catch(err => {
            console.error("Failed to take screenshot: ", err);
        });
    }

    /**
     * Ends all widget interaction, such as cancelling calls and disabling webcams.
     * @private
     * @returns {Promise<*>} Resolves when the widget is terminated, or timeout passed.
     */
    async _endWidgetActions() { // widget migration dev note: async to maintain signature
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

        // Delete the widget from the persisted store for good measure.
        PersistedElement.destroyElement(this._persistKey);

        this._sgWidget.stop();
    }

    /* If user has permission to modify widgets, delete the widget,
     * otherwise revoke access for the widget to load in the user's browser
    */
    _onDeleteClick() {
        if (this.props.onDeleteClick) {
            this.props.onDeleteClick();
        } else if (this._canUserModify()) {
            // Show delete confirmation dialog
            const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
            Modal.createTrackedDialog('Delete Widget', '', QuestionDialog, {
                title: _t("Delete Widget"),
                description: _t(
                    "Deleting a widget removes it for all users in this room." +
                    " Are you sure you want to delete this widget?"),
                button: _t("Delete widget"),
                onFinished: (confirmed) => {
                    if (!confirmed) {
                        return;
                    }
                    this.setState({deleting: true});

                    this._endWidgetActions().then(() => {
                        return WidgetUtils.setRoomWidget(
                            this.props.room.roomId,
                            this.props.app.id,
                        );
                    }).catch((e) => {
                        console.error('Failed to delete widget', e);
                        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");

                        Modal.createTrackedDialog('Failed to remove widget', '', ErrorDialog, {
                            title: _t('Failed to remove widget'),
                            description: _t('An error ocurred whilst trying to remove the widget from the room'),
                        });
                    }).finally(() => {
                        this.setState({deleting: false});
                    });
                },
            });
        }
    }

    _onUnpinClicked = () => {
        WidgetStore.instance.unpinWidget(this.props.app.id);
    }

    _onRevokeClicked() {
        console.info("Revoke widget permissions - %s", this.props.app.id);
        this._revokeWidgetPermission();
    }

    _onWidgetReady = () => {
        this.setState({loading: false});
        if (WidgetType.JITSI.matches(this.props.app.type)) {
            this._sgWidget.widgetApi.transport.send(ElementWidgetActions.ClientReady, {});
        }
    };

    _onAction(payload) {
        if (payload.widgetId === this.props.app.id) {
            switch (payload.action) {
                case 'm.sticker':
                    if (this._sgWidget.widgetApi.hasCapability(MatrixCapabilities.StickerSending)) {
                        dis.dispatch({action: 'post_sticker_message', data: payload.data});
                    } else {
                        console.warn('Ignoring sticker message. Invalid capability');
                    }
                    break;

                case Action.AppTileDelete:
                    this._onDeleteClick();
                    break;

                case Action.AppTileRevoke:
                    this._onRevokeClicked();
                    break;
            }
        }
    }

    _grantWidgetPermission() {
        const roomId = this.props.room.roomId;
        console.info("Granting permission for widget to load: " + this.props.app.eventId);
        const current = SettingsStore.getValue("allowedWidgets", roomId);
        current[this.props.app.eventId] = true;
        SettingsStore.setValue("allowedWidgets", roomId, SettingLevel.ROOM_ACCOUNT, current).then(() => {
            this.setState({hasPermissionToLoad: true});

            // Fetch a token for the integration manager, now that we're allowed to
            this._startWidget();
        }).catch(err => {
            console.error(err);
            // We don't really need to do anything about this - the user will just hit the button again.
        });
    }

    _revokeWidgetPermission() {
        const roomId = this.props.room.roomId;
        console.info("Revoking permission for widget to load: " + this.props.app.eventId);
        const current = SettingsStore.getValue("allowedWidgets", roomId);
        current[this.props.app.eventId] = false;
        SettingsStore.setValue("allowedWidgets", roomId, SettingLevel.ROOM_ACCOUNT, current).then(() => {
            this.setState({hasPermissionToLoad: false});

            // Force the widget to be non-persistent (able to be deleted/forgotten)
            ActiveWidgetStore.destroyPersistentWidget(this.props.app.id);
            const PersistedElement = sdk.getComponent("elements.PersistedElement");
            PersistedElement.destroyElement(this._persistKey);
            this._sgWidget.stop();
        }).catch(err => {
            console.error(err);
            // We don't really need to do anything about this - the user will just hit the button again.
        });
    }

    formatAppTileName() {
        let appTileName = "No name";
        if (this.props.app.name && this.props.app.name.trim()) {
            appTileName = this.props.app.name.trim();
        }
        return appTileName;
    }

    onClickMenuBar(ev) {
        ev.preventDefault();

        // Ignore clicks on menu bar children
        if (ev.target !== this._menu_bar.current) {
            return;
        }

        // Toggle the view state of the apps drawer
        if (this.props.userWidget) {
            this._onMinimiseClick();
        } else {
            if (this.props.show) {
                // if we were being shown, end the widget as we're about to be minimized.
                this._endWidgetActions();
            }
            dis.dispatch({
                action: 'appsDrawer',
                show: !this.props.show,
            });
        }
    }

    /**
     * Whether we're using a local version of the widget rather than loading the
     * actual widget URL
     * @returns {bool} true If using a local version of the widget
     */
    _usingLocalWidget() {
        return WidgetType.JITSI.matches(this.props.app.type);
    }

    _getTileTitle() {
        const name = this.formatAppTileName();
        const titleSpacer = <span>&nbsp;-&nbsp;</span>;
        let title = '';
        if (this.state.widgetPageTitle && this.state.widgetPageTitle !== this.formatAppTileName()) {
            title = this.state.widgetPageTitle;
        }

        return (
            <span>
                <b>{ name }</b>
                <span>{ title ? titleSpacer : '' }{ title }</span>
            </span>
        );
    }

    _onMinimiseClick(e) {
        if (this.props.onMinimiseClick) {
            this.props.onMinimiseClick();
        }
    }

    _onPopoutWidgetClick() {
        // Ensure Jitsi conferences are closed on pop-out, to not confuse the user to join them
        // twice from the same computer, which Jitsi can have problems with (audio echo/gain-loop).
        if (WidgetType.JITSI.matches(this.props.app.type) && this.props.show) {
            this._endWidgetActions().then(() => {
                if (this.iframe) {
                    // Reload iframe
                    this.iframe.src = this._sgWidget.embedUrl;
                    this.setState({});
                }
            });
        }
        // Using Object.assign workaround as the following opens in a new window instead of a new tab.
        // window.open(this._getPopoutUrl(), '_blank', 'noopener=yes');
        Object.assign(document.createElement('a'),
            { target: '_blank', href: this._sgWidget.popoutUrl, rel: 'noreferrer noopener'}).click();
    }

    _onReloadWidgetClick() {
        // Reload iframe in this way to avoid cross-origin restrictions
        // eslint-disable-next-line no-self-assign
        this.iframe.src = this.iframe.src;
    }

    _onContextMenuClick = () => {
        this.setState({ menuDisplayed: true });
    };

    _closeContextMenu = () => {
        this.setState({ menuDisplayed: false });
    };

    render() {
        let appTileBody;

        // Don't render widget if it is in the process of being deleted
        if (this.state.deleting) {
            return <div />;
        }

        // Note that there is advice saying allow-scripts shouldn't be used with allow-same-origin
        // because that would allow the iframe to programmatically remove the sandbox attribute, but
        // this would only be for content hosted on the same origin as the element client: anything
        // hosted on the same origin as the client will get the same access as if you clicked
        // a link to it.
        const sandboxFlags = "allow-forms allow-popups allow-popups-to-escape-sandbox "+
            "allow-same-origin allow-scripts allow-presentation";

        // Additional iframe feature pemissions
        // (see - https://sites.google.com/a/chromium.org/dev/Home/chromium-security/deprecating-permissions-in-cross-origin-iframes and https://wicg.github.io/feature-policy/)
        const iframeFeatures = "microphone; camera; encrypted-media; autoplay; display-capture;";

        const appTileBodyClass = 'mx_AppTileBody' + (this.props.miniMode ? '_mini  ' : ' ');

        if (this.props.show) {
            const loadingElement = (
                <div className="mx_AppLoading_spinner_fadeIn">
                    <Spinner message={_t("Loading...")} />
                </div>
            );
            if (!this.state.hasPermissionToLoad) {
                const isEncrypted = MatrixClientPeg.get().isRoomEncrypted(this.props.room.roomId);
                appTileBody = (
                    <div className={appTileBodyClass}>
                        <AppPermission
                            roomId={this.props.room.roomId}
                            creatorUserId={this.props.creatorUserId}
                            url={this._sgWidget.embedUrl}
                            isRoomEncrypted={isEncrypted}
                            onPermissionGranted={this._grantWidgetPermission}
                        />
                    </div>
                );
            } else if (this.state.initialising) {
                appTileBody = (
                    <div className={appTileBodyClass + (this.state.loading ? 'mx_AppLoading' : '')}>
                        { loadingElement }
                    </div>
                );
            } else {
                if (this.isMixedContent()) {
                    appTileBody = (
                        <div className={appTileBodyClass}>
                            <AppWarning errorMsg="Error - Mixed content" />
                        </div>
                    );
                } else {
                    appTileBody = (
                        <div className={appTileBodyClass + (this.state.loading ? 'mx_AppLoading' : '')}>
                            { this.state.loading && loadingElement }
                            <iframe
                                allow={iframeFeatures}
                                ref={this._iframeRefChange}
                                src={this._sgWidget.embedUrl}
                                allowFullScreen={true}
                                sandbox={sandboxFlags}
                            />
                        </div>
                    );
                    // if the widget would be allowed to remain on screen, we must put it in
                    // a PersistedElement from the get-go, otherwise the iframe will be
                    // re-mounted later when we do.
                    if (this.props.whitelistCapabilities.includes('m.always_on_screen')) {
                        const PersistedElement = sdk.getComponent("elements.PersistedElement");
                        // Also wrap the PersistedElement in a div to fix the height, otherwise
                        // AppTile's border is in the wrong place
                        appTileBody = <div className="mx_AppTile_persistedWrapper">
                            <PersistedElement persistKey={this._persistKey}>
                                {appTileBody}
                            </PersistedElement>
                        </div>;
                    }
                }
            }
        }

        const showMinimiseButton = this.props.showMinimise && this.props.show;
        const showMaximiseButton = this.props.showMinimise && !this.props.show;

        let appTileClasses;
        if (this.props.miniMode) {
            appTileClasses = {mx_AppTile_mini: true};
        } else if (this.props.fullWidth) {
            appTileClasses = {mx_AppTileFullWidth: true};
        } else {
            appTileClasses = {mx_AppTile: true};
        }
        appTileClasses.mx_AppTile_minimised = !this.props.show;
        appTileClasses = classNames(appTileClasses);

        const menuBarClasses = classNames({
            mx_AppTileMenuBar: true,
            mx_AppTileMenuBar_expanded: this.props.show,
        });

        let contextMenu;
        if (this.state.menuDisplayed) {
            const elementRect = this._contextMenuButton.current.getBoundingClientRect();

            const canUserModify = this._canUserModify();
            const showEditButton = Boolean(this._sgWidget.isManagedByManager && canUserModify);
            const showDeleteButton = (this.props.showDelete === undefined || this.props.showDelete) && canUserModify;
            const showPictureSnapshotButton = this.props.show && this._sgWidget.widgetApi &&
                this._sgWidget.widgetApi.hasCapability(MatrixCapabilities.Screenshots);

            const WidgetContextMenu = sdk.getComponent('views.context_menus.WidgetContextMenu');
            contextMenu = (
                <ContextMenu {...aboveLeftOf(elementRect, null)} onFinished={this._closeContextMenu}>
                    <WidgetContextMenu
                        onUnpinClicked={
                            ActiveWidgetStore.getWidgetPersistence(this.props.app.id) ? null : this._onUnpinClicked
                        }
                        onRevokeClicked={this._onRevokeClicked}
                        onEditClicked={showEditButton ? this._onEditClick : undefined}
                        onDeleteClicked={showDeleteButton ? this._onDeleteClick : undefined}
                        onSnapshotClicked={showPictureSnapshotButton ? this._onSnapshotClick : undefined}
                        onReloadClicked={this.props.showReload ? this._onReloadWidgetClick : undefined}
                        onFinished={this._closeContextMenu}
                    />
                </ContextMenu>
            );
        }

        return <React.Fragment>
            <div className={appTileClasses} id={this.props.app.id}>
                { this.props.showMenubar &&
                <div ref={this._menu_bar} className={menuBarClasses} onClick={this.onClickMenuBar}>
                    <span className="mx_AppTileMenuBarTitle" style={{pointerEvents: (this.props.handleMinimisePointerEvents ? 'all' : false)}}>
                        { /* Minimise widget */ }
                        { showMinimiseButton && <AccessibleButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_minimise"
                            title={_t('Minimize widget')}
                            onClick={this._onMinimiseClick}
                        /> }
                        { /* Maximise widget */ }
                        { showMaximiseButton && <AccessibleButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_maximise"
                            title={_t('Maximize widget')}
                            onClick={this._onMinimiseClick}
                        /> }
                        { /* Title */ }
                        { this.props.showTitle && this._getTileTitle() }
                    </span>
                    <span className="mx_AppTileMenuBarWidgets">
                        { /* Popout widget */ }
                        { this.props.showPopout && <AccessibleButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_popout"
                            title={_t('Popout widget')}
                            onClick={this._onPopoutWidgetClick}
                        /> }
                        { /* Context menu */ }
                        { <ContextMenuButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_menu"
                            label={_t('More options')}
                            isExpanded={this.state.menuDisplayed}
                            inputRef={this._contextMenuButton}
                            onClick={this._onContextMenuClick}
                        /> }
                    </span>
                </div> }
                { appTileBody }
            </div>

            { contextMenu }
        </React.Fragment>;
    }
}

AppTile.displayName = 'AppTile';

AppTile.propTypes = {
    app: PropTypes.object.isRequired,
    room: PropTypes.object.isRequired,
    // Specifying 'fullWidth' as true will render the app tile to fill the width of the app drawer continer.
    // This should be set to true when there is only one widget in the app drawer, otherwise it should be false.
    fullWidth: PropTypes.bool,
    // Optional. If set, renders a smaller view of the widget
    miniMode: PropTypes.bool,
    // UserId of the current user
    userId: PropTypes.string.isRequired,
    // UserId of the entity that added / modified the widget
    creatorUserId: PropTypes.string,
    waitForIframeLoad: PropTypes.bool,
    showMenubar: PropTypes.bool,
    // Should the AppTile render itself
    show: PropTypes.bool,
    // Optional onEditClickHandler (overrides default behaviour)
    onEditClick: PropTypes.func,
    // Optional onDeleteClickHandler (overrides default behaviour)
    onDeleteClick: PropTypes.func,
    // Optional onMinimiseClickHandler
    onMinimiseClick: PropTypes.func,
    // Optionally hide the tile title
    showTitle: PropTypes.bool,
    // Optionally hide the tile minimise icon
    showMinimise: PropTypes.bool,
    // Optionally handle minimise button pointer events (default false)
    handleMinimisePointerEvents: PropTypes.bool,
    // Optionally hide the delete icon
    showDelete: PropTypes.bool,
    // Optionally hide the popout widget icon
    showPopout: PropTypes.bool,
    // Optionally show the reload widget icon
    // This is not currently intended for use with production widgets. However
    // it can be useful when developing persistent widgets in order to avoid
    // having to reload all of Element to get new widget content.
    showReload: PropTypes.bool,
    // Widget capabilities to allow by default (without user confirmation)
    // NOTE -- Use with caution. This is intended to aid better integration / UX
    // basic widget capabilities, e.g. injecting sticker message events.
    whitelistCapabilities: PropTypes.array,
    // Is this an instance of a user widget
    userWidget: PropTypes.bool,
};

AppTile.defaultProps = {
    waitForIframeLoad: true,
    showMenubar: true,
    showTitle: true,
    showMinimise: true,
    showDelete: true,
    showPopout: true,
    showReload: false,
    handleMinimisePointerEvents: false,
    whitelistCapabilities: [],
    userWidget: false,
    miniMode: false,
};
