/*
Copyright 2025 Element Creations Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";

import type { BaseViewModel } from "./BaseViewModel";

type VmCreator<B extends BaseViewModel<unknown, unknown>> = () => B;

/**
 * Instantiate a view-model that gets disposed when the calling react component unmounts.
 * In other words, this hook ties the lifecycle of a view-model to the lifecycle of a
 * react component.
 *
 * @param vmCreator A function that returns a view-model instance
 * @returns view-model instance from vmCreator
 * @example
 * const vm = useCreateAutoDisposedViewModel(() => new FooViewModel({prop1, prop2, ...});
 */
export function useCreateAutoDisposedViewModel<B extends BaseViewModel<unknown, unknown>>(vmCreator: VmCreator<B>): B {
    /**
     * The view-model instance may be replaced by a different instance in some scenarios.
     * We want to be sure that whatever react component called this hook gets re-rendered
     * when this happens, hence the state.
     */
    const [viewModel, setViewModel] = useState<B>(vmCreator);

    /**
     * Our intention here is to ensure that the dispose method of the view-model gets called
     * when the component that uses this hook unmounts.
     * We can do that by combining a useEffect cleanup with an empty dependency array.
     */
    useEffect(() => {
        let toDispose = viewModel;

        /**
         * Because we use react strict mode, react will run our effects twice in dev mode to make
         * sure that they are pure.
         * This presents a complication - the vm instance that we created in our state initializer
         * will get disposed on the first cleanup.
         * So we'll recreate the view-model if it's already disposed.
         */
        if (viewModel.isDisposed) {
            const newViewModel = vmCreator();
            // Change toDispose so that we don't end up disposing the already disposed vm.
            toDispose = newViewModel;
            setViewModel(newViewModel);
        }
        return () => {
            // Dispose the view-model when this component unmounts
            toDispose.dispose();
        };

        // eslint-disable-next-line react-compiler/react-compiler
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return viewModel;
}
