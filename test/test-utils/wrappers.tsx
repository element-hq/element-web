/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { ComponentType, Ref } from "react";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { RenderOptions } from "@testing-library/react";

import { MatrixClientPeg as peg } from "../../src/MatrixClientPeg";
import MatrixClientContext from "../../src/contexts/MatrixClientContext";
import { SDKContext, SdkContextClass } from "../../src/contexts/SDKContext";

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
