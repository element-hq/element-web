/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button, InlineSpinner, Text } from "@vector-im/compound-web";
import { DeleteIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import styles from "./DeleteKeyStorageView.module.css";
import { type ViewModel, useViewModel } from "../../core/viewmodel";
import { Flex } from "../../core/utils/Flex";
import { useI18n } from "../../core/i18n/i18nContext";

/** Snapshot data for the delete key storage confirmation. */
export interface DeleteKeyStorageViewSnapshot {
    /** True while key storage is being deleted. */
    busy: boolean;
    /** True if the last attempt to delete key storage failed. */
    failed: boolean;
}

/** User actions emitted by the delete key storage confirmation. */
export interface DeleteKeyStorageViewActions {
    /** Invoked when the user confirms deleting key storage. */
    confirm: () => void;
    /** Invoked when the user backs out without deleting key storage. */
    cancel: () => void;
}

/** View model contract for the delete key storage confirmation. */
export type DeleteKeyStorageViewModel = ViewModel<DeleteKeyStorageViewSnapshot, DeleteKeyStorageViewActions>;

interface DeleteKeyStorageViewProps {
    /**
     * The view model for the delete key storage confirmation.
     */
    vm: DeleteKeyStorageViewModel;
}

/**
 * Asks the user to confirm deleting key storage, and shows progress until the deletion has finished.
 *
 * Both buttons are disabled while the deletion runs, so it cannot be cancelled or started twice,
 * and the delete button shows a spinner in place of its icon.
 *
 * @example
 * ```tsx
 * <DeleteKeyStorageView vm={deleteKeyStorageViewModel} />
 * ```
 */
export function DeleteKeyStorageView({ vm }: Readonly<DeleteKeyStorageViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { busy, failed } = useViewModel(vm);

    return (
        <Flex direction="column" gap="var(--cpd-space-6x)">
            <Text>{_t("encryption|delete_key_storage|description")}</Text>
            {failed && (
                <Text className={styles.error} role="alert">
                    {_t("encryption|delete_key_storage|error")}
                </Text>
            )}
            <Flex className={styles.buttons} align="center" justify="end" gap="var(--cpd-space-4x)">
                <Button kind="secondary" size="md" disabled={busy} onClick={vm.cancel}>
                    {_t("action|cancel")}
                </Button>
                <Button
                    kind="primary"
                    size="md"
                    destructive
                    disabled={busy}
                    Icon={busy ? InlineSpinner : DeleteIcon}
                    onClick={vm.confirm}
                >
                    {_t("action|delete")}
                </Button>
            </Flex>
        </Flex>
    );
}
