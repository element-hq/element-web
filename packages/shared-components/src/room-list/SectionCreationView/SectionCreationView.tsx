/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Flex } from "../../core/utils/Flex";
import { Form, Text } from "@vector-im/compound-web";
import { type ViewModel, useViewModel } from "../../core/viewmodel";
import { useI18n } from "../../core/i18n/i18nContext";

import styles from "./SectionCreationView.module.css";

export interface SectionCreationViewSnapshot {
    /**
     * The current value of the section name input.
     */
    value: string;
    /**
     * Whether the view is editing an existing section.
     * When true, the explanatory description is hidden.
     */
    isEdition: boolean;
    /**
     * Whether the current section name is valid and can be submitted.
     */
    isSectionValid: boolean;
}

export interface SectionCreationViewActions {
    /**
     * Creates a new section or saves the edited one, depending on the current mode.
     */
    createOrEditSection: () => void;
    /**
     * Updates the pending section name.
     */
    setSection: (sectionName: string) => void;
}

/**
 * The view model for the section creation component.
 */
export type SectionCreationViewModel = ViewModel<SectionCreationViewSnapshot, SectionCreationViewActions>;

interface SectionCreationViewProps {
    /**
     * The view model for the section creation component.
     */
    vm: SectionCreationViewModel;
}

/**
 * A form component to create a new room list section or edit an existing one.
 * In creation mode it shows an explanatory descrption; in edition mode it is pre-filled
 * with the current section name.
 *
 * @example
 * ```tsx
 * <SectionCreationView vm={sectionCreationViewModel} />
 * ```
 */
export function SectionCreationView({ vm }: Readonly<SectionCreationViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { value, isEdition } = useViewModel(vm);

    return (
        <Flex gap="var(--cpd-space-6x)" direction="column" className={styles.container}>
            {!isEdition && (
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
