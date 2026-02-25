/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useMemo } from "react";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import AccessibleButton from "../elements/AccessibleButton";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";

interface MSC4335Data {
    infoUri: string;
    canUpgrade: boolean;
}

interface IProps {
    onFinished?: (success?: boolean) => void;
    title?: string;
    error: MSC4335Data;
}

export default function MSC4335UserLimitExceededDialog({ onFinished: _onFinished, title, error }: IProps): JSX.Element {
    function onFinished(success?: boolean): void {
        _onFinished?.(success);
    }

    function onClick(): void {
        // noop as using href
    }

    const matrixClient = useMatrixClientContext();
    const isMatrixDotOrg = useMemo(() => matrixClient?.getDomain() === "matrix.org", [matrixClient]);

    return (
        <BaseDialog
            className="mx_ErrorDialog"
            title={
                title ||
                (isMatrixDotOrg
                    ? _t("msc4335_matrix_org_user_limit_exceeded|title")
                    : _t("msc4335_user_limit_exceeded|title"))
            }
            contentId="mx_Dialog_content"
            onFinished={onFinished}
        >
            <div className="mx_Dialog_content" id="mx_Dialog_content">
                {error.canUpgrade
                    ? isMatrixDotOrg
                        ? _t("msc4335_matrix_org_user_limit_exceeded|soft_limit")
                        : _t("msc4335_user_limit_exceeded|soft_limit")
                    : isMatrixDotOrg
                      ? _t("msc4335_matrix_org_user_limit_exceeded|hard_limit")
                      : _t("msc4335_user_limit_exceeded|hard_limit")}
            </div>
            <div className="mx_Dialog_buttons">
                <div className="mx_Dialog_buttons_row">
                    <AccessibleButton
                        kind="primary"
                        element="a"
                        href={error.infoUri}
                        target="_blank"
                        rel="noreferrer noopener"
                        data-testid="learn-more"
                        onClick={onClick}
                    >
                        {error.canUpgrade
                            ? isMatrixDotOrg
                                ? _t("msc4335_matrix_org_user_limit_exceeded|soft_limit_button")
                                : _t("msc4335_user_limit_exceeded|soft_limit_button")
                            : isMatrixDotOrg
                              ? _t("msc4335_matrix_org_user_limit_exceeded|hard_limit_button")
                              : _t("msc4335_user_limit_exceeded|hard_limit_button")}
                    </AccessibleButton>
                </div>
            </div>
        </BaseDialog>
    );
}
