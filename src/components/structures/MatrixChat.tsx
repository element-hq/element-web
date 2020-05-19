/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017-2019 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import React, { createRef } from 'react';
import { InvalidStoreError } from "matrix-js-sdk/src/errors";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { isCryptoAvailable } from 'matrix-js-sdk/src/crypto';
// focus-visible is a Polyfill for the :focus-visible CSS pseudo-attribute used by _AccessibleButton.scss
import 'focus-visible';
// what-input helps improve keyboard accessibility
import 'what-input';

import Analytics from "../../Analytics";
import { DecryptionFailureTracker } from "../../DecryptionFailureTracker";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import PlatformPeg from "../../PlatformPeg";
import SdkConfig from "../../SdkConfig";
import * as RoomListSorter from "../../RoomListSorter";
import dis from "../../dispatcher/dispatcher";
import Notifier from '../../Notifier';

import Modal from "../../Modal";
import Tinter from "../../Tinter";
import * as sdk from '../../index';
import { showRoomInviteDialog, showStartChatInviteDialog } from '../../RoomInvite';
import * as Rooms from '../../Rooms';
import linkifyMatrix from "../../linkify-matrix";
import * as Lifecycle from '../../Lifecycle';
// LifecycleStore is not used but does listen to and dispatch actions
import '../../stores/LifecycleStore';
import PageTypes from '../../PageTypes';
import { getHomePageUrl } from '../../utils/pages';

import createRoom from "../../createRoom";
import KeyRequestHandler from '../../KeyRequestHandler';
import { _t, getCurrentLanguage } from '../../languageHandler';
import SettingsStore, { SettingLevel } from "../../settings/SettingsStore";
import ThemeController from "../../settings/controllers/ThemeController";
import { startAnyRegistrationFlow } from "../../Registration.js";
import { messageForSyncError } from '../../utils/ErrorUtils';
import ResizeNotifier from "../../utils/ResizeNotifier";
import AutoDiscoveryUtils, { ValidatedServerConfig } from "../../utils/AutoDiscoveryUtils";
import DMRoomMap from '../../utils/DMRoomMap';
import { countRoomsWithNotif } from '../../RoomNotifs';
import { ThemeWatcher } from "../../theme";
import { storeRoomAliasInCache } from '../../RoomAliasCache';
import { defer, IDeferred } from "../../utils/promise";
import ToastStore from "../../stores/ToastStore";
import * as StorageManager from "../../utils/StorageManager";
import type LoggedInViewType from "./LoggedInView";
import { ViewUserPayload } from "../../dispatcher/payloads/ViewUserPayload";
import { Action } from "../../dispatcher/actions";

/** constants for MatrixChat.state.view */
export enum Views {
    // a special initial state which is only used at startup, while we are
    // trying to re-animate a matrix client or register as a guest.
    LOADING = 0,

    // we are showing the welcome view
    WELCOME = 1,

    // we are showing the login view
    LOGIN = 2,

    // we are showing the registration view
    REGISTER = 3,

    // completing the registration flow
    POST_REGISTRATION = 4,

    // showing the 'forgot password' view
    FORGOT_PASSWORD = 5,

    // showing flow to trust this new device with cross-signing
    COMPLETE_SECURITY = 6,

    // flow to setup SSSS / cross-signing on this account
    E2E_SETUP = 7,

    // we are logged in with an active matrix client.
    LOGGED_IN = 8,

    // We are logged out (invalid token) but have our local state again. The user
    // should log back in to rehydrate the client.
    SOFT_LOGOUT = 9,
}

// Actions that are redirected through the onboarding process prior to being
// re-dispatched. NOTE: some actions are non-trivial and would require
// re-factoring to be included in this list in future.
const ONBOARDING_FLOW_STARTERS = [
    Action.ViewUserSettings,
    'view_create_chat',
    'view_create_room',
    'view_create_group',
];

interface IScreen {
    screen: string;
    params?: object;
}

interface IRoomInfo {
    room_id?: string;
    room_alias?: string;
    event_id?: string;

    auto_join?: boolean;
    highlighted?: boolean;
    third_party_invite?: object;
    oob_data?: object;
    via_servers?: string[];
}

interface IProps { // TODO type things better
    config: Record<string, any>;
    serverConfig?: ValidatedServerConfig;
    ConferenceHandler?: any;
    onNewScreen: (string) => void;
    enableGuest?: boolean;
    // the queryParams extracted from the [real] query-string of the URI
    realQueryParams?: Record<string, string>;
    // the initial queryParams extracted from the hash-fragment of the URI
    startingFragmentQueryParams?: Record<string, string>;
    // called when we have completed a token login
    onTokenLoginCompleted?: () => void;
    // Represents the screen to display as a result of parsing the initial window.location
    initialScreenAfterLogin?: IScreen;
    // displayname, if any, to set on the device when logging in/registering.
    defaultDeviceDisplayName?: string,
    // A function that makes a registration URL
    makeRegistrationUrl: (object) => string,
}

interface IState {
    // the master view we are showing.
    view: Views;
    // What the LoggedInView would be showing if visible
    page_type?: PageTypes;
    // The ID of the room we're viewing. This is either populated directly
    // in the case where we view a room by ID or by RoomView when it resolves
    // what ID an alias points at.
    currentRoomId?: string;
    currentGroupId?: string;
    currentGroupIsNew?: boolean;
    // If we're trying to just view a user ID (i.e. /user URL), this is it
    currentUserId?: string;
    // this is persisted as mx_lhs_size, loaded in LoggedInView
    collapseLhs: boolean;
    leftDisabled: boolean;
    middleDisabled: boolean;
    // the right panel's disabled state is tracked in its store.
    version?: string;
    newVersion?: string;
    hasNewVersion: boolean;
    newVersionReleaseNotes?: string;
    checkingForUpdate?: string; // updateCheckStatusEnum
    showCookieBar: boolean;
    // Parameters used in the registration dance with the IS
    register_client_secret?: string;
    register_session_id?: string;
    register_id_sid?: string;
    // When showing Modal dialogs we need to set aria-hidden on the root app element
    // and disable it when there are no dialogs
    hideToSRUsers: boolean;
    syncError?: Error;
    resizeNotifier: ResizeNotifier;
    showNotifierToolbar: boolean;
    serverConfig?: ValidatedServerConfig;
    ready: boolean;
    thirdPartyInvite?: object;
    roomOobData?: object;
    viaServers?: string[];
    pendingInitialSync?: boolean;
}

export default class MatrixChat extends React.PureComponent<IProps, IState> {
    static displayName = "MatrixChat";

    static defaultProps = {
        realQueryParams: {},
        startingFragmentQueryParams: {},
        config: {},
        onTokenLoginCompleted: () => {},
    };

    firstSyncComplete: boolean;
    firstSyncPromise: IDeferred<void>;

    private screenAfterLogin?: IScreen;
    private windowWidth: number;
    private pageChanging: boolean;
    private accountPassword?: string;
    private accountPasswordTimer?: NodeJS.Timeout;
    private focusComposer: boolean;
    private subTitleStatus: string;

    private readonly loggedInView: React.RefObject<LoggedInViewType>;
    private readonly dispatcherRef: any;
    private readonly themeWatcher: ThemeWatcher;

    constructor(props, context) {
        super(props, context);

        this.state = {
            view: Views.LOADING,
            collapseLhs: false,
            leftDisabled: false,
            middleDisabled: false,

            hasNewVersion: false,
            newVersionReleaseNotes: null,
            checkingForUpdate: null,

            showCookieBar: false,

            hideToSRUsers: false,

            syncError: null, // If the current syncing status is ERROR, the error object, otherwise null.
            resizeNotifier: new ResizeNotifier(),
            showNotifierToolbar: false,
            ready: false,
        };

        this.loggedInView = createRef();

        SdkConfig.put(this.props.config);

        // Used by _viewRoom before getting state from sync
        this.firstSyncComplete = false;
        this.firstSyncPromise = defer();

        if (this.props.config.sync_timeline_limit) {
            MatrixClientPeg.opts.initialSyncLimit = this.props.config.sync_timeline_limit;
        }

        // a thing to call showScreen with once login completes.  this is kept
        // outside this.state because updating it should never trigger a
        // rerender.
        this.screenAfterLogin = this.props.initialScreenAfterLogin;

        this.windowWidth = 10000;
        this.handleResize();
        window.addEventListener('resize', this.handleResize);

        this.pageChanging = false;

        // check we have the right tint applied for this theme.
        // N.B. we don't call the whole of setTheme() here as we may be
        // racing with the theme CSS download finishing from index.js
        Tinter.tint();

        // For PersistentElement
        this.state.resizeNotifier.on("middlePanelResized", this.dispatchTimelineResize);

        // Force users to go through the soft logout page if they're soft logged out
        if (Lifecycle.isSoftLogout()) {
            // When the session loads it'll be detected as soft logged out and a dispatch
            // will be sent out to say that, triggering this MatrixChat to show the soft
            // logout page.
            Lifecycle.loadSession({});
        }

        this.accountPassword = null;
        this.accountPasswordTimer = null;

        this.dispatcherRef = dis.register(this.onAction);
        this.themeWatcher = new ThemeWatcher();
        this.themeWatcher.start();

        this.focusComposer = false;

        // object field used for tracking the status info appended to the title tag.
        // we don't do it as react state as i'm scared about triggering needless react refreshes.
        this.subTitleStatus = '';

        // this can technically be done anywhere but doing this here keeps all
        // the routing url path logic together.
        if (this.onAliasClick) {
            linkifyMatrix.onAliasClick = this.onAliasClick;
        }
        if (this.onUserClick) {
            linkifyMatrix.onUserClick = this.onUserClick;
        }
        if (this.onGroupClick) {
            linkifyMatrix.onGroupClick = this.onGroupClick;
        }

        // the first thing to do is to try the token params in the query-string
        // if the session isn't soft logged out (ie: is a clean session being logged in)
        if (!Lifecycle.isSoftLogout()) {
            Lifecycle.attemptTokenLogin(
                this.props.realQueryParams,
                this.props.defaultDeviceDisplayName,
            ).then((loggedIn) => {
                if (loggedIn) {
                    this.props.onTokenLoginCompleted();

                    // don't do anything else until the page reloads - just stay in
                    // the 'loading' state.
                    return;
                }

                // if the user has followed a login or register link, don't reanimate
                // the old creds, but rather go straight to the relevant page
                const firstScreen = this.screenAfterLogin ? this.screenAfterLogin.screen : null;

                if (firstScreen === 'login' ||
                    firstScreen === 'register' ||
                    firstScreen === 'forgot_password') {
                    this.showScreenAfterLogin();
                    return;
                }

                return this.loadSession();
            });
        }

        if (SettingsStore.getValue("showCookieBar")) {
            this.setState({
                showCookieBar: true,
            });
        }

        if (SettingsStore.getValue("analyticsOptIn")) {
            Analytics.enable();
        }
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle stage
    UNSAFE_componentWillUpdate(props, state) {
        if (this.shouldTrackPageChange(this.state, state)) {
            this.startPageChangeTimer();
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.shouldTrackPageChange(prevState, this.state)) {
            const durationMs = this.stopPageChangeTimer();
            Analytics.trackPageChange(durationMs);
        }
        if (this.focusComposer) {
            dis.dispatch({action: 'focus_composer'});
            this.focusComposer = false;
        }
    }

    componentWillUnmount() {
        Lifecycle.stopMatrixClient();
        dis.unregister(this.dispatcherRef);
        this.themeWatcher.stop();
        window.removeEventListener('resize', this.handleResize);
        this.state.resizeNotifier.removeListener("middlePanelResized", this.dispatchTimelineResize);

        if (this.accountPasswordTimer !== null) clearTimeout(this.accountPasswordTimer);
    }

    getFallbackHsUrl() {
        if (this.props.serverConfig && this.props.serverConfig.isDefault) {
            return this.props.config.fallback_hs_url;
        } else {
            return null;
        }
    }

    getServerProperties() {
        let props = this.state.serverConfig;
        if (!props) props = this.props.serverConfig; // for unit tests
        if (!props) props = SdkConfig.get()["validated_server_config"];
        return {serverConfig: props};
    }

    private loadSession() {
        // the extra Promise.resolve() ensures that synchronous exceptions hit the same codepath as
        // asynchronous ones.
        return Promise.resolve().then(() => {
            return Lifecycle.loadSession({
                fragmentQueryParams: this.props.startingFragmentQueryParams,
                enableGuest: this.props.enableGuest,
                guestHsUrl: this.getServerProperties().serverConfig.hsUrl,
                guestIsUrl: this.getServerProperties().serverConfig.isUrl,
                defaultDeviceDisplayName: this.props.defaultDeviceDisplayName,
            });
        }).then((loadedSession) => {
            if (!loadedSession) {
                // fall back to showing the welcome screen
                dis.dispatch({action: "view_welcome_page"});
            }
        });
        // Note we don't catch errors from this: we catch everything within
        // loadSession as there's logic there to ask the user if they want
        // to try logging out.
    }

    startPageChangeTimer() {
        // Tor doesn't support performance
        if (!performance || !performance.mark) return null;

        // This shouldn't happen because UNSAFE_componentWillUpdate and componentDidUpdate
        // are used.
        if (this.pageChanging) {
            console.warn('MatrixChat.startPageChangeTimer: timer already started');
            return;
        }
        this.pageChanging = true;
        performance.mark('riot_MatrixChat_page_change_start');
    }

    stopPageChangeTimer() {
        // Tor doesn't support performance
        if (!performance || !performance.mark) return null;

        if (!this.pageChanging) {
            console.warn('MatrixChat.stopPageChangeTimer: timer not started');
            return;
        }
        this.pageChanging = false;
        performance.mark('riot_MatrixChat_page_change_stop');
        performance.measure(
            'riot_MatrixChat_page_change_delta',
            'riot_MatrixChat_page_change_start',
            'riot_MatrixChat_page_change_stop',
        );
        performance.clearMarks('riot_MatrixChat_page_change_start');
        performance.clearMarks('riot_MatrixChat_page_change_stop');
        const measurement = performance.getEntriesByName('riot_MatrixChat_page_change_delta').pop();

        // In practice, sometimes the entries list is empty, so we get no measurement
        if (!measurement) return null;

        return measurement.duration;
    }

    shouldTrackPageChange(prevState: IState, state: IState) {
        return prevState.currentRoomId !== state.currentRoomId ||
            prevState.view !== state.view ||
            prevState.page_type !== state.page_type;
    }

    setStateForNewView(state: Partial<IState>) {
        if (state.view === undefined) {
            throw new Error("setStateForNewView with no view!");
        }
        const newState = {
            currentUserId: null,
        };
        Object.assign(newState, state);
        this.setState(newState);
    }

    onAction = (payload) => {
        // console.log(`MatrixClientPeg.onAction: ${payload.action}`);
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");

        // Start the onboarding process for certain actions
        if (MatrixClientPeg.get() && MatrixClientPeg.get().isGuest() &&
            ONBOARDING_FLOW_STARTERS.includes(payload.action)
        ) {
            // This will cause `payload` to be dispatched later, once a
            // sync has reached the "prepared" state. Setting a matrix ID
            // will cause a full login and sync and finally the deferred
            // action will be dispatched.
            dis.dispatch({
                action: 'do_after_sync_prepared',
                deferred_action: payload,
            });
            dis.dispatch({action: 'require_registration'});
            return;
        }

        switch (payload.action) {
            case 'MatrixActions.accountData':
                // XXX: This is a collection of several hacks to solve a minor problem. We want to
                // update our local state when the ID server changes, but don't want to put that in
                // the js-sdk as we'd be then dictating how all consumers need to behave. However,
                // this component is already bloated and we probably don't want this tiny logic in
                // here, but there's no better place in the react-sdk for it. Additionally, we're
                // abusing the MatrixActionCreator stuff to avoid errors on dispatches.
                if (payload.event_type === 'm.identity_server') {
                    const fullUrl = payload.event_content ? payload.event_content['base_url'] : null;
                    if (!fullUrl) {
                        MatrixClientPeg.get().setIdentityServerUrl(null);
                        localStorage.removeItem("mx_is_access_token");
                        localStorage.removeItem("mx_is_url");
                    } else {
                        MatrixClientPeg.get().setIdentityServerUrl(fullUrl);
                        localStorage.removeItem("mx_is_access_token"); // clear token
                        localStorage.setItem("mx_is_url", fullUrl); // XXX: Do we still need this?
                    }

                    // redispatch the change with a more specific action
                    dis.dispatch({action: 'id_server_changed'});
                }
                break;
            case 'logout':
                Lifecycle.logout();
                break;
            case 'require_registration':
                startAnyRegistrationFlow(payload);
                break;
            case 'start_registration':
                if (Lifecycle.isSoftLogout()) {
                    this.onSoftLogout();
                    break;
                }
                // This starts the full registration flow
                if (payload.screenAfterLogin) {
                    this.screenAfterLogin = payload.screenAfterLogin;
                }
                this.startRegistration(payload.params || {});
                break;
            case 'start_login':
                if (Lifecycle.isSoftLogout()) {
                    this.onSoftLogout();
                    break;
                }
                if (payload.screenAfterLogin) {
                    this.screenAfterLogin = payload.screenAfterLogin;
                }
                this.setStateForNewView({
                    view: Views.LOGIN,
                });
                this.notifyNewScreen('login');
                ThemeController.isLogin = true;
                this.themeWatcher.recheck();
                break;
            case 'start_post_registration':
                this.setState({
                    view: Views.POST_REGISTRATION,
                });
                break;
            case 'start_password_recovery':
                this.setStateForNewView({
                    view: Views.FORGOT_PASSWORD,
                });
                this.notifyNewScreen('forgot_password');
                break;
            case 'start_chat':
                createRoom({
                    dmUserId: payload.user_id,
                });
                break;
            case 'leave_room':
                this.leaveRoom(payload.room_id);
                break;
            case 'reject_invite':
                Modal.createTrackedDialog('Reject invitation', '', QuestionDialog, {
                    title: _t('Reject invitation'),
                    description: _t('Are you sure you want to reject the invitation?'),
                    onFinished: (confirm) => {
                        if (confirm) {
                            // FIXME: controller shouldn't be loading a view :(
                            const Loader = sdk.getComponent("elements.Spinner");
                            const modal = Modal.createDialog(Loader, null, 'mx_Dialog_spinner');

                            MatrixClientPeg.get().leave(payload.room_id).then(() => {
                                modal.close();
                                if (this.state.currentRoomId === payload.room_id) {
                                    dis.dispatch({action: 'view_next_room'});
                                }
                            }, (err) => {
                                modal.close();
                                Modal.createTrackedDialog('Failed to reject invitation', '', ErrorDialog, {
                                    title: _t('Failed to reject invitation'),
                                    description: err.toString(),
                                });
                            });
                        }
                    },
                });
                break;
            case 'view_user_info':
                this.viewUser(payload.userId, payload.subAction);
                break;
            case 'view_room': {
                // Takes either a room ID or room alias: if switching to a room the client is already
                // known to be in (eg. user clicks on a room in the recents panel), supply the ID
                // If the user is clicking on a room in the context of the alias being presented
                // to them, supply the room alias. If both are supplied, the room ID will be ignored.
                const promise = this.viewRoom(payload);
                if (payload.deferred_action) {
                    promise.then(() => {
                        dis.dispatch(payload.deferred_action);
                    });
                }
                break;
            }
            case 'view_prev_room':
                this.viewNextRoom(-1);
                break;
            case 'view_next_room':
                this.viewNextRoom(1);
                break;
            case 'view_indexed_room':
                this.viewIndexedRoom(payload.roomIndex);
                break;
            case Action.ViewUserSettings: {
                const UserSettingsDialog = sdk.getComponent("dialogs.UserSettingsDialog");
                Modal.createTrackedDialog('User settings', '', UserSettingsDialog, {},
                    /*className=*/null, /*isPriority=*/false, /*isStatic=*/true);

                // View the welcome or home page if we need something to look at
                this.viewSomethingBehindModal();
                break;
            }
            case 'view_create_room':
                this.createRoom(payload.public);
                break;
            case 'view_create_group': {
                const CreateGroupDialog = sdk.getComponent("dialogs.CreateGroupDialog");
                Modal.createTrackedDialog('Create Community', '', CreateGroupDialog);
                break;
            }
            case 'view_room_directory': {
                const RoomDirectory = sdk.getComponent("structures.RoomDirectory");
                Modal.createTrackedDialog('Room directory', '', RoomDirectory, {},
                    'mx_RoomDirectory_dialogWrapper', false, true);

                // View the welcome or home page if we need something to look at
                this.viewSomethingBehindModal();
                break;
            }
            case 'view_my_groups':
                this.setPage(PageTypes.MyGroups);
                this.notifyNewScreen('groups');
                break;
            case 'view_group':
                this.viewGroup(payload);
                break;
            case 'view_welcome_page':
                this.viewWelcome();
                break;
            case 'view_home_page':
                this.viewHome();
                break;
            case 'view_set_mxid':
                this.setMxId(payload);
                break;
            case 'view_start_chat_or_reuse':
                this.chatCreateOrReuse(payload.user_id);
                break;
            case 'view_create_chat':
                showStartChatInviteDialog();
                break;
            case 'view_invite':
                showRoomInviteDialog(payload.roomId);
                break;
            case 'view_last_screen':
                // This function does what we want, despite the name. The idea is that it shows
                // the last room we were looking at or some reasonable default/guess. We don't
                // have to worry about email invites or similar being re-triggered because the
                // function will have cleared that state and not execute that path.
                this.showScreenAfterLogin();
                break;
            case 'toggle_my_groups':
                // We just dispatch the page change rather than have to worry about
                // what the logic is for each of these branches.
                if (this.state.page_type === PageTypes.MyGroups) {
                    dis.dispatch({action: 'view_last_screen'});
                } else {
                    dis.dispatch({action: 'view_my_groups'});
                }
                break;
            case 'notifier_enabled':
                this.setState({showNotifierToolbar: Notifier.shouldShowToolbar()});
                break;
            case 'hide_left_panel':
                this.setState({
                    collapseLhs: true,
                });
                break;
            case 'focus_room_filter': // for CtrlOrCmd+K to work by expanding the left panel first
            case 'show_left_panel':
                this.setState({
                    collapseLhs: false,
                });
                break;
            case 'panel_disable': {
                this.setState({
                    leftDisabled: payload.leftDisabled || payload.sideDisabled || false,
                    middleDisabled: payload.middleDisabled || false,
                    // We don't track the right panel being disabled here - it's tracked in the store.
                });
                break;
            }
            case 'on_logged_in':
                if (
                    !Lifecycle.isSoftLogout() &&
                    this.state.view !== Views.LOGIN &&
                    this.state.view !== Views.REGISTER &&
                    this.state.view !== Views.COMPLETE_SECURITY &&
                    this.state.view !== Views.E2E_SETUP
                ) {
                    this.onLoggedIn();
                }
                break;
            case 'on_client_not_viable':
                this.onSoftLogout();
                break;
            case 'on_logged_out':
                this.onLoggedOut();
                break;
            case 'will_start_client':
                this.setState({ready: false}, () => {
                    // if the client is about to start, we are, by definition, not ready.
                    // Set ready to false now, then it'll be set to true when the sync
                    // listener we set below fires.
                    this.onWillStartClient();
                });
                break;
            case 'client_started':
                this.onClientStarted();
                break;
            case 'new_version':
                this.onVersion(
                    payload.currentVersion, payload.newVersion,
                    payload.releaseNotes,
                );
                break;
            case 'check_updates':
                this.setState({ checkingForUpdate: payload.value });
                break;
            case 'send_event':
                this.onSendEvent(payload.room_id, payload.event);
                break;
            case 'aria_hide_main_app':
                this.setState({
                    hideToSRUsers: true,
                });
                break;
            case 'aria_unhide_main_app':
                this.setState({
                    hideToSRUsers: false,
                });
                break;
            case 'accept_cookies':
                SettingsStore.setValue("analyticsOptIn", null, SettingLevel.DEVICE, true);
                SettingsStore.setValue("showCookieBar", null, SettingLevel.DEVICE, false);

                this.setState({
                    showCookieBar: false,
                });
                Analytics.enable();
                break;
            case 'reject_cookies':
                SettingsStore.setValue("analyticsOptIn", null, SettingLevel.DEVICE, false);
                SettingsStore.setValue("showCookieBar", null, SettingLevel.DEVICE, false);

                this.setState({
                    showCookieBar: false,
                });
                break;
        }
    };

    private setPage(pageType: string) {
        this.setState({
            page_type: pageType,
        });
    }

    private async startRegistration(params: {[key: string]: string}) {
        const newState: Partial<IState> = {
            view: Views.REGISTER,
        };

        // Only honour params if they are all present, otherwise we reset
        // HS and IS URLs when switching to registration.
        if (params.client_secret &&
            params.session_id &&
            params.hs_url &&
            params.is_url &&
            params.sid
        ) {
            newState.serverConfig = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(
                params.hs_url, params.is_url,
            );

            newState.register_client_secret = params.client_secret;
            newState.register_session_id = params.session_id;
            newState.register_id_sid = params.sid;
        }

        this.setStateForNewView(newState);
        ThemeController.isLogin = true;
        this.themeWatcher.recheck();
        this.notifyNewScreen('register');
    }

    // TODO: Move to RoomViewStore
    private viewNextRoom(roomIndexDelta: number) {
        const allRooms = RoomListSorter.mostRecentActivityFirst(
            MatrixClientPeg.get().getRooms(),
        );
        // If there are 0 rooms or 1 room, view the home page because otherwise
        // if there are 0, we end up trying to index into an empty array, and
        // if there is 1, we end up viewing the same room.
        if (allRooms.length < 2) {
            dis.dispatch({
                action: 'view_home_page',
            });
            return;
        }
        let roomIndex = -1;
        for (let i = 0; i < allRooms.length; ++i) {
            if (allRooms[i].roomId === this.state.currentRoomId) {
                roomIndex = i;
                break;
            }
        }
        roomIndex = (roomIndex + roomIndexDelta) % allRooms.length;
        if (roomIndex < 0) roomIndex = allRooms.length - 1;
        dis.dispatch({
            action: 'view_room',
            room_id: allRooms[roomIndex].roomId,
        });
    }

    // TODO: Move to RoomViewStore
    private viewIndexedRoom(roomIndex: number) {
        const allRooms = RoomListSorter.mostRecentActivityFirst(
            MatrixClientPeg.get().getRooms(),
        );
        if (allRooms[roomIndex]) {
            dis.dispatch({
                action: 'view_room',
                room_id: allRooms[roomIndex].roomId,
            });
        }
    }

    // switch view to the given room
    //
    // @param {Object} roomInfo Object containing data about the room to be joined
    // @param {string=} roomInfo.room_id ID of the room to join. One of room_id or room_alias must be given.
    // @param {string=} roomInfo.room_alias Alias of the room to join. One of room_id or room_alias must be given.
    // @param {boolean=} roomInfo.auto_join If true, automatically attempt to join the room if not already a member.
    // @param {string=} roomInfo.event_id ID of the event in this room to show: this will cause a switch to the
    //                                    context of that particular event.
    // @param {boolean=} roomInfo.highlighted If true, add event_id to the hash of the URL
    //                                        and alter the EventTile to appear highlighted.
    // @param {Object=} roomInfo.third_party_invite Object containing data about the third party
    //                                    we received to join the room, if any.
    // @param {string=} roomInfo.third_party_invite.inviteSignUrl 3pid invite sign URL
    // @param {string=} roomInfo.third_party_invite.invitedEmail The email address the invite was sent to
    // @param {Object=} roomInfo.oob_data Object of additional data about the room
    //                               that has been passed out-of-band (eg.
    //                               room name and avatar from an invite email)
    private viewRoom(roomInfo: IRoomInfo) {
        this.focusComposer = true;

        if (roomInfo.room_alias) {
            console.log(
                `Switching to room alias ${roomInfo.room_alias} at event ` +
                roomInfo.event_id,
            );
        } else {
            console.log(`Switching to room id ${roomInfo.room_id} at event ` +
                roomInfo.event_id,
            );
        }

        // Wait for the first sync to complete so that if a room does have an alias,
        // it would have been retrieved.
        let waitFor = Promise.resolve(null);
        if (!this.firstSyncComplete) {
            if (!this.firstSyncPromise) {
                console.warn('Cannot view a room before first sync. room_id:', roomInfo.room_id);
                return;
            }
            waitFor = this.firstSyncPromise.promise;
        }

        return waitFor.then(() => {
            let presentedId = roomInfo.room_alias || roomInfo.room_id;
            const room = MatrixClientPeg.get().getRoom(roomInfo.room_id);
            if (room) {
                const theAlias = Rooms.getDisplayAliasForRoom(room);
                if (theAlias) {
                    presentedId = theAlias;
                    // Store display alias of the presented room in cache to speed future
                    // navigation.
                    storeRoomAliasInCache(theAlias, room.roomId);
                }

                // Store this as the ID of the last room accessed. This is so that we can
                // persist which room is being stored across refreshes and browser quits.
                if (localStorage) {
                    localStorage.setItem('mx_last_room_id', room.roomId);
                }
            }

            if (roomInfo.event_id && roomInfo.highlighted) {
                presentedId += "/" + roomInfo.event_id;
            }
            this.setState({
                view: Views.LOGGED_IN,
                currentRoomId: roomInfo.room_id || null,
                page_type: PageTypes.RoomView,
                thirdPartyInvite: roomInfo.third_party_invite,
                roomOobData: roomInfo.oob_data,
                viaServers: roomInfo.via_servers,
                ready: true,
            }, () => {
                this.notifyNewScreen('room/' + presentedId);
            });
        });
    }

    private viewGroup(payload) {
        const groupId = payload.group_id;
        this.setState({
            currentGroupId: groupId,
            currentGroupIsNew: payload.group_is_new,
        });
        this.setPage(PageTypes.GroupView);
        this.notifyNewScreen('group/' + groupId);
    }

    private viewSomethingBehindModal() {
        if (this.state.view !== Views.LOGGED_IN) {
            this.viewWelcome();
            return;
        }
        if (!this.state.currentGroupId && !this.state.currentRoomId) {
            this.viewHome();
        }
    }

    private viewWelcome() {
        this.setStateForNewView({
            view: Views.WELCOME,
        });
        this.notifyNewScreen('welcome');
        ThemeController.isLogin = true;
        this.themeWatcher.recheck();
    }

    private viewHome() {
        // The home page requires the "logged in" view, so we'll set that.
        this.setStateForNewView({
            view: Views.LOGGED_IN,
        });
        this.setPage(PageTypes.HomePage);
        this.notifyNewScreen('home');
        ThemeController.isLogin = false;
        this.themeWatcher.recheck();
    }

    private viewUser(userId: string, subAction: string) {
        // Wait for the first sync so that `getRoom` gives us a room object if it's
        // in the sync response
        const waitForSync = this.firstSyncPromise ?
            this.firstSyncPromise.promise : Promise.resolve();
        waitForSync.then(() => {
            if (subAction === 'chat') {
                this.chatCreateOrReuse(userId);
                return;
            }
            this.notifyNewScreen('user/' + userId);
            this.setState({currentUserId: userId});
            this.setPage(PageTypes.UserView);
        });
    }

    private setMxId(payload) {
        const SetMxIdDialog = sdk.getComponent('views.dialogs.SetMxIdDialog');
        const close = Modal.createTrackedDialog('Set MXID', '', SetMxIdDialog, {
            homeserverUrl: MatrixClientPeg.get().getHomeserverUrl(),
            onFinished: (submitted, credentials) => {
                if (!submitted) {
                    dis.dispatch({
                        action: 'cancel_after_sync_prepared',
                    });
                    if (payload.go_home_on_cancel) {
                        dis.dispatch({
                            action: 'view_home_page',
                        });
                    }
                    return;
                }
                MatrixClientPeg.setJustRegisteredUserId(credentials.user_id);
                this.onRegistered(credentials);
            },
            onDifferentServerClicked: (ev) => {
                dis.dispatch({action: 'start_registration'});
                close();
            },
            onLoginClick: (ev) => {
                dis.dispatch({action: 'start_login'});
                close();
            },
        }).close;
    }

    private async createRoom(defaultPublic = false) {
        const CreateRoomDialog = sdk.getComponent('dialogs.CreateRoomDialog');
        const modal = Modal.createTrackedDialog('Create Room', '', CreateRoomDialog, { defaultPublic });

        const [shouldCreate, opts] = await modal.finished;
        if (shouldCreate) {
            createRoom(opts);
        }
    }

    private chatCreateOrReuse(userId: string) {
        // Use a deferred action to reshow the dialog once the user has registered
        if (MatrixClientPeg.get().isGuest()) {
            // No point in making 2 DMs with welcome bot. This assumes view_set_mxid will
            // result in a new DM with the welcome user.
            if (userId !== this.props.config.welcomeUserId) {
                dis.dispatch({
                    action: 'do_after_sync_prepared',
                    deferred_action: {
                        action: 'view_start_chat_or_reuse',
                        user_id: userId,
                    },
                });
            }
            dis.dispatch({
                action: 'require_registration',
                // If the set_mxid dialog is cancelled, view /welcome because if the
                // browser was pointing at /user/@someone:domain?action=chat, the URL
                // needs to be reset so that they can revisit /user/.. // (and trigger
                // `_chatCreateOrReuse` again)
                go_welcome_on_cancel: true,
                screen_after: {
                    screen: `user/${this.props.config.welcomeUserId}`,
                    params: { action: 'chat' },
                },
            });
            return;
        }

        // TODO: Immutable DMs replaces this

        const client = MatrixClientPeg.get();
        const dmRoomMap = new DMRoomMap(client);
        const dmRooms = dmRoomMap.getDMRoomsForUserId(userId);

        if (dmRooms.length > 0) {
            dis.dispatch({
                action: 'view_room',
                room_id: dmRooms[0],
            });
        } else {
            dis.dispatch({
                action: 'start_chat',
                user_id: userId,
            });
        }
    }

    private leaveRoomWarnings(roomId: string) {
        const roomToLeave = MatrixClientPeg.get().getRoom(roomId);
        // Show a warning if there are additional complications.
        const joinRules = roomToLeave.currentState.getStateEvents('m.room.join_rules', '');
        const warnings = [];
        if (joinRules) {
            const rule = joinRules.getContent().join_rule;
            if (rule !== "public") {
                warnings.push((
                    <span className="warning" key="non_public_warning">
                        {' '/* Whitespace, otherwise the sentences get smashed together */ }
                        { _t("This room is not public. You will not be able to rejoin without an invite.") }
                    </span>
                ));
            }
        }
        return warnings;
    }

    private leaveRoom(roomId: string) {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        const roomToLeave = MatrixClientPeg.get().getRoom(roomId);
        const warnings = this.leaveRoomWarnings(roomId);

        Modal.createTrackedDialog('Leave room', '', QuestionDialog, {
            title: _t("Leave room"),
            description: (
                <span>
                { _t("Are you sure you want to leave the room '%(roomName)s'?", {roomName: roomToLeave.name}) }
                    { warnings }
                </span>
            ),
            button: _t("Leave"),
            onFinished: (shouldLeave) => {
                if (shouldLeave) {
                    const d = MatrixClientPeg.get().leaveRoomChain(roomId);

                    // FIXME: controller shouldn't be loading a view :(
                    const Loader = sdk.getComponent("elements.Spinner");
                    const modal = Modal.createDialog(Loader, null, 'mx_Dialog_spinner');

                    d.then((errors) => {
                        modal.close();

                        for (const leftRoomId of Object.keys(errors)) {
                            const err = errors[leftRoomId];
                            if (!err) continue;

                            console.error("Failed to leave room " + leftRoomId + " " + err);
                            let title = _t("Failed to leave room");
                            let message = _t("Server may be unavailable, overloaded, or you hit a bug.");
                            if (err.errcode === 'M_CANNOT_LEAVE_SERVER_NOTICE_ROOM') {
                                title = _t("Can't leave Server Notices room");
                                message = _t(
                                    "This room is used for important messages from the Homeserver, " +
                                    "so you cannot leave it.",
                                );
                            } else if (err && err.message) {
                                message = err.message;
                            }
                            Modal.createTrackedDialog('Failed to leave room', '', ErrorDialog, {
                                title: title,
                                description: message,
                            });
                            return;
                        }

                        if (this.state.currentRoomId === roomId) {
                            dis.dispatch({action: 'view_next_room'});
                        }
                    }, (err) => {
                        // This should only happen if something went seriously wrong with leaving the chain.
                        modal.close();
                        console.error("Failed to leave room " + roomId + " " + err);
                        Modal.createTrackedDialog('Failed to leave room', '', ErrorDialog, {
                            title: _t("Failed to leave room"),
                            description: _t("Unknown error"),
                        });
                    });
                }
            },
        });
    }

    /**
     * Starts a chat with the welcome user, if the user doesn't already have one
     * @returns {string} The room ID of the new room, or null if no room was created
     */
    private async startWelcomeUserChat() {
        // We can end up with multiple tabs post-registration where the user
        // might then end up with a session and we don't want them all making
        // a chat with the welcome user: try to de-dupe.
        // We need to wait for the first sync to complete for this to
        // work though.
        let waitFor;
        if (!this.firstSyncComplete) {
            waitFor = this.firstSyncPromise.promise;
        } else {
            waitFor = Promise.resolve();
        }
        await waitFor;

        const welcomeUserRooms = DMRoomMap.shared().getDMRoomsForUserId(
            this.props.config.welcomeUserId,
        );
        if (welcomeUserRooms.length === 0) {
            const roomId = await createRoom({
                dmUserId: this.props.config.welcomeUserId,
                // Only view the welcome user if we're NOT looking at a room
                andView: !this.state.currentRoomId,
                spinner: false, // we're already showing one: we don't need another one
            });
            // This is a bit of a hack, but since the deduplication relies
            // on m.direct being up to date, we need to force a sync
            // of the database, otherwise if the user goes to the other
            // tab before the next save happens (a few minutes), the
            // saved sync will be restored from the db and this code will
            // run without the update to m.direct, making another welcome
            // user room (it doesn't wait for new data from the server, just
            // the saved sync to be loaded).
            const saveWelcomeUser = (ev) => {
                if (
                    ev.getType() === 'm.direct' &&
                    ev.getContent() &&
                    ev.getContent()[this.props.config.welcomeUserId]
                ) {
                    MatrixClientPeg.get().store.save(true);
                    MatrixClientPeg.get().removeListener(
                        "accountData", saveWelcomeUser,
                    );
                }
            };
            MatrixClientPeg.get().on("accountData", saveWelcomeUser);

            return roomId;
        }
        return null;
    }

    /**
     * Called when a new logged in session has started
     */
    private async onLoggedIn() {
        ThemeController.isLogin = false;
        this.themeWatcher.recheck();
        this.setStateForNewView({ view: Views.LOGGED_IN });
        // If a specific screen is set to be shown after login, show that above
        // all else, as it probably means the user clicked on something already.
        if (this.screenAfterLogin && this.screenAfterLogin.screen) {
            this.showScreen(
                this.screenAfterLogin.screen,
                this.screenAfterLogin.params,
            );
            this.screenAfterLogin = null;
        } else if (MatrixClientPeg.currentUserIsJustRegistered()) {
            MatrixClientPeg.setJustRegisteredUserId(null);

            if (this.props.config.welcomeUserId && getCurrentLanguage().startsWith("en")) {
                const welcomeUserRoom = await this.startWelcomeUserChat();
                if (welcomeUserRoom === null) {
                    // We didn't redirect to the welcome user room, so show
                    // the homepage.
                    dis.dispatch({action: 'view_home_page'});
                }
            } else {
                // The user has just logged in after registering,
                // so show the homepage.
                dis.dispatch({action: 'view_home_page'});
            }
        } else {
            this.showScreenAfterLogin();
        }

        StorageManager.tryPersistStorage();
    }

    private showScreenAfterLogin() {
        // If screenAfterLogin is set, use that, then null it so that a second login will
        // result in view_home_page, _user_settings or _room_directory
        if (this.screenAfterLogin && this.screenAfterLogin.screen) {
            this.showScreen(
                this.screenAfterLogin.screen,
                this.screenAfterLogin.params,
            );
            this.screenAfterLogin = null;
        } else if (localStorage && localStorage.getItem('mx_last_room_id')) {
            // Before defaulting to directory, show the last viewed room
            this.viewLastRoom();
        } else {
            if (MatrixClientPeg.get().isGuest()) {
                dis.dispatch({action: 'view_welcome_page'});
            } else if (getHomePageUrl(this.props.config)) {
                dis.dispatch({action: 'view_home_page'});
            } else {
                this.firstSyncPromise.promise.then(() => {
                    dis.dispatch({action: 'view_next_room'});
                });
            }
        }
    }

    private viewLastRoom() {
        dis.dispatch({
            action: 'view_room',
            room_id: localStorage.getItem('mx_last_room_id'),
        });
    }

    /**
     * Called when the session is logged out
     */
    private onLoggedOut() {
        this.notifyNewScreen('login');
        this.setStateForNewView({
            view: Views.LOGIN,
            ready: false,
            collapseLhs: false,
            currentRoomId: null,
        });
        this.subTitleStatus = '';
        this.setPageSubtitle();
        ThemeController.isLogin = true;
        this.themeWatcher.recheck();
    }

    /**
     * Called when the session is softly logged out
     */
    private onSoftLogout() {
        this.notifyNewScreen('soft_logout');
        this.setStateForNewView({
            view: Views.SOFT_LOGOUT,
            ready: false,
            collapseLhs: false,
            currentRoomId: null,
        });
        this.subTitleStatus = '';
        this.setPageSubtitle();
    }

    /**
     * Called just before the matrix client is started
     * (useful for setting listeners)
     */
    private onWillStartClient() {
        // reset the 'have completed first sync' flag,
        // since we're about to start the client and therefore about
        // to do the first sync
        this.firstSyncComplete = false;
        this.firstSyncPromise = defer();
        const cli = MatrixClientPeg.get();

        // Allow the JS SDK to reap timeline events. This reduces the amount of
        // memory consumed as the JS SDK stores multiple distinct copies of room
        // state (each of which can be 10s of MBs) for each DISJOINT timeline. This is
        // particularly noticeable when there are lots of 'limited' /sync responses
        // such as when laptops unsleep.
        // https://github.com/vector-im/riot-web/issues/3307#issuecomment-282895568
        cli.setCanResetTimelineCallback((roomId) => {
            console.log("Request to reset timeline in room ", roomId, " viewing:", this.state.currentRoomId);
            if (roomId !== this.state.currentRoomId) {
                // It is safe to remove events from rooms we are not viewing.
                return true;
            }
            // We are viewing the room which we want to reset. It is only safe to do
            // this if we are not scrolled up in the view. To find out, delegate to
            // the timeline panel. If the timeline panel doesn't exist, then we assume
            // it is safe to reset the timeline.
            if (!this.loggedInView.current) {
                return true;
            }
            return this.loggedInView.current.canResetTimelineInRoom(roomId);
        });

        cli.on('sync', (state, prevState, data) => {
            // LifecycleStore and others cannot directly subscribe to matrix client for
            // events because flux only allows store state changes during flux dispatches.
            // So dispatch directly from here. Ideally we'd use a SyncStateStore that
            // would do this dispatch and expose the sync state itself (by listening to
            // its own dispatch).
            dis.dispatch({action: 'sync_state', prevState, state});

            if (state === "ERROR" || state === "RECONNECTING") {
                if (data.error instanceof InvalidStoreError) {
                    Lifecycle.handleInvalidStoreError(data.error);
                }
                this.setState({syncError: data.error || true});
            } else if (this.state.syncError) {
                this.setState({syncError: null});
            }

            this.updateStatusIndicator(state, prevState);
            if (state === "SYNCING" && prevState === "SYNCING") {
                return;
            }
            console.info("MatrixClient sync state => %s", state);
            if (state !== "PREPARED") { return; }

            this.firstSyncComplete = true;
            this.firstSyncPromise.resolve();

            dis.dispatch({action: 'focus_composer'});
            this.setState({
                ready: true,
                showNotifierToolbar: Notifier.shouldShowToolbar(),
            });
        });
        cli.on('Call.incoming', function(call) {
            // we dispatch this synchronously to make sure that the event
            // handlers on the call are set up immediately (so that if
            // we get an immediate hangup, we don't get a stuck call)
            dis.dispatch({
                action: 'incoming_call',
                call: call,
            }, true);
        });
        cli.on('Session.logged_out', function(errObj) {
            if (Lifecycle.isLoggingOut()) return;

            if (errObj.httpStatus === 401 && errObj.data && errObj.data['soft_logout']) {
                console.warn("Soft logout issued by server - avoiding data deletion");
                Lifecycle.softLogout();
                return;
            }

            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Signed out', '', ErrorDialog, {
                title: _t('Signed Out'),
                description: _t('For security, this session has been signed out. Please sign in again.'),
            });
            dis.dispatch({
                action: 'logout',
            });
        });
        cli.on('no_consent', function(message, consentUri) {
            const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
            Modal.createTrackedDialog('No Consent Dialog', '', QuestionDialog, {
                title: _t('Terms and Conditions'),
                description: <div>
                    <p> { _t(
                        'To continue using the %(homeserverDomain)s homeserver ' +
                        'you must review and agree to our terms and conditions.',
                        { homeserverDomain: cli.getDomain() },
                    ) }
                    </p>
                </div>,
                button: _t('Review terms and conditions'),
                cancelButton: _t('Dismiss'),
                onFinished: (confirmed) => {
                    if (confirmed) {
                        const wnd = window.open(consentUri, '_blank');
                        wnd.opener = null;
                    }
                },
            }, null, true);
        });

        const dft = new DecryptionFailureTracker((total, errorCode) => {
            Analytics.trackEvent('E2E', 'Decryption failure', errorCode, total);
        }, (errorCode) => {
            // Map JS-SDK error codes to tracker codes for aggregation
            switch (errorCode) {
                case 'MEGOLM_UNKNOWN_INBOUND_SESSION_ID':
                    return 'olm_keys_not_sent_error';
                case 'OLM_UNKNOWN_MESSAGE_INDEX':
                    return 'olm_index_error';
                case undefined:
                    return 'unexpected_error';
                default:
                    return 'unspecified_error';
            }
        });

        // Shelved for later date when we have time to think about persisting history of
        // tracked events across sessions.
        // dft.loadTrackedEventHashMap();

        dft.start();

        // When logging out, stop tracking failures and destroy state
        cli.on("Session.logged_out", () => dft.stop());
        cli.on("Event.decrypted", (e, err) => dft.eventDecrypted(e, err));

        // TODO: We can remove this once cross-signing is the only way.
        // https://github.com/vector-im/riot-web/issues/11908
        const krh = new KeyRequestHandler(cli);
        cli.on("crypto.roomKeyRequest", (req) => {
            krh.handleKeyRequest(req);
        });
        cli.on("crypto.roomKeyRequestCancellation", (req) => {
            krh.handleKeyRequestCancellation(req);
        });

        cli.on("Room", (room) => {
            if (MatrixClientPeg.get().isCryptoEnabled()) {
                const blacklistEnabled = SettingsStore.getValueAt(
                    SettingLevel.ROOM_DEVICE,
                    "blacklistUnverifiedDevices",
                    room.roomId,
                    /*explicit=*/true,
                );
                room.setBlacklistUnverifiedDevices(blacklistEnabled);
            }
        });
        cli.on("crypto.warning", (type) => {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            switch (type) {
                case 'CRYPTO_WARNING_OLD_VERSION_DETECTED':
                    Modal.createTrackedDialog('Crypto migrated', '', ErrorDialog, {
                        title: _t('Old cryptography data detected'),
                        description: _t(
                            "Data from an older version of Riot has been detected. " +
                            "This will have caused end-to-end cryptography to malfunction " +
                            "in the older version. End-to-end encrypted messages exchanged " +
                            "recently whilst using the older version may not be decryptable " +
                            "in this version. This may also cause messages exchanged with this " +
                            "version to fail. If you experience problems, log out and back in " +
                            "again. To retain message history, export and re-import your keys.",
                        ),
                    });
                    break;
            }
        });
        cli.on("crypto.keyBackupFailed", async (errcode) => {
            let haveNewVersion;
            let newVersionInfo;
            // if key backup is still enabled, there must be a new backup in place
            if (MatrixClientPeg.get().getKeyBackupEnabled()) {
                haveNewVersion = true;
            } else {
                // otherwise check the server to see if there's a new one
                try {
                    newVersionInfo = await MatrixClientPeg.get().getKeyBackupVersion();
                    if (newVersionInfo !== null) haveNewVersion = true;
                } catch (e) {
                    console.error("Saw key backup error but failed to check backup version!", e);
                    return;
                }
            }

            if (haveNewVersion) {
                Modal.createTrackedDialogAsync('New Recovery Method', 'New Recovery Method',
                    import('../../async-components/views/dialogs/keybackup/NewRecoveryMethodDialog'),
                    { newVersionInfo },
                );
            } else {
                Modal.createTrackedDialogAsync('Recovery Method Removed', 'Recovery Method Removed',
                    import('../../async-components/views/dialogs/keybackup/RecoveryMethodRemovedDialog'),
                );
            }
        });

        cli.on("crypto.keySignatureUploadFailure", (failures, source, continuation) => {
            const KeySignatureUploadFailedDialog =
                sdk.getComponent('views.dialogs.KeySignatureUploadFailedDialog');
            Modal.createTrackedDialog(
                'Failed to upload key signatures',
                'Failed to upload key signatures',
                KeySignatureUploadFailedDialog,
                { failures, source, continuation });
        });

        cli.on("crypto.verification.request", request => {
            const isFlagOn = SettingsStore.getValue("feature_cross_signing");

            if (!isFlagOn && !request.channel.deviceId) {
                request.cancel({code: "m.invalid_message", reason: "This client has cross-signing disabled"});
                return;
            }

            if (request.verifier) {
                const IncomingSasDialog = sdk.getComponent("views.dialogs.IncomingSasDialog");
                Modal.createTrackedDialog('Incoming Verification', '', IncomingSasDialog, {
                    verifier: request.verifier,
                }, null, /* priority = */ false, /* static = */ true);
            } else if (request.pending) {
                ToastStore.sharedInstance().addOrReplaceToast({
                    key: 'verifreq_' + request.channel.transactionId,
                    title: request.isSelfVerification ? _t("Self-verification request") : _t("Verification Request"),
                    icon: "verification",
                    props: {request},
                    component: sdk.getComponent("toasts.VerificationRequestToast"),
                    priority: ToastStore.PRIORITY_REALTIME,
                });
            }
        });
        // Fire the tinter right on startup to ensure the default theme is applied
        // A later sync can/will correct the tint to be the right value for the user
        const colorScheme = SettingsStore.getValue("roomColor");
        Tinter.tint(colorScheme.primary_color, colorScheme.secondary_color);
    }

    /**
     * Called shortly after the matrix client has started. Useful for
     * setting up anything that requires the client to be started.
     * @private
     */
    private onClientStarted() {
        const cli = MatrixClientPeg.get();

        if (cli.isCryptoEnabled()) {
            const blacklistEnabled = SettingsStore.getValueAt(
                SettingLevel.DEVICE,
                "blacklistUnverifiedDevices",
            );
            cli.setGlobalBlacklistUnverifiedDevices(blacklistEnabled);

            // With cross-signing enabled, we send to unknown devices
            // without prompting. Any bad-device status the user should
            // be aware of will be signalled through the room shield
            // changing colour. More advanced behaviour will come once
            // we implement more settings.
            cli.setGlobalErrorOnUnknownDevices(
                !SettingsStore.getValue("feature_cross_signing"),
            );
        }
    }

    showScreen(screen: string, params?: {[key: string]: any}) {
        if (screen === 'register') {
            dis.dispatch({
                action: 'start_registration',
                params: params,
            });
        } else if (screen === 'login') {
            dis.dispatch({
                action: 'start_login',
                params: params,
            });
        } else if (screen === 'forgot_password') {
            dis.dispatch({
                action: 'start_password_recovery',
                params: params,
            });
        } else if (screen === 'soft_logout') {
            if (MatrixClientPeg.get() && MatrixClientPeg.get().getUserId() && !Lifecycle.isSoftLogout()) {
                // Logged in - visit a room
                this.viewLastRoom();
            } else {
                // Ultimately triggers soft_logout if needed
                dis.dispatch({
                    action: 'start_login',
                    params: params,
                });
            }
        } else if (screen === 'new') {
            dis.dispatch({
                action: 'view_create_room',
            });
        } else if (screen === 'settings') {
            dis.fire(Action.ViewUserSettings);
        } else if (screen === 'welcome') {
            dis.dispatch({
                action: 'view_welcome_page',
            });
        } else if (screen === 'home') {
            dis.dispatch({
                action: 'view_home_page',
            });
        } else if (screen === 'start') {
            this.showScreen('home');
            dis.dispatch({
                action: 'require_registration',
            });
        } else if (screen === 'directory') {
            dis.dispatch({
                action: 'view_room_directory',
            });
        } else if (screen === 'groups') {
            dis.dispatch({
                action: 'view_my_groups',
            });
        } else if (screen === 'complete_security') {
            dis.dispatch({
                action: 'start_complete_security',
            });
        } else if (screen === 'post_registration') {
            dis.dispatch({
                action: 'start_post_registration',
            });
        } else if (screen.indexOf('room/') === 0) {
            // Rooms can have the following formats:
            // #room_alias:domain or !opaque_id:domain
            const room = screen.substring(5);
            const domainOffset = room.indexOf(':') + 1; // 0 in case room does not contain a :
            let eventOffset = room.length;
            // room aliases can contain slashes only look for slash after domain
            if (room.substring(domainOffset).indexOf('/') > -1) {
                eventOffset = domainOffset + room.substring(domainOffset).indexOf('/');
            }
            const roomString = room.substring(0, eventOffset);
            let eventId = room.substring(eventOffset + 1); // empty string if no event id given

            // Previously we pulled the eventID from the segments in such a way
            // where if there was no eventId then we'd get undefined. However, we
            // now do a splice and join to handle v3 event IDs which results in
            // an empty string. To maintain our potential contract with the rest
            // of the app, we coerce the eventId to be undefined where applicable.
            if (!eventId) eventId = undefined;

            // TODO: Handle encoded room/event IDs: https://github.com/vector-im/riot-web/issues/9149

            // FIXME: sort_out caseConsistency
            const thirdPartyInvite = {
                inviteSignUrl: params.signurl,
                invitedEmail: params.email,
            };
            const oobData = {
                name: params.room_name,
                avatarUrl: params.room_avatar_url,
                inviterName: params.inviter_name,
            };

            // on our URLs there might be a ?via=matrix.org or similar to help
            // joins to the room succeed. We'll pass these through as an array
            // to other levels. If there's just one ?via= then params.via is a
            // single string. If someone does something like ?via=one.com&via=two.com
            // then params.via is an array of strings.
            let via = [];
            if (params.via) {
                if (typeof(params.via) === 'string') via = [params.via];
                else via = params.via;
            }

            const payload = {
                action: 'view_room',
                event_id: eventId,
                via_servers: via,
                // If an event ID is given in the URL hash, notify RoomViewStore to mark
                // it as highlighted, which will propagate to RoomView and highlight the
                // associated EventTile.
                highlighted: Boolean(eventId),
                third_party_invite: thirdPartyInvite,
                oob_data: oobData,
                room_alias: undefined,
                room_id: undefined,
            };
            if (roomString[0] === '#') {
                payload.room_alias = roomString;
            } else {
                payload.room_id = roomString;
            }

            dis.dispatch(payload);
        } else if (screen.indexOf('user/') === 0) {
            const userId = screen.substring(5);
            dis.dispatch({
                action: 'view_user_info',
                userId: userId,
                subAction: params.action,
            });
        } else if (screen.indexOf('group/') === 0) {
            const groupId = screen.substring(6);

            // TODO: Check valid group ID

            dis.dispatch({
                action: 'view_group',
                group_id: groupId,
            });
        } else {
            console.info("Ignoring showScreen for '%s'", screen);
        }
    }

    notifyNewScreen(screen: string) {
        if (this.props.onNewScreen) {
            this.props.onNewScreen(screen);
        }
        this.setPageSubtitle();
    }

    onAliasClick(event: MouseEvent, alias: string) {
        event.preventDefault();
        dis.dispatch({action: 'view_room', room_alias: alias});
    }

    onUserClick(event: MouseEvent, userId: string) {
        event.preventDefault();

        const member = new RoomMember(null, userId);
        if (!member) { return; }
        dis.dispatch<ViewUserPayload>({
            action: Action.ViewUser,
            member: member,
        });
    }

    onGroupClick(event: MouseEvent, groupId: string) {
        event.preventDefault();
        dis.dispatch({action: 'view_group', group_id: groupId});
    }

    onLogoutClick(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) {
        dis.dispatch({
            action: 'logout',
        });
        event.stopPropagation();
        event.preventDefault();
    }

    handleResize = () => {
        const hideLhsThreshold = 1000;
        const showLhsThreshold = 1000;

        if (this.windowWidth > hideLhsThreshold && window.innerWidth <= hideLhsThreshold) {
            dis.dispatch({ action: 'hide_left_panel' });
        }
        if (this.windowWidth <= showLhsThreshold && window.innerWidth > showLhsThreshold) {
            dis.dispatch({ action: 'show_left_panel' });
        }

        this.state.resizeNotifier.notifyWindowResized();
        this.windowWidth = window.innerWidth;
    };

    private dispatchTimelineResize() {
        dis.dispatch({ action: 'timeline_resize' });
    }

    onRoomCreated(roomId: string) {
        dis.dispatch({
            action: "view_room",
            room_id: roomId,
        });
    }

    onRegisterClick = () => {
        this.showScreen("register");
    };

    onLoginClick = () => {
        this.showScreen("login");
    };

    onForgotPasswordClick = () => {
        this.showScreen("forgot_password");
    };

    onRegisterFlowComplete = (credentials: object, password: string) => {
        return this.onUserCompletedLoginFlow(credentials, password);
    };

    // returns a promise which resolves to the new MatrixClient
    onRegistered(credentials: object) {
        return Lifecycle.setLoggedIn(credentials);
    }

    onFinishPostRegistration = () => {
        // Don't confuse this with "PageType" which is the middle window to show
        this.setState({
            view: Views.LOGGED_IN,
        });
        this.showScreen("settings");
    };

    onVersion(current: string, latest: string, releaseNotes?: string) {
        this.setState({
            version: current,
            newVersion: latest,
            hasNewVersion: current !== latest,
            newVersionReleaseNotes: releaseNotes,
            checkingForUpdate: null,
        });
    }

    onSendEvent(roomId: string, event: MatrixEvent) {
        const cli = MatrixClientPeg.get();
        if (!cli) {
            dis.dispatch({action: 'message_send_failed'});
            return;
        }

        cli.sendEvent(roomId, event.getType(), event.getContent()).then(() => {
            dis.dispatch({action: 'message_sent'});
        }, (err) => {
            dis.dispatch({action: 'message_send_failed'});
        });
    }

    private setPageSubtitle(subtitle = '') {
        if (this.state.currentRoomId) {
            const client = MatrixClientPeg.get();
            const room = client && client.getRoom(this.state.currentRoomId);
            if (room) {
                subtitle = `${this.subTitleStatus} | ${ room.name } ${subtitle}`;
            }
        } else {
            subtitle = `${this.subTitleStatus} ${subtitle}`;
        }
        document.title = `${SdkConfig.get().brand || 'Riot'} ${subtitle}`;
    }

    updateStatusIndicator(state: string, prevState: string) {
        const notifCount = countRoomsWithNotif(MatrixClientPeg.get().getRooms()).count;

        if (PlatformPeg.get()) {
            PlatformPeg.get().setErrorStatus(state === 'ERROR');
            PlatformPeg.get().setNotificationCount(notifCount);
        }

        this.subTitleStatus = '';
        if (state === "ERROR") {
            this.subTitleStatus += `[${_t("Offline")}] `;
        }
        if (notifCount > 0) {
            this.subTitleStatus += `[${notifCount}]`;
        }

        this.setPageSubtitle();
    }

    onCloseAllSettings() {
        dis.dispatch({ action: 'close_settings' });
    }

    onServerConfigChange = (serverConfig: ValidatedServerConfig) => {
        this.setState({serverConfig});
    };

    private makeRegistrationUrl = (params: {[key: string]: string}) => {
        if (this.props.startingFragmentQueryParams.referrer) {
            params.referrer = this.props.startingFragmentQueryParams.referrer;
        }
        return this.props.makeRegistrationUrl(params);
    };

    onUserCompletedLoginFlow = async (credentials: object, password: string) => {
        this.accountPassword = password;
        // self-destruct the password after 5mins
        if (this.accountPasswordTimer !== null) clearTimeout(this.accountPasswordTimer);
        this.accountPasswordTimer = setTimeout(() => {
            this.accountPassword = null;
            this.accountPasswordTimer = null;
        }, 60 * 5 * 1000);

        // Wait for the client to be logged in (but not started)
        // which is enough to ask the server about account data.
        const loggedIn = new Promise(resolve => {
            const actionHandlerRef = dis.register(payload => {
                if (payload.action !== "on_logged_in") {
                    return;
                }
                dis.unregister(actionHandlerRef);
                resolve();
            });
        });

        // Create and start the client in the background
        const setLoggedInPromise = Lifecycle.setLoggedIn(credentials);
        await loggedIn;

        const cli = MatrixClientPeg.get();
        // We're checking `isCryptoAvailable` here instead of `isCryptoEnabled`
        // because the client hasn't been started yet.
        const cryptoAvailable = isCryptoAvailable();
        if (!cryptoAvailable) {
            this.onLoggedIn();
        }

        this.setState({ pendingInitialSync: true });
        await this.firstSyncPromise.promise;

        if (!cryptoAvailable) {
            this.setState({ pendingInitialSync: false });
            return setLoggedInPromise;
        }

        // Test for the master cross-signing key in SSSS as a quick proxy for
        // whether cross-signing has been set up on the account.
        const masterKeyInStorage = !!cli.getAccountData("m.cross_signing.master");
        if (masterKeyInStorage) {
            // Auto-enable cross-signing for the new session when key found in
            // secret storage.
            SettingsStore.setValue("feature_cross_signing", null, SettingLevel.DEVICE, true);
            this.setStateForNewView({ view: Views.COMPLETE_SECURITY });
        } else if (
            SettingsStore.getValue("feature_cross_signing") &&
            await cli.doesServerSupportUnstableFeature("org.matrix.e2e_cross_signing")
        ) {
            // This will only work if the feature is set to 'enable' in the config,
            // since it's too early in the lifecycle for users to have turned the
            // labs flag on.
            this.setStateForNewView({ view: Views.E2E_SETUP });
        } else {
            this.onLoggedIn();
        }
        this.setState({ pendingInitialSync: false });

        return setLoggedInPromise;
    };

    // complete security / e2e setup has finished
    onCompleteSecurityE2eSetupFinished = () => {
        this.onLoggedIn();
    };

    render() {
        // console.log(`Rendering MatrixChat with view ${this.state.view}`);

        let fragmentAfterLogin = "";
        if (this.props.initialScreenAfterLogin) {
            fragmentAfterLogin = `/${this.props.initialScreenAfterLogin.screen}`;
        }

        let view;

        if (this.state.view === Views.LOADING) {
            const Spinner = sdk.getComponent('elements.Spinner');
            view = (
                <div className="mx_MatrixChat_splash">
                    <Spinner />
                </div>
            );
        } else if (this.state.view === Views.COMPLETE_SECURITY) {
            const CompleteSecurity = sdk.getComponent('structures.auth.CompleteSecurity');
            view = (
                <CompleteSecurity
                    onFinished={this.onCompleteSecurityE2eSetupFinished}
                />
            );
        } else if (this.state.view === Views.E2E_SETUP) {
            const E2eSetup = sdk.getComponent('structures.auth.E2eSetup');
            view = (
                <E2eSetup
                    onFinished={this.onCompleteSecurityE2eSetupFinished}
                    accountPassword={this.accountPassword}
                />
            );
        } else if (this.state.view === Views.POST_REGISTRATION) {
            // needs to be before normal PageTypes as you are logged in technically
            const PostRegistration = sdk.getComponent('structures.auth.PostRegistration');
            view = (
                <PostRegistration
                    onComplete={this.onFinishPostRegistration} />
            );
        } else if (this.state.view === Views.LOGGED_IN) {
            // store errors stop the client syncing and require user intervention, so we'll
            // be showing a dialog. Don't show anything else.
            const isStoreError = this.state.syncError && this.state.syncError instanceof InvalidStoreError;

            // `ready` and `view==LOGGED_IN` may be set before `page_type` (because the
            // latter is set via the dispatcher). If we don't yet have a `page_type`,
            // keep showing the spinner for now.
            if (this.state.ready && this.state.page_type && !isStoreError) {
                /* for now, we stuff the entirety of our props and state into the LoggedInView.
                 * we should go through and figure out what we actually need to pass down, as well
                 * as using something like redux to avoid having a billion bits of state kicking around.
                 */
                const LoggedInView = sdk.getComponent('structures.LoggedInView');
                view = (
                    <LoggedInView
                        {...this.props}
                        {...this.state}
                        ref={this.loggedInView}
                        matrixClient={MatrixClientPeg.get()}
                        onRoomCreated={this.onRoomCreated}
                        onCloseAllSettings={this.onCloseAllSettings}
                        onRegistered={this.onRegistered}
                        currentRoomId={this.state.currentRoomId}
                        showCookieBar={this.state.showCookieBar}
                    />
                );
            } else {
                // we think we are logged in, but are still waiting for the /sync to complete
                const Spinner = sdk.getComponent('elements.Spinner');
                let errorBox;
                if (this.state.syncError && !isStoreError) {
                    errorBox = <div className="mx_MatrixChat_syncError">
                        {messageForSyncError(this.state.syncError)}
                    </div>;
                }
                view = (
                    <div className="mx_MatrixChat_splash">
                        {errorBox}
                        <Spinner />
                        <a href="#" className="mx_MatrixChat_splashButtons" onClick={this.onLogoutClick}>
                            {_t('Logout')}
                        </a>
                    </div>
                );
            }
        } else if (this.state.view === Views.WELCOME) {
            const Welcome = sdk.getComponent('auth.Welcome');
            view = <Welcome {...this.getServerProperties()} fragmentAfterLogin={fragmentAfterLogin} />;
        } else if (this.state.view === Views.REGISTER) {
            const Registration = sdk.getComponent('structures.auth.Registration');
            view = (
                <Registration
                    clientSecret={this.state.register_client_secret}
                    sessionId={this.state.register_session_id}
                    idSid={this.state.register_id_sid}
                    email={this.props.startingFragmentQueryParams.email}
                    brand={this.props.config.brand}
                    makeRegistrationUrl={this.makeRegistrationUrl}
                    onLoggedIn={this.onRegisterFlowComplete}
                    onLoginClick={this.onLoginClick}
                    onServerConfigChange={this.onServerConfigChange}
                    defaultDeviceDisplayName={this.props.defaultDeviceDisplayName}
                    {...this.getServerProperties()}
                />
            );
        } else if (this.state.view === Views.FORGOT_PASSWORD) {
            const ForgotPassword = sdk.getComponent('structures.auth.ForgotPassword');
            view = (
                <ForgotPassword
                    onComplete={this.onLoginClick}
                    onLoginClick={this.onLoginClick}
                    onServerConfigChange={this.onServerConfigChange}
                    {...this.getServerProperties()}
                />
            );
        } else if (this.state.view === Views.LOGIN) {
            const Login = sdk.getComponent('structures.auth.Login');
            view = (
                <Login
                    isSyncing={this.state.pendingInitialSync}
                    onLoggedIn={this.onUserCompletedLoginFlow}
                    onRegisterClick={this.onRegisterClick}
                    fallbackHsUrl={this.getFallbackHsUrl()}
                    defaultDeviceDisplayName={this.props.defaultDeviceDisplayName}
                    onForgotPasswordClick={this.onForgotPasswordClick}
                    onServerConfigChange={this.onServerConfigChange}
                    fragmentAfterLogin={fragmentAfterLogin}
                    {...this.getServerProperties()}
                />
            );
        } else if (this.state.view === Views.SOFT_LOGOUT) {
            const SoftLogout = sdk.getComponent('structures.auth.SoftLogout');
            view = (
                <SoftLogout
                    realQueryParams={this.props.realQueryParams}
                    onTokenLoginCompleted={this.props.onTokenLoginCompleted}
                    fragmentAfterLogin={fragmentAfterLogin}
                />
            );
        } else {
            console.error(`Unknown view ${this.state.view}`);
        }

        const ErrorBoundary = sdk.getComponent('elements.ErrorBoundary');
        return <ErrorBoundary>
            {view}
        </ErrorBoundary>;
    }
}
