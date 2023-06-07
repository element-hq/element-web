/*
Copyright 2015-2022 The Matrix.org Foundation C.I.C.

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

import React, { createRef } from "react";
import {
    ClientEvent,
    createClient,
    EventType,
    HttpApiEvent,
    MatrixClient,
    MatrixEventEvent,
} from "matrix-js-sdk/src/matrix";
import { ISyncStateData, SyncState } from "matrix-js-sdk/src/sync";
import { InvalidStoreError } from "matrix-js-sdk/src/errors";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { defer, IDeferred, QueryDict } from "matrix-js-sdk/src/utils";
import { logger } from "matrix-js-sdk/src/logger";
import { throttle } from "lodash";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";
import { RoomType } from "matrix-js-sdk/src/@types/event";
import { DecryptionError } from "matrix-js-sdk/src/crypto/algorithms";

// focus-visible is a Polyfill for the :focus-visible CSS pseudo-attribute used by various components
import "focus-visible";
// what-input helps improve keyboard accessibility
import "what-input";

import type NewRecoveryMethodDialog from "../../async-components/views/dialogs/security/NewRecoveryMethodDialog";
import type RecoveryMethodRemovedDialog from "../../async-components/views/dialogs/security/RecoveryMethodRemovedDialog";
import PosthogTrackers from "../../PosthogTrackers";
import { DecryptionFailureTracker } from "../../DecryptionFailureTracker";
import { IMatrixClientCreds, MatrixClientPeg } from "../../MatrixClientPeg";
import PlatformPeg from "../../PlatformPeg";
import SdkConfig from "../../SdkConfig";
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
import createRoom, { IOpts } from "../../createRoom";
import { _t, _td, getCurrentLanguage } from "../../languageHandler";
import SettingsStore from "../../settings/SettingsStore";
import ThemeController from "../../settings/controllers/ThemeController";
import { startAnyRegistrationFlow } from "../../Registration";
import { messageForSyncError } from "../../utils/ErrorUtils";
import ResizeNotifier from "../../utils/ResizeNotifier";
import AutoDiscoveryUtils from "../../utils/AutoDiscoveryUtils";
import DMRoomMap from "../../utils/DMRoomMap";
import ThemeWatcher from "../../settings/watchers/ThemeWatcher";
import { FontWatcher } from "../../settings/watchers/FontWatcher";
import { storeRoomAliasInCache } from "../../RoomAliasCache";
import ToastStore from "../../stores/ToastStore";
import * as StorageManager from "../../utils/StorageManager";
import { UseCase } from "../../settings/enums/UseCase";
import type LoggedInViewType from "./LoggedInView";
import LoggedInView from "./LoggedInView";
import { Action } from "../../dispatcher/actions";
import { hideToast as hideAnalyticsToast, showToast as showAnalyticsToast } from "../../toasts/AnalyticsToast";
import { showToast as showNotificationsToast } from "../../toasts/DesktopNotificationsToast";
import { OpenToTabPayload } from "../../dispatcher/payloads/OpenToTabPayload";
import ErrorDialog from "../views/dialogs/ErrorDialog";
import {
    RoomNotificationStateStore,
    UPDATE_STATUS_INDICATOR,
} from "../../stores/notifications/RoomNotificationStateStore";
import { SettingLevel } from "../../settings/SettingLevel";
import ThreepidInviteStore, { IThreepidInvite, IThreepidInviteWireFormat } from "../../stores/ThreepidInviteStore";
import { UIFeature } from "../../settings/UIFeature";
import DialPadModal from "../views/voip/DialPadModal";
import { showToast as showMobileGuideToast } from "../../toasts/MobileGuideToast";
import { shouldUseLoginForWelcome } from "../../utils/pages";
import RoomListStore from "../../stores/room-list/RoomListStore";
import { RoomUpdateCause } from "../../stores/room-list/models";
import SecurityCustomisations from "../../customisations/Security";
import Spinner from "../views/elements/Spinner";
import QuestionDialog from "../views/dialogs/QuestionDialog";
import UserSettingsDialog from "../views/dialogs/UserSettingsDialog";
import CreateRoomDialog from "../views/dialogs/CreateRoomDialog";
import KeySignatureUploadFailedDialog from "../views/dialogs/KeySignatureUploadFailedDialog";
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
import AccessibleButton, { ButtonEvent } from "../views/elements/AccessibleButton";
import { ActionPayload } from "../../dispatcher/payloads";
import { SummarizedNotificationState } from "../../stores/notifications/SummarizedNotificationState";
import Views from "../../Views";
import { ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { ViewHomePagePayload } from "../../dispatcher/payloads/ViewHomePagePayload";
import { AfterLeaveRoomPayload } from "../../dispatcher/payloads/AfterLeaveRoomPayload";
import { DoAfterSyncPreparedPayload } from "../../dispatcher/payloads/DoAfterSyncPreparedPayload";
import { ViewStartChatOrReusePayload } from "../../dispatcher/payloads/ViewStartChatOrReusePayload";
import { IConfigOptions } from "../../IConfigOptions";
import { SnakedObject } from "../../utils/SnakedObject";
import { leaveRoomBehaviour } from "../../utils/leave-behaviour";
import { CallStore } from "../../stores/CallStore";
import { IRoomStateEventsActionPayload } from "../../actions/MatrixActionCreators";
import { ShowThreadPayload } from "../../dispatcher/payloads/ShowThreadPayload";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../stores/right-panel/RightPanelStore";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import { UseCaseSelection } from "../views/elements/UseCaseSelection";
import { ValidatedServerConfig } from "../../utils/ValidatedServerConfig";
import { isLocalRoom } from "../../utils/localRoom/isLocalRoom";
import { SdkContextClass, SDKContext } from "../../contexts/SDKContext";
import { viewUserDeviceSettings } from "../../actions/handlers/viewUserDeviceSettings";
import { cleanUpBroadcasts, VoiceBroadcastResumer } from "../../voice-broadcast";
import GenericToast from "../views/toasts/GenericToast";
import RovingSpotlightDialog, { Filter } from "../views/dialogs/spotlight/SpotlightDialog";
import { findDMForUser } from "../../utils/dm/findDMForUser";
import { Linkify } from "../../HtmlUtils";
import { NotificationColor } from "../../stores/notifications/NotificationColor";
import { UserTab } from "../views/dialogs/UserTab";

// legacy export
export { default as Views } from "../../Views";

const AUTH_SCREENS = ["register", "login", "forgot_password", "start_sso", "start_cas", "welcome"];

// Actions that are redirected through the onboarding process prior to being
// re-dispatched. NOTE: some actions are non-trivial and would require
// re-factoring to be included in this list in future.
const ONBOARDING_FLOW_STARTERS = [Action.ViewUserSettings, "view_create_chat", "view_create_room"];

interface IScreen {
    screen: string;
    params?: QueryDict;
}

interface IProps {
    config: IConfigOptions;
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
    // A function that makes a registration URL
    makeRegistrationUrl: (params: QueryDict) => string;
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
    private focusComposer: boolean;
    private subTitleStatus: string;
    private prevWindowWidth: number;
    private voiceBroadcastResumer?: VoiceBroadcastResumer;

    private readonly loggedInView: React.RefObject<LoggedInViewType>;
    private readonly dispatcherRef: string;
    private readonly themeWatcher: ThemeWatcher;
    private readonly fontWatcher: FontWatcher;
    private readonly stores: SdkContextClass;

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

            syncError: null, // If the current syncing status is ERROR, the error object, otherwise null.
            resizeNotifier: new ResizeNotifier(),
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
        if (this.screenAfterLogin) {
            const params = this.screenAfterLogin.params || {};
            if (this.screenAfterLogin.screen.startsWith("room/") && params["signurl"] && params["email"]) {
                // probably a threepid invite - try to store it
                const roomId = this.screenAfterLogin.screen.substring("room/".length);
                ThreepidInviteStore.instance.storeInvite(roomId, params as unknown as IThreepidInviteWireFormat);
            }
        }

        this.prevWindowWidth = UIStore.instance.windowWidth || 1000;
        UIStore.instance.on(UI_EVENTS.Resize, this.handleResize);

        // For PersistentElement
        this.state.resizeNotifier.on("middlePanelResized", this.dispatchTimelineResize);

        RoomNotificationStateStore.instance.on(UPDATE_STATUS_INDICATOR, this.onUpdateStatusIndicator);

        // Force users to go through the soft logout page if they're soft logged out
        if (Lifecycle.isSoftLogout()) {
            // When the session loads it'll be detected as soft logged out and a dispatch
            // will be sent out to say that, triggering this MatrixChat to show the soft
            // logout page.
            Lifecycle.loadSession();
        }

        this.dispatcherRef = dis.register(this.onAction);

        this.themeWatcher = new ThemeWatcher();
        this.fontWatcher = new FontWatcher();
        this.themeWatcher.start();
        this.fontWatcher.start();

        this.focusComposer = false;

        // object field used for tracking the status info appended to the title tag.
        // we don't do it as react state as i'm scared about triggering needless react refreshes.
        this.subTitleStatus = "";

        // the first thing to do is to try the token params in the query-string
        // if the session isn't soft logged out (ie: is a clean session being logged in)
        if (!Lifecycle.isSoftLogout()) {
            Lifecycle.attemptTokenLogin(
                this.props.realQueryParams,
                this.props.defaultDeviceDisplayName,
                this.getFragmentAfterLogin(),
            ).then(async (loggedIn): Promise<boolean | void> => {
                if (this.props.realQueryParams?.loginToken) {
                    // remove the loginToken from the URL regardless
                    this.props.onTokenLoginCompleted();
                }

                if (loggedIn) {
                    this.tokenLogin = true;

                    // Create and start the client
                    await Lifecycle.restoreFromLocalStorage({
                        ignoreGuest: true,
                    });
                    return this.postLoginSetup();
                }

                // if the user has followed a login or register link, don't reanimate
                // the old creds, but rather go straight to the relevant page
                const firstScreen = this.screenAfterLogin ? this.screenAfterLogin.screen : null;

                const restoreSuccess = await this.loadSession();
                if (restoreSuccess) {
                    return true;
                }

                if (firstScreen === "login" || firstScreen === "register" || firstScreen === "forgot_password") {
                    this.showScreenAfterLogin();
                }

                return false;
            });
        }

        initSentry(SdkConfig.get("sentry"));
    }

    private async postLoginSetup(): Promise<void> {
        const cli = MatrixClientPeg.get();
        const cryptoEnabled = cli.isCryptoEnabled();
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
                    crossSigningIsSetUp = await cli.userHasCrossSigningKeys();
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
            if (SecurityCustomisations.SHOW_ENCRYPTION_SETUP_UI === false) {
                this.onLoggedIn();
            } else {
                this.setStateForNewView({ view: Views.COMPLETE_SECURITY });
            }
        } else if (await cli.doesServerSupportUnstableFeature("org.matrix.e2e_cross_signing")) {
            // if cross-signing is not yet set up, do so now if possible.
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
        window.addEventListener("resize", this.onWindowResized);
    }

    public componentDidUpdate(prevProps: IProps, prevState: IState): void {
        if (this.shouldTrackPageChange(prevState, this.state)) {
            const durationMs = this.stopPageChangeTimer();
            if (durationMs != null) {
                PosthogTrackers.instance.trackPageChange(this.state.view, this.state.page_type, durationMs);
            }
        }
        if (this.focusComposer) {
            dis.fire(Action.FocusSendMessageComposer);
            this.focusComposer = false;
        }
    }

    public componentWillUnmount(): void {
        Lifecycle.stopMatrixClient();
        dis.unregister(this.dispatcherRef);
        this.themeWatcher.stop();
        this.fontWatcher.stop();
        UIStore.destroy();
        this.state.resizeNotifier.removeListener("middlePanelResized", this.dispatchTimelineResize);
        window.removeEventListener("resize", this.onWindowResized);

        this.stores.accountPasswordStore.clearPassword();
        this.voiceBroadcastResumer?.destroy();
    }

    private onWindowResized = (): void => {
        // XXX: This is a very unreliable way to detect whether or not the the devtools are open
        this.warnInConsole();
    };

    private warnInConsole = throttle((): void => {
        const largeFontSize = "50px";
        const normalFontSize = "15px";

        const waitText = _t("Wait!");
        const scamText = _t(
            "If someone told you to copy/paste something here, " + "there is a high likelihood you're being scammed!",
        );
        const devText = _t(
            "If you know what you're doing, Element is open-source, " +
                "be sure to check out our GitHub (https://github.com/vector-im/element-web/) " +
                "and contribute!",
        );

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
                });
            })
            .then((loadedSession) => {
                if (!loadedSession) {
                    // fall back to showing the welcome screen... unless we have a 3pid invite pending
                    if (ThreepidInviteStore.instance.pickBestInvite()) {
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
        // Start the onboarding process for certain actions
        if (MatrixClientPeg.get()?.isGuest() && ONBOARDING_FLOW_STARTERS.includes(payload.action)) {
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
                        MatrixClientPeg.get().setIdentityServerUrl(undefined);
                        localStorage.removeItem("mx_is_access_token");
                        localStorage.removeItem("mx_is_url");
                    } else {
                        MatrixClientPeg.get().setIdentityServerUrl(fullUrl);
                        localStorage.removeItem("mx_is_access_token"); // clear token
                        localStorage.setItem("mx_is_url", fullUrl); // XXX: Do we still need this?
                    }

                    // redispatch the change with a more specific action
                    dis.dispatch({ action: "id_server_changed" });
                }
                break;
            case "logout":
                LegacyCallHandler.instance.hangupAllCalls();
                Promise.all([
                    ...[...CallStore.instance.activeCalls].map((call) => call.disconnect()),
                    cleanUpBroadcasts(this.stores),
                ]).finally(() => Lifecycle.logout());
                break;
            case "require_registration":
                startAnyRegistrationFlow(payload as any);
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
                createRoom(MatrixClientPeg.get(), {
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
            case "reject_invite":
                Modal.createDialog(QuestionDialog, {
                    title: _t("Reject invitation"),
                    description: _t("Are you sure you want to reject the invitation?"),
                    onFinished: (confirm) => {
                        if (confirm) {
                            // FIXME: controller shouldn't be loading a view :(
                            const modal = Modal.createDialog(Spinner, undefined, "mx_Dialog_spinner");

                            MatrixClientPeg.get()
                                .leave(payload.room_id)
                                .then(
                                    () => {
                                        modal.close();
                                        if (this.state.currentRoomId === payload.room_id) {
                                            dis.dispatch({ action: Action.ViewHomePage });
                                        }
                                    },
                                    (err) => {
                                        modal.close();
                                        Modal.createDialog(ErrorDialog, {
                                            title: _t("Failed to reject invitation"),
                                            description: err.toString(),
                                        });
                                    },
                                );
                        }
                    },
                });
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
                    { initialTabId: tabPayload.initialTabId as UserTab },
                    /*className=*/ undefined,
                    /*isPriority=*/ false,
                    /*isStatic=*/ true,
                );

                // View the welcome or home page if we need something to look at
                this.viewSomethingBehindModal();
                break;
            }
            case "view_create_room":
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
            case "view_create_chat":
                showStartChatInviteDialog(payload.initialText || "");

                // View the welcome or home page if we need something to look at
                this.viewSomethingBehindModal();
                break;
            case "view_invite": {
                const room = MatrixClientPeg.get().getRoom(payload.roomId);
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
                this.stores.client = MatrixClientPeg.get();
                if (
                    // Skip this handling for token login as that always calls onLoggedIn itself
                    !this.tokenLogin &&
                    !Lifecycle.isSoftLogout() &&
                    this.state.view !== Views.LOGIN &&
                    this.state.view !== Views.REGISTER &&
                    this.state.view !== Views.COMPLETE_SECURITY &&
                    this.state.view !== Views.E2E_SETUP &&
                    this.state.view !== Views.USE_CASE_SELECTION
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
                this.onClientStarted();
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
        }
    };

    private setPage(pageType: PageType): void {
        this.setState({
            page_type: pageType,
        });
    }

    private async startRegistration(params: { [key: string]: string }): Promise<void> {
        const newState: Partial<IState> = {
            view: Views.REGISTER,
        };

        // Only honour params if they are all present, otherwise we reset
        // HS and IS URLs when switching to registration.
        if (params.client_secret && params.session_id && params.hs_url && params.is_url && params.sid) {
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

        this.setStateForNewView(newState);
        ThemeController.isLogin = true;
        this.themeWatcher.recheck();
        this.notifyNewScreen("register");
    }

    // switch view to the given room
    private async viewRoom(roomInfo: ViewRoomPayload): Promise<void> {
        this.focusComposer = true;

        if (roomInfo.room_alias) {
            logger.log(`Switching to room alias ${roomInfo.room_alias} at event ${roomInfo.event_id}`);
        } else {
            logger.log(`Switching to room id ${roomInfo.room_id} at event ${roomInfo.event_id}`);
        }

        // Wait for the first sync to complete so that if a room does have an alias,
        // it would have been retrieved.
        if (!this.firstSyncComplete) {
            if (!this.firstSyncPromise) {
                logger.warn("Cannot view a room before first sync. room_id:", roomInfo.room_id);
                return;
            }
            await this.firstSyncPromise.promise;
        }

        let presentedId = roomInfo.room_alias || roomInfo.room_id!;
        const room = MatrixClientPeg.get().getRoom(roomInfo.room_id);
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
                this.themeWatcher.recheck();
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
        this.themeWatcher.recheck();
    }

    private viewLogin(otherState?: any): void {
        this.setStateForNewView({
            view: Views.LOGIN,
            ...otherState,
        });
        this.notifyNewScreen("login");
        ThemeController.isLogin = true;
        this.themeWatcher.recheck();
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
        this.themeWatcher.recheck();
    }

    private viewUser(userId: string, subAction: string): void {
        // Wait for the first sync so that `getRoom` gives us a room object if it's
        // in the sync response
        const waitForSync = this.firstSyncPromise ? this.firstSyncPromise.promise : Promise.resolve();
        waitForSync.then(() => {
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
            createRoom(MatrixClientPeg.get(), opts!);
        }
    }

    private chatCreateOrReuse(userId: string): void {
        const snakedConfig = new SnakedObject<IConfigOptions>(this.props.config);
        // Use a deferred action to reshow the dialog once the user has registered
        if (MatrixClientPeg.get().isGuest()) {
            // No point in making 2 DMs with welcome bot. This assumes view_set_mxid will
            // result in a new DM with the welcome user.
            if (userId !== snakedConfig.get("welcome_user_id")) {
                dis.dispatch<DoAfterSyncPreparedPayload<ViewStartChatOrReusePayload>>({
                    action: Action.DoAfterSyncPrepared,
                    deferred_action: {
                        action: Action.ViewStartChatOrReuse,
                        user_id: userId,
                    },
                });
            }
            dis.dispatch({
                action: "require_registration",
                // If the set_mxid dialog is cancelled, view /welcome because if the
                // browser was pointing at /user/@someone:domain?action=chat, the URL
                // needs to be reset so that they can revisit /user/.. // (and trigger
                // `_chatCreateOrReuse` again)
                go_welcome_on_cancel: true,
                screen_after: {
                    screen: `user/${snakedConfig.get("welcome_user_id")}`,
                    params: { action: "chat" },
                },
            });
            return;
        }

        // TODO: Immutable DMs replaces this

        const client = MatrixClientPeg.get();
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
        const roomToLeave = MatrixClientPeg.get().getRoom(roomId);
        const isSpace = roomToLeave?.isSpaceRoom();
        // Show a warning if there are additional complications.
        const warnings: JSX.Element[] = [];

        const memberCount = roomToLeave?.currentState.getJoinedMemberCount();
        if (memberCount === 1) {
            warnings.push(
                <span className="warning" key="only_member_warning">
                    {" " /* Whitespace, otherwise the sentences get smashed together */}
                    {_t(
                        "You are the only person here. " +
                            "If you leave, no one will be able to join in the future, including you.",
                    )}
                </span>,
            );

            return warnings;
        }

        const joinRules = roomToLeave?.currentState.getStateEvents("m.room.join_rules", "");
        if (joinRules) {
            const rule = joinRules.getContent().join_rule;
            if (rule !== "public") {
                warnings.push(
                    <span className="warning" key="non_public_warning">
                        {" " /* Whitespace, otherwise the sentences get smashed together */}
                        {isSpace
                            ? _t("This space is not public. You will not be able to rejoin without an invite.")
                            : _t("This room is not public. You will not be able to rejoin without an invite.")}
                    </span>,
                );
            }
        }
        return warnings;
    }

    private leaveRoom(roomId: string): void {
        const cli = MatrixClientPeg.get();
        const roomToLeave = cli.getRoom(roomId);
        const warnings = this.leaveRoomWarnings(roomId);

        const isSpace = roomToLeave?.isSpaceRoom();
        Modal.createDialog(QuestionDialog, {
            title: isSpace ? _t("Leave space") : _t("Leave room"),
            description: (
                <span>
                    {isSpace
                        ? _t("Are you sure you want to leave the space '%(spaceName)s'?", {
                              spaceName: roomToLeave?.name ?? _t("Unnamed Space"),
                          })
                        : _t("Are you sure you want to leave the room '%(roomName)s'?", {
                              roomName: roomToLeave?.name ?? _t("Unnamed Room"),
                          })}
                    {warnings}
                </span>
            ),
            button: _t("Leave"),
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
        const room = MatrixClientPeg.get().getRoom(roomId);
        MatrixClientPeg.get()
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
                const errCode = err.errcode || _td("unknown error code");
                Modal.createDialog(ErrorDialog, {
                    title: _t("Failed to forget room %(errCode)s", { errCode }),
                    description: err && err.message ? err.message : _t("Operation failed"),
                });
            });
    }

    private async copyRoom(roomId: string): Promise<void> {
        const roomLink = makeRoomPermalink(MatrixClientPeg.get(), roomId);
        const success = await copyPlaintext(roomLink);
        if (!success) {
            Modal.createDialog(ErrorDialog, {
                title: _t("Unable to copy room link"),
                description: _t("Unable to copy a link to the room to the clipboard."),
            });
        }
    }

    /**
     * Starts a chat with the welcome user, if the user doesn't already have one
     * @returns {string} The room ID of the new room, or null if no room was created
     */
    private async startWelcomeUserChat(): Promise<string | null> {
        const snakedConfig = new SnakedObject<IConfigOptions>(this.props.config);
        const welcomeUserId = snakedConfig.get("welcome_user_id");
        if (!welcomeUserId) return null;

        // We can end up with multiple tabs post-registration where the user
        // might then end up with a session and we don't want them all making
        // a chat with the welcome user: try to de-dupe.
        // We need to wait for the first sync to complete for this to
        // work though.
        let waitFor: Promise<void>;
        if (!this.firstSyncComplete) {
            waitFor = this.firstSyncPromise.promise;
        } else {
            waitFor = Promise.resolve();
        }
        await waitFor;

        const welcomeUserRooms = DMRoomMap.shared().getDMRoomsForUserId(welcomeUserId);
        if (welcomeUserRooms.length === 0) {
            const roomId = await createRoom(MatrixClientPeg.get(), {
                dmUserId: snakedConfig.get("welcome_user_id"),
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
            const saveWelcomeUser = (ev: MatrixEvent): void => {
                if (ev.getType() === EventType.Direct && ev.getContent()[welcomeUserId]) {
                    MatrixClientPeg.get().store.save(true);
                    MatrixClientPeg.get().removeListener(ClientEvent.AccountData, saveWelcomeUser);
                }
            };
            MatrixClientPeg.get().on(ClientEvent.AccountData, saveWelcomeUser);

            return roomId;
        }
        return null;
    }

    /**
     * Called when a new logged in session has started
     */
    private async onLoggedIn(): Promise<void> {
        ThemeController.isLogin = false;
        this.themeWatcher.recheck();
        StorageManager.tryPersistStorage();

        if (MatrixClientPeg.currentUserIsJustRegistered() && SettingsStore.getValue("FTUE.useCaseSelection") === null) {
            this.setStateForNewView({ view: Views.USE_CASE_SELECTION });

            // Listen to changes in settings and hide the use case screen if appropriate - this is necessary because
            // account settings can still be changing at this point in app init (due to the initial sync being cached,
            // then subsequent syncs being received from the server)
            //
            // This seems unlikely for something that should happen directly after registration, but if a user does
            // their initial login on another device/browser than they registered on, we want to avoid asking this
            // question twice
            //
            // initPosthogAnalyticsToast pioneered this technique, we’re just reusing it here.
            SettingsStore.watchSetting(
                "FTUE.useCaseSelection",
                null,
                (originalSettingName, changedInRoomId, atLevel, newValueAtLevel, newValue) => {
                    if (newValue !== null && this.state.view === Views.USE_CASE_SELECTION) {
                        this.onShowPostLoginScreen();
                    }
                },
            );
        } else {
            return this.onShowPostLoginScreen();
        }
    }

    private async onShowPostLoginScreen(useCase?: UseCase): Promise<void> {
        if (useCase) {
            PosthogAnalytics.instance.setProperty("ftueUseCaseSelection", useCase);
            SettingsStore.setValue("FTUE.useCaseSelection", null, SettingLevel.ACCOUNT, useCase);
        }

        this.setStateForNewView({ view: Views.LOGGED_IN });
        // If a specific screen is set to be shown after login, show that above
        // all else, as it probably means the user clicked on something already.
        if (this.screenAfterLogin?.screen) {
            this.showScreen(this.screenAfterLogin.screen, this.screenAfterLogin.params);
            this.screenAfterLogin = undefined;
        } else if (MatrixClientPeg.currentUserIsJustRegistered()) {
            MatrixClientPeg.setJustRegisteredUserId(null);

            const snakedConfig = new SnakedObject<IConfigOptions>(this.props.config);
            if (snakedConfig.get("welcome_user_id") && getCurrentLanguage().startsWith("en")) {
                const welcomeUserRoom = await this.startWelcomeUserChat();
                if (welcomeUserRoom === null) {
                    // We didn't redirect to the welcome user room, so show
                    // the homepage.
                    dis.dispatch<ViewHomePagePayload>({ action: Action.ViewHomePage, justRegistered: true });
                }
            } else if (ThreepidInviteStore.instance.pickBestInvite()) {
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
        } else {
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
                        acceptLabel: _t("OK"),
                        onAccept: () => {
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
            if (MatrixClientPeg.get().isGuest()) {
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

        cli.on(ClientEvent.Sync, (state: SyncState, prevState: SyncState | null, data?: ISyncStateData) => {
            if (state === SyncState.Error || state === SyncState.Reconnecting) {
                if (data?.error instanceof InvalidStoreError) {
                    Lifecycle.handleInvalidStoreError(data.error);
                }
                this.setState({ syncError: data?.error ?? null });
            } else if (this.state.syncError) {
                this.setState({ syncError: null });
            }

            if (state === SyncState.Syncing && prevState === SyncState.Syncing) {
                return;
            }
            logger.info(`MatrixClient sync state => ${state}`);
            if (state !== SyncState.Prepared) {
                return;
            }

            this.firstSyncComplete = true;
            this.firstSyncPromise.resolve();

            if (Notifier.shouldShowPrompt() && !MatrixClientPeg.userRegisteredWithinLastHours(24)) {
                showNotificationsToast(false);
            }

            dis.fire(Action.FocusSendMessageComposer);
            this.setState({
                ready: true,
            });
        });

        cli.on(HttpApiEvent.SessionLoggedOut, function (errObj) {
            if (Lifecycle.isLoggingOut()) return;

            // A modal might have been open when we were logged out by the server
            Modal.closeCurrentModal("Session.logged_out");

            if (errObj.httpStatus === 401 && errObj.data && errObj.data["soft_logout"]) {
                logger.warn("Soft logout issued by server - avoiding data deletion");
                Lifecycle.softLogout();
                return;
            }

            Modal.createDialog(ErrorDialog, {
                title: _t("Signed Out"),
                description: _t("For security, this session has been signed out. Please sign in again."),
            });

            dis.dispatch({
                action: "logout",
            });
        });
        cli.on(HttpApiEvent.NoConsent, function (message, consentUri) {
            Modal.createDialog(
                QuestionDialog,
                {
                    title: _t("Terms and Conditions"),
                    description: (
                        <div>
                            <p>
                                {" "}
                                {_t(
                                    "To continue using the %(homeserverDomain)s homeserver " +
                                        "you must review and agree to our terms and conditions.",
                                    { homeserverDomain: cli.getDomain() },
                                )}
                            </p>
                        </div>
                    ),
                    button: _t("Review terms and conditions"),
                    cancelButton: _t("Dismiss"),
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

        const dft = DecryptionFailureTracker.instance;

        // Shelved for later date when we have time to think about persisting history of
        // tracked events across sessions.
        // dft.loadTrackedEventHashMap();

        dft.start();

        // When logging out, stop tracking failures and destroy state
        cli.on(HttpApiEvent.SessionLoggedOut, () => dft.stop());
        cli.on(MatrixEventEvent.Decrypted, (e, err) => dft.eventDecrypted(e, err as DecryptionError));

        cli.on(ClientEvent.Room, (room) => {
            if (MatrixClientPeg.get().isCryptoEnabled()) {
                const blacklistEnabled = SettingsStore.getValueAt(
                    SettingLevel.ROOM_DEVICE,
                    "blacklistUnverifiedDevices",
                    room.roomId,
                    /*explicit=*/ true,
                );
                room.setBlacklistUnverifiedDevices(blacklistEnabled);
            }
        });
        cli.on(CryptoEvent.Warning, (type) => {
            switch (type) {
                case "CRYPTO_WARNING_OLD_VERSION_DETECTED":
                    Modal.createDialog(ErrorDialog, {
                        title: _t("Old cryptography data detected"),
                        description: _t(
                            "Data from an older version of %(brand)s has been detected. " +
                                "This will have caused end-to-end cryptography to malfunction " +
                                "in the older version. End-to-end encrypted messages exchanged " +
                                "recently whilst using the older version may not be decryptable " +
                                "in this version. This may also cause messages exchanged with this " +
                                "version to fail. If you experience problems, log out and back in " +
                                "again. To retain message history, export and re-import your keys.",
                            { brand: SdkConfig.get().brand },
                        ),
                    });
                    break;
            }
        });
        cli.on(CryptoEvent.KeyBackupFailed, async (errcode): Promise<void> => {
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
                    logger.error("Saw key backup error but failed to check backup version!", e);
                    return;
                }
            }

            if (haveNewVersion) {
                Modal.createDialogAsync(
                    import(
                        "../../async-components/views/dialogs/security/NewRecoveryMethodDialog"
                    ) as unknown as Promise<typeof NewRecoveryMethodDialog>,
                    { newVersionInfo },
                );
            } else {
                Modal.createDialogAsync(
                    import(
                        "../../async-components/views/dialogs/security/RecoveryMethodRemovedDialog"
                    ) as unknown as Promise<typeof RecoveryMethodRemovedDialog>,
                );
            }
        });

        cli.on(CryptoEvent.KeySignatureUploadFailure, (failures, source, continuation) => {
            Modal.createDialog(KeySignatureUploadFailedDialog, { failures, source, continuation });
        });

        cli.on(CryptoEvent.VerificationRequest, (request) => {
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
                    title: _t("Verification requested"),
                    icon: "verification",
                    props: { request },
                    component: VerificationRequestToast,
                    priority: 90,
                });
            }
        });

        this.voiceBroadcastResumer = new VoiceBroadcastResumer(cli);
    }

    /**
     * Called shortly after the matrix client has started. Useful for
     * setting up anything that requires the client to be started.
     * @private
     */
    private onClientStarted(): void {
        const cli = MatrixClientPeg.get();

        if (cli.isCryptoEnabled()) {
            const blacklistEnabled = SettingsStore.getValueAt(SettingLevel.DEVICE, "blacklistUnverifiedDevices");
            cli.setGlobalBlacklistUnverifiedDevices(blacklistEnabled);

            // With cross-signing enabled, we send to unknown devices
            // without prompting. Any bad-device status the user should
            // be aware of will be signalled through the room shield
            // changing colour. More advanced behaviour will come once
            // we implement more settings.
            cli.setGlobalErrorOnUnknownDevices(false);
        }

        // Cannot be done in OnLoggedIn as at that point the AccountSettingsHandler doesn't yet have a client
        // Will be moved to a pre-login flow as well
        if (PosthogAnalytics.instance.isEnabled() && SettingsStore.isLevelSupported(SettingLevel.ACCOUNT)) {
            this.initPosthogAnalyticsToast();
        }
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
            if (cli.getUserId() && !Lifecycle.isSoftLogout()) {
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
                action: "view_create_room",
            });
        } else if (screen === "dm") {
            dis.dispatch({
                action: "view_create_chat",
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
        } else if (screen === "start") {
            this.showScreen("home");
            dis.dispatch({
                action: "require_registration",
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

    private onRegisterFlowComplete = (credentials: IMatrixClientCreds, password: string): Promise<void> => {
        return this.onUserCompletedLoginFlow(credentials, password);
    };

    // returns a promise which resolves to the new MatrixClient
    private onRegistered(credentials: IMatrixClientCreds): Promise<MatrixClient> {
        return Lifecycle.setLoggedIn(credentials);
    }

    private onSendEvent(roomId: string, event: MatrixEvent): void {
        const cli = MatrixClientPeg.get();
        if (!cli) return;

        cli.sendEvent(roomId, event.getType(), event.getContent()).then(() => {
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
            this.subTitleStatus += `[${_t("Offline")}] `;
        }
        if (numUnreadRooms > 0) {
            this.subTitleStatus += `[${numUnreadRooms}]`;
        } else if (notificationState.color >= NotificationColor.Bold) {
            this.subTitleStatus += `*`;
        }

        this.setPageSubtitle();
    };

    private onServerConfigChange = (serverConfig: ValidatedServerConfig): void => {
        this.setState({ serverConfig });
    };

    private makeRegistrationUrl = (params: QueryDict): string => {
        if (this.props.startingFragmentQueryParams?.referrer) {
            params.referrer = this.props.startingFragmentQueryParams.referrer;
        }
        return this.props.makeRegistrationUrl(params);
    };

    /**
     * After registration or login, we run various post-auth steps before entering the app
     * proper, such setting up cross-signing or verifying the new session.
     *
     * Note: SSO users (and any others using token login) currently do not pass through
     * this, as they instead jump straight into the app after `attemptTokenLogin`.
     */
    private onUserCompletedLoginFlow = async (credentials: IMatrixClientCreds, password: string): Promise<void> => {
        this.stores.accountPasswordStore.setPassword(password);

        // Create and start the client
        await Lifecycle.setLoggedIn(credentials);
        await this.postLoginSetup();

        PerformanceMonitor.instance.stop(PerformanceEntryNames.LOGIN);
        PerformanceMonitor.instance.stop(PerformanceEntryNames.REGISTER);
    };

    // complete security / e2e setup has finished
    private onCompleteSecurityE2eSetupFinished = (): void => {
        this.onLoggedIn();
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
        } else if (this.state.view === Views.COMPLETE_SECURITY) {
            view = <CompleteSecurity onFinished={this.onCompleteSecurityE2eSetupFinished} />;
        } else if (this.state.view === Views.E2E_SETUP) {
            view = (
                <E2eSetup
                    onFinished={this.onCompleteSecurityE2eSetupFinished}
                    accountPassword={this.stores.accountPasswordStore.getPassword()}
                    tokenLogin={!!this.tokenLogin}
                />
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
                view = (
                    <LoggedInView
                        {...this.props}
                        {...this.state}
                        ref={this.loggedInView}
                        matrixClient={MatrixClientPeg.get()}
                        onRegistered={this.onRegistered}
                        currentRoomId={this.state.currentRoomId}
                    />
                );
            } else {
                // we think we are logged in, but are still waiting for the /sync to complete
                let errorBox;
                if (this.state.syncError && !isStoreError) {
                    errorBox = (
                        <div className="mx_MatrixChat_syncError">{messageForSyncError(this.state.syncError)}</div>
                    );
                }
                view = (
                    <div className="mx_MatrixChat_splash">
                        {errorBox}
                        <Spinner />
                        <div className="mx_MatrixChat_splashButtons">
                            <AccessibleButton kind="link_inline" onClick={this.onLogoutClick}>
                                {_t("Logout")}
                            </AccessibleButton>
                        </div>
                    </div>
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
                    makeRegistrationUrl={this.makeRegistrationUrl}
                    onLoggedIn={this.onRegisterFlowComplete}
                    onLoginClick={this.onLoginClick}
                    onServerConfigChange={this.onServerConfigChange}
                    defaultDeviceDisplayName={this.props.defaultDeviceDisplayName}
                    fragmentAfterLogin={fragmentAfterLogin}
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
        } else if (this.state.view === Views.USE_CASE_SELECTION) {
            view = <UseCaseSelection onFinished={(useCase): Promise<void> => this.onShowPostLoginScreen(useCase)} />;
        } else {
            logger.error(`Unknown view ${this.state.view}`);
            return null;
        }

        return (
            <ErrorBoundary>
                <SDKContext.Provider value={this.stores}>{view}</SDKContext.Provider>
            </ErrorBoundary>
        );
    }
}
