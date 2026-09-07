/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type SectionCreationViewModel } from "./types";
import { useViewModel } from "../../core/viewmodel";
import { Form, Text } from "@vector-im/compound-web";
import { useI18n } from "../../core/i18n/i18nContext";

import styles from "./SectionCreationView.module.css";
import { Flex } from "../../core/utils/Flex";

interface SectionFormViewProps {
    /**
     * The view model for the section creation component.
     */
    vm: SectionCreationViewModel;
    /**
     * Optional class name for the root element.
     */
    className?: string;
}

export function SectionFormView({ vm, className }: Readonly<SectionFormViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { value, step } = useViewModel(vm);

    return (
        <Flex gap="var(--cpd-space-6x)" direction="column" align="stretch" className={className}>
            {step === "creation" && (
                <Text as="span" weight="medium">
                    {_t("room_list|section_creation|description")}
                </Text>
            )}
            <Form.Root
                className={styles.form}
                onSubmit={(e) => {
                    e.preventDefault();
                    vm.createOrEditSection();
                }}
            >
                <Form.Field name="sectionName">
                    <Form.Label> {_t("room_list|section_creation|label")}</Form.Label>
                    <Form.TextControl
                        value={value}
                        onChange={(evt) => vm.setSection(evt.target.value)}
                        required={true}
                    />
                </Form.Field>
            </Form.Root>
        </Flex>
    );
}
