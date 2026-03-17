/*
Copyright 2026 tim2zg

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { 
    NetworkProxyView, 
    NetworkProxyViewModelImpl, 
    useCreateAutoDisposedViewModel,
    type ProxyConfig
} from "@element-hq/web-shared-components";

import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import BaseDialog from "../dialogs/BaseDialog";
import { _t } from "../../../languageHandler";

interface Props {
    onFinished: () => void;
}

/**
 * A modal dialog for configuring network proxy settings for the desktop application.
 * Utilizes MVVM pattern with NetworkProxyViewModel and NetworkProxyView.
 *
 * @param props - The component props.
 * @param props.onFinished - Callback invoked when the modal is closed or settings are saved.
 */
export const NetworkProxyModal: React.FC<Props> = ({ onFinished }) => {
    const vm = useCreateAutoDisposedViewModel(() => new NetworkProxyViewModelImpl({
        initialConfig: SettingsStore.getValue("desktopProxyConfig") as ProxyConfig,
        onSave: async (config) => {
            await SettingsStore.setValue("desktopProxyConfig", null, SettingLevel.PLATFORM, config);
            onFinished();
        },
        onCancel: onFinished,
    }));

    return (
        <BaseDialog
            title={_t("settings|network_proxy|title")}
            onFinished={onFinished}
            fixedWidth={false}
        >
            <div className="mx_NetworkProxyModal">
                <NetworkProxyView vm={vm} />
            </div>
        </BaseDialog>
    );
};
