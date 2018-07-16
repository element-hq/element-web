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
import PlatformPeg from '../../../PlatformPeg';
import ScalarAuthClient from '../../../ScalarAuthClient';
import WidgetMessaging from '../../../WidgetMessaging';
import TintableSvgButton from './TintableSvgButton';
import Modal from '../../../Modal';
import { _t, _td } from '../../../languageHandler';
import sdk from '../../../index';
import AppPermission from './AppPermission';
import AppWarning from './AppWarning';
import MessageSpinner from './MessageSpinner';
import WidgetUtils from '../../../utils/WidgetUtils';
import dis from '../../../dispatcher';
import ActiveWidgetStore from '../../../stores/ActiveWidgetStore';

const ALLOWED_APP_URL_SCHEMES = ['https:', 'http:'];
const ENABLE_REACT_PERF = false;

export default class AppTile extends React.Component {
    constructor(props) {
        super(props);

        // The key used for PersistedElement
        this._persistKey = 'widget_' + this.props.id;

        this.state = this._getNewState(props);

        this._onAction = this._onAction.bind(this);
        this._onMessage = this._onMessage.bind(this);
        this._onLoaded = this._onLoaded.bind(this);
        this._onEditClick = this._onEditClick.bind(this);
        this._onDeleteClick = this._onDeleteClick.bind(this);
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
        // Append current / parent URL
        params.parentUrl = window.location.href;
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
        // Legacy Jitsi widget messaging -- TODO replace this with standard widget
        // postMessaging API
        window.addEventListener('message', this._onMessage, false);

        // Widget action listeners
        this.dispatcherRef = dis.register(this._onAction);
    }

    componentWillUnmount() {
        // Widget action listeners
        dis.unregister(this.dispatcherRef);

        // Jitsi listener
        window.removeEventListener('message', this._onMessage);

        // if it's not remaining on screen, get rid of the PersistedElement container
        if (!ActiveWidgetStore.getWidgetPersistence(this.props.id)) {
            // FIXME: ActiveWidgetStore should probably worry about this?
            const PersistedElement = sdk.getComponent("elements.PersistedElement");
            PersistedElement.destroyElement(this._persistKey);
            ActiveWidgetStore.delWidgetMessaging(this.props.id);
            ActiveWidgetStore.delWidgetCapabilities(this.props.id);
            ActiveWidgetStore.delRoomId(this.props.id);
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

    // Legacy Jitsi widget messaging
    // TODO -- This should be replaced with the new widget postMessaging API
    _onMessage(event) {
        if (this.props.type !== 'jitsi') {
            return;
        }
        if (!event.origin) {
            event.origin = event.originalEvent.origin;
        }

        const widgetUrlObj = url.parse(this.state.widgetUrl);
        const eventOrigin = url.parse(event.origin);
        if (
            eventOrigin.protocol !== widgetUrlObj.protocol ||
            eventOrigin.host !== widgetUrlObj.host
        ) {
            return;
        }

        if (event.data.widgetAction === 'jitsi_iframe_loaded') {
            const iframe = this.refs.appFrame.contentWindow
                .document.querySelector('iframe[id^="jitsiConferenceFrame"]');
            PlatformPeg.get().setupScreenSharingForIframe(iframe);
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
            const src = this._scalarClient.getScalarInterfaceUrlForRoom(
                this.props.room, 'type_' + this.props.type, this.props.id);
            Modal.createTrackedDialog('Integrations Manager', '', IntegrationsManager, {
                src: src,
            }, "mx_IntegrationsManager");
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
        } else {
            if (this._canUserModify()) {
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

                        WidgetUtils.setRoomWidget(
                            this.props.room.roomId,
                            this.props.id,
                        ).catch((e) => {
                            console.error('Failed to delete widget', e);
                        }).finally(() => {
                            this.setState({deleting: false});
                        });
                    },
                });
            } else {
                console.log("Revoke widget permissions - %s", this.props.id);
                this._revokeWidgetPermission();
            }
        }
    }

    /**
     * Called when widget iframe has finished loading
     */
    _onLoaded() {
        if (!ActiveWidgetStore.getWidgetMessaging(this.props.id)) {
            this._setupWidgetMessaging();
        }
        ActiveWidgetStore.setRoomId(this.props.id, this.props.room.roomId);
        this.setState({loading: false});
    }

    _setupWidgetMessaging() {
        // FIXME: There's probably no reason to do this here: it should probably be done entirely
        // in ActiveWidgetStore.
        const widgetMessaging = new WidgetMessaging(this.props.id, this.props.url, this.refs.appFrame.contentWindow);
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

    // Widget labels to render, depending upon user permissions
    // These strings are translated at the point that they are inserted in to the DOM, in the render method
    _deleteWidgetLabel() {
        if (this._canUserModify()) {
            return _td('Delete widget');
        }
        return _td('Revoke widget access');
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
        dis.dispatch({
            action: 'appsDrawer',
            show: !this.props.show,
        });
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
        // window.open(this._getSafeUrl(), '_blank', 'noopener=yes,noreferrer=yes');
        Object.assign(document.createElement('a'),
            { target: '_blank', href: this._getSafeUrl(), rel: 'noopener noreferrer'}).click();
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
        const iframeFeatures = "microphone; camera; encrypted-media;";

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
                        appTileBody = <PersistedElement persistKey={this._persistKey}>
                            {appTileBody}
                        </PersistedElement>;
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
        const showEditButton = Boolean(this._scalarClient && this._canUserModify());
        const deleteWidgetLabel = this._deleteWidgetLabel();
        let deleteIcon = 'img/cancel_green.svg';
        let deleteClasses = 'mx_AppTileMenuBarWidget';
        if (this._canUserModify()) {
            deleteIcon = 'img/icon-delete-pink.svg';
            deleteClasses += ' mx_AppTileMenuBarWidgetDelete';
        }

        // Picture snapshot - only show button when apps are maximised.
        const showPictureSnapshotButton = this._hasCapability('m.capability.screenshot') && this.props.show;
        const showPictureSnapshotIcon = 'img/camera_green.svg';
        const popoutWidgetIcon = 'img/button-new-window.svg';
        const reloadWidgetIcon = 'img/button-refresh.svg';
        const windowStateIcon = (this.props.show ? 'img/minimize.svg' : 'img/maximize.svg');

        return (
            <div className={this.props.fullWidth ? "mx_AppTileFullWidth" : "mx_AppTile"} id={this.props.id}>
                { this.props.showMenubar &&
                <div ref="menu_bar" className="mx_AppTileMenuBar" onClick={this.onClickMenuBar}>
                    <span className="mx_AppTileMenuBarTitle" style={{pointerEvents: (this.props.handleMinimisePointerEvents ? 'all' : false)}}>
                        { this.props.showMinimise && <TintableSvgButton
                            src={windowStateIcon}
                            className="mx_AppTileMenuBarWidget mx_AppTileMenuBarWidgetPadding"
                            title={_t('Minimize apps')}
                            width="10"
                            height="10"
                            onClick={this._onMinimiseClick}
                        /> }
                        { this.props.showTitle && this._getTileTitle() }
                    </span>
                    <span className="mx_AppTileMenuBarWidgets">
                        { /* Reload widget */ }
                        { this.props.showReload && <TintableSvgButton
                            src={reloadWidgetIcon}
                            className="mx_AppTileMenuBarWidget mx_AppTileMenuBarWidgetPadding"
                            title={_t('Reload widget')}
                            onClick={this._onReloadWidgetClick}
                            width="10"
                            height="10"
                        /> }

                        { /* Popout widget */ }
                        { this.props.showPopout && <TintableSvgButton
                            src={popoutWidgetIcon}
                            className="mx_AppTileMenuBarWidget mx_AppTileMenuBarWidgetPadding"
                            title={_t('Popout widget')}
                            onClick={this._onPopoutWidgetClick}
                            width="10"
                            height="10"
                        /> }

                        { /* Snapshot widget */ }
                        { showPictureSnapshotButton && <TintableSvgButton
                            src={showPictureSnapshotIcon}
                            className="mx_AppTileMenuBarWidget mx_AppTileMenuBarWidgetPadding"
                            title={_t('Picture')}
                            onClick={this._onSnapshotClick}
                            width="10"
                            height="10"
                        /> }

                        { /* Edit widget */ }
                        { showEditButton && <TintableSvgButton
                            src="img/edit_green.svg"
                            className={"mx_AppTileMenuBarWidget " +
                              (this.props.showDelete ? "mx_AppTileMenuBarWidgetPadding" : "")}
                            title={_t('Edit')}
                            onClick={this._onEditClick}
                            width="10"
                            height="10"
                        /> }

                        { /* Delete widget */ }
                        { this.props.showDelete && <TintableSvgButton
                            src={deleteIcon}
                            className={deleteClasses}
                            title={_t(deleteWidgetLabel)}
                            onClick={this._onDeleteClick}
                            width="10"
                            height="10"
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
