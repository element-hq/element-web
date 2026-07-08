/*
Copyright 2026 Element Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { MessageComposerUrlPreviewView } from "@element-hq/web-shared-components";

import { type MessageComposerUrlPreviewViewModel } from "../../../viewmodels/composer/MessageComposerUrlPreviewViewModel";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext";
import { ModuleApi } from "../../../modules/Api";

export function MessageComposerUrlPreviewWrapper({
    content,
    urlPreviewVm: vm,
    moduleApi = ModuleApi.instance,
}: {
    content: string;
    urlPreviewVm: MessageComposerUrlPreviewViewModel;
    moduleApi?: ModuleApi;
}): ReactNode | null {
    const { roomId } = useScopedRoomContext("showUrlPreview", "roomId");
    const customComponent = moduleApi.customComponents.renderComposerPreview({ text: content, roomId: roomId! }, () => (
        <MessageComposerUrlPreviewView vm={vm} />
    ));

    // We still update the VM even if the custom component is used since
    // the component may choose to render the original component.
    void vm.updateWithText(content);

    return customComponent ?? <MessageComposerUrlPreviewView vm={vm} />;
}
