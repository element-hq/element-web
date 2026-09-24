/*
Copyright 2026 Element Creations Ltd.
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";
import {
    type SpacePanelItemProps,
    type ExtrasApi,
    type RoomHeaderButtonsCallback,
    type RoomCallOption,
    type RoomCallOptionsCallback,
    type RoomBannerCallback,
    type EventContentTransformCallback,
    type RoomSettingsSecurityCallback,
    type AppSettingsSecurityCallback,
} from "@element-hq/element-web-module-api";
import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import { useTypedEventEmitter } from "../hooks/useEventEmitter";
import { logger } from "matrix-js-sdk/src/logger";

export interface ModuleSpacePanelItem extends SpacePanelItemProps {
    spaceKey: string;
}

export enum ExtrasApiEvent {
    SpacePanelItemsChanged = "SpacePanelItemsChanged",
    DialPadHandlerChanged = "DialPadHandlerChanged",
}

interface EmittedEvents {
    [ExtrasApiEvent.SpacePanelItemsChanged]: () => void;
    [ExtrasApiEvent.DialPadHandlerChanged]: () => void;
}

export class ElementWebExtrasApi extends TypedEventEmitter<keyof EmittedEvents, EmittedEvents> implements ExtrasApi {
    public spacePanelItems = new Map<string, SpacePanelItemProps>();
    public visibleRoomBySpaceKey = new Map<string, () => string[]>();
    public roomHeaderButtonsCallbacks: RoomHeaderButtonsCallback[] = [];
    public roomCallOptionsCallbacks: RoomCallOptionsCallback[] = [];
    /** What the room list's dial pad button does, when a module provides a dialler. */
    public dialPadHandler?: () => void;

    /**
     * Have the dial pad button in the room list header (otherwise only shown
     * for homeservers with PSTN support) open the module's own dialler.
     */
    public setDialPadHandler(cb: (() => void) | undefined): void {
        this.dialPadHandler = cb;
        this.emit(ExtrasApiEvent.DialPadHandlerChanged);
    }
    public roomBannerCallbacks: RoomBannerCallback[] = [];
    public eventContentTransformCallbacks: EventContentTransformCallback[] = [];
    public encryptedEnvelopeTransformCallbacks: EventContentTransformCallback[] = [];
    public roomSettingsSecurityCallbacks: RoomSettingsSecurityCallback[] = [];
    public appSettingsSecurityCallbacks: AppSettingsSecurityCallback[] = [];

    public setSpacePanelItem(spacekey: string, item: SpacePanelItemProps): void {
        this.spacePanelItems.set(spacekey, item);
        this.emit(ExtrasApiEvent.SpacePanelItemsChanged);
    }

    public getVisibleRoomBySpaceKey(spaceKey: string, cb: () => string[]): void {
        this.visibleRoomBySpaceKey.set(spaceKey, cb);
    }

    public addRoomHeaderButtonCallback(cb: RoomHeaderButtonsCallback): void {
        this.roomHeaderButtonsCallbacks.push(cb);
    }

    public addRoomBannerCallback(cb: RoomBannerCallback): void {
        this.roomBannerCallbacks.push(cb);
    }

    public addEventContentTransformCallback(cb: EventContentTransformCallback): void {
        this.eventContentTransformCallbacks.push(cb);
    }

    public addEncryptedEnvelopeTransformCallback(cb: EventContentTransformCallback): void {
        this.encryptedEnvelopeTransformCallbacks.push(cb);
    }

    public addRoomSettingsSecurityCallback(cb: RoomSettingsSecurityCallback): void {
        this.roomSettingsSecurityCallbacks.push(cb);
    }

    public addAppSettingsSecurityCallback(cb: AppSettingsSecurityCallback): void {
        this.appSettingsSecurityCallbacks.push(cb);
    }

    public addRoomCallOptionsCallback(cb: RoomCallOptionsCallback): void {
        this.roomCallOptionsCallbacks.push(cb);
    }
}

/**
 * The extra call options modules offer for a room, re-fetched when `memberCount` changes.
 */
export function useModuleRoomCallOptions(
    api: ElementWebExtrasApi,
    roomId: string,
    memberCount: number,
): RoomCallOption[] {
    const [options, setOptions] = useState<RoomCallOption[]>([]);
    useEffect(() => {
        if (api.roomCallOptionsCallbacks.length === 0) return;
        let cancelled = false;
        Promise.all(api.roomCallOptionsCallbacks.map(async (cb) => cb(roomId))).then(
            (results) => {
                if (!cancelled) setOptions(results.flat());
            },
            (e) => logger.warn("Module room call options callback failed", e),
        );
        return () => {
            cancelled = true;
        };
    }, [api, roomId, memberCount]);
    return options;
}

export function useModuleSpacePanelItems(api: ElementWebExtrasApi): ModuleSpacePanelItem[] {
    const getItems = (): ModuleSpacePanelItem[] => {
        return Array.from(api.spacePanelItems.entries()).map(([spaceKey, item]) => ({
            spaceKey,
            ...item,
        }));
    };

    const [items, setItems] = useState<ModuleSpacePanelItem[]>(getItems);

    useTypedEventEmitter(api, ExtrasApiEvent.SpacePanelItemsChanged, () => {
        setItems(getItems());
    });

    return items;
}
