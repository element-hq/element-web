/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { FormattingFunctions } from "@matrix-org/matrix-wysiwyg";
import React, { ChangeEvent, useState } from "react";

import { _t } from "../../../../../languageHandler";
import Modal from "../../../../../Modal";
import Field from "../../../elements/Field";
import { ComposerContextState } from "../ComposerContext";
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
            title={isEditing ? _t("Edit link") : _t("Create a link")}
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
                        label={_t("Text")}
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
                    label={_t("Link")}
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
                            {_t("Remove")}
                        </button>
                    )}
                    <DialogButtons
                        primaryButton={_t("Save")}
                        primaryDisabled={isSaveDisabled}
                        primaryIsSubmit={true}
                        onCancel={onFinished}
                    />
                </div>
            </form>
        </BaseDialog>
    );
};
