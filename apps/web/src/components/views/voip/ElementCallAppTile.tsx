/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type CSSProperties, type JSX, useContext, useEffect, useMemo, useRef } from "react";
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
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import { useDispatcher } from "../../../hooks/useDispatcher";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { ElementCall } from "./ElementCall";
import { ElementWebHostBridge } from "./ElementWebHostBridge";

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
    useEffect(() => {
        if (!miniMode) ActiveWidgetStore.instance.dockWidget(app.id, widgetRoomId);
        return () => {
            if (!miniMode) ActiveWidgetStore.instance.undockWidget(app.id, widgetRoomId);
            if (!ActiveWidgetStore.instance.isLive(app.id, widgetRoomId)) endCall.current();
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
                        <ElementCall
                            client={client}
                            roomId={room.roomId}
                            intent={intent}
                            config={config}
                            hostBridge={bridge}
                        />
                    </div>
                    {overlay}
                </PersistedElement>
            </div>
        </div>
    );
};
