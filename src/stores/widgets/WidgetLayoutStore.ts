/*
 * Copyright 2021 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import SettingsStore from "../../settings/SettingsStore";
import { Room } from "matrix-js-sdk/src/models/room";
import WidgetStore, { IApp } from "../WidgetStore";
import { WidgetType } from "../../widgets/WidgetType";
import { clamp, defaultNumber, sum } from "../../utils/numbers";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ReadyWatchingStore } from "../ReadyWatchingStore";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { SettingLevel } from "../../settings/SettingLevel";
import { arrayFastClone } from "../../utils/arrays";
import { UPDATE_EVENT } from "../AsyncStore";
import { compare } from "../../utils/strings";

export const WIDGET_LAYOUT_EVENT_TYPE = "io.element.widgets.layout";

export enum Container {
    // "Top" is the app drawer, and currently the only sensible value.
    Top = "top",

    // "Right" is the right panel, and the default for widgets. Setting
    // this as a container on a widget is essentially like saying "no
    // changes needed", though this may change in the future.
    Right = "right",

    // ... more as needed. Note that most of this code assumes that there
    // are only two containers, and that only the top container is special.
}

export interface IStoredLayout {
    // Where to store the widget. Required.
    container: Container;

    // The index (order) to position the widgets in. Only applies for
    // ordered containers (like the top container). Smaller numbers first,
    // and conflicts resolved by comparing widget IDs.
    index?: number;

    // Percentage (integer) for relative width of the container to consume.
    // Clamped to 0-100 and may have minimums imposed upon it. Only applies
    // to containers which support inner resizing (currently only the top
    // container).
    width?: number;

    // Percentage (integer) for relative height of the container. Note that
    // this only applies to the top container currently, and that container
    // will take the highest value among widgets in the container. Clamped
    // to 0-100 and may have minimums imposed on it.
    height?: number;

    // TODO: [Deferred] Maximizing (fullscreen) widgets by default.
}

interface IWidgetLayouts {
    [widgetId: string]: IStoredLayout;
}

interface ILayoutStateEvent {
    // TODO: [Deferred] Forced layout (fixed with no changes)

    // The widget layouts.
    widgets: IWidgetLayouts;
}

interface ILayoutSettings extends ILayoutStateEvent {
    overrides?: string; // event ID for layout state event, if present
}

// Dev note: "Pinned" widgets are ones in the top container.
export const MAX_PINNED = 3;

// These two are whole percentages and don't really mean anything. Later values will decide
// minimum, but these help determine proportions during our calculations here. In fact, these
// values should be *smaller* than the actual minimums imposed by later components.
const MIN_WIDGET_WIDTH_PCT = 10; // 10%
const MIN_WIDGET_HEIGHT_PCT = 2; // 2%

export class WidgetLayoutStore extends ReadyWatchingStore {
    private static internalInstance: WidgetLayoutStore;

    private byRoom: {
        [roomId: string]: {
            // @ts-ignore - TS wants a string key, but we know better
            [container: Container]: {
                ordered: IApp[];
                height?: number;
                distributions?: number[];
            };
        };
    } = {};

    private pinnedRef: string;
    private layoutRef: string;

    private constructor() {
        super(defaultDispatcher);
    }

    public static get instance(): WidgetLayoutStore {
        if (!WidgetLayoutStore.internalInstance) {
            WidgetLayoutStore.internalInstance = new WidgetLayoutStore();
        }
        return WidgetLayoutStore.internalInstance;
    }

    public static emissionForRoom(room: Room): string {
        return `update_${room.roomId}`;
    }

    private emitFor(room: Room) {
        this.emit(WidgetLayoutStore.emissionForRoom(room));
    }

    protected async onReady(): Promise<any> {
        this.updateAllRooms();

        this.matrixClient.on("RoomState.events", this.updateRoomFromState);
        this.pinnedRef = SettingsStore.watchSetting("Widgets.pinned", null, this.updateFromSettings);
        this.layoutRef = SettingsStore.watchSetting("Widgets.layout", null, this.updateFromSettings);
        WidgetStore.instance.on(UPDATE_EVENT, this.updateFromWidgetStore);
    }

    protected async onNotReady(): Promise<any> {
        this.byRoom = {};

        SettingsStore.unwatchSetting(this.pinnedRef);
        SettingsStore.unwatchSetting(this.layoutRef);
        WidgetStore.instance.off(UPDATE_EVENT, this.updateFromWidgetStore);
    }

    private updateAllRooms = () => {
        this.byRoom = {};
        for (const room of this.matrixClient.getVisibleRooms()) {
            this.recalculateRoom(room);
        }
    };

    private updateFromWidgetStore = (roomId?: string) => {
        if (roomId) {
            const room = this.matrixClient.getRoom(roomId);
            if (room) this.recalculateRoom(room);
        } else {
            this.updateAllRooms();
        }
    };

    private updateRoomFromState = (ev: MatrixEvent) => {
        if (ev.getType() !== WIDGET_LAYOUT_EVENT_TYPE) return;
        const room = this.matrixClient.getRoom(ev.getRoomId());
        if (room) this.recalculateRoom(room);
    };

    private updateFromSettings = (settingName: string, roomId: string /* and other stuff */) => {
        if (roomId) {
            const room = this.matrixClient.getRoom(roomId);
            if (room) this.recalculateRoom(room);
        } else {
            this.updateAllRooms();
        }
    };

    private recalculateRoom(room: Room) {
        const widgets = WidgetStore.instance.getApps(room.roomId);
        if (!widgets?.length) {
            this.byRoom[room.roomId] = {};
            this.emitFor(room);
            return;
        }

        const beforeChanges = JSON.stringify(this.byRoom[room.roomId]);

        const layoutEv = room.currentState.getStateEvents(WIDGET_LAYOUT_EVENT_TYPE, "");
        const legacyPinned = SettingsStore.getValue("Widgets.pinned", room.roomId);
        let userLayout = SettingsStore.getValue<ILayoutSettings>("Widgets.layout", room.roomId);

        if (layoutEv && userLayout && userLayout.overrides !== layoutEv.getId()) {
            // For some other layout that we don't really care about. The user can reset this
            // by updating their personal layout.
            userLayout = null;
        }

        const roomLayout: ILayoutStateEvent = layoutEv ? layoutEv.getContent() : null;

        // We essentially just need to find the top container's widgets because we
        // only have two containers. Anything not in the top widget by the end of this
        // function will go into the right container.
        const topWidgets: IApp[] = [];
        const rightWidgets: IApp[] = [];
        for (const widget of widgets) {
            const stateContainer = roomLayout?.widgets?.[widget.id]?.container;
            const manualContainer = userLayout?.widgets?.[widget.id]?.container;
            const isLegacyPinned = !!legacyPinned?.[widget.id];
            const defaultContainer = WidgetType.JITSI.matches(widget.type) ? Container.Top : Container.Right;

            if (manualContainer === Container.Right) {
                rightWidgets.push(widget);
            } else if (manualContainer === Container.Top || stateContainer === Container.Top) {
                topWidgets.push(widget);
            } else if (isLegacyPinned && !stateContainer) {
                topWidgets.push(widget);
            } else {
                (defaultContainer === Container.Top ? topWidgets : rightWidgets).push(widget);
            }
        }

        // Trim to MAX_PINNED
        const runoff = topWidgets.slice(MAX_PINNED);
        rightWidgets.push(...runoff);

        // Order the widgets in the top container, putting autopinned Jitsi widgets first
        // unless they have a specific order in mind
        topWidgets.sort((a, b) => {
            const layoutA = roomLayout?.widgets?.[a.id];
            const layoutB = roomLayout?.widgets?.[b.id];

            const userLayoutA = userLayout?.widgets?.[a.id];
            const userLayoutB = userLayout?.widgets?.[b.id];

            // Jitsi widgets are defaulted to be the leftmost widget whereas other widgets
            // default to the right side.
            const defaultA = WidgetType.JITSI.matches(a.type) ? Number.MIN_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
            const defaultB = WidgetType.JITSI.matches(b.type) ? Number.MIN_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;

            const orderA = defaultNumber(userLayoutA?.index, defaultNumber(layoutA?.index, defaultA));
            const orderB = defaultNumber(userLayoutB?.index, defaultNumber(layoutB?.index, defaultB));

            if (orderA === orderB) {
                // We just need a tiebreak
                return compare(a.id, b.id);
            }

            return orderA - orderB;
        });

        // Determine width distribution and height of the top container now (the only relevant one)
        const widths: number[] = [];
        let maxHeight = null; // null == default
        let doAutobalance = true;
        for (let i = 0; i < topWidgets.length; i++) {
            const widget = topWidgets[i];
            const widgetLayout = roomLayout?.widgets?.[widget.id];
            const userWidgetLayout = userLayout?.widgets?.[widget.id];

            if (Number.isFinite(userWidgetLayout?.width) || Number.isFinite(widgetLayout?.width)) {
                const val = userWidgetLayout?.width || widgetLayout?.width;
                const normalized = clamp(val, MIN_WIDGET_WIDTH_PCT, 100);
                widths.push(normalized);
                doAutobalance = false; // a manual width was specified
            } else {
                widths.push(100); // we'll figure this out later
            }

            if (widgetLayout?.height || userWidgetLayout?.height) {
                const defRoomHeight = defaultNumber(widgetLayout?.height, MIN_WIDGET_HEIGHT_PCT);
                const h = defaultNumber(userWidgetLayout?.height, defRoomHeight);
                maxHeight = Math.max(maxHeight, clamp(h, MIN_WIDGET_HEIGHT_PCT, 100));
            }
        }
        if (doAutobalance) {
            for (let i = 0; i < widths.length; i++) {
                widths[i] = 100 / widths.length;
            }
        } else {
            // If we're not autobalancing then it means that we're trying to make
            // sure that widgets make up exactly 100% of space (not over, not under)
            const difference = sum(...widths) - 100; // positive = over, negative = under
            if (difference < 0) {
                // For a deficit we just fill everything in equally
                for (let i = 0; i < widths.length; i++) {
                    widths[i] += Math.abs(difference) / widths.length;
                }
            } else if (difference > 0) {
                // When we're over, we try to scale all the widgets within range first.
                // We clamp values to try and keep ourselves sane and within range.
                for (let i = 0; i < widths.length; i++) {
                    widths[i] = clamp(widths[i] - (difference / widths.length), MIN_WIDGET_WIDTH_PCT, 100);
                }

                // If we're still over, find the widgets which have more width than the minimum
                // and balance them out until we're at 100%. This should keep us as close as possible
                // to the intended distributions.
                //
                // Note: if we ever decide to set a minimum which is larger than 100%/MAX_WIDGETS then
                // we probably have other issues - this code assumes we don't do that.
                const toReclaim = sum(...widths) - 100;
                if (toReclaim > 0) {
                    const largeIndices = widths
                        .map((v, i) => ([i, v]))
                        .filter(p => p[1] > MIN_WIDGET_WIDTH_PCT)
                        .map(p => p[0]);
                    for (const idx of largeIndices) {
                        widths[idx] -= toReclaim / largeIndices.length;
                    }
                }
            }
        }

        // Finally, fill in our cache and update
        this.byRoom[room.roomId] = {};
        if (topWidgets.length) {
            this.byRoom[room.roomId][Container.Top] = {
                ordered: topWidgets,
                distributions: widths,
                height: maxHeight,
            };
        }
        if (rightWidgets.length) {
            this.byRoom[room.roomId][Container.Right] = {
                ordered: rightWidgets,
            };
        }

        const afterChanges = JSON.stringify(this.byRoom[room.roomId]);
        if (afterChanges !== beforeChanges) {
            this.emitFor(room);
        }
    }

    public getContainerWidgets(room: Room, container: Container): IApp[] {
        return this.byRoom[room?.roomId]?.[container]?.ordered || [];
    }

    public isInContainer(room: Room, widget: IApp, container: Container): boolean {
        return this.getContainerWidgets(room, container).some(w => w.id === widget.id);
    }

    public canAddToContainer(room: Room, container: Container): boolean {
        return this.getContainerWidgets(room, container).length < MAX_PINNED;
    }

    public getResizerDistributions(room: Room, container: Container): string[] { // yes, string.
        let distributions = this.byRoom[room.roomId]?.[container]?.distributions;
        if (!distributions || distributions.length < 2) return [];

        // The distributor actually expects to be fed N-1 sizes and expands the middle section
        // instead of the edges. Therefore, we need to return [0] when there's two widgets or
        // [0, 2] when there's three (skipping [1] because it's irrelevant).

        if (distributions.length === 2) distributions = [distributions[0]];
        if (distributions.length === 3) distributions = [distributions[0], distributions[2]];
        return distributions.map(d => `${d.toFixed(1)}%`); // actual percents - these are decoded later
    }

    public setResizerDistributions(room: Room, container: Container, distributions: string[]) {
        if (container !== Container.Top) return; // ignore - not relevant

        const numbers = distributions.map(d => Number(Number(d.substring(0, d.length - 1)).toFixed(1)));
        const widgets = this.getContainerWidgets(room, container);

        // From getResizerDistributions, we need to fill in the middle size if applicable.
        const remaining = 100 - sum(...numbers);
        if (numbers.length === 2) numbers.splice(1, 0, remaining);
        if (numbers.length === 1) numbers.push(remaining);

        const localLayout = {};
        widgets.forEach((w, i) => {
            localLayout[w.id] = {
                container: container,
                width: numbers[i],
                index: i,
                height: this.byRoom[room.roomId]?.[container]?.height || MIN_WIDGET_HEIGHT_PCT,
            };
        });
        this.updateUserLayout(room, localLayout);
    }

    public getContainerHeight(room: Room, container: Container): number {
        return this.byRoom[room.roomId]?.[container]?.height; // let the default get returned if needed
    }

    public setContainerHeight(room: Room, container: Container, height: number) {
        const widgets = this.getContainerWidgets(room, container);
        const widths = this.byRoom[room.roomId]?.[container]?.distributions;
        const localLayout = {};
        widgets.forEach((w, i) => {
            localLayout[w.id] = {
                container: container,
                width: widths[i],
                index: i,
                height: height,
            };
        });
        this.updateUserLayout(room, localLayout);
    }

    public moveWithinContainer(room: Room, container: Container, widget: IApp, delta: number) {
        const widgets = arrayFastClone(this.getContainerWidgets(room, container));
        const currentIdx = widgets.findIndex(w => w.id === widget.id);
        if (currentIdx < 0) return; // no change needed

        widgets.splice(currentIdx, 1); // remove existing widget
        const newIdx = clamp(currentIdx + delta, 0, widgets.length);
        widgets.splice(newIdx, 0, widget);

        const widths = this.byRoom[room.roomId]?.[container]?.distributions;
        const height = this.byRoom[room.roomId]?.[container]?.height;
        const localLayout = {};
        widgets.forEach((w, i) => {
            localLayout[w.id] = {
                container: container,
                width: widths[i],
                index: i,
                height: height,
            };
        });
        this.updateUserLayout(room, localLayout);
    }

    public moveToContainer(room: Room, widget: IApp, toContainer: Container) {
        const allWidgets = this.getAllWidgets(room);
        if (!allWidgets.some(([w])=> w.id === widget.id)) return; // invalid
        this.updateUserLayout(room, {
            [widget.id]: {container: toContainer},
        });
    }

    public canCopyLayoutToRoom(room: Room): boolean {
        if (!this.matrixClient) return false; // not ready yet
        return room.currentState.maySendStateEvent(WIDGET_LAYOUT_EVENT_TYPE, this.matrixClient.getUserId());
    }

    public copyLayoutToRoom(room: Room) {
        const allWidgets = this.getAllWidgets(room);
        const evContent: ILayoutStateEvent = {widgets: {}};
        for (const [widget, container] of allWidgets) {
            evContent.widgets[widget.id] = {container};
            if (container === Container.Top) {
                const containerWidgets = this.getContainerWidgets(room, container);
                const idx = containerWidgets.findIndex(w => w.id === widget.id);
                const widths = this.byRoom[room.roomId]?.[container]?.distributions;
                const height = this.byRoom[room.roomId]?.[container]?.height;
                evContent.widgets[widget.id] = {
                    ...evContent.widgets[widget.id],
                    height: height ? Math.round(height) : null,
                    width: widths[idx] ? Math.round(widths[idx]) : null,
                    index: idx,
                };
            }
        }
        this.matrixClient.sendStateEvent(room.roomId, WIDGET_LAYOUT_EVENT_TYPE, evContent, "");
    }

    private getAllWidgets(room: Room): [IApp, Container][] {
        const containers = this.byRoom[room.roomId];
        if (!containers) return [];

        const ret = [];
        for (const container of Object.keys(containers)) {
            const widgets = containers[container].ordered;
            for (const widget of widgets) {
                ret.push([widget, container]);
            }
        }
        return ret;
    }

    private updateUserLayout(room: Room, newLayout: IWidgetLayouts) {
        // Polyfill any missing widgets
        const allWidgets = this.getAllWidgets(room);
        for (const [widget, container] of allWidgets) {
            const containerWidgets = this.getContainerWidgets(room, container);
            const idx = containerWidgets.findIndex(w => w.id === widget.id);
            const widths = this.byRoom[room.roomId]?.[container]?.distributions;
            if (!newLayout[widget.id]) {
                newLayout[widget.id] = {
                    container: container,
                    index: idx,
                    height: this.byRoom[room.roomId]?.[container]?.height,
                    width: widths?.[idx],
                };
            }
        }

        const layoutEv = room.currentState.getStateEvents(WIDGET_LAYOUT_EVENT_TYPE, "");
        SettingsStore.setValue("Widgets.layout", room.roomId, SettingLevel.ROOM_ACCOUNT, {
            overrides: layoutEv?.getId(),
            widgets: newLayout,
        }).catch(() => this.recalculateRoom(room));
        this.recalculateRoom(room); // call to try local echo on changes (the catch above undoes any errors)
    }
}

window.mxWidgetLayoutStore = WidgetLayoutStore.instance;
