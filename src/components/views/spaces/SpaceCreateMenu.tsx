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

import React, {
    ComponentProps,
    RefObject,
    SyntheticEvent,
    KeyboardEvent,
    useContext,
    useRef,
    useState,
    ChangeEvent,
    ReactNode,
} from "react";
import classNames from "classnames";
import { RoomType } from "matrix-js-sdk/src/@types/event";
import { ICreateRoomOpts } from "matrix-js-sdk/src/@types/requests";
import { HistoryVisibility, Preset, Visibility } from "matrix-js-sdk/src/@types/partials";
import { logger } from "matrix-js-sdk/src/logger";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import ContextMenu, { ChevronFace } from "../../structures/ContextMenu";
import createRoom, { IOpts as ICreateOpts } from "../../../createRoom";
import MatrixClientContext, { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import SpaceBasicSettings, { SpaceAvatar } from "./SpaceBasicSettings";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import Field from "../elements/Field";
import withValidation from "../elements/Validation";
import RoomAliasField from "../elements/RoomAliasField";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";

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
            invalid: () => _t("Please enter a name for the space"),
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
    nameFieldRef: RefObject<Field>;
    aliasFieldRef: RefObject<RoomAliasField>;
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
                label={_t("Name")}
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
                    placeholder={name ? nameToLocalpart(name) : _t("e.g. my-space")}
                    label={_t("Address")}
                    disabled={busy}
                    onKeyDown={onKeyDown}
                />
            ) : null}

            <Field
                name="spaceTopic"
                element="textarea"
                label={_t("Description")}
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

    let body;
    if (visibility === null) {
        body = (
            <React.Fragment>
                <h2>{_t("Create a space")}</h2>
                <p>
                    {_t(
                        "Spaces are a new way to group rooms and people. What kind of Space do you want to create? " +
                            "You can change this later.",
                    )}
                </p>

                <SpaceCreateMenuType
                    title={_t("Public")}
                    description={_t("Open space for anyone, best for communities")}
                    className="mx_SpaceCreateMenuType_public"
                    onClick={() => setVisibility(Visibility.Public)}
                />
                <SpaceCreateMenuType
                    title={_t("Private")}
                    description={_t("Invite only, best for yourself or teams")}
                    className="mx_SpaceCreateMenuType_private"
                    onClick={() => setVisibility(Visibility.Private)}
                />

                <p>{_t("To join a space you'll need an invite.")}</p>
            </React.Fragment>
        );
    } else {
        body = (
            <React.Fragment>
                <AccessibleTooltipButton
                    className="mx_SpaceCreateMenu_back"
                    onClick={() => setVisibility(null)}
                    title={_t("Go back")}
                />

                <h2>{visibility === Visibility.Public ? _t("Your public space") : _t("Your private space")}</h2>
                <p>
                    {_t("Add some details to help people recognise it.")} {_t("You can change these anytime.")}
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
                    {busy ? _t("Creating…") : _t("Create")}
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
