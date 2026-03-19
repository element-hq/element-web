/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type RefObject, useContext, useEffect, useRef } from "react";
import { MsgType } from "matrix-js-sdk/src/matrix";
import {
    DecryptionFailureBodyView,
    FileBodyView,
    RedactedBodyView,
    useCreateAutoDisposedViewModel,
} from "@element-hq/web-shared-components";

import { type IBodyProps } from "./IBodyProps";
import RoomContext from "../../../contexts/RoomContext";
import { LocalDeviceVerificationStateContext } from "../../../contexts/LocalDeviceVerificationStateContext";
import { DecryptionFailureBodyViewModel } from "../../../viewmodels/message-body/DecryptionFailureBodyViewModel";
import { FileBodyViewModel } from "../../../viewmodels/message-body/FileBodyViewModel";
import { RedactedBodyViewModel } from "../../../viewmodels/message-body/RedactedBodyViewModel";

interface FileBodyViewProps {
    /*
     * Whether file-style message bodies should render their info row/placeholder.
     * Used by file-body rendering paths (for example FileBodyViewModel via MBodyFactory).
     */
    showFileInfo?: boolean;
}

type MBodyComponent = React.ComponentType<IBodyProps & FileBodyViewProps>;

// Adapter that binds RoomContext data and lifecycle updates to the
// FileBody view model before rendering the shared view component.
function FileBodyViewWrapped({
    mxEvent,
    mediaEventHelper,
    forExport,
    showFileInfo,
}: IBodyProps & FileBodyViewProps): JSX.Element {
    const { timelineRenderingType } = useContext(RoomContext);
    const refIFrame = useRef<HTMLIFrameElement>(null) as RefObject<HTMLIFrameElement>;
    const refLink = useRef<HTMLAnchorElement>(null) as RefObject<HTMLAnchorElement>;

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new FileBodyViewModel({
                mxEvent,
                mediaEventHelper,
                forExport,
                showFileInfo,
                timelineRenderingType,
                refIFrame,
                refLink,
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

    return <FileBodyView vm={vm} refIFrame={refIFrame} refLink={refLink} className="mx_MFileBody" />;
}

// Exported for explicit fallback usage where callers want file-body rendering.
export const FileBodyViewFactory: MBodyComponent = (props) => <FileBodyViewWrapped {...props} />;

export function RedactedBodyFactory({ mxEvent, ref }: Pick<IBodyProps, "mxEvent" | "ref">): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new RedactedBodyViewModel({ mxEvent }));

    useEffect(() => {
        vm.setEvent(mxEvent);
    }, [mxEvent, vm]);

    return <RedactedBodyView vm={vm} ref={ref} className="mx_RedactedBody" />;
}

export function DecryptionFailureBodyFactory({ mxEvent, ref }: Pick<IBodyProps, "mxEvent" | "ref">): JSX.Element {
    const verificationState = useContext(LocalDeviceVerificationStateContext);
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new DecryptionFailureBodyViewModel({
                decryptionFailureCode: mxEvent.decryptionFailureReason,
                verificationState,
            }),
    );

    useEffect(() => {
        vm.setDecryptionFailureCode(mxEvent.decryptionFailureReason);
        vm.setVerificationState(verificationState);
    }, [mxEvent, verificationState, vm]);

    return <DecryptionFailureBodyView vm={vm} ref={ref} className="mx_DecryptionFailureBody mx_EventTile_content" />;
}

// Message body factory registry.
// Start small: only m.file currently routes to the new FileBodyView path.
const MESSAGE_BODY_TYPES = new Map<string, MBodyComponent>([[MsgType.File, FileBodyViewFactory]]);

// Render a body using the picked factory.
// Falls back to the provided factory when msgtype has no specific handler.
export function renderMBody(
    props: IBodyProps & FileBodyViewProps,
    fallbackFactory?: MBodyComponent,
): JSX.Element | null {
    const BodyType = MESSAGE_BODY_TYPES.get(props.mxEvent.getContent().msgtype as string) ?? fallbackFactory;
    if (!BodyType) {
        return null;
    }

    return <BodyType {...props} />;
}
