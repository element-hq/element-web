/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Breadcrumb, Button, VisualList, VisualListItem } from "@vector-im/compound-web";
import CheckIcon from "@vector-im/compound-design-tokens/assets/web/icons/check";
import InfoIcon from "@vector-im/compound-design-tokens/assets/web/icons/info";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error";
import React, { MouseEventHandler } from "react";

import { _t } from "../../../../languageHandler";
import { EncryptionCard } from "./EncryptionCard";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { uiAuthCallback } from "../../../../CreateCrossSigning";

interface ResetIdentityPanelProps {
    /**
     * Called when the identity is reset.
     */
    onFinish: MouseEventHandler<HTMLButtonElement>;
    /**
     * Called when the cancel button is clicked or when we go back in the breadcrumbs.
     */
    onCancelClick: () => void;
}

/**
 * The panel for resetting the identity of the current user.
 */
export function ResetIdentityPanel({ onCancelClick, onFinish }: ResetIdentityPanelProps): JSX.Element {
    const matrixClient = useMatrixClientContext();

    return (
        <>
            <Breadcrumb
                backLabel={_t("action|back")}
                onBackClick={onCancelClick}
                pages={[_t("settings|encryption|title"), _t("settings|encryption|advanced|breadcrumb_page")]}
                onPageClick={onCancelClick}
            />
            <EncryptionCard
                Icon={ErrorIcon}
                destructive={true}
                title={_t("settings|encryption|advanced|breadcrumb_title")}
                className="mx_ResetIdentityPanel"
            >
                <div className="mx_ResetIdentityPanel_content">
                    <VisualList>
                        <VisualListItem Icon={CheckIcon} success={true}>
                            {_t("settings|encryption|advanced|breadcrumb_first_description")}
                        </VisualListItem>
                        <VisualListItem Icon={InfoIcon}>
                            {_t("settings|encryption|advanced|breadcrumb_second_description")}
                        </VisualListItem>
                        <VisualListItem Icon={InfoIcon}>
                            {_t("settings|encryption|advanced|breadcrumb_third_description")}
                        </VisualListItem>
                    </VisualList>
                    <span>{_t("settings|encryption|advanced|breadcrumb_warning")}</span>
                </div>
                <div className="mx_ResetIdentityPanel_footer">
                    <Button
                        destructive={true}
                        onClick={async (evt) => {
                            await matrixClient
                                .getCrypto()
                                ?.resetEncryption((makeRequest) => uiAuthCallback(matrixClient, makeRequest));
                            onFinish(evt);
                        }}
                    >
                        {_t("action|continue")}
                    </Button>
                    <Button kind="tertiary" onClick={onCancelClick}>
                        {_t("action|cancel")}
                    </Button>
                </div>
            </EncryptionCard>
        </>
    );
}
