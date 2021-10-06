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

import React, { ComponentClass, createContext, forwardRef, useContext } from "react";
import { MatrixClient } from "matrix-js-sdk/src/client";

const MatrixClientContext = createContext<MatrixClient>(undefined);
MatrixClientContext.displayName = "MatrixClientContext";
export default MatrixClientContext;

export interface MatrixClientProps {
    mxClient: MatrixClient;
}

const matrixHOC = <ComposedComponentProps extends {}>(
    ComposedComponent: ComponentClass<ComposedComponentProps>,
) => {
    type ComposedComponentInstance = InstanceType<typeof ComposedComponent>;

    // eslint-disable-next-line react-hooks/rules-of-hooks

    const TypedComponent = ComposedComponent;

    return forwardRef<ComposedComponentInstance, Omit<ComposedComponentProps, 'mxClient'>>(
        (props, ref) => {
            const client = useContext(MatrixClientContext);

            // @ts-ignore
            return <TypedComponent ref={ref} {...props} mxClient={client} />;
        },
    );
};
export const withMatrixClientHOC = matrixHOC;
