/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { debounce } from "lodash";
import {
    type Beacon,
    type BeaconIdentifier,
    BeaconEvent,
    type MatrixEvent,
    type Room,
    type RoomMember,
    type RoomState,
    RoomStateEvent,
    ContentHelpers,
    type MBeaconInfoEventContent,
    M_BEACON,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import defaultDispatcher from "../dispatcher/dispatcher";
import { type ActionPayload } from "../dispatcher/payloads";
import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import { arrayDiff } from "../utils/arrays";
import {
    type ClearWatchCallback,
    GeolocationError,
    mapGeolocationPositionToTimedGeo,
    sortBeaconsByLatestCreation,
    type TimedGeoUri,
    watchPosition,
    getCurrentPosition,
} from "../utils/beacon";
import { doMaybeLocalRoomAction } from "../utils/local-room";
import SettingsStore from "../settings/SettingsStore";

const isOwnBeacon = (beacon: Beacon, userId: string): boolean => beacon.beaconInfoOwner === userId;

export enum OwnBeaconStoreEvent {
    LivenessChange = "OwnBeaconStore.LivenessChange",
    MonitoringLivePosition = "OwnBeaconStore.MonitoringLivePosition",
    LocationPublishError = "LocationPublishError",
    BeaconUpdateError = "BeaconUpdateError",
}

const MOVING_UPDATE_INTERVAL = 5000;
const STATIC_UPDATE_INTERVAL = 30000;

const BAIL_AFTER_CONSECUTIVE_ERROR_COUNT = 2;

type OwnBeaconStoreState = {
    beacons: Map<BeaconIdentifier, Beacon>;
    beaconLocationPublishErrorCounts: Map<BeaconIdentifier, number>;
    beaconUpdateErrors: Map<BeaconIdentifier, Error>;
    beaconsByRoomId: Map<Room["roomId"], Set<BeaconIdentifier>>;
    liveBeaconIds: BeaconIdentifier[];
};

const CREATED_BEACONS_KEY = "mx_live_beacon_created_id";
const removeLocallyCreateBeaconEventId = (eventId: string): void => {
    const ids = getLocallyCreatedBeaconEventIds();
    window.localStorage.setItem(CREATED_BEACONS_KEY, JSON.stringify(ids.filter((id) => id !== eventId)));
};
const storeLocallyCreateBeaconEventId = (eventId: string): void => {
    const ids = getLocallyCreatedBeaconEventIds();
    window.localStorage.setItem(CREATED_BEACONS_KEY, JSON.stringify([...ids, eventId]));
};

const getLocallyCreatedBeaconEventIds = (): string[] => {
    let ids: string[];
    try {
        ids = JSON.parse(window.localStorage.getItem(CREATED_BEACONS_KEY) ?? "[]");
        if (!Array.isArray(ids)) {
            throw new Error("Invalid stored value");
        }
    } catch (error) {
        logger.error("Failed to retrieve locally created beacon event ids", error);
        ids = [];
    }
    return ids;
};
export class OwnBeaconStore extends AsyncStoreWithClient<OwnBeaconStoreState> {
    private static readonly internalInstance = (() => {
        const instance = new OwnBeaconStore();
        instance.start();
        return instance;
    })();
    // users beacons, keyed by event type
    public readonly beacons = new Map<BeaconIdentifier, Beacon>();
    public readonly beaconsByRoomId = new Map<Room["roomId"], Set<BeaconIdentifier>>();
    /**
     * Track over the wire errors for published positions
     * Counts consecutive wire errors per beacon
     * Reset on successful publish of location
     */
    public readonly beaconLocationPublishErrorCounts = new Map<BeaconIdentifier, number>();
    public readonly beaconUpdateErrors = new Map<BeaconIdentifier, unknown>();
    /**
     * ids of live beacons
     * ordered by creation time descending
     */
    private liveBeaconIds: BeaconIdentifier[] = [];
    private locationInterval?: number;
    private clearPositionWatch?: ClearWatchCallback;
    /**
     * Track when the last position was published
     * So we can manually get position on slow interval
     * when the target is stationary
     */
    private lastPublishedPositionTimestamp?: number;
    /**
     * Ref returned from watchSetting for the MSC3946 labs flag
     */
    private dynamicWatcherRef: string | undefined;

    public constructor() {
        super(defaultDispatcher);
    }

    public static get instance(): OwnBeaconStore {
        return OwnBeaconStore.internalInstance;
    }

    /**
     * True when we have live beacons
     * and geolocation.watchPosition is active
     */
    public get isMonitoringLiveLocation(): boolean {
        return !!this.clearPositionWatch;
    }

    protected async onNotReady(): Promise<void> {
        if (this.matrixClient) {
            this.matrixClient.removeListener(BeaconEvent.LivenessChange, this.onBeaconLiveness);
            this.matrixClient.removeListener(BeaconEvent.New, this.onNewBeacon);
            this.matrixClient.removeListener(BeaconEvent.Update, this.onUpdateBeacon);
            this.matrixClient.removeListener(BeaconEvent.Destroy, this.onDestroyBeacon);
            this.matrixClient.removeListener(RoomStateEvent.Members, this.onRoomStateMembers);
        }
        SettingsStore.unwatchSetting(this.dynamicWatcherRef);

        this.clearBeacons();
    }

    private clearBeacons(): void {
        this.beacons.forEach((beacon) => beacon.destroy());

        this.stopPollingLocation();
        this.beacons.clear();
        this.beaconsByRoomId.clear();
        this.liveBeaconIds = [];
        this.beaconLocationPublishErrorCounts.clear();
        this.beaconUpdateErrors.clear();
    }

    protected async onReady(): Promise<void> {
        if (this.matrixClient) {
            this.matrixClient.on(BeaconEvent.LivenessChange, this.onBeaconLiveness);
            this.matrixClient.on(BeaconEvent.New, this.onNewBeacon);
            this.matrixClient.on(BeaconEvent.Update, this.onUpdateBeacon);
            this.matrixClient.on(BeaconEvent.Destroy, this.onDestroyBeacon);
            this.matrixClient.on(RoomStateEvent.Members, this.onRoomStateMembers);
        }
        this.dynamicWatcherRef = SettingsStore.watchSetting(
            "feature_dynamic_room_predecessors",
            null,
            this.reinitialiseBeaconState,
        );

        this.initialiseBeaconState();
    }

    protected async onAction(payload: ActionPayload): Promise<void> {
        // we don't actually do anything here
    }

    public hasLiveBeacons = (roomId?: string): boolean => {
        return !!this.getLiveBeaconIds(roomId).length;
    };

    /**
     * Some live beacon has a wire error
     * Optionally filter by room
     */
    public hasLocationPublishErrors = (roomId?: string): boolean => {
        return this.getLiveBeaconIds(roomId).some(this.beaconHasLocationPublishError);
    };

    /**
     * If a beacon has failed to publish position
     * past the allowed consecutive failure count (BAIL_AFTER_CONSECUTIVE_ERROR_COUNT)
     * Then consider it to have an error
     */
    public beaconHasLocationPublishError = (beaconId: string): boolean => {
        const counts = this.beaconLocationPublishErrorCounts.get(beaconId);
        return counts !== undefined && counts >= BAIL_AFTER_CONSECUTIVE_ERROR_COUNT;
    };

    public resetLocationPublishError = (beaconId: string): void => {
        this.incrementBeaconLocationPublishErrorCount(beaconId, false);

        // always publish to all live beacons together
        // instead of just one that was changed
        // to keep lastPublishedTimestamp simple
        // and extra published locations don't hurt
        this.publishCurrentLocationToBeacons();
    };

    public getLiveBeaconIds = (roomId?: string): string[] => {
        if (!roomId) {
            return this.liveBeaconIds;
        }
        return this.liveBeaconIds.filter((beaconId) => this.beaconsByRoomId.get(roomId)?.has(beaconId));
    };

    public getLiveBeaconIdsWithLocationPublishError = (roomId?: string): string[] => {
        return this.getLiveBeaconIds(roomId).filter(this.beaconHasLocationPublishError);
    };

    public getBeaconById = (beaconId: string): Beacon | undefined => {
        return this.beacons.get(beaconId);
    };

    public stopBeacon = async (beaconIdentifier: string): Promise<void> => {
        const beacon = this.beacons.get(beaconIdentifier);
        // if no beacon, or beacon is already explicitly set isLive: false
        // do nothing
        if (!beacon?.beaconInfo?.live) {
            return;
        }

        await this.updateBeaconEvent(beacon, { live: false });
        // prune from local store
        removeLocallyCreateBeaconEventId(beacon.beaconInfoId);
    };

    /**
     * Listeners
     */

    private onNewBeacon = (_event: MatrixEvent, beacon: Beacon): void => {
        if (!this.matrixClient || !isOwnBeacon(beacon, this.matrixClient.getUserId()!)) {
            return;
        }
        this.addBeacon(beacon);
        this.checkLiveness();
    };

    /**
     * This will be called when a beacon is replaced
     */
    private onUpdateBeacon = (_event: MatrixEvent, beacon: Beacon): void => {
        if (!this.matrixClient || !isOwnBeacon(beacon, this.matrixClient.getUserId()!)) {
            return;
        }

        this.checkLiveness();
        beacon.monitorLiveness();
    };

    private onDestroyBeacon = (beaconIdentifier: BeaconIdentifier): void => {
        // check if we care about this beacon
        if (!this.beacons.has(beaconIdentifier)) {
            return;
        }

        this.checkLiveness();
    };

    private onBeaconLiveness = (isLive: boolean, beacon: Beacon): void => {
        // check if we care about this beacon
        if (!this.beacons.has(beacon.identifier)) {
            return;
        }

        // beacon expired, update beacon to un-alive state
        if (!isLive) {
            this.stopBeacon(beacon.identifier);
        }

        this.checkLiveness();

        this.emit(OwnBeaconStoreEvent.LivenessChange, this.getLiveBeaconIds());
    };

    /**
     * Check for changes in membership in rooms with beacons
     * and stop monitoring beacons in rooms user is no longer member of
     */
    private onRoomStateMembers = (_event: MatrixEvent, roomState: RoomState, member: RoomMember): void => {
        // no beacons for this room, ignore
        if (
            !this.matrixClient ||
            !this.beaconsByRoomId.has(roomState.roomId) ||
            member.userId !== this.matrixClient.getUserId()
        ) {
            return;
        }

        // TODO check powerlevels here
        // in PSF-797

        // stop watching beacons in rooms where user is no longer a member
        if (member.membership === KnownMembership.Leave || member.membership === KnownMembership.Ban) {
            this.beaconsByRoomId.get(roomState.roomId)?.forEach(this.removeBeacon);
            this.beaconsByRoomId.delete(roomState.roomId);
        }
    };

    /**
     * State management
     */

    /**
     * Live beacon ids that do not have wire errors
     */
    private get healthyLiveBeaconIds(): string[] {
        return this.liveBeaconIds.filter(
            (beaconId) => !this.beaconHasLocationPublishError(beaconId) && !this.beaconUpdateErrors.has(beaconId),
        );
    }

    /**
     * @internal public for test only
     */
    public reinitialiseBeaconState = (): void => {
        this.clearBeacons();
        this.initialiseBeaconState();
    };

    private initialiseBeaconState = (): void => {
        if (!this.matrixClient) return;
        const userId = this.matrixClient.getSafeUserId();
        const visibleRooms = this.matrixClient.getVisibleRooms(
            SettingsStore.getValue("feature_dynamic_room_predecessors"),
        );

        visibleRooms.forEach((room) => {
            const roomState = room.currentState;
            const beacons = roomState.beacons;
            const ownBeaconsArray = [...beacons.values()].filter((beacon) => isOwnBeacon(beacon, userId));
            ownBeaconsArray.forEach((beacon) => this.addBeacon(beacon));
        });

        this.checkLiveness();
    };

    private addBeacon = (beacon: Beacon): void => {
        this.beacons.set(beacon.identifier, beacon);

        if (!this.beaconsByRoomId.has(beacon.roomId)) {
            this.beaconsByRoomId.set(beacon.roomId, new Set<string>());
        }

        this.beaconsByRoomId.get(beacon.roomId)!.add(beacon.identifier);

        beacon.monitorLiveness();
    };

    /**
     * Remove listeners for a given beacon
     * remove from state
     * and update liveness if changed
     */
    private removeBeacon = (beaconId: string): void => {
        if (!this.beacons.has(beaconId)) {
            return;
        }
        this.beacons.get(beaconId)!.destroy();
        this.beacons.delete(beaconId);

        this.checkLiveness();
    };

    private checkLiveness = (): void => {
        const locallyCreatedBeaconEventIds = getLocallyCreatedBeaconEventIds();
        const prevLiveBeaconIds = this.getLiveBeaconIds();
        this.liveBeaconIds = [...this.beacons.values()]
            .filter(
                (beacon) =>
                    beacon.isLive &&
                    // only beacons created on this device should be shared to
                    locallyCreatedBeaconEventIds.includes(beacon.beaconInfoId),
            )
            .sort(sortBeaconsByLatestCreation)
            .map((beacon) => beacon.identifier);

        const diff = arrayDiff(prevLiveBeaconIds, this.liveBeaconIds);

        if (diff.added.length || diff.removed.length) {
            this.emit(OwnBeaconStoreEvent.LivenessChange, this.liveBeaconIds);
        }

        // publish current location immediately
        // when there are new live beacons
        // and we already have a live monitor
        // so first position is published quickly
        // even when target is stationary
        //
        // when there is no existing live monitor
        // it will be created below by togglePollingLocation
        // and publish first position quickly
        if (diff.added.length && this.isMonitoringLiveLocation) {
            this.publishCurrentLocationToBeacons();
        }

        // if overall liveness changed
        if (!!prevLiveBeaconIds?.length !== !!this.liveBeaconIds.length) {
            this.togglePollingLocation();
        }
    };

    public createLiveBeacon = async (
        roomId: Room["roomId"],
        beaconInfoContent: MBeaconInfoEventContent,
    ): Promise<void> => {
        if (!this.matrixClient) return;
        // explicitly stop any live beacons this user has
        // to ensure they remain stopped
        // if the new replacing beacon is redacted
        const existingLiveBeaconIdsForRoom = this.getLiveBeaconIds(roomId);
        await Promise.all(existingLiveBeaconIdsForRoom.map((beaconId) => this.stopBeacon(beaconId)));

        // eslint-disable-next-line camelcase
        const { event_id } = await doMaybeLocalRoomAction(
            roomId,
            (actualRoomId: string) => this.matrixClient!.unstable_createLiveBeacon(actualRoomId, beaconInfoContent),
            this.matrixClient,
        );

        storeLocallyCreateBeaconEventId(event_id);
    };

    /**
     * Geolocation
     */

    private togglePollingLocation = (): void => {
        if (!!this.liveBeaconIds.length) {
            this.startPollingLocation();
        } else {
            this.stopPollingLocation();
        }
    };

    private startPollingLocation = async (): Promise<void> => {
        // clear any existing interval
        this.stopPollingLocation();

        try {
            this.clearPositionWatch = watchPosition(this.onWatchedPosition, this.onGeolocationError);
        } catch (error) {
            if (error instanceof Error) {
                this.onGeolocationError(error.message as GeolocationError);
            } else {
                console.error("Unexpected error", error);
            }
            // don't set locationInterval if geolocation failed to setup
            return;
        }

        this.locationInterval = window.setInterval(() => {
            if (!this.lastPublishedPositionTimestamp) {
                return;
            }
            // if position was last updated STATIC_UPDATE_INTERVAL ms ago or more
            // get our position and publish it
            if (this.lastPublishedPositionTimestamp <= Date.now() - STATIC_UPDATE_INTERVAL) {
                this.publishCurrentLocationToBeacons();
            }
        }, STATIC_UPDATE_INTERVAL);

        this.emit(OwnBeaconStoreEvent.MonitoringLivePosition);
    };

    private stopPollingLocation = (): void => {
        clearInterval(this.locationInterval);
        this.locationInterval = undefined;
        this.lastPublishedPositionTimestamp = undefined;

        if (this.clearPositionWatch) {
            this.clearPositionWatch();
            this.clearPositionWatch = undefined;
        }

        this.emit(OwnBeaconStoreEvent.MonitoringLivePosition);
    };

    private onWatchedPosition = (position: GeolocationPosition): void => {
        const timedGeoPosition = mapGeolocationPositionToTimedGeo(position);

        // if this is our first position, publish immediately
        if (!this.lastPublishedPositionTimestamp) {
            this.publishLocationToBeacons(timedGeoPosition);
        } else {
            this.debouncedPublishLocationToBeacons(timedGeoPosition);
        }
    };

    private onGeolocationError = async (error: GeolocationError): Promise<void> => {
        logger.error("Geolocation failed", error);

        // other errors are considered non-fatal
        // and self recovering
        if (![GeolocationError.Unavailable, GeolocationError.PermissionDenied].includes(error)) {
            return;
        }

        this.stopPollingLocation();
        // kill live beacons when location permissions are revoked
        await Promise.all(this.liveBeaconIds.map(this.stopBeacon));
    };

    /**
     * Gets the current location
     * (as opposed to using watched location)
     * and publishes it to all live beacons
     */
    private publishCurrentLocationToBeacons = async (): Promise<void> => {
        try {
            const position = await getCurrentPosition();
            this.publishLocationToBeacons(mapGeolocationPositionToTimedGeo(position));
        } catch (error) {
            if (error instanceof Error) {
                this.onGeolocationError(error.message as GeolocationError);
            } else {
                console.error("Unexpected error", error);
            }
        }
    };

    /**
     * MatrixClient api
     */

    /**
     * Updates beacon with provided content update
     * Records error in beaconUpdateErrors
     * rethrows
     */
    private updateBeaconEvent = async (
        beacon: Beacon,
        update: Partial<ContentHelpers.BeaconInfoState>,
    ): Promise<void> => {
        const { description, timeout, timestamp, live, assetType } = {
            ...beacon.beaconInfo,
            ...update,
        };

        const updateContent = ContentHelpers.makeBeaconInfoContent(timeout, live, description, assetType, timestamp);

        try {
            await this.matrixClient!.unstable_setLiveBeacon(beacon.roomId, updateContent);
            // cleanup any errors
            const hadError = this.beaconUpdateErrors.has(beacon.identifier);
            if (hadError) {
                this.beaconUpdateErrors.delete(beacon.identifier);
                this.emit(OwnBeaconStoreEvent.BeaconUpdateError, beacon.identifier, false);
            }
        } catch (error) {
            logger.error("Failed to update beacon", error);
            this.beaconUpdateErrors.set(beacon.identifier, error);
            this.emit(OwnBeaconStoreEvent.BeaconUpdateError, beacon.identifier, true);

            throw error;
        }
    };

    /**
     * Sends m.location events to all live beacons
     * Sets last published beacon
     */
    private publishLocationToBeacons = async (position: TimedGeoUri): Promise<void> => {
        this.lastPublishedPositionTimestamp = Date.now();
        await Promise.all(
            this.healthyLiveBeaconIds.map((beaconId) =>
                this.beacons.has(beaconId) ? this.sendLocationToBeacon(this.beacons.get(beaconId)!, position) : null,
            ),
        );
    };

    private debouncedPublishLocationToBeacons = debounce(this.publishLocationToBeacons, MOVING_UPDATE_INTERVAL);

    /**
     * Sends m.location event to referencing given beacon
     */
    private sendLocationToBeacon = async (beacon: Beacon, { geoUri, timestamp }: TimedGeoUri): Promise<void> => {
        const content = ContentHelpers.makeBeaconContent(geoUri, timestamp, beacon.beaconInfoId);
        try {
            await this.matrixClient!.sendEvent(beacon.roomId, M_BEACON.name, content);
            this.incrementBeaconLocationPublishErrorCount(beacon.identifier, false);
        } catch (error) {
            logger.error(error);
            this.incrementBeaconLocationPublishErrorCount(beacon.identifier, true);
        }
    };

    /**
     * Manage beacon wire error count
     * - clear count for beacon when not error
     * - increment count for beacon when is error
     * - emit if beacon error count crossed threshold
     */
    private incrementBeaconLocationPublishErrorCount = (beaconId: string, isError: boolean): void => {
        const hadError = this.beaconHasLocationPublishError(beaconId);

        if (isError) {
            // increment error count
            this.beaconLocationPublishErrorCounts.set(
                beaconId,
                (this.beaconLocationPublishErrorCounts.get(beaconId) ?? 0) + 1,
            );
        } else {
            // clear any error count
            this.beaconLocationPublishErrorCounts.delete(beaconId);
        }

        if (this.beaconHasLocationPublishError(beaconId) !== hadError) {
            this.emit(OwnBeaconStoreEvent.LocationPublishError, beaconId);
        }
    };
}
