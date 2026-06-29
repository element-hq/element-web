/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback, useMemo } from "react";
import { configure, Plugin, type Plugins } from "@dnd-kit/abstract";
import { Accessibility, type Draggable, type DragDropManager, type Droppable } from "@dnd-kit/dom";

import { useI18n } from "../../core/i18n/i18nContext";
import { isSectionDragData, type RoomListDragData } from "./dragAndDrop";
import type { RoomListViewModel } from "../RoomListView";

type Manager = DragDropManager;

/** Shape of the dnd-kit monitor event passed to the announcement getters. */
export type A11yData = {
    operation: {
        source: Draggable<RoomListDragData> | null;
        target: Droppable<RoomListDragData> | null;
    };
    canceled: boolean;
};

/**
 * Produces the screen-reader announcement for a drag lifecycle event, or `undefined`
 * to stay silent. The event exposes `operation.source`, `operation.target` and (on
 * `dragend`) `canceled`.
 */
export type DragAnnouncementGetter = (event: A11yData) => string | undefined;

/**
 * Options for {@link RoomListAccessibilityPlugin}.
 *
 * All fields are optional so the options type stays assignable to dnd-kit's generic
 * `PluginOptions`.
 */
export interface RoomListAccessibilityOptions {
    /** Announcement to emit for each drag lifecycle event. */
    announcements?: Partial<Record<"dragstart" | "dragover" | "dragend", DragAnnouncementGetter>>;
    /**
     * Keyboard drag instructions read out when a draggable receives focus, wired to each
     * draggable via `aria-describedby`.
     */
    instructions?: string;
}

/**
 * Create the visually-hidden `aria-live` region used to announce drag progress.
 *
 * @param politeness - `"polite"` for progress (start/over) updates, `"assertive"` for the terminal
 *   drop/cancel confirmation so it interrupts any pending progress chatter and is announced reliably.
 */
function createLiveRegion(id: string, politeness: "polite" | "assertive" = "polite"): HTMLDivElement {
    const element = document.createElement("div");
    element.id = id;
    element.setAttribute("role", politeness === "assertive" ? "alert" : "status");
    element.setAttribute("aria-live", politeness);
    element.setAttribute("aria-atomic", "true");
    Object.assign(element.style, {
        position: "fixed",
        width: "1px",
        height: "1px",
        margin: "-1px",
        border: "0",
        padding: "0",
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        clipPath: "inset(100%)",
        whiteSpace: "nowrap",
    });
    return element;
}

/**
 * Create the hidden element holding the keyboard drag instructions. Only referenced via
 * `aria-describedby` (never announced), so `display: none` is enough to hide it.
 */
function createInstructions(id: string, text: string): HTMLDivElement {
    const element = document.createElement("div");
    element.id = id;
    element.style.display = "none";
    element.textContent = text;
    return element;
}

/**
 * A dnd-kit plugin that manages the room list's drag-and-drop accessibility:
 * - announces drag progress to screen readers via an `aria-live` region, and
 * - exposes the keyboard drag instructions, wiring them to every draggable through
 *   `aria-describedby`.
 *
 * This is a deliberately reduced replacement for dnd-kit's built-in `Accessibility`
 * plugin. The built-in plugin also reflects `aria-pressed`/`aria-grabbed` onto the
 * draggable `<button>`, which VoiceOver reads as "selected" the instant a keyboard drag
 * starts. We filter the built-in plugin out (see VirtualizedRoomListView) and use this
 * instead: it never mutates the draggable's pressed/grabbed ARIA state.
 */
export class RoomListAccessibilityPlugin extends Plugin<Manager, RoomListAccessibilityOptions> {
    private liveRegion: HTMLDivElement;
    private assertiveRegion: HTMLDivElement;
    private instructions?: HTMLDivElement;
    private readonly unsubscribers: Array<() => void> = [];

    public constructor(manager: Manager, options?: RoomListAccessibilityOptions) {
        super(manager, options);

        const liveRegionId = crypto.randomUUID();
        const assertiveRegionId = crypto.randomUUID();
        const instructionsId = crypto.randomUUID();

        // Create the live regions up front so they exist in the DOM before any text change,
        // which assistive technologies require to reliably announce the first message.
        this.liveRegion = createLiveRegion(liveRegionId);
        this.assertiveRegion = createLiveRegion(assertiveRegionId, "assertive");
        document.body.append(this.liveRegion, this.assertiveRegion);

        const announcements = options?.announcements ?? {};
        for (const [eventName, getAnnouncement] of Object.entries(announcements)) {
            if (!getAnnouncement) continue;
            let unsubscribe: () => void;
            if (eventName === "dragend") {
                unsubscribe = manager.monitor.addEventListener("dragend", (event) => {
                    const a11yEvent = event as unknown as A11yData;
                    const message = getAnnouncement(a11yEvent);
                    // On drop the source element stays focused (focus never actually moves), so we need to announce the drop confirmation in the assertive region to ensure it is read.
                    this.announceAssertive(message);
                });
            } else {
                unsubscribe = manager.monitor.addEventListener(eventName as "dragstart", (event) => {
                    this.announce(getAnnouncement(event as unknown as A11yData));
                });
            }
            this.unsubscribers.push(unsubscribe);
        }

        if (options?.instructions) {
            this.instructions = createInstructions(instructionsId, options.instructions);
            document.body.append(this.instructions);

            // Point every draggable at the instructions via aria-describedby. The effect re-runs
            // as draggables register/unregister (the list is virtualized), so newly mounted items
            // get described too. We never touch aria-pressed/aria-grabbed here.
            this.registerEffect(() => {
                if (!this.instructions) return;
                for (const draggable of this.manager.registry.draggables.value) {
                    const activator = draggable.handle ?? draggable.element;
                    if (activator && !activator.hasAttribute("aria-describedby")) {
                        activator.setAttribute("aria-describedby", instructionsId);
                    }
                }
            });
        }
    }

    private announce(message: string | undefined): void {
        if (!message || this.liveRegion.textContent === message) return;
        this.liveRegion.textContent = message;
    }

    /**
     * Announce a terminal message (drop confirmation / cancellation) in the assertive live region.
     *
     * Unlike the polite progress region, the drop happens with focus parked on the source element
     * and no focus change to trigger a re-read, so an assertive region is required for Chrome to
     * announce it. It also interrupts any still-pending "… will be dropped …" progress chatter.
     */
    private announceAssertive(message: string | undefined): void {
        if (!message) return;
        // Always re-set (clearing first) so an identical message still re-announces, and so the
        // assertive region reliably fires even right after a polite progress update.
        this.assertiveRegion.textContent = "";
        this.assertiveRegion.textContent = message;
    }

    public destroy(): void {
        super.destroy();
        for (const unsubscribe of this.unsubscribers) unsubscribe();
        this.unsubscribers.length = 0;
        this.liveRegion.remove();
        this.assertiveRegion.remove();
        this.instructions?.remove();
    }
}

/**
 * Configures {@link RoomListAccessibilityPlugin} for the room list and returns a `plugins`
 * callback for `DragDropProvider`.
 *
 * It swaps dnd-kit's built-in Accessibility plugin (which adds the `aria-pressed` that
 * VoiceOver reads as "selected") for {@link RoomListAccessibilityPlugin}, supplying it with
 * localized announcements derived from the room list view model. The result is memoized so
 * the plugin descriptor stays stable across renders and the plugin isn't torn down and
 * recreated.
 */
export function useRoomListAccessibilityPlugin(
    vm: RoomListViewModel,
): (defaults: Plugins<Manager>) => Plugins<Manager> {
    const { translate: _t } = useI18n();

    // Get the display name of a draggable source: the section title for a section, or the
    // room name for a room. Returns undefined if the source can't be resolved.
    const getDragSourceName = useCallback(
        (source: Draggable<RoomListDragData>): string | undefined => {
            if (isSectionDragData(source.data)) {
                return vm.getSectionHeaderViewModel(source.id as string).getSnapshot().title;
            }
            return vm.getRoomItemViewModel(source.id as string)?.getSnapshot().name;
        },
        [vm],
    );

    const announcements = useMemo(
        () => ({
            dragstart: ({ operation: { source } }: A11yData) => {
                if (!source) return;
                const sourceName = getDragSourceName(source);
                if (sourceName === undefined) return;
                return _t("room_list|a11y|drag_start", { source: sourceName });
            },
            dragover: ({ operation: { source, target } }: A11yData) => {
                if (!source) return;
                const sourceName = getDragSourceName(source);
                if (sourceName === undefined) return;
                // A section dragged over a non-droppable area (favourites/low-priority or its own original slot) has no target and snaps back to where it started.
                if (isSectionDragData(source.data) && !target) {
                    return _t("room_list|a11y|drag_over_original", { source: sourceName });
                }
                if (!target) return;
                const targetTitle = vm.getSectionHeaderViewModel(target.id as string).getSnapshot().title;
                if (isSectionDragData(source.data) && isSectionDragData(target.data)) {
                    const droppedBefore = source.data.index > target.data.index;

                    return droppedBefore
                        ? _t("room_list|a11y|drag_over_before", { source: sourceName, target: targetTitle })
                        : _t("room_list|a11y|drag_over_after", { source: sourceName, target: targetTitle });
                }
                return _t("room_list|a11y|drag_over", { source: sourceName, target: targetTitle });
            },
            dragend: ({ operation: { source, target }, canceled }: A11yData) => {
                if (!source) return;
                if (canceled) return _t("room_list|a11y|drag_cancelled");
                const sourceName = getDragSourceName(source);
                if (sourceName === undefined) return;
                // A section dragged over a non-droppable area (favourites/low-priority or its own original slot) has no target and snaps back to where it started.
                if (isSectionDragData(source.data) && !target) {
                    return _t("room_list|a11y|drag_end_original", { source: sourceName });
                }

                if (!target) return;
                const targetTitle = vm.getSectionHeaderViewModel(target.id as string).getSnapshot().title;
                if (isSectionDragData(source.data) && isSectionDragData(target.data)) {
                    const droppedBefore = source.data.index > target.data.index;
                    return droppedBefore
                        ? _t("room_list|a11y|drag_end_before", { source: sourceName, target: targetTitle })
                        : _t("room_list|a11y|drag_end_after", { source: sourceName, target: targetTitle });
                }
                return _t("room_list|a11y|drag_end", { source: sourceName, target: targetTitle });
            },
        }),
        [vm, _t, getDragSourceName],
    );

    const instructions = _t("room_list|a11y|drag_instructions");

    return useCallback(
        (defaults) => [
            // remove the built-in Accessibility plugin
            ...defaults.filter((plugin) => plugin !== Accessibility),
            configure(RoomListAccessibilityPlugin, { announcements, instructions }),
        ],
        [announcements, instructions],
    );
}
