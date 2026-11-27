/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentClass, createContext, useContext } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

/**
 * A context whose value is the currently logged-in {@link MatrixClient}.
 *
 * This context is available to components under {@link LoggedInView}.
 * It must not be used by components where there is no parent component
 * which provides a `MatrixClientContext`.
 *
 * Equivalent to `useContext(SDKContext).client!`.
 */
// We set the default value to `null`, but since we've asserted that the context cannot be used ouside a `LoggedInView`,
// we can make the result type non-nullable.
const MatrixClientContext = createContext<MatrixClient>(null as any);
MatrixClientContext.displayName = "MatrixClientContext";
export default MatrixClientContext;

export interface MatrixClientProps {
    mxClient: MatrixClient;
}

/**
 * @deprecated In new code, prefer to `useContext(MatrixClientContext)` directly.
 */
export function useMatrixClientContext(): MatrixClient {
    return useContext(MatrixClientContext);
}

const matrixHOC =
    <ComposedComponentProps extends object>(
        ComposedComponent: ComponentClass<ComposedComponentProps>,
    ): ((
        props: Omit<ComposedComponentProps, "mxClient"> & React.RefAttributes<InstanceType<typeof ComposedComponent>>,
    ) => React.ReactElement | null) =>
    (props) => {
        const client = useContext(MatrixClientContext);

        // @ts-ignore
        return <ComposedComponent {...props} mxClient={client} />;
    };
export const withMatrixClientHOC = matrixHOC;
