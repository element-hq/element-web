/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { IThreepid } from "matrix-js-sdk/src/@types/threepids";
import { logger } from "matrix-js-sdk/src/logger";
import { MatrixError } from "matrix-js-sdk/src/matrix";

import { _t, UserFriendlyError } from "../../../../languageHandler";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import Modal from "../../../../Modal";
import AddThreepid, { Binding } from "../../../../AddThreepid";
import ErrorDialog, { extractErrorMessageFromError } from "../../dialogs/ErrorDialog";
import SettingsSubsection from "../shared/SettingsSubsection";
import InlineSpinner from "../../elements/InlineSpinner";
import AccessibleButton, { ButtonEvent } from "../../elements/AccessibleButton";

/*
TODO: Improve the UX for everything in here.
It's very much placeholder, but it gets the job done. The old way of handling
email addresses in user settings was to use dialogs to communicate state, however
due to our dialog system overriding dialogs (causing unmounts) this creates problems
for a sane UX. For instance, the user could easily end up entering an email address
and receive a dialog to verify the address, which then causes the component here
to forget what it was doing and ultimately fail. Dialogs are still used in some
places to communicate errors - these should be replaced with inline validation when
that is available.
*/

/*
TODO: Reduce all the copying between account vs. discovery components.
*/

interface IEmailAddressProps {
    email: IThreepid;
}

interface IEmailAddressState {
    verifying: boolean;
    addTask: AddThreepid | null;
    continueDisabled: boolean;
    bound?: boolean;
}

export class EmailAddress extends React.Component<IEmailAddressProps, IEmailAddressState> {
    public constructor(props: IEmailAddressProps) {
        super(props);

        const { bound } = props.email;

        this.state = {
            verifying: false,
            addTask: null,
            continueDisabled: false,
            bound,
        };
    }

    public componentDidUpdate(prevProps: Readonly<IEmailAddressProps>): void {
        if (this.props.email !== prevProps.email) {
            const { bound } = this.props.email;
            this.setState({ bound });
        }
    }

    private async changeBinding({ bind, label, errorTitle }: Binding): Promise<void> {
        if (!(await MatrixClientPeg.get().doesServerSupportSeparateAddAndBind())) {
            return this.changeBindingTangledAddBind({ bind, label, errorTitle });
        }

        const { medium, address } = this.props.email;

        try {
            if (bind) {
                const task = new AddThreepid(MatrixClientPeg.get());
                this.setState({
                    verifying: true,
                    continueDisabled: true,
                    addTask: task,
                });
                await task.bindEmailAddress(address);
                this.setState({
                    continueDisabled: false,
                });
            } else {
                await MatrixClientPeg.get().unbindThreePid(medium, address);
            }
            this.setState({ bound: bind });
        } catch (err) {
            logger.error(`changeBinding: Unable to ${label} email address ${address}`, err);
            this.setState({
                verifying: false,
                continueDisabled: false,
                addTask: null,
            });
            Modal.createDialog(ErrorDialog, {
                title: errorTitle,
                description: extractErrorMessageFromError(err, _t("Operation failed")),
            });
        }
    }

    private async changeBindingTangledAddBind({ bind, label, errorTitle }: Binding): Promise<void> {
        const { medium, address } = this.props.email;

        const task = new AddThreepid(MatrixClientPeg.get());
        this.setState({
            verifying: true,
            continueDisabled: true,
            addTask: task,
        });

        try {
            await MatrixClientPeg.get().deleteThreePid(medium, address);
            if (bind) {
                await task.bindEmailAddress(address);
            } else {
                await task.addEmailAddress(address);
            }
            this.setState({
                continueDisabled: false,
                bound: bind,
            });
        } catch (err) {
            logger.error(`changeBindingTangledAddBind: Unable to ${label} email address ${address}`, err);
            this.setState({
                verifying: false,
                continueDisabled: false,
                addTask: null,
            });
            Modal.createDialog(ErrorDialog, {
                title: errorTitle,
                description: extractErrorMessageFromError(err, _t("Operation failed")),
            });
        }
    }

    private onRevokeClick = (e: ButtonEvent): void => {
        e.stopPropagation();
        e.preventDefault();
        this.changeBinding({
            bind: false,
            label: "revoke",
            errorTitle: _t("Unable to revoke sharing for email address"),
        });
    };

    private onShareClick = (e: ButtonEvent): void => {
        e.stopPropagation();
        e.preventDefault();
        this.changeBinding({
            bind: true,
            label: "share",
            errorTitle: _t("Unable to share email address"),
        });
    };

    private onContinueClick = async (e: ButtonEvent): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        // Prevent the continue button from being pressed multiple times while we're working
        this.setState({ continueDisabled: true });
        try {
            await this.state.addTask?.checkEmailLinkClicked();
            this.setState({
                addTask: null,
                verifying: false,
            });
        } catch (err) {
            logger.error(`Unable to verify email address:`, err);

            let underlyingError = err;
            if (err instanceof UserFriendlyError) {
                underlyingError = err.cause;
            }

            if (underlyingError instanceof MatrixError && underlyingError.errcode === "M_THREEPID_AUTH_FAILED") {
                Modal.createDialog(ErrorDialog, {
                    title: _t("Your email address hasn't been verified yet"),
                    description: _t(
                        "Click the link in the email you received to verify and then click continue again.",
                    ),
                });
            } else {
                logger.error("Unable to verify email address: " + err);
                Modal.createDialog(ErrorDialog, {
                    title: _t("Unable to verify email address."),
                    description: extractErrorMessageFromError(err, _t("Operation failed")),
                });
            }
        } finally {
            // Re-enable the continue button so the user can retry
            this.setState({ continueDisabled: false });
        }
    };

    public render(): React.ReactNode {
        const { address } = this.props.email;
        const { verifying, bound } = this.state;

        let status;
        if (verifying) {
            status = (
                <span>
                    {_t("Verify the link in your inbox")}
                    <AccessibleButton
                        className="mx_GeneralUserSettingsTab_section--discovery_existing_button"
                        kind="primary_sm"
                        onClick={this.onContinueClick}
                        disabled={this.state.continueDisabled}
                    >
                        {_t("Complete")}
                    </AccessibleButton>
                </span>
            );
        } else if (bound) {
            status = (
                <AccessibleButton
                    className="mx_GeneralUserSettingsTab_section--discovery_existing_button"
                    kind="danger_sm"
                    onClick={this.onRevokeClick}
                >
                    {_t("Revoke")}
                </AccessibleButton>
            );
        } else {
            status = (
                <AccessibleButton
                    className="mx_GeneralUserSettingsTab_section--discovery_existing_button"
                    kind="primary_sm"
                    onClick={this.onShareClick}
                >
                    {_t("Share")}
                </AccessibleButton>
            );
        }

        return (
            <div className="mx_GeneralUserSettingsTab_section--discovery_existing">
                <span className="mx_GeneralUserSettingsTab_section--discovery_existing_address">{address}</span>
                {status}
            </div>
        );
    }
}
interface IProps {
    emails: IThreepid[];
    isLoading?: boolean;
}

export default class EmailAddresses extends React.Component<IProps> {
    public render(): React.ReactNode {
        let content;
        if (this.props.isLoading) {
            content = <InlineSpinner />;
        } else if (this.props.emails.length > 0) {
            content = this.props.emails.map((e) => {
                return <EmailAddress email={e} key={e.address} />;
            });
        }

        const hasEmails = !!this.props.emails.length;

        return (
            <SettingsSubsection
                heading={_t("Email addresses")}
                description={
                    (!hasEmails && _t("Discovery options will appear once you have added an email above.")) || undefined
                }
                stretchContent
            >
                {content}
            </SettingsSubsection>
        );
    }
}
