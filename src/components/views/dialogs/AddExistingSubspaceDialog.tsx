/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { useState } from "react";
import { Room } from "matrix-js-sdk/src/models/room";

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
                    title={_t("Add existing space")}
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
                            <div>{_t("Want to add a new space instead?")}</div>
                            <AccessibleButton onClick={onCreateSubspaceClick} kind="link">
                                {_t("Create a new space")}
                            </AccessibleButton>
                        </>
                    }
                    filterPlaceholder={_t("Search for spaces")}
                    spacesRenderer={defaultSpacesRenderer}
                />
            </MatrixClientContext.Provider>
        </BaseDialog>
    );
};

export default AddExistingSubspaceDialog;
