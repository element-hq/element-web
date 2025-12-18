/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FC, type JSX, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import styled, { useTheme } from "styled-components";
import { InlineSpinner } from "@vector-im/compound-web";
import { type Api } from "@element-hq/element-web-module-api";

import { type StaticConfig } from "./config";
import Logo from "./Logo.tsx";
import TriggerIcon from "./trigger.svg?react";

const Sidebar = styled(motion.div)`
    padding: 0 var(--cpd-space-3x) var(--cpd-space-4x);
    box-shadow: 0 4px 20px 0 rgba(0, 0, 0, 0.1);
    overflow: auto;
    position: fixed;
    left: 0;
    top: 0;
    height: 100%;
    width: ${({ theme }): string => theme.menuWidth};
    background: ${({ theme }): string => theme.menuBackgroundColor};
    border-radius: 0 16px 16px 0;
    font: var(--cpd-font-body-md-regular);
    letter-spacing: var(--cpd-font-letter-spacing-body-md);
    font-feature-settings: normal;
`;

const SidebarHeading = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--cpd-space-5x);
`;

const Trigger = styled.button`
    align-items: center;
    border: none;
    cursor: pointer;
    display: flex;
    background-color: ${({ theme }): string => theme.triggerBackgroundColor};
    color: ${({ theme }): string => theme.triggerColor};
    width: ${({ theme }): string => theme.triggerWidth};

    &:hover,
    &:focus {
        background-color: ${({ theme }): string => theme.triggerBackgroundColorHover};
        color: ${({ theme }): string => theme.triggerColorContrast};
    }

    &:active,
    &[data-expanded="true"] {
        background-color: ${({ theme }): string => theme.triggerBackgroundColorPressed};
        color: ${({ theme }): string => theme.triggerColorContrast};
    }

    svg {
        margin: auto;
    }
`;

const CloseButton = styled.button`
    /* Reset button styles */
    appearance: none;
    background: none;
    border: none;
    padding: 0;
    margin: 0;

    height: 32px;
    width: 32px;
    cursor: pointer;
    border-radius: 8px;

    &:hover,
    &:focus {
        background-color: ${({ theme }): string => theme.menuButtonBackgroundColorHover};
    }

    &:active {
        background-color: ${({ theme }): string => theme.menuButtonBackgroundColorPressed};
    }
`;

const CategoryHeading = styled.h2`
    font-weight: 700;
    font-size: 12px;
    color: ${({ theme }): string => theme.subheadingColor};
    margin-top: var(--cpd-space-4x);
    margin-bottom: var(--cpd-space-2x);
`;

const LinkButton = styled.a`
    font-size: 14px;
    color: var(--cpd-color-text-action-primary);
    font-weight: var(--cpd-font-weight-medium);
    display: flex;
    border-radius: 8px;
    padding: var(--cpd-space-2x);
    align-items: center;

    &:link {
        color: var(--cpd-color-text-action-primary);
    }

    &:hover,
    &:focus {
        background-color: ${({ theme }): string => theme.menuButtonBackgroundColorHover};
    }

    &:active {
        background-color: ${({ theme }): string => theme.menuButtonBackgroundColorPressed};
    }
`;

const LinkLogo = styled.img`
    height: 24px;
    width: 24px;
    border-radius: 4px;
    border: ${({ theme }): string => `var(--cpd-border-width-1) solid ${theme.menuButtonBackgroundColorPressed}`};
    background-color: ${({ theme }): string => theme.menuBackgroundColor};
    margin-right: var(--cpd-space-2x);
`;

const CentredContainer = styled.div`
    display: flex;
    height: 100%;
    width: 100%;
    align-items: center;
    text-align: center;
    font-weight: var(--cpd-font-weight-semibold);

    svg {
        margin: 0 auto;
    }
`;

const Overlay = styled(motion.div)`
    background-color: rgba(238, 239, 242, 0.5);
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
`;

interface Props {
    api: Api;
    config: StaticConfig | Error | null; // null for loading
    fallbackLogoUrl: string;
}

const Category: FC<{
    data: StaticConfig["categories"][number];
}> = ({ data }) => {
    return (
        <div>
            <CategoryHeading>{data.name}</CategoryHeading>
            {data.links.map((link) => (
                <LinkButton key={link.link_url} href={link.link_url} target={link.target ?? "_blank"}>
                    <LinkLogo src={link.icon_uri} role="presentation" /> {link.name}
                </LinkButton>
            ))}
        </div>
    );
};

const Menu: FC<Props> = ({ api, config, fallbackLogoUrl }) => {
    const theme = useTheme();
    const width = parseInt(theme.menuWidth.slice(0, -2), 10);
    const [open, setOpen] = useState(false);

    let content: JSX.Element;
    let logoUrl = fallbackLogoUrl;
    if (config instanceof Error) {
        content = <CentredContainer>{api.i18n.translate("univention_error")}</CentredContainer>;
    } else if (config) {
        content = (
            <>
                {config.categories.map((category) => (
                    <Category key={category.name} data={category} />
                ))}
            </>
        );
        if (config.logo_url) {
            logoUrl = config.logo_url;
        }
    } else {
        content = (
            <CentredContainer>
                <InlineSpinner size={32} />
            </CentredContainer>
        );
    }

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <Trigger aria-haspopup={true} aria-expanded={open} aria-label={api.i18n.translate("trigger_label")}>
                    <TriggerIcon />
                </Trigger>
            </Dialog.Trigger>

            <AnimatePresence>
                {open && (
                    <Dialog.Portal forceMount>
                        <Dialog.Overlay asChild>
                            <Overlay
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                data-testid="dialog-overlay"
                            />
                        </Dialog.Overlay>
                        <Dialog.Content asChild>
                            <Sidebar
                                initial={{ x: -width }}
                                animate={{ x: 0 }}
                                exit={{ x: -width }}
                                transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                                aria-label={api.i18n.translate("menu_label")}
                            >
                                <Dialog.Title>
                                    <SidebarHeading>
                                        <Logo api={api} src={logoUrl} />
                                        <Dialog.Close asChild>
                                            <CloseButton
                                                aria-label={api.i18n.translate("close_label")}
                                                onClick={() => setOpen(false)}
                                            >
                                                <svg
                                                    width="20"
                                                    height="20"
                                                    viewBox="0 0 20 20"
                                                    fill="none"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                >
                                                    <path
                                                        d="M7.04167 13.9999L6 12.9583L8.9375 9.99992L6 7.06242L7.04167 6.02075L10 8.95825L12.9375 6.02075L13.9792 7.06242L11.0417 9.99992L13.9792 12.9583L12.9375 13.9999L10 11.0624L7.04167 13.9999Z"
                                                        fill="currentColor"
                                                    />
                                                </svg>
                                            </CloseButton>
                                        </Dialog.Close>
                                    </SidebarHeading>
                                </Dialog.Title>
                                {content}
                            </Sidebar>
                        </Dialog.Content>
                    </Dialog.Portal>
                )}
            </AnimatePresence>
        </Dialog.Root>
    );
};

export default Menu;
