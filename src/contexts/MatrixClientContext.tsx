/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, {
    ComponentClass,
    createContext,
    forwardRef,
    PropsWithoutRef,
    ForwardRefExoticComponent,
    useContext,
    RefAttributes,
} from "react";
import { MatrixClient } from "matrix-js-sdk/src/client";

// This context is available to components under LoggedInView,
// the context must not be used by components outside a MatrixClientContext tree.
// This assertion allows us to make the type not nullable.
const MatrixClientContext = createContext<MatrixClient>(null as any);
MatrixClientContext.displayName = "MatrixClientContext";
export default MatrixClientContext;

export interface MatrixClientProps {
    mxClient: MatrixClient;
}

export function useMatrixClientContext(): MatrixClient {
    return useContext(MatrixClientContext);
}

const matrixHOC = <ComposedComponentProps extends {}>(
    ComposedComponent: ComponentClass<ComposedComponentProps>,
): ForwardRefExoticComponent<
    PropsWithoutRef<Omit<ComposedComponentProps, "mxClient">> &
        RefAttributes<InstanceType<ComponentClass<ComposedComponentProps>>>
> => {
    type ComposedComponentInstance = InstanceType<typeof ComposedComponent>;

    // eslint-disable-next-line react-hooks/rules-of-hooks

    const TypedComponent = ComposedComponent;

    return forwardRef<ComposedComponentInstance, Omit<ComposedComponentProps, "mxClient">>((props, ref) => {
        const client = useContext(MatrixClientContext);

        // @ts-ignore
        return <TypedComponent ref={ref} {...props} mxClient={client} />;
    });
};
export const withMatrixClientHOC = matrixHOC;
