/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useMemo, type ComponentType } from "react";
import { omitBy, pickBy } from "lodash";

import { MockViewModel } from "./MockViewModel";
import { type ViewModel } from "./ViewModel";

interface ViewWrapperProps<V> {
    /**
     * The component to render, which should accept a `vm` prop of type `V`.
     */
    Component: ComponentType<{ vm: V }>;
    /**
     * The props to pass to the component, which can include both snapshot data and actions.
     */
    props: Record<string, any>;
}

/**
 * A wrapper component that creates a view model instance and passes it to the specified component.
 * This is useful for testing components in isolation with a mocked view model and allows to use primitive types in stories.
 *
 * Props is parsed and split into snapshot and actions. Where values that are functions (`typeof Function`) are considered actions and the rest is considered the snapshot.
 *
 * @example
 * ```tsx
 * <ViewWrapper<SnapshotType, ViewModelType> props={Snapshot&Actions} Component={MyComponent} />
 * ```
 */
export function ViewWrapper<T, V extends ViewModel<T>>({
    props,
    Component,
}: Readonly<ViewWrapperProps<V>>): JSX.Element {
    const vm = useMemo(() => {
        const isFunction = (value: any): value is typeof Function => typeof value === typeof Function;
        const snapshot = omitBy(props, isFunction) as T;
        const actions = pickBy(props, isFunction);

        const vm = new MockViewModel<T>(snapshot);
        Object.assign(vm, actions);

        return vm as unknown as V;
    }, [props]);

    return <Component vm={vm} />;
}
