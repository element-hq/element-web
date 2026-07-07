/*
Copyright 2026 Element Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useState, type ReactNode } from "react";
import { MessageComposerUrlPreviewView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { MessageComposerUrlPreviewViewModel } from "../../../viewmodels/composer/MessageComposerUrlPreviewViewModel";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext";
import { useDebouncedCallback } from "../../../hooks/spotlight/useDebouncedCallback";
import PlatformPeg from "../../../PlatformPeg";
import { ModuleApi } from "../../../modules/Api";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";

export const DEBOUNCE_REQUEST_TIMEOUT_MS = 500;

export function MessageComposerUrlPreviewWrapper({
    content,
    moduleApi = ModuleApi.instance,
}: {
    content: string;
    moduleApi?: ModuleApi;
}): ReactNode | null {
    const { showUrlPreview, roomId } = useScopedRoomContext("showUrlPreview", "roomId");
    const [customComponent, setCustomComponent] = useState<React.JSX.Element | null>(null);

    const client = useMatrixClientContext();
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new MessageComposerUrlPreviewViewModel({
                client,
                visible: showUrlPreview,
                showTooltips: PlatformPeg.get()?.needsUrlTooltips() ?? true,
            }),
    );

    useEffect(() => {
        void vm.updateUrlPreviewVisible(showUrlPreview);
    }, [vm, showUrlPreview]);

    // Rather than checking each time the text changes, we only do a URL check every 500ms to avoid
    // hitting the server too frequently. We also only check the module API for a custom component
    // at this frequency to avoid expensive calculations downstream.
    useDebouncedCallback<[MessageComposerUrlPreviewViewModel, string]>(
        true,
        (vm, content) => {
            const customComponent = moduleApi.customComponents.renderComposerPreview(
                { text: content, roomId: roomId! },
                () => <MessageComposerUrlPreviewView vm={vm} />,
            );

            if (customComponent) {
                setCustomComponent(customComponent);
            }
            // We still update the VM even if the custom component is used since
            // the component may choose to render the original component.
            void vm.updateWithText(content);
        },
        [vm, content],
        // Update instantly if content is empty (e.g. sent message or cleared input)
        content ? DEBOUNCE_REQUEST_TIMEOUT_MS : 0,
    );

    return customComponent ?? <MessageComposerUrlPreviewView vm={vm} />;
}
