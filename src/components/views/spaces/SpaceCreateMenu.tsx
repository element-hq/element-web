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

import React, { useContext, useRef, useState } from "react";
import classNames from "classnames";
import { EventType, RoomType, RoomCreateTypeField } from "matrix-js-sdk/src/@types/event";
import FocusLock from "react-focus-lock";

import { _t } from "../../../languageHandler";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { ChevronFace, ContextMenu } from "../../structures/ContextMenu";
import createRoom from "../../../createRoom";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { SpaceAvatar } from "./SpaceBasicSettings";
import AccessibleButton from "../elements/AccessibleButton";
import { BetaPill } from "../beta/BetaCard";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserSettingsDialog";
import Field from "../elements/Field";
import withValidation from "../elements/Validation";
import { SpaceFeedbackPrompt } from "../../structures/SpaceRoomView";
import { Preset } from "matrix-js-sdk/src/@types/partials";
import { ICreateRoomStateEvent } from "matrix-js-sdk/src/@types/requests";
import RoomAliasField from "../elements/RoomAliasField";

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

const nameToAlias = (name: string, domain: string): string => {
    const localpart = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]+/gi, "");
    return `#${localpart}:${domain}`;
};

const SpaceCreateMenu = ({ onFinished }) => {
    const cli = useContext(MatrixClientContext);
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
        if (!await spaceNameField.current.validate({ allowEmpty: false })) {
            spaceNameField.current.focus();
            spaceNameField.current.validate({ allowEmpty: false, focused: true });
            setBusy(false);
            return;
        }
        // validate the space name alias field but do not require it
        if (visibility === Visibility.Public && !await spaceAliasField.current.validate({ allowEmpty: true })) {
            spaceAliasField.current.focus();
            spaceAliasField.current.validate({ allowEmpty: true, focused: true });
            setBusy(false);
            return;
        }

        const initialState: ICreateRoomStateEvent[] = [
            {
                type: EventType.RoomHistoryVisibility,
                content: {
                    "history_visibility": visibility === Visibility.Public ? "world_readable" : "invited",
                },
            },
        ];
        if (avatar) {
            const url = await cli.uploadContent(avatar);

            initialState.push({
                type: EventType.RoomAvatar,
                content: { url },
            });
        }

        try {
            await createRoom({
                createOpts: {
                    preset: visibility === Visibility.Public ? Preset.PublicChat : Preset.PrivateChat,
                    name,
                    creation_content: {
                        [RoomCreateTypeField]: RoomType.Space,
                    },
                    initial_state: initialState,
                    power_level_content_override: {
                        // Only allow Admins to write to the timeline to prevent hidden sync spam
                        events_default: 100,
                        ...Visibility.Public ? { invite: 0 } : {},
                    },
                    room_alias_name: visibility === Visibility.Public && alias
                        ? alias.substr(1, alias.indexOf(":") - 1)
                        : undefined,
                    topic,
                },
                spinner: false,
                encryption: false,
                andView: true,
                inlineErrors: true,
            });

            onFinished();
        } catch (e) {
            console.error(e);
        }
    };

    let body;
    if (visibility === null) {
        body = <React.Fragment>
            <h2>{ _t("Create a space") }</h2>
            <p>{ _t("Spaces are a new way to group rooms and people. " +
                "To join an existing space you'll need an invite.") }</p>

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

            <p>{ _t("You can change this later") }</p>

            <SpaceFeedbackPrompt onClick={onFinished} />
        </React.Fragment>;
    } else {
        const domain = cli.getDomain();
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

            <form className="mx_SpaceBasicSettings" onSubmit={onSpaceCreateClick}>
                <SpaceAvatar setAvatar={setAvatar} avatarDisabled={busy} />

                <Field
                    name="spaceName"
                    label={_t("Name")}
                    autoFocus={true}
                    value={name}
                    onChange={ev => {
                        const newName = ev.target.value;
                        if (!alias || alias === nameToAlias(name, domain)) {
                            setAlias(nameToAlias(newName, domain));
                        }
                        setName(newName);
                    }}
                    ref={spaceNameField}
                    onValidate={spaceNameValidator}
                    disabled={busy}
                />

                { visibility === Visibility.Public
                    ? <RoomAliasField
                        ref={spaceAliasField}
                        onChange={setAlias}
                        domain={domain}
                        value={alias}
                        placeholder={name ? nameToAlias(name, domain) : _t("e.g. my-space")}
                        label={_t("Address")}
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
            </form>

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
        <FocusLock returnFocus={true}>
            <BetaPill onClick={() => {
                onFinished();
                defaultDispatcher.dispatch({
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Labs,
                });
            }} />
            { body }
        </FocusLock>
    </ContextMenu>;
};

export default SpaceCreateMenu;
