/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type JSX } from "react";
import { Text } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";

interface RemoveSectionDialogProps {
    onFinished: (shouldRemoveSection: boolean) => void;
}

/**
 * Dialog shown to the user to remove section in the room list.
 */
export function RemoveSectionDialog({ onFinished }: RemoveSectionDialogProps): JSX.Element {
    return (
        <BaseDialog
            className="mx_RemoveSectionDialog"
            onFinished={() => onFinished(false)}
            title={_t("remove_section_dialog|title_edition")}
            hasCancel={true}
        >
            <Text as="span">{_t("remove_section_dialog|confirmation")}</Text>
            <Text as="span">{_t("remove_section_dialog|description")}</Text>
            <DialogButtons
                primaryButton={_t("remove_section_dialog|remove_section")}
                hasCancel={true}
                onCancel={() => onFinished(false)}
                onPrimaryButtonClick={() => onFinished(true)}
            />
        </BaseDialog>
    );
}
