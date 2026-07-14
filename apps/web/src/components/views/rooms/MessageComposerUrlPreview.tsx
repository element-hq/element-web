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
import { useSettingValue } from "../../../hooks/useSettings";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";

export function MessageComposerUrlPreviewWrapper({
    urlPreviewVm: vm,
    moduleApi = ModuleApi.instance,
}: {
    urlPreviewVm: MessageComposerUrlPreviewViewModel;
    moduleApi?: ModuleApi;
}): ReactNode | null {
    const { roomId } = useScopedRoomContext("showUrlPreview", "roomId");
    const { content } = useViewModel(vm);
    const collapsed = useSettingValue("composerUrlPreviewCollapsed");
    function toggleCollapsed() {
        SettingsStore.setValue("composerUrlPreviewCollapsed", null, SettingLevel.DEVICE, !collapsed);
    }

    const urlPreviewBundles = useSettingValue("feature_msc4095_url_preview_bundle");

    const previewView = (
        <MessageComposerUrlPreviewView
            vm={vm}
            collapsed={collapsed}
            toggleCollapsed={toggleCollapsed}
            removePreview={urlPreviewBundles ? vm.removePreview : undefined}
        />
    );
    const customComponent = moduleApi.customComponents.renderComposerPreview(
        { text: content, roomId: roomId! },
        () => previewView,
    );

    return customComponent ?? previewView;
}
