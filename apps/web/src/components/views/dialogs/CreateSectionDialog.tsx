/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useState, type JSX } from "react";
import { Flex } from "@element-hq/web-shared-components";
import { Form, Text } from "@vector-im/compound-web";

import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { _t } from "../../../languageHandler";

interface CreateSectionDialogProps {
    /**
     * Callback called when the dialog is closed.
     * @param shouldCreateSection Whether a section should be created or not. This will be false if the user cancels the dialog.
     * @param sectionName The name of the section to create.
     */
    onFinished: (shouldCreateSection: boolean, sectionName: string) => void;
}

/**
 * Dialog shown to the user to create a new section in the room list.
 */
export function CreateSectionDialog({ onFinished }: CreateSectionDialogProps): JSX.Element {
    const [value, setValue] = useState("");
    const isInvalid = Boolean(value.trim().length === 0);

    return (
        <BaseDialog
            className="mx_CreateSectionDialog"
            onFinished={() => onFinished(false, value)}
            title={_t("create_section_dialog|title")}
            hasCancel={true}
        >
            <Flex gap="var(--cpd-space-6x)" direction="column" className="mx_CreateSectionDialog_content">
                <Text as="span" weight="semibold">
                    {_t("create_section_dialog|description")}
                </Text>
                <Form.Root
                    className="mx_CreateSectionDialog_form"
                    onSubmit={(e) => {
                        onFinished(true, value);
                        e.preventDefault();
                    }}
                >
                    <Form.Field name="sectionName">
                        <Form.Label> {_t("create_section_dialog|label")}</Form.Label>
                        <Form.TextControl onChange={(evt) => setValue(evt.target.value)} required={true} />
                    </Form.Field>
                </Form.Root>
            </Flex>
            <DialogButtons
                primaryButton={_t("create_section_dialog|create_section")}
                primaryDisabled={isInvalid}
                hasCancel={true}
                onCancel={() => onFinished(false, "")}
                onPrimaryButtonClick={() => onFinished(true, value)}
            />
        </BaseDialog>
    );
}
