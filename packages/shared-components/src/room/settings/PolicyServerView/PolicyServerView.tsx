/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";
import { Button, Form, InlineSpinner, Link, Text } from "@vector-im/compound-web";

import { type PolicyServerViewModel } from "./types";
import { useViewModel } from "../../../core/viewmodel";
import { useI18n } from "../../../core/i18n/i18nContext";
import { Flex } from "../../../core/utils/Flex";
import styles from "./PolicyServerView.module.css";

interface PolicyServerViewProps {
    /**
     * The view model driving the form.
     */
    vm: PolicyServerViewModel;
}

/**
 * Form to view and change the policy server (`m.room.policy`, MSC4284) used by a room.
 *
 * Only the form is rendered: the caller provides the surrounding heading and description so the
 * section matches its neighbours in room settings.
 */
export function PolicyServerView({ vm }: Readonly<PolicyServerViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { serverName, currentServerName, isLegacyConfig, canChange, canApply, busy, error, supportUrl } =
        useViewModel(vm);

    let message: JSX.Element | undefined;
    if (error === "lookup_failed") {
        message = <Form.ErrorMessage>{_t("room_settings|policy_server|error_lookup_failed")}</Form.ErrorMessage>;
    } else if (error === "update_failed") {
        message = <Form.ErrorMessage>{_t("room_settings|policy_server|error_update_failed")}</Form.ErrorMessage>;
    } else if (isLegacyConfig) {
        message = <Form.HelpMessage>{_t("room_settings|policy_server|legacy_config")}</Form.HelpMessage>;
    }

    let supportHint: ReactNode | undefined;
    if (currentServerName) {
        supportHint = supportUrl
            ? _t(
                  "room_settings|policy_server|support_page",
                  {},
                  {
                      a: (sub) => (
                          <Link href={supportUrl} target="_blank">
                              {sub}
                          </Link>
                      ),
                  },
              )
            : _t("room_settings|policy_server|generic_support");
    }

    return (
        <Form.Root
            className={styles.form}
            onSubmit={(e) => {
                e.preventDefault();
                void vm.apply();
            }}
        >
            <Form.Field name="policyServerName" serverInvalid={error !== null}>
                <Form.Label>{_t("room_settings|policy_server|server_name_label")}</Form.Label>
                <Form.TextControl
                    value={serverName}
                    onChange={(e) => vm.setServerName(e.target.value)}
                    disabled={busy || !canChange}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="policy.example.org"
                />
                {message}
            </Form.Field>
            <Flex align="center" gap="var(--cpd-space-3x)">
                <Button type="submit" kind="primary" size="md" disabled={!canApply}>
                    {_t("action|apply")}
                </Button>
                {busy && <InlineSpinner aria-label={_t("common|loading")} />}
            </Flex>
            {supportHint && (
                <Text as="p" size="sm" className={styles.support}>
                    {supportHint}
                </Text>
            )}
        </Form.Root>
    );
}
