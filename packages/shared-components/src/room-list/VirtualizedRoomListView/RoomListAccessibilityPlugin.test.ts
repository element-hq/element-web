/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoomListAccessibilityPlugin, type RoomListAccessibilityOptions } from "./RoomListAccessibilityPlugin";

// ---------------------------------------------------------------------------
// Minimal mock manager compatible with the @dnd-kit/abstract Plugin base class
// ---------------------------------------------------------------------------

type EventHandler = (event: unknown) => void;

function createMockManager(): {
    monitor: { addEventListener: ReturnType<typeof vi.fn> };
    registry: {
        draggables: { readonly value: IterableIterator<{ handle: HTMLElement | null; element: HTMLElement | null }> };
    };
    dispatch: (eventName: string, event: unknown) => void;
    draggableElements: { handle: HTMLElement | null; element: HTMLElement | null }[];
} {
    const listeners = new Map<string, EventHandler[]>();

    const monitor = {
        addEventListener: vi.fn((eventName: string, handler: EventHandler) => {
            if (!listeners.has(eventName)) listeners.set(eventName, []);
            listeners.get(eventName)!.push(handler);
            return vi.fn(() => {
                const fns = listeners.get(eventName);
                if (fns) {
                    const idx = fns.indexOf(handler);
                    if (idx >= 0) fns.splice(idx, 1);
                }
            });
        }),
    };

    // A list of fake draggable objects the effect iterates over.
    const draggableElements: { handle: HTMLElement | null; element: HTMLElement | null }[] = [];

    const registry = {
        draggables: {
            // Plain (non-reactive) getter – the effect runs once on construction.
            get value() {
                return draggableElements.values();
            },
        },
    };

    /** Trigger a monitor event on all registered handlers. */
    const dispatch = (eventName: string, event: unknown): void => {
        listeners.get(eventName)?.forEach((fn) => fn(event));
    };

    return { monitor, registry, dispatch, draggableElements };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createPlugin(
    manager: ReturnType<typeof createMockManager>,
    options?: RoomListAccessibilityOptions,
): RoomListAccessibilityPlugin {
    // RoomListAccessibilityPlugin extends Plugin<DragDropManager> from @dnd-kit/abstract.
    // The base class only requires manager.monitor and manager.registry to exist, which our
    // mock satisfies.
    return new RoomListAccessibilityPlugin(manager as never, options);
}

function getLiveRegion(): HTMLElement | null {
    return document.querySelector<HTMLElement>("[role='status'][aria-live='polite']");
}

function getAssertiveRegion(): HTMLElement | null {
    return document.querySelector<HTMLElement>("[role='alert'][aria-live='assertive']");
}

function getInstructions(): HTMLElement | null {
    return document.querySelector<HTMLElement>("[style*='display: none']");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RoomListAccessibilityPlugin", () => {
    let manager: ReturnType<typeof createMockManager>;

    beforeEach(() => {
        manager = createMockManager();
    });

    afterEach(() => {
        // Clean up any DOM nodes left behind by tests that don't call destroy().
        getLiveRegion()?.remove();
        getAssertiveRegion()?.remove();
        getInstructions()?.remove();
    });

    describe("construction", () => {
        it("appends a polite aria-live region to the document body", () => {
            const plugin = createPlugin(manager);

            const region = getLiveRegion();
            expect(region).not.toBeNull();
            expect(region).toBeInTheDocument();
            expect(region).toHaveAttribute("role", "status");
            expect(region).toHaveAttribute("aria-live", "polite");
            expect(region).toHaveAttribute("aria-atomic", "true");

            plugin.destroy();
        });

        it("appends an assertive aria-live region to the document body", () => {
            const plugin = createPlugin(manager);

            const region = getAssertiveRegion();
            expect(region).not.toBeNull();
            expect(region).toBeInTheDocument();
            expect(region).toHaveAttribute("role", "alert");
            expect(region).toHaveAttribute("aria-live", "assertive");
            expect(region).toHaveAttribute("aria-atomic", "true");

            plugin.destroy();
        });

        it("appends a hidden instructions element when the instructions option is provided", () => {
            const plugin = createPlugin(manager, { instructions: "Press Space to drag" });

            const el = getInstructions();
            expect(el).not.toBeNull();
            expect(el).toBeInTheDocument();
            expect(el?.textContent).toBe("Press Space to drag");
            expect(el?.style.display).toBe("none");

            plugin.destroy();
        });

        it("does not append an instructions element when the option is omitted", () => {
            const plugin = createPlugin(manager);
            expect(getInstructions()).toBeNull();
            plugin.destroy();
        });

        it("adds aria-describedby pointing to the instructions element on existing draggables", () => {
            const button = document.createElement("button");
            button.setAttribute("aria-label", "Toggle Favourites section");
            document.body.append(button);

            manager.draggableElements.push({ handle: button, element: button });

            const plugin = createPlugin(manager, { instructions: "Press Space to drag" });

            // The ID is a generated UUID — verify the button points to the instructions element.
            const instructionsId = button.getAttribute("aria-describedby");
            expect(instructionsId).toBeTruthy();
            expect(document.getElementById(instructionsId!)).toBe(getInstructions());

            button.remove();
            plugin.destroy();
        });

        it("does not overwrite an existing aria-describedby on a draggable", () => {
            const button = document.createElement("button");
            button.setAttribute("aria-describedby", "my-existing-id");
            document.body.append(button);

            manager.draggableElements.push({ handle: button, element: button });

            const plugin = createPlugin(manager, { instructions: "Press Space to drag" });

            expect(button).toHaveAttribute("aria-describedby", "my-existing-id");

            button.remove();
            plugin.destroy();
        });
    });

    describe("dragstart and dragover announcements", () => {
        it("writes a dragstart message to the live region", () => {
            const plugin = createPlugin(manager, {
                announcements: { dragstart: () => "Dragging Favourites" },
            });

            manager.dispatch("dragstart", {});

            expect(getLiveRegion()?.textContent).toBe("Dragging Favourites");

            plugin.destroy();
        });

        it("writes a dragover message to the live region", () => {
            const plugin = createPlugin(manager, {
                announcements: { dragover: () => "Dragging Favourites over Low Priority" },
            });

            manager.dispatch("dragover", {});

            expect(getLiveRegion()?.textContent).toBe("Dragging Favourites over Low Priority");

            plugin.destroy();
        });

        it("does not update the live region when the getter returns undefined", () => {
            const plugin = createPlugin(manager, {
                announcements: { dragstart: () => undefined },
            });

            manager.dispatch("dragstart", {});

            expect(getLiveRegion()?.textContent).toBe("");

            plugin.destroy();
        });

        it("does not update the live region when the message is the same as the current text", () => {
            const get = vi.fn(() => "Dragging Favourites");
            const plugin = createPlugin(manager, {
                announcements: { dragstart: get },
            });

            manager.dispatch("dragstart", {});
            manager.dispatch("dragstart", {});

            // The getter was called twice but the live region text is set only once (dedup).
            expect(get).toHaveBeenCalledTimes(2);
            expect(getLiveRegion()?.textContent).toBe("Dragging Favourites");

            plugin.destroy();
        });

        it("passes the raw dnd-kit event to the announcement getter", () => {
            const getter = vi.fn(() => "Dragging Favourites");
            const plugin = createPlugin(manager, {
                announcements: { dragstart: getter },
            });

            const fakeEvent = { operation: { source: { id: "fav" } } };
            manager.dispatch("dragstart", fakeEvent);

            expect(getter).toHaveBeenCalledWith(fakeEvent);

            plugin.destroy();
        });
    });

    describe("dragend announcement", () => {
        it("announces the drop message in the assertive live region", () => {
            const plugin = createPlugin(manager, {
                announcements: { dragend: () => "Favourites was dropped on Low Priority" },
            });

            manager.dispatch("dragend", { operation: { source: { id: "favourites" } } });

            // The drop is announced in the assertive region: focus stays on the source element so
            // there is no focus change to read, and an assertive region reliably announces on Chrome.
            expect(getAssertiveRegion()?.textContent).toBe("Favourites was dropped on Low Priority");

            plugin.destroy();
        });

        it("re-announces an identical message by clearing the region first", () => {
            const plugin = createPlugin(manager, {
                announcements: { dragend: () => "Dropped" },
            });

            manager.dispatch("dragend", { operation: { source: { id: "favourites" } } });
            expect(getAssertiveRegion()?.textContent).toBe("Dropped");

            // The same text set twice must still end up in the region (clear-then-set forces a change).
            manager.dispatch("dragend", { operation: { source: { id: "favourites" } } });
            expect(getAssertiveRegion()?.textContent).toBe("Dropped");

            plugin.destroy();
        });

        it("does not announce when the getter returns undefined", () => {
            const plugin = createPlugin(manager, {
                announcements: { dragend: () => undefined },
            });

            manager.dispatch("dragend", { operation: { source: { id: "favourites" } } });

            // Both live regions stay empty.
            expect(getLiveRegion()?.textContent).toBe("");
            expect(getAssertiveRegion()?.textContent).toBe("");

            plugin.destroy();
        });
    });

    describe("destroy", () => {
        it("removes the live region from the document", () => {
            const plugin = createPlugin(manager);
            expect(getLiveRegion()).not.toBeNull();

            plugin.destroy();

            expect(getLiveRegion()).toBeNull();
        });

        it("removes the assertive live region from the document", () => {
            const plugin = createPlugin(manager);
            expect(getAssertiveRegion()).not.toBeNull();

            plugin.destroy();

            expect(getAssertiveRegion()).toBeNull();
        });

        it("removes the instructions element from the document", () => {
            const plugin = createPlugin(manager, { instructions: "Press Space to drag" });
            expect(getInstructions()).not.toBeNull();

            plugin.destroy();

            expect(getInstructions()).toBeNull();
        });

        it("calls the unsubscribe functions returned by monitor.addEventListener", () => {
            // Capture the unsubscribe function spy that the mock returns.
            let unsubscribeSpy: ReturnType<typeof vi.fn> | undefined;
            manager.monitor.addEventListener.mockImplementation((_eventName: string, _handler: EventHandler) => {
                unsubscribeSpy = vi.fn();
                return unsubscribeSpy as unknown as ReturnType<typeof vi.fn<() => void>>;
            });

            const plugin = createPlugin(manager, {
                announcements: { dragstart: () => "Dragging" },
            });

            plugin.destroy();

            expect(unsubscribeSpy).toHaveBeenCalled();
        });
    });
});
