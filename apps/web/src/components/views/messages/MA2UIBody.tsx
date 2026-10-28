/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, useEffect } from "react";
import { A2UISurfaceView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { type IBodyProps } from "./IBodyProps";
import { TextualBodyFactory } from "./TextualBodyFactory";
import { useSettingValue } from "../../../hooks/useSettings";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useMediaVisible } from "../../../hooks/useMediaVisible";
import { A2UIBodyViewModel } from "../../../viewmodels/message-body/A2UIBodyViewModel";

/**
 * Body for an `m.room.message` with the `io.element.a2ui` msgtype.
 *
 * Renders the A2UI surfaces when the labs flag is on. Otherwise, and for exports and non-interactive previews,
 * the message's plain-text `body` is shown like any other text message.
 */
export function MA2UIBody(props: IBodyProps): JSX.Element {
    const enabled = useSettingValue("feature_a2ui");
    if (!enabled || props.forExport || props.inhibitInteraction) {
        return <TextualBodyFactory {...props} />;
    }
    return <A2UIBody {...props} />;
}

function A2UIBody({ mxEvent, getRelationsForEvent, ref }: IBodyProps): JSX.Element {
    const cli = useMatrixClientContext();
    const [mediaVisible, setMediaVisible] = useMediaVisible(mxEvent);
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new A2UIBodyViewModel({
                mxEvent,
                cli,
                getRelationsForEvent,
                mediaVisible,
                setMediaVisible,
            }),
    );

    useEffect(() => {
        vm.setEvent(mxEvent);
    }, [mxEvent, vm]);

    useEffect(() => {
        vm.setMediaProps(mediaVisible, setMediaVisible);
    }, [mediaVisible, setMediaVisible, vm]);

    return <A2UISurfaceView vm={vm} ref={ref} className="mx_MA2UIBody mx_EventTile_content" />;
}
