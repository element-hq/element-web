/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Breadcrumb, Button, VisualList, VisualListItem } from "@vector-im/compound-web";
import CrossIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error-solid";
import React, { type JSX, useCallback, useState } from "react";

import { _t } from "../../../../languageHandler";
import { EncryptionCard } from "./EncryptionCard";
import { useKeyStoragePanelViewModel } from "../../../viewmodels/settings/encryption/KeyStoragePanelViewModel";
import SdkConfig from "../../../../SdkConfig";
import { EncryptionCardButtons } from "./EncryptionCardButtons";
import { EncryptionCardEmphasisedContent } from "./EncryptionCardEmphasisedContent";

interface Props {
    /**
     * Called when the user either cancels the operation or key storage has been disabled
     */
    onFinish: () => void;
}

/**
 * Confirms that the user really wants to turn off and delete their key storage.  Part of the "Encryption" settings tab.
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
            >
                <EncryptionCardEmphasisedContent>
                    {_t("settings|encryption|delete_key_storage|description")}
                    <VisualList>
                        <VisualListItem Icon={CrossIcon} destructive={true}>
                            {_t("settings|encryption|delete_key_storage|list_first")}
                        </VisualListItem>
                        <VisualListItem Icon={CrossIcon} destructive={true}>
                            {_t("settings|encryption|delete_key_storage|list_second", { brand: SdkConfig.get().brand })}
                        </VisualListItem>
                    </VisualList>
                </EncryptionCardEmphasisedContent>
                <EncryptionCardButtons>
                    <Button destructive={true} onClick={onDeleteClick} disabled={busy}>
                        {_t("settings|encryption|delete_key_storage|confirm")}
                    </Button>
                    <Button kind="tertiary" onClick={onFinish}>
                        {_t("action|cancel")}
                    </Button>
                </EncryptionCardButtons>
            </EncryptionCard>
        </>
    );
}
