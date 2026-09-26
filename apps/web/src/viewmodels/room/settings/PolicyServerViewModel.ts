/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type MatrixEvent, type Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { type RoomPolicyContent } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type PolicyServerViewSnapshot,
    type PolicyServerViewModel as PolicyServerViewModelInterface,
} from "@element-hq/web-shared-components";

import {
    defaultPolicyServerDiscovery,
    normalisePolicyServerName,
    type PolicyServerDiscovery,
} from "../../../utils/PolicyServerDiscovery";

interface Props {
    /**
     * The room whose policy server is being viewed or changed.
     */
    room: Room;
    /**
     * The well-known lookups to use. Defaults to real network requests; injectable for tests.
     */
    discovery?: PolicyServerDiscovery;
}

/**
 * What the room state currently says about the policy server.
 */
interface RoomPolicyState {
    currentServerName: string;
    isLegacyConfig: boolean;
    /**
     * Whether the room still has a pre-stabilisation `org.matrix.msc4284.policy` event with content,
     * regardless of whether a stable event exists as well.
     */
    hasLegacyEvent: boolean;
    canChange: boolean;
}

type MutableSnapshot = Omit<PolicyServerViewSnapshot, "canApply">;

function viaFromEvent(event: MatrixEvent | null): string | undefined {
    const via = event?.getContent<Partial<RoomPolicyContent>>().via;
    return typeof via === "string" && via.length > 0 ? via : undefined;
}

function readRoomPolicyState(room: Room): RoomPolicyState {
    const state = room.currentState;
    const userId = room.client.getSafeUserId();

    const stableVia = viaFromEvent(state.getStateEvents(EventType.RoomPolicy, ""));
    const legacyVia = viaFromEvent(state.getStateEvents(EventType.RoomPolicyUnstable, ""));
    const hasLegacyEvent = legacyVia !== undefined;

    let canChange = state.maySendStateEvent(EventType.RoomPolicy, userId);
    if (hasLegacyEvent) {
        // Applying also clears the legacy event, so we need permission for that too.
        canChange = canChange && state.maySendStateEvent(EventType.RoomPolicyUnstable, userId);
    }

    if (stableVia !== undefined) {
        return { currentServerName: stableVia, isLegacyConfig: false, hasLegacyEvent, canChange };
    }
    if (legacyVia !== undefined) {
        return { currentServerName: legacyVia, isLegacyConfig: true, hasLegacyEvent, canChange };
    }
    return { currentServerName: "", isLegacyConfig: false, hasLegacyEvent, canChange };
}

function computeCanApply(snapshot: MutableSnapshot): boolean {
    if (!snapshot.canChange || snapshot.busy) return false;
    // Re-applying an unchanged legacy configuration migrates it to the stable event.
    return normalisePolicyServerName(snapshot.serverName) !== snapshot.currentServerName || snapshot.isLegacyConfig;
}

/**
 * View model for the policy server (`m.room.policy`, MSC4284) section of room settings.
 *
 * Reads the room's current policy server from room state, including rooms still configured with the
 * pre-stabilisation event type, and lets a sufficiently privileged user change or clear it. Changing
 * it resolves the entered server name to its public keys via `/.well-known/matrix/policy_server`
 * before sending the state event, as the spec describes for clients.
 */
export class PolicyServerViewModel
    extends BaseViewModel<PolicyServerViewSnapshot, Props>
    implements PolicyServerViewModelInterface
{
    private readonly discovery: PolicyServerDiscovery;
    private roomState: RoomPolicyState;

    public constructor(props: Props) {
        const roomState = readRoomPolicyState(props.room);
        const initial: MutableSnapshot = {
            serverName: roomState.currentServerName,
            currentServerName: roomState.currentServerName,
            isLegacyConfig: roomState.isLegacyConfig,
            canChange: roomState.canChange,
            busy: false,
            error: null,
            supportUrl: null,
        };
        super(props, { ...initial, canApply: computeCanApply(initial) });

        this.discovery = props.discovery ?? defaultPolicyServerDiscovery;
        this.roomState = roomState;

        this.disposables.trackListener(props.room.currentState, RoomStateEvent.Update, this.onRoomStateUpdate);
        void this.refreshSupportUrl(roomState.currentServerName);
    }

    public setServerName = (serverName: string): void => {
        this.update({ serverName, error: null });
    };

    public apply = async (): Promise<void> => {
        const { busy, canChange, currentServerName, isLegacyConfig } = this.snapshot.current;
        if (busy || !canChange) return;

        const serverName = normalisePolicyServerName(this.snapshot.current.serverName);
        if (serverName === currentServerName && !isLegacyConfig) return;

        this.update({ busy: true, error: null, serverName });

        const { room } = this.props;
        const client = room.client;
        try {
            if (serverName) {
                let wellKnown;
                try {
                    wellKnown = await this.discovery.lookupPolicyServer(serverName);
                } catch (e) {
                    logger.warn(`Could not look up policy server ${serverName}`, e);
                    this.update({ busy: false, error: "lookup_failed" });
                    return;
                }
                await client.sendStateEvent(
                    room.roomId,
                    EventType.RoomPolicy,
                    { via: serverName, public_keys: wellKnown.public_keys },
                    "",
                );
            } else {
                // An empty content object removes the policy server.
                await client.sendStateEvent(room.roomId, EventType.RoomPolicy, {}, "");
            }

            if (this.roomState.hasLegacyEvent) {
                // Servers still honouring the pre-stabilisation event would otherwise keep using it.
                await client.sendStateEvent(room.roomId, EventType.RoomPolicyUnstable, {}, "");
            }

            // Reflect the accepted change straight away rather than waiting for it to sync back.
            this.update({ busy: false, currentServerName: serverName, isLegacyConfig: false });
        } catch (e) {
            logger.error(`Failed to update the policy server of room ${room.roomId}`, e);
            this.update({ busy: false, error: "update_failed" });
        }
    };

    private onRoomStateUpdate = (): void => {
        const previous = this.roomState;
        const next = readRoomPolicyState(this.props.room);
        this.roomState = next;

        const changes: Partial<MutableSnapshot> = {
            currentServerName: next.currentServerName,
            isLegacyConfig: next.isLegacyConfig,
            canChange: next.canChange,
        };
        // Follow the room unless the user has typed something other than what the room had.
        if (this.snapshot.current.serverName === previous.currentServerName) {
            changes.serverName = next.currentServerName;
        }
        this.update(changes);

        if (next.currentServerName !== previous.currentServerName) {
            void this.refreshSupportUrl(next.currentServerName);
        }
    };

    private async refreshSupportUrl(serverName: string): Promise<void> {
        if (!serverName) {
            this.update({ supportUrl: null });
            return;
        }
        const supportUrl = (await this.discovery.lookupSupportPage(serverName)) ?? null;
        // The room may have moved on while we were waiting.
        if (this.isDisposed || this.snapshot.current.currentServerName !== serverName) return;
        this.update({ supportUrl });
    }

    /**
     * Merge changes into the snapshot, keeping the derived `canApply` in step.
     */
    private update(changes: Partial<MutableSnapshot>): void {
        const next = { ...this.snapshot.current, ...changes };
        this.snapshot.merge({ ...changes, canApply: computeCanApply(next) });
    }
}
