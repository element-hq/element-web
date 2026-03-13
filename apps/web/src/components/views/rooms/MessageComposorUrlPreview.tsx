/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useMemo, type ReactNode } from "react";
import { UrlPreviewStatusBar, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { UrlPreviewViewModel } from "../../../viewmodels/message-body/UrlPreviewViewModel";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

export function MessageComposorUrlPreview({ content }: { content: string }): ReactNode | null {
    const urls = useMemo(() => new Set(content.split(" ").filter((word) => URL.canParse(word.trim()))), [content]);

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new UrlPreviewViewModel({
                client: MatrixClientPeg.safeGet(),
                mxEvent: new MatrixEvent({ origin_server_ts: Date.now() }),
                mediaVisible: false,
                onImageClicked: () => {},
                // XXX: Look at settings store.
                visible: true,
                canHidePreview: false,
            }),
    );

    useEffect(() => {
        console.log("New links", urls);
        vm.updateWithLinks([...urls]);
    }, [vm, urls]);

    return (
        <div>
            <UrlPreviewStatusBar vm={vm} />
        </div>
    );
}
