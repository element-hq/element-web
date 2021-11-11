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

import React, { ComponentProps, RefObject, SyntheticEvent, KeyboardEvent, useContext, useRef, useState } from "react";
import classNames from "classnames";
import { RoomType } from "matrix-js-sdk/src/@types/event";
import { ICreateRoomOpts } from "matrix-js-sdk/src/@types/requests";
import { HistoryVisibility, Preset } from "matrix-js-sdk/src/@types/partials";

import { _t } from "../../../languageHandler";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { ChevronFace, ContextMenu } from "../../structures/ContextMenu";
import createRoom, { IOpts as ICreateOpts } from "../../../createRoom";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import SpaceBasicSettings, { SpaceAvatar } from "./SpaceBasicSettings";
import AccessibleButton from "../elements/AccessibleButton";
import Field from "../elements/Field";
import withValidation from "../elements/Validation";
import RoomAliasField from "../elements/RoomAliasField";
import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import GenericFeatureFeedbackDialog from "../dialogs/GenericFeatureFeedbackDialog";
import SettingsStore from "../../../settings/SettingsStore";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserSettingsDialog";
import { Key } from "../../../Keyboard";

import { logger } from "matrix-js-sdk/src/logger";

export const createSpace = async (
    name: string,
    isPublic: boolean,
    alias?: string,
    topic?: string,
    avatar?: string | File,
    createOpts: Partial<ICreateRoomOpts> = {},
    otherOpts: Partial<Omit<ICreateOpts, "createOpts">> = {},
) => {
    return createRoom({
        createOpts: {
            name,
            preset: isPublic ? Preset.PublicChat : Preset.PrivateChat,
            power_level_content_override: {
                // Only allow Admins to write to the timeline to prevent hidden sync spam
                events_default: 100,
                invite: isPublic ? 0 : 50,
            },
            room_alias_name: isPublic && alias ? alias.substr(1, alias.indexOf(":") - 1) : undefined,
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

const SpaceCreateMenuType = ({ title, description, className, onClick }) => {
    return (
        <AccessibleButton className={classNames("mx_SpaceCreateMenuType", className)} onClick={onClick}>
            <h3>{ title }</h3>
            <span>{ description }</span>
        </AccessibleButton>
    );
};

enum Visibility {
    Public,
    Private,
}

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
    return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]+/gi, "");
};

// XXX: Temporary for the Spaces release only
export const SpaceFeedbackPrompt = ({ onClick }: { onClick?: () => void }) => {
    if (!SdkConfig.get().bug_report_endpoint_url) return null;

    return <div className="mx_SpaceFeedbackPrompt">
        <span className="mx_SpaceFeedbackPrompt_text">{ _t("Spaces are a new feature.") }</span>
        <AccessibleButton
            kind="link"
            onClick={() => {
                if (onClick) onClick();
                Modal.createTrackedDialog("Spaces Feedback", "", GenericFeatureFeedbackDialog, {
                    title: _t("Spaces feedback"),
                    subheading: _t("Thank you for trying Spaces. " +
                        "Your feedback will help inform the next versions."),
                    rageshakeLabel: "spaces-feedback",
                    rageshakeData: Object.fromEntries([
                        "Spaces.allRoomsInHome",
                        "Spaces.enabledMetaSpaces",
                    ].map(k => [k, SettingsStore.getValue(k)])),
                });
            }}
        >
            { _t("Give feedback.") }
        </AccessibleButton>
    </div>;
};

type BProps = Omit<ComponentProps<typeof SpaceBasicSettings>, "nameDisabled" | "topicDisabled" | "avatarDisabled">;
interface ISpaceCreateFormProps extends BProps {
    busy: boolean;
    alias: string;
    nameFieldRef: RefObject<Field>;
    aliasFieldRef: RefObject<RoomAliasField>;
    showAliasField?: boolean;
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
    const domain = cli.getDomain();

    const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === Key.ENTER) {
            onSubmit(ev);
        }
    };

    return <form className="mx_SpaceBasicSettings" onSubmit={onSubmit}>
        <SpaceAvatar avatarUrl={avatarUrl} setAvatar={setAvatar} avatarDisabled={busy} />

        <Field
            name="spaceName"
            label={_t("Name")}
            autoFocus={true}
            value={name}
            onChange={ev => {
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

        { showAliasField
            ? <RoomAliasField
                ref={aliasFieldRef}
                onChange={setAlias}
                domain={domain}
                value={alias}
                placeholder={name ? nameToLocalpart(name) : _t("e.g. my-space")}
                label={_t("Address")}
                disabled={busy}
                onKeyDown={onKeyDown}
            />
            : null
        }

        <Field
            name="spaceTopic"
            element="textarea"
            label={_t("Description")}
            value={topic}
            onChange={ev => setTopic(ev.target.value)}
            rows={3}
            disabled={busy}
        />

        { children }
    </form>;
};

const SpaceCreateMenu = ({ onFinished }) => {
    const [visibility, setVisibility] = useState<Visibility>(null);
    const [busy, setBusy] = useState<boolean>(false);

    const [name, setName] = useState("");
    const spaceNameField = useRef<Field>();
    const [alias, setAlias] = useState("");
    const spaceAliasField = useRef<RoomAliasField>();
    const [avatar, setAvatar] = useState<File>(null);
    const [topic, setTopic] = useState<string>("");

    const onSpaceCreateClick = async (e) => {
        e.preventDefault();
        if (busy) return;

        setBusy(true);
        // require & validate the space name field
        if (!(await spaceNameField.current.validate({ allowEmpty: false }))) {
            spaceNameField.current.focus();
            spaceNameField.current.validate({ allowEmpty: false, focused: true });
            setBusy(false);
            return;
        }

        if (visibility === Visibility.Public && !(await spaceAliasField.current.validate({ allowEmpty: false }))) {
            spaceAliasField.current.focus();
            spaceAliasField.current.validate({ allowEmpty: false, focused: true });
            setBusy(false);
            return;
        }

        try {
            await createSpace(
                name,
                visibility === Visibility.Public,
                alias,
                topic,
                avatar,
            );

            onFinished();
        } catch (e) {
            logger.error(e);
        }
    };

    let body;
    if (visibility === null) {
        const onCreateSpaceFromCommunityClick = () => {
            defaultDispatcher.dispatch({
                action: Action.ViewUserSettings,
                initialTabId: UserTab.Preferences,
            });
            onFinished();
        };

        body = <React.Fragment>
            <h2>{ _t("Create a space") }</h2>
            <p>
                { _t("Spaces are a new way to group rooms and people.") }
                &nbsp;
                { _t("What kind of Space do you want to create?") }
                &nbsp;
                { _t("You can change this later.") }
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

            <p>
                { _t("You can also make Spaces from <a>communities</a>.", {}, {
                    a: sub => <AccessibleButton kind="link" onClick={onCreateSpaceFromCommunityClick}>
                        { sub }
                    </AccessibleButton>,
                }) }
                <br />
                { _t("To join a space you'll need an invite.") }
            </p>

            <SpaceFeedbackPrompt onClick={onFinished} />
        </React.Fragment>;
    } else {
        body = <React.Fragment>
            <AccessibleTooltipButton
                className="mx_SpaceCreateMenu_back"
                onClick={() => setVisibility(null)}
                title={_t("Go back")}
            />

            <h2>
                {
                    visibility === Visibility.Public ? _t("Your public space") : _t("Your private space")
                }
            </h2>
            <p>
                {
                    _t("Add some details to help people recognise it.")
                } {
                    _t("You can change these anytime.")
                }
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
                { busy ? _t("Creating...") : _t("Create") }
            </AccessibleButton>
        </React.Fragment>;
    }

    return <ContextMenu
        left={72}
        top={62}
        chevronOffset={0}
        chevronFace={ChevronFace.None}
        onFinished={onFinished}
        wrapperClassName="mx_SpaceCreateMenu_wrapper"
        managed={false}
    >
        { body }
    </ContextMenu>;
};

export default SpaceCreateMenu;
