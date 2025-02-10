/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, createRef, type SyntheticEvent } from "react";
import { AutoDiscovery } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import AutoDiscoveryUtils from "../../../utils/AutoDiscoveryUtils";
import BaseDialog from "./BaseDialog";
import { _t, UserFriendlyError } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import SdkConfig from "../../../SdkConfig";
import Field from "../elements/Field";
import StyledRadioButton from "../elements/StyledRadioButton";
import TextWithTooltip from "../elements/TextWithTooltip";
import withValidation, { type IFieldState, type IValidationResult } from "../elements/Validation";
import { type ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
import ExternalLink from "../elements/ExternalLink";

interface IProps {
    title?: string;
    serverConfig: ValidatedServerConfig;
    onFinished(config?: ValidatedServerConfig): void;
}

interface IState {
    defaultChosen: boolean;
    otherHomeserver: string;
}

export default class ServerPickerDialog extends React.PureComponent<IProps, IState> {
    private readonly defaultServer: ValidatedServerConfig;
    private readonly fieldRef = createRef<Field>();
    private validatedConf?: ValidatedServerConfig;

    public constructor(props: IProps) {
        super(props);

        const config = SdkConfig.get();
        this.defaultServer = config["validated_server_config"]!;
        const { serverConfig } = this.props;

        let otherHomeserver = "";
        if (!serverConfig.isDefault) {
            if (serverConfig.isNameResolvable && serverConfig.hsName) {
                otherHomeserver = serverConfig.hsName;
            } else {
                otherHomeserver = serverConfig.hsUrl;
            }
        }

        this.state = {
            defaultChosen: serverConfig.isDefault,
            otherHomeserver,
        };
    }

    private onDefaultChosen = (): void => {
        this.setState({ defaultChosen: true });
    };

    private onOtherChosen = (): void => {
        this.setState({ defaultChosen: false });
    };

    private onHomeserverChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.setState({ otherHomeserver: ev.target.value });
    };

    private validate = withValidation<this, { error?: string }>({
        deriveData: async ({ value }): Promise<{ error?: string }> => {
            let hsUrl = (value ?? "").trim(); // trim to account for random whitespace

            // if the URL has no protocol, try validate it as a serverName via well-known
            if (!hsUrl.includes("://")) {
                try {
                    const discoveryResult = await AutoDiscovery.findClientConfig(hsUrl);
                    this.validatedConf = await AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(
                        hsUrl,
                        discoveryResult,
                    );
                    return {}; // we have a validated config, we don't need to try the other paths
                } catch (e) {
                    logger.error(`Attempted ${hsUrl} as a server_name but it failed`, e);
                }
            }

            // if we got to this stage then either the well-known failed or the URL had a protocol specified,
            // so validate statically only. If the URL has no protocol, default to https.
            if (!hsUrl.includes("://")) {
                hsUrl = "https://" + hsUrl;
            }

            try {
                this.validatedConf = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(hsUrl);
                return {};
            } catch (e) {
                logger.error(e);

                const stateForError = AutoDiscoveryUtils.authComponentStateForError(e);
                if (stateForError.serverErrorIsFatal) {
                    let error = _t("auth|server_picker_failed_validate_homeserver");
                    if (e instanceof UserFriendlyError && e.translatedMessage) {
                        error = e.translatedMessage;
                    }
                    return { error };
                }

                // try to carry on anyway
                try {
                    this.validatedConf = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(
                        hsUrl,
                        undefined,
                        true,
                    );
                    return {};
                } catch (e) {
                    logger.error(e);
                    return { error: _t("auth|server_picker_invalid_url") };
                }
            }
        },
        rules: [
            {
                key: "required",
                test: ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t("auth|server_picker_required"),
            },
            {
                key: "valid",
                test: async function ({ value }, { error }): Promise<boolean> {
                    if (!value) return true;
                    return !error;
                },
                invalid: function ({ error }) {
                    return error ?? null;
                },
            },
        ],
    });

    private onHomeserverValidate = (fieldState: IFieldState): Promise<IValidationResult> => this.validate(fieldState);

    private onSubmit = async (ev: SyntheticEvent): Promise<void> => {
        ev.preventDefault();

        if (this.state.defaultChosen) {
            this.props.onFinished(this.defaultServer);
            return;
        }

        const valid = await this.fieldRef.current?.validate({ allowEmpty: false });

        if (!valid) {
            this.fieldRef.current?.focus();
            this.fieldRef.current?.validate({ allowEmpty: false, focused: true });
            return;
        }

        this.props.onFinished(this.validatedConf);
    };

    public render(): React.ReactNode {
        let text: string | undefined;
        if (this.defaultServer.hsName === "matrix.org") {
            text = _t("auth|server_picker_matrix.org");
        }

        let defaultServerName: React.ReactNode = this.defaultServer.hsName;
        if (this.defaultServer.hsNameIsDifferent) {
            defaultServerName = (
                <TextWithTooltip className="mx_Login_underlinedServerName" tooltip={this.defaultServer.hsUrl}>
                    {this.defaultServer.hsName}
                </TextWithTooltip>
            );
        }

        return (
            <BaseDialog
                title={this.props.title || _t("auth|server_picker_title")}
                className="mx_ServerPickerDialog"
                contentId="mx_ServerPickerDialog"
                onFinished={this.props.onFinished}
                fixedWidth={false}
                hasCancel={true}
            >
                <form className="mx_Dialog_content" id="mx_ServerPickerDialog" onSubmit={this.onSubmit}>
                    <p>
                        {_t("auth|server_picker_intro")} {text}
                    </p>

                    <StyledRadioButton
                        name="defaultChosen"
                        value="true"
                        checked={this.state.defaultChosen}
                        onChange={this.onDefaultChosen}
                        data-testid="defaultHomeserver"
                    >
                        {defaultServerName}
                    </StyledRadioButton>

                    <StyledRadioButton
                        name="defaultChosen"
                        value="false"
                        className="mx_ServerPickerDialog_otherHomeserverRadio"
                        checked={!this.state.defaultChosen}
                        onChange={this.onOtherChosen}
                        childrenInLabel={false}
                        aria-label={_t("auth|server_picker_custom")}
                    >
                        <Field
                            type="text"
                            className="mx_ServerPickerDialog_otherHomeserver"
                            label={_t("auth|server_picker_custom")}
                            onChange={this.onHomeserverChange}
                            onFocus={this.onOtherChosen}
                            ref={this.fieldRef}
                            onValidate={this.onHomeserverValidate}
                            value={this.state.otherHomeserver}
                            validateOnChange={false}
                            validateOnFocus={false}
                            autoFocus={true}
                            id="mx_homeserverInput"
                        />
                    </StyledRadioButton>
                    <p>{_t("auth|server_picker_explainer")}</p>

                    <AccessibleButton className="mx_ServerPickerDialog_continue" kind="primary" onClick={this.onSubmit}>
                        {_t("action|continue")}
                    </AccessibleButton>

                    <h2>{_t("action|learn_more")}</h2>
                    <ExternalLink
                        href="https://matrix.org/docs/matrix-concepts/elements-of-matrix/#homeserver"
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        {_t("auth|server_picker_learn_more")}
                    </ExternalLink>
                </form>
            </BaseDialog>
        );
    }
}
