/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useRef, useState } from "react";
import { type Room, JoinRule } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { BetaPill } from "../beta/BetaCard";
import type Field from "../elements/Field";
import type RoomAliasField from "../elements/RoomAliasField";
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
            !(await spaceAliasField.current.validate({ allowEmpty: true }))
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
                    "create_space|subspace_join_rule_restricted_description",
                    {},
                    {
                        SpaceName: () => <strong>{parentSpace.name}</strong>,
                    },
                )}
            </p>
        );
    } else if (joinRule === JoinRule.Public) {
        joinRuleMicrocopy = (
            <p>
                {_t(
                    "create_space|subspace_join_rule_public_description",
                    {},
                    {
                        SpaceName: () => <strong>{parentSpace.name}</strong>,
                    },
                )}
            </p>
        );
    } else if (joinRule === JoinRule.Invite) {
        joinRuleMicrocopy = <p>{_t("create_space|subspace_join_rule_invite_description")}</p>;
    }

    return (
        <BaseDialog
            title={
                <SubspaceSelector
                    title={_t("create_space|subspace_dropdown_title")}
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
                        {_t("create_space|subspace_beta_notice")}
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
                            label={_t("create_space|subspace_join_rule_label")}
                            labelInvite={_t("create_space|subspace_join_rule_invite_only")}
                            labelPublic={_t("common|public_space")}
                            labelRestricted={_t("create_room|join_rule_restricted")}
                            width={478}
                            value={joinRule}
                            onChange={setJoinRule}
                        />
                        {joinRuleMicrocopy}
                    </SpaceCreateForm>
                </div>

                <div className="mx_CreateSubspaceDialog_footer">
                    <div className="mx_CreateSubspaceDialog_footer_prompt">
                        <div>{_t("create_space|subspace_existing_space_prompt")}</div>
                        <AccessibleButton
                            kind="link"
                            onClick={() => {
                                onAddExistingSpaceClick();
                                onFinished();
                            }}
                        >
                            {_t("space|add_existing_subspace|space_dropdown_title")}
                        </AccessibleButton>
                    </div>

                    <AccessibleButton kind="primary_outline" disabled={busy} onClick={() => onFinished(false)}>
                        {_t("action|cancel")}
                    </AccessibleButton>
                    <AccessibleButton kind="primary" disabled={busy} onClick={onCreateSubspaceClick}>
                        {busy ? _t("create_space|subspace_adding") : _t("action|add")}
                    </AccessibleButton>
                </div>
            </MatrixClientContext.Provider>
        </BaseDialog>
    );
};

export default CreateSubspaceDialog;
