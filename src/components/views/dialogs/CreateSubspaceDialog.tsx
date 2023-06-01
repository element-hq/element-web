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

import React, { useRef, useState } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { JoinRule } from "matrix-js-sdk/src/@types/partials";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { BetaPill } from "../beta/BetaCard";
import Field from "../elements/Field";
import RoomAliasField from "../elements/RoomAliasField";
import { createSpace, SpaceCreateForm } from "../spaces/SpaceCreateMenu";
import { SubspaceSelector } from "./AddExistingToSpaceDialog";
import JoinRuleDropdown from "../elements/JoinRuleDropdown";

interface IProps {
    space: Room;
    onAddExistingSpaceClick(): void;
    onFinished(added?: boolean): void;
}

const CreateSubspaceDialog: React.FC<IProps> = ({ space, onAddExistingSpaceClick, onFinished }) => {
    const [parentSpace, setParentSpace] = useState(space);

    const [busy, setBusy] = useState<boolean>(false);
    const [name, setName] = useState("");
    const spaceNameField = useRef<Field>(null);
    const [alias, setAlias] = useState("");
    const spaceAliasField = useRef<RoomAliasField>(null);
    const [avatar, setAvatar] = useState<File | undefined>();
    const [topic, setTopic] = useState<string>("");

    const spaceJoinRule = space.getJoinRule();
    let defaultJoinRule = JoinRule.Restricted;
    if (spaceJoinRule === JoinRule.Public) {
        defaultJoinRule = JoinRule.Public;
    }
    const [joinRule, setJoinRule] = useState<JoinRule>(defaultJoinRule);

    const onCreateSubspaceClick = async (e: ButtonEvent): Promise<void> => {
        e.preventDefault();
        if (busy) return;

        setBusy(true);
        // require & validate the space name field
        if (spaceNameField.current && !(await spaceNameField.current.validate({ allowEmpty: false }))) {
            spaceNameField.current.focus();
            spaceNameField.current.validate({ allowEmpty: false, focused: true });
            setBusy(false);
            return;
        }
        // validate the space name alias field but do not require it
        if (
            spaceAliasField.current &&
            joinRule === JoinRule.Public &&
            (await spaceAliasField.current.validate({ allowEmpty: true }))
        ) {
            spaceAliasField.current.focus();
            spaceAliasField.current.validate({ allowEmpty: true, focused: true });
            setBusy(false);
            return;
        }

        try {
            await createSpace(
                space.client,
                name,
                joinRule === JoinRule.Public,
                alias,
                topic,
                avatar,
                {},
                { parentSpace, joinRule },
            );

            onFinished(true);
        } catch (e) {
            logger.error(e);
        }
    };

    let joinRuleMicrocopy: JSX.Element | undefined;
    if (joinRule === JoinRule.Restricted) {
        joinRuleMicrocopy = (
            <p>
                {_t(
                    "Anyone in <SpaceName/> will be able to find and join.",
                    {},
                    {
                        SpaceName: () => <b>{parentSpace.name}</b>,
                    },
                )}
            </p>
        );
    } else if (joinRule === JoinRule.Public) {
        joinRuleMicrocopy = (
            <p>
                {_t(
                    "Anyone will be able to find and join this space, not just members of <SpaceName/>.",
                    {},
                    {
                        SpaceName: () => <b>{parentSpace.name}</b>,
                    },
                )}
            </p>
        );
    } else if (joinRule === JoinRule.Invite) {
        joinRuleMicrocopy = <p>{_t("Only people invited will be able to find and join this space.")}</p>;
    }

    return (
        <BaseDialog
            title={
                <SubspaceSelector
                    title={_t("Create a space")}
                    space={space}
                    value={parentSpace}
                    onChange={setParentSpace}
                />
            }
            className="mx_CreateSubspaceDialog"
            contentId="mx_CreateSubspaceDialog"
            onFinished={onFinished}
            fixedWidth={false}
        >
            <MatrixClientContext.Provider value={space.client}>
                <div className="mx_CreateSubspaceDialog_content">
                    <div className="mx_CreateSubspaceDialog_betaNotice">
                        <BetaPill />
                        {_t("Add a space to a space you manage.")}
                    </div>

                    <SpaceCreateForm
                        busy={busy}
                        onSubmit={onCreateSubspaceClick}
                        setAvatar={setAvatar}
                        name={name}
                        setName={setName}
                        nameFieldRef={spaceNameField}
                        topic={topic}
                        setTopic={setTopic}
                        alias={alias}
                        setAlias={setAlias}
                        showAliasField={joinRule === JoinRule.Public}
                        aliasFieldRef={spaceAliasField}
                    >
                        <JoinRuleDropdown
                            label={_t("Space visibility")}
                            labelInvite={_t("Private space (invite only)")}
                            labelPublic={_t("Public space")}
                            labelRestricted={_t("Visible to space members")}
                            width={478}
                            value={joinRule}
                            onChange={setJoinRule}
                        />
                        {joinRuleMicrocopy}
                    </SpaceCreateForm>
                </div>

                <div className="mx_CreateSubspaceDialog_footer">
                    <div className="mx_CreateSubspaceDialog_footer_prompt">
                        <div>{_t("Want to add an existing space instead?")}</div>
                        <AccessibleButton
                            kind="link"
                            onClick={() => {
                                onAddExistingSpaceClick();
                                onFinished();
                            }}
                        >
                            {_t("Add existing space")}
                        </AccessibleButton>
                    </div>

                    <AccessibleButton kind="primary_outline" disabled={busy} onClick={() => onFinished(false)}>
                        {_t("Cancel")}
                    </AccessibleButton>
                    <AccessibleButton kind="primary" disabled={busy} onClick={onCreateSubspaceClick}>
                        {busy ? _t("Adding…") : _t("Add")}
                    </AccessibleButton>
                </div>
            </MatrixClientContext.Provider>
        </BaseDialog>
    );
};

export default CreateSubspaceDialog;
