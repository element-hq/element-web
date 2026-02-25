/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useState } from "react";
import { type SpacePanelItemProps, type ExtrasApi } from "@element-hq/element-web-module-api";
import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import { useTypedEventEmitter } from "../hooks/useEventEmitter";

export interface ModuleSpacePanelItem extends SpacePanelItemProps {
    spaceKey: string;
}

enum ExtrasApiEvent {
    SpacePanelItemsChanged = "SpacePanelItemsChanged",
}

interface EmittedEvents {
    [ExtrasApiEvent.SpacePanelItemsChanged]: () => void;
}

export class ElementWebExtrasApi extends TypedEventEmitter<keyof EmittedEvents, EmittedEvents> implements ExtrasApi {
    public spacePanelItems = new Map<string, SpacePanelItemProps>();
    public visibleRoomBySpaceKey = new Map<string, () => string[]>();

    public setSpacePanelItem(spacekey: string, item: SpacePanelItemProps): void {
        this.spacePanelItems.set(spacekey, item);
        this.emit(ExtrasApiEvent.SpacePanelItemsChanged);
    }

    public getVisibleRoomBySpaceKey(spaceKey: string, cb: () => string[]): void {
        this.visibleRoomBySpaceKey.set(spaceKey, cb);
    }
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
