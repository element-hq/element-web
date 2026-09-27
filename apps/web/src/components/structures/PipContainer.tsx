/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type RefObject, type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { CallEvent, CallState, type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { useCreateAutoDisposedViewModel, WidgetPipView } from "@element-hq/web-shared-components";

import LegacyCallView from "../views/voip/LegacyCallView";
import { LegacyCallHandlerEvent } from "../../LegacyCallHandler";
import PictureInPictureDragger, { type PipSlot, pipRowsPerColumn } from "./PictureInPictureDragger";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent, type PersistentWidget } from "../../stores/ActiveWidgetStore";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import RoomAvatar from "../views/avatars/RoomAvatar";
import { WidgetPipViewModel, type Props as WidgetPipViewModelProps } from "../../viewmodels/room/WidgetPipViewModel";
import { SDKContext } from "../../contexts/SDKContext.ts";
import { getOrCreateMasterContainer, getPersistKey } from "../views/elements/PersistedElement";
import WidgetUtils from "../../utils/WidgetUtils";

/** Above the persisted elements that are not PiPs (101) */
const PIP_Z_BASE = 200;

const SHOW_CALL_IN_STATES = [
    CallState.Connected,
    CallState.InviteSent,
    CallState.Connecting,
    CallState.CreateAnswer,
    CallState.CreateOffer,
    CallState.WaitLocalMedia,
];

type IProps = EmptyObject;

interface IState {
    viewedRoomId?: string;

    // The main call that we are displaying (ie. not including the call in the room being viewed, if any)
    primaryCall: MatrixCall | null;

    // Any other call we're displaying: only if the user is on two calls and not viewing either of the rooms
    // they belong to
    secondaryCall: MatrixCall;

    // The persistent widgets to show as PiPs: every call not visible in the room view, the foreground
    // one first, the others on hold
    pipWidgets: PersistentWidget[];
}

/**
 * PipContainer shows a small version of the LegacyCallView or a sticky widget hovering over the UI in
 * 'picture-in-picture' (PiP mode). It displays the call(s) which is *not* in the room the user is currently viewing
 * and all widgets that are active but not shown in any other possible container.
 */

class PipContainerInner extends React.Component<IProps, IState> {
    public static contextType = SDKContext;
    declare public context: React.ContextType<typeof SDKContext>;

    public constructor(props: IProps, context: React.ContextType<typeof SDKContext>) {
        super(props, context);

        const roomId = this.context.roomViewStore.getRoomId();

        const [primaryCall, secondaryCalls] = this.getPrimarySecondaryCallsForPip(roomId);

        this.state = {
            viewedRoomId: roomId || undefined,
            primaryCall: primaryCall || null,
            secondaryCall: secondaryCalls[0],
            pipWidgets: [],
        };
    }

    public componentDidMount(): void {
        this.updateShowWidgetInPip();
        this.context.legacyCallHandler.addListener(LegacyCallHandlerEvent.CallChangeRoom, this.updateCalls);
        this.context.legacyCallHandler.addListener(LegacyCallHandlerEvent.CallState, this.updateCalls);
        this.context.roomViewStore.addListener(UPDATE_EVENT, this.onRoomViewStoreUpdate);
        this.context.client?.on(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
        const room = this.context.client?.getRoom(this.state.viewedRoomId);
        if (room) {
            this.context.widgetLayoutStore.on(WidgetLayoutStore.emissionForRoom(room), this.updateCalls);
        }
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Persistence, this.onWidgetPersistence);
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Dock, this.onWidgetDockChanges);
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Undock, this.onWidgetDockChanges);
    }

    public componentDidUpdate(): void {
        this.stackPersistedContent();
    }

    public componentWillUnmount(): void {
        this.context.legacyCallHandler.removeListener(LegacyCallHandlerEvent.CallChangeRoom, this.updateCalls);
        this.context.legacyCallHandler.removeListener(LegacyCallHandlerEvent.CallState, this.updateCalls);
        this.context.client?.removeListener(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
        this.context.roomViewStore.removeListener(UPDATE_EVENT, this.onRoomViewStoreUpdate);
        const room = this.context.client?.getRoom(this.state.viewedRoomId);
        if (room) {
            this.context.widgetLayoutStore.off(WidgetLayoutStore.emissionForRoom(room), this.updateCalls);
        }
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Persistence, this.onWidgetPersistence);
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Dock, this.onWidgetDockChanges);
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Undock, this.onWidgetDockChanges);
    }

    /**
     * Splits a list of calls into one 'primary' one and a list
     * (which should be a single element) of other calls.
     * The primary will be the one not on hold, or an arbitrary one
     * if they're all on hold)
     */
    private getPrimarySecondaryCallsForPip(roomId: string | null): [MatrixCall | null, MatrixCall[]] {
        if (!roomId) return [null, []];

        const calls = this.context.legacyCallHandler.getAllActiveCallsForPip(roomId);

        let primary: MatrixCall | null = null;
        let secondaries: MatrixCall[] = [];

        for (const call of calls) {
            if (!SHOW_CALL_IN_STATES.includes(call.state)) continue;

            if (!call.isRemoteOnHold() && primary === null) {
                primary = call;
            } else {
                secondaries.push(call);
            }
        }

        if (primary === null && secondaries.length > 0) {
            primary = secondaries[0];
            secondaries = secondaries.slice(1);
        }

        if (secondaries.length > 1) {
            // We should never be in more than two calls so this shouldn't happen
            logger.log("Found more than 1 secondary call! Other calls will not be shown.");
        }

        return [primary, secondaries];
    }

    /**
     * How each widget PiP repositions its persisted content when the PiP moves, by PiP key. One per PiP:
     * a `PersistedElement` takes over the ref it is given on mount, so a shared ref would only follow the
     * newest PiP and leave the others' content stranded where they were.
     */
    private readonly movePersistedElements = new Map<string, RefObject<(() => void) | null>>();

    private movePersistedElement(key: string): RefObject<(() => void) | null> {
        let ref = this.movePersistedElements.get(key);
        if (!ref) {
            ref = { current: null };
            this.movePersistedElements.set(key, ref);
        }
        return ref;
    }

    /**
     * PiP keys from bottom to top. A PiP's frame and its persisted content are separate DOM trees, so
     * both get a z-index from this order (content just above its own frame) inside the persisted
     * elements' stacking context, which the frames are rendered into; dragging a PiP raises it.
     */
    private raised: string[] = [];

    private zIndex(key: string): number {
        if (!this.raised.includes(key)) this.raised.push(key);
        return PIP_Z_BASE + 2 * this.raised.indexOf(key);
    }

    private raise(key: string): void {
        this.raised = [...this.raised.filter((k) => k !== key), key];
        this.forceUpdate();
    }

    /** The persisted content is in its own container: stack that as a whole, over its frame. */
    private stackPersistedContent(): void {
        for (const { widgetId, roomId } of this.state.pipWidgets) {
            const key = `widget-pip-${widgetId}-${roomId}`;
            const persistKey = getPersistKey(WidgetUtils.calcWidgetUid(widgetId, roomId ?? undefined));
            const container = document.getElementById(`mx_persistedElement_${persistKey}`);
            if (container) Object.assign(container.style, { position: "relative", zIndex: `${this.zIndex(key) + 1}` });
        }
    }

    private onRoomViewStoreUpdate = (): void => {
        const newRoomId = this.context.roomViewStore.getRoomId();
        const oldRoomId = this.state.viewedRoomId;
        if (newRoomId === oldRoomId) return;
        // The WidgetLayoutStore observer always tracks the currently viewed Room,
        // so we don't end up with multiple observers and know what observer to remove on unmount
        const oldRoom = this.context.client?.getRoom(oldRoomId);
        if (oldRoom) {
            this.context.widgetLayoutStore.off(WidgetLayoutStore.emissionForRoom(oldRoom), this.updateCalls);
        }
        const newRoom = this.context.client?.getRoom(newRoomId || undefined);
        if (newRoom) {
            this.context.widgetLayoutStore.on(WidgetLayoutStore.emissionForRoom(newRoom), this.updateCalls);
        }
        if (!newRoomId) return;

        const [primaryCall, secondaryCalls] = this.getPrimarySecondaryCallsForPip(newRoomId);
        this.setState({
            viewedRoomId: newRoomId,
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
        this.updateShowWidgetInPip();
    };

    private onWidgetPersistence = (): void => {
        this.updateShowWidgetInPip();
    };

    private onWidgetDockChanges = (): void => {
        this.updateShowWidgetInPip();
    };

    private updateCalls = (): void => {
        if (!this.state.viewedRoomId) return;
        const [primaryCall, secondaryCalls] = this.getPrimarySecondaryCallsForPip(this.state.viewedRoomId);

        this.setState({
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
        this.updateShowWidgetInPip();
    };

    private onCallRemoteHold = (): void => {
        if (!this.state.viewedRoomId) return;
        const [primaryCall, secondaryCalls] = this.getPrimarySecondaryCallsForPip(this.state.viewedRoomId);

        this.setState({
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
    };

    private viewRoom(roomId: string | null): void {
        if (roomId) {
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: roomId,
                metricsTrigger: "WebFloatingCallWindow",
            });
        }
    }

    /**
     * Which slot each PiP occupies, by PiP key. A new PiP takes the lowest free slot, so it appears as
     * near the top-right corner as the PiPs already there allow: below them while there is room down
     * the edge, then in the next column to the left. Slots are kept while the PiP lives and freed when
     * it goes.
     *
     * ponytail: slots are by index, not by where the PiPs actually are; a PiP the user dragged to
     * another corner still counts as filling its slot. Compare the draggers' positions if that grates.
     */
    private readonly slots = new Map<string, number>();

    private slot(key: string): PipSlot {
        let index = this.slots.get(key);
        if (index === undefined) {
            const taken = new Set(this.slots.values());
            index = 0;
            while (taken.has(index)) index++;
            this.slots.set(key, index);
        }
        const rows = pipRowsPerColumn();
        return { column: Math.floor(index / rows), row: index % rows };
    }

    private freeSlots(liveKeys: Set<string>): void {
        for (const key of this.slots.keys()) if (!liveKeys.has(key)) this.slots.delete(key);
    }

    public updateShowWidgetInPip(): void {
        // A widget is shown as a persistent app (in a floating pip container) only
        // if it is not visible on screen: either because we are viewing a
        // different room OR because it is in none of the possible containers of
        // the room view. Sanity check the room - the widget may have been
        // destroyed between render cycles, and thus no room is associated anymore.
        const pipWidgets = ActiveWidgetStore.instance
            .getPersistentWidgets()
            .filter(
                ({ widgetId, roomId }) =>
                    roomId !== null &&
                    this.context.client?.getRoom(roomId) &&
                    (this.state.viewedRoomId !== roomId || !ActiveWidgetStore.instance.isDocked(widgetId, roomId)),
            );
        this.setState({ pipWidgets });
    }

    public render(): ReactNode {
        const pipMode = true;
        // One dragger per PiP, so that each call can be moved on its own
        const pips: ReactNode[] = [];
        const liveKeys = new Set<string>();

        if (this.state.primaryCall) {
            // get a ref to call inside the current scope
            const call = this.state.primaryCall;
            const key = "call-view";
            liveKeys.add(key);
            pips.push(
                <PictureInPictureDragger
                    key={key}
                    slot={this.slot(key)}
                    zIndex={this.zIndex(key)}
                    onRaise={() => this.raise(key)}
                    onDoubleClick={() => this.viewRoom(call.roomId ?? null)}
                >
                    {[
                        ({ onStartMoving, onResize }) => (
                            <LegacyCallView
                                key={key}
                                onMouseDownOnHeader={onStartMoving}
                                call={call}
                                secondaryCall={this.state.secondaryCall}
                                pipMode={pipMode}
                                onResize={onResize}
                                sidebarShown={false}
                            />
                        ),
                    ]}
                </PictureInPictureDragger>,
            );
        }

        for (const { widgetId, roomId } of this.state.pipWidgets) {
            const key = `widget-pip-${widgetId}-${roomId}`;
            liveKeys.add(key);
            const moveRef = this.movePersistedElement(key);
            pips.push(
                <PictureInPictureDragger
                    key={key}
                    slot={this.slot(key)}
                    zIndex={this.zIndex(key)}
                    onRaise={() => this.raise(key)}
                    onDoubleClick={() => this.viewRoom(roomId)}
                    onMove={() => moveRef.current?.()}
                >
                    {[
                        ({ onStartMoving }) => (
                            <WidgetPipWrappedView
                                key={key}
                                widgetId={widgetId}
                                room={this.context.client!.getRoom(roomId ?? undefined)!}
                                viewingRoom={this.state.viewedRoomId === roomId}
                                onStartMoving={onStartMoving}
                                movePersistedElement={moveRef}
                            />
                        ),
                    ]}
                </PictureInPictureDragger>,
            );
        }

        this.freeSlots(liveKeys);
        for (const key of this.movePersistedElements.keys())
            if (!liveKeys.has(key)) this.movePersistedElements.delete(key);

        // Into the persisted elements' stacking context, so a PiP's frame and its content stack together
        return pips.length ? createPortal(<>{pips}</>, getOrCreateMasterContainer()) : null;
    }
}

export const PipContainer: React.FC = () => <PipContainerInner />;

type Props = { viewingRoom: boolean } & WidgetPipViewModelProps;

/**
 * A wrapper for the WidgetPipView component.
 *
 * This exposes the new shared WidgetPipView with the same API as before and how
 * it is used in the PipContainerInner component.
 * @param props The same props the legacy WidgetPip was using.
 * @returns
 */
const WidgetPipWrappedView: React.FC<Props> = (props: Props) => {
    const vm = useCreateAutoDisposedViewModel(() => new WidgetPipViewModel(props));

    useEffect(() => {
        // Use an effect to update viewingRoom. It is not required in the view but only in the view model.
        vm.setViewingRoom(props.viewingRoom);
    }, [vm, props.viewingRoom]);

    return (
        <WidgetPipView
            vm={vm}
            // Props only used in the view and not the view model get passed directly.
            RoomAvatar={({ size }) => <RoomAvatar size={size} room={props.room} />}
        />
    );
};
