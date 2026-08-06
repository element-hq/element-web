/*
Copyright 2026 Element Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { MessageComposerUrlPreviewView, useViewModel } from "@element-hq/web-shared-components";

import { type MessageComposerUrlPreviewViewModel } from "../../../viewmodels/composer/MessageComposerUrlPreviewViewModel";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext";
import { ModuleApi } from "../../../modules/Api";

export function MessageComposerUrlPreviewWrapper({
    urlPreviewVm: vm,
    moduleApi = ModuleApi.instance,
}: {
    urlPreviewVm: MessageComposerUrlPreviewViewModel;
    moduleApi?: ModuleApi;
}): ReactNode | null {
    const { roomId } = useScopedRoomContext("showUrlPreview", "roomId");
    const { content } = useViewModel(vm);
    const customComponent = moduleApi.customComponents.renderComposerPreview({ text: content, roomId: roomId! }, () => (
        <MessageComposerUrlPreviewView vm={vm} />
    ));

    return customComponent ?? <MessageComposerUrlPreviewView vm={vm} />;
}
