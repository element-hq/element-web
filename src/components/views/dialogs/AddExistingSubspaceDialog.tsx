/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import AccessibleButton from "../elements/AccessibleButton";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { AddExistingToSpace, defaultSpacesRenderer, SubspaceSelector } from "./AddExistingToSpaceDialog";

interface IProps {
    space: Room;
    onCreateSubspaceClick(): void;
    onFinished(added?: boolean): void;
}

const AddExistingSubspaceDialog: React.FC<IProps> = ({ space, onCreateSubspaceClick, onFinished }) => {
    const [selectedSpace, setSelectedSpace] = useState(space);

    return (
        <BaseDialog
            title={
                <SubspaceSelector
                    title={_t("space|add_existing_subspace|space_dropdown_title")}
                    space={space}
                    value={selectedSpace}
                    onChange={setSelectedSpace}
                />
            }
            className="mx_AddExistingToSpaceDialog"
            contentId="mx_AddExistingToSpace"
            onFinished={onFinished}
            fixedWidth={false}
        >
            <MatrixClientContext.Provider value={space.client}>
                <AddExistingToSpace
                    space={space}
                    onFinished={onFinished}
                    footerPrompt={
                        <>
                            <div>{_t("space|add_existing_subspace|create_prompt")}</div>
                            <AccessibleButton onClick={onCreateSubspaceClick} kind="link">
                                {_t("space|add_existing_subspace|create_button")}
                            </AccessibleButton>
                        </>
                    }
                    filterPlaceholder={_t("space|add_existing_subspace|filter_placeholder")}
                    spacesRenderer={defaultSpacesRenderer}
                />
            </MatrixClientContext.Provider>
        </BaseDialog>
    );
};

export default AddExistingSubspaceDialog;
