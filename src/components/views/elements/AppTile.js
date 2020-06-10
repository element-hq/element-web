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
import qs from 'qs';
import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import WidgetMessaging from '../../../WidgetMessaging';
import AccessibleButton from './AccessibleButton';
import Modal from '../../../Modal';
import { _t } from '../../../languageHandler';
import * as sdk from '../../../index';
import AppPermission from './AppPermission';
import AppWarning from './AppWarning';
import MessageSpinner from './MessageSpinner';
import WidgetUtils from '../../../utils/WidgetUtils';
import dis from '../../../dispatcher/dispatcher';
import ActiveWidgetStore from '../../../stores/ActiveWidgetStore';
import classNames from 'classnames';
import {IntegrationManagers} from "../../../integrations/IntegrationManagers";
import SettingsStore, {SettingLevel} from "../../../settings/SettingsStore";
import {aboveLeftOf, ContextMenu, ContextMenuButton} from "../../structures/ContextMenu";
import PersistedElement from "./PersistedElement";
import {WidgetType} from "../../../widgets/WidgetType";
import {Capability} from "../../../widgets/WidgetApi";
import {sleep} from "../../../utils/promise";

const ALLOWED_APP_URL_SCHEMES = ['https:', 'http:'];
const ENABLE_REACT_PERF = false;

/**
 * Does template substitution on a URL (or any string). Variables will be
 * passed through encodeURIComponent.
 * @param {string} uriTemplate The path with template variables e.g. '/foo/$bar'.
 * @param {Object} variables The key/value pairs to replace the template
 * variables with. E.g. { '$bar': 'baz' }.
 * @return {string} The result of replacing all template variables e.g. '/foo/baz'.
 */
function uriFromTemplate(uriTemplate, variables) {
    let out = uriTemplate;
    for (const [key, val] of Object.entries(variables)) {
        out = out.replace(
            '$' + key, encodeURIComponent(val),
        );
    }
    return out;
}

export default class AppTile extends React.Component {
    constructor(props) {
        super(props);

        // The key used for PersistedElement
        this._persistKey = 'widget_' + this.props.app.id;

        this.state = this._getNewState(props);

        this._onAction = this._onAction.bind(this);
        this._onLoaded = this._onLoaded.bind(this);
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
        this._appFrame = createRef();
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
            const currentlyAllowedWidgets = SettingsStore.getValue("allowedWidgets", newProps.room.roomId);
            return !!currentlyAllowedWidgets[newProps.app.eventId];
        };

        const PersistedElement = sdk.getComponent("elements.PersistedElement");
        return {
            initialising: true, // True while we are mangling the widget URL
            // True while the iframe content is loading
            loading: this.props.waitForIframeLoad && !PersistedElement.isMounted(this._persistKey),
            widgetUrl: this._addWurlParams(newProps.app.url),
            // Assume that widget has permission to load if we are the user who
            // added it to the room, or if explicitly granted by the user
            hasPermissionToLoad: newProps.userId === newProps.creatorUserId || hasPermissionToLoad(),
            error: null,
            deleting: false,
            widgetPageTitle: newProps.widgetPageTitle,
            menuDisplayed: false,
        };
    }

    /**
     * Does the widget support a given capability
     * @param  {string}  capability Capability to check for
     * @return {Boolean}            True if capability supported
     */
    _hasCapability(capability) {
        return ActiveWidgetStore.widgetHasCapability(this.props.app.id, capability);
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
        try {
            const parsed = new URL(urlString);

            // TODO: Replace these with proper widget params
            // See https://github.com/matrix-org/matrix-doc/pull/1958/files#r405714833
            parsed.searchParams.set('widgetId', this.props.app.id);
            parsed.searchParams.set('parentUrl', window.location.href.split('#', 2)[0]);

            // Replace the encoded dollar signs back to dollar signs. They have no special meaning
            // in HTTP, but URL parsers encode them anyways.
            return parsed.toString().replace(/%24/g, '$');
        } catch (e) {
            console.error("Failed to add widget URL params:", e);
            return urlString;
        }
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
            this.setScalarToken();
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
            const PersistedElement = sdk.getComponent("elements.PersistedElement");
            PersistedElement.destroyElement(this._persistKey);
        }
    }

    // TODO: Generify the name of this function. It's not just scalar tokens.
    /**
     * Adds a scalar token to the widget URL, if required
     * Component initialisation is only complete when this function has resolved
     */
    setScalarToken() {
        if (!WidgetUtils.isScalarUrl(this.props.app.url)) {
            console.warn('Widget does not match integration manager, refusing to set auth token', url);
            this.setState({
                error: null,
                widgetUrl: this._addWurlParams(this.props.app.url),
                initialising: false,
            });
            return;
        }

        const managers = IntegrationManagers.sharedInstance();
        if (!managers.hasManager()) {
            console.warn("No integration manager - not setting scalar token", url);
            this.setState({
                error: null,
                widgetUrl: this._addWurlParams(this.props.app.url),
                initialising: false,
            });
            return;
        }

        // TODO: Pick the right manager for the widget

        const defaultManager = managers.getPrimaryManager();
        if (!WidgetUtils.isScalarUrl(defaultManager.apiUrl)) {
            console.warn('Unknown integration manager, refusing to set auth token', url);
            this.setState({
                error: null,
                widgetUrl: this._addWurlParams(this.props.app.url),
                initialising: false,
            });
            return;
        }

        // Fetch the token before loading the iframe as we need it to mangle the URL
        if (!this._scalarClient) {
            this._scalarClient = defaultManager.getScalarClient();
        }
        this._scalarClient.getScalarToken().then((token) => {
            // Append scalar_token as a query param if not already present
            this._scalarClient.scalarToken = token;
            const u = url.parse(this._addWurlParams(this.props.app.url));
            const params = qs.parse(u.query);
            if (!params.scalar_token) {
                params.scalar_token = encodeURIComponent(token);
                // u.search must be set to undefined, so that u.format() uses query parameters - https://nodejs.org/docs/latest/api/url.html#url_url_format_url_options
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

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps(nextProps) { // eslint-disable-line camelcase
        if (nextProps.app.url !== this.props.app.url) {
            this._getNewState(nextProps);
            // Fetch IM token for new URL if we're showing and have permission to load
            if (this.props.show && this.state.hasPermissionToLoad) {
                this.setScalarToken();
            }
        }

        if (nextProps.show && !this.props.show) {
            // We assume that persisted widgets are loaded and don't need a spinner.
            if (this.props.waitForIframeLoad && !PersistedElement.isMounted(this._persistKey)) {
                this.setState({
                    loading: true,
                });
            }
            // Fetch IM token now that we're showing if we already have permission to load
            if (this.state.hasPermissionToLoad) {
                this.setScalarToken();
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
            // TODO: Open the right manager for the widget
            if (SettingsStore.isFeatureEnabled("feature_many_integration_managers")) {
                IntegrationManagers.sharedInstance().openAll(
                    this.props.room,
                    'type_' + this.props.type,
                    this.props.app.id,
                );
            } else {
                IntegrationManagers.sharedInstance().getPrimaryManager().open(
                    this.props.room,
                    'type_' + this.props.type,
                    this.props.app.id,
                );
            }
        }
    }

    _onSnapshotClick() {
        console.log("Requesting widget snapshot");
        ActiveWidgetStore.getWidgetMessaging(this.props.app.id).getScreenshot()
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

    /**
     * Ends all widget interaction, such as cancelling calls and disabling webcams.
     * @private
     * @returns {Promise<*>} Resolves when the widget is terminated, or timeout passed.
     */
    _endWidgetActions() {
        let terminationPromise;

        if (this._hasCapability(Capability.ReceiveTerminate)) {
            // Wait for widget to terminate within a timeout
            const timeout = 2000;
            const messaging = ActiveWidgetStore.getWidgetMessaging(this.props.app.id);
            terminationPromise = Promise.race([messaging.terminate(), sleep(timeout)]);
        } else {
            terminationPromise = Promise.resolve();
        }

        return terminationPromise.finally(() => {
            // HACK: This is a really dirty way to ensure that Jitsi cleans up
            // its hold on the webcam. Without this, the widget holds a media
            // stream open, even after death. See https://github.com/vector-im/riot-web/issues/7351
            if (this._appFrame.current) {
                // In practice we could just do `+= ''` to trick the browser
                // into thinking the URL changed, however I can foresee this
                // being optimized out by a browser. Instead, we'll just point
                // the iframe at a page that is reasonably safe to use in the
                // event the iframe doesn't wink away.
                // This is relative to where the Riot instance is located.
                this._appFrame.current.src = 'about:blank';
            }

            // Delete the widget from the persisted store for good measure.
            PersistedElement.destroyElement(this._persistKey);
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

    _onRevokeClicked() {
        console.info("Revoke widget permissions - %s", this.props.app.id);
        this._revokeWidgetPermission();
    }

    /**
     * Called when widget iframe has finished loading
     */
    _onLoaded() {
        // Destroy the old widget messaging before starting it back up again. Some widgets
        // have startup routines that run when they are loaded, so we just need to reinitialize
        // the messaging for them.
        ActiveWidgetStore.delWidgetMessaging(this.props.app.id);
        this._setupWidgetMessaging();

        ActiveWidgetStore.setRoomId(this.props.app.id, this.props.room.roomId);
        this.setState({loading: false});
    }

    _setupWidgetMessaging() {
        // FIXME: There's probably no reason to do this here: it should probably be done entirely
        // in ActiveWidgetStore.
        const widgetMessaging = new WidgetMessaging(
            this.props.app.id,
            this.props.app.url,
            this._getRenderedUrl(),
            this.props.userWidget,
            this._appFrame.current.contentWindow,
        );
        ActiveWidgetStore.setWidgetMessaging(this.props.app.id, widgetMessaging);
        widgetMessaging.getCapabilities().then((requestedCapabilities) => {
            console.log(`Widget ${this.props.app.id} requested capabilities: ` + requestedCapabilities);
            requestedCapabilities = requestedCapabilities || [];

            // Allow whitelisted capabilities
            let requestedWhitelistCapabilies = [];

            if (this.props.whitelistCapabilities && this.props.whitelistCapabilities.length > 0) {
                requestedWhitelistCapabilies = requestedCapabilities.filter(function(e) {
                    return this.indexOf(e)>=0;
                }, this.props.whitelistCapabilities);

                if (requestedWhitelistCapabilies.length > 0 ) {
                    console.log(`Widget ${this.props.app.id} allowing requested, whitelisted properties: ` +
                        requestedWhitelistCapabilies,
                    );
                }
            }

            // TODO -- Add UI to warn about and optionally allow requested capabilities

            ActiveWidgetStore.setWidgetCapabilities(this.props.app.id, requestedWhitelistCapabilies);

            if (this.props.onCapabilityRequest) {
                this.props.onCapabilityRequest(requestedCapabilities);
            }

            // We only tell Jitsi widgets that we're ready because they're realistically the only ones
            // using this custom extension to the widget API.
            if (WidgetType.JITSI.matches(this.props.app.type)) {
                widgetMessaging.flagReadyToContinue();
            }
        }).catch((err) => {
            console.log(`Failed to get capabilities for widget type ${this.props.app.type}`, this.props.app.id, err);
        });
    }

    _onAction(payload) {
        if (payload.widgetId === this.props.app.id) {
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

    _grantWidgetPermission() {
        const roomId = this.props.room.roomId;
        console.info("Granting permission for widget to load: " + this.props.app.eventId);
        const current = SettingsStore.getValue("allowedWidgets", roomId);
        current[this.props.app.eventId] = true;
        SettingsStore.setValue("allowedWidgets", roomId, SettingLevel.ROOM_ACCOUNT, current).then(() => {
            this.setState({hasPermissionToLoad: true});

            // Fetch a token for the integration manager, now that we're allowed to
            this.setScalarToken();
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
     * Replace the widget template variables in a url with their values
     *
     * @param {string} u The URL with template variables
     * @param {string} widgetType The widget's type
     *
     * @returns {string} url with temlate variables replaced
     */
    _templatedUrl(u, widgetType: string) {
        const targetData = {};
        if (WidgetType.JITSI.matches(widgetType)) {
            targetData['domain'] = 'jitsi.riot.im'; // v1 jitsi widgets have this hardcoded
        }
        const myUserId = MatrixClientPeg.get().credentials.userId;
        const myUser = MatrixClientPeg.get().getUser(myUserId);
        const vars = Object.assign(targetData, this.props.app.data, {
            'matrix_user_id': myUserId,
            'matrix_room_id': this.props.room.roomId,
            'matrix_display_name': myUser ? myUser.displayName : myUserId,
            'matrix_avatar_url': myUser ? MatrixClientPeg.get().mxcUrlToHttp(myUser.avatarUrl) : '',

            // TODO: Namespace themes through some standard
            'theme': SettingsStore.getValue("theme"),
        });

        if (vars.conferenceId === undefined) {
            // we'll need to parse the conference ID out of the URL for v1 Jitsi widgets
            const parsedUrl = new URL(this.props.app.url);
            vars.conferenceId = parsedUrl.searchParams.get("confId");
        }

        return uriFromTemplate(u, vars);
    }

    /**
     * Get the URL used in the iframe
     * In cases where we supply our own UI for a widget, this is an internal
     * URL different to the one used if the widget is popped out to a separate
     * tab / browser
     *
     * @returns {string} url
     */
    _getRenderedUrl() {
        let url;

        if (WidgetType.JITSI.matches(this.props.app.type)) {
            console.log("Replacing Jitsi widget URL with local wrapper");
            url = WidgetUtils.getLocalJitsiWrapperUrl({forLocalRender: true});
            url = this._addWurlParams(url);
        } else {
            url = this._getSafeUrl(this.state.widgetUrl);
        }
        return this._templatedUrl(url, this.props.app.type);
    }

    _getPopoutUrl() {
        if (WidgetType.JITSI.matches(this.props.app.type)) {
            return this._templatedUrl(
                WidgetUtils.getLocalJitsiWrapperUrl({forLocalRender: false}),
                this.props.app.type,
            );
        } else {
            // use app.url, not state.widgetUrl, because we want the one without
            // the wURL params for the popped-out version.
            return this._templatedUrl(this._getSafeUrl(this.props.app.url), this.props.app.type);
        }
    }

    _getSafeUrl(u) {
        const parsedWidgetUrl = url.parse(u, true);
        if (ENABLE_REACT_PERF) {
            parsedWidgetUrl.search = null;
            parsedWidgetUrl.query.react_perf = true;
        }
        let safeWidgetUrl = '';
        if (ALLOWED_APP_URL_SCHEMES.includes(parsedWidgetUrl.protocol)) {
            safeWidgetUrl = url.format(parsedWidgetUrl);
        }

        // Replace all the dollar signs back to dollar signs as they don't affect HTTP at all.
        // We also need the dollar signs in-tact for variable substitution.
        return safeWidgetUrl.replace(/%24/g, '$');
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

    _onPopoutWidgetClick() {
        // Ensure Jitsi conferences are closed on pop-out, to not confuse the user to join them
        // twice from the same computer, which Jitsi can have problems with (audio echo/gain-loop).
        if (WidgetType.JITSI.matches(this.props.app.type) && this.props.show) {
            this._endWidgetActions().then(() => {
                if (this._appFrame.current) {
                    // Reload iframe
                    this._appFrame.current.src = this._getRenderedUrl();
                    this.setState({});
                }
            });
        }
        // Using Object.assign workaround as the following opens in a new window instead of a new tab.
        // window.open(this._getPopoutUrl(), '_blank', 'noopener=yes');
        Object.assign(document.createElement('a'),
            { target: '_blank', href: this._getPopoutUrl(), rel: 'noreferrer noopener'}).click();
    }

    _onReloadWidgetClick() {
        // Reload iframe in this way to avoid cross-origin restrictions
        this._appFrame.current.src = this._appFrame.current.src;
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
            if (!this.state.hasPermissionToLoad) {
                const isEncrypted = MatrixClientPeg.get().isRoomEncrypted(this.props.room.roomId);
                appTileBody = (
                    <div className={appTileBodyClass}>
                        <AppPermission
                            roomId={this.props.room.roomId}
                            creatorUserId={this.props.creatorUserId}
                            url={this.state.widgetUrl}
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
                                ref={this._appFrame}
                                src={this._getRenderedUrl()}
                                allowFullScreen={true}
                                sandbox={sandboxFlags}
                                onLoad={this._onLoaded} />
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

        let contextMenu;
        if (this.state.menuDisplayed) {
            const elementRect = this._contextMenuButton.current.getBoundingClientRect();

            const canUserModify = this._canUserModify();
            const showEditButton = Boolean(this._scalarClient && canUserModify);
            const showDeleteButton = (this.props.showDelete === undefined || this.props.showDelete) && canUserModify;
            const showPictureSnapshotButton = this._hasCapability('m.capability.screenshot') && this.props.show;

            const WidgetContextMenu = sdk.getComponent('views.context_menus.WidgetContextMenu');
            contextMenu = (
                <ContextMenu {...aboveLeftOf(elementRect, null)} onFinished={this._closeContextMenu}>
                    <WidgetContextMenu
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
            <div className={appTileClass} id={this.props.app.id}>
                { this.props.showMenubar &&
                <div ref={this._menu_bar} className={menuBarClasses} onClick={this.onClickMenuBar}>
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
