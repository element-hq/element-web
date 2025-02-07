/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Breadcrumb, Button, VisualList, VisualListItem } from "@vector-im/compound-web";
import CrossIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error";
import React, { useCallback, useState } from "react";

import { _t } from "../../../../languageHandler";
import { EncryptionCard } from "./EncryptionCard";
import { useKeyStoragePanelViewModel } from "../../../viewmodels/settings/encryption/KeyStoragePanelViewModel";
import SdkConfig from "../../../../SdkConfig";

interface Props {
    onFinish: () => void;
}

/**
 * Confirms that the user really wants to turn off and delete their key storage
 */
export function DeleteKeyStoragePanel({ onFinish }: Props): JSX.Element {
    const { setEnabled } = useKeyStoragePanelViewModel();
    const [busy, setBusy] = useState(false);

    const onDeleteClick = useCallback(async () => {
        setBusy(true);
        try {
            await setEnabled(false);
        } finally {
            setBusy(false);
        }
        onFinish();
    }, [setEnabled, onFinish]);

    return (
        <>
            <Breadcrumb
                backLabel={_t("action|back")}
                onBackClick={onFinish}
                pages={[_t("settings|encryption|title"), _t("settings|encryption|delete_key_storage|breadcrumb_page")]}
                onPageClick={onFinish}
            />
            <EncryptionCard
                Icon={ErrorIcon}
                destructive={true}
                title={_t("settings|encryption|delete_key_storage|title")}
                className="mx_DeleteKeyStoragePanel"
            >
                <div className="mx_DeleteKeyStoragePanel_content">
                    {_t("settings|encryption|delete_key_storage|description")}
                    <VisualList>
                        <VisualListItem Icon={CrossIcon} destructive={true}>
                            {_t("settings|encryption|delete_key_storage|list_first")}
                        </VisualListItem>
                        <VisualListItem Icon={CrossIcon} destructive={true}>
                            {_t("settings|encryption|delete_key_storage|list_second", { brand: SdkConfig.get().brand })}
                        </VisualListItem>
                    </VisualList>
                </div>
                <div className="mx_DeleteKeyStoragePanel_footer">
                    <Button destructive={true} onClick={onDeleteClick} disabled={busy}>
                        {_t("settings|encryption|delete_key_storage|confirm")}
                    </Button>
                    <Button kind="tertiary" onClick={onFinish}>
                        {_t("action|cancel")}
                    </Button>
                </div>
            </EncryptionCard>
        </>
    );
}
