/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, {
    type CSSProperties,
    type FC,
    type JSX,
    lazy,
    Suspense,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from "react";
import classNames from "classnames";
import { type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership, type Membership } from "matrix-js-sdk/src/types";

import type { CallTileProps } from "./CallTile";
import PersistedElement, { getPersistKey } from "../elements/PersistedElement";
import ActiveWidgetStore from "../../../stores/ActiveWidgetStore";
import { isAppWidget } from "../../../stores/WidgetStore";
import WidgetUtils from "../../../utils/WidgetUtils";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { SDKContext } from "../../../contexts/SDKContext.ts";
import { ElementCall as ElementCallModel } from "../../../models/Call";
import { useCall } from "../../../hooks/useCall";
import { CallStore } from "../../../stores/CallStore";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import { useDispatcher } from "../../../hooks/useDispatcher";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { useSettingValue } from "../../../hooks/useSettings";
import Spinner from "../elements/Spinner";
import { type ElementCallComponentModule, type ElementCallProps } from "./ElementCallComponentTypes";
import { ElementWebHostBridge } from "./ElementWebHostBridge";

/**
 * Loads an Element Call component module and initialises it once, before its first render. Both the
 * real package and the mock have the same module shape (`ElementCallComponentModule`).
 */
const loadElementCall = async (
    module: Promise<ElementCallComponentModule>,
): Promise<{ default: FC<ElementCallProps> }> => {
    const m = await module;
    await m.initializeElementCall(ElementCallModel.getConfigOptions(CallStore.instance.getConfiguredRTCTransports()));
    return { default: m.ElementCall };
};

/**
 * The real component: `@element-hq/element-call-component`, a large ES module (LiveKit, EC's UI) plus
 * its stylesheet. Code-split so it is only fetched when a call is rendered on the React path.
 */
const RealElementCall = lazy(() =>
    loadElementCall(
        Promise.all([
            import(/* webpackChunkName: "element-call-component" */ "@element-hq/element-call-component"),
            import(/* webpackChunkName: "element-call-component" */ "@element-hq/element-call-component/style.css"),
        ]).then(([m]) => m as ElementCallComponentModule),
    ),
);

/**
 * The mock, for Playwright (no LiveKit in Element Web's test backend) and offline development. Only
 * fetched when `Developer.elementCallMockComponent` is on.
 */
const MockElementCall = lazy(() =>
    loadElementCall(import(/* webpackChunkName: "element-call-mock" */ "./ElementCallMock")),
);

/**
 * Marks the call ready once the (lazily loaded) Element Call component has mounted. Element Call's
 * component build does not call `HostBridge.contentLoaded()` yet (only its standalone app does), and
 * the `ElementCall` model's `start()` would otherwise time out waiting for it. Harmless if the
 * component does call it too (the mock does).
 */
const MarkReadyOnMount = ({ call }: { call: ElementCallModel }): null => {
    useEffect(() => call.markReady(), [call]);
    return null;
};

// For persisted apps in PiP we want the zIndex to be higher than for other persisted apps (100),
// otherwise the PiP view is drawn UNDER another persistent app when dragged around. Same as AppTile.
const Z_INDEX_DOCKED = 9;
const Z_INDEX_MINI = 101;

/**
 * `AppTile` for Element Call rendered as an in-process React component rather than as an iframe.
 *
 * Takes the same props as `AppTile` so that `CallView` and `PersistentApp` can swap it in unchanged, and
 * reproduces the parts of `AppTile`'s lifecycle that are not about iframes: persistence across
 * navigation (`PersistedElement`), docking, teardown when nothing keeps the call alive, and leaving the
 * room. Widget messaging, permissions, mixed-content and popout handling are deliberately absent.
 *
 * The virtual call widget (`props.app`) stays the call's identity: its id is the persist key, the
 * `ActiveWidgetStore` key and the PiP candidate, exactly as for the iframe path.
 */
export const ElementCallAppTile = (props: CallTileProps): JSX.Element | null => {
    const { app, room, miniMode, fullWidth, pointerEvents, overlay, movePersistedElement, stickyPromise } = props;
    const client = useContext(MatrixClientContext);
    const sdkContext = useContext(SDKContext);
    // Real component or mock: independent of the widget-vs-React choice CallTile makes.
    const ElementCall = useSettingValue("Developer.elementCallMockComponent") ? MockElementCall : RealElementCall;

    const widgetRoomId = isAppWidget(app) ? app.roomId : null;
    const persistKey = getPersistKey(WidgetUtils.getWidgetUid(app));

    const call = useCall(room?.roomId ?? "");
    const elementCall = call instanceof ElementCallModel && call.widget.id === app.id ? call : null;

    const bridge = useMemo(
        () =>
            elementCall === null
                ? null
                : new ElementWebHostBridge(elementCall, { widgetId: app.id, widgetRoomId, stickyPromise }),
        [elementCall, app.id, widgetRoomId, stickyPromise],
    );
    useEffect(() => {
        bridge?.start();
        return () => bridge?.stop();
    }, [bridge]);

    // Ends all call interaction: the equivalent of AppTile.endWidgetActions. Kept in a ref so that the
    // unmount cleanup below always sees the current call without re-running on every change.
    const endCall = useRef<() => void>(() => {});
    useEffect(() => {
        endCall.current = (): void => {
            // XXX: As in AppTile, this removes the persistent element from the DOM entirely.
            PersistedElement.destroyElement(persistKey);
            ActiveWidgetStore.instance.destroyPersistentWidget(app.id, widgetRoomId);
            // Nothing will tell us about a hangup any more; treat it as one (as AppTile does when the widget dies).
            if (elementCall?.connected) elementCall.handleClose();
        };
    }, [persistKey, app.id, widgetRoomId, elementCall]);

    // Dock while mounted (tiles in miniMode are floating, and therefore not docked), and only tear the
    // call down if no other container is keeping it alive: we support moving between containers, in
    // which case another tile will keep it loaded throughout the transition.
    //
    // The liveness check is deferred by a tick: in development React's StrictMode simulates an
    // unmount/remount right after mounting, and the call must survive that (a real unmount is never
    // followed by a remount, so the check still runs). It also avoids unmounting the persisted root
    // synchronously while React is still rendering.
    const pendingTeardown = useRef<number | null>(null);
    useEffect(() => {
        if (pendingTeardown.current !== null) {
            clearTimeout(pendingTeardown.current);
            pendingTeardown.current = null;
        }
        if (!miniMode) ActiveWidgetStore.instance.dockWidget(app.id, widgetRoomId);
        return () => {
            if (!miniMode) ActiveWidgetStore.instance.undockWidget(app.id, widgetRoomId);
            pendingTeardown.current = window.setTimeout(() => {
                pendingTeardown.current = null;
                if (!ActiveWidgetStore.instance.isLive(app.id, widgetRoomId)) endCall.current();
            }, 0);
        };
    }, [app.id, widgetRoomId, miniMode]);

    const onUserLeftRoom = (): void => {
        if (!ActiveWidgetStore.instance.getWidgetPersistence(app.id, widgetRoomId)) return;
        // We just left the room that the active call was from.
        if (room && sdkContext.roomViewStore.getRoomId() !== room.roomId) {
            // If we are not actively looking at the room then destroy the call entirely.
            endCall.current();
        } else {
            // Otherwise just cancel its persistence.
            ActiveWidgetStore.instance.destroyPersistentWidget(app.id, widgetRoomId);
        }
    };
    useTypedEventEmitter(client, RoomEvent.MyMembership, (changedRoom: Room, membership: Membership): void => {
        if (
            (membership === KnownMembership.Leave || membership === KnownMembership.Ban) &&
            changedRoom.roomId === room?.roomId
        ) {
            onUserLeftRoom();
        }
    });
    useDispatcher(dis, (payload) => {
        // Handle this before it is echoed down /sync, so it doesn't hang around as long and look jarring
        if (payload.action === Action.AfterLeaveRoom && payload.room_id === room?.roomId) onUserLeftRoom();
    });

    if (elementCall === null || bridge === null || !room) return null;

    const { intent, config } = elementCall.getCallOptions();

    const bodyClass = classNames({
        "mx_AppTileBody": true,
        "mx_AppTileBody--large": !miniMode,
        "mx_AppTileBody--mini": miniMode,
        // We don't want mx_AppTileBody (rounded corners) for call widgets
        "mx_AppTileBody--call": true,
    });
    const bodyStyles: CSSProperties = {};
    if (pointerEvents) bodyStyles.pointerEvents = pointerEvents;

    const tileClass = classNames({
        mx_AppTile_mini: miniMode,
        mx_AppTileFullWidth: !miniMode && fullWidth,
        mx_AppTile: !miniMode && !fullWidth,
    });

    return (
        <div className={tileClass}>
            {/* Wrap the PersistedElement in a div to fix the height, otherwise the tile's border is in the wrong place */}
            <div className="mx_AppTile_persistedWrapper">
                <PersistedElement
                    zIndex={miniMode ? Z_INDEX_MINI : Z_INDEX_DOCKED}
                    persistKey={persistKey}
                    moveRef={movePersistedElement}
                >
                    <div className={bodyClass} style={bodyStyles}>
                        <Suspense fallback={<Spinner />}>
                            <ElementCall
                                client={client}
                                roomId={room.roomId}
                                intent={intent}
                                config={config}
                                hostBridge={bridge}
                            />
                            <MarkReadyOnMount call={elementCall} />
                        </Suspense>
                    </div>
                    {overlay}
                </PersistedElement>
            </div>
        </div>
    );
};
