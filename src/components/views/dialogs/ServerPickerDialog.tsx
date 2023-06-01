/*
Copyright 2020-2021 The Matrix.org Foundation C.I.C.

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

import React, { ChangeEvent, createRef, SyntheticEvent } from "react";
import { AutoDiscovery } from "matrix-js-sdk/src/autodiscovery";
import { logger } from "matrix-js-sdk/src/logger";

import AutoDiscoveryUtils from "../../../utils/AutoDiscoveryUtils";
import BaseDialog from "./BaseDialog";
import { _t, UserFriendlyError } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import SdkConfig from "../../../SdkConfig";
import Field from "../elements/Field";
import StyledRadioButton from "../elements/StyledRadioButton";
import TextWithTooltip from "../elements/TextWithTooltip";
import withValidation, { IFieldState, IValidationResult } from "../elements/Validation";
import { ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
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

    // TODO: Do we want to support .well-known lookups here?
    // If for some reason someone enters "matrix.org" for a URL, we could do a lookup to
    // find their homeserver without demanding they use "https://matrix.org"
    private validate = withValidation<this, { error?: string }>({
        deriveData: async ({ value }): Promise<{ error?: string }> => {
            let hsUrl = (value ?? "").trim(); // trim to account for random whitespace

            // if the URL has no protocol, try validate it as a serverName via well-known
            if (!hsUrl.includes("://")) {
                try {
                    const discoveryResult = await AutoDiscovery.findClientConfig(hsUrl);
                    this.validatedConf = AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(hsUrl, discoveryResult);
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
                    let error = _t("Unable to validate homeserver");
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
                    return { error: _t("Invalid URL") };
                }
            }
        },
        rules: [
            {
                key: "required",
                test: ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t("Specify a homeserver"),
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
        let text;
        if (this.defaultServer.hsName === "matrix.org") {
            text = _t("Matrix.org is the biggest public homeserver in the world, so it's a good place for many.");
        }

        let defaultServerName: React.ReactNode = this.defaultServer.hsName;
        if (this.defaultServer.hsNameIsDifferent) {
            defaultServerName = (
                <TextWithTooltip class="mx_Login_underlinedServerName" tooltip={this.defaultServer.hsUrl}>
                    {this.defaultServer.hsName}
                </TextWithTooltip>
            );
        }

        return (
            <BaseDialog
                title={this.props.title || _t("Sign into your homeserver")}
                className="mx_ServerPickerDialog"
                contentId="mx_ServerPickerDialog"
                onFinished={this.props.onFinished}
                fixedWidth={false}
                hasCancel={true}
            >
                <form className="mx_Dialog_content" id="mx_ServerPickerDialog" onSubmit={this.onSubmit}>
                    <p>
                        {_t("We call the places where you can host your account 'homeservers'.")} {text}
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
                        aria-label={_t("Other homeserver")}
                    >
                        <Field
                            type="text"
                            className="mx_ServerPickerDialog_otherHomeserver"
                            label={_t("Other homeserver")}
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
                    <p>{_t("Use your preferred Matrix homeserver if you have one, or host your own.")}</p>

                    <AccessibleButton className="mx_ServerPickerDialog_continue" kind="primary" onClick={this.onSubmit}>
                        {_t("Continue")}
                    </AccessibleButton>

                    <h2>{_t("Learn more")}</h2>
                    <ExternalLink
                        href="https://matrix.org/faq/#what-is-a-homeserver%3F"
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        {_t("About homeservers")}
                    </ExternalLink>
                </form>
            </BaseDialog>
        );
    }
}
