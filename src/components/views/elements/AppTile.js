/**
Copyright 2017 Vector Creations Ltd
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

'use strict';

import url from 'url';
import qs from 'querystring';
import React from 'react';
import PropTypes from 'prop-types';
import MatrixClientPeg from '../../../MatrixClientPeg';
import ScalarAuthClient from '../../../ScalarAuthClient';
import WidgetMessaging from '../../../WidgetMessaging';
import AccessibleButton from './AccessibleButton';
import Modal from '../../../Modal';
import { _t } from '../../../languageHandler';
import sdk from '../../../index';
import AppPermission from './AppPermission';
import AppWarning from './AppWarning';
import MessageSpinner from './MessageSpinner';
import WidgetUtils from '../../../utils/WidgetUtils';
import dis from '../../../dispatcher';
import ActiveWidgetStore from '../../../stores/ActiveWidgetStore';
import classNames from 'classnames';

const ALLOWED_APP_URL_SCHEMES = ['https:', 'http:'];
const ENABLE_REACT_PERF = false;

export default class AppTile extends React.Component {
    constructor(props) {
        super(props);

        // The key used for PersistedElement
        this._persistKey = 'widget_' + this.props.id;

        this.state = this._getNewState(props);

        this._onAction = this._onAction.bind(this);
        this._onLoaded = this._onLoaded.bind(this);
        this._onEditClick = this._onEditClick.bind(this);
        this._onDeleteClick = this._onDeleteClick.bind(this);
        this._onCancelClick = this._onCancelClick.bind(this);
        this._onSnapshotClick = this._onSnapshotClick.bind(this);
        this.onClickMenuBar = this.onClickMenuBar.bind(this);
        this._onMinimiseClick = this._onMinimiseClick.bind(this);
        this._grantWidgetPermission = this._grantWidgetPermission.bind(this);
        this._revokeWidgetPermission = this._revokeWidgetPermission.bind(this);
        this._onPopoutWidgetClick = this._onPopoutWidgetClick.bind(this);
        this._onReloadWidgetClick = this._onReloadWidgetClick.bind(this);
    }

    /**
     * Set initial component state when the App wUrl (widget URL) is being updated.
     * Component props *must* be passed (rather than relying on this.props).
     * @param  {Object} newProps The new properties of the component
     * @return {Object} Updated component state to be set with setState
     */
    _getNewState(newProps) {
        const widgetPermissionId = [newProps.room.roomId, encodeURIComponent(newProps.url)].join('_');
        const hasPermissionToLoad = localStorage.getItem(widgetPermissionId);

        const PersistedElement = sdk.getComponent("elements.PersistedElement");
        return {
            initialising: true, // True while we are mangling the widget URL
            // True while the iframe content is loading
            loading: this.props.waitForIframeLoad && !PersistedElement.isMounted(this._persistKey),
            widgetUrl: this._addWurlParams(newProps.url),
            widgetPermissionId: widgetPermissionId,
            // Assume that widget has permission to load if we are the user who
            // added it to the room, or if explicitly granted by the user
            hasPermissionToLoad: hasPermissionToLoad === 'true' || newProps.userId === newProps.creatorUserId,
            error: null,
            deleting: false,
            widgetPageTitle: newProps.widgetPageTitle,
        };
    }

    /**
     * Does the widget support a given capability
     * @param  {string}  capability Capability to check for
     * @return {Boolean}            True if capability supported
     */
    _hasCapability(capability) {
        return ActiveWidgetStore.widgetHasCapability(this.props.id, capability);
    }

    /**
     * Add widget instance specific parameters to pass in wUrl
     * Properties passed to widget instance:
     *  - widgetId
     *  - origin / parent URL
     * @param {string} urlString Url string to modify
     * @return {string}
     * Url string with parameters appended.
     * If url can not be parsed, it is returned unmodified.
     */
    _addWurlParams(urlString) {
        const u = url.parse(urlString);
        if (!u) {
            console.error("_addWurlParams", "Invalid URL", urlString);
            return url;
        }

        const params = qs.parse(u.query);
        // Append widget ID to query parameters
        params.widgetId = this.props.id;
        // Append current / parent URL, minus the hash because that will change when
        // we view a different room (ie. may change for persistent widgets)
        params.parentUrl = window.location.href.split('#', 2)[0];
        u.search = undefined;
        u.query = params;

        return u.format();
    }

    isMixedContent() {
        const parentContentProtocol = window.location.protocol;
        const u = url.parse(this.props.url);
        const childContentProtocol = u.protocol;
        if (parentContentProtocol === 'https:' && childContentProtocol !== 'https:') {
            console.warn("Refusing to load mixed-content app:",
            parentContentProtocol, childContentProtocol, window.location, this.props.url);
            return true;
        }
        return false;
    }

    componentWillMount() {
        this.setScalarToken();
    }

    componentDidMount() {
        // Widget action listeners
        this.dispatcherRef = dis.register(this._onAction);
    }

    componentWillUnmount() {
        // Widget action listeners
        dis.unregister(this.dispatcherRef);

        // if it's not remaining on screen, get rid of the PersistedElement container
        if (!ActiveWidgetStore.getWidgetPersistence(this.props.id)) {
            ActiveWidgetStore.destroyPersistentWidget();
            const PersistedElement = sdk.getComponent("elements.PersistedElement");
            PersistedElement.destroyElement(this._persistKey);
        }
    }

    /**
     * Adds a scalar token to the widget URL, if required
     * Component initialisation is only complete when this function has resolved
     */
    setScalarToken() {
        this.setState({initialising: true});

        if (!WidgetUtils.isScalarUrl(this.props.url)) {
            console.warn('Non-scalar widget, not setting scalar token!', url);
            this.setState({
                error: null,
                widgetUrl: this._addWurlParams(this.props.url),
                initialising: false,
            });
            return;
        }

        // Fetch the token before loading the iframe as we need it to mangle the URL
        if (!this._scalarClient) {
            this._scalarClient = new ScalarAuthClient();
        }
        this._scalarClient.getScalarToken().done((token) => {
            // Append scalar_token as a query param if not already present
            this._scalarClient.scalarToken = token;
            const u = url.parse(this._addWurlParams(this.props.url));
            const params = qs.parse(u.query);
            if (!params.scalar_token) {
                params.scalar_token = encodeURIComponent(token);
                // u.search must be set to undefined, so that u.format() uses query paramerters - https://nodejs.org/docs/latest/api/url.html#url_url_format_url_options
                u.search = undefined;
                u.query = params;
            }

            this.setState({
                error: null,
                widgetUrl: u.format(),
                initialising: false,
            });

            // Fetch page title from remote content if not already set
            if (!this.state.widgetPageTitle && params.url) {
                this._fetchWidgetTitle(params.url);
            }
        }, (err) => {
            console.error("Failed to get scalar_token", err);
            this.setState({
                error: err.message,
                initialising: false,
            });
        });
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.url !== this.props.url) {
            this._getNewState(nextProps);
            this.setScalarToken();
        } else if (nextProps.show && !this.props.show && this.props.waitForIframeLoad) {
            this.setState({
                loading: true,
            });
        } else if (nextProps.widgetPageTitle !== this.props.widgetPageTitle) {
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

    _onEditClick(e) {
        console.log("Edit widget ID ", this.props.id);
        if (this.props.onEditClick) {
            this.props.onEditClick();
        } else {
            const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
            this._scalarClient.connect().done(() => {
                const src = this._scalarClient.getScalarInterfaceUrlForRoom(
                    this.props.room, 'type_' + this.props.type, this.props.id);
                Modal.createTrackedDialog('Integrations Manager', '', IntegrationsManager, {
                    src: src,
                }, "mx_IntegrationsManager");
            }, (err) => {
                this.setState({
                    error: err.message,
                });
                console.error('Error ensuring a valid scalar_token exists', err);
            });
        }
    }

    _onSnapshotClick(e) {
        console.warn("Requesting widget snapshot");
        ActiveWidgetStore.getWidgetMessaging(this.props.id).getScreenshot()
            .catch((err) => {
                console.error("Failed to get screenshot", err);
            })
            .then((screenshot) => {
                dis.dispatch({
                    action: 'picture_snapshot',
                    file: screenshot,
                }, true);
            });
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

                    // HACK: This is a really dirty way to ensure that Jitsi cleans up
                    // its hold on the webcam. Without this, the widget holds a media
                    // stream open, even after death. See https://github.com/vector-im/riot-web/issues/7351
                    if (this.refs.appFrame) {
                        // In practice we could just do `+= ''` to trick the browser
                        // into thinking the URL changed, however I can foresee this
                        // being optimized out by a browser. Instead, we'll just point
                        // the iframe at a page that is reasonably safe to use in the
                        // event the iframe doesn't wink away.
                        // This is relative to where the Riot instance is located.
                        this.refs.appFrame.src = 'about:blank';
                    }

                    WidgetUtils.setRoomWidget(
                        this.props.room.roomId,
                        this.props.id,
                    ).catch((e) => {
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

    _onCancelClick() {
        if (this.props.onDeleteClick) {
            this.props.onDeleteClick();
        } else {
            console.log("Revoke widget permissions - %s", this.props.id);
            this._revokeWidgetPermission();
        }
    }

    /**
     * Called when widget iframe has finished loading
     */
    _onLoaded() {
        // Destroy the old widget messaging before starting it back up again. Some widgets
        // have startup routines that run when they are loaded, so we just need to reinitialize
        // the messaging for them.
        if (ActiveWidgetStore.getWidgetMessaging(this.props.id)) {
            ActiveWidgetStore.delWidgetMessaging(this.props.id);
        }
        this._setupWidgetMessaging();

        ActiveWidgetStore.setRoomId(this.props.id, this.props.room.roomId);
        this.setState({loading: false});
    }

    _setupWidgetMessaging() {
        // FIXME: There's probably no reason to do this here: it should probably be done entirely
        // in ActiveWidgetStore.
        const widgetMessaging = new WidgetMessaging(
            this.props.id, this.props.url, this.props.userWidget, this.refs.appFrame.contentWindow);
        ActiveWidgetStore.setWidgetMessaging(this.props.id, widgetMessaging);
        widgetMessaging.getCapabilities().then((requestedCapabilities) => {
            console.log(`Widget ${this.props.id} requested capabilities: ` + requestedCapabilities);
            requestedCapabilities = requestedCapabilities || [];

            // Allow whitelisted capabilities
            let requestedWhitelistCapabilies = [];

            if (this.props.whitelistCapabilities && this.props.whitelistCapabilities.length > 0) {
                requestedWhitelistCapabilies = requestedCapabilities.filter(function(e) {
                    return this.indexOf(e)>=0;
                }, this.props.whitelistCapabilities);

                if (requestedWhitelistCapabilies.length > 0 ) {
                    console.warn(`Widget ${this.props.id} allowing requested, whitelisted properties: ` +
                        requestedWhitelistCapabilies,
                    );
                }
            }

            // TODO -- Add UI to warn about and optionally allow requested capabilities

            ActiveWidgetStore.setWidgetCapabilities(this.props.id, requestedWhitelistCapabilies);

            if (this.props.onCapabilityRequest) {
                this.props.onCapabilityRequest(requestedCapabilities);
            }
        }).catch((err) => {
            console.log(`Failed to get capabilities for widget type ${this.props.type}`, this.props.id, err);
        });
    }

    _onAction(payload) {
        if (payload.widgetId === this.props.id) {
            switch (payload.action) {
                case 'm.sticker':
                if (this._hasCapability('m.sticker')) {
                    dis.dispatch({action: 'post_sticker_message', data: payload.data});
                } else {
                    console.warn('Ignoring sticker message. Invalid capability');
                }
                break;
            }
        }
    }

    /**
     * Set remote content title on AppTile
     * @param {string} url Url to check for title
     */
    _fetchWidgetTitle(url) {
        this._scalarClient.getScalarPageTitle(url).then((widgetPageTitle) => {
            if (widgetPageTitle) {
                this.setState({widgetPageTitle: widgetPageTitle});
            }
        }, (err) =>{
            console.error("Failed to get page title", err);
        });
    }

    /* TODO -- Store permission in account data so that it is persisted across multiple devices */
    _grantWidgetPermission() {
        console.warn('Granting permission to load widget - ', this.state.widgetUrl);
        localStorage.setItem(this.state.widgetPermissionId, true);
        this.setState({hasPermissionToLoad: true});
    }

    _revokeWidgetPermission() {
        console.warn('Revoking permission to load widget - ', this.state.widgetUrl);
        localStorage.removeItem(this.state.widgetPermissionId);
        this.setState({hasPermissionToLoad: false});

        // Force the widget to be non-persistent
        ActiveWidgetStore.destroyPersistentWidget();
        const PersistedElement = sdk.getComponent("elements.PersistedElement");
        PersistedElement.destroyElement(this._persistKey);
    }

    formatAppTileName() {
        let appTileName = "No name";
        if (this.props.name && this.props.name.trim()) {
            appTileName = this.props.name.trim();
        }
        return appTileName;
    }

    onClickMenuBar(ev) {
        ev.preventDefault();

        // Ignore clicks on menu bar children
        if (ev.target !== this.refs.menu_bar) {
            return;
        }

        // Toggle the view state of the apps drawer
        if (this.props.userWidget) {
            this._onMinimiseClick();
        } else {
            dis.dispatch({
                action: 'appsDrawer',
                show: !this.props.show,
            });
        }
    }

    _getSafeUrl() {
        const parsedWidgetUrl = url.parse(this.state.widgetUrl, true);
        if (ENABLE_REACT_PERF) {
            parsedWidgetUrl.search = null;
            parsedWidgetUrl.query.react_perf = true;
        }
        let safeWidgetUrl = '';
        if (ALLOWED_APP_URL_SCHEMES.indexOf(parsedWidgetUrl.protocol) !== -1) {
            safeWidgetUrl = url.format(parsedWidgetUrl);
        }
        return safeWidgetUrl;
    }

    _getTileTitle() {
        const name = this.formatAppTileName();
        const titleSpacer = <span>&nbsp;-&nbsp;</span>;
        let title = '';
        if (this.state.widgetPageTitle && this.state.widgetPageTitle != this.formatAppTileName()) {
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

    _onPopoutWidgetClick(e) {
        // Using Object.assign workaround as the following opens in a new window instead of a new tab.
        // window.open(this._getSafeUrl(), '_blank', 'noopener=yes');
        Object.assign(document.createElement('a'),
            { target: '_blank', href: this._getSafeUrl(), rel: 'noopener'}).click();
    }

    _onReloadWidgetClick(e) {
        // Reload iframe in this way to avoid cross-origin restrictions
        this.refs.appFrame.src = this.refs.appFrame.src;
    }

    render() {
        let appTileBody;

        // Don't render widget if it is in the process of being deleted
        if (this.state.deleting) {
            return <div></div>;
        }

        // Note that there is advice saying allow-scripts shouldn't be used with allow-same-origin
        // because that would allow the iframe to prgramatically remove the sandbox attribute, but
        // this would only be for content hosted on the same origin as the riot client: anything
        // hosted on the same origin as the client will get the same access as if you clicked
        // a link to it.
        const sandboxFlags = "allow-forms allow-popups allow-popups-to-escape-sandbox "+
            "allow-same-origin allow-scripts allow-presentation";

        // Additional iframe feature pemissions
        // (see - https://sites.google.com/a/chromium.org/dev/Home/chromium-security/deprecating-permissions-in-cross-origin-iframes and https://wicg.github.io/feature-policy/)
        const iframeFeatures = "microphone; camera; encrypted-media; autoplay;";

        const appTileBodyClass = 'mx_AppTileBody' + (this.props.miniMode ? '_mini  ' : ' ');

        if (this.props.show) {
            const loadingElement = (
                <div className="mx_AppLoading_spinner_fadeIn">
                    <MessageSpinner msg='Loading...' />
                </div>
            );
            if (this.state.initialising) {
                appTileBody = (
                    <div className={appTileBodyClass + (this.state.loading ? 'mx_AppLoading' : '')}>
                        { loadingElement }
                    </div>
                );
            } else if (this.state.hasPermissionToLoad == true) {
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
                            { /*
                                The "is" attribute in the following iframe tag is needed in order to enable rendering of the
                                "allow" attribute, which is unknown to react 15.
                            */ }
                            <iframe
                                is
                                allow={iframeFeatures}
                                ref="appFrame"
                                src={this._getSafeUrl()}
                                allowFullScreen="true"
                                sandbox={sandboxFlags}
                                onLoad={this._onLoaded}
                            ></iframe>
                        </div>
                    );
                    // if the widget would be allowed to remian on screen, we must put it in
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
            } else {
                const isRoomEncrypted = MatrixClientPeg.get().isRoomEncrypted(this.props.room.roomId);
                appTileBody = (
                    <div className={appTileBodyClass}>
                        <AppPermission
                            isRoomEncrypted={isRoomEncrypted}
                            url={this.state.widgetUrl}
                            onPermissionGranted={this._grantWidgetPermission}
                        />
                    </div>
                );
            }
        }

        // editing is done in scalar
        const canUserModify = this._canUserModify();
        const showEditButton = Boolean(this._scalarClient && canUserModify);
        const showDeleteButton = (this.props.showDelete === undefined || this.props.showDelete) && canUserModify;
        const showCancelButton = (this.props.showCancel === undefined || this.props.showCancel) && !showDeleteButton;
        // Picture snapshot - only show button when apps are maximised.
        const showPictureSnapshotButton = this._hasCapability('m.capability.screenshot') && this.props.show;
        const showMinimiseButton = this.props.showMinimise && this.props.show;
        const showMaximiseButton = this.props.showMinimise && !this.props.show;

        let appTileClass;
        if (this.props.miniMode) {
            appTileClass = 'mx_AppTile_mini';
        } else if (this.props.fullWidth) {
            appTileClass = 'mx_AppTileFullWidth';
        } else {
            appTileClass = 'mx_AppTile';
        }

        const menuBarClasses = classNames({
            mx_AppTileMenuBar: true,
            mx_AppTileMenuBar_expanded: this.props.show,
        });

        return (
            <div className={appTileClass} id={this.props.id}>
                { this.props.showMenubar &&
                <div ref="menu_bar" className={menuBarClasses} onClick={this.onClickMenuBar}>
                    <span className="mx_AppTileMenuBarTitle" style={{pointerEvents: (this.props.handleMinimisePointerEvents ? 'all' : false)}}>
                        { /* Minimise widget */ }
                        { showMinimiseButton && <AccessibleButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_minimise"
                            title={_t('Minimize apps')}
                            onClick={this._onMinimiseClick}
                        /> }
                        { /* Maximise widget */ }
                        { showMaximiseButton && <AccessibleButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_maximise"
                            title={_t('Maximize apps')}
                            onClick={this._onMinimiseClick}
                        /> }
                        { /* Title */ }
                        { this.props.showTitle && this._getTileTitle() }
                    </span>
                    <span className="mx_AppTileMenuBarWidgets">
                        { /* Reload widget */ }
                        { this.props.showReload && <AccessibleButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_reload"
                            title={_t('Reload widget')}
                            onClick={this._onReloadWidgetClick}
                        /> }
                        { /* Popout widget */ }
                        { this.props.showPopout && <AccessibleButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_popout"
                            title={_t('Popout widget')}
                            onClick={this._onPopoutWidgetClick}
                        /> }
                        { /* Snapshot widget */ }
                        { showPictureSnapshotButton && <AccessibleButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_snapshot"
                            title={_t('Picture')}
                            onClick={this._onSnapshotClick}
                        /> }
                        { /* Edit widget */ }
                        { showEditButton && <AccessibleButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_edit"
                            title={_t('Edit')}
                            onClick={this._onEditClick}
                        /> }
                        { /* Delete widget */ }
                        { showDeleteButton && <AccessibleButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_delete"
                            title={_t('Delete widget')}
                            onClick={this._onDeleteClick}
                        /> }
                        { /* Cancel widget */ }
                        { showCancelButton && <AccessibleButton
                            className="mx_AppTileMenuBar_iconButton mx_AppTileMenuBar_iconButton_cancel"
                            title={_t('Revoke widget access')}
                            onClick={this._onCancelClick}
                        /> }
                    </span>
                </div> }
                { appTileBody }
            </div>
        );
    }
}

AppTile.displayName ='AppTile';

AppTile.propTypes = {
    id: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    room: PropTypes.object.isRequired,
    type: PropTypes.string.isRequired,
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
    // having to reload all of riot to get new widget content.
    showReload: PropTypes.bool,
    // Widget capabilities to allow by default (without user confirmation)
    // NOTE -- Use with caution. This is intended to aid better integration / UX
    // basic widget capabilities, e.g. injecting sticker message events.
    whitelistCapabilities: PropTypes.array,
    // Optional function to be called on widget capability request
    // Called with an array of the requested capabilities
    onCapabilityRequest: PropTypes.func,
    // Is this an instance of a user widget
    userWidget: PropTypes.bool,
};

AppTile.defaultProps = {
    url: "",
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
