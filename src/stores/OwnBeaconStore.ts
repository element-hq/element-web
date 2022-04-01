/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { debounce } from "lodash";
import {
    Beacon,
    BeaconEvent,
    MatrixEvent,
    Room,
    RoomMember,
    RoomState,
    RoomStateEvent,
} from "matrix-js-sdk/src/matrix";
import {
    BeaconInfoState, makeBeaconContent, makeBeaconInfoContent,
} from "matrix-js-sdk/src/content-helpers";
import { M_BEACON } from "matrix-js-sdk/src/@types/beacon";
import { logger } from "matrix-js-sdk/src/logger";

import defaultDispatcher from "../dispatcher/dispatcher";
import { ActionPayload } from "../dispatcher/payloads";
import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import { arrayDiff } from "../utils/arrays";
import {
    ClearWatchCallback,
    GeolocationError,
    mapGeolocationPositionToTimedGeo,
    sortBeaconsByLatestCreation,
    TimedGeoUri,
    watchPosition,
} from "../utils/beacon";
import { getCurrentPosition } from "../utils/beacon/geolocation";

const isOwnBeacon = (beacon: Beacon, userId: string): boolean => beacon.beaconInfoOwner === userId;

export enum OwnBeaconStoreEvent {
    LivenessChange = 'OwnBeaconStore.LivenessChange',
    MonitoringLivePosition = 'OwnBeaconStore.MonitoringLivePosition',
    WireError = 'WireError',
}

const MOVING_UPDATE_INTERVAL = 2000;
const STATIC_UPDATE_INTERVAL = 30000;

const BAIL_AFTER_CONSECUTIVE_ERROR_COUNT = 2;

type OwnBeaconStoreState = {
    beacons: Map<string, Beacon>;
    beaconWireErrors: Map<string, Beacon>;
    beaconsByRoomId: Map<Room['roomId'], Set<string>>;
    liveBeaconIds: string[];
};
export class OwnBeaconStore extends AsyncStoreWithClient<OwnBeaconStoreState> {
    private static internalInstance = new OwnBeaconStore();
    // users beacons, keyed by event type
    public readonly beacons = new Map<string, Beacon>();
    public readonly beaconsByRoomId = new Map<Room['roomId'], Set<string>>();
    /**
     * Track over the wire errors for published positions
     * Counts consecutive wire errors per beacon
     * Reset on successful publish of location
     */
    public readonly beaconWireErrorCounts = new Map<string, number>();
    /**
     * ids of live beacons
     * ordered by creation time descending
     */
    private liveBeaconIds = [];
    private locationInterval: number;
    private geolocationError: GeolocationError | undefined;
    private clearPositionWatch: ClearWatchCallback | undefined;
    /**
     * Track when the last position was published
     * So we can manually get position on slow interval
     * when the target is stationary
     */
    private lastPublishedPositionTimestamp: number | undefined;

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

    protected async onNotReady() {
        this.matrixClient.removeListener(BeaconEvent.LivenessChange, this.onBeaconLiveness);
        this.matrixClient.removeListener(BeaconEvent.New, this.onNewBeacon);
        this.matrixClient.removeListener(RoomStateEvent.Members, this.onRoomStateMembers);

        this.beacons.forEach(beacon => beacon.destroy());

        this.stopPollingLocation();
        this.beacons.clear();
        this.beaconsByRoomId.clear();
        this.liveBeaconIds = [];
        this.beaconWireErrorCounts.clear();
    }

    protected async onReady(): Promise<void> {
        this.matrixClient.on(BeaconEvent.LivenessChange, this.onBeaconLiveness);
        this.matrixClient.on(BeaconEvent.New, this.onNewBeacon);
        this.matrixClient.on(RoomStateEvent.Members, this.onRoomStateMembers);

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
    public hasWireErrors = (roomId?: string): boolean => {
        return this.getLiveBeaconIds(roomId).some(this.beaconHasWireError);
    };

    /**
     * If a beacon has failed to publish position
     * past the allowed consecutive failure count (BAIL_AFTER_CONSECUTIVE_ERROR_COUNT)
     * Then consider it to have an error
     */
    public beaconHasWireError = (beaconId: string): boolean => {
        return this.beaconWireErrorCounts.get(beaconId) >= BAIL_AFTER_CONSECUTIVE_ERROR_COUNT;
    };

    public resetWireError = (beaconId: string): void => {
        this.incrementBeaconWireErrorCount(beaconId, false);

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
        return this.liveBeaconIds.filter(beaconId => this.beaconsByRoomId.get(roomId)?.has(beaconId));
    };

    public getLiveBeaconIdsWithWireError = (roomId?: string): string[] => {
        return this.getLiveBeaconIds(roomId).filter(this.beaconHasWireError);
    };

    public getBeaconById = (beaconId: string): Beacon | undefined => {
        return this.beacons.get(beaconId);
    };

    public stopBeacon = async (beaconInfoType: string): Promise<void> => {
        const beacon = this.beacons.get(beaconInfoType);
        // if no beacon, or beacon is already explicitly set isLive: false
        // do nothing
        if (!beacon?.beaconInfo?.live) {
            return;
        }

        return await this.updateBeaconEvent(beacon, { live: false });
    };

    /**
     * Listeners
     */

    private onNewBeacon = (_event: MatrixEvent, beacon: Beacon): void => {
        if (!isOwnBeacon(beacon, this.matrixClient.getUserId())) {
            return;
        }
        this.addBeacon(beacon);
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
            !this.beaconsByRoomId.has(roomState.roomId) ||
            member.userId !== this.matrixClient.getUserId()
        ) {
            return;
        }

        // TODO check powerlevels here
        // in PSF-797

        // stop watching beacons in rooms where user is no longer a member
        if (member.membership === 'leave' || member.membership === 'ban') {
            this.beaconsByRoomId.get(roomState.roomId).forEach(this.removeBeacon);
            this.beaconsByRoomId.delete(roomState.roomId);
        }
    };

    /**
     * State management
     */

    /**
     * Live beacon ids that do not have wire errors
     */
    private get healthyLiveBeaconIds() {
        return this.liveBeaconIds.filter(beaconId => !this.beaconHasWireError(beaconId));
    }

    private initialiseBeaconState = () => {
        const userId = this.matrixClient.getUserId();
        const visibleRooms = this.matrixClient.getVisibleRooms();

        visibleRooms
            .forEach(room => {
                const roomState = room.currentState;
                const beacons = roomState.beacons;
                const ownBeaconsArray = [...beacons.values()].filter(beacon => isOwnBeacon(beacon, userId));
                ownBeaconsArray.forEach(beacon => this.addBeacon(beacon));
            });

        this.checkLiveness();
    };

    private addBeacon = (beacon: Beacon): void => {
        this.beacons.set(beacon.identifier, beacon);

        if (!this.beaconsByRoomId.has(beacon.roomId)) {
            this.beaconsByRoomId.set(beacon.roomId, new Set<string>());
        }

        this.beaconsByRoomId.get(beacon.roomId).add(beacon.identifier);

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
        this.beacons.get(beaconId).destroy();
        this.beacons.delete(beaconId);

        this.checkLiveness();
    };

    private checkLiveness = (): void => {
        const prevLiveBeaconIds = this.getLiveBeaconIds();
        this.liveBeaconIds = [...this.beacons.values()]
            .filter(beacon => beacon.isLive)
            .sort(sortBeaconsByLatestCreation)
            .map(beacon => beacon.identifier);

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

    /**
     * Geolocation
     */

    private togglePollingLocation = () => {
        if (!!this.liveBeaconIds.length) {
            this.startPollingLocation();
        } else {
            this.stopPollingLocation();
        }
    };

    private startPollingLocation = async () => {
        // clear any existing interval
        this.stopPollingLocation();

        try {
            this.clearPositionWatch = await watchPosition(
                this.onWatchedPosition,
                this.onGeolocationError,
            );
        } catch (error) {
            this.onGeolocationError(error?.message);
            // don't set locationInterval if geolocation failed to setup
            return;
        }

        this.locationInterval = setInterval(() => {
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

    private stopPollingLocation = () => {
        clearInterval(this.locationInterval);
        this.locationInterval = undefined;
        this.lastPublishedPositionTimestamp = undefined;
        this.geolocationError = undefined;

        if (this.clearPositionWatch) {
            this.clearPositionWatch();
            this.clearPositionWatch = undefined;
        }

        this.emit(OwnBeaconStoreEvent.MonitoringLivePosition);
    };

    private onWatchedPosition = (position: GeolocationPosition) => {
        const timedGeoPosition = mapGeolocationPositionToTimedGeo(position);

        // if this is our first position, publish immediateley
        if (!this.lastPublishedPositionTimestamp) {
            this.publishLocationToBeacons(timedGeoPosition);
        } else {
            this.debouncedPublishLocationToBeacons(timedGeoPosition);
        }
    };

    private onGeolocationError = async (error: GeolocationError): Promise<void> => {
        this.geolocationError = error;
        logger.error('Geolocation failed', this.geolocationError);

        // other errors are considered non-fatal
        // and self recovering
        if (![
            GeolocationError.Unavailable,
            GeolocationError.PermissionDenied,
        ].includes(error)) {
            return;
        }

        this.stopPollingLocation();
        // kill live beacons when location permissions are revoked
        // TODO may need adjustment when PSF-797 is done
        await Promise.all(this.liveBeaconIds.map(this.stopBeacon));
    };

    /**
     * Gets the current location
     * (as opposed to using watched location)
     * and publishes it to all live beacons
     */
    private publishCurrentLocationToBeacons = async () => {
        try {
            const position = await getCurrentPosition();
            this.publishLocationToBeacons(mapGeolocationPositionToTimedGeo(position));
        } catch (error) {
            this.onGeolocationError(error?.message);
        }
    };

    /**
     * MatrixClient api
     */

    private updateBeaconEvent = async (beacon: Beacon, update: Partial<BeaconInfoState>): Promise<void> => {
        const { description, timeout, timestamp, live, assetType } = {
            ...beacon.beaconInfo,
            ...update,
        };

        const updateContent = makeBeaconInfoContent(timeout,
            live,
            description,
            assetType,
            timestamp);

        await this.matrixClient.unstable_setLiveBeacon(beacon.roomId, beacon.beaconInfoEventType, updateContent);
    };

    /**
     * Sends m.location events to all live beacons
     * Sets last published beacon
     */
    private publishLocationToBeacons = async (position: TimedGeoUri) => {
        this.lastPublishedPositionTimestamp = Date.now();
        await Promise.all(this.healthyLiveBeaconIds.map(beaconId =>
            this.sendLocationToBeacon(this.beacons.get(beaconId), position)),
        );
    };

    private debouncedPublishLocationToBeacons = debounce(this.publishLocationToBeacons, MOVING_UPDATE_INTERVAL);

    /**
     * Sends m.location event to referencing given beacon
     */
    private sendLocationToBeacon = async (beacon: Beacon, { geoUri, timestamp }: TimedGeoUri) => {
        const content = makeBeaconContent(geoUri, timestamp, beacon.beaconInfoId);
        try {
            await this.matrixClient.sendEvent(beacon.roomId, M_BEACON.name, content);
            this.incrementBeaconWireErrorCount(beacon.identifier, false);
        } catch (error) {
            logger.error(error);
            this.incrementBeaconWireErrorCount(beacon.identifier, true);
        }
    };

    /**
     * Manage beacon wire error count
     * - clear count for beacon when not error
     * - increment count for beacon when is error
     * - emit if beacon error count crossed threshold
     */
    private incrementBeaconWireErrorCount = (beaconId: string, isError: boolean): void => {
        const hadError = this.beaconHasWireError(beaconId);

        if (isError) {
            // increment error count
            this.beaconWireErrorCounts.set(
                beaconId,
                (this.beaconWireErrorCounts.get(beaconId) ?? 0) + 1,
            );
        } else {
            // clear any error count
            this.beaconWireErrorCounts.delete(beaconId);
        }

        if (this.beaconHasWireError(beaconId) !== hadError) {
            this.emit(OwnBeaconStoreEvent.WireError, beaconId);
        }
    };
}
