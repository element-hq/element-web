/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FormattingFunctions } from "@vector-im/matrix-wysiwyg";
import React, { type ChangeEvent, useState } from "react";

import { _t } from "../../../../../languageHandler";
import Modal from "../../../../../Modal";
import Field from "../../../elements/Field";
import { type ComposerContextState } from "../ComposerContext";
import { isSelectionEmpty, setSelection } from "../utils/selection";
import BaseDialog from "../../../dialogs/BaseDialog";
import DialogButtons from "../../../elements/DialogButtons";

export function openLinkModal(
    composer: FormattingFunctions,
    composerContext: ComposerContextState,
    isEditing: boolean,
): void {
    Modal.createDialog(
        LinkModal,
        {
            composerContext,
            composer,
            isTextEnabled: isSelectionEmpty(),
            isEditing,
        },
        "mx_CompoundDialog",
        false,
        true,
    );
}

function isEmpty(text: string): boolean {
    return text.length < 1;
}

interface LinkModalProps {
    composer: FormattingFunctions;
    isTextEnabled: boolean;
    onFinished: () => void;
    composerContext: ComposerContextState;
    isEditing: boolean;
}

export const LinkModal: React.FC<LinkModalProps> = ({
    composer,
    isTextEnabled,
    onFinished,
    composerContext,
    isEditing,
}) => {
    const [hasLinkChanged, setHasLinkChanged] = useState(false);
    const [fields, setFields] = useState({ text: "", link: isEditing ? composer.getLink() : "" });
    const hasText = !isEditing && isTextEnabled;
    const isSaveDisabled = !hasLinkChanged || (hasText && isEmpty(fields.text)) || isEmpty(fields.link);

    return (
        <BaseDialog
            className="mx_LinkModal"
            title={isEditing ? _t("composer|link_modal|title_edit") : _t("composer|link_modal|title_create")}
            hasCancel={true}
            onFinished={onFinished}
        >
            <form
                className="mx_LinkModal_content"
                onSubmit={async (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();

                    onFinished();

                    // When submitting is done when pressing enter when the link field has the focus,
                    // The link field is getting back the focus (due to react-focus-lock)
                    // So we are waiting that the focus stuff is done to play with the composer selection
                    await new Promise((resolve) => setTimeout(resolve, 0));

                    await setSelection(composerContext.selection);
                    composer.link(fields.link, isTextEnabled ? fields.text : undefined);
                }}
            >
                {hasText && (
                    <Field
                        required={true}
                        autoFocus={true}
                        label={_t("composer|link_modal|text_field_label")}
                        value={fields.text}
                        className="mx_LinkModal_Field"
                        placeholder=""
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setFields((fields) => ({ ...fields, text: e.target.value }))
                        }
                    />
                )}
                <Field
                    required={true}
                    autoFocus={!hasText}
                    label={_t("composer|link_modal|link_field_label")}
                    value={fields.link}
                    className="mx_LinkModal_Field"
                    placeholder=""
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        setFields((fields) => ({ ...fields, link: e.target.value }));
                        setHasLinkChanged(true);
                    }}
                />

                <div className="mx_LinkModal_buttons">
                    {isEditing && (
                        <button
                            type="button"
                            className="danger"
                            onClick={() => {
                                composer.removeLinks();
                                onFinished();
                            }}
                        >
                            {_t("action|remove")}
                        </button>
                    )}
                    <DialogButtons
                        primaryButton={_t("action|save")}
                        primaryDisabled={isSaveDisabled}
                        primaryIsSubmit={true}
                        onCancel={onFinished}
                    />
                </div>
            </form>
        </BaseDialog>
    );
};
