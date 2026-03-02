/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useContext, useEffect } from "react";
import { MsgType } from "matrix-js-sdk/src/matrix";
import { MFileBodyView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { type IBodyProps } from "./IBodyProps";
import RoomContext from "../../../contexts/RoomContext";
import { MFileBodyViewModel } from "../../../viewmodels/message-body/MFileBodyViewModel";

interface MFileBodyViewProps {
    /*
     * Whether file-style message bodies should render their info row/placeholder.
     * Used by file-body rendering paths (for example MFileBodyViewModel via MBodyFactory).
     */
    showFileInfo?: boolean;
}

type MBodyComponent = React.ComponentType<IBodyProps & MFileBodyViewProps>;

// Adapter that binds RoomContext data and lifecycle updates to the
// MFileBody view model before rendering the shared view component.
function MFileBodyViewWrapped({
    mxEvent,
    mediaEventHelper,
    forExport,
    showFileInfo,
}: IBodyProps & MFileBodyViewProps): JSX.Element {
    const { timelineRenderingType } = useContext(RoomContext);

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new MFileBodyViewModel({
                mxEvent,
                mediaEventHelper,
                forExport,
                showFileInfo,
                timelineRenderingType,
            }),
    );

    useEffect(() => {
        vm.setProps({
            mxEvent,
            mediaEventHelper,
            forExport,
            showFileInfo,
            timelineRenderingType,
        });
    }, [mxEvent, mediaEventHelper, forExport, showFileInfo, timelineRenderingType, vm]);

    return <MFileBodyView vm={vm} refIFrame={vm.refIFrame} refLink={vm.refLink} />;
}

// Exported for explicit fallback usage where callers want file-body rendering.
export const MFileBodyViewFactory: MBodyComponent = (props) => <MFileBodyViewWrapped {...props} />;

// Message body factory registry.
// Start small: only m.file currently routes to the new MFileBodyView path.
const MESSAGE_BODY_TYPES = new Map<string, MBodyComponent>([[MsgType.File, MFileBodyViewFactory]]);

// Render a body using the picked factory.
// Falls back to the provided factory when msgtype has no specific handler.
export function renderMBody(
    props: IBodyProps & MFileBodyViewProps,
    fallbackFactory?: MBodyComponent,
): JSX.Element | null {
    const BodyType = MESSAGE_BODY_TYPES.get(props.mxEvent.getContent().msgtype as string) ?? fallbackFactory;
    if (!BodyType) {
        return null;
    }

    return <BodyType {...props} />;
}
