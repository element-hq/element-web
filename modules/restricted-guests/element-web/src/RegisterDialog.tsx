/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { FC, useState, type JSX, FormEvent } from "react";
import { type Api, type AccountAuthInfo, type DialogProps } from "@element-hq/element-web-module-api";
import { Form } from "@vector-im/compound-web";

import { ModuleConfig } from "./config.ts";

interface RegisterDialogProps extends DialogProps<AccountAuthInfo> {
    api: Api;
    config: ModuleConfig;
}

const enum State {
    Idle,
    Busy,
    Error,
}

const RegisterDialog: FC<RegisterDialogProps> = ({ api, config, onCancel, onSubmit }) => {
    const [username, setUsername] = useState("");
    const [state, setState] = useState<State>(State.Idle);

    async function trySubmit(ev: FormEvent): Promise<void> {
        ev.preventDefault();
        setState(State.Busy);

        try {
            const homeserverUrl = config.guest_user_homeserver_url;

            const url = new URL("/_synapse/client/register_guest", homeserverUrl);

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ displayname: username }),
            });

            if (response.ok) {
                const accountAuthInfo = await response.json();
                onSubmit(accountAuthInfo);
            }
        } catch (e) {
            console.error("Failed to create guest account", e);
            setState(State.Error);
        }
    }

    let message: JSX.Element | undefined;
    if (state === State.Error) {
        message = <Form.ErrorMessage>{api.i18n.translate("register_dialog_error")}</Form.ErrorMessage>;
    } else if (state === State.Busy) {
        message = <Form.LoadingMessage>{api.i18n.translate("register_dialog_busy")}</Form.LoadingMessage>;
    }

    const disabled = state !== State.Idle;

    return (
        <Form.Root onSubmit={trySubmit}>
            <Form.Field name="mxid">
                <Form.Label>{api.i18n.translate("register_dialog_register_username_label")}</Form.Label>
                <Form.TextControl
                    disabled={disabled}
                    value={username}
                    onChange={(event) => {
                        setUsername(event.currentTarget.value);
                    }}
                    placeholder={api.i18n.translate("register_dialog_field_label")}
                />
                {message}
            </Form.Field>

            <a href={config.skip_single_sign_on ? "/#/login" : "/#/start_sso"} onClick={onCancel}>
                {api.i18n.translate("register_dialog_existing_account")}
            </a>

            <Form.Submit disabled={disabled || !username}>
                {api.i18n.translate("register_dialog_continue_label")}
            </Form.Submit>
        </Form.Root>
    );
};

export default RegisterDialog;
