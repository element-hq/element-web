/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useMemo } from "react";
import { FileBody as SharedFileBody } from "@element-hq/web-shared-components";

import { type IBodyProps } from "./IBodyProps";
import RoomContext from "../../../contexts/RoomContext";
import { MFileBodyViewModel } from "../../../viewmodels/messages/MFileBodyViewModel";

interface IProps extends IBodyProps {
    /* whether or not to show the default placeholder for the file. Defaults to true. */
    showGenericPlaceholder?: boolean;
}

/**
 * MFileBody component that wraps the shared FileBody with a ViewModel.
 * This component creates and manages the MFileBodyViewModel instance.
 */
export default function MFileBody(props: IProps): React.ReactElement {
    const context = useContext(RoomContext);

    const viewModel = useMemo(() => {
        return new MFileBodyViewModel({
            ...props,
            timelineRenderingType: context.timelineRenderingType,
        });
    }, [
        props.mxEvent,
        props.forExport,
        props.showGenericPlaceholder,
        props.mediaEventHelper,
        context.timelineRenderingType,
    ]);

    return <SharedFileBody vm={viewModel} />;
}
