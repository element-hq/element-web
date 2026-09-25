/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Mock of Element Call's public React component (`@element-hq/element-call-component`).
 *
 * Same `ElementCall` / `initializeElementCall` exports as the package, typed with the package's own
 * types (from its `api` entry point), so `WrappedElementCallComponent` can load either module
 * interchangeably. This module is only the component the package promises; what it shows in place of
 * a call is `ElementCallMockView`, and the Element Call it simulates is `ElementCallMockViewModel`.
 *
 * Used instead of the real component when `Developer.elementCallMockComponent` is on: in Playwright
 * (Element Web's test backend has no LiveKit) and for offline development. Never loaded otherwise.
 */

import React, { type JSX, useEffect, useImperativeHandle } from "react";
import { ElementCallMockView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { ElementCallMockViewModel } from "../../../viewmodels/voip/ElementCallMockViewModel";
import {
    type ConfigOptions,
    type ElementCallHostBridge,
    type ElementCallProps,
    UserIntent,
} from "@element-hq/element-call-component/api";

let initialisedWith: ConfigOptions | null = null;

/**
 * Prepares the things Element Call needs before it can be shown. Await this
 * once, before rendering {@link ElementCall}. The mock only records the config.
 */
export async function initializeElementCall(config: ConfigOptions = {}): Promise<void> {
    initialisedWith = config;
}

const NO_HOST: ElementCallHostBridge = {};

const ElementCallMock = ({
    client,
    roomId,
    intent = UserIntent.JoinExistingCall,
    config,
    hostBridge = NO_HOST,
    ref,
    theme,
    language,
}: ElementCallProps): JSX.Element => {
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new ElementCallMockViewModel({
                client,
                roomId,
                intent,
                config,
                hostBridge,
                theme,
                language,
                initializedWith: initialisedWith,
            }),
    );

    // Only a mock that is really on screen tells the host it has loaded; clearing the membership it
    // may have published is handled by the view model's disposal.
    useEffect(() => vm.start(), [vm]);

    // Like the real component, always talk to whichever bridge the host most recently gave us, and
    // follow the theme and the language, without restarting anything.
    useEffect(() => {
        vm.setProps({ intent, config, hostBridge, theme, language });
    }, [vm, intent, config, hostBridge, theme, language]);

    useImperativeHandle(ref, () => vm.handle, [vm]);

    return <ElementCallMockView vm={vm} />;
};

/**
 * Element Call, mocked: a member list, a dump of the configuration, buttons that exercise every host
 * bridge callback and a log of what was said in both directions.
 *
 * The room is fixed for the life of a view model, so a mock asked to call somewhere else remounts
 * rather than mutating one, exactly as the real component reconnects.
 *
 * Not to be confused with the `ElementCall` widget model in `models/Call.ts`.
 */
export const ElementCall = (props: ElementCallProps): JSX.Element => <ElementCallMock key={props.roomId} {...props} />;
