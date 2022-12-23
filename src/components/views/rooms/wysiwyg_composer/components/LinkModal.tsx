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

import { _td } from "../../../../../languageHandler";
import Modal from "../../../../../Modal";
import QuestionDialog from "../../../dialogs/QuestionDialog";
import Field from "../../../elements/Field";
import { ComposerContextState } from "../ComposerContext";
import { isSelectionEmpty, setSelection } from "../utils/selection";

export function openLinkModal(composer: FormattingFunctions, composerContext: ComposerContextState) {
    const modal = Modal.createDialog(
        LinkModal,
        { composerContext, composer, onClose: () => modal.close(), isTextEnabled: isSelectionEmpty() },
        "mx_CompoundDialog",
        false,
        true,
    );
}

function isEmpty(text: string) {
    return text.length < 1;
}

interface LinkModalProps {
    composer: FormattingFunctions;
    isTextEnabled: boolean;
    onClose: () => void;
    composerContext: ComposerContextState;
}

export function LinkModal({ composer, isTextEnabled, onClose, composerContext }: LinkModalProps) {
    const [fields, setFields] = useState({ text: "", link: "" });
    const isSaveDisabled = (isTextEnabled && isEmpty(fields.text)) || isEmpty(fields.link);

    return (
        <QuestionDialog
            className="mx_LinkModal"
            title={_td("Create a link")}
            button={_td("Save")}
            buttonDisabled={isSaveDisabled}
            hasCancelButton={true}
            onFinished={async (isClickOnSave: boolean) => {
                if (isClickOnSave) {
                    await setSelection(composerContext.selection);
                    composer.link(fields.link, isTextEnabled ? fields.text : undefined);
                }
                onClose();
            }}
            description={
                <div className="mx_LinkModal_content">
                    {isTextEnabled && (
                        <Field
                            autoFocus={true}
                            label={_td("Text")}
                            value={fields.text}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setFields((fields) => ({ ...fields, text: e.target.value }))
                            }
                        />
                    )}
                    <Field
                        autoFocus={!isTextEnabled}
                        label={_td("Link")}
                        value={fields.link}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setFields((fields) => ({ ...fields, link: e.target.value }))
                        }
                    />
                </div>
            }
        />
    );
}
