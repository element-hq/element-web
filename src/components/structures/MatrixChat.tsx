/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, createRef, lazy } from "react";
import {
    ClientEvent,
    createClient,
    EventType,
    HttpApiEvent,
    type MatrixClient,
    type MatrixEvent,
    type RoomType,
    SyncState,
    type SyncStateData,
    type TimelineEvents,
} from "matrix-js-sdk/src/matrix";
import { defer, type IDeferred, type QueryDict } from "matrix-js-sdk/src/utils";
import { logger } from "matrix-js-sdk/src/logger";
import { throttle } from "lodash";
import { CryptoEvent, type KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
import { TooltipProvider } from "@vector-im/compound-web";

// what-input helps improve keyboard accessibility
import "what-input";

import PosthogTrackers from "../../PosthogTrackers";
import { DecryptionFailureTracker } from "../../DecryptionFailureTracker";
import { type IMatrixClientCreds, MatrixClientPeg } from "../../MatrixClientPeg";
import PlatformPeg from "../../PlatformPeg";
import SdkConfig, { type ConfigOptions } from "../../SdkConfig";
import dis from "../../dispatcher/dispatcher";
import Notifier from "../../Notifier";
import Modal from "../../Modal";
import { showRoomInviteDialog, showStartChatInviteDialog } from "../../RoomInvite";
import * as Rooms from "../../Rooms";
import * as Lifecycle from "../../Lifecycle";
// LifecycleStore is not used but does listen to and dispatch actions
import "../../stores/LifecycleStore";
import "../../stores/AutoRageshakeStore";
import PageType from "../../PageTypes";
import createRoom, { type IOpts } from "../../createRoom";
import { _t, _td } from "../../languageHandler";
import SettingsStore from "../../settings/SettingsStore";
import ThemeController from "../../settings/controllers/ThemeController";
import { startAnyRegistrationFlow } from "../../Registration";
import ResizeNotifier from "../../utils/ResizeNotifier";
import AutoDiscoveryUtils from "../../utils/AutoDiscoveryUtils";
import ThemeWatcher, { ThemeWatcherEvent } from "../../settings/watchers/ThemeWatcher";
import { FontWatcher } from "../../settings/watchers/FontWatcher";
import { storeRoomAliasInCache } from "../../RoomAliasCache";
import ToastStore from "../../stores/ToastStore";
import * as StorageManager from "../../utils/StorageManager";
import type LoggedInViewType from "./LoggedInView";
import LoggedInView from "./LoggedInView";
import { Action } from "../../dispatcher/actions";
import { hideToast as hideAnalyticsToast, showToast as showAnalyticsToast } from "../../toasts/AnalyticsToast";
import { showToast as showNotificationsToast } from "../../toasts/DesktopNotificationsToast";
import { type OpenToTabPayload } from "../../dispatcher/payloads/OpenToTabPayload";
import ErrorDialog from "../views/dialogs/ErrorDialog";
import {
    RoomNotificationStateStore,
    UPDATE_STATUS_INDICATOR,
} from "../../stores/notifications/RoomNotificationStateStore";
import { SettingLevel } from "../../settings/SettingLevel";
import ThreepidInviteStore, {
    type IThreepidInvite,
    type IThreepidInviteWireFormat,
} from "../../stores/ThreepidInviteStore";
import { UIFeature } from "../../settings/UIFeature";
import DialPadModal from "../views/voip/DialPadModal";
import { showToast as showMobileGuideToast } from "../../toasts/MobileGuideToast";
import { shouldUseLoginForWelcome } from "../../utils/pages";
import RoomListStore from "../../stores/room-list/RoomListStore";
import { RoomUpdateCause } from "../../stores/room-list/models";
import { ModuleRunner } from "../../modules/ModuleRunner";
import Spinner from "../views/elements/Spinner";
import QuestionDialog from "../views/dialogs/QuestionDialog";
import UserSettingsDialog from "../views/dialogs/UserSettingsDialog";
import CreateRoomDialog from "../views/dialogs/CreateRoomDialog";
import IncomingSasDialog from "../views/dialogs/IncomingSasDialog";
import CompleteSecurity from "./auth/CompleteSecurity";
import Welcome from "../views/auth/Welcome";
import ForgotPassword from "./auth/ForgotPassword";
import E2eSetup from "./auth/E2eSetup";
import Registration from "./auth/Registration";
import Login from "./auth/Login";
import ErrorBoundary from "../views/elements/ErrorBoundary";
import VerificationRequestToast from "../views/toasts/VerificationRequestToast";
import PerformanceMonitor, { PerformanceEntryNames } from "../../performance";
import UIStore, { UI_EVENTS } from "../../stores/UIStore";
import SoftLogout from "./auth/SoftLogout";
import { makeRoomPermalink } from "../../utils/permalinks/Permalinks";
import { copyPlaintext } from "../../utils/strings";
import { PosthogAnalytics } from "../../PosthogAnalytics";
import { initSentry } from "../../sentry";
import LegacyCallHandler from "../../LegacyCallHandler";
import { showSpaceInvite } from "../../utils/space";
import { type ButtonEvent } from "../views/elements/AccessibleButton";
import { type ActionPayload } from "../../dispatcher/payloads";
import { type SummarizedNotificationState } from "../../stores/notifications/SummarizedNotificationState";
import Views from "../../Views";
import { type FocusNextType, type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { type ViewHomePagePayload } from "../../dispatcher/payloads/ViewHomePagePayload";
import { type AfterLeaveRoomPayload } from "../../dispatcher/payloads/AfterLeaveRoomPayload";
import { type DoAfterSyncPreparedPayload } from "../../dispatcher/payloads/DoAfterSyncPreparedPayload";
import { type ViewStartChatOrReusePayload } from "../../dispatcher/payloads/ViewStartChatOrReusePayload";
import { leaveRoomBehaviour } from "../../utils/leave-behaviour";
import { CallStore } from "../../stores/CallStore";
import { type IRoomStateEventsActionPayload } from "../../actions/MatrixActionCreators";
import { type ShowThreadPayload } from "../../dispatcher/payloads/ShowThreadPayload";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../stores/right-panel/RightPanelStore";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import { type ValidatedServerConfig } from "../../utils/ValidatedServerConfig";
import { isLocalRoom } from "../../utils/localRoom/isLocalRoom";
import { SDKContext, SdkContextClass } from "../../contexts/SDKContext";
import { viewUserDeviceSettings } from "../../actions/handlers/viewUserDeviceSettings";
import GenericToast from "../views/toasts/GenericToast";
import RovingSpotlightDialog from "../views/dialogs/spotlight/SpotlightDialog";
import { findDMForUser } from "../../utils/dm/findDMForUser";
import { Linkify } from "../../HtmlUtils";
import { NotificationLevel } from "../../stores/notifications/NotificationLevel";
import { type UserTab } from "../views/dialogs/UserTab";
import { shouldSkipSetupEncryption } from "../../utils/crypto/shouldSkipSetupEncryption";
import { Filter } from "../views/dialogs/spotlight/Filter";
import { checkSessionLockFree, getSessionLock } from "../../utils/SessionLock";
import { SessionLockStolenView } from "./auth/SessionLockStolenView";
import { ConfirmSessionLockTheftView } from "./auth/ConfirmSessionLockTheftView";
import { LoginSplashView } from "./auth/LoginSplashView";
import { cleanUpDraftsIfRequired } from "../../DraftCleaner";
import { InitialCryptoSetupStore } from "../../stores/InitialCryptoSetupStore";
import { setTheme } from "../../theme";

// legacy export
export { default as Views } from "../../Views";

const AUTH_SCREENS = ["register", "mobile_register", "login", "forgot_password", "start_sso", "start_cas", "welcome"];

// Actions that are redirected through the onboarding process prior to being
// re-dispatched. NOTE: some actions are non-trivial and would require
// re-factoring to be included in this list in future.
const ONBOARDING_FLOW_STARTERS = [Action.ViewUserSettings, Action.CreateChat, Action.CreateRoom];

interface IScreen {
    screen: string;
    params?: QueryDict;
}

interface IProps {
    config: ConfigOptions;
    onNewScreen: (screen: string, replaceLast: boolean) => void;
    enableGuest?: boolean;
    // the queryParams extracted from the [real] query-string of the URI
    realQueryParams: QueryDict;
    // the initial queryParams extracted from the hash-fragment of the URI
    startingFragmentQueryParams?: QueryDict;
    // called when we have completed a token login
    onTokenLoginCompleted: () => void;
    // Represents the screen to display as a result of parsing the initial window.location
    initialScreenAfterLogin?: IScreen;
    // displayname, if any, to set on the device when logging in/registering.
    defaultDeviceDisplayName?: string;
}

interface IState {
    // the master view we are showing.
    view: Views;
    // What the LoggedInView would be showing if visible
    // eslint-disable-next-line camelcase
    page_type?: PageType;
    // The ID of the room we're viewing. This is either populated directly
    // in the case where we view a room by ID or by RoomView when it resolves
    // what ID an alias points at.
    currentRoomId: string | null;
    // If we're trying to just view a user ID (i.e. /user URL), this is it
    currentUserId: string | null;
    // this is persisted as mx_lhs_size, loaded in LoggedInView
    collapseLhs: boolean;
    // Parameters used in the registration dance with the IS
    // eslint-disable-next-line camelcase
    register_client_secret?: string;
    // eslint-disable-next-line camelcase
    register_session_id?: string;
    // eslint-disable-next-line camelcase
    register_id_sid?: string;
    isMobileRegistration?: boolean;
    // When showing Modal dialogs we need to set aria-hidden on the root app element
    // and disable it when there are no dialogs
    hideToSRUsers: boolean;
    syncError: Error | null;
    resizeNotifier: ResizeNotifier;
    serverConfig?: ValidatedServerConfig;
    ready: boolean;
    threepidInvite?: IThreepidInvite;
    roomOobData?: object;
    pendingInitialSync?: boolean;
    justRegistered?: boolean;
    roomJustCreatedOpts?: IOpts;
    forceTimeline?: boolean; // see props
}

export default class MatrixChat extends React.PureComponent<IProps, IState> {
    public static displayName = "MatrixChat";

    public static defaultProps = {
        realQueryParams: {},
        startingFragmentQueryParams: {},
        config: {},
        onTokenLoginCompleted: (): void => {},
    };

    private firstSyncComplete = false;
    private firstSyncPromise: IDeferred<void>;

    private screenAfterLogin?: IScreen;
    private tokenLogin?: boolean;
    // What to focus on next component update, if anything
    private focusNext: FocusNextType;
    private subTitleStatus: string;
    private prevWindowWidth: number;

    private readonly loggedInView = createRef<LoggedInViewType>();
    private dispatcherRef?: string;
    private themeWatcher?: ThemeWatcher;
    private fontWatcher?: FontWatcher;
    private readonly stores: SdkContextClass;
    private loadSessionAbortController = new AbortController();

    public constructor(props: IProps) {
        super(props);
        this.stores = SdkContextClass.instance;
        this.stores.constructEagerStores();

        this.state = {
            view: Views.LOADING,
            collapseLhs: false,
            currentRoomId: null,
            currentUserId: null,

            hideToSRUsers: false,
            isMobileRegistration: false,

            syncError: null, // If the current syncing status is ERROR, the error object, otherwise null.
            resizeNotifier: new ResizeNotifier(),
            ready: false,
        };

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
        if (this.screenAfterLogin) {
            const params = this.screenAfterLogin.params || {};
            if (this.screenAfterLogin.screen.startsWith("room/") && params["signurl"] && params["email"]) {
                // probably a threepid invite - try to store it
                const roomId = this.screenAfterLogin.screen.substring("room/".length);
                ThreepidInviteStore.instance.storeInvite(roomId, params as unknown as IThreepidInviteWireFormat);
            }
        }

        this.prevWindowWidth = UIStore.instance.windowWidth || 1000;

        // object field used for tracking the status info appended to the title tag.
        // we don't do it as react state as i'm scared about triggering needless react refreshes.
        this.subTitleStatus = "";
    }

    /**
     * Kick off a call to {@link initSession}, and handle any errors
     */
    private startInitSession = (): void => {
        const initProm = this.initSession();

        initProm.catch((err) => {
            // TODO: show an error screen, rather than a spinner of doom
            logger.error("Error initialising Matrix session", err);
        });
    };

    /**
     * Do what we can to establish a Matrix session.
     *
     *  * Special-case soft-logged-out sessions
     *  * If we have OIDC or token login parameters, follow them
     *  * If we have a guest access token in the query params, use that
     *  * If we have parameters in local storage, use them
     *  * Attempt to auto-register as a guest
     *  * If all else fails, present a login screen.
     */
    private async initSession(): Promise<void> {
        // The Rust Crypto SDK will break if two Element instances try to use the same datastore at once, so
        // make sure we are the only Element instance in town (on this browser/domain).
        if (!(await getSessionLock(() => this.onSessionLockStolen()))) {
            // we failed to get the lock. onSessionLockStolen should already have been called, so nothing left to do.
            return;
        }

        // If the user was soft-logged-out, we want to make the SoftLogout component responsible for doing any
        // token auth (rather than Lifecycle.attemptDelegatedAuthLogin), since SoftLogout knows about submitting the
        // device ID and preserving the session.
        //
        // So, we start by special-casing soft-logged-out sessions.
        if (Lifecycle.isSoftLogout()) {
            // When the session loads it'll be detected as soft logged out and a dispatch
            // will be sent out to say that, triggering this MatrixChat to show the soft
            // logout page.
            Lifecycle.loadSession({ abortSignal: this.loadSessionAbortController.signal });
            return;
        }

        // Otherwise, the first thing to do is to try the token params in the query-string
        const delegatedAuthSucceeded = await Lifecycle.attemptDelegatedAuthLogin(
            this.props.realQueryParams,
            this.props.defaultDeviceDisplayName,
            this.getFragmentAfterLogin(),
        );

        // remove the loginToken or auth code from the URL regardless
        if (
            this.props.realQueryParams?.loginToken ||
            this.props.realQueryParams?.code ||
            this.props.realQueryParams?.state
        ) {
            this.props.onTokenLoginCompleted();
        }

        if (delegatedAuthSucceeded) {
            // token auth/OIDC worked! Time to fire up the client.
            this.tokenLogin = true;

            // Create and start the client
            // accesses the new credentials just set in storage during attemptDelegatedAuthLogin
            // and sets logged in state
            await Lifecycle.restoreSessionFromStorage({ ignoreGuest: true });
            await this.postLoginSetup();
            return;
        }

        // if the user has followed a login or register link, don't reanimate
        // the old creds, but rather go straight to the relevant page
        const firstScreen = this.screenAfterLogin ? this.screenAfterLogin.screen : null;
        const restoreSuccess = await this.loadSession();
        if (restoreSuccess) {
            return;
        }

        // If the first screen is an auth screen, we don't want to wait for login.
        if (firstScreen !== null && AUTH_SCREENS.includes(firstScreen)) {
            this.showScreenAfterLogin();
        }
    }

    private async onSessionLockStolen(): Promise<void> {
        // switch to the LockStolenView. We deliberately do this immediately, rather than going through the dispatcher,
        // because there can be a substantial queue in the dispatcher, and some of the events in it might require an
        // active MatrixClient.
        await new Promise<void>((resolve) => {
            this.setState({ view: Views.LOCK_STOLEN }, resolve);
        });

        // now we can tell the Lifecycle routines to abort any active startup, and to stop the active client.
        await Lifecycle.onSessionLockStolen();
    }

    private async postLoginSetup(): Promise<void> {
        const cli = MatrixClientPeg.safeGet();
        const cryptoEnabled = Boolean(cli.getCrypto());
        if (!cryptoEnabled) {
            this.onLoggedIn();
        }

        const promisesList: Promise<any>[] = [this.firstSyncPromise.promise];
        let crossSigningIsSetUp = false;
        if (cryptoEnabled) {
            // check if the user has previously published public cross-signing keys,
            // as a proxy to figure out if it's worth prompting the user to verify
            // from another device.
            promisesList.push(
                (async (): Promise<void> => {
                    crossSigningIsSetUp = Boolean(await cli.getCrypto()?.userHasCrossSigningKeys());
                })(),
            );
        }

        // Now update the state to say we're waiting for the first sync to complete rather
        // than for the login to finish.
        this.setState({ pendingInitialSync: true });

        await Promise.all(promisesList);

        if (!cryptoEnabled) {
            this.setState({ pendingInitialSync: false });
            return;
        }

        if (crossSigningIsSetUp) {
            // if the user has previously set up cross-signing, verify this device so we can fetch the
            // private keys.

            const cryptoExtension = ModuleRunner.instance.extensions.cryptoSetup;
            if (cryptoExtension.SHOW_ENCRYPTION_SETUP_UI == false) {
                this.onLoggedIn();
            } else {
                this.setStateForNewView({ view: Views.COMPLETE_SECURITY });
            }
        } else if (
            (await cli.doesServerSupportUnstableFeature("org.matrix.e2e_cross_signing")) &&
            !(await shouldSkipSetupEncryption(cli))
        ) {
            // if cross-signing is not yet set up, do so now if possible.
            InitialCryptoSetupStore.sharedInstance().startInitialCryptoSetup(
                cli,
                this.onCompleteSecurityE2eSetupFinished,
            );
            this.setStateForNewView({ view: Views.E2E_SETUP });
        } else {
            this.onLoggedIn();
        }
        this.setState({ pendingInitialSync: false });
    }

    public setState<K extends keyof IState>(
        state:
            | ((prevState: Readonly<IState>, props: Readonly<IProps>) => Pick<IState, K> | IState | null)
            | (Pick<IState, K> | IState | null),
        callback?: () => void,
    ): void {
        if (this.shouldTrackPageChange(this.state, { ...this.state, ...state })) {
            this.startPageChangeTimer();
        }
        super.setState<K>(state, callback);
    }

    public componentDidMount(): void {
        UIStore.instance.on(UI_EVENTS.Resize, this.handleResize);

        // For PersistentElement
        this.state.resizeNotifier.on("middlePanelResized", this.dispatchTimelineResize);

        RoomNotificationStateStore.instance.on(UPDATE_STATUS_INDICATOR, this.onUpdateStatusIndicator);

        this.dispatcherRef = dis.register(this.onAction);

        this.themeWatcher = new ThemeWatcher();
        this.fontWatcher = new FontWatcher();
        this.themeWatcher.start();
        this.themeWatcher.on(ThemeWatcherEvent.Change, setTheme);
        this.fontWatcher.start();

        initSentry(SdkConfig.get("sentry"));

        if (!checkSessionLockFree()) {
            // another instance holds the lock; confirm its theft before proceeding
            setTimeout(() => this.setState({ view: Views.CONFIRM_LOCK_THEFT }), 0);
        } else {
            this.startInitSession();
        }

        window.addEventListener("resize", this.onWindowResized);
    }

    public componentDidUpdate(prevProps: IProps, prevState: IState): void {
        if (this.shouldTrackPageChange(prevState, this.state)) {
            const durationMs = this.stopPageChangeTimer();
            if (durationMs != null) {
                PosthogTrackers.instance.trackPageChange(this.state.view, this.state.page_type, durationMs);
            }
        }
        if (this.focusNext === "composer") {
            dis.fire(Action.FocusSendMessageComposer);
            this.focusNext = undefined;
        } else if (this.focusNext === "threadsPanel") {
            dis.fire(Action.FocusThreadsPanel);
        }
    }

    public componentWillUnmount(): void {
        Lifecycle.stopMatrixClient();
        dis.unregister(this.dispatcherRef);
        this.themeWatcher?.off(ThemeWatcherEvent.Change, setTheme);
        this.themeWatcher?.stop();
        this.fontWatcher?.stop();
        UIStore.destroy();
        this.state.resizeNotifier.removeListener("middlePanelResized", this.dispatchTimelineResize);
        window.removeEventListener("resize", this.onWindowResized);
    }

    private onWindowResized = (): void => {
        // XXX: This is a very unreliable way to detect whether or not the the devtools are open
        this.warnInConsole();
    };

    private warnInConsole = throttle((): void => {
        const largeFontSize = "50px";
        const normalFontSize = "15px";

        const waitText = _t("console_wait");
        const scamText = _t("console_scam_warning");
        const devText = _t("console_dev_note");

        global.mx_rage_logger.bypassRageshake(
            "log",
            `%c${waitText}\n%c${scamText}\n%c${devText}`,
            `font-size:${largeFontSize}; color:blue;`,
            `font-size:${normalFontSize}; color:red;`,
            `font-size:${normalFontSize};`,
        );
    }, 1000);

    private getFallbackHsUrl(): string | undefined {
        if (this.getServerProperties().serverConfig?.isDefault) {
            return this.props.config.fallback_hs_url;
        }
    }

    private getServerProperties(): { serverConfig: ValidatedServerConfig } {
        const props = this.state.serverConfig || SdkConfig.get("validated_server_config")!;
        return { serverConfig: props };
    }

    private loadSession(): Promise<boolean> {
        // the extra Promise.resolve() ensures that synchronous exceptions hit the same codepath as
        // asynchronous ones.
        return Promise.resolve()
            .then(() => {
                return Lifecycle.loadSession({
                    fragmentQueryParams: this.props.startingFragmentQueryParams,
                    enableGuest: this.props.enableGuest,
                    guestHsUrl: this.getServerProperties().serverConfig.hsUrl,
                    guestIsUrl: this.getServerProperties().serverConfig.isUrl,
                    defaultDeviceDisplayName: this.props.defaultDeviceDisplayName,
                    abortSignal: this.loadSessionAbortController.signal,
                });
            })
            .then((loadedSession) => {
                if (!loadedSession) {
                    // fall back to showing the welcome screen... unless we have a 3pid invite pending
                    if (
                        ThreepidInviteStore.instance.pickBestInvite() &&
                        SettingsStore.getValue(UIFeature.Registration)
                    ) {
                        dis.dispatch({ action: "start_registration" });
                    } else {
                        dis.dispatch({ action: "view_welcome_page" });
                    }
                }
                return loadedSession;
            });
        // Note we don't catch errors from this: we catch everything within
        // loadSession as there's logic there to ask the user if they want
        // to try logging out.
    }

    private startPageChangeTimer(): void {
        PerformanceMonitor.instance.start(PerformanceEntryNames.PAGE_CHANGE);
    }

    private stopPageChangeTimer(): number | null {
        const perfMonitor = PerformanceMonitor.instance;

        perfMonitor.stop(PerformanceEntryNames.PAGE_CHANGE);

        const entries = perfMonitor.getEntries({
            name: PerformanceEntryNames.PAGE_CHANGE,
        });
        const measurement = entries.pop();

        return measurement ? measurement.duration : null;
    }

    private shouldTrackPageChange(prevState: IState, state: IState): boolean {
        return (
            prevState.currentRoomId !== state.currentRoomId ||
            prevState.view !== state.view ||
            prevState.page_type !== state.page_type
        );
    }

    private setStateForNewView(state: Partial<IState>): void {
        if (state.view === undefined) {
            throw new Error("setStateForNewView with no view!");
        }
        this.setState({
            currentUserId: undefined,
            justRegistered: false,
            ...state,
        } as IState);
    }

    private onAction = (payload: ActionPayload): void => {
        // once the session lock has been stolen, don't try to do anything.
        if (this.state.view === Views.LOCK_STOLEN) {
            return;
        }

        // Start the onboarding process for certain actions
        if (
            MatrixClientPeg.get()?.isGuest() &&
            ONBOARDING_FLOW_STARTERS.includes(payload.action as unknown as Action)
        ) {
            // This will cause `payload` to be dispatched later, once a
            // sync has reached the "prepared" state. Setting a matrix ID
            // will cause a full login and sync and finally the deferred
            // action will be dispatched.
            dis.dispatch({
                action: Action.DoAfterSyncPrepared,
                deferred_action: payload,
            });
            dis.dispatch({ action: "require_registration" });
            return;
        }

        switch (payload.action) {
            case "MatrixActions.accountData":
                // XXX: This is a collection of several hacks to solve a minor problem. We want to
                // update our local state when the identity server changes, but don't want to put that in
                // the js-sdk as we'd be then dictating how all consumers need to behave. However,
                // this component is already bloated and we probably don't want this tiny logic in
                // here, but there's no better place in the react-sdk for it. Additionally, we're
                // abusing the MatrixActionCreator stuff to avoid errors on dispatches.
                if (payload.event_type === "m.identity_server") {
                    const fullUrl = payload.event_content ? payload.event_content["base_url"] : null;
                    if (!fullUrl) {
                        MatrixClientPeg.safeGet().setIdentityServerUrl(undefined);
                        localStorage.removeItem("mx_is_access_token");
                        localStorage.removeItem("mx_is_url");
                    } else {
                        MatrixClientPeg.safeGet().setIdentityServerUrl(fullUrl);
                        localStorage.removeItem("mx_is_access_token"); // clear token
                        localStorage.setItem("mx_is_url", fullUrl); // XXX: Do we still need this?
                    }

                    // redispatch the change with a more specific action
                    dis.dispatch({ action: "id_server_changed" });
                }
                break;
            case "logout":
                LegacyCallHandler.instance.hangupAllCalls();
                Promise.all([...[...CallStore.instance.connectedCalls].map((call) => call.disconnect())]).finally(() =>
                    Lifecycle.logout(this.stores.oidcClientStore),
                );
                break;
            case "require_registration":
                startAnyRegistrationFlow(payload as any);
                break;
            case "start_mobile_registration":
                this.startRegistration(payload.params || {}, true);
                break;
            case "start_registration":
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
            case "start_login":
                if (Lifecycle.isSoftLogout()) {
                    this.onSoftLogout();
                    break;
                }
                if (payload.screenAfterLogin) {
                    this.screenAfterLogin = payload.screenAfterLogin;
                }
                this.viewLogin();
                break;
            case "start_password_recovery":
                this.setStateForNewView({
                    view: Views.FORGOT_PASSWORD,
                });
                this.notifyNewScreen("forgot_password");
                break;
            case "start_chat":
                createRoom(MatrixClientPeg.safeGet(), {
                    dmUserId: payload.user_id,
                });
                break;
            case "leave_room":
                this.leaveRoom(payload.room_id);
                break;
            case "forget_room":
                this.forgetRoom(payload.room_id);
                break;
            case "copy_room":
                this.copyRoom(payload.room_id);
                break;
            case "view_user_info":
                this.viewUser(payload.userId, payload.subAction);
                break;
            case "MatrixActions.RoomState.events": {
                const event = (payload as IRoomStateEventsActionPayload).event;
                if (
                    event.getType() === EventType.RoomCanonicalAlias &&
                    event.getRoomId() === this.state.currentRoomId
                ) {
                    // re-view the current room so we can update alias/id in the URL properly
                    this.viewRoom({
                        action: Action.ViewRoom,
                        room_id: this.state.currentRoomId,
                        metricsTrigger: undefined, // room doesn't change
                    });
                }
                break;
            }
            case Action.ViewRoom: {
                // Takes either a room ID or room alias: if switching to a room the client is already
                // known to be in (eg. user clicks on a room in the recents panel), supply the ID
                // If the user is clicking on a room in the context of the alias being presented
                // to them, supply the room alias. If both are supplied, the room ID will be ignored.
                const promise = this.viewRoom(payload as ViewRoomPayload);
                if (payload.deferred_action) {
                    promise.then(() => {
                        dis.dispatch(payload.deferred_action);
                    });
                }
                break;
            }
            case Action.ViewUserDeviceSettings: {
                viewUserDeviceSettings();
                break;
            }
            case Action.ViewUserSettings: {
                const tabPayload = payload as OpenToTabPayload;
                Modal.createDialog(
                    UserSettingsDialog,
                    { ...payload.props, initialTabId: tabPayload.initialTabId as UserTab, sdkContext: this.stores },
                    /*className=*/ undefined,
                    /*isPriority=*/ false,
                    /*isStatic=*/ true,
                );

                // View the welcome or home page if we need something to look at
                this.viewSomethingBehindModal();
                break;
            }
            case Action.CreateRoom:
                this.createRoom(payload.public, payload.defaultName, payload.type);

                // View the welcome or home page if we need something to look at
                this.viewSomethingBehindModal();
                break;
            case Action.ViewRoomDirectory: {
                Modal.createDialog(
                    RovingSpotlightDialog,
                    {
                        initialText: payload.initialText,
                        initialFilter: Filter.PublicRooms,
                    },
                    "mx_SpotlightDialog_wrapper",
                    false,
                    true,
                );

                // View the welcome or home page if we need something to look at
                this.viewSomethingBehindModal();
                break;
            }
            case "view_welcome_page":
                this.viewWelcome();
                break;
            case Action.ViewHomePage:
                this.viewHome(payload.justRegistered);
                break;
            case Action.ViewStartChatOrReuse:
                this.chatCreateOrReuse(payload.user_id);
                break;
            case Action.CreateChat:
                showStartChatInviteDialog(payload.initialText || "");

                // View the welcome or home page if we need something to look at
                this.viewSomethingBehindModal();
                break;
            case "view_invite": {
                const room = MatrixClientPeg.safeGet().getRoom(payload.roomId);
                if (room?.isSpaceRoom()) {
                    showSpaceInvite(room);
                } else {
                    showRoomInviteDialog(payload.roomId);
                }
                break;
            }
            case "view_last_screen":
                // This function does what we want, despite the name. The idea is that it shows
                // the last room we were looking at or some reasonable default/guess. We don't
                // have to worry about email invites or similar being re-triggered because the
                // function will have cleared that state and not execute that path.
                this.showScreenAfterLogin();
                break;
            case "hide_left_panel":
                this.setState(
                    {
                        collapseLhs: true,
                    },
                    () => {
                        this.state.resizeNotifier.notifyLeftHandleResized();
                    },
                );
                break;
            case "show_left_panel":
                this.setState(
                    {
                        collapseLhs: false,
                    },
                    () => {
                        this.state.resizeNotifier.notifyLeftHandleResized();
                    },
                );
                break;
            case Action.OpenDialPad:
                Modal.createDialog(DialPadModal, {}, "mx_Dialog_dialPadWrapper");
                break;
            case Action.OnLoggedIn:
                this.stores.client = MatrixClientPeg.safeGet();
                if (
                    // Skip this handling for token login as that always calls onLoggedIn itself
                    !this.tokenLogin &&
                    !Lifecycle.isSoftLogout() &&
                    this.state.view !== Views.LOGIN &&
                    this.state.view !== Views.REGISTER &&
                    this.state.view !== Views.COMPLETE_SECURITY &&
                    this.state.view !== Views.E2E_SETUP
                ) {
                    this.onLoggedIn();
                }
                break;
            case "on_client_not_viable":
                this.onSoftLogout();
                break;
            case Action.OnLoggedOut:
                this.onLoggedOut();
                break;
            case "will_start_client":
                this.setState({ ready: false }, () => {
                    // if the client is about to start, we are, by definition, not ready.
                    // Set ready to false now, then it'll be set to true when the sync
                    // listener we set below fires.
                    this.onWillStartClient();
                });
                break;
            case "client_started":
                // No need to make this handler async to wait for the result of this
                this.onClientStarted().catch((e) => {
                    logger.error("Exception in onClientStarted", e);
                });
                break;
            case "send_event":
                this.onSendEvent(payload.room_id, payload.event);
                break;
            case "aria_hide_main_app":
                this.setState({
                    hideToSRUsers: true,
                });
                break;
            case "aria_unhide_main_app":
                this.setState({
                    hideToSRUsers: false,
                });
                break;
            case Action.PseudonymousAnalyticsAccept:
                hideAnalyticsToast();
                SettingsStore.setValue("pseudonymousAnalyticsOptIn", null, SettingLevel.ACCOUNT, true);
                break;
            case Action.PseudonymousAnalyticsReject:
                hideAnalyticsToast();
                SettingsStore.setValue("pseudonymousAnalyticsOptIn", null, SettingLevel.ACCOUNT, false);
                break;
            case Action.ShowThread: {
                const { rootEvent, initialEvent, highlighted, scrollIntoView, push } = payload as ShowThreadPayload;

                const threadViewCard = {
                    phase: RightPanelPhases.ThreadView,
                    state: {
                        threadHeadEvent: rootEvent,
                        initialEvent: initialEvent,
                        isInitialEventHighlighted: highlighted,
                        initialEventScrollIntoView: scrollIntoView,
                    },
                };
                if (push ?? false) {
                    RightPanelStore.instance.pushCard(threadViewCard);
                } else {
                    RightPanelStore.instance.setCards([{ phase: RightPanelPhases.ThreadPanel }, threadViewCard]);
                }

                // Focus the composer
                dis.dispatch({
                    action: Action.FocusSendMessageComposer,
                    context: TimelineRenderingType.Thread,
                });

                break;
            }
            case Action.OpenSpotlight:
                Modal.createDialog(
                    RovingSpotlightDialog,
                    {
                        initialText: payload.initialText,
                        initialFilter: payload.initialFilter,
                    },
                    "mx_SpotlightDialog_wrapper",
                    false,
                    true,
                );
                break;
        }
    };

    private setPage(pageType: PageType): void {
        this.setState({
            page_type: pageType,
        });
    }

    private async startRegistration(params: { [key: string]: string }, isMobileRegistration?: boolean): Promise<void> {
        // If registration is disabled or mobile registration is requested but not enabled in settings redirect to the welcome screen
        if (
            !SettingsStore.getValue(UIFeature.Registration) ||
            (isMobileRegistration && !SettingsStore.getValue("Registration.mobileRegistrationHelper"))
        ) {
            this.showScreen("welcome");
            return;
        }

        const newState: Partial<IState> = {
            view: Views.REGISTER,
        };

        if (isMobileRegistration && params.hs_url) {
            try {
                const config = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(params.hs_url);
                newState.serverConfig = config;
            } catch {
                logger.warn("Failed to load hs_url param:", params.hs_url);
            }
        } else if (params.client_secret && params.session_id && params.hs_url && params.is_url && params.sid) {
            // Only honour params if they are all present, otherwise we reset
            // HS and IS URLs when switching to registration.
            newState.serverConfig = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(
                params.hs_url,
                params.is_url,
            );

            // If the hs url matches then take the hs name we know locally as it is likely prettier
            const defaultConfig = SdkConfig.get("validated_server_config");
            if (defaultConfig && defaultConfig.hsUrl === newState.serverConfig.hsUrl) {
                newState.serverConfig.hsName = defaultConfig.hsName;
                newState.serverConfig.hsNameIsDifferent = defaultConfig.hsNameIsDifferent;
                newState.serverConfig.isDefault = defaultConfig.isDefault;
                newState.serverConfig.isNameResolvable = defaultConfig.isNameResolvable;
            }

            newState.register_client_secret = params.client_secret;
            newState.register_session_id = params.session_id;
            newState.register_id_sid = params.sid;
        }

        newState.isMobileRegistration = isMobileRegistration;

        this.setStateForNewView(newState);
        ThemeController.isLogin = true;
        this.themeWatcher?.recheck();
        this.notifyNewScreen(isMobileRegistration ? "mobile_register" : "register");
    }

    // switch view to the given room
    private async viewRoom(roomInfo: ViewRoomPayload): Promise<void> {
        this.focusNext = roomInfo.focusNext ?? "composer";

        if (roomInfo.room_alias) {
            logger.log(`Switching to room alias ${roomInfo.room_alias} at event ${roomInfo.event_id}`);
        } else {
            logger.log(`Switching to room id ${roomInfo.room_id} at event ${roomInfo.event_id}`);
        }

        // Wait for the first sync to complete so that if a room does have an alias,
        // it would have been retrieved.
        if (!this.firstSyncComplete) {
            await this.firstSyncPromise.promise;
        }

        let presentedId = roomInfo.room_alias || roomInfo.room_id!;
        const room = MatrixClientPeg.safeGet().getRoom(roomInfo.room_id);
        if (room) {
            // Not all timeline events are decrypted ahead of time anymore
            // Only the critical ones for a typical UI are
            // This will start the decryption process for all events when a
            // user views a room
            room.decryptAllEvents();
            const theAlias = Rooms.getDisplayAliasForRoom(room);
            if (theAlias) {
                presentedId = theAlias;
                // Store display alias of the presented room in cache to speed future
                // navigation.
                storeRoomAliasInCache(theAlias, room.roomId);
            }

            // Store this as the ID of the last room accessed. This is so that we can
            // persist which room is being stored across refreshes and browser quits.
            localStorage?.setItem("mx_last_room_id", room.roomId);
        }

        // If we are redirecting to a Room Alias and it is for the room we already showing then replace history item
        let replaceLast = presentedId[0] === "#" && roomInfo.room_id === this.state.currentRoomId;

        if (isLocalRoom(this.state.currentRoomId)) {
            // Replace local room history items
            replaceLast = true;
        }

        if (roomInfo.room_id === this.state.currentRoomId) {
            // if we are re-viewing the same room then copy any state we already know
            roomInfo.threepid_invite = roomInfo.threepid_invite ?? this.state.threepidInvite;
            roomInfo.oob_data = roomInfo.oob_data ?? this.state.roomOobData;
            roomInfo.forceTimeline = roomInfo.forceTimeline ?? this.state.forceTimeline;
            roomInfo.justCreatedOpts = roomInfo.justCreatedOpts ?? this.state.roomJustCreatedOpts;
        }

        if (roomInfo.event_id && roomInfo.highlighted) {
            presentedId += "/" + roomInfo.event_id;
        }
        this.setState(
            {
                view: Views.LOGGED_IN,
                currentRoomId: roomInfo.room_id ?? null,
                page_type: PageType.RoomView,
                threepidInvite: roomInfo.threepid_invite,
                roomOobData: roomInfo.oob_data,
                forceTimeline: roomInfo.forceTimeline,
                ready: true,
                roomJustCreatedOpts: roomInfo.justCreatedOpts,
            },
            () => {
                ThemeController.isLogin = false;
                this.themeWatcher?.recheck();
                this.notifyNewScreen("room/" + presentedId, replaceLast);
            },
        );
    }

    private viewSomethingBehindModal(): void {
        if (this.state.view !== Views.LOGGED_IN) {
            this.viewWelcome();
            return;
        }
        if (!this.state.currentRoomId && !this.state.currentUserId) {
            this.viewHome();
        }
    }

    private viewWelcome(): void {
        if (shouldUseLoginForWelcome(SdkConfig.get())) {
            return this.viewLogin();
        }
        this.setStateForNewView({
            view: Views.WELCOME,
        });
        this.notifyNewScreen("welcome");
        ThemeController.isLogin = true;
        this.themeWatcher?.recheck();
    }

    private viewLogin(otherState?: any): void {
        this.setStateForNewView({
            view: Views.LOGIN,
            ...otherState,
        });
        this.notifyNewScreen("login");
        ThemeController.isLogin = true;
        this.themeWatcher?.recheck();
    }

    private viewHome(justRegistered = false): void {
        // The home page requires the "logged in" view, so we'll set that.
        this.setStateForNewView({
            view: Views.LOGGED_IN,
            justRegistered,
            currentRoomId: null,
        });
        this.setPage(PageType.HomePage);
        this.notifyNewScreen("home");
        ThemeController.isLogin = false;
        this.themeWatcher?.recheck();
    }

    private viewUser(userId: string, subAction: string): void {
        // Wait for the first sync so that `getRoom` gives us a room object if it's
        // in the sync response
        this.firstSyncPromise.promise.then(() => {
            if (subAction === "chat") {
                this.chatCreateOrReuse(userId);
                return;
            }
            this.notifyNewScreen("user/" + userId);
            this.setState({ currentUserId: userId });
            this.setPage(PageType.UserView);
        });
    }

    private async createRoom(defaultPublic = false, defaultName?: string, type?: RoomType): Promise<void> {
        const modal = Modal.createDialog(CreateRoomDialog, {
            type,
            defaultPublic,
            defaultName,
        });

        const [shouldCreate, opts] = await modal.finished;
        if (shouldCreate) {
            createRoom(MatrixClientPeg.safeGet(), opts!);
        }
    }

    private chatCreateOrReuse(userId: string): void {
        // Use a deferred action to reshow the dialog once the user has registered
        if (MatrixClientPeg.safeGet().isGuest()) {
            dis.dispatch<DoAfterSyncPreparedPayload<ViewStartChatOrReusePayload>>({
                action: Action.DoAfterSyncPrepared,
                deferred_action: {
                    action: Action.ViewStartChatOrReuse,
                    user_id: userId,
                },
            });
            return;
        }

        // TODO: Immutable DMs replaces this

        const client = MatrixClientPeg.safeGet();
        const dmRoom = findDMForUser(client, userId);

        if (dmRoom) {
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: dmRoom.roomId,
                metricsTrigger: "MessageUser",
            });
        } else {
            dis.dispatch({
                action: "start_chat",
                user_id: userId,
            });
        }
    }

    private leaveRoomWarnings(roomId: string): JSX.Element[] {
        const roomToLeave = MatrixClientPeg.safeGet().getRoom(roomId);
        const isSpace = roomToLeave?.isSpaceRoom();
        // Show a warning if there are additional complications.
        const warnings: JSX.Element[] = [];

        const memberCount = roomToLeave?.currentState.getJoinedMemberCount();
        if (memberCount === 1) {
            warnings.push(
                <strong className="warning" key="only_member_warning">
                    {" " /* Whitespace, otherwise the sentences get smashed together */}
                    {_t("leave_room_dialog|last_person_warning")}
                </strong>,
            );

            return warnings;
        }

        const joinRules = roomToLeave?.currentState.getStateEvents("m.room.join_rules", "");
        if (joinRules) {
            const rule = joinRules.getContent().join_rule;
            if (rule !== "public") {
                warnings.push(
                    <strong className="warning" key="non_public_warning">
                        {" " /* Whitespace, otherwise the sentences get smashed together */}
                        {isSpace
                            ? _t("leave_room_dialog|space_rejoin_warning")
                            : _t("leave_room_dialog|room_rejoin_warning")}
                    </strong>,
                );
            }
        }

        const client = MatrixClientPeg.get();
        if (client && roomToLeave) {
            const plEvent = roomToLeave.currentState.getStateEvents(EventType.RoomPowerLevels, "");
            const plContent = plEvent ? plEvent.getContent() : {};
            const userLevels = plContent.users || {};
            const currentUserLevel = userLevels[client.getUserId()!];
            const userLevelValues = Object.values(userLevels);
            if (userLevelValues.every((x) => typeof x === "number")) {
                const maxUserLevel = Math.max(...(userLevelValues as number[]));
                // If the user is the only user with highest power level
                if (
                    maxUserLevel === currentUserLevel &&
                    userLevelValues.lastIndexOf(maxUserLevel) == userLevelValues.indexOf(maxUserLevel)
                ) {
                    const warning =
                        maxUserLevel >= 100
                            ? _t("leave_room_dialog|room_leave_admin_warning")
                            : _t("leave_room_dialog|room_leave_mod_warning");
                    warnings.push(
                        <strong className="warning" key="last_admin_warning">
                            {" " /* Whitespace, otherwise the sentences get smashed together */}
                            {warning}
                        </strong>,
                    );
                }
            }
        }

        return warnings;
    }

    private leaveRoom(roomId: string): void {
        const cli = MatrixClientPeg.safeGet();
        const roomToLeave = cli.getRoom(roomId);
        const warnings = this.leaveRoomWarnings(roomId);

        const isSpace = roomToLeave?.isSpaceRoom();
        Modal.createDialog(QuestionDialog, {
            title: isSpace ? _t("space|leave_dialog_action") : _t("action|leave_room"),
            description: (
                <span>
                    {isSpace
                        ? _t("leave_room_dialog|leave_space_question", {
                              spaceName: roomToLeave?.name ?? _t("common|unnamed_space"),
                          })
                        : _t("leave_room_dialog|leave_room_question", {
                              roomName: roomToLeave?.name ?? _t("common|unnamed_room"),
                          })}
                    {warnings}
                </span>
            ),
            button: _t("action|leave"),
            danger: warnings.length > 0,
            onFinished: async (shouldLeave) => {
                if (shouldLeave) {
                    await leaveRoomBehaviour(cli, roomId);

                    dis.dispatch<AfterLeaveRoomPayload>({
                        action: Action.AfterLeaveRoom,
                        room_id: roomId,
                    });
                }
            },
        });
    }

    private forgetRoom(roomId: string): void {
        const room = MatrixClientPeg.safeGet().getRoom(roomId);
        MatrixClientPeg.safeGet()
            .forget(roomId)
            .then(() => {
                // Switch to home page if we're currently viewing the forgotten room
                if (this.state.currentRoomId === roomId) {
                    dis.dispatch({ action: Action.ViewHomePage });
                }

                // We have to manually update the room list because the forgotten room will not
                // be notified to us, therefore the room list will have no other way of knowing
                // the room is forgotten.
                if (room) RoomListStore.instance.manualRoomUpdate(room, RoomUpdateCause.RoomRemoved);
            })
            .catch((err) => {
                const errCode = err.errcode || _td("error|unknown_error_code");
                Modal.createDialog(ErrorDialog, {
                    title: _t("error_dialog|forget_room_failed", { errCode }),
                    description: err?.message ?? _t("invite|failed_generic"),
                });
            });
    }

    private async copyRoom(roomId: string): Promise<void> {
        const roomLink = makeRoomPermalink(MatrixClientPeg.safeGet(), roomId);
        const success = await copyPlaintext(roomLink);
        if (!success) {
            Modal.createDialog(ErrorDialog, {
                title: _t("error_dialog|copy_room_link_failed|title"),
                description: _t("error_dialog|copy_room_link_failed|description"),
            });
        }
    }

    /**
     * Returns true if the user must go through the device verification process before they
     * can use the app.
     * @returns true if the user must verify
     */
    private async shouldForceVerification(): Promise<boolean> {
        if (!SdkConfig.get("force_verification")) return false;
        const mustVerifyFlag = localStorage.getItem("must_verify_device");
        if (!mustVerifyFlag) return false;

        const client = MatrixClientPeg.safeGet();
        if (client.isGuest()) return false;

        const crypto = client.getCrypto();
        const crossSigningReady = await crypto?.isCrossSigningReady();

        return !crossSigningReady;
    }

    /**
     * Called when a new logged in session has started
     */
    private async onLoggedIn(): Promise<void> {
        ThemeController.isLogin = false;
        this.themeWatcher?.recheck();
        StorageManager.tryPersistStorage();

        await this.onShowPostLoginScreen();
    }

    private async onShowPostLoginScreen(): Promise<void> {
        this.setStateForNewView({ view: Views.LOGGED_IN });
        // If a specific screen is set to be shown after login, show that above
        // all else, as it probably means the user clicked on something already.
        if (this.screenAfterLogin?.screen) {
            this.showScreen(this.screenAfterLogin.screen, this.screenAfterLogin.params);
            this.screenAfterLogin = undefined;
        } else if (MatrixClientPeg.currentUserIsJustRegistered()) {
            MatrixClientPeg.setJustRegisteredUserId(null);

            if (ThreepidInviteStore.instance.pickBestInvite()) {
                // The user has a 3pid invite pending - show them that
                const threepidInvite = ThreepidInviteStore.instance.pickBestInvite();

                // HACK: This is a pretty brutal way of threading the invite back through
                // our systems, but it's the safest we have for now.
                const params = ThreepidInviteStore.instance.translateToWireFormat(threepidInvite);
                this.showScreen(`room/${threepidInvite.roomId}`, params);
            } else {
                // The user has just logged in after registering,
                // so show the homepage.
                dis.dispatch<ViewHomePagePayload>({ action: Action.ViewHomePage, justRegistered: true });
            }
        } else if (!(await this.shouldForceVerification())) {
            this.showScreenAfterLogin();
        }

        if (SdkConfig.get("mobile_guide_toast")) {
            // The toast contains further logic to detect mobile platforms,
            // check if it has been dismissed before, etc.
            showMobileGuideToast();
        }

        const userNotice = SdkConfig.get("user_notice");
        if (userNotice) {
            const key = "user_notice_" + userNotice.title;
            if (!userNotice.show_once || !localStorage.getItem(key)) {
                ToastStore.sharedInstance().addOrReplaceToast({
                    key,
                    title: userNotice.title,
                    props: {
                        description: <Linkify>{userNotice.description}</Linkify>,
                        primaryLabel: _t("action|ok"),
                        onPrimaryClick: () => {
                            ToastStore.sharedInstance().dismissToast(key);
                            localStorage.setItem(key, "1");
                        },
                    },
                    component: GenericToast,
                    className: "mx_AnalyticsToast",
                    priority: 100,
                });
            }
        }
    }

    private initPosthogAnalyticsToast(): void {
        // Show the analytics toast if necessary
        if (SettingsStore.getValue("pseudonymousAnalyticsOptIn") === null) {
            showAnalyticsToast();
        }

        // Listen to changes in settings and show the toast if appropriate - this is necessary because account
        // settings can still be changing at this point in app init (due to the initial sync being cached, then
        // subsequent syncs being received from the server)
        SettingsStore.watchSetting(
            "pseudonymousAnalyticsOptIn",
            null,
            (originalSettingName, changedInRoomId, atLevel, newValueAtLevel, newValue) => {
                if (newValue === null) {
                    showAnalyticsToast();
                } else {
                    // It's possible for the value to change if a cached sync loads at page load, but then network
                    // sync contains a new value of the flag with it set to false (e.g. another device set it since last
                    // loading the page); so hide the toast.
                    // (this flipping usually happens before first render so the user won't notice it; anyway flicker
                    // on/off is probably better than showing the toast again when the user already dismissed it)
                    hideAnalyticsToast();
                }
            },
        );
    }

    private showScreenAfterLogin(): void {
        // If screenAfterLogin is set, use that, then null it so that a second login will
        // result in view_home_page, _user_settings or _room_directory
        if (this.screenAfterLogin && this.screenAfterLogin.screen) {
            this.showScreen(this.screenAfterLogin.screen, this.screenAfterLogin.params);
            this.screenAfterLogin = undefined;
        } else if (localStorage && localStorage.getItem("mx_last_room_id")) {
            // Before defaulting to directory, show the last viewed room
            this.viewLastRoom();
        } else {
            if (MatrixClientPeg.safeGet().isGuest()) {
                dis.dispatch({ action: "view_welcome_page" });
            } else {
                dis.dispatch({ action: Action.ViewHomePage });
            }
        }
    }

    private viewLastRoom(): void {
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: localStorage.getItem("mx_last_room_id") ?? undefined,
            metricsTrigger: undefined, // other
        });
    }

    /**
     * Called when the session is logged out
     */
    private onLoggedOut(): void {
        this.viewLogin({
            ready: false,
            collapseLhs: false,
            currentRoomId: null,
        });
        this.subTitleStatus = "";
        this.setPageSubtitle();
        this.stores.onLoggedOut();
    }

    /**
     * Called when the session is softly logged out
     */
    private onSoftLogout(): void {
        this.notifyNewScreen("soft_logout");
        this.setStateForNewView({
            view: Views.SOFT_LOGOUT,
            ready: false,
            collapseLhs: false,
            currentRoomId: null,
        });
        this.subTitleStatus = "";
        this.setPageSubtitle();
    }

    /**
     * Called just before the matrix client is started
     * (useful for setting listeners)
     */
    private onWillStartClient(): void {
        // Reset the 'have completed first sync' flag,
        // since we're about to start the client and therefore about to do the first sync
        // We resolve the existing promise with the new one to update any existing listeners
        if (!this.firstSyncComplete) {
            const firstSyncPromise = defer<void>();
            this.firstSyncPromise.resolve(firstSyncPromise.promise);
            this.firstSyncPromise = firstSyncPromise;
        } else {
            this.firstSyncPromise = defer();
        }
        this.firstSyncComplete = false;
        const cli = MatrixClientPeg.safeGet();

        // Allow the JS SDK to reap timeline events. This reduces the amount of
        // memory consumed as the JS SDK stores multiple distinct copies of room
        // state (each of which can be 10s of MBs) for each DISJOINT timeline. This is
        // particularly noticeable when there are lots of 'limited' /sync responses
        // such as when laptops unsleep.
        // https://github.com/vector-im/element-web/issues/3307#issuecomment-282895568
        cli.setCanResetTimelineCallback((roomId) => {
            logger.log("Request to reset timeline in room ", roomId, " viewing:", this.state.currentRoomId);
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

        cli.on(ClientEvent.Sync, (state: SyncState, prevState: SyncState | null, data?: SyncStateData) => {
            if (state === SyncState.Error || state === SyncState.Reconnecting) {
                this.setState({ syncError: data?.error ?? null });
            } else if (this.state.syncError) {
                this.setState({ syncError: null });
            }

            if (state === SyncState.Syncing && prevState === SyncState.Syncing) {
                // We know we have performabed a live update and known rooms should be in a good state.
                // Now is a good time to clean up drafts.
                cleanUpDraftsIfRequired();
                return;
            }
            logger.debug(`MatrixClient sync state => ${state}`);
            if (state !== SyncState.Prepared) {
                return;
            }

            this.firstSyncComplete = true;
            this.firstSyncPromise.resolve();

            if (Notifier.shouldShowPrompt() && !MatrixClientPeg.userRegisteredWithinLastHours(24)) {
                showNotificationsToast(false);
            }

            dis.fire(Action.FocusSendMessageComposer);
        });

        cli.on(HttpApiEvent.SessionLoggedOut, (errObj) => {
            this.loadSessionAbortController.abort(errObj);
            this.loadSessionAbortController = new AbortController();

            if (Lifecycle.isLoggingOut()) return;

            // A modal might have been open when we were logged out by the server
            Modal.forceCloseAllModals();

            if (errObj.httpStatus === 401 && errObj.data?.["soft_logout"]) {
                logger.warn("Soft logout issued by server - avoiding data deletion");
                Lifecycle.softLogout();
                return;
            }

            dis.dispatch(
                {
                    action: "logout",
                },
                true,
            );

            // The above dispatch closes all modals, so open the modal after calling it synchronously
            Modal.createDialog(ErrorDialog, {
                title: _t("auth|session_logged_out_title"),
                description: _t("auth|session_logged_out_description"),
            });
        });
        cli.on(HttpApiEvent.NoConsent, function (message, consentUri) {
            Modal.createDialog(
                QuestionDialog,
                {
                    title: _t("terms|tac_title"),
                    description: (
                        <div>
                            <p> {_t("terms|tac_description", { homeserverDomain: cli.getDomain() })}</p>
                        </div>
                    ),
                    button: _t("terms|tac_button"),
                    cancelButton: _t("action|dismiss"),
                    onFinished: (confirmed) => {
                        if (confirmed) {
                            const wnd = window.open(consentUri, "_blank")!;
                            wnd.opener = null;
                        }
                    },
                },
                undefined,
                true,
            );
        });

        DecryptionFailureTracker.instance
            .start(cli)
            .catch((e) => logger.error("Unable to start DecryptionFailureTracker", e));

        cli.on(ClientEvent.Room, (room) => {
            if (cli.getCrypto()) {
                const blacklistEnabled = SettingsStore.getValueAt(
                    SettingLevel.ROOM_DEVICE,
                    "blacklistUnverifiedDevices",
                    room.roomId,
                    /*explicit=*/ true,
                );
                room.setBlacklistUnverifiedDevices(blacklistEnabled);
            }
        });
        cli.on(CryptoEvent.KeyBackupFailed, async (errcode): Promise<void> => {
            let haveNewVersion: boolean | undefined;
            let newVersionInfo: KeyBackupInfo | null = null;
            const keyBackupEnabled = Boolean(
                cli.getCrypto() && (await cli.getCrypto()?.getActiveSessionBackupVersion()) !== null,
            );

            // if key backup is still enabled, there must be a new backup in place
            if (keyBackupEnabled) {
                haveNewVersion = true;
            } else {
                // otherwise check the server to see if there's a new one
                try {
                    newVersionInfo = (await cli.getCrypto()?.getKeyBackupInfo()) ?? null;
                    if (newVersionInfo !== null) haveNewVersion = true;
                } catch (e) {
                    logger.error("Saw key backup error but failed to check backup version!", e);
                    return;
                }
            }

            if (haveNewVersion) {
                Modal.createDialog(
                    lazy(() => import("../../async-components/views/dialogs/security/NewRecoveryMethodDialog")),
                );
            } else {
                Modal.createDialog(
                    lazy(() => import("../../async-components/views/dialogs/security/RecoveryMethodRemovedDialog")),
                );
            }
        });

        cli.on(CryptoEvent.VerificationRequestReceived, (request) => {
            if (request.verifier) {
                Modal.createDialog(
                    IncomingSasDialog,
                    {
                        verifier: request.verifier,
                    },
                    undefined,
                    /* priority = */ false,
                    /* static = */ true,
                );
            } else if (request.pending) {
                ToastStore.sharedInstance().addOrReplaceToast({
                    key: "verifreq_" + request.transactionId,
                    title: _t("encryption|verification_requested_toast_title"),
                    icon: "verification",
                    props: { request },
                    component: VerificationRequestToast,
                    priority: 90,
                });
            }
        });
    }

    /**
     * Called shortly after the matrix client has started. Useful for
     * setting up anything that requires the client to be started.
     * @private
     */
    private async onClientStarted(): Promise<void> {
        const cli = MatrixClientPeg.safeGet();

        const shouldForceVerification = await this.shouldForceVerification();
        // XXX: Don't replace the screen if it's already one of these: postLoginSetup
        // changes to these screens in certain circumstances so we shouldn't clobber it.
        // We should probably have one place where we decide what the next screen is after
        // login.
        if (![Views.COMPLETE_SECURITY, Views.E2E_SETUP].includes(this.state.view)) {
            if (shouldForceVerification) {
                this.setStateForNewView({ view: Views.COMPLETE_SECURITY });
            }
        }

        const crypto = cli.getCrypto();
        if (crypto) {
            const blacklistEnabled = SettingsStore.getValueAt(SettingLevel.DEVICE, "blacklistUnverifiedDevices");
            crypto.globalBlacklistUnverifiedDevices = blacklistEnabled;
        }

        // Cannot be done in OnLoggedIn as at that point the AccountSettingsHandler doesn't yet have a client
        // Will be moved to a pre-login flow as well
        if (PosthogAnalytics.instance.isEnabled() && SettingsStore.isLevelSupported(SettingLevel.ACCOUNT)) {
            this.initPosthogAnalyticsToast();
        }

        this.setState({
            ready: true,
        });
    }

    public showScreen(screen: string, params?: { [key: string]: any }): void {
        const cli = MatrixClientPeg.get();
        const isLoggedOutOrGuest = !cli || cli.isGuest();
        if (!isLoggedOutOrGuest && AUTH_SCREENS.includes(screen)) {
            // user is logged in and landing on an auth page which will uproot their session, redirect them home instead
            dis.dispatch({ action: Action.ViewHomePage });
            return;
        }

        if (screen === "register") {
            dis.dispatch({
                action: "start_registration",
                params: params,
            });
            PerformanceMonitor.instance.start(PerformanceEntryNames.REGISTER);
        } else if (screen === "mobile_register") {
            dis.dispatch({
                action: "start_mobile_registration",
                params: params,
            });
        } else if (screen === "login") {
            dis.dispatch({
                action: "start_login",
                params: params,
            });
            PerformanceMonitor.instance.start(PerformanceEntryNames.LOGIN);
        } else if (screen === "forgot_password") {
            dis.dispatch({
                action: "start_password_recovery",
                params: params,
            });
        } else if (screen === "soft_logout") {
            if (!!cli?.getUserId() && !Lifecycle.isSoftLogout()) {
                // Logged in - visit a room
                this.viewLastRoom();
            } else {
                // Ultimately triggers soft_logout if needed
                dis.dispatch({
                    action: "start_login",
                    params: params,
                });
            }
        } else if (screen === "new") {
            dis.dispatch({
                action: Action.CreateRoom,
            });
        } else if (screen === "dm") {
            dis.dispatch({
                action: Action.CreateChat,
            });
        } else if (screen === "settings") {
            dis.fire(Action.ViewUserSettings);
        } else if (screen === "welcome") {
            dis.dispatch({
                action: "view_welcome_page",
            });
        } else if (screen === "home") {
            dis.dispatch({
                action: Action.ViewHomePage,
            });
        } else if (screen === "directory") {
            dis.fire(Action.ViewRoomDirectory);
        } else if (screen === "start_sso" || screen === "start_cas") {
            let cli = MatrixClientPeg.get();
            if (!cli) {
                const { hsUrl, isUrl } = this.getServerProperties().serverConfig;
                cli = createClient({
                    baseUrl: hsUrl,
                    idBaseUrl: isUrl,
                });
            }

            const type = screen === "start_sso" ? "sso" : "cas";
            PlatformPeg.get()?.startSingleSignOn(cli, type, this.getFragmentAfterLogin());
        } else if (screen.indexOf("room/") === 0) {
            // Rooms can have the following formats:
            // #room_alias:domain or !opaque_id:domain
            const room = screen.substring(5);
            const domainOffset = room.indexOf(":") + 1; // 0 in case room does not contain a :
            let eventOffset = room.length;
            // room aliases can contain slashes only look for slash after domain
            if (room.substring(domainOffset).indexOf("/") > -1) {
                eventOffset = domainOffset + room.substring(domainOffset).indexOf("/");
            }
            const roomString = room.substring(0, eventOffset);
            let eventId: string | undefined = room.substring(eventOffset + 1); // empty string if no event id given

            // Previously we pulled the eventID from the segments in such a way
            // where if there was no eventId then we'd get undefined. However, we
            // now do a splice and join to handle v3 event IDs which results in
            // an empty string. To maintain our potential contract with the rest
            // of the app, we coerce the eventId to be undefined where applicable.
            if (!eventId) eventId = undefined;

            // TODO: Handle encoded room/event IDs: https://github.com/vector-im/element-web/issues/9149

            let threepidInvite: IThreepidInvite | undefined;
            // if we landed here from a 3PID invite, persist it
            if (params?.signurl && params?.email) {
                threepidInvite = ThreepidInviteStore.instance.storeInvite(
                    roomString,
                    params as IThreepidInviteWireFormat,
                );
            }
            // otherwise check that this room doesn't already have a known invite
            if (!threepidInvite) {
                const invites = ThreepidInviteStore.instance.getInvites();
                threepidInvite = invites.find((invite) => invite.roomId === roomString);
            }

            // on our URLs there might be a ?via=matrix.org or similar to help
            // joins to the room succeed. We'll pass these through as an array
            // to other levels. If there's just one ?via= then params.via is a
            // single string. If someone does something like ?via=one.com&via=two.com
            // then params.via is an array of strings.
            let via: string[] = [];
            if (params?.via) {
                if (typeof params.via === "string") via = [params.via];
                else via = params.via;
            }

            const payload: ViewRoomPayload = {
                action: Action.ViewRoom,
                event_id: eventId,
                via_servers: via,
                // If an event ID is given in the URL hash, notify RoomViewStore to mark
                // it as highlighted, which will propagate to RoomView and highlight the
                // associated EventTile.
                highlighted: Boolean(eventId),
                threepid_invite: threepidInvite,
                // TODO: Replace oob_data with the threepidInvite (which has the same info).
                // This isn't done yet because it's threaded through so many more places.
                // See https://github.com/vector-im/element-web/issues/15157
                oob_data: {
                    name: threepidInvite?.roomName,
                    avatarUrl: threepidInvite?.roomAvatarUrl,
                    inviterName: threepidInvite?.inviterName,
                },
                room_alias: undefined,
                room_id: undefined,
                metricsTrigger: undefined, // unknown or external trigger
            };
            if (roomString[0] === "#") {
                payload.room_alias = roomString;
            } else {
                payload.room_id = roomString;
            }

            dis.dispatch(payload);
        } else if (screen.indexOf("user/") === 0) {
            const userId = screen.substring(5);
            dis.dispatch({
                action: "view_user_info",
                userId: userId,
                subAction: params?.action,
            });
        } else {
            logger.info(`Ignoring showScreen for '${screen}'`);
        }
    }

    private notifyNewScreen(screen: string, replaceLast = false): void {
        if (this.props.onNewScreen) {
            this.props.onNewScreen(screen, replaceLast);
        }
        this.setPageSubtitle();
    }

    private onLogoutClick(event: ButtonEvent): void {
        dis.dispatch({
            action: "logout",
        });
        event.stopPropagation();
        event.preventDefault();
    }

    private handleResize = (): void => {
        const LHS_THRESHOLD = 1000;
        const width = UIStore.instance.windowWidth;

        if (this.prevWindowWidth < LHS_THRESHOLD && width >= LHS_THRESHOLD) {
            dis.dispatch({ action: "show_left_panel" });
        }

        if (this.prevWindowWidth >= LHS_THRESHOLD && width < LHS_THRESHOLD) {
            dis.dispatch({ action: "hide_left_panel" });
        }

        this.prevWindowWidth = width;
        this.state.resizeNotifier.notifyWindowResized();
    };

    private dispatchTimelineResize(): void {
        dis.dispatch({ action: "timeline_resize" });
    }

    private onRegisterClick = (): void => {
        this.showScreen("register");
    };

    private onLoginClick = (): void => {
        this.showScreen("login");
    };

    private onForgotPasswordClick = (): void => {
        this.showScreen("forgot_password");
    };

    private onRegisterFlowComplete = (credentials: IMatrixClientCreds): Promise<void> => {
        return this.onUserCompletedLoginFlow(credentials);
    };

    // returns a promise which resolves to the new MatrixClient
    private onRegistered(credentials: IMatrixClientCreds): Promise<MatrixClient> {
        return Lifecycle.setLoggedIn(credentials);
    }

    private onSendEvent(roomId: string, event: MatrixEvent): void {
        const cli = MatrixClientPeg.get();
        if (!cli) return;

        cli.sendEvent(roomId, event.getType() as keyof TimelineEvents, event.getContent()).then(() => {
            dis.dispatch({ action: "message_sent" });
        });
    }

    private setPageSubtitle(subtitle = ""): void {
        if (this.state.currentRoomId) {
            const client = MatrixClientPeg.get();
            const room = client?.getRoom(this.state.currentRoomId);
            if (room) {
                subtitle = `${this.subTitleStatus} | ${room.name} ${subtitle}`;
            }
        } else {
            subtitle = `${this.subTitleStatus} ${subtitle}`;
        }

        const title = `${SdkConfig.get().brand} ${subtitle}`;

        if (document.title !== title) {
            document.title = title;
        }
    }

    private onUpdateStatusIndicator = (notificationState: SummarizedNotificationState, state: SyncState): void => {
        const numUnreadRooms = notificationState.numUnreadStates; // we know that states === rooms here

        if (PlatformPeg.get()) {
            PlatformPeg.get()!.setErrorStatus(state === SyncState.Error);
            PlatformPeg.get()!.setNotificationCount(numUnreadRooms);
        }

        this.subTitleStatus = "";
        if (state === SyncState.Error) {
            this.subTitleStatus += `[${_t("common|offline")}] `;
        }
        if (numUnreadRooms > 0) {
            this.subTitleStatus += `[${numUnreadRooms}]`;
        } else if (notificationState.level >= NotificationLevel.Activity) {
            this.subTitleStatus += `*`;
        }

        this.setPageSubtitle();
    };

    private onServerConfigChange = (serverConfig: ValidatedServerConfig): void => {
        this.setState({ serverConfig });
    };

    /**
     * After registration or login, we run various post-auth steps before entering the app
     * proper, such setting up cross-signing or verifying the new session.
     *
     * Note: SSO users (and any others using token login) currently do not pass through
     * this, as they instead jump straight into the app after `attemptTokenLogin`.
     */
    private onUserCompletedLoginFlow = async (credentials: IMatrixClientCreds): Promise<void> => {
        // Create and start the client
        await Lifecycle.setLoggedIn(credentials);
        await this.postLoginSetup();

        PerformanceMonitor.instance.stop(PerformanceEntryNames.LOGIN);
        PerformanceMonitor.instance.stop(PerformanceEntryNames.REGISTER);
    };

    // complete security / e2e setup has finished
    private onCompleteSecurityE2eSetupFinished = async (): Promise<void> => {
        const forceVerify = await this.shouldForceVerification();
        if (forceVerify) {
            const isVerified = await MatrixClientPeg.safeGet().getCrypto()?.isCrossSigningReady();
            if (!isVerified) {
                // We must verify but we haven't yet verified - don't continue logging in
                return;
            }
        }

        await this.onShowPostLoginScreen().catch((e) => {
            logger.error("Exception showing post-login screen", e);
        });
    };

    private getFragmentAfterLogin(): string {
        let fragmentAfterLogin = "";
        const initialScreenAfterLogin = this.props.initialScreenAfterLogin;
        if (
            initialScreenAfterLogin &&
            // XXX: workaround for https://github.com/vector-im/element-web/issues/11643 causing a login-loop
            !["welcome", "login", "register", "start_sso", "start_cas"].includes(initialScreenAfterLogin.screen)
        ) {
            fragmentAfterLogin = `/${initialScreenAfterLogin.screen}`;
        }
        return fragmentAfterLogin;
    }

    public render(): React.ReactNode {
        const fragmentAfterLogin = this.getFragmentAfterLogin();
        let view: JSX.Element;

        if (this.state.view === Views.LOADING) {
            view = (
                <div className="mx_MatrixChat_splash">
                    <Spinner />
                </div>
            );
        } else if (this.state.view === Views.CONFIRM_LOCK_THEFT) {
            view = (
                <ConfirmSessionLockTheftView
                    onConfirm={() => {
                        this.setState({ view: Views.LOADING });
                        this.startInitSession();
                    }}
                />
            );
        } else if (this.state.view === Views.COMPLETE_SECURITY) {
            view = <CompleteSecurity onFinished={this.onCompleteSecurityE2eSetupFinished} />;
        } else if (this.state.view === Views.E2E_SETUP) {
            view = <E2eSetup onFinished={this.onCompleteSecurityE2eSetupFinished} />;
        } else if (this.state.view === Views.LOGGED_IN) {
            // `ready` and `view==LOGGED_IN` may be set before `page_type` (because the
            // latter is set via the dispatcher). If we don't yet have a `page_type`,
            // keep showing the spinner for now.
            if (this.state.ready && this.state.page_type) {
                /* for now, we stuff the entirety of our props and state into the LoggedInView.
                 * we should go through and figure out what we actually need to pass down, as well
                 * as using something like redux to avoid having a billion bits of state kicking around.
                 */
                view = (
                    <LoggedInView
                        {...this.props}
                        {...this.state}
                        ref={this.loggedInView}
                        matrixClient={MatrixClientPeg.safeGet()}
                        onRegistered={this.onRegistered}
                        currentRoomId={this.state.currentRoomId}
                    />
                );
            } else {
                // we think we are logged in, but are still waiting for the /sync to complete
                view = (
                    <LoginSplashView
                        matrixClient={MatrixClientPeg.safeGet()}
                        onLogoutClick={this.onLogoutClick}
                        syncError={this.state.syncError}
                    />
                );
            }
        } else if (this.state.view === Views.WELCOME) {
            view = <Welcome />;
        } else if (this.state.view === Views.REGISTER && SettingsStore.getValue(UIFeature.Registration)) {
            const email = ThreepidInviteStore.instance.pickBestInvite()?.toEmail;
            view = (
                <Registration
                    clientSecret={this.state.register_client_secret}
                    sessionId={this.state.register_session_id}
                    idSid={this.state.register_id_sid}
                    email={email}
                    brand={this.props.config.brand}
                    onLoggedIn={this.onRegisterFlowComplete}
                    onLoginClick={this.onLoginClick}
                    onServerConfigChange={this.onServerConfigChange}
                    defaultDeviceDisplayName={this.props.defaultDeviceDisplayName}
                    fragmentAfterLogin={fragmentAfterLogin}
                    mobileRegister={this.state.isMobileRegistration}
                    {...this.getServerProperties()}
                />
            );
        } else if (this.state.view === Views.FORGOT_PASSWORD && SettingsStore.getValue(UIFeature.PasswordReset)) {
            view = (
                <ForgotPassword
                    onComplete={this.onLoginClick}
                    onLoginClick={this.onLoginClick}
                    {...this.getServerProperties()}
                />
            );
        } else if (this.state.view === Views.LOGIN) {
            const showPasswordReset = SettingsStore.getValue(UIFeature.PasswordReset);
            view = (
                <Login
                    isSyncing={this.state.pendingInitialSync}
                    onLoggedIn={this.onUserCompletedLoginFlow}
                    onRegisterClick={this.onRegisterClick}
                    fallbackHsUrl={this.getFallbackHsUrl()}
                    defaultDeviceDisplayName={this.props.defaultDeviceDisplayName}
                    onForgotPasswordClick={showPasswordReset ? this.onForgotPasswordClick : undefined}
                    onServerConfigChange={this.onServerConfigChange}
                    fragmentAfterLogin={fragmentAfterLogin}
                    defaultUsername={this.props.startingFragmentQueryParams?.defaultUsername as string | undefined}
                    {...this.getServerProperties()}
                />
            );
        } else if (this.state.view === Views.SOFT_LOGOUT) {
            view = (
                <SoftLogout
                    realQueryParams={this.props.realQueryParams}
                    onTokenLoginCompleted={this.props.onTokenLoginCompleted}
                    fragmentAfterLogin={fragmentAfterLogin}
                />
            );
        } else if (this.state.view === Views.LOCK_STOLEN) {
            view = <SessionLockStolenView />;
        } else {
            logger.error(`Unknown view ${this.state.view}`);
            return null;
        }

        return (
            <ErrorBoundary>
                <SDKContext.Provider value={this.stores}>
                    <TooltipProvider>{view}</TooltipProvider>
                </SDKContext.Provider>
            </ErrorBoundary>
        );
    }
}
