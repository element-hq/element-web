/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useSyncExternalStore } from "react";
import {
    BaseViewModel,
    type ElementCallAppTileViewClassNames,
    type ElementCallAppTileViewSnapshot,
    type ElementCallAppTileViewModel as ElementCallAppTileViewModelInterface,
} from "@element-hq/web-shared-components";
import { type MatrixClient, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership, type Membership } from "matrix-js-sdk/src/types";
import { type IWidget } from "matrix-widget-api";

import type { CSSProperties, FC, ReactNode, RefObject } from "react";
import type { SDKContextClass } from "../../contexts/SDKContextClass";
import PersistedElement, { getPersistKey } from "../../components/views/elements/PersistedElement";
import { WrappedElementCallComponent } from "../../components/views/voip/WrappedElementCallComponent";
import ActiveWidgetStore from "../../stores/ActiveWidgetStore";
import { type IApp, isAppWidget } from "../../stores/WidgetStore";
import WidgetUtils from "../../utils/WidgetUtils";
import { type Call, ElementCall as ElementCallModel } from "../../models/Call";
import { CallStore, CallStoreEvent } from "../../stores/CallStore";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { type ActionPayload } from "../../dispatcher/payloads";

// For persisted apps in PiP we want the zIndex to be higher than for other persisted apps (100),
// otherwise the PiP view is drawn UNDER another persistent app when dragged around. Same as AppTile.
const Z_INDEX_DOCKED = 9;
const Z_INDEX_MINI = 101;

/**
 * `AppTile`'s class names for the tile's elements, styled by `_AppsDrawer.pcss` through the containers
 * the tile is dropped into (the apps drawer, the widget card, the sticker picker). One constant per
 * layout, so that a layout update that changes nothing leaves the snapshot alone.
 */
const CLASS_NAMES_DOCKED: ElementCallAppTileViewClassNames = {
    root: "mx_AppTile",
    persistedWrapper: "mx_AppTile_persistedWrapper",
    // We don't want mx_AppTileBody (rounded corners) for call widgets
    body: "mx_AppTileBody mx_AppTileBody--large mx_AppTileBody--call",
};
const CLASS_NAMES_FULL_WIDTH: ElementCallAppTileViewClassNames = { ...CLASS_NAMES_DOCKED, root: "mx_AppTileFullWidth" };
const CLASS_NAMES_MINI: ElementCallAppTileViewClassNames = {
    root: "mx_AppTile_mini",
    persistedWrapper: "mx_AppTile_persistedWrapper",
    body: "mx_AppTileBody mx_AppTileBody--mini mx_AppTileBody--call",
};

/** The parts of the tile's props the view model reacts to while it is mounted. */
export interface TileLayout {
    /** Whether the tile is the small floating one (the picture-in-picture window). */
    miniMode: boolean;
    /** Whether a docked tile should fill the width of its container. */
    fullWidth: boolean;
    /** Set while the tile is being dragged or resized, so the call does not swallow the pointer. */
    pointerEvents?: CSSProperties["pointerEvents"];
}

/** The parts of the snapshot that follow the tile's layout. */
const layoutSnapshot = ({
    miniMode,
    fullWidth,
    pointerEvents,
}: TileLayout): Pick<ElementCallAppTileViewSnapshot, "classNames" | "zIndex" | "pointerEvents"> => ({
    classNames: miniMode ? CLASS_NAMES_MINI : fullWidth ? CLASS_NAMES_FULL_WIDTH : CLASS_NAMES_DOCKED,
    zIndex: miniMode ? Z_INDEX_MINI : Z_INDEX_DOCKED,
    pointerEvents,
});

export interface Props extends TileLayout {
    /**
     * The call's virtual widget. Its id stays the call's identity, exactly as for the iframe path:
     * the persist key, the `ActiveWidgetStore` key and the PiP candidate all derive from it.
     */
    app: IWidget | IApp;
    /** The room the call is in. */
    room?: Room;
    sdkContext: SDKContextClass;
    /** Handle to manually notify the persisted element that it needs to move. */
    movePersistedElement?: RefObject<(() => void) | null>;
}

/** The room's call, if it is the one the tile's widget stands for. */
const resolveCall = (call: Call | null, widgetId: string): ElementCallModel | null =>
    call instanceof ElementCallModel && call.widget.id === widgetId ? call : null;

const subscribeToCalls = (listener: () => void): (() => void) => {
    CallStore.instance.on(CallStoreEvent.Call, listener);
    return () => CallStore.instance.off(CallStoreEvent.Call, listener);
};

/**
 * Element Call for one widget, re-rendered when the room's call changes. Reads the call from the
 * `CallStore` rather than from a tile's view model, so that it belongs to no tile in particular.
 */
const PersistedElementCall: FC<{ roomId: string; widgetId: string; client: MatrixClient }> = ({
    roomId,
    widgetId,
    client,
}) => {
    const call = useSyncExternalStore(subscribeToCalls, () =>
        resolveCall(CallStore.instance.getCall(roomId), widgetId),
    );
    return call === null ? null : <WrappedElementCallComponent call={call} client={client} />;
};

/**
 * One `ElementCall` component per persisted call, by persist key. Every tile of a call (docked, or
 * the floating picture-in-picture window) renders into the same persisted root, so they must hand
 * it the same component: a component created per view model is a new element type to React, which
 * would remount Element Call each time the call moves between containers, and Element Call leaving
 * the session on unmount would end the call.
 */
const elementCallComponents = new Map<string, FC>();
const elementCallComponentFor = (persistKey: string, roomId: string, widgetId: string, client: MatrixClient): FC => {
    let component = elementCallComponents.get(persistKey);
    if (!component) {
        component = () => <PersistedElementCall roomId={roomId} widgetId={widgetId} client={client} />;
        elementCallComponents.set(persistKey, component);
    }
    return component;
};

/**
 * Reproduces the parts of `AppTile`'s lifecycle that are not about iframes: persistence across
 * navigation (`PersistedElement`), docking, teardown when nothing keeps the call alive, and leaving
 * the room. Widget messaging, permissions, mixed-content and popout handling are deliberately absent.
 *
 * `stickyPromise` is ignored: the bridge hangs up other calls itself.
 */
export class ElementCallAppTileViewModel
    extends BaseViewModel<ElementCallAppTileViewSnapshot, Props>
    implements ElementCallAppTileViewModelInterface
{
    /** The room the widget belongs to, or null for an account-level widget. */
    private readonly widgetRoomId: string | null;
    /** The call this tile is showing, or null if the room's call is not this widget's. */
    private elementCall: ElementCallModel | null;
    private started = false;
    private docked = false;
    /** Whether the tile is currently the floating one: docked tiles dock the call, floating ones do not. */
    private miniMode: boolean;
    private readonly client: MatrixClient;

    public constructor(props: Props) {
        // A call tile is only ever rendered for a logged-in user, so the SDK context has the client
        if (!props.sdkContext.client) throw new Error("Unable to create ElementCallAppTileViewModel without a client");
        const roomId = props.room?.roomId ?? "";
        const elementCall = resolveCall(CallStore.instance.getCall(roomId), props.app.id);
        const persistKey = getPersistKey(WidgetUtils.getWidgetUid(props.app));
        super(props, {
            hidden: elementCall === null || !props.room,
            persistKey,
            ...layoutSnapshot(props),
        });
        this.client = props.sdkContext.client;
        this.ElementCall = elementCallComponentFor(persistKey, roomId, props.app.id, this.client);
        this.elementCall = elementCall;
        this.miniMode = props.miniMode;
        this.widgetRoomId = isAppWidget(props.app) ? props.app.roomId : null;
    }

    /**
     * Starts docking the call and listening for the changes that end it. Separate from the
     * constructor because React may build a view model and throw it away without ever mounting it,
     * and anything started here would then have leaked.
     */
    public start(): void {
        // In StrictMode dev, a consumer's useEffect can briefly fire with a stale `vm` reference
        // between the hook disposing the old view model and React re-rendering with the new one.
        if (this.started || this.isDisposed) return;
        this.started = true;

        this.disposables.trackListener(CallStore.instance, CallStoreEvent.Call, this.onCallChange);
        this.disposables.trackListener(this.client, RoomEvent.MyMembership, this.onMyMembership);
        const dispatcherRef = defaultDispatcher.register(this.onDispatch);
        this.disposables.track(() => defaultDispatcher.unregister(dispatcherRef));

        // Tiles in miniMode are floating, and therefore not docked.
        this.setDocked(!this.miniMode);
    }

    /**
     * Tears the call down unless another container is keeping it alive: we support moving between
     * containers, in which case another tile will keep it loaded throughout the transition.
     *
     * The liveness check is deferred by a tick: in development React's StrictMode simulates an
     * unmount/remount right after mounting, and the call must survive that (a real unmount is never
     * followed by a remount, so the check still runs). It also avoids unmounting the persisted root
     * synchronously while React is still rendering.
     */
    public dispose(): void {
        super.dispose();
        this.setDocked(false);
        window.setTimeout(() => {
            if (!ActiveWidgetStore.instance.isLive(this.props.app.id, this.widgetRoomId)) this.endCall();
        }, 0);
    }

    /**
     * Updates the props the tile can change while it stays mounted, most importantly `miniMode`:
     * the call moving between a docked container and the floating picture-in-picture window.
     */
    public setLayout(layout: TileLayout): void {
        this.miniMode = layout.miniMode;
        this.snapshot.merge(layoutSnapshot(layout));
        if (this.started) this.setDocked(!layout.miniMode);
    }

    /**
     * Renders the call in a React tree appended to `document.body`, so that it survives this tile
     * unmounting and can move between containers without reloading.
     */
    public PersistedElement: FC<{ persistKey: string; zIndex: number; children: ReactNode }> = ({
        persistKey,
        zIndex,
        children,
    }) => (
        <PersistedElement persistKey={persistKey} zIndex={zIndex} moveRef={this.props.movePersistedElement}>
            {children}
        </PersistedElement>
    );

    /**
     * Element Call itself: the one component for this call, shared with every other tile showing
     * it (see `elementCallComponentFor`). Not part of the snapshot, which shared components cannot type.
     */
    public readonly ElementCall: FC;

    private setDocked(docked: boolean): void {
        if (docked === this.docked) return;
        this.docked = docked;
        const store = ActiveWidgetStore.instance;
        if (docked) store.dockWidget(this.props.app.id, this.widgetRoomId);
        else store.undockWidget(this.props.app.id, this.widgetRoomId);
    }

    /** Ends all call interaction: the equivalent of `AppTile.endWidgetActions`. */
    private endCall(): void {
        // XXX: As in AppTile, this removes the persistent element from the DOM entirely.
        PersistedElement.destroyElement(this.snapshot.current.persistKey);
        // The next tile for this widget gets a fresh component, like a fresh persisted root.
        elementCallComponents.delete(this.snapshot.current.persistKey);
        ActiveWidgetStore.instance.destroyPersistentWidget(this.props.app.id, this.widgetRoomId);
        // Nothing will tell us about a hangup any more; treat it as one (as AppTile does when the widget dies).
        if (this.elementCall?.connected) this.elementCall.handleClose();
    }

    private readonly onCallChange = (...args: unknown[]): void => {
        const [call, forRoomId] = args as [Call | null, string];
        if (forRoomId !== (this.props.room?.roomId ?? "")) return;
        this.elementCall = resolveCall(call, this.props.app.id);
        this.snapshot.merge({ hidden: this.elementCall === null || !this.props.room });
    };

    private readonly onMyMembership = (...args: unknown[]): void => {
        const [changedRoom, membership] = args as [Room, Membership];
        if (
            (membership === KnownMembership.Leave || membership === KnownMembership.Ban) &&
            changedRoom.roomId === this.props.room?.roomId
        ) {
            this.onUserLeftRoom();
        }
    };

    private readonly onDispatch = (payload: ActionPayload): void => {
        // Handle this before it is echoed down /sync, so it doesn't hang around as long and look jarring
        if (payload.action === Action.AfterLeaveRoom && payload.room_id === this.props.room?.roomId) {
            this.onUserLeftRoom();
        }
    };

    private onUserLeftRoom(): void {
        const { app, room, sdkContext } = this.props;
        if (!ActiveWidgetStore.instance.getWidgetPersistence(app.id, this.widgetRoomId)) return;
        // We just left the room that the active call was from.
        if (room && sdkContext.roomViewStore.getRoomId() !== room.roomId) {
            // If we are not actively looking at the room then destroy the call entirely.
            this.endCall();
        } else {
            // Otherwise just cancel its persistence.
            ActiveWidgetStore.instance.destroyPersistentWidget(app.id, this.widgetRoomId);
        }
    }
}
