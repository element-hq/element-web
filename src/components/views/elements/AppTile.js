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
import { _t } from '../../../languageHandler';
import AppPermission from './AppPermission';
import AppWarning from './AppWarning';
import Spinner from './Spinner';
import dis from '../../../dispatcher/dispatcher';
import ActiveWidgetStore from '../../../stores/ActiveWidgetStore';
import classNames from 'classnames';
import SettingsStore from "../../../settings/SettingsStore";
import {aboveLeftOf, ContextMenuButton} from "../../structures/ContextMenu";
import PersistedElement, {getPersistKey} from "./PersistedElement";
import {WidgetType} from "../../../widgets/WidgetType";
import {SettingLevel} from "../../../settings/SettingLevel";
import {StopGapWidget} from "../../../stores/widgets/StopGapWidget";
import {ElementWidgetActions} from "../../../stores/widgets/ElementWidgetActions";
import {MatrixCapabilities} from "matrix-widget-api";
import RoomWidgetContextMenu from "../context_menus/WidgetContextMenu";
import WidgetAvatar from "../avatars/WidgetAvatar";

export default class AppTile extends React.Component {
    constructor(props) {
        super(props);

        // The key used for PersistedElement
        this._persistKey = getPersistKey(this.props.app.id);
        this._sgWidget = new StopGapWidget(this.props);
        this._sgWidget.on("preparing", this._onWidgetPrepared);
        this._sgWidget.on("ready", this._onWidgetReady);
        this.iframe = null; // ref to the iframe (callback style)

        this.state = this._getNewState(props);
        this._contextMenuButton = createRef();

        this._allowedWidgetsWatchRef = SettingsStore.watchSetting("allowedWidgets", null, this.onAllowedWidgetsChange);
    }

    // This is a function to make the impact of calling SettingsStore slightly less
    hasPermissionToLoad = (props) => {
        if (this._usingLocalWidget()) return true;
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
    _getNewState(newProps) {
        return {
            initialising: true, // True while we are mangling the widget URL
            // True while the iframe content is loading
            loading: this.props.waitForIframeLoad && !PersistedElement.isMounted(this._persistKey),
            // Assume that widget has permission to load if we are the user who
            // added it to the room, or if explicitly granted by the user
            hasPermissionToLoad: this.hasPermissionToLoad(newProps),
            error: null,
            widgetPageTitle: newProps.widgetPageTitle,
            menuDisplayed: false,
        };
    }

    onAllowedWidgetsChange = () => {
        const hasPermissionToLoad = this.hasPermissionToLoad(this.props);

        if (this.state.hasPermissionToLoad && !hasPermissionToLoad) {
            // Force the widget to be non-persistent (able to be deleted/forgotten)
            ActiveWidgetStore.destroyPersistentWidget(this.props.app.id);
            PersistedElement.destroyElement(this._persistKey);
            this._sgWidget.stop();
        }

        this.setState({ hasPermissionToLoad });
    };

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
        if (this.state.hasPermissionToLoad) {
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

        SettingsStore.unwatchSetting(this._allowedWidgetsWatchRef);
    }

    _resetWidget(newProps) {
        if (this._sgWidget) {
            this._sgWidget.stop();
        }
        this._sgWidget = new StopGapWidget(newProps);
        this._sgWidget.on("preparing", this._onWidgetPrepared);
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
            if (this.state.hasPermissionToLoad) {
                this._resetWidget(nextProps);
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

        if (WidgetType.JITSI.matches(this.props.app.type)) {
            dis.dispatch({action: 'hangup_conference'});
        }

        // Delete the widget from the persisted store for good measure.
        PersistedElement.destroyElement(this._persistKey);

        this._sgWidget.stop({forceDestroy: true});
    }

    _onWidgetPrepared = () => {
        this.setState({loading: false});
    };

    _onWidgetReady = () => {
        if (WidgetType.JITSI.matches(this.props.app.type)) {
            this._sgWidget.widgetApi.transport.send(ElementWidgetActions.ClientReady, {});
        }
    };

    _onAction = payload => {
        if (payload.widgetId === this.props.app.id) {
            switch (payload.action) {
                case 'm.sticker':
                    if (this._sgWidget.widgetApi.hasCapability(MatrixCapabilities.StickerSending)) {
                        dis.dispatch({action: 'post_sticker_message', data: payload.data});
                    } else {
                        console.warn('Ignoring sticker message. Invalid capability');
                    }
                    break;
            }
        }
    };

    _grantWidgetPermission = () => {
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
    };

    formatAppTileName() {
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
                <WidgetAvatar app={this.props.app} />
                <b>{ name }</b>
                <span>{ title ? titleSpacer : '' }{ title }</span>
            </span>
        );
    }

    // TODO replace with full screen interactions
    _onPopoutWidgetClick = () => {
        // Ensure Jitsi conferences are closed on pop-out, to not confuse the user to join them
        // twice from the same computer, which Jitsi can have problems with (audio echo/gain-loop).
        if (WidgetType.JITSI.matches(this.props.app.type)) {
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
    };

    _onContextMenuClick = () => {
        this.setState({ menuDisplayed: true });
    };

    _closeContextMenu = () => {
        this.setState({ menuDisplayed: false });
    };

    render() {
        let appTileBody;

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

        const loadingElement = (
            <div className="mx_AppLoading_spinner_fadeIn">
                <Spinner message={_t("Loading...")} />
            </div>
        );
        if (!this.state.hasPermissionToLoad) {
            // only possible for room widgets, can assert this.props.room here
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

                if (!this.props.userWidget) {
                    // All room widgets can theoretically be allowed to remain on screen, so we
                    // wrap them all in a PersistedElement from the get-go. If we wait, the iframe
                    // will be re-mounted later, which means the widget has to start over, which is
                    // bad.

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

        let appTileClasses;
        if (this.props.miniMode) {
            appTileClasses = {mx_AppTile_mini: true};
        } else if (this.props.fullWidth) {
            appTileClasses = {mx_AppTileFullWidth: true};
        } else {
            appTileClasses = {mx_AppTile: true};
        }
        appTileClasses = classNames(appTileClasses);

        let contextMenu;
        if (this.state.menuDisplayed) {
            contextMenu = (
                <RoomWidgetContextMenu
                    {...aboveLeftOf(this._contextMenuButton.current.getBoundingClientRect(), null)}
                    app={this.props.app}
                    onFinished={this._closeContextMenu}
                    showUnpin={!this.props.userWidget}
                    userWidget={this.props.userWidget}
                />
            );
        }

        return <React.Fragment>
            <div className={appTileClasses} id={this.props.app.id}>
                { this.props.showMenubar &&
                <div className="mx_AppTileMenuBar">
                    <span className="mx_AppTileMenuBarTitle" style={{pointerEvents: (this.props.handleMinimisePointerEvents ? 'all' : false)}}>
                        { this.props.showTitle && this._getTileTitle() }
                    </span>
                    <span className="mx_AppTileMenuBarWidgets">
                        { this.props.showPopout && <AccessibleButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_popout"
                            title={_t('Popout widget')}
                            onClick={this._onPopoutWidgetClick}
                        /> }
                        { <ContextMenuButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_menu"
                            label={_t("Options")}
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
    // If room is not specified then it is an account level widget
    // which bypasses permission prompts as it was added explicitly by that user
    room: PropTypes.object,
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
    // Optional onEditClickHandler (overrides default behaviour)
    onEditClick: PropTypes.func,
    // Optional onDeleteClickHandler (overrides default behaviour)
    onDeleteClick: PropTypes.func,
    // Optional onMinimiseClickHandler
    onMinimiseClick: PropTypes.func,
    // Optionally hide the tile title
    showTitle: PropTypes.bool,
    // Optionally handle minimise button pointer events (default false)
    handleMinimisePointerEvents: PropTypes.bool,
    // Optionally hide the popout widget icon
    showPopout: PropTypes.bool,
    // Is this an instance of a user widget
    userWidget: PropTypes.bool,
};

AppTile.defaultProps = {
    waitForIframeLoad: true,
    showMenubar: true,
    showTitle: true,
    showPopout: true,
    handleMinimisePointerEvents: false,
    userWidget: false,
    miniMode: false,
};
