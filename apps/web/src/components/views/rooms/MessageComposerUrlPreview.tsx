/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type ReactNode } from "react";
import { MessageComposerUrlPreviewView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { MessageComposerUrlPreviewViewModel } from "../../../viewmodels/composer/MessageComposerUrlPreviewViewModel";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext";
import { useDebouncedCallback } from "../../../hooks/spotlight/useDebouncedCallback";
import PlatformPeg from "../../../PlatformPeg";

const DEBOUNCE_REQUEST_TIMEOUT_MS = 500;

export function MessageComposerUrlPreviewWrapper({ content }: { content: string }): ReactNode | null {
    const { showUrlPreview } = useScopedRoomContext("showUrlPreview");
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new MessageComposerUrlPreviewViewModel({
                client: MatrixClientPeg.safeGet(),
                visible: showUrlPreview,
                showTooltips: PlatformPeg.get()?.needsUrlTooltips() ?? true,
            }),
    );

    useDebouncedCallback<[MessageComposerUrlPreviewViewModel, string]>(
        true,
        (vm, content) => {
            void vm.updateWithText(content);
        },
        [vm, content],
        DEBOUNCE_REQUEST_TIMEOUT_MS,
    );

    useEffect(() => {
        void vm.updateUrlPreviewVisible(showUrlPreview);
    }, [vm, showUrlPreview]);

    return <MessageComposerUrlPreviewView vm={vm} />;
}
