/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler } from "react";
import { Button, Heading, Text } from "@vector-im/compound-web";
import SignOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/sign-out";

import styles from "./LegacyCryptoUnsupportedView.module.css";
import { type ViewModel, useViewModel } from "../../core/viewmodel";
import { Flex } from "../../core/utils/Flex";
import { useI18n } from "../../core/i18n/i18nContext";

/** Snapshot data for the legacy crypto unsupported screen. */
export interface LegacyCryptoUnsupportedViewSnapshot {
    /** The application brand name, for example "Element". */
    brand: string;
    /** The last application version that still supports migrating this session, for example "v1.12.29". */
    version: string;
}

/** User actions emitted by the legacy crypto unsupported screen. */
export interface LegacyCryptoUnsupportedViewActions {
    /** Invoked when the sign out button is clicked. */
    onSignOutClick: MouseEventHandler<HTMLButtonElement>;
}

/** View model contract for the legacy crypto unsupported screen. */
export type LegacyCryptoUnsupportedViewModel = ViewModel<
    LegacyCryptoUnsupportedViewSnapshot,
    LegacyCryptoUnsupportedViewActions
>;

interface LegacyCryptoUnsupportedViewProps {
    /**
     * The view model for the legacy crypto unsupported screen.
     */
    vm: LegacyCryptoUnsupportedViewModel;
}

/**
 * A full-screen message shown when the session predates the current crypto stack and cannot be migrated.
 *
 * The only way forward is to sign out and back in, so the view offers a sign out button and nothing else.
 *
 * @example
 * ```tsx
 * <LegacyCryptoUnsupportedView vm={legacyCryptoUnsupportedViewModel} />
 * ```
 */
export function LegacyCryptoUnsupportedView({ vm }: Readonly<LegacyCryptoUnsupportedViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { brand, version } = useViewModel(vm);

    return (
        <Flex className={styles.view} align="center" justify="center" role="alert">
            <Flex className={styles.body} direction="column" align="center" gap="var(--cpd-space-4x)">
                <Heading as="h1" size="lg">
                    {_t("error|legacy_crypto_unsupported|title")}
                </Heading>
                <Text size="lg">{_t("error|legacy_crypto_unsupported|description", { brand })}</Text>
                <Text size="lg">
                    {_t("error|legacy_crypto_unsupported|actions", { version }, { b: (t) => <strong>{t}</strong> })}
                </Text>
                <Button kind="destructive" Icon={SignOutIcon} onClick={vm.onSignOutClick}>
                    {_t("action|remove_this_device")}
                </Button>
            </Flex>
        </Flex>
    );
}
