/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentType, type Ref } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type RenderOptions } from "jest-matrix-react";

import { MatrixClientPeg as peg } from "../../src/MatrixClientPeg";
import MatrixClientContext from "../../src/contexts/MatrixClientContext";
import { SDKContext, type SdkContextClass } from "../../src/contexts/SDKContext";

type WrapperProps<T> = { wrappedRef?: Ref<ComponentType<T>> } & T;

export function wrapInMatrixClientContext<T>(WrappedComponent: ComponentType<T>): ComponentType<WrapperProps<T>> {
    class Wrapper extends React.Component<WrapperProps<T>> {
        _matrixClient: MatrixClient;
        constructor(props: WrapperProps<T>) {
            super(props);

            this._matrixClient = peg.safeGet();
        }

        render() {
            return (
                <MatrixClientContext.Provider value={this._matrixClient}>
                    <WrappedComponent ref={this.props.wrappedRef} {...this.props} />
                </MatrixClientContext.Provider>
            );
        }
    }
    return Wrapper;
}

export function wrapInSdkContext<T>(
    WrappedComponent: ComponentType<T>,
    sdkContext: SdkContextClass,
): ComponentType<WrapperProps<T>> {
    return class extends React.Component<WrapperProps<T>> {
        render() {
            return (
                <SDKContext.Provider value={sdkContext}>
                    <WrappedComponent {...this.props} />
                </SDKContext.Provider>
            );
        }
    };
}

/**
 * Test helper to generate React testing library render options for wrapping with a MatrixClientContext.Provider
 * @param client the MatrixClient instance to expose via the provider
 */
export function withClientContextRenderOptions(client: MatrixClient): RenderOptions {
    return {
        wrapper: ({ children }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        ),
    };
}
