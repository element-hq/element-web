/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    type ComponentProps,
    type RefObject,
    type SyntheticEvent,
    type KeyboardEvent,
    useContext,
    useRef,
    useState,
    type ChangeEvent,
    type ReactNode,
    useEffect,
} from "react";
import classNames from "classnames";
import {
    RoomType,
    HistoryVisibility,
    Preset,
    Visibility,
    type MatrixClient,
    type ICreateRoomOpts,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import ContextMenu, { ChevronFace } from "../../structures/ContextMenu";
import createRoom, { type IOpts as ICreateOpts } from "../../../createRoom";
import MatrixClientContext, { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import type SpaceBasicSettings from "./SpaceBasicSettings";
import { SpaceAvatar } from "./SpaceBasicSettings";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import Field from "../elements/Field";
import withValidation from "../elements/Validation";
import RoomAliasField from "../elements/RoomAliasField";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { Filter } from "../dialogs/spotlight/Filter";
import { type OpenSpotlightPayload } from "../../../dispatcher/payloads/OpenSpotlightPayload.ts";

export const createSpace = async (
    client: MatrixClient,
    name: string,
    isPublic: boolean,
    alias?: string,
    topic?: string,
    avatar?: string | File,
    createOpts: Partial<ICreateRoomOpts> = {},
    otherOpts: Partial<Omit<ICreateOpts, "createOpts">> = {},
): Promise<string | null> => {
    return createRoom(client, {
        createOpts: {
            name,
            preset: isPublic ? Preset.PublicChat : Preset.PrivateChat,
            visibility:
                isPublic && (await client.doesServerSupportUnstableFeature("org.matrix.msc3827.stable"))
                    ? Visibility.Public
                    : Visibility.Private,
            power_level_content_override: {
                // Only allow Admins to write to the timeline to prevent hidden sync spam
                events_default: 100,
                invite: isPublic ? 0 : 50,
            },
            room_alias_name: isPublic && alias ? alias.substring(1, alias.indexOf(":")) : undefined,
            topic,
            ...createOpts,
        },
        avatar,
        roomType: RoomType.Space,
        historyVisibility: isPublic ? HistoryVisibility.WorldReadable : HistoryVisibility.Invited,
        spinner: false,
        encryption: false,
        andView: true,
        inlineErrors: true,
        ...otherOpts,
    });
};

const SpaceCreateMenuType: React.FC<{
    title: string;
    description: string;
    className: string;
    onClick(): void;
}> = ({ title, description, className, onClick }) => {
    return (
        <AccessibleButton className={classNames("mx_SpaceCreateMenuType", className)} onClick={onClick}>
            {title}
            <div>{description}</div>
        </AccessibleButton>
    );
};

const spaceNameValidator = withValidation({
    rules: [
        {
            key: "required",
            test: async ({ value }) => !!value,
            invalid: () => _t("create_space|name_required"),
        },
    ],
});

const nameToLocalpart = (name: string): string => {
    return name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9_-]+/gi, "");
};

type BProps = Omit<ComponentProps<typeof SpaceBasicSettings>, "nameDisabled" | "topicDisabled" | "avatarDisabled">;
interface ISpaceCreateFormProps extends BProps {
    busy: boolean;
    alias: string;
    nameFieldRef: RefObject<Field | null>;
    aliasFieldRef: RefObject<RoomAliasField | null>;
    showAliasField?: boolean;
    children?: ReactNode;
    onSubmit(e: SyntheticEvent): void;
    setAlias(alias: string): void;
}

export const SpaceCreateForm: React.FC<ISpaceCreateFormProps> = ({
    busy,
    onSubmit,
    avatarUrl,
    setAvatar,
    name,
    setName,
    nameFieldRef,
    alias,
    aliasFieldRef,
    setAlias,
    showAliasField,
    topic,
    setTopic,
    children,
}) => {
    const cli = useContext(MatrixClientContext);
    const domain = cli.getDomain() ?? undefined;

    const onKeyDown = (ev: KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (action) {
            case KeyBindingAction.Enter:
                onSubmit(ev);
                break;
        }
    };

    return (
        <form className="mx_SpaceBasicSettings" onSubmit={onSubmit}>
            <SpaceAvatar avatarUrl={avatarUrl} setAvatar={setAvatar} avatarDisabled={busy} />

            <Field
                name="spaceName"
                label={_t("common|name")}
                autoFocus={true}
                value={name}
                onChange={(ev: ChangeEvent<HTMLInputElement>) => {
                    const newName = ev.target.value;
                    if (!alias || alias === `#${nameToLocalpart(name)}:${domain}`) {
                        setAlias(`#${nameToLocalpart(newName)}:${domain}`);
                        aliasFieldRef.current?.validate({ allowEmpty: true });
                    }
                    setName(newName);
                }}
                onKeyDown={onKeyDown}
                ref={nameFieldRef}
                onValidate={spaceNameValidator}
                disabled={busy}
                autoComplete="off"
            />

            {showAliasField ? (
                <RoomAliasField
                    ref={aliasFieldRef}
                    onChange={setAlias}
                    domain={domain}
                    value={alias}
                    placeholder={name ? nameToLocalpart(name) : _t("create_space|address_placeholder")}
                    label={_t("create_space|address_label")}
                    disabled={busy}
                    onKeyDown={onKeyDown}
                />
            ) : null}

            <Field
                name="spaceTopic"
                element="textarea"
                label={_t("common|description")}
                value={topic ?? ""}
                onChange={(ev) => setTopic(ev.target.value)}
                rows={3}
                disabled={busy}
            />

            {children}
        </form>
    );
};

const SpaceCreateMenu: React.FC<{
    onFinished(): void;
}> = ({ onFinished }) => {
    const cli = useMatrixClientContext();
    const [visibility, setVisibility] = useState<Visibility | null>(null);
    const [busy, setBusy] = useState<boolean>(false);

    const [name, setName] = useState("");
    const spaceNameField = useRef<Field>(null);
    const [alias, setAlias] = useState("");
    const spaceAliasField = useRef<RoomAliasField>(null);
    const [avatar, setAvatar] = useState<File | undefined>(undefined);
    const [topic, setTopic] = useState<string>("");

    const [supportsSpaceFiltering, setSupportsSpaceFiltering] = useState(true); // assume it does until we find out it doesn't
    useEffect(() => {
        cli.isVersionSupported("v1.4")
            .then((supported) => {
                return supported || cli.doesServerSupportUnstableFeature("org.matrix.msc3827.stable");
            })
            .then((supported) => {
                setSupportsSpaceFiltering(supported);
            });
    }, [cli]);

    const onSpaceCreateClick = async (e: ButtonEvent): Promise<void> => {
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

        if (
            spaceAliasField.current &&
            visibility === Visibility.Public &&
            !(await spaceAliasField.current.validate({ allowEmpty: false }))
        ) {
            spaceAliasField.current.focus();
            spaceAliasField.current.validate({ allowEmpty: false, focused: true });
            setBusy(false);
            return;
        }

        try {
            await createSpace(cli, name, visibility === Visibility.Public, alias, topic, avatar);

            onFinished();
        } catch (e) {
            logger.error(e);
        }
    };

    const onSearchClick = (): void => {
        defaultDispatcher.dispatch<OpenSpotlightPayload>({
            action: Action.OpenSpotlight,
            initialFilter: Filter.PublicSpaces,
        });
    };

    let body;
    if (visibility === null) {
        body = (
            <React.Fragment>
                <h2>{_t("create_space|label")}</h2>
                <p>{_t("create_space|explainer")}</p>

                <SpaceCreateMenuType
                    title={_t("common|public")}
                    description={_t("create_space|public_description")}
                    className="mx_SpaceCreateMenuType_public"
                    onClick={() => setVisibility(Visibility.Public)}
                />
                <SpaceCreateMenuType
                    title={_t("common|private")}
                    description={_t("create_space|private_description")}
                    className="mx_SpaceCreateMenuType_private"
                    onClick={() => setVisibility(Visibility.Private)}
                />

                {supportsSpaceFiltering && (
                    <AccessibleButton kind="primary_outline" onClick={onSearchClick}>
                        {_t("create_space|search_public_button")}
                    </AccessibleButton>
                )}
            </React.Fragment>
        );
    } else {
        body = (
            <React.Fragment>
                <AccessibleButton
                    className="mx_SpaceCreateMenu_back"
                    onClick={() => setVisibility(null)}
                    title={_t("action|go_back")}
                />

                <h2>
                    {visibility === Visibility.Public
                        ? _t("create_space|public_heading")
                        : _t("create_space|private_heading")}
                </h2>
                <p>
                    {_t("create_space|add_details_prompt")} {_t("create_space|add_details_prompt_2")}
                </p>

                <SpaceCreateForm
                    busy={busy}
                    onSubmit={onSpaceCreateClick}
                    setAvatar={setAvatar}
                    name={name}
                    setName={setName}
                    nameFieldRef={spaceNameField}
                    topic={topic}
                    setTopic={setTopic}
                    alias={alias}
                    setAlias={setAlias}
                    showAliasField={visibility === Visibility.Public}
                    aliasFieldRef={spaceAliasField}
                />

                <AccessibleButton kind="primary" onClick={onSpaceCreateClick} disabled={busy}>
                    {busy ? _t("create_space|creating") : _t("action|create")}
                </AccessibleButton>
            </React.Fragment>
        );
    }

    return (
        <ContextMenu
            left={72}
            top={62}
            chevronOffset={0}
            chevronFace={ChevronFace.None}
            onFinished={onFinished}
            wrapperClassName="mx_SpaceCreateMenu_wrapper"
            managed={false}
            focusLock={true}
        >
            {body}
        </ContextMenu>
    );
};

export default SpaceCreateMenu;
