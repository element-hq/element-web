/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type FC, lazy, Suspense, useEffect, useMemo } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
// Type-only: the component itself is loaded lazily below
import type * as ElementCallComponent from "@element-hq/element-call-component";

import { ElementCall as ElementCallModel } from "../../../models/Call";
import { CallStore } from "../../../stores/CallStore";
import { useSettingValue } from "../../../hooks/useSettings";
import { getCurrentLanguage } from "../../../languageHandler";
import { useEffectiveTheme } from "../../../hooks/useEffectiveTheme";
import Spinner from "../elements/Spinner";
import { ElementWebHostBridge } from "./ElementWebHostBridge";

/**
 * What `WrappedElementCallComponent` needs from an Element Call component module: satisfied by
 * `@element-hq/element-call-component` and by `ElementCallMock`, which is typed against the same
 * package types.
 */
type ElementCallComponentModule = Pick<typeof ElementCallComponent, "ElementCall" | "initializeElementCall">;

/**
 * Loads an Element Call component module and initialises it once, before its first render.
 */
const loadElementCall = async (
    module: Promise<ElementCallComponentModule>,
): Promise<{ default: ElementCallComponentModule["ElementCall"] }> => {
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
        ]).then(([m]) => m),
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
 * Wraps the Element Call component and constructs everything ElementCall needs.
 * from just: call + client.
 * Rendered inside the persisted root, where it lives for the whole call regardless of which tile
 * (room view, floating PiP) is showing the call, or whether any is (browser Picture-in-Picture window):
 * so this is where anything that must keep following Element Web while the call runs,
 * the theme and the language, is read.
 *
 * What the component reconnects on (`intent`, `config`) is decided once per call by the model; what it
 * takes live (`theme`, `language`, `hostBridge`) may change freely.
 */
export const WrappedElementCallComponent: FC<{ call: ElementCallModel; client: MatrixClient }> = ({ call, client }) => {
    // Real component or mock: independent of the widget-vs-React choice CallAppTile makes.
    const ElementCall = useSettingValue("Developer.elementCallMockComponent") ? MockElementCall : RealElementCall;
    const theme = useEffectiveTheme();
    // Not a hook: changing the language reloads Element Web, so there is no live change to follow
    const language = getCurrentLanguage().replace("_", "-");
    const bridge = useMemo(
        () => new ElementWebHostBridge(call, { widgetId: call.widget.id, widgetRoomId: call.widget.roomId }),
        [call],
    );
    const { intent, config } = call.componentOptions;

    return (
        <Suspense fallback={<Spinner />}>
            <ElementCall
                client={client}
                roomId={call.roomId}
                intent={intent}
                config={config}
                hostBridge={bridge}
                ref={call.setComponentHandle}
                theme={theme}
                language={language}
            />
            <MarkReadyOnMount call={call} />
        </Suspense>
    );
};
