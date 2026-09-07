/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type FC, type JSX, lazy, Suspense, useEffect } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { CallEvent, ElementCall as ElementCallModel } from "../../../models/Call";
import { CallStore } from "../../../stores/CallStore";
import SettingsStore from "../../../settings/SettingsStore";
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

/**
 * Everything Element Web hands to the Element Call React component for one call, created once per
 * `ElementCall` model and shared by every tile that shows the call.
 *
 * The component renders into a persisted React root (see `PersistedElement`) and so outlives the tiles
 * that place it: the room's call view, the floating PiP, a browser Picture-in-Picture window. React keeps
 * the component instance across those moves, but Element Call restarts the call (leaving and rejoining,
 * resetting the mute state) whenever the identity of its `config` or `hostBridge` props changes. Both are
 * therefore fixed here for the call's lifetime, as the iframe transport fixes them into the widget URL,
 * and the element is built once so that a tile rendering it again leaves the component's subtree
 * untouched. Tiles only decide where the persisted DOM is shown.
 */
export class ElementCallInstance {
    private static readonly instances = new WeakMap<ElementCallModel, ElementCallInstance>();

    /**
     * The instance for the call, created (and its bridge started) on first use. Idempotent, so that it
     * can be called from a render.
     */
    public static get(call: ElementCallModel, client: MatrixClient): ElementCallInstance {
        let instance = ElementCallInstance.instances.get(call);
        if (!instance) {
            instance = new ElementCallInstance(call, client);
            ElementCallInstance.instances.set(call, instance);
        }
        return instance;
    }

    /**
     * Stops the call's bridge and forgets the instance, so that showing the call again starts afresh.
     * To be called once the element has been unmounted (the persisted root destroyed), since the
     * component must not be left with a stopped bridge. Also happens when the call model is destroyed.
     */
    public static destroy(call: ElementCallModel): void {
        const instance = ElementCallInstance.instances.get(call);
        if (!instance) return;
        ElementCallInstance.instances.delete(call);
        call.off(CallEvent.Destroy, instance.onCallDestroyed);
        instance.bridge.stop();
    }

    /** The control plane between the component and the model, alive as long as this instance. */
    public readonly bridge: ElementWebHostBridge;
    /** The component, with all of its props fixed. The same object for every render. */
    public readonly element: JSX.Element;

    private constructor(
        private readonly call: ElementCallModel,
        client: MatrixClient,
    ) {
        this.bridge = new ElementWebHostBridge(call, { widgetId: call.widget.id, widgetRoomId: call.widget.roomId });
        this.bridge.start();
        call.on(CallEvent.Destroy, this.onCallDestroyed);

        // Decided once, like the widget URL is: the call the user is in must not change its nature when
        // the room's state (say, who else is in the call) changes underneath it.
        const { intent, config } = call.getCallOptions();
        // Real component or mock: independent of the widget-vs-React choice CallTile makes.
        const ElementCall = SettingsStore.getValue("Developer.elementCallMockComponent")
            ? MockElementCall
            : RealElementCall;
        this.element = (
            <Suspense fallback={<Spinner />}>
                <ElementCall
                    client={client}
                    roomId={call.roomId}
                    intent={intent}
                    config={config}
                    hostBridge={this.bridge}
                />
                <MarkReadyOnMount call={call} />
            </Suspense>
        );
    }

    private readonly onCallDestroyed = (): void => ElementCallInstance.destroy(this.call);
}
