/*
Copyright 2015-2023 The Matrix.org Foundation C.I.C.

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

/**
 * This is an internal module. See {@link MatrixClient} for the public class.
 */

import { Optional } from "matrix-events-sdk";

import type { IDeviceKeys, IMegolmSessionData, IOneTimeKey } from "./@types/crypto";
import { ISyncStateData, SyncApi, SyncApiOptions, SyncState } from "./sync";
import {
    EventStatus,
    IContent,
    IDecryptOptions,
    IEvent,
    MatrixEvent,
    MatrixEventEvent,
    MatrixEventHandlerMap,
    PushDetails,
} from "./models/event";
import { StubStore } from "./store/stub";
import { CallEvent, CallEventHandlerMap, createNewMatrixCall, MatrixCall, supportsMatrixCall } from "./webrtc/call";
import { Filter, IFilterDefinition, IRoomEventFilter } from "./filter";
import { CallEventHandlerEvent, CallEventHandler, CallEventHandlerEventHandlerMap } from "./webrtc/callEventHandler";
import {
    GroupCallEventHandler,
    GroupCallEventHandlerEvent,
    GroupCallEventHandlerEventHandlerMap,
} from "./webrtc/groupCallEventHandler";
import * as utils from "./utils";
import { replaceParam, QueryDict, sleep, noUnsafeEventProps, safeSet } from "./utils";
import { Direction, EventTimeline } from "./models/event-timeline";
import { IActionsObject, PushProcessor } from "./pushprocessor";
import { AutoDiscovery, AutoDiscoveryAction } from "./autodiscovery";
import * as olmlib from "./crypto/olmlib";
import { decodeBase64, encodeBase64 } from "./crypto/olmlib";
import { IExportedDevice as IExportedOlmDevice } from "./crypto/OlmDevice";
import { IOlmDevice } from "./crypto/algorithms/megolm";
import { TypedReEmitter } from "./ReEmitter";
import { IRoomEncryption, RoomList } from "./crypto/RoomList";
import { logger } from "./logger";
import { SERVICE_TYPES } from "./service-types";
import {
    HttpApiEvent,
    HttpApiEventHandlerMap,
    Upload,
    UploadOpts,
    MatrixError,
    MatrixHttpApi,
    Method,
    retryNetworkOperation,
    ClientPrefix,
    MediaPrefix,
    IdentityPrefix,
    IHttpOpts,
    FileType,
    UploadResponse,
    HTTPError,
    IRequestOpts,
} from "./http-api";
import {
    Crypto,
    CryptoEvent,
    CryptoEventHandlerMap,
    fixBackupKey,
    ICryptoCallbacks,
    ICheckOwnCrossSigningTrustOpts,
    isCryptoAvailable,
    VerificationMethod,
    IRoomKeyRequestBody,
} from "./crypto";
import { DeviceInfo } from "./crypto/deviceinfo";
import { decodeRecoveryKey } from "./crypto/recoverykey";
import { keyFromAuthData } from "./crypto/key_passphrase";
import { User, UserEvent, UserEventHandlerMap } from "./models/user";
import { getHttpUriForMxc } from "./content-repo";
import { SearchResult } from "./models/search-result";
import { DEHYDRATION_ALGORITHM, IDehydratedDevice, IDehydratedDeviceKeyInfo } from "./crypto/dehydration";
import {
    IKeyBackupInfo,
    IKeyBackupPrepareOpts,
    IKeyBackupRestoreOpts,
    IKeyBackupRestoreResult,
    IKeyBackupRoomSessions,
    IKeyBackupSession,
} from "./crypto/keybackup";
import { IIdentityServerProvider } from "./@types/IIdentityServerProvider";
import { MatrixScheduler } from "./scheduler";
import { BeaconEvent, BeaconEventHandlerMap } from "./models/beacon";
import { IAuthData, IAuthDict } from "./interactive-auth";
import { IMinimalEvent, IRoomEvent, IStateEvent } from "./sync-accumulator";
import { CrossSigningKey, ICreateSecretStorageOpts, IEncryptedEventInfo, IRecoveryKey } from "./crypto/api";
import { EventTimelineSet } from "./models/event-timeline-set";
import { VerificationRequest } from "./crypto/verification/request/VerificationRequest";
import { VerificationBase as Verification } from "./crypto/verification/Base";
import * as ContentHelpers from "./content-helpers";
import { CrossSigningInfo, DeviceTrustLevel, ICacheCallbacks, UserTrustLevel } from "./crypto/CrossSigning";
import { Room, NotificationCountType, RoomEvent, RoomEventHandlerMap, RoomNameState } from "./models/room";
import { RoomMemberEvent, RoomMemberEventHandlerMap } from "./models/room-member";
import { RoomStateEvent, RoomStateEventHandlerMap } from "./models/room-state";
import {
    IAddThreePidOnlyBody,
    IBindThreePidBody,
    IContextResponse,
    ICreateRoomOpts,
    IEventSearchOpts,
    IGuestAccessOpts,
    IJoinRoomOpts,
    IPaginateOpts,
    IPresenceOpts,
    IRedactOpts,
    IRelationsRequestOpts,
    IRelationsResponse,
    IRoomDirectoryOptions,
    ISearchOpts,
    ISendEventResponse,
    INotificationsResponse,
    IFilterResponse,
    ITagsResponse,
    IStatusResponse,
} from "./@types/requests";
import {
    EventType,
    LOCAL_NOTIFICATION_SETTINGS_PREFIX,
    MsgType,
    PUSHER_ENABLED,
    RelationType,
    RoomCreateTypeField,
    RoomType,
    UNSTABLE_MSC3088_ENABLED,
    UNSTABLE_MSC3088_PURPOSE,
    UNSTABLE_MSC3089_TREE_SUBTYPE,
    MSC3912_RELATION_BASED_REDACTIONS_PROP,
} from "./@types/event";
import { IdServerUnbindResult, IImageInfo, Preset, Visibility } from "./@types/partials";
import { EventMapper, eventMapperFor, MapperOpts } from "./event-mapper";
import { randomString } from "./randomstring";
import { BackupManager, IKeyBackup, IKeyBackupCheck, IPreparedKeyBackupVersion, TrustInfo } from "./crypto/backup";
import { DEFAULT_TREE_POWER_LEVELS_TEMPLATE, MSC3089TreeSpace } from "./models/MSC3089TreeSpace";
import { ISignatures } from "./@types/signed";
import { IStore } from "./store";
import { ISecretRequest } from "./crypto/SecretStorage";
import {
    IEventWithRoomId,
    ISearchRequestBody,
    ISearchResponse,
    ISearchResults,
    IStateEventWithRoomId,
    SearchOrderBy,
} from "./@types/search";
import { ISynapseAdminDeactivateResponse, ISynapseAdminWhoisResponse } from "./@types/synapse";
import { IHierarchyRoom } from "./@types/spaces";
import {
    IPusher,
    IPusherRequest,
    IPushRule,
    IPushRules,
    PushRuleAction,
    PushRuleActionName,
    PushRuleKind,
    RuleId,
} from "./@types/PushRules";
import { IThreepid } from "./@types/threepids";
import { CryptoStore, OutgoingRoomKeyRequest } from "./crypto/store/base";
import { GroupCall, IGroupCallDataChannelOptions, GroupCallIntent, GroupCallType } from "./webrtc/groupCall";
import { MediaHandler } from "./webrtc/mediaHandler";
import { LoginTokenPostResponse, ILoginFlowsResponse, IRefreshTokenResponse, SSOAction } from "./@types/auth";
import { TypedEventEmitter } from "./models/typed-event-emitter";
import { MAIN_ROOM_TIMELINE, ReceiptType } from "./@types/read_receipts";
import { MSC3575SlidingSyncRequest, MSC3575SlidingSyncResponse, SlidingSync } from "./sliding-sync";
import { SlidingSyncSdk } from "./sliding-sync-sdk";
import {
    FeatureSupport,
    Thread,
    THREAD_RELATION_TYPE,
    determineFeatureSupport,
    ThreadFilterType,
    threadFilterTypeToFilter,
} from "./models/thread";
import { MBeaconInfoEventContent, M_BEACON_INFO } from "./@types/beacon";
import { UnstableValue } from "./NamespacedValue";
import { ToDeviceMessageQueue } from "./ToDeviceMessageQueue";
import { ToDeviceBatch } from "./models/ToDeviceMessage";
import { IgnoredInvites } from "./models/invites-ignorer";
import { UIARequest, UIAResponse } from "./@types/uia";
import { LocalNotificationSettings } from "./@types/local_notifications";
import { buildFeatureSupportMap, Feature, ServerSupport } from "./feature";
import { CryptoBackend } from "./common-crypto/CryptoBackend";
import { RUST_SDK_STORE_PREFIX } from "./rust-crypto/constants";
import { BootstrapCrossSigningOpts, CryptoApi, ImportRoomKeysOpts } from "./crypto-api";
import { DeviceInfoMap } from "./crypto/DeviceList";
import {
    AddSecretStorageKeyOpts,
    SecretStorageKeyDescription,
    ServerSideSecretStorage,
    ServerSideSecretStorageImpl,
} from "./secret-storage";

export type Store = IStore;

export type ResetTimelineCallback = (roomId: string) => boolean;

const SCROLLBACK_DELAY_MS = 3000;
export const CRYPTO_ENABLED: boolean = isCryptoAvailable();
const CAPABILITIES_CACHE_MS = 21600000; // 6 hours - an arbitrary value
const TURN_CHECK_INTERVAL = 10 * 60 * 1000; // poll for turn credentials every 10 minutes

export const UNSTABLE_MSC3852_LAST_SEEN_UA = new UnstableValue(
    "last_seen_user_agent",
    "org.matrix.msc3852.last_seen_user_agent",
);

interface IExportedDevice {
    olmDevice: IExportedOlmDevice;
    userId: string;
    deviceId: string;
}

export interface IKeysUploadResponse {
    one_time_key_counts: {
        // eslint-disable-line camelcase
        [algorithm: string]: number;
    };
}

export interface ICreateClientOpts {
    baseUrl: string;

    idBaseUrl?: string;

    /**
     * The data store used for sync data from the homeserver. If not specified,
     * this client will not store any HTTP responses. The `createClient` helper
     * will create a default store if needed.
     */
    store?: Store;

    /**
     * A store to be used for end-to-end crypto session data. If not specified,
     * end-to-end crypto will be disabled. The `createClient` helper will create
     * a default store if needed. Calls the factory supplied to
     * {@link setCryptoStoreFactory} if unspecified; or if no factory has been
     * specified, uses a default implementation (indexeddb in the browser,
     * in-memory otherwise).
     */
    cryptoStore?: CryptoStore;

    /**
     * The scheduler to use. If not
     * specified, this client will not retry requests on failure. This client
     * will supply its own processing function to
     * {@link MatrixScheduler#setProcessFunction}.
     */
    scheduler?: MatrixScheduler;

    /**
     * The function to invoke for HTTP requests.
     * Most supported environments have a global `fetch` registered to which this will fall back.
     */
    fetchFn?: typeof global.fetch;

    userId?: string;

    /**
     * A unique identifier for this device; used for tracking things like crypto
     * keys and access tokens. If not specified, end-to-end encryption will be
     * disabled.
     */
    deviceId?: string;

    accessToken?: string;

    /**
     * Identity server provider to retrieve the user's access token when accessing
     * the identity server. See also https://github.com/vector-im/element-web/issues/10615
     * which seeks to replace the previous approach of manual access tokens params
     * with this callback throughout the SDK.
     */
    identityServer?: IIdentityServerProvider;

    /**
     * The default maximum amount of
     * time to wait before timing out HTTP requests. If not specified, there is no timeout.
     */
    localTimeoutMs?: number;

    /**
     * Set to true to use
     * Authorization header instead of query param to send the access token to the server.
     *
     * Default false.
     */
    useAuthorizationHeader?: boolean;

    /**
     * Set to true to enable
     * improved timeline support, see {@link MatrixClient#getEventTimeline}.
     * It is disabled by default for compatibility with older clients - in particular to
     * maintain support for back-paginating the live timeline after a '/sync'
     * result with a gap.
     */
    timelineSupport?: boolean;

    /**
     * Extra query parameters to append
     * to all requests with this client. Useful for application services which require
     * `?user_id=`.
     */
    queryParams?: Record<string, string>;

    /**
     * Device data exported with
     * "exportDevice" method that must be imported to recreate this device.
     * Should only be useful for devices with end-to-end crypto enabled.
     * If provided, deviceId and userId should **NOT** be provided at the top
     * level (they are present in the exported data).
     */
    deviceToImport?: IExportedDevice;

    /**
     * Key used to pickle olm objects or other sensitive data.
     */
    pickleKey?: string;

    verificationMethods?: Array<VerificationMethod>;

    /**
     * Whether relaying calls through a TURN server should be forced. Default false.
     */
    forceTURN?: boolean;

    /**
     * Up to this many ICE candidates will be gathered when an incoming call arrives.
     * Gathering does not send data to the caller, but will communicate with the configured TURN
     * server. Default 0.
     */
    iceCandidatePoolSize?: number;

    /**
     * True to advertise support for call transfers to other parties on Matrix calls. Default false.
     */
    supportsCallTransfer?: boolean;

    /**
     * Whether to allow a fallback ICE server should be used for negotiating a
     * WebRTC connection if the homeserver doesn't provide any servers. Defaults to false.
     */
    fallbackICEServerAllowed?: boolean;

    /**
     * If true, to-device signalling for group calls will be encrypted
     * with Olm. Default: true.
     */
    useE2eForGroupCall?: boolean;

    cryptoCallbacks?: ICryptoCallbacks;

    /**
     * Method to generate room names for empty rooms and rooms names based on membership.
     * Defaults to a built-in English handler with basic pluralisation.
     */
    roomNameGenerator?: (roomId: string, state: RoomNameState) => string | null;

    /**
     * If true, participant can join group call without video and audio this has to be allowed. By default, a local
     * media stream is needed to establish a group call.
     * Default: false.
     */
    isVoipWithNoMediaAllowed?: boolean;
}

export interface IMatrixClientCreateOpts extends ICreateClientOpts {
    /**
     * Whether to allow sending messages to encrypted rooms when encryption
     * is not available internally within this SDK. This is useful if you are using an external
     * E2E proxy, for example. Defaults to false.
     */
    usingExternalCrypto?: boolean;
}

export enum PendingEventOrdering {
    Chronological = "chronological",
    Detached = "detached",
}

export interface IStartClientOpts {
    /**
     * The event `limit=` to apply to initial sync. Default: 8.
     */
    initialSyncLimit?: number;

    /**
     * True to put `archived=true</code> on the <code>/initialSync` request. Default: false.
     */
    includeArchivedRooms?: boolean;

    /**
     * True to do /profile requests on every invite event if the displayname/avatar_url is not known for this user ID. Default: false.
     */
    resolveInvitesToProfiles?: boolean;

    /**
     * Controls where pending messages appear in a room's timeline. If "<b>chronological</b>", messages will
     * appear in the timeline when the call to `sendEvent` was made. If "<b>detached</b>",
     * pending messages will appear in a separate list, accessbile via {@link Room#getPendingEvents}.
     * Default: "chronological".
     */
    pendingEventOrdering?: PendingEventOrdering;

    /**
     * The number of milliseconds to wait on /sync. Default: 30000 (30 seconds).
     */
    pollTimeout?: number;

    /**
     * The filter to apply to /sync calls.
     */
    filter?: Filter;

    /**
     * True to perform syncing without automatically updating presence.
     */
    disablePresence?: boolean;

    /**
     * True to not load all membership events during initial sync but fetch them when needed by calling
     * `loadOutOfBandMembers` This will override the filter option at this moment.
     */
    lazyLoadMembers?: boolean;

    /**
     * The number of seconds between polls to /.well-known/matrix/client, undefined to disable.
     * This should be in the order of hours. Default: undefined.
     */
    clientWellKnownPollPeriod?: number;

    /**
     * @deprecated use `threadSupport` instead
     */
    experimentalThreadSupport?: boolean;

    /**
     * Will organises events in threaded conversations when
     * a thread relation is encountered
     */
    threadSupport?: boolean;

    /**
     * @experimental
     */
    slidingSync?: SlidingSync;
}

export interface IStoredClientOpts extends IStartClientOpts {}

export enum RoomVersionStability {
    Stable = "stable",
    Unstable = "unstable",
}

export interface IRoomVersionsCapability {
    default: string;
    available: Record<string, RoomVersionStability>;
}

export interface ICapability {
    enabled: boolean;
}

export interface IChangePasswordCapability extends ICapability {}

export interface IThreadsCapability extends ICapability {}

export interface IMSC3882GetLoginTokenCapability extends ICapability {}

export const UNSTABLE_MSC3882_CAPABILITY = new UnstableValue("m.get_login_token", "org.matrix.msc3882.get_login_token");

export const UNSTABLE_MSC2666_SHARED_ROOMS = "uk.half-shot.msc2666";
export const UNSTABLE_MSC2666_MUTUAL_ROOMS = "uk.half-shot.msc2666.mutual_rooms";
export const UNSTABLE_MSC2666_QUERY_MUTUAL_ROOMS = "uk.half-shot.msc2666.query_mutual_rooms";

/**
 * A representation of the capabilities advertised by a homeserver as defined by
 * [Capabilities negotiation](https://spec.matrix.org/v1.6/client-server-api/#get_matrixclientv3capabilities).
 */
export interface Capabilities {
    [key: string]: any;
    "m.change_password"?: IChangePasswordCapability;
    "m.room_versions"?: IRoomVersionsCapability;
    "io.element.thread"?: IThreadsCapability;
    [UNSTABLE_MSC3882_CAPABILITY.name]?: IMSC3882GetLoginTokenCapability;
    [UNSTABLE_MSC3882_CAPABILITY.altName]?: IMSC3882GetLoginTokenCapability;
}

/* eslint-disable camelcase */
export interface ICrossSigningKey {
    keys: { [algorithm: string]: string };
    signatures?: ISignatures;
    usage: string[];
    user_id: string;
}

enum CrossSigningKeyType {
    MasterKey = "master_key",
    SelfSigningKey = "self_signing_key",
    UserSigningKey = "user_signing_key",
}

export type CrossSigningKeys = Record<CrossSigningKeyType, ICrossSigningKey>;

export type SendToDeviceContentMap = Map<string, Map<string, Record<string, any>>>;

export interface ISignedKey {
    keys: Record<string, string>;
    signatures: ISignatures;
    user_id: string;
    algorithms: string[];
    device_id: string;
}

export type KeySignatures = Record<string, Record<string, ICrossSigningKey | ISignedKey>>;
export interface IUploadKeySignaturesResponse {
    failures: Record<
        string,
        Record<
            string,
            {
                errcode: string;
                error: string;
            }
        >
    >;
}

export interface IPreviewUrlResponse {
    [key: string]: undefined | string | number;
    "og:title": string;
    "og:type": string;
    "og:url": string;
    "og:image"?: string;
    "og:image:type"?: string;
    "og:image:height"?: number;
    "og:image:width"?: number;
    "og:description"?: string;
    "matrix:image:size"?: number;
}

export interface ITurnServerResponse {
    uris: string[];
    username: string;
    password: string;
    ttl: number;
}

export interface ITurnServer {
    urls: string[];
    username: string;
    credential: string;
}

export interface IServerVersions {
    versions: string[];
    unstable_features: Record<string, boolean>;
}

export const M_AUTHENTICATION = new UnstableValue("m.authentication", "org.matrix.msc2965.authentication");

export interface IClientWellKnown {
    [key: string]: any;
    "m.homeserver"?: IWellKnownConfig;
    "m.identity_server"?: IWellKnownConfig;
    [M_AUTHENTICATION.name]?: IDelegatedAuthConfig; // MSC2965
}

export interface IWellKnownConfig<T = IClientWellKnown> {
    raw?: T;
    action?: AutoDiscoveryAction;
    reason?: string;
    error?: Error | string;
    // eslint-disable-next-line
    base_url?: string | null;
    // XXX: this is undocumented
    server_name?: string;
}

export interface IDelegatedAuthConfig {
    // MSC2965
    /** The OIDC Provider/issuer the client should use */
    issuer: string;
    /** The optional URL of the web UI where the user can manage their account */
    account?: string;
}

interface IKeyBackupPath {
    path: string;
    queryData?: {
        version: string;
    };
}

interface IMediaConfig {
    [key: string]: any; // extensible
    "m.upload.size"?: number;
}

interface IThirdPartySigned {
    sender: string;
    mxid: string;
    token: string;
    signatures: ISignatures;
}

interface IJoinRequestBody {
    third_party_signed?: IThirdPartySigned;
}

interface ITagMetadata {
    [key: string]: any;
    order?: number;
}

interface IMessagesResponse {
    start?: string;
    end?: string;
    chunk: IRoomEvent[];
    state?: IStateEvent[];
}

interface IThreadedMessagesResponse {
    prev_batch: string;
    next_batch: string;
    chunk: IRoomEvent[];
    state: IStateEvent[];
}

export interface IRequestTokenResponse {
    sid: string;
    submit_url?: string;
}

export interface IRequestMsisdnTokenResponse extends IRequestTokenResponse {
    msisdn: string;
    success: boolean;
    intl_fmt: string;
}

export interface IUploadKeysRequest {
    "device_keys"?: Required<IDeviceKeys>;
    "one_time_keys"?: Record<string, IOneTimeKey>;
    "org.matrix.msc2732.fallback_keys"?: Record<string, IOneTimeKey>;
}

export interface IQueryKeysRequest {
    device_keys: { [userId: string]: string[] };
    timeout?: number;
    token?: string;
}

export interface IClaimKeysRequest {
    one_time_keys: { [userId: string]: { [deviceId: string]: string } };
    timeout?: number;
}

export interface IOpenIDToken {
    access_token: string;
    token_type: "Bearer" | string;
    matrix_server_name: string;
    expires_in: number;
}

interface IRoomInitialSyncResponse {
    room_id: string;
    membership: "invite" | "join" | "leave" | "ban";
    messages?: {
        start?: string;
        end?: string;
        chunk: IEventWithRoomId[];
    };
    state?: IStateEventWithRoomId[];
    visibility: Visibility;
    account_data?: IMinimalEvent[];
    presence: Partial<IEvent>; // legacy and undocumented, api is deprecated so this won't get attention
}

interface IJoinedRoomsResponse {
    joined_rooms: string[];
}

interface IJoinedMembersResponse {
    joined: {
        [userId: string]: {
            display_name: string;
            avatar_url: string;
        };
    };
}

export interface IRegisterRequestParams {
    auth?: IAuthDict;
    username?: string;
    password?: string;
    refresh_token?: boolean;
    guest_access_token?: string;
    x_show_msisdn?: boolean;
    bind_msisdn?: boolean;
    bind_email?: boolean;
    inhibit_login?: boolean;
    initial_device_display_name?: string;
}

export interface IPublicRoomsChunkRoom {
    room_id: string;
    name?: string;
    avatar_url?: string;
    topic?: string;
    canonical_alias?: string;
    aliases?: string[];
    world_readable: boolean;
    guest_can_join: boolean;
    num_joined_members: number;
    room_type?: RoomType | string; // Added by MSC3827
}

interface IPublicRoomsResponse {
    chunk: IPublicRoomsChunkRoom[];
    next_batch?: string;
    prev_batch?: string;
    total_room_count_estimate?: number;
}

interface IUserDirectoryResponse {
    results: {
        user_id: string;
        display_name?: string;
        avatar_url?: string;
    }[];
    limited: boolean;
}

export interface IMyDevice {
    "device_id": string;
    "display_name"?: string;
    "last_seen_ip"?: string;
    "last_seen_ts"?: number;
    // UNSTABLE_MSC3852_LAST_SEEN_UA
    "last_seen_user_agent"?: string;
    "org.matrix.msc3852.last_seen_user_agent"?: string;
}

export interface Keys {
    keys: { [keyId: string]: string };
    usage: string[];
    user_id: string;
}

export interface SigningKeys extends Keys {
    signatures: ISignatures;
}

export interface DeviceKeys {
    [deviceId: string]: IDeviceKeys & {
        unsigned?: {
            device_display_name: string;
        };
    };
}

export interface IDownloadKeyResult {
    failures: { [serverName: string]: object };
    device_keys: { [userId: string]: DeviceKeys };
    // the following three fields were added in 1.1
    master_keys?: { [userId: string]: Keys };
    self_signing_keys?: { [userId: string]: SigningKeys };
    user_signing_keys?: { [userId: string]: SigningKeys };
}

export interface IClaimOTKsResult {
    failures: { [serverName: string]: object };
    one_time_keys: {
        [userId: string]: {
            [deviceId: string]: {
                [keyId: string]: {
                    key: string;
                    signatures: ISignatures;
                };
            };
        };
    };
}

export interface IFieldType {
    regexp: string;
    placeholder: string;
}

export interface IInstance {
    desc: string;
    icon?: string;
    fields: object;
    network_id: string;
    // XXX: this is undocumented but we rely on it: https://github.com/matrix-org/matrix-doc/issues/3203
    instance_id: string;
}

export interface IProtocol {
    user_fields: string[];
    location_fields: string[];
    icon: string;
    field_types: Record<string, IFieldType>;
    instances: IInstance[];
}

interface IThirdPartyLocation {
    alias: string;
    protocol: string;
    fields: object;
}

interface IThirdPartyUser {
    userid: string;
    protocol: string;
    fields: object;
}

interface IRoomSummary extends Omit<IPublicRoomsChunkRoom, "canonical_alias" | "aliases"> {
    room_type?: RoomType;
    membership?: string;
    is_encrypted: boolean;
}

interface IRoomKeysResponse {
    sessions: IKeyBackupRoomSessions;
}

interface IRoomsKeysResponse {
    rooms: Record<string, IRoomKeysResponse>;
}

interface IRoomHierarchy {
    rooms: IHierarchyRoom[];
    next_batch?: string;
}

export interface TimestampToEventResponse {
    event_id: string;
    origin_server_ts: string;
}

interface IWhoamiResponse {
    user_id: string;
    device_id?: string;
}
/* eslint-enable camelcase */

// We're using this constant for methods overloading and inspect whether a variable
// contains an eventId or not. This was required to ensure backwards compatibility
// of methods for threads
// Probably not the most graceful solution but does a good enough job for now
const EVENT_ID_PREFIX = "$";

export enum ClientEvent {
    Sync = "sync",
    Event = "event",
    ToDeviceEvent = "toDeviceEvent",
    AccountData = "accountData",
    Room = "Room",
    DeleteRoom = "deleteRoom",
    SyncUnexpectedError = "sync.unexpectedError",
    ClientWellKnown = "WellKnown.client",
    ReceivedVoipEvent = "received_voip_event",
    UndecryptableToDeviceEvent = "toDeviceEvent.undecryptable",
    TurnServers = "turnServers",
    TurnServersError = "turnServers.error",
}

type RoomEvents =
    | RoomEvent.Name
    | RoomEvent.Redaction
    | RoomEvent.RedactionCancelled
    | RoomEvent.Receipt
    | RoomEvent.Tags
    | RoomEvent.LocalEchoUpdated
    | RoomEvent.HistoryImportedWithinTimeline
    | RoomEvent.AccountData
    | RoomEvent.MyMembership
    | RoomEvent.Timeline
    | RoomEvent.TimelineReset;

type RoomStateEvents =
    | RoomStateEvent.Events
    | RoomStateEvent.Members
    | RoomStateEvent.NewMember
    | RoomStateEvent.Update
    | RoomStateEvent.Marker;

type CryptoEvents =
    | CryptoEvent.KeySignatureUploadFailure
    | CryptoEvent.KeyBackupStatus
    | CryptoEvent.KeyBackupFailed
    | CryptoEvent.KeyBackupSessionsRemaining
    | CryptoEvent.RoomKeyRequest
    | CryptoEvent.RoomKeyRequestCancellation
    | CryptoEvent.VerificationRequest
    | CryptoEvent.DeviceVerificationChanged
    | CryptoEvent.UserTrustStatusChanged
    | CryptoEvent.KeysChanged
    | CryptoEvent.Warning
    | CryptoEvent.DevicesUpdated
    | CryptoEvent.WillUpdateDevices;

type MatrixEventEvents = MatrixEventEvent.Decrypted | MatrixEventEvent.Replaced | MatrixEventEvent.VisibilityChange;

type RoomMemberEvents =
    | RoomMemberEvent.Name
    | RoomMemberEvent.Typing
    | RoomMemberEvent.PowerLevel
    | RoomMemberEvent.Membership;

type UserEvents =
    | UserEvent.AvatarUrl
    | UserEvent.DisplayName
    | UserEvent.Presence
    | UserEvent.CurrentlyActive
    | UserEvent.LastPresenceTs;

export type EmittedEvents =
    | ClientEvent
    | RoomEvents
    | RoomStateEvents
    | CryptoEvents
    | MatrixEventEvents
    | RoomMemberEvents
    | UserEvents
    | CallEvent // re-emitted by call.ts using Object.values
    | CallEventHandlerEvent.Incoming
    | GroupCallEventHandlerEvent.Incoming
    | GroupCallEventHandlerEvent.Outgoing
    | GroupCallEventHandlerEvent.Ended
    | GroupCallEventHandlerEvent.Participants
    | HttpApiEvent.SessionLoggedOut
    | HttpApiEvent.NoConsent
    | BeaconEvent;

export type ClientEventHandlerMap = {
    /**
     * Fires whenever the SDK's syncing state is updated. The state can be one of:
     * <ul>
     *
     * <li>PREPARED: The client has synced with the server at least once and is
     * ready for methods to be called on it. This will be immediately followed by
     * a state of SYNCING. <i>This is the equivalent of "syncComplete" in the
     * previous API.</i></li>
     *
     * <li>CATCHUP: The client has detected the connection to the server might be
     * available again and will now try to do a sync again. As this sync might take
     * a long time (depending how long ago was last synced, and general server
     * performance) the client is put in this mode so the UI can reflect trying
     * to catch up with the server after losing connection.</li>
     *
     * <li>SYNCING : The client is currently polling for new events from the server.
     * This will be called <i>after</i> processing latest events from a sync.</li>
     *
     * <li>ERROR : The client has had a problem syncing with the server. If this is
     * called <i>before</i> PREPARED then there was a problem performing the initial
     * sync. If this is called <i>after</i> PREPARED then there was a problem polling
     * the server for updates. This may be called multiple times even if the state is
     * already ERROR. <i>This is the equivalent of "syncError" in the previous
     * API.</i></li>
     *
     * <li>RECONNECTING: The sync connection has dropped, but not (yet) in a way that
     * should be considered erroneous.
     * </li>
     *
     * <li>STOPPED: The client has stopped syncing with server due to stopClient
     * being called.
     * </li>
     * </ul>
     * State transition diagram:
     * ```
     *                                          +---->STOPPED
     *                                          |
     *              +----->PREPARED -------> SYNCING <--+
     *              |                        ^  |  ^    |
     *              |      CATCHUP ----------+  |  |    |
     *              |        ^                  V  |    |
     *   null ------+        |  +------- RECONNECTING   |
     *              |        V  V                       |
     *              +------->ERROR ---------------------+
     *
     * NB: 'null' will never be emitted by this event.
     *
     * ```
     * Transitions:
     * <ul>
     *
     * <li>`null -> PREPARED` : Occurs when the initial sync is completed
     * first time. This involves setting up filters and obtaining push rules.
     *
     * <li>`null -> ERROR` : Occurs when the initial sync failed first time.
     *
     * <li>`ERROR -> PREPARED` : Occurs when the initial sync succeeds
     * after previously failing.
     *
     * <li>`PREPARED -> SYNCING` : Occurs immediately after transitioning
     * to PREPARED. Starts listening for live updates rather than catching up.
     *
     * <li>`SYNCING -> RECONNECTING` : Occurs when the live update fails.
     *
     * <li>`RECONNECTING -> RECONNECTING` : Can occur if the update calls
     * continue to fail, but the keepalive calls (to /versions) succeed.
     *
     * <li>`RECONNECTING -> ERROR` : Occurs when the keepalive call also fails
     *
     * <li>`ERROR -> SYNCING` : Occurs when the client has performed a
     * live update after having previously failed.
     *
     * <li>`ERROR -> ERROR` : Occurs when the client has failed to keepalive
     * for a second time or more.</li>
     *
     * <li>`SYNCING -> SYNCING` : Occurs when the client has performed a live
     * update. This is called <i>after</i> processing.</li>
     *
     * <li>`* -> STOPPED` : Occurs once the client has stopped syncing or
     * trying to sync after stopClient has been called.</li>
     * </ul>
     *
     * @param state - An enum representing the syncing state. One of "PREPARED",
     * "SYNCING", "ERROR", "STOPPED".
     *
     * @param prevState - An enum representing the previous syncing state.
     * One of "PREPARED", "SYNCING", "ERROR", "STOPPED" <b>or null</b>.
     *
     * @param data - Data about this transition.
     *
     * @example
     * ```
     * matrixClient.on("sync", function(state, prevState, data) {
     *   switch (state) {
     *     case "ERROR":
     *       // update UI to say "Connection Lost"
     *       break;
     *     case "SYNCING":
     *       // update UI to remove any "Connection Lost" message
     *       break;
     *     case "PREPARED":
     *       // the client instance is ready to be queried.
     *       var rooms = matrixClient.getRooms();
     *       break;
     *   }
     * });
     * ```
     */
    [ClientEvent.Sync]: (state: SyncState, lastState: SyncState | null, data?: ISyncStateData) => void;
    /**
     * Fires whenever the SDK receives a new event.
     * <p>
     * This is only fired for live events received via /sync - it is not fired for
     * events received over context, search, or pagination APIs.
     *
     * @param event - The matrix event which caused this event to fire.
     * @example
     * ```
     * matrixClient.on("event", function(event){
     *   var sender = event.getSender();
     * });
     * ```
     */
    [ClientEvent.Event]: (event: MatrixEvent) => void;
    /**
     * Fires whenever the SDK receives a new to-device event.
     * @param event - The matrix event which caused this event to fire.
     * @example
     * ```
     * matrixClient.on("toDeviceEvent", function(event){
     *   var sender = event.getSender();
     * });
     * ```
     */
    [ClientEvent.ToDeviceEvent]: (event: MatrixEvent) => void;
    /**
     * Fires if a to-device event is received that cannot be decrypted.
     * Encrypted to-device events will (generally) use plain Olm encryption,
     * in which case decryption failures are fatal: the event will never be
     * decryptable, unlike Megolm encrypted events where the key may simply
     * arrive later.
     *
     * An undecryptable to-device event is therefore likley to indicate problems.
     *
     * @param event - The undecyptable to-device event
     */
    [ClientEvent.UndecryptableToDeviceEvent]: (event: MatrixEvent) => void;
    /**
     * Fires whenever new user-scoped account_data is added.
     * @param event - The event describing the account_data just added
     * @param event - The previous account data, if known.
     * @example
     * ```
     * matrixClient.on("accountData", function(event, oldEvent){
     *   myAccountData[event.type] = event.content;
     * });
     * ```
     */
    [ClientEvent.AccountData]: (event: MatrixEvent, lastEvent?: MatrixEvent) => void;
    /**
     * Fires whenever a new Room is added. This will fire when you are invited to a
     * room, as well as when you join a room. <strong>This event is experimental and
     * may change.</strong>
     * @param room - The newly created, fully populated room.
     * @example
     * ```
     * matrixClient.on("Room", function(room){
     *   var roomId = room.roomId;
     * });
     * ```
     */
    [ClientEvent.Room]: (room: Room) => void;
    /**
     * Fires whenever a Room is removed. This will fire when you forget a room.
     * <strong>This event is experimental and may change.</strong>
     * @param roomId - The deleted room ID.
     * @example
     * ```
     * matrixClient.on("deleteRoom", function(roomId){
     *   // update UI from getRooms()
     * });
     * ```
     */
    [ClientEvent.DeleteRoom]: (roomId: string) => void;
    [ClientEvent.SyncUnexpectedError]: (error: Error) => void;
    /**
     * Fires when the client .well-known info is fetched.
     *
     * @param data - The JSON object returned by the server
     */
    [ClientEvent.ClientWellKnown]: (data: IClientWellKnown) => void;
    [ClientEvent.ReceivedVoipEvent]: (event: MatrixEvent) => void;
    [ClientEvent.TurnServers]: (servers: ITurnServer[]) => void;
    [ClientEvent.TurnServersError]: (error: Error, fatal: boolean) => void;
} & RoomEventHandlerMap &
    RoomStateEventHandlerMap &
    CryptoEventHandlerMap &
    MatrixEventHandlerMap &
    RoomMemberEventHandlerMap &
    UserEventHandlerMap &
    CallEventHandlerEventHandlerMap &
    GroupCallEventHandlerEventHandlerMap &
    CallEventHandlerMap &
    HttpApiEventHandlerMap &
    BeaconEventHandlerMap;

const SSO_ACTION_PARAM = new UnstableValue("action", "org.matrix.msc3824.action");

/**
 * Represents a Matrix Client. Only directly construct this if you want to use
 * custom modules. Normally, {@link createClient} should be used
 * as it specifies 'sensible' defaults for these modules.
 */
export class MatrixClient extends TypedEventEmitter<EmittedEvents, ClientEventHandlerMap> {
    public static readonly RESTORE_BACKUP_ERROR_BAD_KEY = "RESTORE_BACKUP_ERROR_BAD_KEY";

    public reEmitter = new TypedReEmitter<EmittedEvents, ClientEventHandlerMap>(this);
    public olmVersion: [number, number, number] | null = null; // populated after initCrypto
    public usingExternalCrypto = false;
    public store: Store;
    public deviceId: string | null;
    public credentials: { userId: string | null };
    public pickleKey?: string;
    public scheduler?: MatrixScheduler;
    public clientRunning = false;
    public timelineSupport = false;
    public urlPreviewCache: { [key: string]: Promise<IPreviewUrlResponse> } = {};
    public identityServer?: IIdentityServerProvider;
    public http: MatrixHttpApi<IHttpOpts & { onlyData: true }>; // XXX: Intended private, used in code.

    /**
     * The libolm crypto implementation, if it is in use.
     *
     * @deprecated This should not be used. Instead, use the methods exposed directly on this class or
     * (where they are available) via {@link getCrypto}.
     */
    public crypto?: Crypto; // XXX: Intended private, used in code. Being replaced by cryptoBackend

    private cryptoBackend?: CryptoBackend; // one of crypto or rustCrypto
    public cryptoCallbacks: ICryptoCallbacks; // XXX: Intended private, used in code.
    public callEventHandler?: CallEventHandler; // XXX: Intended private, used in code.
    public groupCallEventHandler?: GroupCallEventHandler;
    public supportsCallTransfer = false; // XXX: Intended private, used in code.
    public forceTURN = false; // XXX: Intended private, used in code.
    public iceCandidatePoolSize = 0; // XXX: Intended private, used in code.
    public idBaseUrl?: string;
    public baseUrl: string;
    public readonly isVoipWithNoMediaAllowed;

    // Note: these are all `protected` to let downstream consumers make mistakes if they want to.
    // We don't technically support this usage, but have reasons to do this.

    protected canSupportVoip = false;
    protected peekSync: SyncApi | null = null;
    protected isGuestAccount = false;
    protected ongoingScrollbacks: { [roomId: string]: { promise?: Promise<Room>; errorTs?: number } } = {};
    protected notifTimelineSet: EventTimelineSet | null = null;
    protected cryptoStore?: CryptoStore;
    protected verificationMethods?: VerificationMethod[];
    protected fallbackICEServerAllowed = false;
    protected roomList: RoomList;
    protected syncApi?: SlidingSyncSdk | SyncApi;
    public roomNameGenerator?: ICreateClientOpts["roomNameGenerator"];
    public pushRules?: IPushRules;
    protected syncLeftRoomsPromise?: Promise<Room[]>;
    protected syncedLeftRooms = false;
    protected clientOpts?: IStoredClientOpts;
    protected clientWellKnownIntervalID?: ReturnType<typeof setInterval>;
    protected canResetTimelineCallback?: ResetTimelineCallback;

    public canSupport = new Map<Feature, ServerSupport>();

    // The pushprocessor caches useful things, so keep one and re-use it
    protected pushProcessor = new PushProcessor(this);

    // Promise to a response of the server's /versions response
    // TODO: This should expire: https://github.com/matrix-org/matrix-js-sdk/issues/1020
    protected serverVersionsPromise?: Promise<IServerVersions>;

    public cachedCapabilities?: {
        capabilities: Capabilities;
        expiration: number;
    };
    protected clientWellKnown?: IClientWellKnown;
    protected clientWellKnownPromise?: Promise<IClientWellKnown>;
    protected turnServers: ITurnServer[] = [];
    protected turnServersExpiry = 0;
    protected checkTurnServersIntervalID?: ReturnType<typeof setInterval>;
    protected exportedOlmDeviceToImport?: IExportedOlmDevice;
    protected txnCtr = 0;
    protected mediaHandler = new MediaHandler(this);
    protected sessionId: string;
    protected pendingEventEncryption = new Map<string, Promise<void>>();

    private useE2eForGroupCall = true;
    private toDeviceMessageQueue: ToDeviceMessageQueue;

    private _secretStorage: ServerSideSecretStorageImpl;

    // A manager for determining which invites should be ignored.
    public readonly ignoredInvites: IgnoredInvites;

    public constructor(opts: IMatrixClientCreateOpts) {
        super();

        opts.baseUrl = utils.ensureNoTrailingSlash(opts.baseUrl);
        opts.idBaseUrl = utils.ensureNoTrailingSlash(opts.idBaseUrl);

        this.baseUrl = opts.baseUrl;
        this.idBaseUrl = opts.idBaseUrl;
        this.identityServer = opts.identityServer;

        this.usingExternalCrypto = opts.usingExternalCrypto ?? false;
        this.store = opts.store || new StubStore();
        this.deviceId = opts.deviceId || null;
        this.sessionId = randomString(10);

        const userId = opts.userId || null;
        this.credentials = { userId };

        this.http = new MatrixHttpApi(this as ConstructorParameters<typeof MatrixHttpApi>[0], {
            fetchFn: opts.fetchFn,
            baseUrl: opts.baseUrl,
            idBaseUrl: opts.idBaseUrl,
            accessToken: opts.accessToken,
            prefix: ClientPrefix.R0,
            onlyData: true,
            extraParams: opts.queryParams,
            localTimeoutMs: opts.localTimeoutMs,
            useAuthorizationHeader: opts.useAuthorizationHeader,
        });

        if (opts.deviceToImport) {
            if (this.deviceId) {
                logger.warn(
                    "not importing device because device ID is provided to " +
                        "constructor independently of exported data",
                );
            } else if (this.credentials.userId) {
                logger.warn(
                    "not importing device because user ID is provided to " +
                        "constructor independently of exported data",
                );
            } else if (!opts.deviceToImport.deviceId) {
                logger.warn("not importing device because no device ID in exported data");
            } else {
                this.deviceId = opts.deviceToImport.deviceId;
                this.credentials.userId = opts.deviceToImport.userId;
                // will be used during async initialization of the crypto
                this.exportedOlmDeviceToImport = opts.deviceToImport.olmDevice;
            }
        } else if (opts.pickleKey) {
            this.pickleKey = opts.pickleKey;
        }

        this.scheduler = opts.scheduler;
        if (this.scheduler) {
            this.scheduler.setProcessFunction(async (eventToSend: MatrixEvent) => {
                const room = this.getRoom(eventToSend.getRoomId());
                if (eventToSend.status !== EventStatus.SENDING) {
                    this.updatePendingEventStatus(room, eventToSend, EventStatus.SENDING);
                }
                const res = await this.sendEventHttpRequest(eventToSend);
                if (room) {
                    // ensure we update pending event before the next scheduler run so that any listeners to event id
                    // updates on the synchronous event emitter get a chance to run first.
                    room.updatePendingEvent(eventToSend, EventStatus.SENT, res.event_id);
                }
                return res;
            });
        }

        if (supportsMatrixCall()) {
            this.callEventHandler = new CallEventHandler(this);
            this.groupCallEventHandler = new GroupCallEventHandler(this);
            this.canSupportVoip = true;
            // Start listening for calls after the initial sync is done
            // We do not need to backfill the call event buffer
            // with encrypted events that might never get decrypted
            this.on(ClientEvent.Sync, this.startCallEventHandler);
        }

        this.on(ClientEvent.Sync, this.fixupRoomNotifications);

        this.timelineSupport = Boolean(opts.timelineSupport);

        this.cryptoStore = opts.cryptoStore;
        this.verificationMethods = opts.verificationMethods;
        this.cryptoCallbacks = opts.cryptoCallbacks || {};

        this.forceTURN = opts.forceTURN || false;
        this.iceCandidatePoolSize = opts.iceCandidatePoolSize === undefined ? 0 : opts.iceCandidatePoolSize;
        this.supportsCallTransfer = opts.supportsCallTransfer || false;
        this.fallbackICEServerAllowed = opts.fallbackICEServerAllowed || false;
        this.isVoipWithNoMediaAllowed = opts.isVoipWithNoMediaAllowed || false;

        if (opts.useE2eForGroupCall !== undefined) this.useE2eForGroupCall = opts.useE2eForGroupCall;

        // List of which rooms have encryption enabled: separate from crypto because
        // we still want to know which rooms are encrypted even if crypto is disabled:
        // we don't want to start sending unencrypted events to them.
        this.roomList = new RoomList(this.cryptoStore);
        this.roomNameGenerator = opts.roomNameGenerator;

        this.toDeviceMessageQueue = new ToDeviceMessageQueue(this);

        // The SDK doesn't really provide a clean way for events to recalculate the push
        // actions for themselves, so we have to kinda help them out when they are encrypted.
        // We do this so that push rules are correctly executed on events in their decrypted
        // state, such as highlights when the user's name is mentioned.
        this.on(MatrixEventEvent.Decrypted, (event) => {
            fixNotificationCountOnDecryption(this, event);
        });

        // Like above, we have to listen for read receipts from ourselves in order to
        // correctly handle notification counts on encrypted rooms.
        // This fixes https://github.com/vector-im/element-web/issues/9421
        this.on(RoomEvent.Receipt, (event, room) => {
            if (room && this.isRoomEncrypted(room.roomId)) {
                // Figure out if we've read something or if it's just informational
                const content = event.getContent();
                const isSelf =
                    Object.keys(content).filter((eid) => {
                        for (const [key, value] of Object.entries(content[eid])) {
                            if (!utils.isSupportedReceiptType(key)) continue;
                            if (!value) continue;

                            if (Object.keys(value).includes(this.getUserId()!)) return true;
                        }

                        return false;
                    }).length > 0;

                if (!isSelf) return;

                // Work backwards to determine how many events are unread. We also set
                // a limit for how back we'll look to avoid spinning CPU for too long.
                // If we hit the limit, we assume the count is unchanged.
                const maxHistory = 20;
                const events = room.getLiveTimeline().getEvents();

                let highlightCount = 0;

                for (let i = events.length - 1; i >= 0; i--) {
                    if (i === events.length - maxHistory) return; // limit reached

                    const event = events[i];

                    if (room.hasUserReadEvent(this.getUserId()!, event.getId()!)) {
                        // If the user has read the event, then the counting is done.
                        break;
                    }

                    const pushActions = this.getPushActionsForEvent(event);
                    highlightCount += pushActions?.tweaks?.highlight ? 1 : 0;
                }

                // Note: we don't need to handle 'total' notifications because the counts
                // will come from the server.
                room.setUnreadNotificationCount(NotificationCountType.Highlight, highlightCount);
            }
        });

        this.ignoredInvites = new IgnoredInvites(this);
        this._secretStorage = new ServerSideSecretStorageImpl(this, opts.cryptoCallbacks ?? {});
    }

    /**
     * High level helper method to begin syncing and poll for new events. To listen for these
     * events, add a listener for {@link ClientEvent.Event}
     * via {@link MatrixClient#on}. Alternatively, listen for specific
     * state change events.
     * @param opts - Options to apply when syncing.
     */
    public async startClient(opts?: IStartClientOpts): Promise<void> {
        if (this.clientRunning) {
            // client is already running.
            return;
        }
        this.clientRunning = true;
        // backwards compat for when 'opts' was 'historyLen'.
        if (typeof opts === "number") {
            opts = {
                initialSyncLimit: opts,
            };
        }

        // Create our own user object artificially (instead of waiting for sync)
        // so it's always available, even if the user is not in any rooms etc.
        const userId = this.getUserId();
        if (userId) {
            this.store.storeUser(new User(userId));
        }

        // periodically poll for turn servers if we support voip
        if (this.canSupportVoip) {
            this.checkTurnServersIntervalID = setInterval(() => {
                this.checkTurnServers();
            }, TURN_CHECK_INTERVAL);
            // noinspection ES6MissingAwait
            this.checkTurnServers();
        }

        if (this.syncApi) {
            // This shouldn't happen since we thought the client was not running
            logger.error("Still have sync object whilst not running: stopping old one");
            this.syncApi.stop();
        }

        try {
            await this.getVersions();

            // This should be done with `canSupport`
            // TODO: https://github.com/vector-im/element-web/issues/23643
            const { threads, list, fwdPagination } = await this.doesServerSupportThread();
            Thread.setServerSideSupport(threads);
            Thread.setServerSideListSupport(list);
            Thread.setServerSideFwdPaginationSupport(fwdPagination);
        } catch (e) {
            logger.error("Can't fetch server versions, continuing to initialise sync, this will be retried later", e);
        }

        this.clientOpts = opts ?? {};
        if (this.clientOpts.slidingSync) {
            this.syncApi = new SlidingSyncSdk(
                this.clientOpts.slidingSync,
                this,
                this.clientOpts,
                this.buildSyncApiOptions(),
            );
        } else {
            this.syncApi = new SyncApi(this, this.clientOpts, this.buildSyncApiOptions());
        }

        if (this.clientOpts.hasOwnProperty("experimentalThreadSupport")) {
            logger.warn("`experimentalThreadSupport` has been deprecated, use `threadSupport` instead");
        }

        // If `threadSupport` is omitted and the deprecated `experimentalThreadSupport` has been passed
        // We should fallback to that value for backwards compatibility purposes
        if (
            !this.clientOpts.hasOwnProperty("threadSupport") &&
            this.clientOpts.hasOwnProperty("experimentalThreadSupport")
        ) {
            this.clientOpts.threadSupport = this.clientOpts.experimentalThreadSupport;
        }

        this.syncApi.sync();

        if (this.clientOpts.clientWellKnownPollPeriod !== undefined) {
            this.clientWellKnownIntervalID = setInterval(() => {
                this.fetchClientWellKnown();
            }, 1000 * this.clientOpts.clientWellKnownPollPeriod);
            this.fetchClientWellKnown();
        }

        this.toDeviceMessageQueue.start();
    }

    /**
     * Construct a SyncApiOptions for this client, suitable for passing into the SyncApi constructor
     */
    protected buildSyncApiOptions(): SyncApiOptions {
        return {
            crypto: this.crypto,
            cryptoCallbacks: this.cryptoBackend,
            canResetEntireTimeline: (roomId: string): boolean => {
                if (!this.canResetTimelineCallback) {
                    return false;
                }
                return this.canResetTimelineCallback(roomId);
            },
        };
    }

    /**
     * High level helper method to stop the client from polling and allow a
     * clean shutdown.
     */
    public stopClient(): void {
        this.cryptoBackend?.stop(); // crypto might have been initialised even if the client wasn't fully started

        if (!this.clientRunning) return; // already stopped

        logger.log("stopping MatrixClient");

        this.clientRunning = false;

        this.syncApi?.stop();
        this.syncApi = undefined;

        this.peekSync?.stopPeeking();

        this.callEventHandler?.stop();
        this.groupCallEventHandler?.stop();
        this.callEventHandler = undefined;
        this.groupCallEventHandler = undefined;

        global.clearInterval(this.checkTurnServersIntervalID);
        this.checkTurnServersIntervalID = undefined;

        if (this.clientWellKnownIntervalID !== undefined) {
            global.clearInterval(this.clientWellKnownIntervalID);
        }

        this.toDeviceMessageQueue.stop();
    }

    /**
     * Try to rehydrate a device if available.  The client must have been
     * initialized with a `cryptoCallback.getDehydrationKey` option, and this
     * function must be called before initCrypto and startClient are called.
     *
     * @returns Promise which resolves to undefined if a device could not be dehydrated, or
     *     to the new device ID if the dehydration was successful.
     * @returns Rejects: with an error response.
     */
    public async rehydrateDevice(): Promise<string | undefined> {
        if (this.crypto) {
            throw new Error("Cannot rehydrate device after crypto is initialized");
        }

        if (!this.cryptoCallbacks.getDehydrationKey) {
            return;
        }

        const getDeviceResult = await this.getDehydratedDevice();
        if (!getDeviceResult) {
            return;
        }

        if (!getDeviceResult.device_data || !getDeviceResult.device_id) {
            logger.info("no dehydrated device found");
            return;
        }

        const account = new global.Olm.Account();
        try {
            const deviceData = getDeviceResult.device_data;
            if (deviceData.algorithm !== DEHYDRATION_ALGORITHM) {
                logger.warn("Wrong algorithm for dehydrated device");
                return;
            }
            logger.log("unpickling dehydrated device");
            const key = await this.cryptoCallbacks.getDehydrationKey(deviceData, (k) => {
                // copy the key so that it doesn't get clobbered
                account.unpickle(new Uint8Array(k), deviceData.account);
            });
            account.unpickle(key, deviceData.account);
            logger.log("unpickled device");

            const rehydrateResult = await this.http.authedRequest<{ success: boolean }>(
                Method.Post,
                "/dehydrated_device/claim",
                undefined,
                {
                    device_id: getDeviceResult.device_id,
                },
                {
                    prefix: "/_matrix/client/unstable/org.matrix.msc2697.v2",
                },
            );

            if (rehydrateResult.success) {
                this.deviceId = getDeviceResult.device_id;
                logger.info("using dehydrated device");
                const pickleKey = this.pickleKey || "DEFAULT_KEY";
                this.exportedOlmDeviceToImport = {
                    pickledAccount: account.pickle(pickleKey),
                    sessions: [],
                    pickleKey: pickleKey,
                };
                account.free();
                return this.deviceId;
            } else {
                account.free();
                logger.info("not using dehydrated device");
                return;
            }
        } catch (e) {
            account.free();
            logger.warn("could not unpickle", e);
        }
    }

    /**
     * Get the current dehydrated device, if any
     * @returns A promise of an object containing the dehydrated device
     */
    public async getDehydratedDevice(): Promise<IDehydratedDevice | undefined> {
        try {
            return await this.http.authedRequest<IDehydratedDevice>(
                Method.Get,
                "/dehydrated_device",
                undefined,
                undefined,
                {
                    prefix: "/_matrix/client/unstable/org.matrix.msc2697.v2",
                },
            );
        } catch (e) {
            logger.info("could not get dehydrated device", e);
            return;
        }
    }

    /**
     * Set the dehydration key.  This will also periodically dehydrate devices to
     * the server.
     *
     * @param key - the dehydration key
     * @param keyInfo - Information about the key.  Primarily for
     *     information about how to generate the key from a passphrase.
     * @param deviceDisplayName - The device display name for the
     *     dehydrated device.
     * @returns A promise that resolves when the dehydrated device is stored.
     */
    public async setDehydrationKey(
        key: Uint8Array,
        keyInfo: IDehydratedDeviceKeyInfo,
        deviceDisplayName?: string,
    ): Promise<void> {
        if (!this.crypto) {
            logger.warn("not dehydrating device if crypto is not enabled");
            return;
        }
        return this.crypto.dehydrationManager.setKeyAndQueueDehydration(key, keyInfo, deviceDisplayName);
    }

    /**
     * Creates a new dehydrated device (without queuing periodic dehydration)
     * @param key - the dehydration key
     * @param keyInfo - Information about the key.  Primarily for
     *     information about how to generate the key from a passphrase.
     * @param deviceDisplayName - The device display name for the
     *     dehydrated device.
     * @returns the device id of the newly created dehydrated device
     */
    public async createDehydratedDevice(
        key: Uint8Array,
        keyInfo: IDehydratedDeviceKeyInfo,
        deviceDisplayName?: string,
    ): Promise<string | undefined> {
        if (!this.crypto) {
            logger.warn("not dehydrating device if crypto is not enabled");
            return;
        }
        await this.crypto.dehydrationManager.setKey(key, keyInfo, deviceDisplayName);
        return this.crypto.dehydrationManager.dehydrateDevice();
    }

    public async exportDevice(): Promise<IExportedDevice | undefined> {
        if (!this.crypto) {
            logger.warn("not exporting device if crypto is not enabled");
            return;
        }
        return {
            userId: this.credentials.userId!,
            deviceId: this.deviceId!,
            // XXX: Private member access.
            olmDevice: await this.crypto.olmDevice.export(),
        };
    }

    /**
     * Clear any data out of the persistent stores used by the client.
     *
     * @returns Promise which resolves when the stores have been cleared.
     */
    public clearStores(): Promise<void> {
        if (this.clientRunning) {
            throw new Error("Cannot clear stores while client is running");
        }

        const promises: Promise<void>[] = [];

        promises.push(this.store.deleteAllData());
        if (this.cryptoStore) {
            promises.push(this.cryptoStore.deleteAllData());
        }

        // delete the stores used by the rust matrix-sdk-crypto, in case they were used
        const deleteRustSdkStore = async (): Promise<void> => {
            let indexedDB: IDBFactory;
            try {
                indexedDB = global.indexedDB;
            } catch (e) {
                // No indexeddb support
                return;
            }
            for (const dbname of [
                `${RUST_SDK_STORE_PREFIX}::matrix-sdk-crypto`,
                `${RUST_SDK_STORE_PREFIX}::matrix-sdk-crypto-meta`,
            ]) {
                const prom = new Promise((resolve, reject) => {
                    logger.info(`Removing IndexedDB instance ${dbname}`);
                    const req = indexedDB.deleteDatabase(dbname);
                    req.onsuccess = (_): void => {
                        logger.info(`Removed IndexedDB instance ${dbname}`);
                        resolve(0);
                    };
                    req.onerror = (e): void => {
                        // In private browsing, Firefox has a global.indexedDB, but attempts to delete an indexeddb
                        // (even a non-existent one) fail with "DOMException: A mutation operation was attempted on a
                        // database that did not allow mutations."
                        //
                        // it seems like the only thing we can really do is ignore the error.
                        logger.warn(`Failed to remove IndexedDB instance ${dbname}:`, e);
                        resolve(0);
                    };
                    req.onblocked = (e): void => {
                        logger.info(`cannot yet remove IndexedDB instance ${dbname}`);
                    };
                });
                await prom;
            }
        };
        promises.push(deleteRustSdkStore());

        return Promise.all(promises).then(); // .then to fix types
    }

    /**
     * Get the user-id of the logged-in user
     *
     * @returns MXID for the logged-in user, or null if not logged in
     */
    public getUserId(): string | null {
        if (this.credentials && this.credentials.userId) {
            return this.credentials.userId;
        }
        return null;
    }

    /**
     * Get the user-id of the logged-in user
     *
     * @returns MXID for the logged-in user
     * @throws Error if not logged in
     */
    public getSafeUserId(): string {
        const userId = this.getUserId();
        if (!userId) {
            throw new Error("Expected logged in user but found none.");
        }
        return userId;
    }

    /**
     * Get the domain for this client's MXID
     * @returns Domain of this MXID
     */
    public getDomain(): string | null {
        if (this.credentials && this.credentials.userId) {
            return this.credentials.userId.replace(/^.*?:/, "");
        }
        return null;
    }

    /**
     * Get the local part of the current user ID e.g. "foo" in "\@foo:bar".
     * @returns The user ID localpart or null.
     */
    public getUserIdLocalpart(): string | null {
        if (this.credentials && this.credentials.userId) {
            return this.credentials.userId.split(":")[0].substring(1);
        }
        return null;
    }

    /**
     * Get the device ID of this client
     * @returns device ID
     */
    public getDeviceId(): string | null {
        return this.deviceId;
    }

    /**
     * Get the session ID of this client
     * @returns session ID
     */
    public getSessionId(): string {
        return this.sessionId;
    }

    /**
     * Check if the runtime environment supports VoIP calling.
     * @returns True if VoIP is supported.
     */
    public supportsVoip(): boolean {
        return this.canSupportVoip;
    }

    /**
     * @returns
     */
    public getMediaHandler(): MediaHandler {
        return this.mediaHandler;
    }

    /**
     * Set whether VoIP calls are forced to use only TURN
     * candidates. This is the same as the forceTURN option
     * when creating the client.
     * @param force - True to force use of TURN servers
     */
    public setForceTURN(force: boolean): void {
        this.forceTURN = force;
    }

    /**
     * Set whether to advertise transfer support to other parties on Matrix calls.
     * @param support - True to advertise the 'm.call.transferee' capability
     */
    public setSupportsCallTransfer(support: boolean): void {
        this.supportsCallTransfer = support;
    }

    /**
     * Returns true if to-device signalling for group calls will be encrypted with Olm.
     * If false, it will be sent unencrypted.
     * @returns boolean Whether group call signalling will be encrypted
     */
    public getUseE2eForGroupCall(): boolean {
        return this.useE2eForGroupCall;
    }

    /**
     * Creates a new call.
     * The place*Call methods on the returned call can be used to actually place a call
     *
     * @param roomId - The room the call is to be placed in.
     * @returns the call or null if the browser doesn't support calling.
     */
    public createCall(roomId: string): MatrixCall | null {
        return createNewMatrixCall(this, roomId);
    }

    /**
     * Creates a new group call and sends the associated state event
     * to alert other members that the room now has a group call.
     *
     * @param roomId - The room the call is to be placed in.
     */
    public async createGroupCall(
        roomId: string,
        type: GroupCallType,
        isPtt: boolean,
        intent: GroupCallIntent,
        dataChannelsEnabled?: boolean,
        dataChannelOptions?: IGroupCallDataChannelOptions,
    ): Promise<GroupCall> {
        if (this.getGroupCallForRoom(roomId)) {
            throw new Error(`${roomId} already has an existing group call`);
        }

        const room = this.getRoom(roomId);

        if (!room) {
            throw new Error(`Cannot find room ${roomId}`);
        }

        // Because without Media section a WebRTC connection is not possible, so need a RTCDataChannel to set up a
        // no media WebRTC connection anyway.
        return new GroupCall(
            this,
            room,
            type,
            isPtt,
            intent,
            undefined,
            dataChannelsEnabled || this.isVoipWithNoMediaAllowed,
            dataChannelOptions,
            this.isVoipWithNoMediaAllowed,
        ).create();
    }

    /**
     * Wait until an initial state for the given room has been processed by the
     * client and the client is aware of any ongoing group calls. Awaiting on
     * the promise returned by this method before calling getGroupCallForRoom()
     * avoids races where getGroupCallForRoom is called before the state for that
     * room has been processed. It does not, however, fix other races, eg. two
     * clients both creating a group call at the same time.
     * @param roomId - The room ID to wait for
     * @returns A promise that resolves once existing group calls in the room
     *          have been processed.
     */
    public waitUntilRoomReadyForGroupCalls(roomId: string): Promise<void> {
        return this.groupCallEventHandler!.waitUntilRoomReadyForGroupCalls(roomId);
    }

    /**
     * Get an existing group call for the provided room.
     * @returns The group call or null if it doesn't already exist.
     */
    public getGroupCallForRoom(roomId: string): GroupCall | null {
        return this.groupCallEventHandler!.groupCalls.get(roomId) || null;
    }

    /**
     * Get the current sync state.
     * @returns the sync state, which may be null.
     * @see MatrixClient#event:"sync"
     */
    public getSyncState(): SyncState | null {
        return this.syncApi?.getSyncState() ?? null;
    }

    /**
     * Returns the additional data object associated with
     * the current sync state, or null if there is no
     * such data.
     * Sync errors, if available, are put in the 'error' key of
     * this object.
     */
    public getSyncStateData(): ISyncStateData | null {
        if (!this.syncApi) {
            return null;
        }
        return this.syncApi.getSyncStateData();
    }

    /**
     * Whether the initial sync has completed.
     * @returns True if at least one sync has happened.
     */
    public isInitialSyncComplete(): boolean {
        const state = this.getSyncState();
        if (!state) {
            return false;
        }
        return state === SyncState.Prepared || state === SyncState.Syncing;
    }

    /**
     * Return whether the client is configured for a guest account.
     * @returns True if this is a guest access_token (or no token is supplied).
     */
    public isGuest(): boolean {
        return this.isGuestAccount;
    }

    /**
     * Set whether this client is a guest account. <b>This method is experimental
     * and may change without warning.</b>
     * @param guest - True if this is a guest account.
     */
    public setGuest(guest: boolean): void {
        // EXPERIMENTAL:
        // If the token is a macaroon, it should be encoded in it that it is a 'guest'
        // access token, which means that the SDK can determine this entirely without
        // the dev manually flipping this flag.
        this.isGuestAccount = guest;
    }

    /**
     * Return the provided scheduler, if any.
     * @returns The scheduler or undefined
     */
    public getScheduler(): MatrixScheduler | undefined {
        return this.scheduler;
    }

    /**
     * Retry a backed off syncing request immediately. This should only be used when
     * the user <b>explicitly</b> attempts to retry their lost connection.
     * Will also retry any outbound to-device messages currently in the queue to be sent
     * (retries of regular outgoing events are handled separately, per-event).
     * @returns True if this resulted in a request being retried.
     */
    public retryImmediately(): boolean {
        // don't await for this promise: we just want to kick it off
        this.toDeviceMessageQueue.sendQueue();
        return this.syncApi?.retryImmediately() ?? false;
    }

    /**
     * Return the global notification EventTimelineSet, if any
     *
     * @returns the globl notification EventTimelineSet
     */
    public getNotifTimelineSet(): EventTimelineSet | null {
        return this.notifTimelineSet;
    }

    /**
     * Set the global notification EventTimelineSet
     *
     */
    public setNotifTimelineSet(set: EventTimelineSet): void {
        this.notifTimelineSet = set;
    }

    /**
     * Gets the capabilities of the homeserver. Always returns an object of
     * capability keys and their options, which may be empty.
     * @param fresh - True to ignore any cached values.
     * @returns Promise which resolves to the capabilities of the homeserver
     * @returns Rejects: with an error response.
     */
    public getCapabilities(fresh = false): Promise<Capabilities> {
        const now = new Date().getTime();

        if (this.cachedCapabilities && !fresh) {
            if (now < this.cachedCapabilities.expiration) {
                logger.log("Returning cached capabilities");
                return Promise.resolve(this.cachedCapabilities.capabilities);
            }
        }

        type Response = {
            capabilities?: Capabilities;
        };
        return this.http
            .authedRequest<Response>(Method.Get, "/capabilities")
            .catch((e: Error): Response => {
                // We swallow errors because we need a default object anyhow
                logger.error(e);
                return {};
            })
            .then((r = {}) => {
                const capabilities = r["capabilities"] || {};

                // If the capabilities missed the cache, cache it for a shorter amount
                // of time to try and refresh them later.
                const cacheMs = Object.keys(capabilities).length ? CAPABILITIES_CACHE_MS : 60000 + Math.random() * 5000;

                this.cachedCapabilities = {
                    capabilities,
                    expiration: now + cacheMs,
                };

                logger.log("Caching capabilities: ", capabilities);
                return capabilities;
            });
    }

    /**
     * Initialise support for end-to-end encryption in this client, using libolm.
     *
     * You should call this method after creating the matrixclient, but *before*
     * calling `startClient`, if you want to support end-to-end encryption.
     *
     * It will return a Promise which will resolve when the crypto layer has been
     * successfully initialised.
     */
    public async initCrypto(): Promise<void> {
        if (!isCryptoAvailable()) {
            throw new Error(
                `End-to-end encryption not supported in this js-sdk build: did ` +
                    `you remember to load the olm library?`,
            );
        }

        if (this.cryptoBackend) {
            logger.warn("Attempt to re-initialise e2e encryption on MatrixClient");
            return;
        }

        if (!this.cryptoStore) {
            // the cryptostore is provided by sdk.createClient, so this shouldn't happen
            throw new Error(`Cannot enable encryption: no cryptoStore provided`);
        }

        logger.log("Crypto: Starting up crypto store...");
        await this.cryptoStore.startup();

        // initialise the list of encrypted rooms (whether or not crypto is enabled)
        logger.log("Crypto: initialising roomlist...");
        await this.roomList.init();

        const userId = this.getUserId();
        if (userId === null) {
            throw new Error(
                `Cannot enable encryption on MatrixClient with unknown userId: ` +
                    `ensure userId is passed in createClient().`,
            );
        }
        if (this.deviceId === null) {
            throw new Error(
                `Cannot enable encryption on MatrixClient with unknown deviceId: ` +
                    `ensure deviceId is passed in createClient().`,
            );
        }

        const crypto = new Crypto(
            this,
            userId,
            this.deviceId,
            this.store,
            this.cryptoStore,
            this.roomList,
            this.verificationMethods!,
        );

        this.reEmitter.reEmit(crypto, [
            CryptoEvent.KeyBackupFailed,
            CryptoEvent.KeyBackupSessionsRemaining,
            CryptoEvent.RoomKeyRequest,
            CryptoEvent.RoomKeyRequestCancellation,
            CryptoEvent.Warning,
            CryptoEvent.DevicesUpdated,
            CryptoEvent.WillUpdateDevices,
            CryptoEvent.DeviceVerificationChanged,
            CryptoEvent.UserTrustStatusChanged,
            CryptoEvent.KeysChanged,
        ]);

        logger.log("Crypto: initialising crypto object...");
        await crypto.init({
            exportedOlmDevice: this.exportedOlmDeviceToImport,
            pickleKey: this.pickleKey,
        });
        delete this.exportedOlmDeviceToImport;

        this.olmVersion = Crypto.getOlmVersion();

        // if crypto initialisation was successful, tell it to attach its event handlers.
        crypto.registerEventHandlers(this as Parameters<Crypto["registerEventHandlers"]>[0]);
        this.cryptoBackend = this.crypto = crypto;

        // upload our keys in the background
        this.crypto.uploadDeviceKeys().catch((e) => {
            // TODO: throwing away this error is a really bad idea.
            logger.error("Error uploading device keys", e);
        });
    }

    /**
     * Initialise support for end-to-end encryption in this client, using the rust matrix-sdk-crypto.
     *
     * An alternative to {@link initCrypto}.
     *
     * *WARNING*: this API is very experimental, should not be used in production, and may change without notice!
     *    Eventually it will be deprecated and `initCrypto` will do the same thing.
     *
     * @experimental
     *
     * @returns a Promise which will resolve when the crypto layer has been
     *    successfully initialised.
     */
    public async initRustCrypto(): Promise<void> {
        if (this.cryptoBackend) {
            logger.warn("Attempt to re-initialise e2e encryption on MatrixClient");
            return;
        }

        const userId = this.getUserId();
        if (userId === null) {
            throw new Error(
                `Cannot enable encryption on MatrixClient with unknown userId: ` +
                    `ensure userId is passed in createClient().`,
            );
        }
        const deviceId = this.getDeviceId();
        if (deviceId === null) {
            throw new Error(
                `Cannot enable encryption on MatrixClient with unknown deviceId: ` +
                    `ensure deviceId is passed in createClient().`,
            );
        }

        // importing rust-crypto will download the webassembly, so we delay it until we know it will be
        // needed.
        const RustCrypto = await import("./rust-crypto");
        const rustCrypto = await RustCrypto.initRustCrypto(this.http, userId, deviceId, this.secretStorage);
        this.cryptoBackend = rustCrypto;

        // attach the event listeners needed by RustCrypto
        this.on(RoomMemberEvent.Membership, rustCrypto.onRoomMembership.bind(rustCrypto));
    }

    /**
     * Access the server-side secret storage API for this client.
     */
    public get secretStorage(): ServerSideSecretStorage {
        return this._secretStorage;
    }

    /**
     * Access the crypto API for this client.
     *
     * If end-to-end encryption has been enabled for this client (via {@link initCrypto} or {@link initRustCrypto}),
     * returns an object giving access to the crypto API. Otherwise, returns `undefined`.
     */
    public getCrypto(): CryptoApi | undefined {
        return this.cryptoBackend;
    }

    /**
     * Is end-to-end crypto enabled for this client.
     * @returns True if end-to-end is enabled.
     * @deprecated prefer {@link getCrypto}
     */
    public isCryptoEnabled(): boolean {
        return !!this.cryptoBackend;
    }

    /**
     * Get the Ed25519 key for this device
     *
     * @returns base64-encoded ed25519 key. Null if crypto is
     *    disabled.
     */
    public getDeviceEd25519Key(): string | null {
        return this.crypto?.getDeviceEd25519Key() ?? null;
    }

    /**
     * Get the Curve25519 key for this device
     *
     * @returns base64-encoded curve25519 key. Null if crypto is
     *    disabled.
     */
    public getDeviceCurve25519Key(): string | null {
        return this.crypto?.getDeviceCurve25519Key() ?? null;
    }

    /**
     * @deprecated Does nothing.
     */
    public async uploadKeys(): Promise<void> {
        logger.warn("MatrixClient.uploadKeys is deprecated");
    }

    /**
     * Download the keys for a list of users and stores the keys in the session
     * store.
     * @param userIds - The users to fetch.
     * @param forceDownload - Always download the keys even if cached.
     *
     * @returns A promise which resolves to a map userId-\>deviceId-\>`DeviceInfo`
     *
     * @deprecated Prefer {@link CryptoApi.getUserDeviceInfo}
     */
    public downloadKeys(userIds: string[], forceDownload?: boolean): Promise<DeviceInfoMap> {
        if (!this.crypto) {
            return Promise.reject(new Error("End-to-end encryption disabled"));
        }
        return this.crypto.downloadKeys(userIds, forceDownload);
    }

    /**
     * Get the stored device keys for a user id
     *
     * @param userId - the user to list keys for.
     *
     * @returns list of devices
     * @deprecated Prefer {@link CryptoApi.getUserDeviceInfo}
     */
    public getStoredDevicesForUser(userId: string): DeviceInfo[] {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.getStoredDevicesForUser(userId) || [];
    }

    /**
     * Get the stored device key for a user id and device id
     *
     * @param userId - the user to list keys for.
     * @param deviceId - unique identifier for the device
     *
     * @returns device or null
     * @deprecated Prefer {@link CryptoApi.getUserDeviceInfo}
     */
    public getStoredDevice(userId: string, deviceId: string): DeviceInfo | null {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.getStoredDevice(userId, deviceId) || null;
    }

    /**
     * Mark the given device as verified
     *
     * @param userId - owner of the device
     * @param deviceId - unique identifier for the device or user's
     * cross-signing public key ID.
     *
     * @param verified - whether to mark the device as verified. defaults
     *   to 'true'.
     *
     * @returns
     *
     * @remarks
     * Fires {@link CryptoEvent#DeviceVerificationChanged}
     */
    public setDeviceVerified(userId: string, deviceId: string, verified = true): Promise<void> {
        const prom = this.setDeviceVerification(userId, deviceId, verified, null, null);

        // if one of the user's own devices is being marked as verified / unverified,
        // check the key backup status, since whether or not we use this depends on
        // whether it has a signature from a verified device
        if (userId == this.credentials.userId) {
            this.checkKeyBackup();
        }
        return prom;
    }

    /**
     * Mark the given device as blocked/unblocked
     *
     * @param userId - owner of the device
     * @param deviceId - unique identifier for the device or user's
     * cross-signing public key ID.
     *
     * @param blocked - whether to mark the device as blocked. defaults
     *   to 'true'.
     *
     * @returns
     *
     * @remarks
     * Fires {@link CryptoEvent.DeviceVerificationChanged}
     */
    public setDeviceBlocked(userId: string, deviceId: string, blocked = true): Promise<void> {
        return this.setDeviceVerification(userId, deviceId, null, blocked, null);
    }

    /**
     * Mark the given device as known/unknown
     *
     * @param userId - owner of the device
     * @param deviceId - unique identifier for the device or user's
     * cross-signing public key ID.
     *
     * @param known - whether to mark the device as known. defaults
     *   to 'true'.
     *
     * @returns
     *
     * @remarks
     * Fires {@link CryptoEvent#DeviceVerificationChanged}
     */
    public setDeviceKnown(userId: string, deviceId: string, known = true): Promise<void> {
        return this.setDeviceVerification(userId, deviceId, null, null, known);
    }

    private async setDeviceVerification(
        userId: string,
        deviceId: string,
        verified?: boolean | null,
        blocked?: boolean | null,
        known?: boolean | null,
    ): Promise<void> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        await this.crypto.setDeviceVerification(userId, deviceId, verified, blocked, known);
    }

    /**
     * Request a key verification from another user, using a DM.
     *
     * @param userId - the user to request verification with
     * @param roomId - the room to use for verification
     *
     * @returns resolves to a VerificationRequest
     *    when the request has been sent to the other party.
     */
    public requestVerificationDM(userId: string, roomId: string): Promise<VerificationRequest> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.requestVerificationDM(userId, roomId);
    }

    /**
     * Finds a DM verification request that is already in progress for the given room id
     *
     * @param roomId - the room to use for verification
     *
     * @returns the VerificationRequest that is in progress, if any
     */
    public findVerificationRequestDMInProgress(roomId: string): VerificationRequest | undefined {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.cryptoBackend.findVerificationRequestDMInProgress(roomId);
    }

    /**
     * Returns all to-device verification requests that are already in progress for the given user id
     *
     * @param userId - the ID of the user to query
     *
     * @returns the VerificationRequests that are in progress
     */
    public getVerificationRequestsToDeviceInProgress(userId: string): VerificationRequest[] {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.getVerificationRequestsToDeviceInProgress(userId);
    }

    /**
     * Request a key verification from another user.
     *
     * @param userId - the user to request verification with
     * @param devices - array of device IDs to send requests to.  Defaults to
     *    all devices owned by the user
     *
     * @returns resolves to a VerificationRequest
     *    when the request has been sent to the other party.
     */
    public requestVerification(userId: string, devices?: string[]): Promise<VerificationRequest> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.requestVerification(userId, devices);
    }

    /**
     * Begin a key verification.
     *
     * @param method - the verification method to use
     * @param userId - the user to verify keys with
     * @param deviceId - the device to verify
     *
     * @returns a verification object
     * @deprecated Use `requestVerification` instead.
     */
    public beginKeyVerification(method: string, userId: string, deviceId: string): Verification<any, any> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.beginKeyVerification(method, userId, deviceId);
    }

    /**
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#checkKey}.
     */
    public checkSecretStorageKey(key: Uint8Array, info: SecretStorageKeyDescription): Promise<boolean> {
        return this.secretStorage.checkKey(key, info);
    }

    /**
     * Set the global override for whether the client should ever send encrypted
     * messages to unverified devices.  This provides the default for rooms which
     * do not specify a value.
     *
     * @param value - whether to blacklist all unverified devices by default
     *
     * @deprecated Prefer direct access to {@link CryptoApi.globalBlacklistUnverifiedDevices}:
     *
     * ```javascript
     * client.getCrypto().globalBlacklistUnverifiedDevices = value;
     * ```
     */
    public setGlobalBlacklistUnverifiedDevices(value: boolean): boolean {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        this.cryptoBackend.globalBlacklistUnverifiedDevices = value;
        return value;
    }

    /**
     * @returns whether to blacklist all unverified devices by default
     *
     * @deprecated Prefer direct access to {@link CryptoApi.globalBlacklistUnverifiedDevices}:
     *
     * ```javascript
     * value = client.getCrypto().globalBlacklistUnverifiedDevices;
     * ```
     */
    public getGlobalBlacklistUnverifiedDevices(): boolean {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.cryptoBackend.globalBlacklistUnverifiedDevices;
    }

    /**
     * Set whether sendMessage in a room with unknown and unverified devices
     * should throw an error and not send them message. This has 'Global' for
     * symmetry with setGlobalBlacklistUnverifiedDevices but there is currently
     * no room-level equivalent for this setting.
     *
     * This API is currently UNSTABLE and may change or be removed without notice.
     *
     * @param value - whether error on unknown devices
     *
     * @deprecated Prefer direct access to {@link CryptoApi.globalBlacklistUnverifiedDevices}:
     *
     * ```ts
     * client.getCrypto().globalBlacklistUnverifiedDevices = value;
     * ```
     */
    public setGlobalErrorOnUnknownDevices(value: boolean): void {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        this.cryptoBackend.globalErrorOnUnknownDevices = value;
    }

    /**
     * @returns whether to error on unknown devices
     *
     * This API is currently UNSTABLE and may change or be removed without notice.
     */
    public getGlobalErrorOnUnknownDevices(): boolean {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.cryptoBackend.globalErrorOnUnknownDevices;
    }

    /**
     * Get the ID of one of the user's cross-signing keys
     *
     * @param type - The type of key to get the ID of.  One of
     *     "master", "self_signing", or "user_signing".  Defaults to "master".
     *
     * @returns the key ID
     * @deprecated prefer {@link Crypto.CryptoApi#getCrossSigningKeyId}
     */
    public getCrossSigningId(type: CrossSigningKey | string = CrossSigningKey.Master): string | null {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.getCrossSigningId(type);
    }

    /**
     * Get the cross signing information for a given user.
     *
     * The cross-signing API is currently UNSTABLE and may change without notice.
     *
     * @param userId - the user ID to get the cross-signing info for.
     *
     * @returns the cross signing information for the user.
     */
    public getStoredCrossSigningForUser(userId: string): CrossSigningInfo | null {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.cryptoBackend.getStoredCrossSigningForUser(userId);
    }

    /**
     * Check whether a given user is trusted.
     *
     * The cross-signing API is currently UNSTABLE and may change without notice.
     *
     * @param userId - The ID of the user to check.
     */
    public checkUserTrust(userId: string): UserTrustLevel {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.cryptoBackend.checkUserTrust(userId);
    }

    /**
     * Check whether a given device is trusted.
     *
     * The cross-signing API is currently UNSTABLE and may change without notice.
     *
     * @param userId - The ID of the user whose devices is to be checked.
     * @param deviceId - The ID of the device to check
     *
     * @deprecated Use {@link Crypto.CryptoApi.getDeviceVerificationStatus | `CryptoApi.getDeviceVerificationStatus`}
     */
    public checkDeviceTrust(userId: string, deviceId: string): DeviceTrustLevel {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.checkDeviceTrust(userId, deviceId);
    }

    /**
     * Check whether one of our own devices is cross-signed by our
     * user's stored keys, regardless of whether we trust those keys yet.
     *
     * @param deviceId - The ID of the device to check
     *
     * @returns true if the device is cross-signed
     */
    public checkIfOwnDeviceCrossSigned(deviceId: string): boolean {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.checkIfOwnDeviceCrossSigned(deviceId);
    }

    /**
     * Check the copy of our cross-signing key that we have in the device list and
     * see if we can get the private key. If so, mark it as trusted.
     * @param opts - ICheckOwnCrossSigningTrustOpts object
     */
    public checkOwnCrossSigningTrust(opts?: ICheckOwnCrossSigningTrustOpts): Promise<void> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.checkOwnCrossSigningTrust(opts);
    }

    /**
     * Checks that a given cross-signing private key matches a given public key.
     * This can be used by the getCrossSigningKey callback to verify that the
     * private key it is about to supply is the one that was requested.
     * @param privateKey - The private key
     * @param expectedPublicKey - The public key
     * @returns true if the key matches, otherwise false
     */
    public checkCrossSigningPrivateKey(privateKey: Uint8Array, expectedPublicKey: string): boolean {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.checkCrossSigningPrivateKey(privateKey, expectedPublicKey);
    }

    // deprecated: use requestVerification instead
    public legacyDeviceVerification(
        userId: string,
        deviceId: string,
        method: VerificationMethod,
    ): Promise<VerificationRequest> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.legacyDeviceVerification(userId, deviceId, method);
    }

    /**
     * Perform any background tasks that can be done before a message is ready to
     * send, in order to speed up sending of the message.
     * @param room - the room the event is in
     *
     * @deprecated Prefer {@link CryptoApi.prepareToEncrypt | `CryptoApi.prepareToEncrypt`}:
     *
     * ```javascript
     * client.getCrypto().prepareToEncrypt(room);
     * ```
     */
    public prepareToEncrypt(room: Room): void {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        this.cryptoBackend.prepareToEncrypt(room);
    }

    /**
     * Checks if the user has previously published cross-signing keys
     *
     * This means downloading the devicelist for the user and checking if the list includes
     * the cross-signing pseudo-device.
     *
     * @deprecated Prefer {@link CryptoApi.userHasCrossSigningKeys | `CryptoApi.userHasCrossSigningKeys`}:
     *
     * ```javascript
     * result = client.getCrypto().userHasCrossSigningKeys();
     * ```
     */
    public userHasCrossSigningKeys(): Promise<boolean> {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.cryptoBackend.userHasCrossSigningKeys();
    }

    /**
     * Checks whether cross signing:
     * - is enabled on this account and trusted by this device
     * - has private keys either cached locally or stored in secret storage
     *
     * If this function returns false, bootstrapCrossSigning() can be used
     * to fix things such that it returns true. That is to say, after
     * bootstrapCrossSigning() completes successfully, this function should
     * return true.
     * @returns True if cross-signing is ready to be used on this device
     * @deprecated Prefer {@link CryptoApi.isCrossSigningReady | `CryptoApi.isCrossSigningReady`}:
     */
    public isCrossSigningReady(): Promise<boolean> {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.cryptoBackend.isCrossSigningReady();
    }

    /**
     * Bootstrap cross-signing by creating keys if needed. If everything is already
     * set up, then no changes are made, so this is safe to run to ensure
     * cross-signing is ready for use.
     *
     * This function:
     * - creates new cross-signing keys if they are not found locally cached nor in
     *   secret storage (if it has been set up)
     *
     * @deprecated Prefer {@link CryptoApi.bootstrapCrossSigning | `CryptoApi.bootstrapCrossSigning`}.
     */
    public bootstrapCrossSigning(opts: BootstrapCrossSigningOpts): Promise<void> {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.cryptoBackend.bootstrapCrossSigning(opts);
    }

    /**
     * Whether to trust a others users signatures of their devices.
     * If false, devices will only be considered 'verified' if we have
     * verified that device individually (effectively disabling cross-signing).
     *
     * Default: true
     *
     * @returns True if trusting cross-signed devices
     *
     * @deprecated Prefer {@link CryptoApi.getTrustCrossSignedDevices | `CryptoApi.getTrustCrossSignedDevices`}.
     */
    public getCryptoTrustCrossSignedDevices(): boolean {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.cryptoBackend.getTrustCrossSignedDevices();
    }

    /**
     * See getCryptoTrustCrossSignedDevices
     *
     * @param val - True to trust cross-signed devices
     *
     * @deprecated Prefer {@link CryptoApi.setTrustCrossSignedDevices | `CryptoApi.setTrustCrossSignedDevices`}.
     */
    public setCryptoTrustCrossSignedDevices(val: boolean): void {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        this.cryptoBackend.setTrustCrossSignedDevices(val);
    }

    /**
     * Counts the number of end to end session keys that are waiting to be backed up
     * @returns Promise which resolves to the number of sessions requiring backup
     */
    public countSessionsNeedingBackup(): Promise<number> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.countSessionsNeedingBackup();
    }

    /**
     * Get information about the encryption of an event
     *
     * @param event - event to be checked
     * @returns The event information.
     */
    public getEventEncryptionInfo(event: MatrixEvent): IEncryptedEventInfo {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.cryptoBackend.getEventEncryptionInfo(event);
    }

    /**
     * Create a recovery key from a user-supplied passphrase.
     *
     * The Secure Secret Storage API is currently UNSTABLE and may change without notice.
     *
     * @param password - Passphrase string that can be entered by the user
     *     when restoring the backup as an alternative to entering the recovery key.
     *     Optional.
     * @returns Object with public key metadata, encoded private
     *     recovery key which should be disposed of after displaying to the user,
     *     and raw private key to avoid round tripping if needed.
     */
    public createRecoveryKeyFromPassphrase(password?: string): Promise<IRecoveryKey> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.createRecoveryKeyFromPassphrase(password);
    }

    /**
     * Checks whether secret storage:
     * - is enabled on this account
     * - is storing cross-signing private keys
     * - is storing session backup key (if enabled)
     *
     * If this function returns false, bootstrapSecretStorage() can be used
     * to fix things such that it returns true. That is to say, after
     * bootstrapSecretStorage() completes successfully, this function should
     * return true.
     *
     * @returns True if secret storage is ready to be used on this device
     * @deprecated Prefer {@link CryptoApi.isSecretStorageReady | `CryptoApi.isSecretStorageReady`}:
     */
    public isSecretStorageReady(): Promise<boolean> {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.cryptoBackend.isSecretStorageReady();
    }

    /**
     * Bootstrap Secure Secret Storage if needed by creating a default key. If everything is
     * already set up, then no changes are made, so this is safe to run to ensure secret
     * storage is ready for use.
     *
     * This function
     * - creates a new Secure Secret Storage key if no default key exists
     *   - if a key backup exists, it is migrated to store the key in the Secret
     *     Storage
     * - creates a backup if none exists, and one is requested
     * - migrates Secure Secret Storage to use the latest algorithm, if an outdated
     *   algorithm is found
     *
     */
    public bootstrapSecretStorage(opts: ICreateSecretStorageOpts): Promise<void> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.bootstrapSecretStorage(opts);
    }

    /**
     * Add a key for encrypting secrets.
     *
     * The Secure Secret Storage API is currently UNSTABLE and may change without notice.
     *
     * @param algorithm - the algorithm used by the key
     * @param opts - the options for the algorithm.  The properties used
     *     depend on the algorithm given.
     * @param keyName - the name of the key.  If not given, a random name will be generated.
     *
     * @returns An object with:
     *     keyId: the ID of the key
     *     keyInfo: details about the key (iv, mac, passphrase)
     *
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#addKey}.
     */
    public addSecretStorageKey(
        algorithm: string,
        opts: AddSecretStorageKeyOpts,
        keyName?: string,
    ): Promise<{ keyId: string; keyInfo: SecretStorageKeyDescription }> {
        return this.secretStorage.addKey(algorithm, opts, keyName);
    }

    /**
     * Check whether we have a key with a given ID.
     *
     * The Secure Secret Storage API is currently UNSTABLE and may change without notice.
     *
     * @param keyId - The ID of the key to check
     *     for. Defaults to the default key ID if not provided.
     * @returns Whether we have the key.
     *
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#hasKey}.
     */
    public hasSecretStorageKey(keyId?: string): Promise<boolean> {
        return this.secretStorage.hasKey(keyId);
    }

    /**
     * Store an encrypted secret on the server.
     *
     * The Secure Secret Storage API is currently UNSTABLE and may change without notice.
     *
     * @param name - The name of the secret
     * @param secret - The secret contents.
     * @param keys - The IDs of the keys to use to encrypt the secret or null/undefined
     *     to use the default (will throw if no default key is set).
     *
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#store}.
     */
    public storeSecret(name: string, secret: string, keys?: string[]): Promise<void> {
        return this.secretStorage.store(name, secret, keys);
    }

    /**
     * Get a secret from storage.
     *
     * The Secure Secret Storage API is currently UNSTABLE and may change without notice.
     *
     * @param name - the name of the secret
     *
     * @returns the contents of the secret
     *
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#get}.
     */
    public getSecret(name: string): Promise<string | undefined> {
        return this.secretStorage.get(name);
    }

    /**
     * Check if a secret is stored on the server.
     *
     * The Secure Secret Storage API is currently UNSTABLE and may change without notice.
     *
     * @param name - the name of the secret
     * @returns map of key name to key info the secret is encrypted
     *     with, or null if it is not present or not encrypted with a trusted
     *     key
     *
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#isStored}.
     */
    public isSecretStored(name: string): Promise<Record<string, SecretStorageKeyDescription> | null> {
        return this.secretStorage.isStored(name);
    }

    /**
     * Request a secret from another device.
     *
     * The Secure Secret Storage API is currently UNSTABLE and may change without notice.
     *
     * @param name - the name of the secret to request
     * @param devices - the devices to request the secret from
     *
     * @returns the secret request object
     */
    public requestSecret(name: string, devices: string[]): ISecretRequest {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.requestSecret(name, devices);
    }

    /**
     * Get the current default key ID for encrypting secrets.
     *
     * The Secure Secret Storage API is currently UNSTABLE and may change without notice.
     *
     * @returns The default key ID or null if no default key ID is set
     *
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#getDefaultKeyId}.
     */
    public getDefaultSecretStorageKeyId(): Promise<string | null> {
        return this.secretStorage.getDefaultKeyId();
    }

    /**
     * Set the current default key ID for encrypting secrets.
     *
     * The Secure Secret Storage API is currently UNSTABLE and may change without notice.
     *
     * @param keyId - The new default key ID
     *
     * @deprecated Use {@link MatrixClient#secretStorage} and {@link SecretStorage.ServerSideSecretStorage#setDefaultKeyId}.
     */
    public setDefaultSecretStorageKeyId(keyId: string): Promise<void> {
        return this.secretStorage.setDefaultKeyId(keyId);
    }

    /**
     * Checks that a given secret storage private key matches a given public key.
     * This can be used by the getSecretStorageKey callback to verify that the
     * private key it is about to supply is the one that was requested.
     *
     * The Secure Secret Storage API is currently UNSTABLE and may change without notice.
     *
     * @param privateKey - The private key
     * @param expectedPublicKey - The public key
     * @returns true if the key matches, otherwise false
     *
     * @deprecated The use of asymmetric keys for SSSS is deprecated.
     *     Use {@link SecretStorage.ServerSideSecretStorage#checkKey} for symmetric keys.
     */
    public checkSecretStoragePrivateKey(privateKey: Uint8Array, expectedPublicKey: string): boolean {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.checkSecretStoragePrivateKey(privateKey, expectedPublicKey);
    }

    /**
     * Get e2e information on the device that sent an event
     *
     * @param event - event to be checked
     */
    public async getEventSenderDeviceInfo(event: MatrixEvent): Promise<DeviceInfo | null> {
        if (!this.crypto) {
            return null;
        }
        return this.crypto.getEventSenderDeviceInfo(event);
    }

    /**
     * Check if the sender of an event is verified
     *
     * @param event - event to be checked
     *
     * @returns true if the sender of this event has been verified using
     * {@link MatrixClient#setDeviceVerified}.
     */
    public async isEventSenderVerified(event: MatrixEvent): Promise<boolean> {
        const device = await this.getEventSenderDeviceInfo(event);
        if (!device) {
            return false;
        }
        return device.isVerified();
    }

    /**
     * Get outgoing room key request for this event if there is one.
     * @param event - The event to check for
     *
     * @returns A room key request, or null if there is none
     */
    public getOutgoingRoomKeyRequest(event: MatrixEvent): Promise<OutgoingRoomKeyRequest | null> {
        if (!this.crypto) {
            throw new Error("End-to-End encryption disabled");
        }
        const wireContent = event.getWireContent();
        const requestBody: IRoomKeyRequestBody = {
            session_id: wireContent.session_id,
            sender_key: wireContent.sender_key,
            algorithm: wireContent.algorithm,
            room_id: event.getRoomId()!,
        };
        if (!requestBody.session_id || !requestBody.sender_key || !requestBody.algorithm || !requestBody.room_id) {
            return Promise.resolve(null);
        }
        return this.crypto.cryptoStore.getOutgoingRoomKeyRequest(requestBody);
    }

    /**
     * Cancel a room key request for this event if one is ongoing and resend the
     * request.
     * @param event - event of which to cancel and resend the room
     *                            key request.
     * @returns A promise that will resolve when the key request is queued
     */
    public cancelAndResendEventRoomKeyRequest(event: MatrixEvent): Promise<void> {
        if (!this.crypto) {
            throw new Error("End-to-End encryption disabled");
        }
        return event.cancelAndResendKeyRequest(this.crypto, this.getUserId()!);
    }

    /**
     * Enable end-to-end encryption for a room. This does not modify room state.
     * Any messages sent before the returned promise resolves will be sent unencrypted.
     * @param roomId - The room ID to enable encryption in.
     * @param config - The encryption config for the room.
     * @returns A promise that will resolve when encryption is set up.
     */
    public setRoomEncryption(roomId: string, config: IRoomEncryption): Promise<void> {
        if (!this.crypto) {
            throw new Error("End-to-End encryption disabled");
        }
        return this.crypto.setRoomEncryption(roomId, config);
    }

    /**
     * Whether encryption is enabled for a room.
     * @param roomId - the room id to query.
     * @returns whether encryption is enabled.
     */
    public isRoomEncrypted(roomId: string): boolean {
        const room = this.getRoom(roomId);
        if (!room) {
            // we don't know about this room, so can't determine if it should be
            // encrypted. Let's assume not.
            return false;
        }

        // if there is an 'm.room.encryption' event in this room, it should be
        // encrypted (independently of whether we actually support encryption)
        const ev = room.currentState.getStateEvents(EventType.RoomEncryption, "");
        if (ev) {
            return true;
        }

        // we don't have an m.room.encrypted event, but that might be because
        // the server is hiding it from us. Check the store to see if it was
        // previously encrypted.
        return this.roomList.isRoomEncrypted(roomId);
    }

    /**
     * Encrypts and sends a given object via Olm to-device messages to a given
     * set of devices.
     *
     * @param userDeviceMap - mapping from userId to deviceInfo
     *
     * @param payload - fields to include in the encrypted payload
     *
     * @returns Promise which
     *     resolves once the message has been encrypted and sent to the given
     *     userDeviceMap, and returns the `{ contentMap, deviceInfoByDeviceId }`
     *     of the successfully sent messages.
     */
    public encryptAndSendToDevices(userDeviceInfoArr: IOlmDevice<DeviceInfo>[], payload: object): Promise<void> {
        if (!this.crypto) {
            throw new Error("End-to-End encryption disabled");
        }
        return this.crypto.encryptAndSendToDevices(userDeviceInfoArr, payload);
    }

    /**
     * Forces the current outbound group session to be discarded such
     * that another one will be created next time an event is sent.
     *
     * @param roomId - The ID of the room to discard the session for
     *
     * @deprecated Prefer {@link CryptoApi.forceDiscardSession | `CryptoApi.forceDiscardSession`}:
     *
     */
    public forceDiscardSession(roomId: string): void {
        if (!this.cryptoBackend) {
            throw new Error("End-to-End encryption disabled");
        }
        this.cryptoBackend.forceDiscardSession(roomId);
    }

    /**
     * Get a list containing all of the room keys
     *
     * This should be encrypted before returning it to the user.
     *
     * @returns a promise which resolves to a list of session export objects
     *
     * @deprecated Prefer {@link CryptoApi.exportRoomKeys | `CryptoApi.exportRoomKeys`}:
     *
     * ```javascript
     * sessionData = await client.getCrypto().exportRoomKeys();
     * ```
     */
    public exportRoomKeys(): Promise<IMegolmSessionData[]> {
        if (!this.cryptoBackend) {
            return Promise.reject(new Error("End-to-end encryption disabled"));
        }
        return this.cryptoBackend.exportRoomKeys();
    }

    /**
     * Import a list of room keys previously exported by exportRoomKeys
     *
     * @param keys - a list of session export objects
     * @param opts - options object
     *
     * @returns a promise which resolves when the keys have been imported
     *
     * @deprecated Prefer {@link CryptoApi.importRoomKeys | `CryptoApi.importRoomKeys`}:
     * ```javascript
     *  await client.getCrypto()?.importRoomKeys([..]);
     * ```
     */
    public importRoomKeys(keys: IMegolmSessionData[], opts?: ImportRoomKeysOpts): Promise<void> {
        if (!this.cryptoBackend) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.cryptoBackend.importRoomKeys(keys, opts);
    }

    /**
     * Force a re-check of the local key backup status against
     * what's on the server.
     *
     * @returns Object with backup info (as returned by
     *     getKeyBackupVersion) in backupInfo and
     *     trust information (as returned by isKeyBackupTrusted)
     *     in trustInfo.
     */
    public checkKeyBackup(): Promise<IKeyBackupCheck | null> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.backupManager.checkKeyBackup();
    }

    /**
     * Get information about the current key backup.
     * @returns Information object from API or null
     */
    public async getKeyBackupVersion(): Promise<IKeyBackupInfo | null> {
        let res: IKeyBackupInfo;
        try {
            res = await this.http.authedRequest<IKeyBackupInfo>(
                Method.Get,
                "/room_keys/version",
                undefined,
                undefined,
                { prefix: ClientPrefix.V3 },
            );
        } catch (e) {
            if ((<MatrixError>e).errcode === "M_NOT_FOUND") {
                return null;
            } else {
                throw e;
            }
        }
        BackupManager.checkBackupVersion(res);
        return res;
    }

    /**
     * @param info - key backup info dict from getKeyBackupVersion()
     */
    public isKeyBackupTrusted(info: IKeyBackupInfo): Promise<TrustInfo> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.backupManager.isKeyBackupTrusted(info);
    }

    /**
     * @returns true if the client is configured to back up keys to
     *     the server, otherwise false. If we haven't completed a successful check
     *     of key backup status yet, returns null.
     */
    public getKeyBackupEnabled(): boolean | null {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        return this.crypto.backupManager.getKeyBackupEnabled();
    }

    /**
     * Enable backing up of keys, using data previously returned from
     * getKeyBackupVersion.
     *
     * @param info - Backup information object as returned by getKeyBackupVersion
     * @returns Promise which resolves when complete.
     */
    public enableKeyBackup(info: IKeyBackupInfo): Promise<void> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }

        return this.crypto.backupManager.enableKeyBackup(info);
    }

    /**
     * Disable backing up of keys.
     */
    public disableKeyBackup(): void {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }

        this.crypto.backupManager.disableKeyBackup();
    }

    /**
     * Set up the data required to create a new backup version.  The backup version
     * will not be created and enabled until createKeyBackupVersion is called.
     *
     * @param password - Passphrase string that can be entered by the user
     *     when restoring the backup as an alternative to entering the recovery key.
     *     Optional.
     *
     * @returns Object that can be passed to createKeyBackupVersion and
     *     additionally has a 'recovery_key' member with the user-facing recovery key string.
     */
    public async prepareKeyBackupVersion(
        password?: string | Uint8Array | null,
        opts: IKeyBackupPrepareOpts = { secureSecretStorage: false },
    ): Promise<Pick<IPreparedKeyBackupVersion, "algorithm" | "auth_data" | "recovery_key">> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }

        // eslint-disable-next-line camelcase
        const { algorithm, auth_data, recovery_key, privateKey } =
            await this.crypto.backupManager.prepareKeyBackupVersion(password);

        if (opts.secureSecretStorage) {
            await this.secretStorage.store("m.megolm_backup.v1", encodeBase64(privateKey));
            logger.info("Key backup private key stored in secret storage");
        }

        return {
            algorithm,
            /* eslint-disable camelcase */
            auth_data,
            recovery_key,
            /* eslint-enable camelcase */
        };
    }

    /**
     * Check whether the key backup private key is stored in secret storage.
     * @returns map of key name to key info the secret is
     *     encrypted with, or null if it is not present or not encrypted with a
     *     trusted key
     */
    public isKeyBackupKeyStored(): Promise<Record<string, SecretStorageKeyDescription> | null> {
        return Promise.resolve(this.secretStorage.isStored("m.megolm_backup.v1"));
    }

    /**
     * Create a new key backup version and enable it, using the information return
     * from prepareKeyBackupVersion.
     *
     * @param info - Info object from prepareKeyBackupVersion
     * @returns Object with 'version' param indicating the version created
     */
    public async createKeyBackupVersion(info: IKeyBackupInfo): Promise<IKeyBackupInfo> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }

        await this.crypto.backupManager.createKeyBackupVersion(info);

        const data = {
            algorithm: info.algorithm,
            auth_data: info.auth_data,
        };

        // Sign the backup auth data with the device key for backwards compat with
        // older devices with cross-signing. This can probably go away very soon in
        // favour of just signing with the cross-singing master key.
        // XXX: Private member access
        await this.crypto.signObject(data.auth_data);

        if (
            this.cryptoCallbacks.getCrossSigningKey &&
            // XXX: Private member access
            this.crypto.crossSigningInfo.getId()
        ) {
            // now also sign the auth data with the cross-signing master key
            // we check for the callback explicitly here because we still want to be able
            // to create an un-cross-signed key backup if there is a cross-signing key but
            // no callback supplied.
            // XXX: Private member access
            await this.crypto.crossSigningInfo.signObject(data.auth_data, "master");
        }

        const res = await this.http.authedRequest<IKeyBackupInfo>(Method.Post, "/room_keys/version", undefined, data, {
            prefix: ClientPrefix.V3,
        });

        // We could assume everything's okay and enable directly, but this ensures
        // we run the same signature verification that will be used for future
        // sessions.
        await this.checkKeyBackup();
        if (!this.getKeyBackupEnabled()) {
            logger.error("Key backup not usable even though we just created it");
        }

        return res;
    }

    public async deleteKeyBackupVersion(version: string): Promise<void> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }

        // If we're currently backing up to this backup... stop.
        // (We start using it automatically in createKeyBackupVersion
        // so this is symmetrical).
        if (this.crypto.backupManager.version) {
            this.crypto.backupManager.disableKeyBackup();
        }

        const path = utils.encodeUri("/room_keys/version/$version", {
            $version: version,
        });

        await this.http.authedRequest(Method.Delete, path, undefined, undefined, { prefix: ClientPrefix.V3 });
    }

    private makeKeyBackupPath(roomId: undefined, sessionId: undefined, version?: string): IKeyBackupPath;
    private makeKeyBackupPath(roomId: string, sessionId: undefined, version?: string): IKeyBackupPath;
    private makeKeyBackupPath(roomId: string, sessionId: string, version?: string): IKeyBackupPath;
    private makeKeyBackupPath(roomId?: string, sessionId?: string, version?: string): IKeyBackupPath {
        let path: string;
        if (sessionId !== undefined) {
            path = utils.encodeUri("/room_keys/keys/$roomId/$sessionId", {
                $roomId: roomId!,
                $sessionId: sessionId,
            });
        } else if (roomId !== undefined) {
            path = utils.encodeUri("/room_keys/keys/$roomId", {
                $roomId: roomId,
            });
        } else {
            path = "/room_keys/keys";
        }
        const queryData = version === undefined ? undefined : { version };
        return { path, queryData };
    }

    /**
     * Back up session keys to the homeserver.
     * @param roomId - ID of the room that the keys are for Optional.
     * @param sessionId - ID of the session that the keys are for Optional.
     * @param version - backup version Optional.
     * @param data - Object keys to send
     * @returns a promise that will resolve when the keys
     * are uploaded
     */
    public sendKeyBackup(
        roomId: undefined,
        sessionId: undefined,
        version: string | undefined,
        data: IKeyBackup,
    ): Promise<void>;
    public sendKeyBackup(
        roomId: string,
        sessionId: undefined,
        version: string | undefined,
        data: IKeyBackup,
    ): Promise<void>;
    public sendKeyBackup(
        roomId: string,
        sessionId: string,
        version: string | undefined,
        data: IKeyBackup,
    ): Promise<void>;
    public async sendKeyBackup(
        roomId: string | undefined,
        sessionId: string | undefined,
        version: string | undefined,
        data: IKeyBackup,
    ): Promise<void> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }

        const path = this.makeKeyBackupPath(roomId!, sessionId!, version);
        await this.http.authedRequest(Method.Put, path.path, path.queryData, data, { prefix: ClientPrefix.V3 });
    }

    /**
     * Marks all group sessions as needing to be backed up and schedules them to
     * upload in the background as soon as possible.
     */
    public async scheduleAllGroupSessionsForBackup(): Promise<void> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }

        await this.crypto.backupManager.scheduleAllGroupSessionsForBackup();
    }

    /**
     * Marks all group sessions as needing to be backed up without scheduling
     * them to upload in the background.
     * @returns Promise which resolves to the number of sessions requiring a backup.
     */
    public flagAllGroupSessionsForBackup(): Promise<number> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }

        return this.crypto.backupManager.flagAllGroupSessionsForBackup();
    }

    public isValidRecoveryKey(recoveryKey: string): boolean {
        try {
            decodeRecoveryKey(recoveryKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Get the raw key for a key backup from the password
     * Used when migrating key backups into SSSS
     *
     * The cross-signing API is currently UNSTABLE and may change without notice.
     *
     * @param password - Passphrase
     * @param backupInfo - Backup metadata from `checkKeyBackup`
     * @returns key backup key
     */
    public keyBackupKeyFromPassword(password: string, backupInfo: IKeyBackupInfo): Promise<Uint8Array> {
        return keyFromAuthData(backupInfo.auth_data, password);
    }

    /**
     * Get the raw key for a key backup from the recovery key
     * Used when migrating key backups into SSSS
     *
     * The cross-signing API is currently UNSTABLE and may change without notice.
     *
     * @param recoveryKey - The recovery key
     * @returns key backup key
     */
    public keyBackupKeyFromRecoveryKey(recoveryKey: string): Uint8Array {
        return decodeRecoveryKey(recoveryKey);
    }

    /**
     * Restore from an existing key backup via a passphrase.
     *
     * @param password - Passphrase
     * @param targetRoomId - Room ID to target a specific room.
     * Restores all rooms if omitted.
     * @param targetSessionId - Session ID to target a specific session.
     * Restores all sessions if omitted.
     * @param backupInfo - Backup metadata from `checkKeyBackup`
     * @param opts - Optional params such as callbacks
     * @returns Status of restoration with `total` and `imported`
     * key counts.
     */
    public async restoreKeyBackupWithPassword(
        password: string,
        targetRoomId: undefined,
        targetSessionId: undefined,
        backupInfo: IKeyBackupInfo,
        opts: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult>;
    public async restoreKeyBackupWithPassword(
        password: string,
        targetRoomId: string,
        targetSessionId: undefined,
        backupInfo: IKeyBackupInfo,
        opts: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult>;
    public async restoreKeyBackupWithPassword(
        password: string,
        targetRoomId: string,
        targetSessionId: string,
        backupInfo: IKeyBackupInfo,
        opts: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult>;
    public async restoreKeyBackupWithPassword(
        password: string,
        targetRoomId: string | undefined,
        targetSessionId: string | undefined,
        backupInfo: IKeyBackupInfo,
        opts: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult> {
        const privKey = await keyFromAuthData(backupInfo.auth_data, password);
        return this.restoreKeyBackup(privKey, targetRoomId!, targetSessionId!, backupInfo, opts);
    }

    /**
     * Restore from an existing key backup via a private key stored in secret
     * storage.
     *
     * @param backupInfo - Backup metadata from `checkKeyBackup`
     * @param targetRoomId - Room ID to target a specific room.
     * Restores all rooms if omitted.
     * @param targetSessionId - Session ID to target a specific session.
     * Restores all sessions if omitted.
     * @param opts - Optional params such as callbacks
     * @returns Status of restoration with `total` and `imported`
     * key counts.
     */
    public async restoreKeyBackupWithSecretStorage(
        backupInfo: IKeyBackupInfo,
        targetRoomId?: string,
        targetSessionId?: string,
        opts?: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        const storedKey = await this.secretStorage.get("m.megolm_backup.v1");

        // ensure that the key is in the right format.  If not, fix the key and
        // store the fixed version
        const fixedKey = fixBackupKey(storedKey);
        if (fixedKey) {
            const keys = await this.secretStorage.getKey();
            await this.secretStorage.store("m.megolm_backup.v1", fixedKey, [keys![0]]);
        }

        const privKey = decodeBase64(fixedKey || storedKey!);
        return this.restoreKeyBackup(privKey, targetRoomId!, targetSessionId!, backupInfo, opts);
    }

    /**
     * Restore from an existing key backup via an encoded recovery key.
     *
     * @param recoveryKey - Encoded recovery key
     * @param targetRoomId - Room ID to target a specific room.
     * Restores all rooms if omitted.
     * @param targetSessionId - Session ID to target a specific session.
     * Restores all sessions if omitted.
     * @param backupInfo - Backup metadata from `checkKeyBackup`
     * @param opts - Optional params such as callbacks

     * @returns Status of restoration with `total` and `imported`
     * key counts.
     */
    public restoreKeyBackupWithRecoveryKey(
        recoveryKey: string,
        targetRoomId: undefined,
        targetSessionId: undefined,
        backupInfo: IKeyBackupInfo,
        opts?: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult>;
    public restoreKeyBackupWithRecoveryKey(
        recoveryKey: string,
        targetRoomId: string,
        targetSessionId: undefined,
        backupInfo: IKeyBackupInfo,
        opts?: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult>;
    public restoreKeyBackupWithRecoveryKey(
        recoveryKey: string,
        targetRoomId: string,
        targetSessionId: string,
        backupInfo: IKeyBackupInfo,
        opts?: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult>;
    public restoreKeyBackupWithRecoveryKey(
        recoveryKey: string,
        targetRoomId: string | undefined,
        targetSessionId: string | undefined,
        backupInfo: IKeyBackupInfo,
        opts?: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult> {
        const privKey = decodeRecoveryKey(recoveryKey);
        return this.restoreKeyBackup(privKey, targetRoomId!, targetSessionId!, backupInfo, opts);
    }

    public async restoreKeyBackupWithCache(
        targetRoomId: undefined,
        targetSessionId: undefined,
        backupInfo: IKeyBackupInfo,
        opts?: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult>;
    public async restoreKeyBackupWithCache(
        targetRoomId: string,
        targetSessionId: undefined,
        backupInfo: IKeyBackupInfo,
        opts?: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult>;
    public async restoreKeyBackupWithCache(
        targetRoomId: string,
        targetSessionId: string,
        backupInfo: IKeyBackupInfo,
        opts?: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult>;
    public async restoreKeyBackupWithCache(
        targetRoomId: string | undefined,
        targetSessionId: string | undefined,
        backupInfo: IKeyBackupInfo,
        opts?: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }
        const privKey = await this.crypto.getSessionBackupPrivateKey();
        if (!privKey) {
            throw new Error("Couldn't get key");
        }
        return this.restoreKeyBackup(privKey, targetRoomId!, targetSessionId!, backupInfo, opts);
    }

    private async restoreKeyBackup(
        privKey: ArrayLike<number>,
        targetRoomId: undefined,
        targetSessionId: undefined,
        backupInfo: IKeyBackupInfo,
        opts?: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult>;
    private async restoreKeyBackup(
        privKey: ArrayLike<number>,
        targetRoomId: string,
        targetSessionId: undefined,
        backupInfo: IKeyBackupInfo,
        opts?: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult>;
    private async restoreKeyBackup(
        privKey: ArrayLike<number>,
        targetRoomId: string,
        targetSessionId: string,
        backupInfo: IKeyBackupInfo,
        opts?: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult>;
    private async restoreKeyBackup(
        privKey: ArrayLike<number>,
        targetRoomId: string | undefined,
        targetSessionId: string | undefined,
        backupInfo: IKeyBackupInfo,
        opts?: IKeyBackupRestoreOpts,
    ): Promise<IKeyBackupRestoreResult> {
        const cacheCompleteCallback = opts?.cacheCompleteCallback;
        const progressCallback = opts?.progressCallback;

        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }

        let totalKeyCount = 0;
        let keys: IMegolmSessionData[] = [];

        const path = this.makeKeyBackupPath(targetRoomId!, targetSessionId!, backupInfo.version);

        const algorithm = await BackupManager.makeAlgorithm(backupInfo, async () => {
            return privKey;
        });

        const untrusted = algorithm.untrusted;

        try {
            // If the pubkey computed from the private data we've been given
            // doesn't match the one in the auth_data, the user has entered
            // a different recovery key / the wrong passphrase.
            if (!(await algorithm.keyMatches(privKey))) {
                return Promise.reject(new MatrixError({ errcode: MatrixClient.RESTORE_BACKUP_ERROR_BAD_KEY }));
            }

            // Cache the key, if possible.
            // This is async.
            this.crypto
                .storeSessionBackupPrivateKey(privKey)
                .catch((e) => {
                    logger.warn("Error caching session backup key:", e);
                })
                .then(cacheCompleteCallback);

            if (progressCallback) {
                progressCallback({
                    stage: "fetch",
                });
            }

            const res = await this.http.authedRequest<IRoomsKeysResponse | IRoomKeysResponse | IKeyBackupSession>(
                Method.Get,
                path.path,
                path.queryData,
                undefined,
                { prefix: ClientPrefix.V3 },
            );

            if ((res as IRoomsKeysResponse).rooms) {
                const rooms = (res as IRoomsKeysResponse).rooms;
                for (const [roomId, roomData] of Object.entries(rooms)) {
                    if (!roomData.sessions) continue;

                    totalKeyCount += Object.keys(roomData.sessions).length;
                    const roomKeys = await algorithm.decryptSessions(roomData.sessions);
                    for (const k of roomKeys) {
                        k.room_id = roomId;
                        keys.push(k);
                    }
                }
            } else if ((res as IRoomKeysResponse).sessions) {
                const sessions = (res as IRoomKeysResponse).sessions;
                totalKeyCount = Object.keys(sessions).length;
                keys = await algorithm.decryptSessions(sessions);
                for (const k of keys) {
                    k.room_id = targetRoomId!;
                }
            } else {
                totalKeyCount = 1;
                try {
                    const [key] = await algorithm.decryptSessions({
                        [targetSessionId!]: res as IKeyBackupSession,
                    });
                    key.room_id = targetRoomId!;
                    key.session_id = targetSessionId!;
                    keys.push(key);
                } catch (e) {
                    logger.log("Failed to decrypt megolm session from backup", e);
                }
            }
        } finally {
            algorithm.free();
        }

        await this.getCrypto()?.importRoomKeys(keys, {
            progressCallback,
            untrusted,
            source: "backup",
        });

        await this.checkKeyBackup();

        return { total: totalKeyCount, imported: keys.length };
    }

    public deleteKeysFromBackup(roomId: undefined, sessionId: undefined, version?: string): Promise<void>;
    public deleteKeysFromBackup(roomId: string, sessionId: undefined, version?: string): Promise<void>;
    public deleteKeysFromBackup(roomId: string, sessionId: string, version?: string): Promise<void>;
    public async deleteKeysFromBackup(roomId?: string, sessionId?: string, version?: string): Promise<void> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }

        const path = this.makeKeyBackupPath(roomId!, sessionId!, version);
        await this.http.authedRequest(Method.Delete, path.path, path.queryData, undefined, { prefix: ClientPrefix.V3 });
    }

    /**
     * Share shared-history decryption keys with the given users.
     *
     * @param roomId - the room for which keys should be shared.
     * @param userIds - a list of users to share with.  The keys will be sent to
     *     all of the user's current devices.
     */
    public async sendSharedHistoryKeys(roomId: string, userIds: string[]): Promise<void> {
        if (!this.crypto) {
            throw new Error("End-to-end encryption disabled");
        }

        const roomEncryption = this.roomList.getRoomEncryption(roomId);
        if (!roomEncryption) {
            // unknown room, or unencrypted room
            logger.error("Unknown room.  Not sharing decryption keys");
            return;
        }

        const deviceInfos = await this.crypto.downloadKeys(userIds);
        const devicesByUser: Map<string, DeviceInfo[]> = new Map();
        for (const [userId, devices] of deviceInfos) {
            devicesByUser.set(userId, Array.from(devices.values()));
        }

        // XXX: Private member access
        const alg = this.crypto.getRoomDecryptor(roomId, roomEncryption.algorithm);
        if (alg.sendSharedHistoryInboundSessions) {
            await alg.sendSharedHistoryInboundSessions(devicesByUser);
        } else {
            logger.warn("Algorithm does not support sharing previous keys", roomEncryption.algorithm);
        }
    }

    /**
     * Get the config for the media repository.
     * @returns Promise which resolves with an object containing the config.
     */
    public getMediaConfig(): Promise<IMediaConfig> {
        return this.http.authedRequest(Method.Get, "/config", undefined, undefined, {
            prefix: MediaPrefix.R0,
        });
    }

    /**
     * Get the room for the given room ID.
     * This function will return a valid room for any room for which a Room event
     * has been emitted. Note in particular that other events, eg. RoomState.members
     * will be emitted for a room before this function will return the given room.
     * @param roomId - The room ID
     * @returns The Room or null if it doesn't exist or there is no data store.
     */
    public getRoom(roomId: string | undefined): Room | null {
        if (!roomId) {
            return null;
        }
        return this.store.getRoom(roomId);
    }

    /**
     * Retrieve all known rooms.
     * @returns A list of rooms, or an empty list if there is no data store.
     */
    public getRooms(): Room[] {
        return this.store.getRooms();
    }

    /**
     * Retrieve all rooms that should be displayed to the user
     * This is essentially getRooms() with some rooms filtered out, eg. old versions
     * of rooms that have been replaced or (in future) other rooms that have been
     * marked at the protocol level as not to be displayed to the user.
     *
     * @param msc3946ProcessDynamicPredecessor - if true, look for an
     *                                           m.room.predecessor state event and
     *                                           use it if found (MSC3946).
     * @returns A list of rooms, or an empty list if there is no data store.
     */
    public getVisibleRooms(msc3946ProcessDynamicPredecessor = false): Room[] {
        const allRooms = this.store.getRooms();

        const replacedRooms = new Set();
        for (const r of allRooms) {
            const predecessor = r.findPredecessor(msc3946ProcessDynamicPredecessor)?.roomId;
            if (predecessor) {
                replacedRooms.add(predecessor);
            }
        }

        return allRooms.filter((r) => {
            const tombstone = r.currentState.getStateEvents(EventType.RoomTombstone, "");
            if (tombstone && replacedRooms.has(r.roomId)) {
                return false;
            }
            return true;
        });
    }

    /**
     * Retrieve a user.
     * @param userId - The user ID to retrieve.
     * @returns A user or null if there is no data store or the user does
     * not exist.
     */
    public getUser(userId: string): User | null {
        return this.store.getUser(userId);
    }

    /**
     * Retrieve all known users.
     * @returns A list of users, or an empty list if there is no data store.
     */
    public getUsers(): User[] {
        return this.store.getUsers();
    }

    /**
     * Set account data event for the current user.
     * It will retry the request up to 5 times.
     * @param eventType - The event type
     * @param content - the contents object for the event
     * @returns Promise which resolves: an empty object
     * @returns Rejects: with an error response.
     */
    public setAccountData(eventType: EventType | string, content: IContent): Promise<{}> {
        const path = utils.encodeUri("/user/$userId/account_data/$type", {
            $userId: this.credentials.userId!,
            $type: eventType,
        });
        return retryNetworkOperation(5, () => {
            return this.http.authedRequest(Method.Put, path, undefined, content);
        });
    }

    /**
     * Get account data event of given type for the current user.
     * @param eventType - The event type
     * @returns The contents of the given account data event
     */
    public getAccountData(eventType: string): MatrixEvent | undefined {
        return this.store.getAccountData(eventType);
    }

    /**
     * Get account data event of given type for the current user. This variant
     * gets account data directly from the homeserver if the local store is not
     * ready, which can be useful very early in startup before the initial sync.
     * @param eventType - The event type
     * @returns Promise which resolves: The contents of the given account data event.
     * @returns Rejects: with an error response.
     */
    public async getAccountDataFromServer<T extends { [k: string]: any }>(eventType: string): Promise<T | null> {
        if (this.isInitialSyncComplete()) {
            const event = this.store.getAccountData(eventType);
            if (!event) {
                return null;
            }
            // The network version below returns just the content, so this branch
            // does the same to match.
            return event.getContent<T>();
        }
        const path = utils.encodeUri("/user/$userId/account_data/$type", {
            $userId: this.credentials.userId!,
            $type: eventType,
        });
        try {
            return await this.http.authedRequest(Method.Get, path);
        } catch (e) {
            if ((<MatrixError>e).data?.errcode === "M_NOT_FOUND") {
                return null;
            }
            throw e;
        }
    }

    public async deleteAccountData(eventType: string): Promise<void> {
        const msc3391DeleteAccountDataServerSupport = this.canSupport.get(Feature.AccountDataDeletion);
        // if deletion is not supported overwrite with empty content
        if (msc3391DeleteAccountDataServerSupport === ServerSupport.Unsupported) {
            await this.setAccountData(eventType, {});
            return;
        }
        const path = utils.encodeUri("/user/$userId/account_data/$type", {
            $userId: this.getSafeUserId(),
            $type: eventType,
        });
        const options =
            msc3391DeleteAccountDataServerSupport === ServerSupport.Unstable
                ? { prefix: "/_matrix/client/unstable/org.matrix.msc3391" }
                : undefined;
        return await this.http.authedRequest(Method.Delete, path, undefined, undefined, options);
    }

    /**
     * Gets the users that are ignored by this client
     * @returns The array of users that are ignored (empty if none)
     */
    public getIgnoredUsers(): string[] {
        const event = this.getAccountData("m.ignored_user_list");
        if (!event || !event.getContent() || !event.getContent()["ignored_users"]) return [];
        return Object.keys(event.getContent()["ignored_users"]);
    }

    /**
     * Sets the users that the current user should ignore.
     * @param userIds - the user IDs to ignore
     * @returns Promise which resolves: an empty object
     * @returns Rejects: with an error response.
     */
    public setIgnoredUsers(userIds: string[]): Promise<{}> {
        const content = { ignored_users: {} as Record<string, object> };
        userIds.forEach((u) => {
            content.ignored_users[u] = {};
        });
        return this.setAccountData("m.ignored_user_list", content);
    }

    /**
     * Gets whether or not a specific user is being ignored by this client.
     * @param userId - the user ID to check
     * @returns true if the user is ignored, false otherwise
     */
    public isUserIgnored(userId: string): boolean {
        return this.getIgnoredUsers().includes(userId);
    }

    /**
     * Join a room. If you have already joined the room, this will no-op.
     * @param roomIdOrAlias - The room ID or room alias to join.
     * @param opts - Options when joining the room.
     * @returns Promise which resolves: Room object.
     * @returns Rejects: with an error response.
     */
    public async joinRoom(roomIdOrAlias: string, opts: IJoinRoomOpts = {}): Promise<Room> {
        if (opts.syncRoom === undefined) {
            opts.syncRoom = true;
        }

        const room = this.getRoom(roomIdOrAlias);
        if (room?.hasMembershipState(this.credentials.userId!, "join")) {
            return Promise.resolve(room);
        }

        let signPromise: Promise<IThirdPartySigned | void> = Promise.resolve();

        if (opts.inviteSignUrl) {
            const url = new URL(opts.inviteSignUrl);
            url.searchParams.set("mxid", this.credentials.userId!);
            signPromise = this.http.requestOtherUrl<IThirdPartySigned>(Method.Post, url);
        }

        const queryString: Record<string, string | string[]> = {};
        if (opts.viaServers) {
            queryString["server_name"] = opts.viaServers;
        }

        const data: IJoinRequestBody = {};
        const signedInviteObj = await signPromise;
        if (signedInviteObj) {
            data.third_party_signed = signedInviteObj;
        }

        const path = utils.encodeUri("/join/$roomid", { $roomid: roomIdOrAlias });
        const res = await this.http.authedRequest<{ room_id: string }>(Method.Post, path, queryString, data);

        const roomId = res.room_id;
        const syncApi = new SyncApi(this, this.clientOpts, this.buildSyncApiOptions());
        const syncRoom = syncApi.createRoom(roomId);
        if (opts.syncRoom) {
            // v2 will do this for us
            // return syncApi.syncRoom(room);
        }
        return syncRoom;
    }

    /**
     * Resend an event. Will also retry any to-device messages waiting to be sent.
     * @param event - The event to resend.
     * @param room - Optional. The room the event is in. Will update the
     * timeline entry if provided.
     * @returns Promise which resolves: to an ISendEventResponse object
     * @returns Rejects: with an error response.
     */
    public resendEvent(event: MatrixEvent, room: Room): Promise<ISendEventResponse> {
        // also kick the to-device queue to retry
        this.toDeviceMessageQueue.sendQueue();

        this.updatePendingEventStatus(room, event, EventStatus.SENDING);
        return this.encryptAndSendEvent(room, event);
    }

    /**
     * Cancel a queued or unsent event.
     *
     * @param event -   Event to cancel
     * @throws Error if the event is not in QUEUED, NOT_SENT or ENCRYPTING state
     */
    public cancelPendingEvent(event: MatrixEvent): void {
        if (![EventStatus.QUEUED, EventStatus.NOT_SENT, EventStatus.ENCRYPTING].includes(event.status!)) {
            throw new Error("cannot cancel an event with status " + event.status);
        }

        // if the event is currently being encrypted then
        if (event.status === EventStatus.ENCRYPTING) {
            this.pendingEventEncryption.delete(event.getId()!);
        } else if (this.scheduler && event.status === EventStatus.QUEUED) {
            // tell the scheduler to forget about it, if it's queued
            this.scheduler.removeEventFromQueue(event);
        }

        // then tell the room about the change of state, which will remove it
        // from the room's list of pending events.
        const room = this.getRoom(event.getRoomId());
        this.updatePendingEventStatus(room, event, EventStatus.CANCELLED);
    }

    /**
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public setRoomName(roomId: string, name: string): Promise<ISendEventResponse> {
        return this.sendStateEvent(roomId, EventType.RoomName, { name: name });
    }

    /**
     * @param htmlTopic - Optional.
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public setRoomTopic(roomId: string, topic: string, htmlTopic?: string): Promise<ISendEventResponse> {
        const content = ContentHelpers.makeTopicContent(topic, htmlTopic);
        return this.sendStateEvent(roomId, EventType.RoomTopic, content);
    }

    /**
     * @returns Promise which resolves: to an object keyed by tagId with objects containing a numeric order field.
     * @returns Rejects: with an error response.
     */
    public getRoomTags(roomId: string): Promise<ITagsResponse> {
        const path = utils.encodeUri("/user/$userId/rooms/$roomId/tags", {
            $userId: this.credentials.userId!,
            $roomId: roomId,
        });
        return this.http.authedRequest(Method.Get, path);
    }

    /**
     * @param tagName - name of room tag to be set
     * @param metadata - associated with that tag to be stored
     * @returns Promise which resolves: to an empty object
     * @returns Rejects: with an error response.
     */
    public setRoomTag(roomId: string, tagName: string, metadata: ITagMetadata = {}): Promise<{}> {
        const path = utils.encodeUri("/user/$userId/rooms/$roomId/tags/$tag", {
            $userId: this.credentials.userId!,
            $roomId: roomId,
            $tag: tagName,
        });
        return this.http.authedRequest(Method.Put, path, undefined, metadata);
    }

    /**
     * @param tagName - name of room tag to be removed
     * @returns Promise which resolves: to an empty object
     * @returns Rejects: with an error response.
     */
    public deleteRoomTag(roomId: string, tagName: string): Promise<{}> {
        const path = utils.encodeUri("/user/$userId/rooms/$roomId/tags/$tag", {
            $userId: this.credentials.userId!,
            $roomId: roomId,
            $tag: tagName,
        });
        return this.http.authedRequest(Method.Delete, path);
    }

    /**
     * @param eventType - event type to be set
     * @param content - event content
     * @returns Promise which resolves: to an empty object `{}`
     * @returns Rejects: with an error response.
     */
    public setRoomAccountData(roomId: string, eventType: string, content: Record<string, any>): Promise<{}> {
        const path = utils.encodeUri("/user/$userId/rooms/$roomId/account_data/$type", {
            $userId: this.credentials.userId!,
            $roomId: roomId,
            $type: eventType,
        });
        return this.http.authedRequest(Method.Put, path, undefined, content);
    }

    /**
     * Set a power level to one or multiple users.
     * @returns Promise which resolves: to an ISendEventResponse object
     * @returns Rejects: with an error response.
     */
    public setPowerLevel(
        roomId: string,
        userId: string | string[],
        powerLevel: number | undefined,
        event: MatrixEvent | null,
    ): Promise<ISendEventResponse> {
        let content = {
            users: {} as Record<string, number>,
        };
        if (event?.getType() === EventType.RoomPowerLevels) {
            // take a copy of the content to ensure we don't corrupt
            // existing client state with a failed power level change
            content = utils.deepCopy(event.getContent());
        }

        const users = Array.isArray(userId) ? userId : [userId];
        for (const user of users) {
            if (powerLevel == null) {
                delete content.users[user];
            } else {
                content.users[user] = powerLevel;
            }
        }

        const path = utils.encodeUri("/rooms/$roomId/state/m.room.power_levels", {
            $roomId: roomId,
        });
        return this.http.authedRequest(Method.Put, path, undefined, content);
    }

    /**
     * Create an m.beacon_info event
     * @returns
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public async unstable_createLiveBeacon(
        roomId: Room["roomId"],
        beaconInfoContent: MBeaconInfoEventContent,
    ): Promise<ISendEventResponse> {
        return this.unstable_setLiveBeacon(roomId, beaconInfoContent);
    }

    /**
     * Upsert a live beacon event
     * using a specific m.beacon_info.* event variable type
     * @param roomId - string
     * @returns
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public async unstable_setLiveBeacon(
        roomId: string,
        beaconInfoContent: MBeaconInfoEventContent,
    ): Promise<ISendEventResponse> {
        return this.sendStateEvent(roomId, M_BEACON_INFO.name, beaconInfoContent, this.getUserId()!);
    }

    public sendEvent(roomId: string, eventType: string, content: IContent, txnId?: string): Promise<ISendEventResponse>;
    public sendEvent(
        roomId: string,
        threadId: string | null,
        eventType: string,
        content: IContent,
        txnId?: string,
    ): Promise<ISendEventResponse>;
    public sendEvent(
        roomId: string,
        threadIdOrEventType: string | null,
        eventTypeOrContent: string | IContent,
        contentOrTxnId?: IContent | string,
        txnIdOrVoid?: string,
    ): Promise<ISendEventResponse> {
        let threadId: string | null;
        let eventType: string;
        let content: IContent;
        let txnId: string | undefined;
        if (!threadIdOrEventType?.startsWith(EVENT_ID_PREFIX) && threadIdOrEventType !== null) {
            txnId = contentOrTxnId as string;
            content = eventTypeOrContent as IContent;
            eventType = threadIdOrEventType;
            threadId = null;
        } else {
            txnId = txnIdOrVoid;
            content = contentOrTxnId as IContent;
            eventType = eventTypeOrContent as string;
            threadId = threadIdOrEventType;
        }

        // If we expect that an event is part of a thread but is missing the relation
        // we need to add it manually, as well as the reply fallback
        if (threadId && !content!["m.relates_to"]?.rel_type) {
            const isReply = !!content!["m.relates_to"]?.["m.in_reply_to"];
            content!["m.relates_to"] = {
                ...content!["m.relates_to"],
                rel_type: THREAD_RELATION_TYPE.name,
                event_id: threadId,
                // Set is_falling_back to true unless this is actually intended to be a reply
                is_falling_back: !isReply,
            };
            const thread = this.getRoom(roomId)?.getThread(threadId);
            if (thread && !isReply) {
                content!["m.relates_to"]["m.in_reply_to"] = {
                    event_id:
                        thread
                            .lastReply((ev: MatrixEvent) => {
                                return ev.isRelation(THREAD_RELATION_TYPE.name) && !ev.status;
                            })
                            ?.getId() ?? threadId,
                };
            }
        }

        return this.sendCompleteEvent(roomId, threadId, { type: eventType, content }, txnId);
    }

    /**
     * @param eventObject - An object with the partial structure of an event, to which event_id, user_id, room_id and origin_server_ts will be added.
     * @param txnId - Optional.
     * @returns Promise which resolves: to an empty object `{}`
     * @returns Rejects: with an error response.
     */
    private sendCompleteEvent(
        roomId: string,
        threadId: string | null,
        eventObject: any,
        txnId?: string,
    ): Promise<ISendEventResponse> {
        if (!txnId) {
            txnId = this.makeTxnId();
        }

        // We always construct a MatrixEvent when sending because the store and scheduler use them.
        // We'll extract the params back out if it turns out the client has no scheduler or store.
        const localEvent = new MatrixEvent(
            Object.assign(eventObject, {
                event_id: "~" + roomId + ":" + txnId,
                user_id: this.credentials.userId,
                sender: this.credentials.userId,
                room_id: roomId,
                origin_server_ts: new Date().getTime(),
            }),
        );

        const room = this.getRoom(roomId);
        const thread = threadId ? room?.getThread(threadId) : undefined;
        if (thread) {
            localEvent.setThread(thread);
        }

        // set up re-emitter for this new event - this is normally the job of EventMapper but we don't use it here
        this.reEmitter.reEmit(localEvent, [MatrixEventEvent.Replaced, MatrixEventEvent.VisibilityChange]);
        room?.reEmitter.reEmit(localEvent, [MatrixEventEvent.BeforeRedaction]);

        // if this is a relation or redaction of an event
        // that hasn't been sent yet (e.g. with a local id starting with a ~)
        // then listen for the remote echo of that event so that by the time
        // this event does get sent, we have the correct event_id
        const targetId = localEvent.getAssociatedId();
        if (targetId?.startsWith("~")) {
            const target = room?.getPendingEvents().find((e) => e.getId() === targetId);
            target?.once(MatrixEventEvent.LocalEventIdReplaced, () => {
                localEvent.updateAssociatedId(target.getId()!);
            });
        }

        const type = localEvent.getType();
        logger.log(`sendEvent of type ${type} in ${roomId} with txnId ${txnId}`);

        localEvent.setTxnId(txnId);
        localEvent.setStatus(EventStatus.SENDING);

        // add this event immediately to the local store as 'sending'.
        room?.addPendingEvent(localEvent, txnId);

        // addPendingEvent can change the state to NOT_SENT if it believes
        // that there's other events that have failed. We won't bother to
        // try sending the event if the state has changed as such.
        if (localEvent.status === EventStatus.NOT_SENT) {
            return Promise.reject(new Error("Event blocked by other events not yet sent"));
        }

        return this.encryptAndSendEvent(room, localEvent);
    }

    /**
     * encrypts the event if necessary; adds the event to the queue, or sends it; marks the event as sent/unsent
     * @returns returns a promise which resolves with the result of the send request
     */
    protected encryptAndSendEvent(room: Room | null, event: MatrixEvent): Promise<ISendEventResponse> {
        let cancelled = false;
        // Add an extra Promise.resolve() to turn synchronous exceptions into promise rejections,
        // so that we can handle synchronous and asynchronous exceptions with the
        // same code path.
        return Promise.resolve()
            .then(() => {
                const encryptionPromise = this.encryptEventIfNeeded(event, room ?? undefined);
                if (!encryptionPromise) return null; // doesn't need encryption

                this.pendingEventEncryption.set(event.getId()!, encryptionPromise);
                this.updatePendingEventStatus(room, event, EventStatus.ENCRYPTING);
                return encryptionPromise.then(() => {
                    if (!this.pendingEventEncryption.has(event.getId()!)) {
                        // cancelled via MatrixClient::cancelPendingEvent
                        cancelled = true;
                        return;
                    }
                    this.updatePendingEventStatus(room, event, EventStatus.SENDING);
                });
            })
            .then(() => {
                if (cancelled) return {} as ISendEventResponse;
                let promise: Promise<ISendEventResponse> | null = null;
                if (this.scheduler) {
                    // if this returns a promise then the scheduler has control now and will
                    // resolve/reject when it is done. Internally, the scheduler will invoke
                    // processFn which is set to this._sendEventHttpRequest so the same code
                    // path is executed regardless.
                    promise = this.scheduler.queueEvent(event);
                    if (promise && this.scheduler.getQueueForEvent(event)!.length > 1) {
                        // event is processed FIFO so if the length is 2 or more we know
                        // this event is stuck behind an earlier event.
                        this.updatePendingEventStatus(room, event, EventStatus.QUEUED);
                    }
                }

                if (!promise) {
                    promise = this.sendEventHttpRequest(event);
                    if (room) {
                        promise = promise.then((res) => {
                            room.updatePendingEvent(event, EventStatus.SENT, res["event_id"]);
                            return res;
                        });
                    }
                }

                return promise;
            })
            .catch((err) => {
                logger.error("Error sending event", err.stack || err);
                try {
                    // set the error on the event before we update the status:
                    // updating the status emits the event, so the state should be
                    // consistent at that point.
                    event.error = err;
                    this.updatePendingEventStatus(room, event, EventStatus.NOT_SENT);
                } catch (e) {
                    logger.error("Exception in error handler!", (<Error>e).stack || err);
                }
                if (err instanceof MatrixError) {
                    err.event = event;
                }
                throw err;
            });
    }

    private encryptEventIfNeeded(event: MatrixEvent, room?: Room): Promise<void> | null {
        if (event.isEncrypted()) {
            // this event has already been encrypted; this happens if the
            // encryption step succeeded, but the send step failed on the first
            // attempt.
            return null;
        }

        if (event.isRedaction()) {
            // Redactions do not support encryption in the spec at this time,
            // whilst it mostly worked in some clients, it wasn't compliant.
            return null;
        }

        if (!room || !this.isRoomEncrypted(event.getRoomId()!)) {
            return null;
        }

        if (!this.cryptoBackend && this.usingExternalCrypto) {
            // The client has opted to allow sending messages to encrypted
            // rooms even if the room is encrypted, and we haven't setup
            // crypto. This is useful for users of matrix-org/pantalaimon
            return null;
        }

        if (event.getType() === EventType.Reaction) {
            // For reactions, there is a very little gained by encrypting the entire
            // event, as relation data is already kept in the clear. Event
            // encryption for a reaction effectively only obscures the event type,
            // but the purpose is still obvious from the relation data, so nothing
            // is really gained. It also causes quite a few problems, such as:
            //   * triggers notifications via default push rules
            //   * prevents server-side bundling for reactions
            // The reaction key / content / emoji value does warrant encrypting, but
            // this will be handled separately by encrypting just this value.
            // See https://github.com/matrix-org/matrix-doc/pull/1849#pullrequestreview-248763642
            return null;
        }

        if (!this.cryptoBackend) {
            throw new Error("This room is configured to use encryption, but your client does not support encryption.");
        }

        return this.cryptoBackend.encryptEvent(event, room);
    }

    /**
     * Returns the eventType that should be used taking encryption into account
     * for a given eventType.
     * @param roomId - the room for the events `eventType` relates to
     * @param eventType - the event type
     * @returns the event type taking encryption into account
     */
    private getEncryptedIfNeededEventType(
        roomId: string,
        eventType?: EventType | string | null,
    ): EventType | string | null | undefined {
        if (eventType === EventType.Reaction) return eventType;
        return this.isRoomEncrypted(roomId) ? EventType.RoomMessageEncrypted : eventType;
    }

    protected updatePendingEventStatus(room: Room | null, event: MatrixEvent, newStatus: EventStatus): void {
        if (room) {
            room.updatePendingEvent(event, newStatus);
        } else {
            event.setStatus(newStatus);
        }
    }

    private sendEventHttpRequest(event: MatrixEvent): Promise<ISendEventResponse> {
        let txnId = event.getTxnId();
        if (!txnId) {
            txnId = this.makeTxnId();
            event.setTxnId(txnId);
        }

        const pathParams = {
            $roomId: event.getRoomId()!,
            $eventType: event.getWireType(),
            $stateKey: event.getStateKey()!,
            $txnId: txnId,
        };

        let path: string;

        if (event.isState()) {
            let pathTemplate = "/rooms/$roomId/state/$eventType";
            if (event.getStateKey() && event.getStateKey()!.length > 0) {
                pathTemplate = "/rooms/$roomId/state/$eventType/$stateKey";
            }
            path = utils.encodeUri(pathTemplate, pathParams);
        } else if (event.isRedaction()) {
            const pathTemplate = `/rooms/$roomId/redact/$redactsEventId/$txnId`;
            path = utils.encodeUri(pathTemplate, {
                $redactsEventId: event.event.redacts!,
                ...pathParams,
            });
        } else {
            path = utils.encodeUri("/rooms/$roomId/send/$eventType/$txnId", pathParams);
        }

        return this.http
            .authedRequest<ISendEventResponse>(Method.Put, path, undefined, event.getWireContent())
            .then((res) => {
                logger.log(`Event sent to ${event.getRoomId()} with event id ${res.event_id}`);
                return res;
            });
    }

    /**
     * @param txnId -  transaction id. One will be made up if not supplied.
     * @param opts - Redact options
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     * @throws Error if called with `with_rel_types` (MSC3912) but the server does not support it.
     *         Callers should check whether the server supports MSC3912 via `MatrixClient.canSupport`.
     */
    public redactEvent(
        roomId: string,
        eventId: string,
        txnId?: string | undefined,
        opts?: IRedactOpts,
    ): Promise<ISendEventResponse>;
    public redactEvent(
        roomId: string,
        threadId: string | null,
        eventId: string,
        txnId?: string | undefined,
        opts?: IRedactOpts,
    ): Promise<ISendEventResponse>;
    public redactEvent(
        roomId: string,
        threadId: string | null,
        eventId?: string,
        txnId?: string | IRedactOpts,
        opts?: IRedactOpts,
    ): Promise<ISendEventResponse> {
        if (!eventId?.startsWith(EVENT_ID_PREFIX)) {
            opts = txnId as IRedactOpts;
            txnId = eventId;
            eventId = threadId!;
            threadId = null;
        }
        const reason = opts?.reason;
        const content: IContent = { reason };

        if (opts?.with_rel_types !== undefined) {
            if (this.canSupport.get(Feature.RelationBasedRedactions) === ServerSupport.Unsupported) {
                throw new Error(
                    "Server does not support relation based redactions " +
                        `roomId ${roomId} eventId ${eventId} txnId: ${txnId} threadId ${threadId}`,
                );
            }

            const withRelTypesPropName =
                this.canSupport.get(Feature.RelationBasedRedactions) === ServerSupport.Stable
                    ? MSC3912_RELATION_BASED_REDACTIONS_PROP.stable!
                    : MSC3912_RELATION_BASED_REDACTIONS_PROP.unstable!;

            content[withRelTypesPropName] = opts.with_rel_types;
        }

        return this.sendCompleteEvent(
            roomId,
            threadId,
            {
                type: EventType.RoomRedaction,
                content,
                redacts: eventId,
            },
            txnId as string,
        );
    }

    /**
     * @param txnId - Optional.
     * @returns Promise which resolves: to an ISendEventResponse object
     * @returns Rejects: with an error response.
     */
    public sendMessage(roomId: string, content: IContent, txnId?: string): Promise<ISendEventResponse>;
    public sendMessage(
        roomId: string,
        threadId: string | null,
        content: IContent,
        txnId?: string,
    ): Promise<ISendEventResponse>;
    public sendMessage(
        roomId: string,
        threadId: string | null | IContent,
        content?: IContent | string,
        txnId?: string,
    ): Promise<ISendEventResponse> {
        if (typeof threadId !== "string" && threadId !== null) {
            txnId = content as string;
            content = threadId as IContent;
            threadId = null;
        }

        const eventType: string = EventType.RoomMessage;
        const sendContent: IContent = content as IContent;

        return this.sendEvent(roomId, threadId as string | null, eventType, sendContent, txnId);
    }

    /**
     * @param txnId - Optional.
     * @returns
     * @returns Rejects: with an error response.
     */
    public sendTextMessage(roomId: string, body: string, txnId?: string): Promise<ISendEventResponse>;
    public sendTextMessage(
        roomId: string,
        threadId: string | null,
        body: string,
        txnId?: string,
    ): Promise<ISendEventResponse>;
    public sendTextMessage(
        roomId: string,
        threadId: string | null,
        body: string,
        txnId?: string,
    ): Promise<ISendEventResponse> {
        if (!threadId?.startsWith(EVENT_ID_PREFIX) && threadId !== null) {
            txnId = body;
            body = threadId;
            threadId = null;
        }
        const content = ContentHelpers.makeTextMessage(body);
        return this.sendMessage(roomId, threadId, content, txnId);
    }

    /**
     * @param txnId - Optional.
     * @returns Promise which resolves: to a ISendEventResponse object
     * @returns Rejects: with an error response.
     */
    public sendNotice(roomId: string, body: string, txnId?: string): Promise<ISendEventResponse>;
    public sendNotice(
        roomId: string,
        threadId: string | null,
        body: string,
        txnId?: string,
    ): Promise<ISendEventResponse>;
    public sendNotice(
        roomId: string,
        threadId: string | null,
        body: string,
        txnId?: string,
    ): Promise<ISendEventResponse> {
        if (!threadId?.startsWith(EVENT_ID_PREFIX) && threadId !== null) {
            txnId = body;
            body = threadId;
            threadId = null;
        }
        const content = ContentHelpers.makeNotice(body);
        return this.sendMessage(roomId, threadId, content, txnId);
    }

    /**
     * @param txnId - Optional.
     * @returns Promise which resolves: to a ISendEventResponse object
     * @returns Rejects: with an error response.
     */
    public sendEmoteMessage(roomId: string, body: string, txnId?: string): Promise<ISendEventResponse>;
    public sendEmoteMessage(
        roomId: string,
        threadId: string | null,
        body: string,
        txnId?: string,
    ): Promise<ISendEventResponse>;
    public sendEmoteMessage(
        roomId: string,
        threadId: string | null,
        body: string,
        txnId?: string,
    ): Promise<ISendEventResponse> {
        if (!threadId?.startsWith(EVENT_ID_PREFIX) && threadId !== null) {
            txnId = body;
            body = threadId;
            threadId = null;
        }
        const content = ContentHelpers.makeEmoteMessage(body);
        return this.sendMessage(roomId, threadId, content, txnId);
    }

    /**
     * @returns Promise which resolves: to a ISendEventResponse object
     * @returns Rejects: with an error response.
     */
    public sendImageMessage(roomId: string, url: string, info?: IImageInfo, text?: string): Promise<ISendEventResponse>;
    public sendImageMessage(
        roomId: string,
        threadId: string | null,
        url: string,
        info?: IImageInfo,
        text?: string,
    ): Promise<ISendEventResponse>;
    public sendImageMessage(
        roomId: string,
        threadId: string | null,
        url?: string | IImageInfo,
        info?: IImageInfo | string,
        text = "Image",
    ): Promise<ISendEventResponse> {
        if (!threadId?.startsWith(EVENT_ID_PREFIX) && threadId !== null) {
            text = (info as string) || "Image";
            info = url as IImageInfo;
            url = threadId as string;
            threadId = null;
        }
        const content = {
            msgtype: MsgType.Image,
            url: url,
            info: info,
            body: text,
        };
        return this.sendMessage(roomId, threadId, content);
    }

    /**
     * @returns Promise which resolves: to a ISendEventResponse object
     * @returns Rejects: with an error response.
     */
    public sendStickerMessage(
        roomId: string,
        url: string,
        info?: IImageInfo,
        text?: string,
    ): Promise<ISendEventResponse>;
    public sendStickerMessage(
        roomId: string,
        threadId: string | null,
        url: string,
        info?: IImageInfo,
        text?: string,
    ): Promise<ISendEventResponse>;
    public sendStickerMessage(
        roomId: string,
        threadId: string | null,
        url?: string | IImageInfo,
        info?: IImageInfo | string,
        text = "Sticker",
    ): Promise<ISendEventResponse> {
        if (!threadId?.startsWith(EVENT_ID_PREFIX) && threadId !== null) {
            text = (info as string) || "Sticker";
            info = url as IImageInfo;
            url = threadId as string;
            threadId = null;
        }
        const content = {
            url: url,
            info: info,
            body: text,
        };

        return this.sendEvent(roomId, threadId, EventType.Sticker, content);
    }

    /**
     * @returns Promise which resolves: to a ISendEventResponse object
     * @returns Rejects: with an error response.
     */
    public sendHtmlMessage(roomId: string, body: string, htmlBody: string): Promise<ISendEventResponse>;
    public sendHtmlMessage(
        roomId: string,
        threadId: string | null,
        body: string,
        htmlBody: string,
    ): Promise<ISendEventResponse>;
    public sendHtmlMessage(
        roomId: string,
        threadId: string | null,
        body: string,
        htmlBody?: string,
    ): Promise<ISendEventResponse> {
        if (!threadId?.startsWith(EVENT_ID_PREFIX) && threadId !== null) {
            htmlBody = body as string;
            body = threadId;
            threadId = null;
        }
        const content = ContentHelpers.makeHtmlMessage(body, htmlBody!);
        return this.sendMessage(roomId, threadId, content);
    }

    /**
     * @returns Promise which resolves: to a ISendEventResponse object
     * @returns Rejects: with an error response.
     */
    public sendHtmlNotice(roomId: string, body: string, htmlBody: string): Promise<ISendEventResponse>;
    public sendHtmlNotice(
        roomId: string,
        threadId: string | null,
        body: string,
        htmlBody: string,
    ): Promise<ISendEventResponse>;
    public sendHtmlNotice(
        roomId: string,
        threadId: string | null,
        body: string,
        htmlBody?: string,
    ): Promise<ISendEventResponse> {
        if (!threadId?.startsWith(EVENT_ID_PREFIX) && threadId !== null) {
            htmlBody = body as string;
            body = threadId;
            threadId = null;
        }
        const content = ContentHelpers.makeHtmlNotice(body, htmlBody!);
        return this.sendMessage(roomId, threadId, content);
    }

    /**
     * @returns Promise which resolves: to a ISendEventResponse object
     * @returns Rejects: with an error response.
     */
    public sendHtmlEmote(roomId: string, body: string, htmlBody: string): Promise<ISendEventResponse>;
    public sendHtmlEmote(
        roomId: string,
        threadId: string | null,
        body: string,
        htmlBody: string,
    ): Promise<ISendEventResponse>;
    public sendHtmlEmote(
        roomId: string,
        threadId: string | null,
        body: string,
        htmlBody?: string,
    ): Promise<ISendEventResponse> {
        if (!threadId?.startsWith(EVENT_ID_PREFIX) && threadId !== null) {
            htmlBody = body as string;
            body = threadId;
            threadId = null;
        }
        const content = ContentHelpers.makeHtmlEmote(body, htmlBody!);
        return this.sendMessage(roomId, threadId, content);
    }

    /**
     * Send a receipt.
     * @param event - The event being acknowledged
     * @param receiptType - The kind of receipt e.g. "m.read". Other than
     * ReceiptType.Read are experimental!
     * @param body - Additional content to send alongside the receipt.
     * @param unthreaded - An unthreaded receipt will clear room+thread notifications
     * @returns Promise which resolves: to an empty object `{}`
     * @returns Rejects: with an error response.
     */
    public async sendReceipt(event: MatrixEvent, receiptType: ReceiptType, body: any, unthreaded = false): Promise<{}> {
        if (this.isGuest()) {
            return Promise.resolve({}); // guests cannot send receipts so don't bother.
        }

        const path = utils.encodeUri("/rooms/$roomId/receipt/$receiptType/$eventId", {
            $roomId: event.getRoomId()!,
            $receiptType: receiptType,
            $eventId: event.getId()!,
        });

        if (!unthreaded) {
            const isThread = !!event.threadRootId;
            body = {
                ...body,
                thread_id: isThread ? event.threadRootId : MAIN_ROOM_TIMELINE,
            };
        }

        const promise = this.http.authedRequest<{}>(Method.Post, path, undefined, body || {});

        const room = this.getRoom(event.getRoomId());
        if (room && this.credentials.userId) {
            room.addLocalEchoReceipt(this.credentials.userId, event, receiptType);
        }
        return promise;
    }

    /**
     * Send a read receipt.
     * @param event - The event that has been read.
     * @param receiptType - other than ReceiptType.Read are experimental! Optional.
     * @returns Promise which resolves: to an empty object `{}`
     * @returns Rejects: with an error response.
     */
    public async sendReadReceipt(
        event: MatrixEvent | null,
        receiptType = ReceiptType.Read,
        unthreaded = false,
    ): Promise<{} | undefined> {
        if (!event) return;
        const eventId = event.getId()!;
        const room = this.getRoom(event.getRoomId());
        if (room?.hasPendingEvent(eventId)) {
            throw new Error(`Cannot set read receipt to a pending event (${eventId})`);
        }

        return this.sendReceipt(event, receiptType, {}, unthreaded);
    }

    /**
     * Set a marker to indicate the point in a room before which the user has read every
     * event. This can be retrieved from room account data (the event type is `m.fully_read`)
     * and displayed as a horizontal line in the timeline that is visually distinct to the
     * position of the user's own read receipt.
     * @param roomId - ID of the room that has been read
     * @param rmEventId - ID of the event that has been read
     * @param rrEvent - the event tracked by the read receipt. This is here for
     * convenience because the RR and the RM are commonly updated at the same time as each
     * other. The local echo of this receipt will be done if set. Optional.
     * @param rpEvent - the m.read.private read receipt event for when we don't
     * want other users to see the read receipts. This is experimental. Optional.
     * @returns Promise which resolves: the empty object, `{}`.
     */
    public async setRoomReadMarkers(
        roomId: string,
        rmEventId: string,
        rrEvent?: MatrixEvent,
        rpEvent?: MatrixEvent,
    ): Promise<{}> {
        const room = this.getRoom(roomId);
        if (room?.hasPendingEvent(rmEventId)) {
            throw new Error(`Cannot set read marker to a pending event (${rmEventId})`);
        }

        // Add the optional RR update, do local echo like `sendReceipt`
        let rrEventId: string | undefined;
        if (rrEvent) {
            rrEventId = rrEvent.getId()!;
            if (room?.hasPendingEvent(rrEventId)) {
                throw new Error(`Cannot set read receipt to a pending event (${rrEventId})`);
            }
            room?.addLocalEchoReceipt(this.credentials.userId!, rrEvent, ReceiptType.Read);
        }

        // Add the optional private RR update, do local echo like `sendReceipt`
        let rpEventId: string | undefined;
        if (rpEvent) {
            rpEventId = rpEvent.getId()!;
            if (room?.hasPendingEvent(rpEventId)) {
                throw new Error(`Cannot set read receipt to a pending event (${rpEventId})`);
            }
            room?.addLocalEchoReceipt(this.credentials.userId!, rpEvent, ReceiptType.ReadPrivate);
        }

        return await this.setRoomReadMarkersHttpRequest(roomId, rmEventId, rrEventId, rpEventId);
    }

    /**
     * Get a preview of the given URL as of (roughly) the given point in time,
     * described as an object with OpenGraph keys and associated values.
     * Attributes may be synthesized where actual OG metadata is lacking.
     * Caches results to prevent hammering the server.
     * @param url - The URL to get preview data for
     * @param ts - The preferred point in time that the preview should
     * describe (ms since epoch).  The preview returned will either be the most
     * recent one preceding this timestamp if available, or failing that the next
     * most recent available preview.
     * @returns Promise which resolves: Object of OG metadata.
     * @returns Rejects: with an error response.
     * May return synthesized attributes if the URL lacked OG meta.
     */
    public getUrlPreview(url: string, ts: number): Promise<IPreviewUrlResponse> {
        // bucket the timestamp to the nearest minute to prevent excessive spam to the server
        // Surely 60-second accuracy is enough for anyone.
        ts = Math.floor(ts / 60000) * 60000;

        const parsed = new URL(url);
        parsed.hash = ""; // strip the hash as it won't affect the preview
        url = parsed.toString();

        const key = ts + "_" + url;

        // If there's already a request in flight (or we've handled it), return that instead.
        if (key in this.urlPreviewCache) {
            return this.urlPreviewCache[key];
        }

        const resp = this.http.authedRequest<IPreviewUrlResponse>(
            Method.Get,
            "/preview_url",
            {
                url,
                ts: ts.toString(),
            },
            undefined,
            {
                prefix: MediaPrefix.R0,
            },
        );
        // TODO: Expire the URL preview cache sometimes
        this.urlPreviewCache[key] = resp;
        return resp;
    }

    /**
     * @returns Promise which resolves: to an empty object `{}`
     * @returns Rejects: with an error response.
     */
    public sendTyping(roomId: string, isTyping: boolean, timeoutMs: number): Promise<{}> {
        if (this.isGuest()) {
            return Promise.resolve({}); // guests cannot send typing notifications so don't bother.
        }

        const path = utils.encodeUri("/rooms/$roomId/typing/$userId", {
            $roomId: roomId,
            $userId: this.getUserId()!,
        });
        const data: any = {
            typing: isTyping,
        };
        if (isTyping) {
            data.timeout = timeoutMs ? timeoutMs : 20000;
        }
        return this.http.authedRequest(Method.Put, path, undefined, data);
    }

    /**
     * Determines the history of room upgrades for a given room, as far as the
     * client can see. Returns an array of Rooms where the first entry is the
     * oldest and the last entry is the newest (likely current) room. If the
     * provided room is not found, this returns an empty list. This works in
     * both directions, looking for older and newer rooms of the given room.
     * @param roomId - The room ID to search from
     * @param verifyLinks - If true, the function will only return rooms
     * which can be proven to be linked. For example, rooms which have a create
     * event pointing to an old room which the client is not aware of or doesn't
     * have a matching tombstone would not be returned.
     * @param msc3946ProcessDynamicPredecessor - if true, look for
     * m.room.predecessor state events as well as create events, and prefer
     * predecessor events where they exist (MSC3946).
     * @returns An array of rooms representing the upgrade
     * history.
     */
    public getRoomUpgradeHistory(
        roomId: string,
        verifyLinks = false,
        msc3946ProcessDynamicPredecessor = false,
    ): Room[] {
        const currentRoom = this.getRoom(roomId);
        if (!currentRoom) return [];

        const before = this.findPredecessorRooms(currentRoom, verifyLinks, msc3946ProcessDynamicPredecessor);
        const after = this.findSuccessorRooms(currentRoom, verifyLinks, msc3946ProcessDynamicPredecessor);

        return [...before, currentRoom, ...after];
    }

    private findPredecessorRooms(room: Room, verifyLinks: boolean, msc3946ProcessDynamicPredecessor: boolean): Room[] {
        const ret: Room[] = [];

        // Work backwards from newer to older rooms
        let predecessorRoomId = room.findPredecessor(msc3946ProcessDynamicPredecessor)?.roomId;
        while (predecessorRoomId !== null) {
            const predecessorRoom = this.getRoom(predecessorRoomId);
            if (predecessorRoom === null) {
                break;
            }
            if (verifyLinks) {
                const tombstone = predecessorRoom.currentState.getStateEvents(EventType.RoomTombstone, "");
                if (!tombstone || tombstone.getContent()["replacement_room"] !== room.roomId) {
                    break;
                }
            }

            // Insert at the front because we're working backwards from the currentRoom
            ret.splice(0, 0, predecessorRoom);

            room = predecessorRoom;
            predecessorRoomId = room.findPredecessor(msc3946ProcessDynamicPredecessor)?.roomId;
        }
        return ret;
    }

    private findSuccessorRooms(room: Room, verifyLinks: boolean, msc3946ProcessDynamicPredecessor: boolean): Room[] {
        const ret: Room[] = [];

        // Work forwards, looking at tombstone events
        let tombstoneEvent = room.currentState.getStateEvents(EventType.RoomTombstone, "");
        while (tombstoneEvent) {
            const successorRoom = this.getRoom(tombstoneEvent.getContent()["replacement_room"]);
            if (!successorRoom) break; // end of the chain
            if (successorRoom.roomId === room.roomId) break; // Tombstone is referencing its own room

            if (verifyLinks) {
                const predecessorRoomId = successorRoom.findPredecessor(msc3946ProcessDynamicPredecessor)?.roomId;
                if (!predecessorRoomId || predecessorRoomId !== room.roomId) {
                    break;
                }
            }

            // Push to the end because we're looking forwards
            ret.push(successorRoom);
            const roomIds = new Set(ret.map((ref) => ref.roomId));
            if (roomIds.size < ret.length) {
                // The last room added to the list introduced a previous roomId
                // To avoid recursion, return the last rooms - 1
                return ret.slice(0, ret.length - 1);
            }

            // Set the current room to the reference room so we know where we're at
            room = successorRoom;
            tombstoneEvent = room.currentState.getStateEvents(EventType.RoomTombstone, "");
        }
        return ret;
    }

    /**
     * @param reason - Optional.
     * @returns Promise which resolves: `{}` an empty object.
     * @returns Rejects: with an error response.
     */
    public invite(roomId: string, userId: string, reason?: string): Promise<{}> {
        return this.membershipChange(roomId, userId, "invite", reason);
    }

    /**
     * Invite a user to a room based on their email address.
     * @param roomId - The room to invite the user to.
     * @param email - The email address to invite.
     * @returns Promise which resolves: `{}` an empty object.
     * @returns Rejects: with an error response.
     */
    public inviteByEmail(roomId: string, email: string): Promise<{}> {
        return this.inviteByThreePid(roomId, "email", email);
    }

    /**
     * Invite a user to a room based on a third-party identifier.
     * @param roomId - The room to invite the user to.
     * @param medium - The medium to invite the user e.g. "email".
     * @param address - The address for the specified medium.
     * @returns Promise which resolves: `{}` an empty object.
     * @returns Rejects: with an error response.
     */
    public async inviteByThreePid(roomId: string, medium: string, address: string): Promise<{}> {
        const path = utils.encodeUri("/rooms/$roomId/invite", { $roomId: roomId });

        const identityServerUrl = this.getIdentityServerUrl(true);
        if (!identityServerUrl) {
            return Promise.reject(
                new MatrixError({
                    error: "No supplied identity server URL",
                    errcode: "ORG.MATRIX.JSSDK_MISSING_PARAM",
                }),
            );
        }
        const params: Record<string, string> = {
            id_server: identityServerUrl,
            medium: medium,
            address: address,
        };

        if (this.identityServer?.getAccessToken && (await this.doesServerAcceptIdentityAccessToken())) {
            const identityAccessToken = await this.identityServer.getAccessToken();
            if (identityAccessToken) {
                params["id_access_token"] = identityAccessToken;
            }
        }

        return this.http.authedRequest(Method.Post, path, undefined, params);
    }

    /**
     * @returns Promise which resolves: `{}` an empty object.
     * @returns Rejects: with an error response.
     */
    public leave(roomId: string): Promise<{}> {
        return this.membershipChange(roomId, undefined, "leave");
    }

    /**
     * Leaves all rooms in the chain of room upgrades based on the given room. By
     * default, this will leave all the previous and upgraded rooms, including the
     * given room. To only leave the given room and any previous rooms, keeping the
     * upgraded (modern) rooms untouched supply `false` to `includeFuture`.
     * @param roomId - The room ID to start leaving at
     * @param includeFuture - If true, the whole chain (past and future) of
     * upgraded rooms will be left.
     * @returns Promise which resolves when completed with an object keyed
     * by room ID and value of the error encountered when leaving or null.
     */
    public leaveRoomChain(
        roomId: string,
        includeFuture = true,
    ): Promise<{ [roomId: string]: Error | MatrixError | null }> {
        const upgradeHistory = this.getRoomUpgradeHistory(roomId);

        let eligibleToLeave = upgradeHistory;
        if (!includeFuture) {
            eligibleToLeave = [];
            for (const room of upgradeHistory) {
                eligibleToLeave.push(room);
                if (room.roomId === roomId) {
                    break;
                }
            }
        }

        const populationResults: { [roomId: string]: Error } = {};
        const promises: Promise<any>[] = [];

        const doLeave = (roomId: string): Promise<void> => {
            return this.leave(roomId)
                .then(() => {
                    delete populationResults[roomId];
                })
                .catch((err) => {
                    // suppress error
                    populationResults[roomId] = err;
                });
        };

        for (const room of eligibleToLeave) {
            promises.push(doLeave(room.roomId));
        }

        return Promise.all(promises).then(() => populationResults);
    }

    /**
     * @param reason - Optional.
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public ban(roomId: string, userId: string, reason?: string): Promise<{}> {
        return this.membershipChange(roomId, userId, "ban", reason);
    }

    /**
     * @param deleteRoom - True to delete the room from the store on success.
     * Default: true.
     * @returns Promise which resolves: `{}` an empty object.
     * @returns Rejects: with an error response.
     */
    public forget(roomId: string, deleteRoom = true): Promise<{}> {
        const promise = this.membershipChange(roomId, undefined, "forget");
        if (!deleteRoom) {
            return promise;
        }
        return promise.then((response) => {
            this.store.removeRoom(roomId);
            this.emit(ClientEvent.DeleteRoom, roomId);
            return response;
        });
    }

    /**
     * @returns Promise which resolves: Object (currently empty)
     * @returns Rejects: with an error response.
     */
    public unban(roomId: string, userId: string): Promise<{}> {
        // unbanning != set their state to leave: this used to be
        // the case, but was then changed so that leaving was always
        // a revoking of privilege, otherwise two people racing to
        // kick / ban someone could end up banning and then un-banning
        // them.
        const path = utils.encodeUri("/rooms/$roomId/unban", {
            $roomId: roomId,
        });
        const data = {
            user_id: userId,
        };
        return this.http.authedRequest(Method.Post, path, undefined, data);
    }

    /**
     * @param reason - Optional.
     * @returns Promise which resolves: `{}` an empty object.
     * @returns Rejects: with an error response.
     */
    public kick(roomId: string, userId: string, reason?: string): Promise<{}> {
        const path = utils.encodeUri("/rooms/$roomId/kick", {
            $roomId: roomId,
        });
        const data = {
            user_id: userId,
            reason: reason,
        };
        return this.http.authedRequest(Method.Post, path, undefined, data);
    }

    private membershipChange(
        roomId: string,
        userId: string | undefined,
        membership: string,
        reason?: string,
    ): Promise<{}> {
        // API returns an empty object
        const path = utils.encodeUri("/rooms/$room_id/$membership", {
            $room_id: roomId,
            $membership: membership,
        });
        return this.http.authedRequest(Method.Post, path, undefined, {
            user_id: userId, // may be undefined e.g. on leave
            reason: reason,
        });
    }

    /**
     * Obtain a dict of actions which should be performed for this event according
     * to the push rules for this user.  Caches the dict on the event.
     * @param event - The event to get push actions for.
     * @param forceRecalculate - forces to recalculate actions for an event
     * Useful when an event just got decrypted
     * @returns A dict of actions to perform.
     */
    public getPushActionsForEvent(event: MatrixEvent, forceRecalculate = false): IActionsObject | null {
        if (!event.getPushActions() || forceRecalculate) {
            const { actions, rule } = this.pushProcessor.actionsAndRuleForEvent(event);
            event.setPushDetails(actions, rule);
        }
        return event.getPushActions();
    }

    /**
     * Obtain a dict of actions which should be performed for this event according
     * to the push rules for this user.  Caches the dict on the event.
     * @param event - The event to get push actions for.
     * @param forceRecalculate - forces to recalculate actions for an event
     * Useful when an event just got decrypted
     * @returns A dict of actions to perform.
     */
    public getPushDetailsForEvent(event: MatrixEvent, forceRecalculate = false): PushDetails | null {
        if (!event.getPushDetails() || forceRecalculate) {
            const { actions, rule } = this.pushProcessor.actionsAndRuleForEvent(event);
            event.setPushDetails(actions, rule);
        }
        return event.getPushDetails();
    }

    /**
     * @param info - The kind of info to set (e.g. 'avatar_url')
     * @param data - The JSON object to set.
     * @returns
     * @returns Rejects: with an error response.
     */
    // eslint-disable-next-line camelcase
    public setProfileInfo(info: "avatar_url", data: { avatar_url: string }): Promise<{}>;
    public setProfileInfo(info: "displayname", data: { displayname: string }): Promise<{}>;
    public setProfileInfo(info: "avatar_url" | "displayname", data: object): Promise<{}> {
        const path = utils.encodeUri("/profile/$userId/$info", {
            $userId: this.credentials.userId!,
            $info: info,
        });
        return this.http.authedRequest(Method.Put, path, undefined, data);
    }

    /**
     * @returns Promise which resolves: `{}` an empty object.
     * @returns Rejects: with an error response.
     */
    public async setDisplayName(name: string): Promise<{}> {
        const prom = await this.setProfileInfo("displayname", { displayname: name });
        // XXX: synthesise a profile update for ourselves because Synapse is broken and won't
        const user = this.getUser(this.getUserId()!);
        if (user) {
            user.displayName = name;
            user.emit(UserEvent.DisplayName, user.events.presence, user);
        }
        return prom;
    }

    /**
     * @returns Promise which resolves: `{}` an empty object.
     * @returns Rejects: with an error response.
     */
    public async setAvatarUrl(url: string): Promise<{}> {
        const prom = await this.setProfileInfo("avatar_url", { avatar_url: url });
        // XXX: synthesise a profile update for ourselves because Synapse is broken and won't
        const user = this.getUser(this.getUserId()!);
        if (user) {
            user.avatarUrl = url;
            user.emit(UserEvent.AvatarUrl, user.events.presence, user);
        }
        return prom;
    }

    /**
     * Turn an MXC URL into an HTTP one. <strong>This method is experimental and
     * may change.</strong>
     * @param mxcUrl - The MXC URL
     * @param width - The desired width of the thumbnail.
     * @param height - The desired height of the thumbnail.
     * @param resizeMethod - The thumbnail resize method to use, either
     * "crop" or "scale".
     * @param allowDirectLinks - If true, return any non-mxc URLs
     * directly. Fetching such URLs will leak information about the user to
     * anyone they share a room with. If false, will return null for such URLs.
     * @returns the avatar URL or null.
     */
    public mxcUrlToHttp(
        mxcUrl: string,
        width?: number,
        height?: number,
        resizeMethod?: string,
        allowDirectLinks?: boolean,
    ): string | null {
        return getHttpUriForMxc(this.baseUrl, mxcUrl, width, height, resizeMethod, allowDirectLinks);
    }

    /**
     * @param opts - Options to apply
     * @returns Promise which resolves
     * @returns Rejects: with an error response.
     * @throws If 'presence' isn't a valid presence enum value.
     */
    public async setPresence(opts: IPresenceOpts): Promise<void> {
        const path = utils.encodeUri("/presence/$userId/status", {
            $userId: this.credentials.userId!,
        });

        const validStates = ["offline", "online", "unavailable"];
        if (validStates.indexOf(opts.presence) === -1) {
            throw new Error("Bad presence value: " + opts.presence);
        }
        await this.http.authedRequest(Method.Put, path, undefined, opts);
    }

    /**
     * @param userId - The user to get presence for
     * @returns Promise which resolves: The presence state for this user.
     * @returns Rejects: with an error response.
     */
    public getPresence(userId: string): Promise<IStatusResponse> {
        const path = utils.encodeUri("/presence/$userId/status", {
            $userId: userId,
        });

        return this.http.authedRequest(Method.Get, path);
    }

    /**
     * Retrieve older messages from the given room and put them in the timeline.
     *
     * If this is called multiple times whilst a request is ongoing, the <i>same</i>
     * Promise will be returned. If there was a problem requesting scrollback, there
     * will be a small delay before another request can be made (to prevent tight-looping
     * when there is no connection).
     *
     * @param room - The room to get older messages in.
     * @param limit - Optional. The maximum number of previous events to
     * pull in. Default: 30.
     * @returns Promise which resolves: Room. If you are at the beginning
     * of the timeline, `Room.oldState.paginationToken` will be
     * `null`.
     * @returns Rejects: with an error response.
     */
    public scrollback(room: Room, limit = 30): Promise<Room> {
        let timeToWaitMs = 0;

        let info = this.ongoingScrollbacks[room.roomId] || {};
        if (info.promise) {
            return info.promise;
        } else if (info.errorTs) {
            const timeWaitedMs = Date.now() - info.errorTs;
            timeToWaitMs = Math.max(SCROLLBACK_DELAY_MS - timeWaitedMs, 0);
        }

        if (room.oldState.paginationToken === null) {
            return Promise.resolve(room); // already at the start.
        }
        // attempt to grab more events from the store first
        const numAdded = this.store.scrollback(room, limit).length;
        if (numAdded === limit) {
            // store contained everything we needed.
            return Promise.resolve(room);
        }
        // reduce the required number of events appropriately
        limit = limit - numAdded;

        const promise = new Promise<Room>((resolve, reject) => {
            // wait for a time before doing this request
            // (which may be 0 in order not to special case the code paths)
            sleep(timeToWaitMs)
                .then(() => {
                    return this.createMessagesRequest(
                        room.roomId,
                        room.oldState.paginationToken,
                        limit,
                        Direction.Backward,
                    );
                })
                .then((res: IMessagesResponse) => {
                    const matrixEvents = res.chunk.map(this.getEventMapper());
                    if (res.state) {
                        const stateEvents = res.state.map(this.getEventMapper());
                        room.currentState.setUnknownStateEvents(stateEvents);
                    }

                    const [timelineEvents, threadedEvents, unknownRelations] =
                        room.partitionThreadedEvents(matrixEvents);

                    this.processAggregatedTimelineEvents(room, timelineEvents);
                    room.addEventsToTimeline(timelineEvents, true, room.getLiveTimeline());
                    this.processThreadEvents(room, threadedEvents, true);
                    unknownRelations.forEach((event) => room.relations.aggregateChildEvent(event));

                    room.oldState.paginationToken = res.end ?? null;
                    if (res.chunk.length === 0) {
                        room.oldState.paginationToken = null;
                    }
                    this.store.storeEvents(room, matrixEvents, res.end ?? null, true);
                    delete this.ongoingScrollbacks[room.roomId];
                    resolve(room);
                })
                .catch((err) => {
                    this.ongoingScrollbacks[room.roomId] = {
                        errorTs: Date.now(),
                    };
                    reject(err);
                });
        });

        info = { promise };

        this.ongoingScrollbacks[room.roomId] = info;
        return promise;
    }

    public getEventMapper(options?: MapperOpts): EventMapper {
        return eventMapperFor(this, options || {});
    }

    /**
     * Get an EventTimeline for the given event
     *
     * <p>If the EventTimelineSet object already has the given event in its store, the
     * corresponding timeline will be returned. Otherwise, a /context request is
     * made, and used to construct an EventTimeline.
     * If the event does not belong to this EventTimelineSet then undefined will be returned.
     *
     * @param timelineSet -  The timelineSet to look for the event in, must be bound to a room
     * @param eventId -  The ID of the event to look for
     *
     * @returns Promise which resolves:
     *    {@link EventTimeline} including the given event
     */
    public async getEventTimeline(timelineSet: EventTimelineSet, eventId: string): Promise<Optional<EventTimeline>> {
        // don't allow any timeline support unless it's been enabled.
        if (!this.timelineSupport) {
            throw new Error(
                "timeline support is disabled. Set the 'timelineSupport'" +
                    " parameter to true when creating MatrixClient to enable it.",
            );
        }

        if (!timelineSet?.room) {
            throw new Error("getEventTimeline only supports room timelines");
        }

        if (timelineSet.getTimelineForEvent(eventId)) {
            return timelineSet.getTimelineForEvent(eventId);
        }

        if (timelineSet.thread && this.supportsThreads()) {
            return this.getThreadTimeline(timelineSet, eventId);
        }

        const path = utils.encodeUri("/rooms/$roomId/context/$eventId", {
            $roomId: timelineSet.room.roomId,
            $eventId: eventId,
        });

        let params: Record<string, string | string[]> | undefined = undefined;
        if (this.clientOpts?.lazyLoadMembers) {
            params = { filter: JSON.stringify(Filter.LAZY_LOADING_MESSAGES_FILTER) };
        }

        // TODO: we should implement a backoff (as per scrollback()) to deal more nicely with HTTP errors.
        const res = await this.http.authedRequest<IContextResponse>(Method.Get, path, params);
        if (!res.event) {
            throw new Error("'event' not in '/context' result - homeserver too old?");
        }

        // by the time the request completes, the event might have ended up in the timeline.
        if (timelineSet.getTimelineForEvent(eventId)) {
            return timelineSet.getTimelineForEvent(eventId);
        }

        const mapper = this.getEventMapper();
        const event = mapper(res.event);
        if (event.isRelation(THREAD_RELATION_TYPE.name)) {
            logger.warn("Tried loading a regular timeline at the position of a thread event");
            return undefined;
        }
        const events = [
            // Order events from most recent to oldest (reverse-chronological).
            // We start with the last event, since that's the point at which we have known state.
            // events_after is already backwards; events_before is forwards.
            ...res.events_after.reverse().map(mapper),
            event,
            ...res.events_before.map(mapper),
        ];

        // Here we handle non-thread timelines only, but still process any thread events to populate thread summaries.
        let timeline = timelineSet.getTimelineForEvent(events[0].getId());
        if (timeline) {
            timeline.getState(EventTimeline.BACKWARDS)!.setUnknownStateEvents(res.state.map(mapper));
        } else {
            timeline = timelineSet.addTimeline();
            timeline.initialiseState(res.state.map(mapper));
            timeline.getState(EventTimeline.FORWARDS)!.paginationToken = res.end;
        }

        const [timelineEvents, threadedEvents, unknownRelations] = timelineSet.room.partitionThreadedEvents(events);
        timelineSet.addEventsToTimeline(timelineEvents, true, timeline, res.start);
        // The target event is not in a thread but process the contextual events, so we can show any threads around it.
        this.processThreadEvents(timelineSet.room, threadedEvents, true);
        this.processAggregatedTimelineEvents(timelineSet.room, timelineEvents);
        unknownRelations.forEach((event) => timelineSet.relations.aggregateChildEvent(event));

        // There is no guarantee that the event ended up in "timeline" (we might have switched to a neighbouring
        // timeline) - so check the room's index again. On the other hand, there's no guarantee the event ended up
        // anywhere, if it was later redacted, so we just return the timeline we first thought of.
        return (
            timelineSet.getTimelineForEvent(eventId) ??
            timelineSet.room.findThreadForEvent(event)?.liveTimeline ?? // for Threads degraded support
            timeline
        );
    }

    public async getThreadTimeline(timelineSet: EventTimelineSet, eventId: string): Promise<EventTimeline | undefined> {
        if (!this.supportsThreads()) {
            throw new Error("could not get thread timeline: no client support");
        }

        if (!timelineSet.room) {
            throw new Error("could not get thread timeline: not a room timeline");
        }

        if (!timelineSet.thread) {
            throw new Error("could not get thread timeline: not a thread timeline");
        }

        const path = utils.encodeUri("/rooms/$roomId/context/$eventId", {
            $roomId: timelineSet.room.roomId,
            $eventId: eventId,
        });

        const params: Record<string, string | string[]> = {
            limit: "0",
        };
        if (this.clientOpts?.lazyLoadMembers) {
            params.filter = JSON.stringify(Filter.LAZY_LOADING_MESSAGES_FILTER);
        }

        // TODO: we should implement a backoff (as per scrollback()) to deal more nicely with HTTP errors.
        const res = await this.http.authedRequest<IContextResponse>(Method.Get, path, params);
        const mapper = this.getEventMapper();
        const event = mapper(res.event);

        if (!timelineSet.canContain(event)) {
            return undefined;
        }

        const recurse = this.canSupport.get(Feature.RelationsRecursion) !== ServerSupport.Unsupported;
        if (Thread.hasServerSideSupport) {
            if (Thread.hasServerSideFwdPaginationSupport) {
                if (!timelineSet.thread) {
                    throw new Error("could not get thread timeline: not a thread timeline");
                }

                const thread = timelineSet.thread;
                const resOlder: IRelationsResponse = await this.fetchRelations(
                    timelineSet.room.roomId,
                    thread.id,
                    THREAD_RELATION_TYPE.name,
                    null,
                    { dir: Direction.Backward, from: res.start, recurse: recurse || undefined },
                );
                const resNewer: IRelationsResponse = await this.fetchRelations(
                    timelineSet.room.roomId,
                    thread.id,
                    THREAD_RELATION_TYPE.name,
                    null,
                    { dir: Direction.Forward, from: res.end, recurse: recurse || undefined },
                );
                const events = [
                    // Order events from most recent to oldest (reverse-chronological).
                    // We start with the last event, since that's the point at which we have known state.
                    // events_after is already backwards; events_before is forwards.
                    ...resNewer.chunk.reverse().map(mapper),
                    event,
                    ...resOlder.chunk.map(mapper),
                ];
                for (const event of events) {
                    await timelineSet.thread?.processEvent(event);
                }

                // Here we handle non-thread timelines only, but still process any thread events to populate thread summaries.
                let timeline = timelineSet.getTimelineForEvent(event.getId());
                if (timeline) {
                    timeline.getState(EventTimeline.BACKWARDS)!.setUnknownStateEvents(res.state.map(mapper));
                } else {
                    timeline = timelineSet.addTimeline();
                    timeline.initialiseState(res.state.map(mapper));
                }

                timelineSet.addEventsToTimeline(events, true, timeline, resNewer.next_batch);
                if (!resOlder.next_batch) {
                    const originalEvent = await this.fetchRoomEvent(timelineSet.room.roomId, thread.id);
                    timelineSet.addEventsToTimeline([mapper(originalEvent)], true, timeline, null);
                }
                timeline.setPaginationToken(resOlder.next_batch ?? null, Direction.Backward);
                timeline.setPaginationToken(resNewer.next_batch ?? null, Direction.Forward);
                this.processAggregatedTimelineEvents(timelineSet.room, events);

                // There is no guarantee that the event ended up in "timeline" (we might have switched to a neighbouring
                // timeline) - so check the room's index again. On the other hand, there's no guarantee the event ended up
                // anywhere, if it was later redacted, so we just return the timeline we first thought of.
                return timelineSet.getTimelineForEvent(eventId) ?? timeline;
            } else {
                // Where the event is a thread reply (not a root) and running in MSC-enabled mode the Thread timeline only
                // functions contiguously, so we have to jump through some hoops to get our target event in it.
                // XXX: workaround for https://github.com/vector-im/element-meta/issues/150

                const thread = timelineSet.thread;

                const resOlder = await this.fetchRelations(
                    timelineSet.room.roomId,
                    thread.id,
                    THREAD_RELATION_TYPE.name,
                    null,
                    { dir: Direction.Backward, from: res.start, recurse: recurse || undefined },
                );
                const eventsNewer: IEvent[] = [];
                let nextBatch: Optional<string> = res.end;
                while (nextBatch) {
                    const resNewer: IRelationsResponse = await this.fetchRelations(
                        timelineSet.room.roomId,
                        thread.id,
                        THREAD_RELATION_TYPE.name,
                        null,
                        { dir: Direction.Forward, from: nextBatch, recurse: recurse || undefined },
                    );
                    nextBatch = resNewer.next_batch ?? null;
                    eventsNewer.push(...resNewer.chunk);
                }
                const events = [
                    // Order events from most recent to oldest (reverse-chronological).
                    // We start with the last event, since that's the point at which we have known state.
                    // events_after is already backwards; events_before is forwards.
                    ...eventsNewer.reverse().map(mapper),
                    event,
                    ...resOlder.chunk.map(mapper),
                ];
                for (const event of events) {
                    await timelineSet.thread?.processEvent(event);
                }

                // Here we handle non-thread timelines only, but still process any thread events to populate thread
                // summaries.
                const timeline = timelineSet.getLiveTimeline();
                timeline.getState(EventTimeline.BACKWARDS)!.setUnknownStateEvents(res.state.map(mapper));

                timelineSet.addEventsToTimeline(events, true, timeline, null);
                if (!resOlder.next_batch) {
                    const originalEvent = await this.fetchRoomEvent(timelineSet.room.roomId, thread.id);
                    timelineSet.addEventsToTimeline([mapper(originalEvent)], true, timeline, null);
                }
                timeline.setPaginationToken(resOlder.next_batch ?? null, Direction.Backward);
                timeline.setPaginationToken(null, Direction.Forward);
                this.processAggregatedTimelineEvents(timelineSet.room, events);

                return timeline;
            }
        }
    }

    /**
     * Get an EventTimeline for the latest events in the room. This will just
     * call `/messages` to get the latest message in the room, then use
     * `client.getEventTimeline(...)` to construct a new timeline from it.
     *
     * @param timelineSet -  The timelineSet to find or add the timeline to
     *
     * @returns Promise which resolves:
     *    {@link EventTimeline} timeline with the latest events in the room
     */
    public async getLatestTimeline(timelineSet: EventTimelineSet): Promise<Optional<EventTimeline>> {
        // don't allow any timeline support unless it's been enabled.
        if (!this.timelineSupport) {
            throw new Error(
                "timeline support is disabled. Set the 'timelineSupport'" +
                    " parameter to true when creating MatrixClient to enable it.",
            );
        }

        if (!timelineSet.room) {
            throw new Error("getLatestTimeline only supports room timelines");
        }

        let event;
        if (timelineSet.threadListType !== null) {
            const res = await this.createThreadListMessagesRequest(
                timelineSet.room.roomId,
                null,
                1,
                Direction.Backward,
                timelineSet.threadListType,
                timelineSet.getFilter(),
            );
            event = res.chunk?.[0];
        } else if (timelineSet.thread && Thread.hasServerSideSupport) {
            const recurse = this.canSupport.get(Feature.RelationsRecursion) !== ServerSupport.Unsupported;
            const res = await this.fetchRelations(
                timelineSet.room.roomId,
                timelineSet.thread.id,
                THREAD_RELATION_TYPE.name,
                null,
                { dir: Direction.Backward, limit: 1, recurse: recurse || undefined },
            );
            event = res.chunk?.[0];
        } else {
            const messagesPath = utils.encodeUri("/rooms/$roomId/messages", {
                $roomId: timelineSet.room.roomId,
            });

            const params: Record<string, string | string[]> = {
                dir: "b",
            };
            if (this.clientOpts?.lazyLoadMembers) {
                params.filter = JSON.stringify(Filter.LAZY_LOADING_MESSAGES_FILTER);
            }

            const res = await this.http.authedRequest<IMessagesResponse>(Method.Get, messagesPath, params);
            event = res.chunk?.[0];
        }
        if (!event) {
            throw new Error("No message returned when trying to construct getLatestTimeline");
        }

        return this.getEventTimeline(timelineSet, event.event_id);
    }

    /**
     * Makes a request to /messages with the appropriate lazy loading filter set.
     * XXX: if we do get rid of scrollback (as it's not used at the moment),
     * we could inline this method again in paginateEventTimeline as that would
     * then be the only call-site
     * @param limit - the maximum amount of events the retrieve
     * @param dir - 'f' or 'b'
     * @param timelineFilter - the timeline filter to pass
     */
    // XXX: Intended private, used in code.
    public createMessagesRequest(
        roomId: string,
        fromToken: string | null,
        limit = 30,
        dir: Direction,
        timelineFilter?: Filter,
    ): Promise<IMessagesResponse> {
        const path = utils.encodeUri("/rooms/$roomId/messages", { $roomId: roomId });

        const params: Record<string, string> = {
            limit: limit.toString(),
            dir: dir,
        };

        if (fromToken) {
            params.from = fromToken;
        }

        let filter: IRoomEventFilter | null = null;
        if (this.clientOpts?.lazyLoadMembers) {
            // create a shallow copy of LAZY_LOADING_MESSAGES_FILTER,
            // so the timelineFilter doesn't get written into it below
            filter = Object.assign({}, Filter.LAZY_LOADING_MESSAGES_FILTER);
        }
        if (timelineFilter) {
            // XXX: it's horrific that /messages' filter parameter doesn't match
            // /sync's one - see https://matrix.org/jira/browse/SPEC-451
            filter = filter || {};
            Object.assign(filter, timelineFilter.getRoomTimelineFilterComponent()?.toJSON());
        }
        if (filter) {
            params.filter = JSON.stringify(filter);
        }
        return this.http.authedRequest(Method.Get, path, params);
    }

    /**
     * Makes a request to /messages with the appropriate lazy loading filter set.
     * XXX: if we do get rid of scrollback (as it's not used at the moment),
     * we could inline this method again in paginateEventTimeline as that would
     * then be the only call-site
     * @param limit - the maximum amount of events the retrieve
     * @param dir - 'f' or 'b'
     * @param timelineFilter - the timeline filter to pass
     */
    // XXX: Intended private, used by room.fetchRoomThreads
    public createThreadListMessagesRequest(
        roomId: string,
        fromToken: string | null,
        limit = 30,
        dir = Direction.Backward,
        threadListType: ThreadFilterType | null = ThreadFilterType.All,
        timelineFilter?: Filter,
    ): Promise<IMessagesResponse> {
        const path = utils.encodeUri("/rooms/$roomId/threads", { $roomId: roomId });

        const params: Record<string, string> = {
            limit: limit.toString(),
            dir: dir,
            include: threadFilterTypeToFilter(threadListType),
        };

        if (fromToken) {
            params.from = fromToken;
        }

        let filter: IRoomEventFilter = {};
        if (this.clientOpts?.lazyLoadMembers) {
            // create a shallow copy of LAZY_LOADING_MESSAGES_FILTER,
            // so the timelineFilter doesn't get written into it below
            filter = {
                ...Filter.LAZY_LOADING_MESSAGES_FILTER,
            };
        }
        if (timelineFilter) {
            // XXX: it's horrific that /messages' filter parameter doesn't match
            // /sync's one - see https://matrix.org/jira/browse/SPEC-451
            filter = {
                ...filter,
                ...timelineFilter.getRoomTimelineFilterComponent()?.toJSON(),
            };
        }
        if (Object.keys(filter).length) {
            params.filter = JSON.stringify(filter);
        }

        const opts = {
            prefix:
                Thread.hasServerSideListSupport === FeatureSupport.Stable
                    ? "/_matrix/client/v1"
                    : "/_matrix/client/unstable/org.matrix.msc3856",
        };

        return this.http
            .authedRequest<IThreadedMessagesResponse>(Method.Get, path, params, undefined, opts)
            .then((res) => ({
                ...res,
                chunk: res.chunk?.reverse(),
                start: res.prev_batch,
                end: res.next_batch,
            }));
    }

    /**
     * Take an EventTimeline, and back/forward-fill results.
     *
     * @param eventTimeline - timeline object to be updated
     *
     * @returns Promise which resolves to a boolean: false if there are no
     *    events and we reached either end of the timeline; else true.
     */
    public paginateEventTimeline(eventTimeline: EventTimeline, opts: IPaginateOpts): Promise<boolean> {
        const isNotifTimeline = eventTimeline.getTimelineSet() === this.notifTimelineSet;
        const room = this.getRoom(eventTimeline.getRoomId()!);
        const threadListType = eventTimeline.getTimelineSet().threadListType;
        const thread = eventTimeline.getTimelineSet().thread;

        // TODO: we should implement a backoff (as per scrollback()) to deal more
        // nicely with HTTP errors.
        opts = opts || {};
        const backwards = opts.backwards || false;

        if (isNotifTimeline) {
            if (!backwards) {
                throw new Error("paginateNotifTimeline can only paginate backwards");
            }
        }

        const dir = backwards ? EventTimeline.BACKWARDS : EventTimeline.FORWARDS;

        const token = eventTimeline.getPaginationToken(dir);
        const pendingRequest = eventTimeline.paginationRequests[dir];

        if (pendingRequest) {
            // already a request in progress - return the existing promise
            return pendingRequest;
        }

        let path: string;
        let params: Record<string, string>;
        let promise: Promise<boolean>;

        if (isNotifTimeline) {
            path = "/notifications";
            params = {
                limit: (opts.limit ?? 30).toString(),
                only: "highlight",
            };

            if (token && token !== "end") {
                params.from = token;
            }

            promise = this.http
                .authedRequest<INotificationsResponse>(Method.Get, path, params)
                .then(async (res) => {
                    const token = res.next_token;
                    const matrixEvents: MatrixEvent[] = [];

                    res.notifications = res.notifications.filter(noUnsafeEventProps);

                    for (let i = 0; i < res.notifications.length; i++) {
                        const notification = res.notifications[i];
                        const event = this.getEventMapper()(notification.event);

                        // @TODO(kerrya) reprocessing every notification is ugly
                        // remove if we get server MSC3994 support
                        this.getPushDetailsForEvent(event, true);

                        event.event.room_id = notification.room_id; // XXX: gutwrenching
                        matrixEvents[i] = event;
                    }

                    // No need to partition events for threads here, everything lives
                    // in the notification timeline set
                    const timelineSet = eventTimeline.getTimelineSet();
                    timelineSet.addEventsToTimeline(matrixEvents, backwards, eventTimeline, token);
                    this.processAggregatedTimelineEvents(timelineSet.room, matrixEvents);

                    // if we've hit the end of the timeline, we need to stop trying to
                    // paginate. We need to keep the 'forwards' token though, to make sure
                    // we can recover from gappy syncs.
                    if (backwards && !res.next_token) {
                        eventTimeline.setPaginationToken(null, dir);
                    }
                    return Boolean(res.next_token);
                })
                .finally(() => {
                    eventTimeline.paginationRequests[dir] = null;
                });
            eventTimeline.paginationRequests[dir] = promise;
        } else if (threadListType !== null) {
            if (!room) {
                throw new Error("Unknown room " + eventTimeline.getRoomId());
            }

            if (!Thread.hasServerSideFwdPaginationSupport && dir === Direction.Forward) {
                throw new Error("Cannot paginate threads forwards without server-side support for MSC 3715");
            }

            promise = this.createThreadListMessagesRequest(
                eventTimeline.getRoomId()!,
                token,
                opts.limit,
                dir,
                threadListType,
                eventTimeline.getFilter(),
            )
                .then((res) => {
                    if (res.state) {
                        const roomState = eventTimeline.getState(dir)!;
                        const stateEvents = res.state.filter(noUnsafeEventProps).map(this.getEventMapper());
                        roomState.setUnknownStateEvents(stateEvents);
                    }
                    const token = res.end;
                    const matrixEvents = res.chunk.filter(noUnsafeEventProps).map(this.getEventMapper());

                    const timelineSet = eventTimeline.getTimelineSet();
                    timelineSet.addEventsToTimeline(matrixEvents, backwards, eventTimeline, token);
                    this.processAggregatedTimelineEvents(room, matrixEvents);
                    this.processThreadRoots(room, matrixEvents, backwards);

                    // if we've hit the end of the timeline, we need to stop trying to
                    // paginate. We need to keep the 'forwards' token though, to make sure
                    // we can recover from gappy syncs.
                    if (backwards && res.end == res.start) {
                        eventTimeline.setPaginationToken(null, dir);
                    }
                    return res.end !== res.start;
                })
                .finally(() => {
                    eventTimeline.paginationRequests[dir] = null;
                });
            eventTimeline.paginationRequests[dir] = promise;
        } else if (thread) {
            const room = this.getRoom(eventTimeline.getRoomId() ?? undefined);
            if (!room) {
                throw new Error("Unknown room " + eventTimeline.getRoomId());
            }

            const recurse = this.canSupport.get(Feature.RelationsRecursion) !== ServerSupport.Unsupported;
            promise = this.fetchRelations(eventTimeline.getRoomId() ?? "", thread.id, THREAD_RELATION_TYPE.name, null, {
                dir,
                limit: opts.limit,
                from: token ?? undefined,
                recurse: recurse || undefined,
            })
                .then(async (res) => {
                    const mapper = this.getEventMapper();
                    const matrixEvents = res.chunk.filter(noUnsafeEventProps).map(mapper);

                    // Process latest events first
                    for (const event of matrixEvents.slice().reverse()) {
                        await thread?.processEvent(event);
                        const sender = event.getSender()!;
                        if (!backwards || thread?.getEventReadUpTo(sender) === null) {
                            room.addLocalEchoReceipt(sender, event, ReceiptType.Read);
                        }
                    }

                    const newToken = res.next_batch;

                    const timelineSet = eventTimeline.getTimelineSet();
                    timelineSet.addEventsToTimeline(matrixEvents, backwards, eventTimeline, newToken ?? null);
                    if (!newToken && backwards) {
                        const originalEvent = await this.fetchRoomEvent(eventTimeline.getRoomId() ?? "", thread.id);
                        timelineSet.addEventsToTimeline([mapper(originalEvent)], true, eventTimeline, null);
                    }
                    this.processAggregatedTimelineEvents(timelineSet.room, matrixEvents);

                    // if we've hit the end of the timeline, we need to stop trying to
                    // paginate. We need to keep the 'forwards' token though, to make sure
                    // we can recover from gappy syncs.
                    if (backwards && !newToken) {
                        eventTimeline.setPaginationToken(null, dir);
                    }
                    return Boolean(newToken);
                })
                .finally(() => {
                    eventTimeline.paginationRequests[dir] = null;
                });
            eventTimeline.paginationRequests[dir] = promise;
        } else {
            if (!room) {
                throw new Error("Unknown room " + eventTimeline.getRoomId());
            }

            promise = this.createMessagesRequest(
                eventTimeline.getRoomId()!,
                token,
                opts.limit,
                dir,
                eventTimeline.getFilter(),
            )
                .then((res) => {
                    if (res.state) {
                        const roomState = eventTimeline.getState(dir)!;
                        const stateEvents = res.state.filter(noUnsafeEventProps).map(this.getEventMapper());
                        roomState.setUnknownStateEvents(stateEvents);
                    }
                    const token = res.end;
                    const matrixEvents = res.chunk.filter(noUnsafeEventProps).map(this.getEventMapper());

                    const timelineSet = eventTimeline.getTimelineSet();
                    const [timelineEvents, , unknownRelations] = room.partitionThreadedEvents(matrixEvents);
                    timelineSet.addEventsToTimeline(timelineEvents, backwards, eventTimeline, token);
                    this.processAggregatedTimelineEvents(room, timelineEvents);
                    this.processThreadRoots(
                        room,
                        timelineEvents.filter((it) => it.getServerAggregatedRelation(THREAD_RELATION_TYPE.name)),
                        false,
                    );
                    unknownRelations.forEach((event) => room.relations.aggregateChildEvent(event));

                    const atEnd = res.end === undefined || res.end === res.start;

                    // if we've hit the end of the timeline, we need to stop trying to
                    // paginate. We need to keep the 'forwards' token though, to make sure
                    // we can recover from gappy syncs.
                    if (backwards && atEnd) {
                        eventTimeline.setPaginationToken(null, dir);
                    }
                    return !atEnd;
                })
                .finally(() => {
                    eventTimeline.paginationRequests[dir] = null;
                });
            eventTimeline.paginationRequests[dir] = promise;
        }

        return promise;
    }

    /**
     * Reset the notifTimelineSet entirely, paginating in some historical notifs as
     * a starting point for subsequent pagination.
     */
    public resetNotifTimelineSet(): void {
        if (!this.notifTimelineSet) {
            return;
        }

        // FIXME: This thing is a total hack, and results in duplicate events being
        // added to the timeline both from /sync and /notifications, and lots of
        // slow and wasteful processing and pagination.  The correct solution is to
        // extend /messages or /search or something to filter on notifications.

        // use the fictitious token 'end'. in practice we would ideally give it
        // the oldest backwards pagination token from /sync, but /sync doesn't
        // know about /notifications, so we have no choice but to start paginating
        // from the current point in time.  This may well overlap with historical
        // notifs which are then inserted into the timeline by /sync responses.
        this.notifTimelineSet.resetLiveTimeline("end");

        // we could try to paginate a single event at this point in order to get
        // a more valid pagination token, but it just ends up with an out of order
        // timeline. given what a mess this is and given we're going to have duplicate
        // events anyway, just leave it with the dummy token for now.
        /*
        this.paginateNotifTimeline(this._notifTimelineSet.getLiveTimeline(), {
            backwards: true,
            limit: 1
        });
        */
    }

    /**
     * Peek into a room and receive updates about the room. This only works if the
     * history visibility for the room is world_readable.
     * @param roomId - The room to attempt to peek into.
     * @returns Promise which resolves: Room object
     * @returns Rejects: with an error response.
     */
    public peekInRoom(roomId: string): Promise<Room> {
        this.peekSync?.stopPeeking();
        this.peekSync = new SyncApi(this, this.clientOpts, this.buildSyncApiOptions());
        return this.peekSync.peek(roomId);
    }

    /**
     * Stop any ongoing room peeking.
     */
    public stopPeeking(): void {
        if (this.peekSync) {
            this.peekSync.stopPeeking();
            this.peekSync = null;
        }
    }

    /**
     * Set r/w flags for guest access in a room.
     * @param roomId - The room to configure guest access in.
     * @param opts - Options
     * @returns Promise which resolves
     * @returns Rejects: with an error response.
     */
    public setGuestAccess(roomId: string, opts: IGuestAccessOpts): Promise<void> {
        const writePromise = this.sendStateEvent(
            roomId,
            EventType.RoomGuestAccess,
            {
                guest_access: opts.allowJoin ? "can_join" : "forbidden",
            },
            "",
        );

        let readPromise: Promise<any> = Promise.resolve<any>(undefined);
        if (opts.allowRead) {
            readPromise = this.sendStateEvent(
                roomId,
                EventType.RoomHistoryVisibility,
                {
                    history_visibility: "world_readable",
                },
                "",
            );
        }

        return Promise.all([readPromise, writePromise]).then(); // .then() to hide results for contract
    }

    /**
     * Requests an email verification token for the purposes of registration.
     * This API requests a token from the homeserver.
     * The doesServerRequireIdServerParam() method can be used to determine if
     * the server requires the id_server parameter to be provided.
     *
     * Parameters and return value are as for requestEmailToken

     * @param email - As requestEmailToken
     * @param clientSecret - As requestEmailToken
     * @param sendAttempt - As requestEmailToken
     * @param nextLink - As requestEmailToken
     * @returns Promise which resolves: As requestEmailToken
     */
    public requestRegisterEmailToken(
        email: string,
        clientSecret: string,
        sendAttempt: number,
        nextLink?: string,
    ): Promise<IRequestTokenResponse> {
        return this.requestTokenFromEndpoint("/register/email/requestToken", {
            email: email,
            client_secret: clientSecret,
            send_attempt: sendAttempt,
            next_link: nextLink,
        });
    }

    /**
     * Requests a text message verification token for the purposes of registration.
     * This API requests a token from the homeserver.
     * The doesServerRequireIdServerParam() method can be used to determine if
     * the server requires the id_server parameter to be provided.
     *
     * @param phoneCountry - The ISO 3166-1 alpha-2 code for the country in which
     *    phoneNumber should be parsed relative to.
     * @param phoneNumber - The phone number, in national or international format
     * @param clientSecret - As requestEmailToken
     * @param sendAttempt - As requestEmailToken
     * @param nextLink - As requestEmailToken
     * @returns Promise which resolves: As requestEmailToken
     */
    public requestRegisterMsisdnToken(
        phoneCountry: string,
        phoneNumber: string,
        clientSecret: string,
        sendAttempt: number,
        nextLink?: string,
    ): Promise<IRequestMsisdnTokenResponse> {
        return this.requestTokenFromEndpoint("/register/msisdn/requestToken", {
            country: phoneCountry,
            phone_number: phoneNumber,
            client_secret: clientSecret,
            send_attempt: sendAttempt,
            next_link: nextLink,
        });
    }

    /**
     * Requests an email verification token for the purposes of adding a
     * third party identifier to an account.
     * This API requests a token from the homeserver.
     * The doesServerRequireIdServerParam() method can be used to determine if
     * the server requires the id_server parameter to be provided.
     * If an account with the given email address already exists and is
     * associated with an account other than the one the user is authed as,
     * it will either send an email to the address informing them of this
     * or return M_THREEPID_IN_USE (which one is up to the homeserver).
     *
     * @param email - As requestEmailToken
     * @param clientSecret - As requestEmailToken
     * @param sendAttempt - As requestEmailToken
     * @param nextLink - As requestEmailToken
     * @returns Promise which resolves: As requestEmailToken
     */
    public requestAdd3pidEmailToken(
        email: string,
        clientSecret: string,
        sendAttempt: number,
        nextLink?: string,
    ): Promise<IRequestTokenResponse> {
        return this.requestTokenFromEndpoint("/account/3pid/email/requestToken", {
            email: email,
            client_secret: clientSecret,
            send_attempt: sendAttempt,
            next_link: nextLink,
        });
    }

    /**
     * Requests a text message verification token for the purposes of adding a
     * third party identifier to an account.
     * This API proxies the identity server /validate/email/requestToken API,
     * adding specific behaviour for the addition of phone numbers to an
     * account, as requestAdd3pidEmailToken.
     *
     * @param phoneCountry - As requestRegisterMsisdnToken
     * @param phoneNumber - As requestRegisterMsisdnToken
     * @param clientSecret - As requestEmailToken
     * @param sendAttempt - As requestEmailToken
     * @param nextLink - As requestEmailToken
     * @returns Promise which resolves: As requestEmailToken
     */
    public requestAdd3pidMsisdnToken(
        phoneCountry: string,
        phoneNumber: string,
        clientSecret: string,
        sendAttempt: number,
        nextLink?: string,
    ): Promise<IRequestMsisdnTokenResponse> {
        return this.requestTokenFromEndpoint("/account/3pid/msisdn/requestToken", {
            country: phoneCountry,
            phone_number: phoneNumber,
            client_secret: clientSecret,
            send_attempt: sendAttempt,
            next_link: nextLink,
        });
    }

    /**
     * Requests an email verification token for the purposes of resetting
     * the password on an account.
     * This API proxies the identity server /validate/email/requestToken API,
     * adding specific behaviour for the password resetting. Specifically,
     * if no account with the given email address exists, it may either
     * return M_THREEPID_NOT_FOUND or send an email
     * to the address informing them of this (which one is up to the homeserver).
     *
     * requestEmailToken calls the equivalent API directly on the identity server,
     * therefore bypassing the password reset specific logic.
     *
     * @param email - As requestEmailToken
     * @param clientSecret - As requestEmailToken
     * @param sendAttempt - As requestEmailToken
     * @param nextLink - As requestEmailToken
     * @returns Promise which resolves: As requestEmailToken
     */
    public requestPasswordEmailToken(
        email: string,
        clientSecret: string,
        sendAttempt: number,
        nextLink?: string,
    ): Promise<IRequestTokenResponse> {
        return this.requestTokenFromEndpoint("/account/password/email/requestToken", {
            email: email,
            client_secret: clientSecret,
            send_attempt: sendAttempt,
            next_link: nextLink,
        });
    }

    /**
     * Requests a text message verification token for the purposes of resetting
     * the password on an account.
     * This API proxies the identity server /validate/email/requestToken API,
     * adding specific behaviour for the password resetting, as requestPasswordEmailToken.
     *
     * @param phoneCountry - As requestRegisterMsisdnToken
     * @param phoneNumber - As requestRegisterMsisdnToken
     * @param clientSecret - As requestEmailToken
     * @param sendAttempt - As requestEmailToken
     * @param nextLink - As requestEmailToken
     * @returns Promise which resolves: As requestEmailToken
     */
    public requestPasswordMsisdnToken(
        phoneCountry: string,
        phoneNumber: string,
        clientSecret: string,
        sendAttempt: number,
        nextLink: string,
    ): Promise<IRequestMsisdnTokenResponse> {
        return this.requestTokenFromEndpoint("/account/password/msisdn/requestToken", {
            country: phoneCountry,
            phone_number: phoneNumber,
            client_secret: clientSecret,
            send_attempt: sendAttempt,
            next_link: nextLink,
        });
    }

    /**
     * Internal utility function for requesting validation tokens from usage-specific
     * requestToken endpoints.
     *
     * @param endpoint - The endpoint to send the request to
     * @param params - Parameters for the POST request
     * @returns Promise which resolves: As requestEmailToken
     */
    private async requestTokenFromEndpoint<T extends IRequestTokenResponse>(
        endpoint: string,
        params: Record<string, any>,
    ): Promise<T> {
        const postParams = Object.assign({}, params);

        // If the HS supports separate add and bind, then requestToken endpoints
        // don't need an IS as they are all validated by the HS directly.
        if (!(await this.doesServerSupportSeparateAddAndBind()) && this.idBaseUrl) {
            const idServerUrl = new URL(this.idBaseUrl);
            postParams.id_server = idServerUrl.host;

            if (this.identityServer?.getAccessToken && (await this.doesServerAcceptIdentityAccessToken())) {
                const identityAccessToken = await this.identityServer.getAccessToken();
                if (identityAccessToken) {
                    postParams.id_access_token = identityAccessToken;
                }
            }
        }

        return this.http.request(Method.Post, endpoint, undefined, postParams);
    }

    /**
     * Get the room-kind push rule associated with a room.
     * @param scope - "global" or device-specific.
     * @param roomId - the id of the room.
     * @returns the rule or undefined.
     */
    public getRoomPushRule(scope: "global" | "device", roomId: string): IPushRule | undefined {
        // There can be only room-kind push rule per room
        // and its id is the room id.
        if (this.pushRules) {
            return this.pushRules[scope]?.room?.find((rule) => rule.rule_id === roomId);
        } else {
            throw new Error("SyncApi.sync() must be done before accessing to push rules.");
        }
    }

    /**
     * Set a room-kind muting push rule in a room.
     * The operation also updates MatrixClient.pushRules at the end.
     * @param scope - "global" or device-specific.
     * @param roomId - the id of the room.
     * @param mute - the mute state.
     * @returns Promise which resolves: result object
     * @returns Rejects: with an error response.
     */
    public setRoomMutePushRule(scope: "global" | "device", roomId: string, mute: boolean): Promise<void> | undefined {
        let promise: Promise<unknown> | undefined;
        let hasDontNotifyRule = false;

        // Get the existing room-kind push rule if any
        const roomPushRule = this.getRoomPushRule(scope, roomId);
        if (roomPushRule?.actions.includes(PushRuleActionName.DontNotify)) {
            hasDontNotifyRule = true;
        }

        if (!mute) {
            // Remove the rule only if it is a muting rule
            if (hasDontNotifyRule) {
                promise = this.deletePushRule(scope, PushRuleKind.RoomSpecific, roomPushRule!.rule_id);
            }
        } else {
            if (!roomPushRule) {
                promise = this.addPushRule(scope, PushRuleKind.RoomSpecific, roomId, {
                    actions: [PushRuleActionName.DontNotify],
                });
            } else if (!hasDontNotifyRule) {
                // Remove the existing one before setting the mute push rule
                // This is a workaround to SYN-590 (Push rule update fails)
                const deferred = utils.defer();
                this.deletePushRule(scope, PushRuleKind.RoomSpecific, roomPushRule.rule_id)
                    .then(() => {
                        this.addPushRule(scope, PushRuleKind.RoomSpecific, roomId, {
                            actions: [PushRuleActionName.DontNotify],
                        })
                            .then(() => {
                                deferred.resolve();
                            })
                            .catch((err) => {
                                deferred.reject(err);
                            });
                    })
                    .catch((err) => {
                        deferred.reject(err);
                    });

                promise = deferred.promise;
            }
        }

        if (promise) {
            return new Promise<void>((resolve, reject) => {
                // Update this.pushRules when the operation completes
                promise!
                    .then(() => {
                        this.getPushRules()
                            .then((result) => {
                                this.pushRules = result;
                                resolve();
                            })
                            .catch((err) => {
                                reject(err);
                            });
                    })
                    .catch((err: Error) => {
                        // Update it even if the previous operation fails. This can help the
                        // app to recover when push settings has been modified from another client
                        this.getPushRules()
                            .then((result) => {
                                this.pushRules = result;
                                reject(err);
                            })
                            .catch((err2) => {
                                reject(err);
                            });
                    });
            });
        }
    }

    public searchMessageText(opts: ISearchOpts): Promise<ISearchResponse> {
        const roomEvents: ISearchRequestBody["search_categories"]["room_events"] = {
            search_term: opts.query,
        };

        if ("keys" in opts) {
            roomEvents.keys = opts.keys;
        }

        return this.search({
            body: {
                search_categories: {
                    room_events: roomEvents,
                },
            },
        });
    }

    /**
     * Perform a server-side search for room events.
     *
     * The returned promise resolves to an object containing the fields:
     *
     *  * count:       estimate of the number of results
     *  * next_batch:  token for back-pagination; if undefined, there are no more results
     *  * highlights:  a list of words to highlight from the stemming algorithm
     *  * results:     a list of results
     *
     * Each entry in the results list is a SearchResult.
     *
     * @returns Promise which resolves: result object
     * @returns Rejects: with an error response.
     */
    public searchRoomEvents(opts: IEventSearchOpts): Promise<ISearchResults> {
        // TODO: support search groups

        const body = {
            search_categories: {
                room_events: {
                    search_term: opts.term,
                    filter: opts.filter,
                    order_by: SearchOrderBy.Recent,
                    event_context: {
                        before_limit: 1,
                        after_limit: 1,
                        include_profile: true,
                    },
                },
            },
        };

        const searchResults: ISearchResults = {
            _query: body,
            results: [],
            highlights: [],
        };

        return this.search({ body: body }).then((res) => this.processRoomEventsSearch(searchResults, res));
    }

    /**
     * Take a result from an earlier searchRoomEvents call, and backfill results.
     *
     * @param searchResults -  the results object to be updated
     * @returns Promise which resolves: updated result object
     * @returns Rejects: with an error response.
     */
    public backPaginateRoomEventsSearch<T extends ISearchResults>(searchResults: T): Promise<T> {
        // TODO: we should implement a backoff (as per scrollback()) to deal more
        // nicely with HTTP errors.

        if (!searchResults.next_batch) {
            return Promise.reject(new Error("Cannot backpaginate event search any further"));
        }

        if (searchResults.pendingRequest) {
            // already a request in progress - return the existing promise
            return searchResults.pendingRequest as Promise<T>;
        }

        const searchOpts = {
            body: searchResults._query!,
            next_batch: searchResults.next_batch,
        };

        const promise = this.search(searchOpts, searchResults.abortSignal)
            .then((res) => this.processRoomEventsSearch(searchResults, res))
            .finally(() => {
                searchResults.pendingRequest = undefined;
            });
        searchResults.pendingRequest = promise;

        return promise;
    }

    /**
     * helper for searchRoomEvents and backPaginateRoomEventsSearch. Processes the
     * response from the API call and updates the searchResults
     *
     * @returns searchResults
     * @internal
     */
    // XXX: Intended private, used in code
    public processRoomEventsSearch<T extends ISearchResults>(searchResults: T, response: ISearchResponse): T {
        const roomEvents = response.search_categories.room_events;

        searchResults.count = roomEvents.count;
        searchResults.next_batch = roomEvents.next_batch;

        // combine the highlight list with our existing list;
        const highlights = new Set<string>(roomEvents.highlights);
        searchResults.highlights.forEach((hl) => {
            highlights.add(hl);
        });

        // turn it back into a list.
        searchResults.highlights = Array.from(highlights);

        const mapper = this.getEventMapper();

        // append the new results to our existing results
        const resultsLength = roomEvents.results?.length ?? 0;
        for (let i = 0; i < resultsLength; i++) {
            const sr = SearchResult.fromJson(roomEvents.results[i], mapper);
            const room = this.getRoom(sr.context.getEvent().getRoomId());
            if (room) {
                // Copy over a known event sender if we can
                for (const ev of sr.context.getTimeline()) {
                    const sender = room.getMember(ev.getSender()!);
                    if (!ev.sender && sender) ev.sender = sender;
                }
            }
            searchResults.results.push(sr);
        }
        return searchResults;
    }

    /**
     * Populate the store with rooms the user has left.
     * @returns Promise which resolves: TODO - Resolved when the rooms have
     * been added to the data store.
     * @returns Rejects: with an error response.
     */
    public syncLeftRooms(): Promise<Room[]> {
        // Guard against multiple calls whilst ongoing and multiple calls post success
        if (this.syncedLeftRooms) {
            return Promise.resolve([]); // don't call syncRooms again if it succeeded.
        }
        if (this.syncLeftRoomsPromise) {
            return this.syncLeftRoomsPromise; // return the ongoing request
        }
        const syncApi = new SyncApi(this, this.clientOpts, this.buildSyncApiOptions());
        this.syncLeftRoomsPromise = syncApi.syncLeftRooms();

        // cleanup locks
        this.syncLeftRoomsPromise
            .then(() => {
                logger.log("Marking success of sync left room request");
                this.syncedLeftRooms = true; // flip the bit on success
            })
            .finally(() => {
                this.syncLeftRoomsPromise = undefined; // cleanup ongoing request state
            });

        return this.syncLeftRoomsPromise;
    }

    /**
     * Create a new filter.
     * @param content - The HTTP body for the request
     * @returns Promise which resolves to a Filter object.
     * @returns Rejects: with an error response.
     */
    public createFilter(content: IFilterDefinition): Promise<Filter> {
        const path = utils.encodeUri("/user/$userId/filter", {
            $userId: this.credentials.userId!,
        });
        return this.http.authedRequest<IFilterResponse>(Method.Post, path, undefined, content).then((response) => {
            // persist the filter
            const filter = Filter.fromJson(this.credentials.userId, response.filter_id, content);
            this.store.storeFilter(filter);
            return filter;
        });
    }

    /**
     * Retrieve a filter.
     * @param userId - The user ID of the filter owner
     * @param filterId - The filter ID to retrieve
     * @param allowCached - True to allow cached filters to be returned.
     * Default: True.
     * @returns Promise which resolves: a Filter object
     * @returns Rejects: with an error response.
     */
    public getFilter(userId: string, filterId: string, allowCached: boolean): Promise<Filter> {
        if (allowCached) {
            const filter = this.store.getFilter(userId, filterId);
            if (filter) {
                return Promise.resolve(filter);
            }
        }

        const path = utils.encodeUri("/user/$userId/filter/$filterId", {
            $userId: userId,
            $filterId: filterId,
        });

        return this.http.authedRequest<IFilterDefinition>(Method.Get, path).then((response) => {
            // persist the filter
            const filter = Filter.fromJson(userId, filterId, response);
            this.store.storeFilter(filter);
            return filter;
        });
    }

    /**
     * @returns Filter ID
     */
    public async getOrCreateFilter(filterName: string, filter: Filter): Promise<string> {
        const filterId = this.store.getFilterIdByName(filterName);
        let existingId: string | undefined;

        if (filterId) {
            // check that the existing filter matches our expectations
            try {
                const existingFilter = await this.getFilter(this.credentials.userId!, filterId, true);
                if (existingFilter) {
                    const oldDef = existingFilter.getDefinition();
                    const newDef = filter.getDefinition();

                    if (utils.deepCompare(oldDef, newDef)) {
                        // super, just use that.
                        // debuglog("Using existing filter ID %s: %s", filterId,
                        //          JSON.stringify(oldDef));
                        existingId = filterId;
                    }
                }
            } catch (error) {
                // Synapse currently returns the following when the filter cannot be found:
                // {
                //     errcode: "M_UNKNOWN",
                //     name: "M_UNKNOWN",
                //     message: "No row found",
                // }
                if ((<MatrixError>error).errcode !== "M_UNKNOWN" && (<MatrixError>error).errcode !== "M_NOT_FOUND") {
                    throw error;
                }
            }
            // if the filter doesn't exist anymore on the server, remove from store
            if (!existingId) {
                this.store.setFilterIdByName(filterName, undefined);
            }
        }

        if (existingId) {
            return existingId;
        }

        // create a new filter
        const createdFilter = await this.createFilter(filter.getDefinition());

        this.store.setFilterIdByName(filterName, createdFilter.filterId);
        return createdFilter.filterId!;
    }

    /**
     * Gets a bearer token from the homeserver that the user can
     * present to a third party in order to prove their ownership
     * of the Matrix account they are logged into.
     * @returns Promise which resolves: Token object
     * @returns Rejects: with an error response.
     */
    public getOpenIdToken(): Promise<IOpenIDToken> {
        const path = utils.encodeUri("/user/$userId/openid/request_token", {
            $userId: this.credentials.userId!,
        });

        return this.http.authedRequest(Method.Post, path, undefined, {});
    }

    private startCallEventHandler = (): void => {
        if (this.isInitialSyncComplete()) {
            this.callEventHandler!.start();
            this.groupCallEventHandler!.start();
            this.off(ClientEvent.Sync, this.startCallEventHandler);
        }
    };

    /**
     * Once the client has been initialised, we want to clear notifications we
     * know for a fact should be here.
     * This issue should also be addressed on synapse's side and is tracked as part
     * of https://github.com/matrix-org/synapse/issues/14837
     *
     * We consider a room or a thread as fully read if the current user has sent
     * the last event in the live timeline of that context and if the read receipt
     * we have on record matches.
     */
    private fixupRoomNotifications = (): void => {
        if (this.isInitialSyncComplete()) {
            const unreadRooms = (this.getRooms() ?? []).filter((room) => {
                return room.getUnreadNotificationCount(NotificationCountType.Total) > 0;
            });

            for (const room of unreadRooms) {
                const currentUserId = this.getSafeUserId();
                room.fixupNotifications(currentUserId);
            }

            this.off(ClientEvent.Sync, this.fixupRoomNotifications);
        }
    };

    /**
     * @returns Promise which resolves: ITurnServerResponse object
     * @returns Rejects: with an error response.
     */
    public turnServer(): Promise<ITurnServerResponse> {
        return this.http.authedRequest(Method.Get, "/voip/turnServer");
    }

    /**
     * Get the TURN servers for this homeserver.
     * @returns The servers or an empty list.
     */
    public getTurnServers(): ITurnServer[] {
        return this.turnServers || [];
    }

    /**
     * Get the unix timestamp (in milliseconds) at which the current
     * TURN credentials (from getTurnServers) expire
     * @returns The expiry timestamp in milliseconds
     */
    public getTurnServersExpiry(): number {
        return this.turnServersExpiry;
    }

    public get pollingTurnServers(): boolean {
        return this.checkTurnServersIntervalID !== undefined;
    }

    // XXX: Intended private, used in code.
    public async checkTurnServers(): Promise<boolean | undefined> {
        if (!this.canSupportVoip) {
            return;
        }

        let credentialsGood = false;
        const remainingTime = this.turnServersExpiry - Date.now();
        if (remainingTime > TURN_CHECK_INTERVAL) {
            logger.debug("TURN creds are valid for another " + remainingTime + " ms: not fetching new ones.");
            credentialsGood = true;
        } else {
            logger.debug("Fetching new TURN credentials");
            try {
                const res = await this.turnServer();
                if (res.uris) {
                    logger.log("Got TURN URIs: " + res.uris + " refresh in " + res.ttl + " secs");
                    // map the response to a format that can be fed to RTCPeerConnection
                    const servers: ITurnServer = {
                        urls: res.uris,
                        username: res.username,
                        credential: res.password,
                    };
                    this.turnServers = [servers];
                    // The TTL is in seconds but we work in ms
                    this.turnServersExpiry = Date.now() + res.ttl * 1000;
                    credentialsGood = true;
                    this.emit(ClientEvent.TurnServers, this.turnServers);
                }
            } catch (err) {
                logger.error("Failed to get TURN URIs", err);
                if ((<HTTPError>err).httpStatus === 403) {
                    // We got a 403, so there's no point in looping forever.
                    logger.info("TURN access unavailable for this account: stopping credentials checks");
                    if (this.checkTurnServersIntervalID !== null) global.clearInterval(this.checkTurnServersIntervalID);
                    this.checkTurnServersIntervalID = undefined;
                    this.emit(ClientEvent.TurnServersError, <HTTPError>err, true); // fatal
                } else {
                    // otherwise, if we failed for whatever reason, try again the next time we're called.
                    this.emit(ClientEvent.TurnServersError, <Error>err, false); // non-fatal
                }
            }
        }

        return credentialsGood;
    }

    /**
     * Set whether to allow a fallback ICE server should be used for negotiating a
     * WebRTC connection if the homeserver doesn't provide any servers. Defaults to
     * false.
     *
     */
    public setFallbackICEServerAllowed(allow: boolean): void {
        this.fallbackICEServerAllowed = allow;
    }

    /**
     * Get whether to allow a fallback ICE server should be used for negotiating a
     * WebRTC connection if the homeserver doesn't provide any servers. Defaults to
     * false.
     *
     * @returns
     */
    public isFallbackICEServerAllowed(): boolean {
        return this.fallbackICEServerAllowed;
    }

    /**
     * Determines if the current user is an administrator of the Synapse homeserver.
     * Returns false if untrue or the homeserver does not appear to be a Synapse
     * homeserver. <strong>This function is implementation specific and may change
     * as a result.</strong>
     * @returns true if the user appears to be a Synapse administrator.
     */
    public isSynapseAdministrator(): Promise<boolean> {
        const path = utils.encodeUri("/_synapse/admin/v1/users/$userId/admin", { $userId: this.getUserId()! });
        return this.http
            .authedRequest<{ admin: boolean }>(Method.Get, path, undefined, undefined, { prefix: "" })
            .then((r) => r.admin); // pull out the specific boolean we want
    }

    /**
     * Performs a whois lookup on a user using Synapse's administrator API.
     * <strong>This function is implementation specific and may change as a
     * result.</strong>
     * @param userId - the User ID to look up.
     * @returns the whois response - see Synapse docs for information.
     */
    public whoisSynapseUser(userId: string): Promise<ISynapseAdminWhoisResponse> {
        const path = utils.encodeUri("/_synapse/admin/v1/whois/$userId", { $userId: userId });
        return this.http.authedRequest(Method.Get, path, undefined, undefined, { prefix: "" });
    }

    /**
     * Deactivates a user using Synapse's administrator API. <strong>This
     * function is implementation specific and may change as a result.</strong>
     * @param userId - the User ID to deactivate.
     * @returns the deactivate response - see Synapse docs for information.
     */
    public deactivateSynapseUser(userId: string): Promise<ISynapseAdminDeactivateResponse> {
        const path = utils.encodeUri("/_synapse/admin/v1/deactivate/$userId", { $userId: userId });
        return this.http.authedRequest(Method.Post, path, undefined, undefined, { prefix: "" });
    }

    private async fetchClientWellKnown(): Promise<void> {
        // `getRawClientConfig` does not throw or reject on network errors, instead
        // it absorbs errors and returns `{}`.
        this.clientWellKnownPromise = AutoDiscovery.getRawClientConfig(this.getDomain() ?? undefined);
        this.clientWellKnown = await this.clientWellKnownPromise;
        this.emit(ClientEvent.ClientWellKnown, this.clientWellKnown);
    }

    public getClientWellKnown(): IClientWellKnown | undefined {
        return this.clientWellKnown;
    }

    public waitForClientWellKnown(): Promise<IClientWellKnown> {
        if (!this.clientRunning) {
            throw new Error("Client is not running");
        }
        return this.clientWellKnownPromise!;
    }

    /**
     * store client options with boolean/string/numeric values
     * to know in the next session what flags the sync data was
     * created with (e.g. lazy loading)
     * @param opts - the complete set of client options
     * @returns for store operation
     */
    public storeClientOptions(): Promise<void> {
        // XXX: Intended private, used in code
        const primTypes = ["boolean", "string", "number"];
        const serializableOpts = Object.entries(this.clientOpts!)
            .filter(([key, value]) => {
                return primTypes.includes(typeof value);
            })
            .reduce<Record<string, any>>((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});
        return this.store.storeClientOptions(serializableOpts);
    }

    /**
     * Gets a set of room IDs in common with another user.
     *
     * Note: This endpoint is unstable, and can throw an `Error`.
     *   Check progress on [MSC2666](https://github.com/matrix-org/matrix-spec-proposals/pull/2666) for more details.
     *
     * @param userId - The userId to check.
     * @returns Promise which resolves to an array of rooms
     * @returns Rejects: with an error response.
     */
    // TODO: on spec release, rename this to getMutualRooms
    // eslint-disable-next-line
    public async _unstable_getSharedRooms(userId: string): Promise<string[]> {
        // Initial variant of the MSC
        const sharedRoomsSupport = await this.doesServerSupportUnstableFeature(UNSTABLE_MSC2666_SHARED_ROOMS);

        // Newer variant that renamed shared rooms to mutual rooms
        const mutualRoomsSupport = await this.doesServerSupportUnstableFeature(UNSTABLE_MSC2666_MUTUAL_ROOMS);

        // Latest variant that changed from path elements to query elements
        const queryMutualRoomsSupport = await this.doesServerSupportUnstableFeature(
            UNSTABLE_MSC2666_QUERY_MUTUAL_ROOMS,
        );

        if (!sharedRoomsSupport && !mutualRoomsSupport && !queryMutualRoomsSupport) {
            throw Error("Server does not support the Mutual Rooms API");
        }

        let path;
        let query;

        // Cascading unstable support switching.
        if (queryMutualRoomsSupport) {
            path = "/uk.half-shot.msc2666/user/mutual_rooms";
            query = { user_id: userId };
        } else {
            path = utils.encodeUri(
                `/uk.half-shot.msc2666/user/${mutualRoomsSupport ? "mutual_rooms" : "shared_rooms"}/$userId`,
                { $userId: userId },
            );
            query = {};
        }

        // Accumulated rooms
        const rooms: string[] = [];
        let token = null;

        do {
            const tokenQuery: Record<string, string> = {};
            if (token != null && queryMutualRoomsSupport) {
                tokenQuery["batch_token"] = token;
            }

            const res = await this.http.authedRequest<{
                joined: string[];
                next_batch_token?: string;
            }>(Method.Get, path, { ...query, ...tokenQuery }, undefined, {
                prefix: ClientPrefix.Unstable,
            });

            rooms.push(...res.joined);

            if (res.next_batch_token !== undefined) {
                token = res.next_batch_token;
            } else {
                token = null;
            }
        } while (token != null);

        return rooms;
    }

    /**
     * Get the API versions supported by the server, along with any
     * unstable APIs it supports
     * @returns The server /versions response
     */
    public async getVersions(): Promise<IServerVersions> {
        if (this.serverVersionsPromise) {
            return this.serverVersionsPromise;
        }

        this.serverVersionsPromise = this.http
            .request<IServerVersions>(
                Method.Get,
                "/_matrix/client/versions",
                undefined, // queryParams
                undefined, // data
                {
                    prefix: "",
                },
            )
            .catch((e) => {
                // Need to unset this if it fails, otherwise we'll never retry
                this.serverVersionsPromise = undefined;
                // but rethrow the exception to anything that was waiting
                throw e;
            });

        const serverVersions = await this.serverVersionsPromise;
        this.canSupport = await buildFeatureSupportMap(serverVersions);

        return this.serverVersionsPromise;
    }

    /**
     * Check if a particular spec version is supported by the server.
     * @param version - The spec version (such as "r0.5.0") to check for.
     * @returns Whether it is supported
     */
    public async isVersionSupported(version: string): Promise<boolean> {
        const { versions } = await this.getVersions();
        return versions && versions.includes(version);
    }

    /**
     * Query the server to see if it supports members lazy loading
     * @returns true if server supports lazy loading
     */
    public async doesServerSupportLazyLoading(): Promise<boolean> {
        const response = await this.getVersions();
        if (!response) return false;

        const versions = response["versions"];
        const unstableFeatures = response["unstable_features"];

        return (
            (versions && versions.includes("r0.5.0")) || (unstableFeatures && unstableFeatures["m.lazy_load_members"])
        );
    }

    /**
     * Query the server to see if the `id_server` parameter is required
     * when registering with an 3pid, adding a 3pid or resetting password.
     * @returns true if id_server parameter is required
     */
    public async doesServerRequireIdServerParam(): Promise<boolean> {
        const response = await this.getVersions();
        if (!response) return true;

        const versions = response["versions"];

        // Supporting r0.6.0 is the same as having the flag set to false
        if (versions && versions.includes("r0.6.0")) {
            return false;
        }

        const unstableFeatures = response["unstable_features"];
        if (!unstableFeatures) return true;
        if (unstableFeatures["m.require_identity_server"] === undefined) {
            return true;
        } else {
            return unstableFeatures["m.require_identity_server"];
        }
    }

    /**
     * Query the server to see if the `id_access_token` parameter can be safely
     * passed to the homeserver. Some homeservers may trigger errors if they are not
     * prepared for the new parameter.
     * @returns true if id_access_token can be sent
     */
    public async doesServerAcceptIdentityAccessToken(): Promise<boolean> {
        const response = await this.getVersions();
        if (!response) return false;

        const versions = response["versions"];
        const unstableFeatures = response["unstable_features"];
        return (versions && versions.includes("r0.6.0")) || (unstableFeatures && unstableFeatures["m.id_access_token"]);
    }

    /**
     * Query the server to see if it supports separate 3PID add and bind functions.
     * This affects the sequence of API calls clients should use for these operations,
     * so it's helpful to be able to check for support.
     * @returns true if separate functions are supported
     */
    public async doesServerSupportSeparateAddAndBind(): Promise<boolean> {
        const response = await this.getVersions();
        if (!response) return false;

        const versions = response["versions"];
        const unstableFeatures = response["unstable_features"];

        return versions?.includes("r0.6.0") || unstableFeatures?.["m.separate_add_and_bind"];
    }

    /**
     * Query the server to see if it lists support for an unstable feature
     * in the /versions response
     * @param feature - the feature name
     * @returns true if the feature is supported
     */
    public async doesServerSupportUnstableFeature(feature: string): Promise<boolean> {
        const response = await this.getVersions();
        if (!response) return false;
        const unstableFeatures = response["unstable_features"];
        return unstableFeatures && !!unstableFeatures[feature];
    }

    /**
     * Query the server to see if it is forcing encryption to be enabled for
     * a given room preset, based on the /versions response.
     * @param presetName - The name of the preset to check.
     * @returns true if the server is forcing encryption
     * for the preset.
     */
    public async doesServerForceEncryptionForPreset(presetName: Preset): Promise<boolean> {
        const response = await this.getVersions();
        if (!response) return false;
        const unstableFeatures = response["unstable_features"];

        // The preset name in the versions response will be without the _chat suffix.
        const versionsPresetName = presetName.includes("_chat")
            ? presetName.substring(0, presetName.indexOf("_chat"))
            : presetName;

        return unstableFeatures && !!unstableFeatures[`io.element.e2ee_forced.${versionsPresetName}`];
    }

    public async doesServerSupportThread(): Promise<{
        threads: FeatureSupport;
        list: FeatureSupport;
        fwdPagination: FeatureSupport;
    }> {
        if (await this.isVersionSupported("v1.4")) {
            return {
                threads: FeatureSupport.Stable,
                list: FeatureSupport.Stable,
                fwdPagination: FeatureSupport.Stable,
            };
        }

        try {
            const [threadUnstable, threadStable, listUnstable, listStable, fwdPaginationUnstable, fwdPaginationStable] =
                await Promise.all([
                    this.doesServerSupportUnstableFeature("org.matrix.msc3440"),
                    this.doesServerSupportUnstableFeature("org.matrix.msc3440.stable"),
                    this.doesServerSupportUnstableFeature("org.matrix.msc3856"),
                    this.doesServerSupportUnstableFeature("org.matrix.msc3856.stable"),
                    this.doesServerSupportUnstableFeature("org.matrix.msc3715"),
                    this.doesServerSupportUnstableFeature("org.matrix.msc3715.stable"),
                ]);

            return {
                threads: determineFeatureSupport(threadStable, threadUnstable),
                list: determineFeatureSupport(listStable, listUnstable),
                fwdPagination: determineFeatureSupport(fwdPaginationStable, fwdPaginationUnstable),
            };
        } catch (e) {
            return {
                threads: FeatureSupport.None,
                list: FeatureSupport.None,
                fwdPagination: FeatureSupport.None,
            };
        }
    }

    /**
     * Query the server to see if it supports the MSC2457 `logout_devices` parameter when setting password
     * @returns true if server supports the `logout_devices` parameter
     */
    public doesServerSupportLogoutDevices(): Promise<boolean> {
        return this.isVersionSupported("r0.6.1");
    }

    /**
     * Get if lazy loading members is being used.
     * @returns Whether or not members are lazy loaded by this client
     */
    public hasLazyLoadMembersEnabled(): boolean {
        return !!this.clientOpts?.lazyLoadMembers;
    }

    /**
     * Set a function which is called when /sync returns a 'limited' response.
     * It is called with a room ID and returns a boolean. It should return 'true' if the SDK
     * can SAFELY remove events from this room. It may not be safe to remove events if there
     * are other references to the timelines for this room, e.g because the client is
     * actively viewing events in this room.
     * Default: returns false.
     * @param cb - The callback which will be invoked.
     */
    public setCanResetTimelineCallback(cb: ResetTimelineCallback): void {
        this.canResetTimelineCallback = cb;
    }

    /**
     * Get the callback set via `setCanResetTimelineCallback`.
     * @returns The callback or null
     */
    public getCanResetTimelineCallback(): ResetTimelineCallback | undefined {
        return this.canResetTimelineCallback;
    }

    /**
     * Returns relations for a given event. Handles encryption transparently,
     * with the caveat that the amount of events returned might be 0, even though you get a nextBatch.
     * When the returned promise resolves, all messages should have finished trying to decrypt.
     * @param roomId - the room of the event
     * @param eventId - the id of the event
     * @param relationType - the rel_type of the relations requested
     * @param eventType - the event type of the relations requested
     * @param opts - options with optional values for the request.
     * @returns an object with `events` as `MatrixEvent[]` and optionally `nextBatch` if more relations are available.
     */
    public async relations(
        roomId: string,
        eventId: string,
        relationType?: RelationType | string | null,
        eventType?: EventType | string | null,
        opts: IRelationsRequestOpts = { dir: Direction.Backward },
    ): Promise<{
        originalEvent?: MatrixEvent | null;
        events: MatrixEvent[];
        nextBatch?: string | null;
        prevBatch?: string | null;
    }> {
        const fetchedEventType = eventType ? this.getEncryptedIfNeededEventType(roomId, eventType) : null;
        const [eventResult, result] = await Promise.all([
            this.fetchRoomEvent(roomId, eventId),
            this.fetchRelations(roomId, eventId, relationType, fetchedEventType, opts),
        ]);
        const mapper = this.getEventMapper();

        const originalEvent = eventResult ? mapper(eventResult) : undefined;
        let events = result.chunk.map(mapper);

        if (fetchedEventType === EventType.RoomMessageEncrypted) {
            const allEvents = originalEvent ? events.concat(originalEvent) : events;
            await Promise.all(allEvents.map((e) => this.decryptEventIfNeeded(e)));
            if (eventType !== null) {
                events = events.filter((e) => e.getType() === eventType);
            }
        }

        if (originalEvent && relationType === RelationType.Replace) {
            events = events.filter((e) => e.getSender() === originalEvent.getSender());
        }
        return {
            originalEvent: originalEvent ?? null,
            events,
            nextBatch: result.next_batch ?? null,
            prevBatch: result.prev_batch ?? null,
        };
    }

    /**
     * The app may wish to see if we have a key cached without
     * triggering a user interaction.
     */
    public getCrossSigningCacheCallbacks(): ICacheCallbacks | undefined {
        // XXX: Private member access
        return this.crypto?.crossSigningInfo.getCacheCallbacks();
    }

    /**
     * Generates a random string suitable for use as a client secret. <strong>This
     * method is experimental and may change.</strong>
     * @returns A new client secret
     */
    public generateClientSecret(): string {
        return randomString(32);
    }

    /**
     * Attempts to decrypt an event
     * @param event - The event to decrypt
     * @returns A decryption promise
     */
    public decryptEventIfNeeded(event: MatrixEvent, options?: IDecryptOptions): Promise<void> {
        if (event.shouldAttemptDecryption() && this.isCryptoEnabled()) {
            event.attemptDecryption(this.cryptoBackend!, options);
        }

        if (event.isBeingDecrypted()) {
            return event.getDecryptionPromise()!;
        } else {
            return Promise.resolve();
        }
    }

    private termsUrlForService(serviceType: SERVICE_TYPES, baseUrl: string): URL {
        switch (serviceType) {
            case SERVICE_TYPES.IS:
                return this.http.getUrl("/terms", undefined, IdentityPrefix.V2, baseUrl);
            case SERVICE_TYPES.IM:
                return this.http.getUrl("/terms", undefined, "/_matrix/integrations/v1", baseUrl);
            default:
                throw new Error("Unsupported service type");
        }
    }

    /**
     * Get the Homeserver URL of this client
     * @returns Homeserver URL of this client
     */
    public getHomeserverUrl(): string {
        return this.baseUrl;
    }

    /**
     * Get the identity server URL of this client
     * @param stripProto - whether or not to strip the protocol from the URL
     * @returns Identity server URL of this client
     */
    public getIdentityServerUrl(stripProto = false): string | undefined {
        if (stripProto && (this.idBaseUrl?.startsWith("http://") || this.idBaseUrl?.startsWith("https://"))) {
            return this.idBaseUrl.split("://")[1];
        }
        return this.idBaseUrl;
    }

    /**
     * Set the identity server URL of this client
     * @param url - New identity server URL
     */
    public setIdentityServerUrl(url?: string): void {
        this.idBaseUrl = utils.ensureNoTrailingSlash(url);
        this.http.setIdBaseUrl(this.idBaseUrl);
    }

    /**
     * Get the access token associated with this account.
     * @returns The access_token or null
     */
    public getAccessToken(): string | null {
        return this.http.opts.accessToken || null;
    }

    /**
     * Set the access token associated with this account.
     * @param token - The new access token.
     */
    public setAccessToken(token: string): void {
        this.http.opts.accessToken = token;
    }

    /**
     * @returns true if there is a valid access_token for this client.
     */
    public isLoggedIn(): boolean {
        return this.http.opts.accessToken !== undefined;
    }

    /**
     * Make up a new transaction id
     *
     * @returns a new, unique, transaction id
     */
    public makeTxnId(): string {
        return "m" + new Date().getTime() + "." + this.txnCtr++;
    }

    /**
     * Check whether a username is available prior to registration. An error response
     * indicates an invalid/unavailable username.
     * @param username - The username to check the availability of.
     * @returns Promise which resolves: to boolean of whether the username is available.
     */
    public isUsernameAvailable(username: string): Promise<boolean> {
        return this.http
            .authedRequest<{ available: true }>(Method.Get, "/register/available", { username })
            .then((response) => {
                return response.available;
            })
            .catch((response) => {
                if (response.errcode === "M_USER_IN_USE") {
                    return false;
                }
                return Promise.reject(response);
            });
    }

    /**
     * @param bindThreepids - Set key 'email' to true to bind any email
     *     threepid uses during registration in the identity server. Set 'msisdn' to
     *     true to bind msisdn.
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public register(
        username: string,
        password: string,
        sessionId: string | null,
        auth: { session?: string; type: string },
        bindThreepids?: boolean | null | { email?: boolean; msisdn?: boolean },
        guestAccessToken?: string,
        inhibitLogin?: boolean,
    ): Promise<IAuthData> {
        // backwards compat
        if (bindThreepids === true) {
            bindThreepids = { email: true };
        } else if (bindThreepids === null || bindThreepids === undefined || bindThreepids === false) {
            bindThreepids = {};
        }
        if (sessionId) {
            auth.session = sessionId;
        }

        const params: IRegisterRequestParams = {
            auth: auth,
            refresh_token: true, // always ask for a refresh token - does nothing if unsupported
        };
        if (username !== undefined && username !== null) {
            params.username = username;
        }
        if (password !== undefined && password !== null) {
            params.password = password;
        }
        if (bindThreepids.email) {
            params.bind_email = true;
        }
        if (bindThreepids.msisdn) {
            params.bind_msisdn = true;
        }
        if (guestAccessToken !== undefined && guestAccessToken !== null) {
            params.guest_access_token = guestAccessToken;
        }
        if (inhibitLogin !== undefined && inhibitLogin !== null) {
            params.inhibit_login = inhibitLogin;
        }
        // Temporary parameter added to make the register endpoint advertise
        // msisdn flows. This exists because there are clients that break
        // when given stages they don't recognise. This parameter will cease
        // to be necessary once these old clients are gone.
        // Only send it if we send any params at all (the password param is
        // mandatory, so if we send any params, we'll send the password param)
        if (password !== undefined && password !== null) {
            params.x_show_msisdn = true;
        }

        return this.registerRequest(params);
    }

    /**
     * Register a guest account.
     * This method returns the auth info needed to create a new authenticated client,
     * Remember to call `setGuest(true)` on the (guest-)authenticated client, e.g:
     * ```javascript
     * const tmpClient = await sdk.createClient(MATRIX_INSTANCE);
     * const { user_id, device_id, access_token } = tmpClient.registerGuest();
     * const client = createClient({
     *   baseUrl: MATRIX_INSTANCE,
     *   accessToken: access_token,
     *   userId: user_id,
     *   deviceId: device_id,
     * })
     * client.setGuest(true);
     * ```
     *
     * @param body - JSON HTTP body to provide.
     * @returns Promise which resolves: JSON object that contains:
     *                   `{ user_id, device_id, access_token, home_server }`
     * @returns Rejects: with an error response.
     */
    public registerGuest({ body }: { body?: any } = {}): Promise<any> {
        // TODO: Types
        return this.registerRequest(body || {}, "guest");
    }

    /**
     * @param data - parameters for registration request
     * @param kind - type of user to register. may be "guest"
     * @returns Promise which resolves: to the /register response
     * @returns Rejects: with an error response.
     */
    public registerRequest(data: IRegisterRequestParams, kind?: string): Promise<IAuthData> {
        const params: { kind?: string } = {};
        if (kind) {
            params.kind = kind;
        }

        return this.http.request(Method.Post, "/register", params, data);
    }

    /**
     * Refreshes an access token using a provided refresh token. The refresh token
     * must be valid for the current access token known to the client instance.
     *
     * Note that this function will not cause a logout if the token is deemed
     * unknown by the server - the caller is responsible for managing logout
     * actions on error.
     * @param refreshToken - The refresh token.
     * @returns Promise which resolves to the new token.
     * @returns Rejects with an error response.
     */
    public refreshToken(refreshToken: string): Promise<IRefreshTokenResponse> {
        const performRefreshRequestWithPrefix = (prefix: ClientPrefix): Promise<IRefreshTokenResponse> =>
            this.http.authedRequest(
                Method.Post,
                "/refresh",
                undefined,
                { refresh_token: refreshToken },
                {
                    prefix,
                    inhibitLogoutEmit: true, // we don't want to cause logout loops
                },
            );

        // First try with the (specced) /v3/ prefix.
        // However, before Synapse 1.72.0, Synapse incorrectly required a /v1/ prefix, so we fall
        // back to that if the request fails, for backwards compatibility.
        return performRefreshRequestWithPrefix(ClientPrefix.V3).catch((e) => {
            if (e.errcode === "M_UNRECOGNIZED") {
                return performRefreshRequestWithPrefix(ClientPrefix.V1);
            }
            throw e;
        });
    }

    /**
     * @returns Promise which resolves to the available login flows
     * @returns Rejects: with an error response.
     */
    public loginFlows(): Promise<ILoginFlowsResponse> {
        return this.http.request(Method.Get, "/login");
    }

    /**
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public login(loginType: string, data: any): Promise<any> {
        // TODO: Types
        const loginData = {
            type: loginType,
        };

        // merge data into loginData
        Object.assign(loginData, data);

        return this.http
            .authedRequest<{
                access_token?: string;
                user_id?: string;
            }>(Method.Post, "/login", undefined, loginData)
            .then((response) => {
                if (response.access_token && response.user_id) {
                    this.http.opts.accessToken = response.access_token;
                    this.credentials = {
                        userId: response.user_id,
                    };
                }
                return response;
            });
    }

    /**
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public loginWithPassword(user: string, password: string): Promise<any> {
        // TODO: Types
        return this.login("m.login.password", {
            user: user,
            password: password,
        });
    }

    /**
     * @param relayState - URL Callback after SAML2 Authentication
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public loginWithSAML2(relayState: string): Promise<any> {
        // TODO: Types
        return this.login("m.login.saml2", {
            relay_state: relayState,
        });
    }

    /**
     * @param redirectUrl - The URL to redirect to after the HS
     * authenticates with CAS.
     * @returns The HS URL to hit to begin the CAS login process.
     */
    public getCasLoginUrl(redirectUrl: string): string {
        return this.getSsoLoginUrl(redirectUrl, "cas");
    }

    /**
     * @param redirectUrl - The URL to redirect to after the HS
     *     authenticates with the SSO.
     * @param loginType - The type of SSO login we are doing (sso or cas).
     *     Defaults to 'sso'.
     * @param idpId - The ID of the Identity Provider being targeted, optional.
     * @param action - the SSO flow to indicate to the IdP, optional.
     * @returns The HS URL to hit to begin the SSO login process.
     */
    public getSsoLoginUrl(redirectUrl: string, loginType = "sso", idpId?: string, action?: SSOAction): string {
        let url = "/login/" + loginType + "/redirect";
        if (idpId) {
            url += "/" + idpId;
        }

        const params = {
            redirectUrl,
            [SSO_ACTION_PARAM.unstable!]: action,
        };

        return this.http.getUrl(url, params, ClientPrefix.R0).href;
    }

    /**
     * @param token - Login token previously received from homeserver
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public loginWithToken(token: string): Promise<any> {
        // TODO: Types
        return this.login("m.login.token", {
            token: token,
        });
    }

    /**
     * Logs out the current session.
     * Obviously, further calls that require authorisation should fail after this
     * method is called. The state of the MatrixClient object is not affected:
     * it is up to the caller to either reset or destroy the MatrixClient after
     * this method succeeds.
     * @param stopClient - whether to stop the client before calling /logout to prevent invalid token errors.
     * @returns Promise which resolves: On success, the empty object `{}`
     */
    public async logout(stopClient = false): Promise<{}> {
        if (this.crypto?.backupManager?.getKeyBackupEnabled()) {
            try {
                while ((await this.crypto.backupManager.backupPendingKeys(200)) > 0);
            } catch (err) {
                logger.error("Key backup request failed when logging out. Some keys may be missing from backup", err);
            }
        }

        if (stopClient) {
            this.stopClient();
            this.http.abort();
        }

        return this.http.authedRequest(Method.Post, "/logout");
    }

    /**
     * Deactivates the logged-in account.
     * Obviously, further calls that require authorisation should fail after this
     * method is called. The state of the MatrixClient object is not affected:
     * it is up to the caller to either reset or destroy the MatrixClient after
     * this method succeeds.
     * @param auth - Optional. Auth data to supply for User-Interactive auth.
     * @param erase - Optional. If set, send as `erase` attribute in the
     * JSON request body, indicating whether the account should be erased. Defaults
     * to false.
     * @returns Promise which resolves: On success, the empty object
     */
    public deactivateAccount(auth?: any, erase?: boolean): Promise<{}> {
        const body: any = {};
        if (auth) {
            body.auth = auth;
        }
        if (erase !== undefined) {
            body.erase = erase;
        }

        return this.http.authedRequest(Method.Post, "/account/deactivate", undefined, body);
    }

    /**
     * Make a request for an `m.login.token` to be issued as per
     * [MSC3882](https://github.com/matrix-org/matrix-spec-proposals/pull/3882).
     * The server may require User-Interactive auth.
     * Note that this is UNSTABLE and subject to breaking changes without notice.
     * @param auth - Optional. Auth data to supply for User-Interactive auth.
     * @returns Promise which resolves: On success, the token response
     * or UIA auth data.
     */
    public async requestLoginToken(auth?: IAuthDict): Promise<UIAResponse<LoginTokenPostResponse>> {
        // use capabilities to determine which revision of the MSC is being used
        const capabilities = await this.getCapabilities();
        // use r1 endpoint if capability is exposed otherwise use old r0 endpoint
        const endpoint = UNSTABLE_MSC3882_CAPABILITY.findIn(capabilities)
            ? "/org.matrix.msc3882/login/get_token" // r1 endpoint
            : "/org.matrix.msc3882/login/token"; // r0 endpoint

        const body: UIARequest<{}> = { auth };
        const res = await this.http.authedRequest<UIAResponse<LoginTokenPostResponse>>(
            Method.Post,
            endpoint,
            undefined, // no query params
            body,
            { prefix: ClientPrefix.Unstable },
        );

        // the representation of expires_in changed from revision 0 to revision 1 so we populate
        if ("login_token" in res) {
            if (typeof res.expires_in_ms === "number") {
                res.expires_in = Math.floor(res.expires_in_ms / 1000);
            } else if (typeof res.expires_in === "number") {
                res.expires_in_ms = res.expires_in * 1000;
            }
        }

        return res;
    }

    /**
     * Get the fallback URL to use for unknown interactive-auth stages.
     *
     * @param loginType -     the type of stage being attempted
     * @param authSessionId - the auth session ID provided by the homeserver
     *
     * @returns HS URL to hit to for the fallback interface
     */
    public getFallbackAuthUrl(loginType: string, authSessionId: string): string {
        const path = utils.encodeUri("/auth/$loginType/fallback/web", {
            $loginType: loginType,
        });

        return this.http.getUrl(
            path,
            {
                session: authSessionId,
            },
            ClientPrefix.R0,
        ).href;
    }

    /**
     * Create a new room.
     * @param options - a list of options to pass to the /createRoom API.
     * @returns Promise which resolves: `{room_id: {string}}`
     * @returns Rejects: with an error response.
     */
    public async createRoom(options: ICreateRoomOpts): Promise<{ room_id: string }> {
        // eslint-disable-line camelcase
        // some valid options include: room_alias_name, visibility, invite

        // inject the id_access_token if inviting 3rd party addresses
        const invitesNeedingToken = (options.invite_3pid || []).filter((i) => !i.id_access_token);
        if (
            invitesNeedingToken.length > 0 &&
            this.identityServer?.getAccessToken &&
            (await this.doesServerAcceptIdentityAccessToken())
        ) {
            const identityAccessToken = await this.identityServer.getAccessToken();
            if (identityAccessToken) {
                for (const invite of invitesNeedingToken) {
                    invite.id_access_token = identityAccessToken;
                }
            }
        }

        return this.http.authedRequest(Method.Post, "/createRoom", undefined, options);
    }

    /**
     * Fetches relations for a given event
     * @param roomId - the room of the event
     * @param eventId - the id of the event
     * @param relationType - the rel_type of the relations requested
     * @param eventType - the event type of the relations requested
     * @param opts - options with optional values for the request.
     * @returns the response, with chunk, prev_batch and, next_batch.
     */
    public fetchRelations(
        roomId: string,
        eventId: string,
        relationType?: RelationType | string | null,
        eventType?: EventType | string | null,
        opts: IRelationsRequestOpts = { dir: Direction.Backward },
    ): Promise<IRelationsResponse> {
        let params = opts as QueryDict;
        if (Thread.hasServerSideFwdPaginationSupport === FeatureSupport.Experimental) {
            params = replaceParam("dir", "org.matrix.msc3715.dir", params);
        }
        if (this.canSupport.get(Feature.RelationsRecursion) === ServerSupport.Unstable) {
            params = replaceParam("recurse", "org.matrix.msc3981.recurse", params);
        }
        const queryString = utils.encodeParams(params);

        let templatedUrl = "/rooms/$roomId/relations/$eventId";
        if (relationType !== null) {
            templatedUrl += "/$relationType";
            if (eventType !== null) {
                templatedUrl += "/$eventType";
            }
        } else if (eventType !== null) {
            logger.warn(`eventType: ${eventType} ignored when fetching
            relations as relationType is null`);
            eventType = null;
        }

        const path = utils.encodeUri(templatedUrl + "?" + queryString, {
            $roomId: roomId,
            $eventId: eventId,
            $relationType: relationType!,
            $eventType: eventType!,
        });
        return this.http.authedRequest(Method.Get, path, undefined, undefined, {
            prefix: ClientPrefix.V1,
        });
    }

    /**
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public roomState(roomId: string): Promise<IStateEventWithRoomId[]> {
        const path = utils.encodeUri("/rooms/$roomId/state", { $roomId: roomId });
        return this.http.authedRequest(Method.Get, path);
    }

    /**
     * Get an event in a room by its event id.
     *
     * @returns Promise which resolves to an object containing the event.
     * @returns Rejects: with an error response.
     */
    public fetchRoomEvent(roomId: string, eventId: string): Promise<Partial<IEvent>> {
        const path = utils.encodeUri("/rooms/$roomId/event/$eventId", {
            $roomId: roomId,
            $eventId: eventId,
        });
        return this.http.authedRequest(Method.Get, path);
    }

    /**
     * @param includeMembership - the membership type to include in the response
     * @param excludeMembership - the membership type to exclude from the response
     * @param atEventId - the id of the event for which moment in the timeline the members should be returned for
     * @returns Promise which resolves: dictionary of userid to profile information
     * @returns Rejects: with an error response.
     */
    public members(
        roomId: string,
        includeMembership?: string,
        excludeMembership?: string,
        atEventId?: string,
    ): Promise<{ [userId: string]: IStateEventWithRoomId[] }> {
        const queryParams: Record<string, string> = {};
        if (includeMembership) {
            queryParams.membership = includeMembership;
        }
        if (excludeMembership) {
            queryParams.not_membership = excludeMembership;
        }
        if (atEventId) {
            queryParams.at = atEventId;
        }

        const queryString = utils.encodeParams(queryParams);

        const path = utils.encodeUri("/rooms/$roomId/members?" + queryString, { $roomId: roomId });
        return this.http.authedRequest(Method.Get, path);
    }

    /**
     * Upgrades a room to a new protocol version
     * @param newVersion - The target version to upgrade to
     * @returns Promise which resolves: Object with key 'replacement_room'
     * @returns Rejects: with an error response.
     */
    public upgradeRoom(roomId: string, newVersion: string): Promise<{ replacement_room: string }> {
        // eslint-disable-line camelcase
        const path = utils.encodeUri("/rooms/$roomId/upgrade", { $roomId: roomId });
        return this.http.authedRequest(Method.Post, path, undefined, { new_version: newVersion });
    }

    /**
     * Retrieve a state event.
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public getStateEvent(roomId: string, eventType: string, stateKey: string): Promise<Record<string, any>> {
        const pathParams = {
            $roomId: roomId,
            $eventType: eventType,
            $stateKey: stateKey,
        };
        let path = utils.encodeUri("/rooms/$roomId/state/$eventType", pathParams);
        if (stateKey !== undefined) {
            path = utils.encodeUri(path + "/$stateKey", pathParams);
        }
        return this.http.authedRequest(Method.Get, path);
    }

    /**
     * @param opts - Options for the request function.
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public sendStateEvent(
        roomId: string,
        eventType: string,
        content: any,
        stateKey = "",
        opts: IRequestOpts = {},
    ): Promise<ISendEventResponse> {
        const pathParams = {
            $roomId: roomId,
            $eventType: eventType,
            $stateKey: stateKey,
        };
        let path = utils.encodeUri("/rooms/$roomId/state/$eventType", pathParams);
        if (stateKey !== undefined) {
            path = utils.encodeUri(path + "/$stateKey", pathParams);
        }
        return this.http.authedRequest(Method.Put, path, undefined, content, opts);
    }

    /**
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public roomInitialSync(roomId: string, limit: number): Promise<IRoomInitialSyncResponse> {
        const path = utils.encodeUri("/rooms/$roomId/initialSync", { $roomId: roomId });

        return this.http.authedRequest(Method.Get, path, { limit: limit?.toString() ?? "30" });
    }

    /**
     * Set a marker to indicate the point in a room before which the user has read every
     * event. This can be retrieved from room account data (the event type is `m.fully_read`)
     * and displayed as a horizontal line in the timeline that is visually distinct to the
     * position of the user's own read receipt.
     * @param roomId - ID of the room that has been read
     * @param rmEventId - ID of the event that has been read
     * @param rrEventId - ID of the event tracked by the read receipt. This is here
     * for convenience because the RR and the RM are commonly updated at the same time as
     * each other. Optional.
     * @param rpEventId - rpEvent the m.read.private read receipt event for when we
     * don't want other users to see the read receipts. This is experimental. Optional.
     * @returns Promise which resolves: the empty object, `{}`.
     */
    public async setRoomReadMarkersHttpRequest(
        roomId: string,
        rmEventId: string,
        rrEventId?: string,
        rpEventId?: string,
    ): Promise<{}> {
        const path = utils.encodeUri("/rooms/$roomId/read_markers", {
            $roomId: roomId,
        });

        const content: IContent = {
            [ReceiptType.FullyRead]: rmEventId,
            [ReceiptType.Read]: rrEventId,
        };

        if (
            (await this.doesServerSupportUnstableFeature("org.matrix.msc2285.stable")) ||
            (await this.isVersionSupported("v1.4"))
        ) {
            content[ReceiptType.ReadPrivate] = rpEventId;
        }

        return this.http.authedRequest(Method.Post, path, undefined, content);
    }

    /**
     * @returns Promise which resolves: A list of the user's current rooms
     * @returns Rejects: with an error response.
     */
    public getJoinedRooms(): Promise<IJoinedRoomsResponse> {
        const path = utils.encodeUri("/joined_rooms", {});
        return this.http.authedRequest(Method.Get, path);
    }

    /**
     * Retrieve membership info. for a room.
     * @param roomId - ID of the room to get membership for
     * @returns Promise which resolves: A list of currently joined users
     *                                 and their profile data.
     * @returns Rejects: with an error response.
     */
    public getJoinedRoomMembers(roomId: string): Promise<IJoinedMembersResponse> {
        const path = utils.encodeUri("/rooms/$roomId/joined_members", {
            $roomId: roomId,
        });
        return this.http.authedRequest(Method.Get, path);
    }

    /**
     * @param options - Options for this request
     * @param server - The remote server to query for the room list.
     *                                Optional. If unspecified, get the local home
     *                                server's public room list.
     * @param limit - Maximum number of entries to return
     * @param since - Token to paginate from
     * @returns Promise which resolves: IPublicRoomsResponse
     * @returns Rejects: with an error response.
     */
    public publicRooms({
        server,
        limit,
        since,
        ...options
    }: IRoomDirectoryOptions = {}): Promise<IPublicRoomsResponse> {
        const queryParams: QueryDict = { server, limit, since };
        if (Object.keys(options).length === 0) {
            return this.http.authedRequest(Method.Get, "/publicRooms", queryParams);
        } else {
            return this.http.authedRequest(Method.Post, "/publicRooms", queryParams, options);
        }
    }

    /**
     * Create an alias to room ID mapping.
     * @param alias - The room alias to create.
     * @param roomId - The room ID to link the alias to.
     * @returns Promise which resolves: an empty object `{}`
     * @returns Rejects: with an error response.
     */
    public createAlias(alias: string, roomId: string): Promise<{}> {
        const path = utils.encodeUri("/directory/room/$alias", {
            $alias: alias,
        });
        const data = {
            room_id: roomId,
        };
        return this.http.authedRequest(Method.Put, path, undefined, data);
    }

    /**
     * Delete an alias to room ID mapping. This alias must be on your local server,
     * and you must have sufficient access to do this operation.
     * @param alias - The room alias to delete.
     * @returns Promise which resolves: an empty object `{}`.
     * @returns Rejects: with an error response.
     */
    public deleteAlias(alias: string): Promise<{}> {
        const path = utils.encodeUri("/directory/room/$alias", {
            $alias: alias,
        });
        return this.http.authedRequest(Method.Delete, path);
    }

    /**
     * Gets the local aliases for the room. Note: this includes all local aliases, unlike the
     * curated list from the m.room.canonical_alias state event.
     * @param roomId - The room ID to get local aliases for.
     * @returns Promise which resolves: an object with an `aliases` property, containing an array of local aliases
     * @returns Rejects: with an error response.
     */
    public getLocalAliases(roomId: string): Promise<{ aliases: string[] }> {
        const path = utils.encodeUri("/rooms/$roomId/aliases", { $roomId: roomId });
        const prefix = ClientPrefix.V3;
        return this.http.authedRequest(Method.Get, path, undefined, undefined, { prefix });
    }

    /**
     * Get room info for the given alias.
     * @param alias - The room alias to resolve.
     * @returns Promise which resolves: Object with room_id and servers.
     * @returns Rejects: with an error response.
     */
    public getRoomIdForAlias(alias: string): Promise<{ room_id: string; servers: string[] }> {
        // eslint-disable-line camelcase
        const path = utils.encodeUri("/directory/room/$alias", {
            $alias: alias,
        });
        return this.http.authedRequest(Method.Get, path);
    }

    /**
     * @returns Promise which resolves: Object with room_id and servers.
     * @returns Rejects: with an error response.
     * @deprecated use `getRoomIdForAlias` instead
     */
    // eslint-disable-next-line camelcase
    public resolveRoomAlias(roomAlias: string): Promise<{ room_id: string; servers: string[] }> {
        const path = utils.encodeUri("/directory/room/$alias", { $alias: roomAlias });
        return this.http.request(Method.Get, path);
    }

    /**
     * Get the visibility of a room in the current HS's room directory
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public getRoomDirectoryVisibility(roomId: string): Promise<{ visibility: Visibility }> {
        const path = utils.encodeUri("/directory/list/room/$roomId", {
            $roomId: roomId,
        });
        return this.http.authedRequest(Method.Get, path);
    }

    /**
     * Set the visbility of a room in the current HS's room directory
     * @param visibility - "public" to make the room visible
     *                 in the public directory, or "private" to make
     *                 it invisible.
     * @returns Promise which resolves: to an empty object `{}`
     * @returns Rejects: with an error response.
     */
    public setRoomDirectoryVisibility(roomId: string, visibility: Visibility): Promise<{}> {
        const path = utils.encodeUri("/directory/list/room/$roomId", {
            $roomId: roomId,
        });
        return this.http.authedRequest(Method.Put, path, undefined, { visibility });
    }

    /**
     * Set the visbility of a room bridged to a 3rd party network in
     * the current HS's room directory.
     * @param networkId - the network ID of the 3rd party
     *                 instance under which this room is published under.
     * @param visibility - "public" to make the room visible
     *                 in the public directory, or "private" to make
     *                 it invisible.
     * @returns Promise which resolves: result object
     * @returns Rejects: with an error response.
     */
    public setRoomDirectoryVisibilityAppService(
        networkId: string,
        roomId: string,
        visibility: "public" | "private",
    ): Promise<any> {
        // TODO: Types
        const path = utils.encodeUri("/directory/list/appservice/$networkId/$roomId", {
            $networkId: networkId,
            $roomId: roomId,
        });
        return this.http.authedRequest(Method.Put, path, undefined, { visibility: visibility });
    }

    /**
     * Query the user directory with a term matching user IDs, display names and domains.
     * @param term - the term with which to search.
     * @param limit - the maximum number of results to return. The server will
     *                 apply a limit if unspecified.
     * @returns Promise which resolves: an array of results.
     */
    public searchUserDirectory({ term, limit }: { term: string; limit?: number }): Promise<IUserDirectoryResponse> {
        const body: any = {
            search_term: term,
        };

        if (limit !== undefined) {
            body.limit = limit;
        }

        return this.http.authedRequest(Method.Post, "/user_directory/search", undefined, body);
    }

    /**
     * Upload a file to the media repository on the homeserver.
     *
     * @param file - The object to upload. On a browser, something that
     *   can be sent to XMLHttpRequest.send (typically a File).  Under node.js,
     *   a a Buffer, String or ReadStream.
     *
     * @param opts -  options object
     *
     * @returns Promise which resolves to response object, as
     *    determined by this.opts.onlyData, opts.rawResponse, and
     *    opts.onlyContentUri.  Rejects with an error (usually a MatrixError).
     */
    public uploadContent(file: FileType, opts?: UploadOpts): Promise<UploadResponse> {
        return this.http.uploadContent(file, opts);
    }

    /**
     * Cancel a file upload in progress
     * @param upload - The object returned from uploadContent
     * @returns true if canceled, otherwise false
     */
    public cancelUpload(upload: Promise<UploadResponse>): boolean {
        return this.http.cancelUpload(upload);
    }

    /**
     * Get a list of all file uploads in progress
     * @returns Array of objects representing current uploads.
     * Currently in progress is element 0. Keys:
     *  - promise: The promise associated with the upload
     *  - loaded: Number of bytes uploaded
     *  - total: Total number of bytes to upload
     */
    public getCurrentUploads(): Upload[] {
        return this.http.getCurrentUploads();
    }

    /**
     * @param info - The kind of info to retrieve (e.g. 'displayname',
     * 'avatar_url').
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     */
    public getProfileInfo(
        userId: string,
        info?: string,
        // eslint-disable-next-line camelcase
    ): Promise<{ avatar_url?: string; displayname?: string }> {
        const path = info
            ? utils.encodeUri("/profile/$userId/$info", { $userId: userId, $info: info })
            : utils.encodeUri("/profile/$userId", { $userId: userId });
        return this.http.authedRequest(Method.Get, path);
    }

    /**
     * @returns Promise which resolves to a list of the user's threepids.
     * @returns Rejects: with an error response.
     */
    public getThreePids(): Promise<{ threepids: IThreepid[] }> {
        return this.http.authedRequest(Method.Get, "/account/3pid");
    }

    /**
     * Add a 3PID to your homeserver account and optionally bind it to an identity
     * server as well. An identity server is required as part of the `creds` object.
     *
     * This API is deprecated, and you should instead use `addThreePidOnly`
     * for homeservers that support it.
     *
     * @returns Promise which resolves: on success
     * @returns Rejects: with an error response.
     */
    public addThreePid(creds: any, bind: boolean): Promise<any> {
        // TODO: Types
        const path = "/account/3pid";
        const data = {
            threePidCreds: creds,
            bind: bind,
        };
        return this.http.authedRequest(Method.Post, path, undefined, data);
    }

    /**
     * Add a 3PID to your homeserver account. This API does not use an identity
     * server, as the homeserver is expected to handle 3PID ownership validation.
     *
     * You can check whether a homeserver supports this API via
     * `doesServerSupportSeparateAddAndBind`.
     *
     * @param data - A object with 3PID validation data from having called
     * `account/3pid/<medium>/requestToken` on the homeserver.
     * @returns Promise which resolves: to an empty object `{}`
     * @returns Rejects: with an error response.
     */
    public async addThreePidOnly(data: IAddThreePidOnlyBody): Promise<{}> {
        const path = "/account/3pid/add";
        const prefix = (await this.isVersionSupported("r0.6.0")) ? ClientPrefix.R0 : ClientPrefix.Unstable;
        return this.http.authedRequest(Method.Post, path, undefined, data, { prefix });
    }

    /**
     * Bind a 3PID for discovery onto an identity server via the homeserver. The
     * identity server handles 3PID ownership validation and the homeserver records
     * the new binding to track where all 3PIDs for the account are bound.
     *
     * You can check whether a homeserver supports this API via
     * `doesServerSupportSeparateAddAndBind`.
     *
     * @param data - A object with 3PID validation data from having called
     * `validate/<medium>/requestToken` on the identity server. It should also
     * contain `id_server` and `id_access_token` fields as well.
     * @returns Promise which resolves: to an empty object `{}`
     * @returns Rejects: with an error response.
     */
    public async bindThreePid(data: IBindThreePidBody): Promise<{}> {
        const path = "/account/3pid/bind";
        const prefix = (await this.isVersionSupported("r0.6.0")) ? ClientPrefix.R0 : ClientPrefix.Unstable;
        return this.http.authedRequest(Method.Post, path, undefined, data, { prefix });
    }

    /**
     * Unbind a 3PID for discovery on an identity server via the homeserver. The
     * homeserver removes its record of the binding to keep an updated record of
     * where all 3PIDs for the account are bound.
     *
     * @param medium - The threepid medium (eg. 'email')
     * @param address - The threepid address (eg. 'bob\@example.com')
     *        this must be as returned by getThreePids.
     * @returns Promise which resolves: on success
     * @returns Rejects: with an error response.
     */
    public async unbindThreePid(
        medium: string,
        address: string,
        // eslint-disable-next-line camelcase
    ): Promise<{ id_server_unbind_result: IdServerUnbindResult }> {
        const path = "/account/3pid/unbind";
        const data = {
            medium,
            address,
            id_server: this.getIdentityServerUrl(true),
        };
        const prefix = (await this.isVersionSupported("r0.6.0")) ? ClientPrefix.R0 : ClientPrefix.Unstable;
        return this.http.authedRequest(Method.Post, path, undefined, data, { prefix });
    }

    /**
     * @param medium - The threepid medium (eg. 'email')
     * @param address - The threepid address (eg. 'bob\@example.com')
     *        this must be as returned by getThreePids.
     * @returns Promise which resolves: The server response on success
     *     (generally the empty JSON object)
     * @returns Rejects: with an error response.
     */
    public deleteThreePid(
        medium: string,
        address: string,
        // eslint-disable-next-line camelcase
    ): Promise<{ id_server_unbind_result: IdServerUnbindResult }> {
        const path = "/account/3pid/delete";
        return this.http.authedRequest(Method.Post, path, undefined, { medium, address });
    }

    /**
     * Make a request to change your password.
     * @param newPassword - The new desired password.
     * @param logoutDevices - Should all sessions be logged out after the password change. Defaults to true.
     * @returns Promise which resolves: to an empty object `{}`
     * @returns Rejects: with an error response.
     */
    public setPassword(authDict: IAuthDict, newPassword: string, logoutDevices?: boolean): Promise<{}> {
        const path = "/account/password";
        const data = {
            auth: authDict,
            new_password: newPassword,
            logout_devices: logoutDevices,
        };

        return this.http.authedRequest<{}>(Method.Post, path, undefined, data);
    }

    /**
     * Gets all devices recorded for the logged-in user
     * @returns Promise which resolves: result object
     * @returns Rejects: with an error response.
     */
    public getDevices(): Promise<{ devices: IMyDevice[] }> {
        return this.http.authedRequest(Method.Get, "/devices");
    }

    /**
     * Gets specific device details for the logged-in user
     * @param deviceId -  device to query
     * @returns Promise which resolves: result object
     * @returns Rejects: with an error response.
     */
    public getDevice(deviceId: string): Promise<IMyDevice> {
        const path = utils.encodeUri("/devices/$device_id", {
            $device_id: deviceId,
        });
        return this.http.authedRequest(Method.Get, path);
    }

    /**
     * Update the given device
     *
     * @param deviceId -  device to update
     * @param body -       body of request
     * @returns Promise which resolves: to an empty object `{}`
     * @returns Rejects: with an error response.
     */
    // eslint-disable-next-line camelcase
    public setDeviceDetails(deviceId: string, body: { display_name: string }): Promise<{}> {
        const path = utils.encodeUri("/devices/$device_id", {
            $device_id: deviceId,
        });

        return this.http.authedRequest(Method.Put, path, undefined, body);
    }

    /**
     * Delete the given device
     *
     * @param deviceId -  device to delete
     * @param auth - Optional. Auth data to supply for User-Interactive auth.
     * @returns Promise which resolves: result object
     * @returns Rejects: with an error response.
     */
    public deleteDevice(deviceId: string, auth?: IAuthDict): Promise<IAuthData | {}> {
        const path = utils.encodeUri("/devices/$device_id", {
            $device_id: deviceId,
        });

        const body: any = {};

        if (auth) {
            body.auth = auth;
        }

        return this.http.authedRequest(Method.Delete, path, undefined, body);
    }

    /**
     * Delete multiple device
     *
     * @param devices - IDs of the devices to delete
     * @param auth - Optional. Auth data to supply for User-Interactive auth.
     * @returns Promise which resolves: result object
     * @returns Rejects: with an error response.
     */
    public deleteMultipleDevices(devices: string[], auth?: IAuthDict): Promise<IAuthData | {}> {
        const body: any = { devices };

        if (auth) {
            body.auth = auth;
        }

        const path = "/delete_devices";
        return this.http.authedRequest(Method.Post, path, undefined, body);
    }

    /**
     * Gets all pushers registered for the logged-in user
     *
     * @returns Promise which resolves: Array of objects representing pushers
     * @returns Rejects: with an error response.
     */
    public async getPushers(): Promise<{ pushers: IPusher[] }> {
        const response = await this.http.authedRequest<{ pushers: IPusher[] }>(Method.Get, "/pushers");

        // Migration path for clients that connect to a homeserver that does not support
        // MSC3881 yet, see https://github.com/matrix-org/matrix-spec-proposals/blob/kerry/remote-push-toggle/proposals/3881-remote-push-notification-toggling.md#migration
        if (!(await this.doesServerSupportUnstableFeature("org.matrix.msc3881"))) {
            response.pushers = response.pushers.map((pusher) => {
                if (!pusher.hasOwnProperty(PUSHER_ENABLED.name)) {
                    pusher[PUSHER_ENABLED.name] = true;
                }
                return pusher;
            });
        }

        return response;
    }

    /**
     * Adds a new pusher or updates an existing pusher
     *
     * @param pusher - Object representing a pusher
     * @returns Promise which resolves: Empty json object on success
     * @returns Rejects: with an error response.
     */
    public setPusher(pusher: IPusherRequest): Promise<{}> {
        const path = "/pushers/set";
        return this.http.authedRequest(Method.Post, path, undefined, pusher);
    }

    /**
     * Removes an existing pusher
     * @param pushKey - pushkey of pusher to remove
     * @param appId - app_id of pusher to remove
     * @returns Promise which resolves: Empty json object on success
     * @returns Rejects: with an error response.
     */
    public removePusher(pushKey: string, appId: string): Promise<{}> {
        const path = "/pushers/set";
        const body = {
            pushkey: pushKey,
            app_id: appId,
            kind: null, // marks pusher for removal
        };
        return this.http.authedRequest(Method.Post, path, undefined, body);
    }

    /**
     * Persists local notification settings
     * @returns Promise which resolves: an empty object
     * @returns Rejects: with an error response.
     */
    public setLocalNotificationSettings(
        deviceId: string,
        notificationSettings: LocalNotificationSettings,
    ): Promise<{}> {
        const key = `${LOCAL_NOTIFICATION_SETTINGS_PREFIX.name}.${deviceId}`;
        return this.setAccountData(key, notificationSettings);
    }

    /**
     * Get the push rules for the account from the server.
     * @returns Promise which resolves to the push rules.
     * @returns Rejects: with an error response.
     */
    public getPushRules(): Promise<IPushRules> {
        return this.http.authedRequest<IPushRules>(Method.Get, "/pushrules/").then((rules: IPushRules) => {
            this.setPushRules(rules);
            return this.pushRules!;
        });
    }

    /**
     * Update the push rules for the account. This should be called whenever
     * updated push rules are available.
     */
    public setPushRules(rules: IPushRules): void {
        // Fix-up defaults, if applicable.
        this.pushRules = PushProcessor.rewriteDefaultRules(rules, this.getUserId()!);
        // Pre-calculate any necessary caches.
        this.pushProcessor.updateCachedPushRuleKeys(this.pushRules);
    }

    /**
     * @returns Promise which resolves: an empty object `{}`
     * @returns Rejects: with an error response.
     */
    public addPushRule(
        scope: string,
        kind: PushRuleKind,
        ruleId: Exclude<string, RuleId>,
        body: Pick<IPushRule, "actions" | "conditions" | "pattern">,
    ): Promise<{}> {
        // NB. Scope not uri encoded because devices need the '/'
        const path = utils.encodeUri("/pushrules/" + scope + "/$kind/$ruleId", {
            $kind: kind,
            $ruleId: ruleId,
        });
        return this.http.authedRequest(Method.Put, path, undefined, body);
    }

    /**
     * @returns Promise which resolves: an empty object `{}`
     * @returns Rejects: with an error response.
     */
    public deletePushRule(scope: string, kind: PushRuleKind, ruleId: Exclude<string, RuleId>): Promise<{}> {
        // NB. Scope not uri encoded because devices need the '/'
        const path = utils.encodeUri("/pushrules/" + scope + "/$kind/$ruleId", {
            $kind: kind,
            $ruleId: ruleId,
        });
        return this.http.authedRequest(Method.Delete, path);
    }

    /**
     * Enable or disable a push notification rule.
     * @returns Promise which resolves: to an empty object `{}`
     * @returns Rejects: with an error response.
     */
    public setPushRuleEnabled(
        scope: string,
        kind: PushRuleKind,
        ruleId: RuleId | string,
        enabled: boolean,
    ): Promise<{}> {
        const path = utils.encodeUri("/pushrules/" + scope + "/$kind/$ruleId/enabled", {
            $kind: kind,
            $ruleId: ruleId,
        });
        return this.http.authedRequest(Method.Put, path, undefined, { enabled: enabled });
    }

    /**
     * Set the actions for a push notification rule.
     * @returns Promise which resolves: to an empty object `{}`
     * @returns Rejects: with an error response.
     */
    public setPushRuleActions(
        scope: string,
        kind: PushRuleKind,
        ruleId: RuleId | string,
        actions: PushRuleAction[],
    ): Promise<{}> {
        const path = utils.encodeUri("/pushrules/" + scope + "/$kind/$ruleId/actions", {
            $kind: kind,
            $ruleId: ruleId,
        });
        return this.http.authedRequest(Method.Put, path, undefined, { actions: actions });
    }

    /**
     * Perform a server-side search.
     * @param next_batch - the batch token to pass in the query string
     * @param body - the JSON object to pass to the request body.
     * @param abortSignal - optional signal used to cancel the http request.
     * @returns Promise which resolves to the search response object.
     * @returns Rejects: with an error response.
     */
    public search(
        { body, next_batch: nextBatch }: { body: ISearchRequestBody; next_batch?: string },
        abortSignal?: AbortSignal,
    ): Promise<ISearchResponse> {
        const queryParams: any = {};
        if (nextBatch) {
            queryParams.next_batch = nextBatch;
        }
        return this.http.authedRequest(Method.Post, "/search", queryParams, body, { abortSignal });
    }

    /**
     * Upload keys
     *
     * @param content -  body of upload request
     *
     * @param opts - this method no longer takes any opts,
     *  used to take opts.device_id but this was not removed from the spec as a redundant parameter
     *
     * @returns Promise which resolves: result object. Rejects: with
     *     an error response ({@link MatrixError}).
     */
    public uploadKeysRequest(content: IUploadKeysRequest, opts?: void): Promise<IKeysUploadResponse> {
        return this.http.authedRequest(Method.Post, "/keys/upload", undefined, content);
    }

    public uploadKeySignatures(content: KeySignatures): Promise<IUploadKeySignaturesResponse> {
        return this.http.authedRequest(Method.Post, "/keys/signatures/upload", undefined, content, {
            prefix: ClientPrefix.V3,
        });
    }

    /**
     * Download device keys
     *
     * @param userIds -  list of users to get keys for
     *
     * @param token - sync token to pass in the query request, to help
     *   the HS give the most recent results
     *
     * @returns Promise which resolves: result object. Rejects: with
     *     an error response ({@link MatrixError}).
     */
    public downloadKeysForUsers(userIds: string[], { token }: { token?: string } = {}): Promise<IDownloadKeyResult> {
        const content: IQueryKeysRequest = {
            device_keys: {},
        };
        if (token !== undefined) {
            content.token = token;
        }
        userIds.forEach((u) => {
            content.device_keys[u] = [];
        });

        return this.http.authedRequest(Method.Post, "/keys/query", undefined, content);
    }

    /**
     * Claim one-time keys
     *
     * @param devices -  a list of [userId, deviceId] pairs
     *
     * @param keyAlgorithm -  desired key type
     *
     * @param timeout - the time (in milliseconds) to wait for keys from remote
     *     servers
     *
     * @returns Promise which resolves: result object. Rejects: with
     *     an error response ({@link MatrixError}).
     */
    public claimOneTimeKeys(
        devices: [string, string][],
        keyAlgorithm = "signed_curve25519",
        timeout?: number,
    ): Promise<IClaimOTKsResult> {
        const queries: Record<string, Record<string, string>> = {};

        if (keyAlgorithm === undefined) {
            keyAlgorithm = "signed_curve25519";
        }

        for (const [userId, deviceId] of devices) {
            const query = queries[userId] || {};
            safeSet(queries, userId, query);
            safeSet(query, deviceId, keyAlgorithm);
        }
        const content: IClaimKeysRequest = { one_time_keys: queries };
        if (timeout) {
            content.timeout = timeout;
        }
        const path = "/keys/claim";
        return this.http.authedRequest(Method.Post, path, undefined, content);
    }

    /**
     * Ask the server for a list of users who have changed their device lists
     * between a pair of sync tokens
     *
     *
     * @returns Promise which resolves: result object. Rejects: with
     *     an error response ({@link MatrixError}).
     */
    public getKeyChanges(oldToken: string, newToken: string): Promise<{ changed: string[]; left: string[] }> {
        const qps = {
            from: oldToken,
            to: newToken,
        };

        return this.http.authedRequest(Method.Get, "/keys/changes", qps);
    }

    public uploadDeviceSigningKeys(auth?: IAuthDict, keys?: CrossSigningKeys): Promise<{}> {
        // API returns empty object
        const data = Object.assign({}, keys);
        if (auth) Object.assign(data, { auth });
        return this.http.authedRequest(Method.Post, "/keys/device_signing/upload", undefined, data, {
            prefix: ClientPrefix.Unstable,
        });
    }

    /**
     * Register with an identity server using the OpenID token from the user's
     * Homeserver, which can be retrieved via
     * {@link MatrixClient#getOpenIdToken}.
     *
     * Note that the `/account/register` endpoint (as well as IS authentication in
     * general) was added as part of the v2 API version.
     *
     * @returns Promise which resolves: with object containing an Identity
     * Server access token.
     * @returns Rejects: with an error response.
     */
    public registerWithIdentityServer(hsOpenIdToken: IOpenIDToken): Promise<{
        access_token: string;
        token: string;
    }> {
        if (!this.idBaseUrl) {
            throw new Error("No identity server base URL set");
        }

        const uri = this.http.getUrl("/account/register", undefined, IdentityPrefix.V2, this.idBaseUrl);
        return this.http.requestOtherUrl(Method.Post, uri, hsOpenIdToken);
    }

    /**
     * Requests an email verification token directly from an identity server.
     *
     * This API is used as part of binding an email for discovery on an identity
     * server. The validation data that results should be passed to the
     * `bindThreePid` method to complete the binding process.
     *
     * @param email - The email address to request a token for
     * @param clientSecret - A secret binary string generated by the client.
     *                 It is recommended this be around 16 ASCII characters.
     * @param sendAttempt - If an identity server sees a duplicate request
     *                 with the same sendAttempt, it will not send another email.
     *                 To request another email to be sent, use a larger value for
     *                 the sendAttempt param as was used in the previous request.
     * @param nextLink - Optional If specified, the client will be redirected
     *                 to this link after validation.
     * @param identityAccessToken - The `access_token` field of the identity
     * server `/account/register` response (see {@link registerWithIdentityServer}).
     *
     * @returns Promise which resolves: TODO
     * @returns Rejects: with an error response.
     * @throws Error if no identity server is set
     */
    public requestEmailToken(
        email: string,
        clientSecret: string,
        sendAttempt: number,
        nextLink?: string,
        identityAccessToken?: string,
    ): Promise<IRequestTokenResponse> {
        const params: Record<string, string> = {
            client_secret: clientSecret,
            email: email,
            send_attempt: sendAttempt?.toString(),
        };
        if (nextLink) {
            params.next_link = nextLink;
        }

        return this.http.idServerRequest<IRequestTokenResponse>(
            Method.Post,
            "/validate/email/requestToken",
            params,
            IdentityPrefix.V2,
            identityAccessToken,
        );
    }

    /**
     * Requests a MSISDN verification token directly from an identity server.
     *
     * This API is used as part of binding a MSISDN for discovery on an identity
     * server. The validation data that results should be passed to the
     * `bindThreePid` method to complete the binding process.
     *
     * @param phoneCountry - The ISO 3166-1 alpha-2 code for the country in
     *                 which phoneNumber should be parsed relative to.
     * @param phoneNumber - The phone number, in national or international
     *                 format
     * @param clientSecret - A secret binary string generated by the client.
     *                 It is recommended this be around 16 ASCII characters.
     * @param sendAttempt - If an identity server sees a duplicate request
     *                 with the same sendAttempt, it will not send another SMS.
     *                 To request another SMS to be sent, use a larger value for
     *                 the sendAttempt param as was used in the previous request.
     * @param nextLink - Optional If specified, the client will be redirected
     *                 to this link after validation.
     * @param identityAccessToken - The `access_token` field of the Identity
     * Server `/account/register` response (see {@link registerWithIdentityServer}).
     *
     * @returns Promise which resolves to an object with a sid string
     * @returns Rejects: with an error response.
     * @throws Error if no identity server is set
     */
    public requestMsisdnToken(
        phoneCountry: string,
        phoneNumber: string,
        clientSecret: string,
        sendAttempt: number,
        nextLink?: string,
        identityAccessToken?: string,
    ): Promise<IRequestMsisdnTokenResponse> {
        const params: Record<string, string> = {
            client_secret: clientSecret,
            country: phoneCountry,
            phone_number: phoneNumber,
            send_attempt: sendAttempt?.toString(),
        };
        if (nextLink) {
            params.next_link = nextLink;
        }

        return this.http.idServerRequest<IRequestMsisdnTokenResponse>(
            Method.Post,
            "/validate/msisdn/requestToken",
            params,
            IdentityPrefix.V2,
            identityAccessToken,
        );
    }

    /**
     * Submits a MSISDN token to the identity server
     *
     * This is used when submitting the code sent by SMS to a phone number.
     * The identity server has an equivalent API for email but the js-sdk does
     * not expose this, since email is normally validated by the user clicking
     * a link rather than entering a code.
     *
     * @param sid - The sid given in the response to requestToken
     * @param clientSecret - A secret binary string generated by the client.
     *                 This must be the same value submitted in the requestToken call.
     * @param msisdnToken - The MSISDN token, as enetered by the user.
     * @param identityAccessToken - The `access_token` field of the Identity
     * Server `/account/register` response (see {@link registerWithIdentityServer}).
     *
     * @returns Promise which resolves: Object, containing success boolean.
     * @returns Rejects: with an error response.
     * @throws Error if No identity server is set
     */
    public submitMsisdnToken(
        sid: string,
        clientSecret: string,
        msisdnToken: string,
        identityAccessToken: string,
    ): Promise<{ success: boolean }> {
        const params = {
            sid: sid,
            client_secret: clientSecret,
            token: msisdnToken,
        };

        return this.http.idServerRequest(
            Method.Post,
            "/validate/msisdn/submitToken",
            params,
            IdentityPrefix.V2,
            identityAccessToken,
        );
    }

    /**
     * Submits a MSISDN token to an arbitrary URL.
     *
     * This is used when submitting the code sent by SMS to a phone number in the
     * newer 3PID flow where the homeserver validates 3PID ownership (as part of
     * `requestAdd3pidMsisdnToken`). The homeserver response may include a
     * `submit_url` to specify where the token should be sent, and this helper can
     * be used to pass the token to this URL.
     *
     * @param url - The URL to submit the token to
     * @param sid - The sid given in the response to requestToken
     * @param clientSecret - A secret binary string generated by the client.
     *                 This must be the same value submitted in the requestToken call.
     * @param msisdnToken - The MSISDN token, as enetered by the user.
     *
     * @returns Promise which resolves: Object, containing success boolean.
     * @returns Rejects: with an error response.
     */
    public submitMsisdnTokenOtherUrl(
        url: string,
        sid: string,
        clientSecret: string,
        msisdnToken: string,
    ): Promise<{ success: boolean }> {
        const params = {
            sid: sid,
            client_secret: clientSecret,
            token: msisdnToken,
        };
        return this.http.requestOtherUrl(Method.Post, url, params);
    }

    /**
     * Gets the V2 hashing information from the identity server. Primarily useful for
     * lookups.
     * @param identityAccessToken - The access token for the identity server.
     * @returns The hashing information for the identity server.
     */
    public getIdentityHashDetails(identityAccessToken: string): Promise<any> {
        // TODO: Types
        return this.http.idServerRequest(
            Method.Get,
            "/hash_details",
            undefined,
            IdentityPrefix.V2,
            identityAccessToken,
        );
    }

    /**
     * Performs a hashed lookup of addresses against the identity server. This is
     * only supported on identity servers which have at least the version 2 API.
     * @param addressPairs - An array of 2 element arrays.
     * The first element of each pair is the address, the second is the 3PID medium.
     * Eg: `["email@example.org", "email"]`
     * @param identityAccessToken - The access token for the identity server.
     * @returns A collection of address mappings to
     * found MXIDs. Results where no user could be found will not be listed.
     */
    public async identityHashedLookup(
        addressPairs: [string, string][],
        identityAccessToken: string,
    ): Promise<{ address: string; mxid: string }[]> {
        const params: Record<string, string | string[]> = {
            // addresses: ["email@example.org", "10005550000"],
            // algorithm: "sha256",
            // pepper: "abc123"
        };

        // Get hash information first before trying to do a lookup
        const hashes = await this.getIdentityHashDetails(identityAccessToken);
        if (!hashes || !hashes["lookup_pepper"] || !hashes["algorithms"]) {
            throw new Error("Unsupported identity server: bad response");
        }

        params["pepper"] = hashes["lookup_pepper"];

        const localMapping: Record<string, string> = {
            // hashed identifier => plain text address
            // For use in this function's return format
        };

        // When picking an algorithm, we pick the hashed over no hashes
        if (hashes["algorithms"].includes("sha256")) {
            // Abuse the olm hashing
            const olmutil = new global.Olm.Utility();
            params["addresses"] = addressPairs.map((p) => {
                const addr = p[0].toLowerCase(); // lowercase to get consistent hashes
                const med = p[1].toLowerCase();
                const hashed = olmutil
                    .sha256(`${addr} ${med} ${params["pepper"]}`)
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_"); // URL-safe base64
                // Map the hash to a known (case-sensitive) address. We use the case
                // sensitive version because the caller might be expecting that.
                localMapping[hashed] = p[0];
                return hashed;
            });
            params["algorithm"] = "sha256";
        } else if (hashes["algorithms"].includes("none")) {
            params["addresses"] = addressPairs.map((p) => {
                const addr = p[0].toLowerCase(); // lowercase to get consistent hashes
                const med = p[1].toLowerCase();
                const unhashed = `${addr} ${med}`;
                // Map the unhashed values to a known (case-sensitive) address. We use
                // the case-sensitive version because the caller might be expecting that.
                localMapping[unhashed] = p[0];
                return unhashed;
            });
            params["algorithm"] = "none";
        } else {
            throw new Error("Unsupported identity server: unknown hash algorithm");
        }

        const response = await this.http.idServerRequest<{
            mappings: { [address: string]: string };
        }>(Method.Post, "/lookup", params, IdentityPrefix.V2, identityAccessToken);

        if (!response?.["mappings"]) return []; // no results

        const foundAddresses: { address: string; mxid: string }[] = [];
        for (const hashed of Object.keys(response["mappings"])) {
            const mxid = response["mappings"][hashed];
            const plainAddress = localMapping[hashed];
            if (!plainAddress) {
                throw new Error("Identity server returned more results than expected");
            }

            foundAddresses.push({ address: plainAddress, mxid });
        }
        return foundAddresses;
    }

    /**
     * Looks up the public Matrix ID mapping for a given 3rd party
     * identifier from the identity server
     *
     * @param medium - The medium of the threepid, eg. 'email'
     * @param address - The textual address of the threepid
     * @param identityAccessToken - The `access_token` field of the Identity
     * Server `/account/register` response (see {@link registerWithIdentityServer}).
     *
     * @returns Promise which resolves: A threepid mapping
     *                                 object or the empty object if no mapping
     *                                 exists
     * @returns Rejects: with an error response.
     */
    public async lookupThreePid(medium: string, address: string, identityAccessToken: string): Promise<any> {
        // TODO: Types
        // Note: we're using the V2 API by calling this function, but our
        // function contract requires a V1 response. We therefore have to
        // convert it manually.
        const response = await this.identityHashedLookup([[address, medium]], identityAccessToken);
        const result = response.find((p) => p.address === address);
        if (!result) {
            return {};
        }

        const mapping = {
            address,
            medium,
            mxid: result.mxid,

            // We can't reasonably fill these parameters:
            // not_before
            // not_after
            // ts
            // signatures
        };

        return mapping;
    }

    /**
     * Looks up the public Matrix ID mappings for multiple 3PIDs.
     *
     * @param query - Array of arrays containing
     * [medium, address]
     * @param identityAccessToken - The `access_token` field of the Identity
     * Server `/account/register` response (see {@link registerWithIdentityServer}).
     *
     * @returns Promise which resolves: Lookup results from IS.
     * @returns Rejects: with an error response.
     */
    public async bulkLookupThreePids(query: [string, string][], identityAccessToken: string): Promise<any> {
        // TODO: Types
        // Note: we're using the V2 API by calling this function, but our
        // function contract requires a V1 response. We therefore have to
        // convert it manually.
        const response = await this.identityHashedLookup(
            // We have to reverse the query order to get [address, medium] pairs
            query.map((p) => [p[1], p[0]]),
            identityAccessToken,
        );

        const v1results: [medium: string, address: string, mxid: string][] = [];
        for (const mapping of response) {
            const originalQuery = query.find((p) => p[1] === mapping.address);
            if (!originalQuery) {
                throw new Error("Identity sever returned unexpected results");
            }

            v1results.push([
                originalQuery[0], // medium
                mapping.address,
                mapping.mxid,
            ]);
        }

        return { threepids: v1results };
    }

    /**
     * Get account info from the identity server. This is useful as a neutral check
     * to verify that other APIs are likely to approve access by testing that the
     * token is valid, terms have been agreed, etc.
     *
     * @param identityAccessToken - The `access_token` field of the Identity
     * Server `/account/register` response (see {@link registerWithIdentityServer}).
     *
     * @returns Promise which resolves: an object with account info.
     * @returns Rejects: with an error response.
     */
    public getIdentityAccount(identityAccessToken: string): Promise<any> {
        // TODO: Types
        return this.http.idServerRequest(Method.Get, "/account", undefined, IdentityPrefix.V2, identityAccessToken);
    }

    /**
     * Send an event to a specific list of devices.
     * This is a low-level API that simply wraps the HTTP API
     * call to send to-device messages. We recommend using
     * queueToDevice() which is a higher level API.
     *
     * @param eventType -  type of event to send
     *    content to send. Map from user_id to device_id to content object.
     * @param txnId -     transaction id. One will be made up if not
     *    supplied.
     * @returns Promise which resolves: to an empty object `{}`
     */
    public sendToDevice(eventType: string, contentMap: SendToDeviceContentMap, txnId?: string): Promise<{}> {
        const path = utils.encodeUri("/sendToDevice/$eventType/$txnId", {
            $eventType: eventType,
            $txnId: txnId ? txnId : this.makeTxnId(),
        });

        const body = {
            messages: utils.recursiveMapToObject(contentMap),
        };

        const targets = new Map<string, string[]>();

        for (const [userId, deviceMessages] of contentMap) {
            targets.set(userId, Array.from(deviceMessages.keys()));
        }

        logger.log(`PUT ${path}`, targets);

        return this.http.authedRequest(Method.Put, path, undefined, body);
    }

    /**
     * Sends events directly to specific devices using Matrix's to-device
     * messaging system. The batch will be split up into appropriately sized
     * batches for sending and stored in the store so they can be retried
     * later if they fail to send. Retries will happen automatically.
     * @param batch - The to-device messages to send
     */
    public queueToDevice(batch: ToDeviceBatch): Promise<void> {
        return this.toDeviceMessageQueue.queueBatch(batch);
    }

    /**
     * Get the third party protocols that can be reached using
     * this HS
     * @returns Promise which resolves to the result object
     */
    public getThirdpartyProtocols(): Promise<{ [protocol: string]: IProtocol }> {
        return this.http
            .authedRequest<Record<string, IProtocol>>(Method.Get, "/thirdparty/protocols")
            .then((response) => {
                // sanity check
                if (!response || typeof response !== "object") {
                    throw new Error(`/thirdparty/protocols did not return an object: ${response}`);
                }
                return response;
            });
    }

    /**
     * Get information on how a specific place on a third party protocol
     * may be reached.
     * @param protocol - The protocol given in getThirdpartyProtocols()
     * @param params - Protocol-specific parameters, as given in the
     *                        response to getThirdpartyProtocols()
     * @returns Promise which resolves to the result object
     */
    public getThirdpartyLocation(
        protocol: string,
        params: { searchFields?: string[] },
    ): Promise<IThirdPartyLocation[]> {
        const path = utils.encodeUri("/thirdparty/location/$protocol", {
            $protocol: protocol,
        });

        return this.http.authedRequest(Method.Get, path, params);
    }

    /**
     * Get information on how a specific user on a third party protocol
     * may be reached.
     * @param protocol - The protocol given in getThirdpartyProtocols()
     * @param params - Protocol-specific parameters, as given in the
     *                        response to getThirdpartyProtocols()
     * @returns Promise which resolves to the result object
     */
    public getThirdpartyUser(protocol: string, params: any): Promise<IThirdPartyUser[]> {
        // TODO: Types
        const path = utils.encodeUri("/thirdparty/user/$protocol", {
            $protocol: protocol,
        });

        return this.http.authedRequest(Method.Get, path, params);
    }

    public getTerms(serviceType: SERVICE_TYPES, baseUrl: string): Promise<any> {
        // TODO: Types
        const url = this.termsUrlForService(serviceType, baseUrl);
        return this.http.requestOtherUrl(Method.Get, url);
    }

    public agreeToTerms(
        serviceType: SERVICE_TYPES,
        baseUrl: string,
        accessToken: string,
        termsUrls: string[],
    ): Promise<{}> {
        const url = this.termsUrlForService(serviceType, baseUrl);
        const headers = {
            Authorization: "Bearer " + accessToken,
        };
        return this.http.requestOtherUrl(
            Method.Post,
            url,
            {
                user_accepts: termsUrls,
            },
            { headers },
        );
    }

    /**
     * Reports an event as inappropriate to the server, which may then notify the appropriate people.
     * @param roomId - The room in which the event being reported is located.
     * @param eventId - The event to report.
     * @param score - The score to rate this content as where -100 is most offensive and 0 is inoffensive.
     * @param reason - The reason the content is being reported. May be blank.
     * @returns Promise which resolves to an empty object if successful
     */
    public reportEvent(roomId: string, eventId: string, score: number, reason: string): Promise<{}> {
        const path = utils.encodeUri("/rooms/$roomId/report/$eventId", {
            $roomId: roomId,
            $eventId: eventId,
        });

        return this.http.authedRequest(Method.Post, path, undefined, { score, reason });
    }

    /**
     * Fetches or paginates a room hierarchy as defined by MSC2946.
     * Falls back gracefully to sourcing its data from `getSpaceSummary` if this API is not yet supported by the server.
     * @param roomId - The ID of the space-room to use as the root of the summary.
     * @param limit - The maximum number of rooms to return per page.
     * @param maxDepth - The maximum depth in the tree from the root room to return.
     * @param suggestedOnly - Whether to only return rooms with suggested=true.
     * @param fromToken - The opaque token to paginate a previous request.
     * @returns the response, with next_batch & rooms fields.
     */
    public getRoomHierarchy(
        roomId: string,
        limit?: number,
        maxDepth?: number,
        suggestedOnly = false,
        fromToken?: string,
    ): Promise<IRoomHierarchy> {
        const path = utils.encodeUri("/rooms/$roomId/hierarchy", {
            $roomId: roomId,
        });

        const queryParams: QueryDict = {
            suggested_only: String(suggestedOnly),
            max_depth: maxDepth?.toString(),
            from: fromToken,
            limit: limit?.toString(),
        };

        return this.http
            .authedRequest<IRoomHierarchy>(Method.Get, path, queryParams, undefined, {
                prefix: ClientPrefix.V1,
            })
            .catch((e) => {
                if (e.errcode === "M_UNRECOGNIZED") {
                    // fall back to the prefixed hierarchy API.
                    return this.http.authedRequest<IRoomHierarchy>(Method.Get, path, queryParams, undefined, {
                        prefix: "/_matrix/client/unstable/org.matrix.msc2946",
                    });
                }

                throw e;
            });
    }

    /**
     * Creates a new file tree space with the given name. The client will pick
     * defaults for how it expects to be able to support the remaining API offered
     * by the returned class.
     *
     * Note that this is UNSTABLE and may have breaking changes without notice.
     * @param name - The name of the tree space.
     * @returns Promise which resolves to the created space.
     */
    public async unstableCreateFileTree(name: string): Promise<MSC3089TreeSpace> {
        const { room_id: roomId } = await this.createRoom({
            name: name,
            preset: Preset.PrivateChat,
            power_level_content_override: {
                ...DEFAULT_TREE_POWER_LEVELS_TEMPLATE,
                users: {
                    [this.getUserId()!]: 100,
                },
            },
            creation_content: {
                [RoomCreateTypeField]: RoomType.Space,
            },
            initial_state: [
                {
                    type: UNSTABLE_MSC3088_PURPOSE.name,
                    state_key: UNSTABLE_MSC3089_TREE_SUBTYPE.name,
                    content: {
                        [UNSTABLE_MSC3088_ENABLED.name]: true,
                    },
                },
                {
                    type: EventType.RoomEncryption,
                    state_key: "",
                    content: {
                        algorithm: olmlib.MEGOLM_ALGORITHM,
                    },
                },
            ],
        });
        return new MSC3089TreeSpace(this, roomId);
    }

    /**
     * Gets a reference to a tree space, if the room ID given is a tree space. If the room
     * does not appear to be a tree space then null is returned.
     *
     * Note that this is UNSTABLE and may have breaking changes without notice.
     * @param roomId - The room ID to get a tree space reference for.
     * @returns The tree space, or null if not a tree space.
     */
    public unstableGetFileTreeSpace(roomId: string): MSC3089TreeSpace | null {
        const room = this.getRoom(roomId);
        if (room?.getMyMembership() !== "join") return null;

        const createEvent = room.currentState.getStateEvents(EventType.RoomCreate, "");
        const purposeEvent = room.currentState.getStateEvents(
            UNSTABLE_MSC3088_PURPOSE.name,
            UNSTABLE_MSC3089_TREE_SUBTYPE.name,
        );

        if (!createEvent) throw new Error("Expected single room create event");

        if (!purposeEvent?.getContent()?.[UNSTABLE_MSC3088_ENABLED.name]) return null;
        if (createEvent.getContent()?.[RoomCreateTypeField] !== RoomType.Space) return null;

        return new MSC3089TreeSpace(this, roomId);
    }

    /**
     * Perform a single MSC3575 sliding sync request.
     * @param req - The request to make.
     * @param proxyBaseUrl - The base URL for the sliding sync proxy.
     * @param abortSignal - Optional signal to abort request mid-flight.
     * @returns The sliding sync response, or a standard error.
     * @throws on non 2xx status codes with an object with a field "httpStatus":number.
     */
    public slidingSync(
        req: MSC3575SlidingSyncRequest,
        proxyBaseUrl?: string,
        abortSignal?: AbortSignal,
    ): Promise<MSC3575SlidingSyncResponse> {
        const qps: Record<string, any> = {};
        if (req.pos) {
            qps.pos = req.pos;
            delete req.pos;
        }
        if (req.timeout) {
            qps.timeout = req.timeout;
            delete req.timeout;
        }
        const clientTimeout = req.clientTimeout;
        delete req.clientTimeout;
        return this.http.authedRequest<MSC3575SlidingSyncResponse>(Method.Post, "/sync", qps, req, {
            prefix: "/_matrix/client/unstable/org.matrix.msc3575",
            baseUrl: proxyBaseUrl,
            localTimeoutMs: clientTimeout,
            abortSignal,
        });
    }

    /**
     * @deprecated use supportsThreads() instead
     */
    public supportsExperimentalThreads(): boolean {
        logger.warn(`supportsExperimentalThreads() is deprecated, use supportThreads() instead`);
        return this.clientOpts?.experimentalThreadSupport || false;
    }

    /**
     * A helper to determine thread support
     * @returns a boolean to determine if threads are enabled
     */
    public supportsThreads(): boolean {
        return this.clientOpts?.threadSupport || false;
    }

    /**
     * A helper to determine intentional mentions support
     * @returns a boolean to determine if intentional mentions are enabled on the server
     * @experimental
     */
    public supportsIntentionalMentions(): boolean {
        return this.canSupport.get(Feature.IntentionalMentions) !== ServerSupport.Unsupported;
    }

    /**
     * Fetches the summary of a room as defined by an initial version of MSC3266 and implemented in Synapse
     * Proposed at https://github.com/matrix-org/matrix-doc/pull/3266
     * @param roomIdOrAlias - The ID or alias of the room to get the summary of.
     * @param via - The list of servers which know about the room if only an ID was provided.
     */
    public async getRoomSummary(roomIdOrAlias: string, via?: string[]): Promise<IRoomSummary> {
        const path = utils.encodeUri("/rooms/$roomid/summary", { $roomid: roomIdOrAlias });
        return this.http.authedRequest(Method.Get, path, { via }, undefined, {
            prefix: "/_matrix/client/unstable/im.nheko.summary",
        });
    }

    /**
     * Processes a list of threaded events and adds them to their respective timelines
     * @param room - the room the adds the threaded events
     * @param threadedEvents - an array of the threaded events
     * @param toStartOfTimeline - the direction in which we want to add the events
     */
    public processThreadEvents(room: Room, threadedEvents: MatrixEvent[], toStartOfTimeline: boolean): void {
        room.processThreadedEvents(threadedEvents, toStartOfTimeline);
    }

    /**
     * Processes a list of thread roots and creates a thread model
     * @param room - the room to create the threads in
     * @param threadedEvents - an array of thread roots
     * @param toStartOfTimeline - the direction
     */
    public processThreadRoots(room: Room, threadedEvents: MatrixEvent[], toStartOfTimeline: boolean): void {
        room.processThreadRoots(threadedEvents, toStartOfTimeline);
    }

    public processBeaconEvents(room?: Room, events?: MatrixEvent[]): void {
        this.processAggregatedTimelineEvents(room, events);
    }

    /**
     * Calls aggregation functions for event types that are aggregated
     * Polls and location beacons
     * @param room - room the events belong to
     * @param events - timeline events to be processed
     * @returns
     */
    public processAggregatedTimelineEvents(room?: Room, events?: MatrixEvent[]): void {
        if (!events?.length) return;
        if (!room) return;

        room.currentState.processBeaconEvents(events, this);
        room.processPollEvents(events);
    }

    /**
     * Fetches information about the user for the configured access token.
     */
    public async whoami(): Promise<IWhoamiResponse> {
        return this.http.authedRequest(Method.Get, "/account/whoami");
    }

    /**
     * Find the event_id closest to the given timestamp in the given direction.
     * @returns Resolves: A promise of an object containing the event_id and
     *    origin_server_ts of the closest event to the timestamp in the given direction
     * @returns Rejects: when the request fails (module:http-api.MatrixError)
     */
    public async timestampToEvent(
        roomId: string,
        timestamp: number,
        dir: Direction,
    ): Promise<TimestampToEventResponse> {
        const path = utils.encodeUri("/rooms/$roomId/timestamp_to_event", {
            $roomId: roomId,
        });
        const queryParams = {
            ts: timestamp.toString(),
            dir: dir,
        };

        try {
            return await this.http.authedRequest(Method.Get, path, queryParams, undefined, {
                prefix: ClientPrefix.V1,
            });
        } catch (err) {
            // Fallback to the prefixed unstable endpoint. Since the stable endpoint is
            // new, we should also try the unstable endpoint before giving up. We can
            // remove this fallback request in a year (remove after 2023-11-28).
            if (
                (<MatrixError>err).errcode === "M_UNRECOGNIZED" &&
                // XXX: The 400 status code check should be removed in the future
                // when Synapse is compliant with MSC3743.
                ((<MatrixError>err).httpStatus === 400 ||
                    // This the correct standard status code for an unsupported
                    // endpoint according to MSC3743. Not Found and Method Not Allowed
                    // both indicate that this endpoint+verb combination is
                    // not supported.
                    (<MatrixError>err).httpStatus === 404 ||
                    (<MatrixError>err).httpStatus === 405)
            ) {
                return await this.http.authedRequest(Method.Get, path, queryParams, undefined, {
                    prefix: "/_matrix/client/unstable/org.matrix.msc3030",
                });
            }

            throw err;
        }
    }
}

/**
 * recalculates an accurate notifications count on event decryption.
 * Servers do not have enough knowledge about encrypted events to calculate an
 * accurate notification_count
 */
export function fixNotificationCountOnDecryption(cli: MatrixClient, event: MatrixEvent): void {
    const ourUserId = cli.getUserId();
    const eventId = event.getId();

    const room = cli.getRoom(event.getRoomId());
    if (!room || !ourUserId || !eventId) return;

    const oldActions = event.getPushActions();
    const actions = cli.getPushActionsForEvent(event, true);

    const isThreadEvent = !!event.threadRootId && !event.isThreadRoot;

    const currentHighlightCount = room.getUnreadCountForEventContext(NotificationCountType.Highlight, event);

    // Ensure the unread counts are kept up to date if the event is encrypted
    // We also want to make sure that the notification count goes up if we already
    // have encrypted events to avoid other code from resetting 'highlight' to zero.
    const oldHighlight = !!oldActions?.tweaks?.highlight;
    const newHighlight = !!actions?.tweaks?.highlight;

    let hasReadEvent;
    if (isThreadEvent) {
        const thread = room.getThread(event.threadRootId);
        hasReadEvent = thread
            ? thread.hasUserReadEvent(ourUserId, eventId)
            : // If the thread object does not exist in the room yet, we don't
              // want to calculate notification for this event yet. We have not
              // restored the read receipts yet and can't accurately calculate
              // notifications at this stage.
              //
              // This issue can likely go away when MSC3874 is implemented
              true;
    } else {
        hasReadEvent = room.hasUserReadEvent(ourUserId, eventId);
    }

    if (hasReadEvent) {
        // If the event has been read, ignore it.
        return;
    }

    if (oldHighlight !== newHighlight || currentHighlightCount > 0) {
        // TODO: Handle mentions received while the client is offline
        // See also https://github.com/vector-im/element-web/issues/9069
        let newCount = currentHighlightCount;
        if (newHighlight && !oldHighlight) newCount++;
        if (!newHighlight && oldHighlight) newCount--;

        if (isThreadEvent) {
            room.setThreadUnreadNotificationCount(event.threadRootId, NotificationCountType.Highlight, newCount);
        } else {
            room.setUnreadNotificationCount(NotificationCountType.Highlight, newCount);
        }
    }

    // Total count is used to typically increment a room notification counter, but not loudly highlight it.
    const currentTotalCount = room.getUnreadCountForEventContext(NotificationCountType.Total, event);

    // `notify` is used in practice for incrementing the total count
    const newNotify = !!actions?.notify;

    // The room total count is NEVER incremented by the server for encrypted rooms. We basically ignore
    // the server here as it's always going to tell us to increment for encrypted events.
    if (newNotify) {
        if (isThreadEvent) {
            room.setThreadUnreadNotificationCount(
                event.threadRootId,
                NotificationCountType.Total,
                currentTotalCount + 1,
            );
        } else {
            room.setUnreadNotificationCount(NotificationCountType.Total, currentTotalCount + 1);
        }
    }
}
