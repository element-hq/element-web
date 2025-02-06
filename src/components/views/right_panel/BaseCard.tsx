/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { forwardRef, type ReactNode, type KeyboardEvent, type Ref, type MouseEvent } from "react";
import classNames from "classnames";
import { IconButton, Text } from "@vector-im/compound-web";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
import ChevronLeftIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-left";

import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import { _t } from "../../../languageHandler";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { backLabelForPhase } from "../../../stores/right-panel/RightPanelStorePhases";
import { CardContext } from "./context";

interface IProps {
    header?: ReactNode | null;
    hideHeaderButtons?: boolean;
    footer?: ReactNode;
    className?: string;
    id?: string;
    role?: "tabpanel";
    ariaLabelledBy?: string;
    withoutScrollContainer?: boolean;
    closeLabel?: string;
    onClose?(ev: MouseEvent<HTMLButtonElement>): void;
    onBack?(ev: MouseEvent<HTMLButtonElement>): void;
    onKeyDown?(ev: KeyboardEvent): void;
    cardState?: any;
    ref?: Ref<HTMLDivElement>;
    // Ref for the 'close' button the card
    closeButtonRef?: Ref<HTMLButtonElement>;
    children: ReactNode;
}

function closeRightPanel(ev: MouseEvent<HTMLButtonElement>): void {
    ev.preventDefault();
    ev.stopPropagation();
    RightPanelStore.instance.popCard();
}

const BaseCard: React.FC<IProps> = forwardRef<HTMLDivElement, IProps>(
    (
        {
            closeLabel,
            onClose,
            onBack,
            className,
            id,
            ariaLabelledBy,
            role,
            hideHeaderButtons,
            header,
            footer,
            withoutScrollContainer,
            children,
            onKeyDown,
            closeButtonRef,
        },
        ref,
    ) => {
        let backButton;
        const cardHistory = RightPanelStore.instance.roomPhaseHistory;
        if (cardHistory.length > 1 && !hideHeaderButtons) {
            const prevCard = cardHistory[cardHistory.length - 2];
            const onBackClick = (ev: MouseEvent<HTMLButtonElement>): void => {
                onBack?.(ev);
                RightPanelStore.instance.popCard();
            };
            const label = backLabelForPhase(prevCard.phase) ?? _t("action|back");
            backButton = (
                <IconButton
                    size="28px"
                    data-testid="base-card-back-button"
                    onClick={onBackClick}
                    tooltip={label}
                    subtleBackground
                >
                    <ChevronLeftIcon />
                </IconButton>
            );
        }

        let closeButton;
        if (!hideHeaderButtons) {
            closeButton = (
                <IconButton
                    size="28px"
                    data-testid="base-card-close-button"
                    onClick={onClose ?? closeRightPanel}
                    ref={closeButtonRef}
                    tooltip={closeLabel ?? _t("action|close")}
                    subtleBackground
                >
                    <CloseIcon />
                </IconButton>
            );
        }

        if (!withoutScrollContainer) {
            children = <AutoHideScrollbar>{children}</AutoHideScrollbar>;
        }

        const shouldRenderHeader = header || !hideHeaderButtons;

        return (
            <CardContext.Provider value={{ isCard: true }}>
                <div
                    id={id}
                    aria-labelledby={ariaLabelledBy}
                    role={role}
                    className={classNames("mx_BaseCard", className)}
                    ref={ref}
                    onKeyDown={onKeyDown}
                >
                    {shouldRenderHeader && (
                        <div className="mx_BaseCard_header">
                            {backButton}
                            {typeof header === "string" ? (
                                <div className="mx_BaseCard_header_title">
                                    <Text
                                        size="md"
                                        weight="medium"
                                        className="mx_BaseCard_header_title_heading"
                                        role="heading"
                                    >
                                        {header}
                                    </Text>
                                </div>
                            ) : (
                                (header ?? <div className="mx_BaseCard_header_spacer" />)
                            )}
                            {closeButton}
                        </div>
                    )}
                    {children}
                    {footer && <div className="mx_BaseCard_footer">{footer}</div>}
                </div>
            </CardContext.Provider>
        );
    },
);

export default BaseCard;
