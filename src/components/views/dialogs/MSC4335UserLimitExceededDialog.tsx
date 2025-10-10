/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import AccessibleButton from "../elements/AccessibleButton";

interface MSC4335Data {
    infoUri: string;
    increaseUri?: string;
}

interface IProps {
    onFinished?: (success?: boolean) => void;
    title?: string;
    error: MSC4335Data;
}

interface IState {
    onFinished: (success: boolean) => void;
}

export default class MSC4335UserLimitExceededDialog extends React.Component<IProps, IState> {
    onFinished = (success?: boolean): void => {
        this.props.onFinished?.(success);
    };
    onClick = (): void => {
        // noop as using href
    };

    public render(): React.ReactNode {
        const softLimit = !!this.props.error.increaseUri;

        return (
            <BaseDialog
                className="mx_ErrorDialog"
                title={this.props.title || _t("msc4335_user_limit_exceeded|title")}
                contentId="mx_Dialog_content"
                onFinished={this.onFinished}
            >
                <div className="mx_Dialog_content" id="mx_Dialog_content">
                    {softLimit
                        ? _t(
                              "msc4335_user_limit_exceeded|soft_limit",
                              {},
                              {
                                  a: (sub) => (
                                      <a href={this.props.error.infoUri} target="_blank" rel="noreferrer">
                                          {sub}
                                      </a>
                                  ),
                              },
                          )
                        : _t("msc4335_user_limit_exceeded|hard_limit")}
                </div>
                <div className="mx_Dialog_buttons">
                    <div className="mx_Dialog_buttons_row">
                        {softLimit && (
                            <AccessibleButton
                                kind="link"
                                element="a"
                                href={this.props.error.infoUri}
                                target="_blank"
                                rel="noreferrer noopener"
                                data-testid="learn-more"
                                onClick={this.onClick}
                            >
                                {_t("msc4335_user_limit_exceeded|learn_more")}
                            </AccessibleButton>
                        )}
                        <AccessibleButton
                            kind="primary"
                            element="a"
                            href={softLimit ? this.props.error.increaseUri : this.props.error.infoUri}
                            target="_blank"
                            rel="noreferrer noopener"
                            autoFocus={true}
                            onClick={this.onClick}
                            data-testid="primary-button"
                        >
                            {softLimit
                                ? _t("msc4335_user_limit_exceeded|increase_limit")
                                : _t("msc4335_user_limit_exceeded|learn_more")}
                        </AccessibleButton>
                    </div>
                </div>
            </BaseDialog>
        );
    }
}
