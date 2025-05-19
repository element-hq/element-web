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

import { StaticConfig } from "./config";
import type { Api } from "@element-hq/element-web-module-api";
import Logo from "./Logo.tsx";

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
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M4.99992 16.6667C4.54159 16.6667 4.14922 16.5035 3.82284 16.1771C3.49645 15.8507 3.33325 15.4584 3.33325 15C3.33325 14.5417 3.49645 14.1493 3.82284 13.823C4.14922 13.4966 4.54159 13.3334 4.99992 13.3334C5.45825 13.3334 5.85061 13.4966 6.177 13.823C6.50339 14.1493 6.66659 14.5417 6.66659 15C6.66659 15.4584 6.50339 15.8507 6.177 16.1771C5.85061 16.5035 5.45825 16.6667 4.99992 16.6667ZM9.99992 16.6667C9.54158 16.6667 9.14922 16.5035 8.82284 16.1771C8.49645 15.8507 8.33325 15.4584 8.33325 15C8.33325 14.5417 8.49645 14.1493 8.82284 13.823C9.14922 13.4966 9.54158 13.3334 9.99992 13.3334C10.4583 13.3334 10.8506 13.4966 11.177 13.823C11.5034 14.1493 11.6666 14.5417 11.6666 15C11.6666 15.4584 11.5034 15.8507 11.177 16.1771C10.8506 16.5035 10.4583 16.6667 9.99992 16.6667ZM14.9999 16.6667C14.5416 16.6667 14.1492 16.5035 13.8228 16.1771C13.4964 15.8507 13.3333 15.4584 13.3333 15C13.3333 14.5417 13.4964 14.1493 13.8228 13.823C14.1492 13.4966 14.5416 13.3334 14.9999 13.3334C15.4583 13.3334 15.8506 13.4966 16.177 13.823C16.5034 14.1493 16.6666 14.5417 16.6666 15C16.6666 15.4584 16.5034 15.8507 16.177 16.1771C15.8506 16.5035 15.4583 16.6667 14.9999 16.6667ZM4.99992 11.6667C4.54159 11.6667 4.14922 11.5035 3.82284 11.1771C3.49645 10.8507 3.33325 10.4584 3.33325 10C3.33325 9.54171 3.49645 9.14935 3.82284 8.82296C4.14922 8.49657 4.54159 8.33337 4.99992 8.33337C5.45825 8.33337 5.85061 8.49657 6.177 8.82296C6.50339 9.14935 6.66659 9.54171 6.66659 10C6.66659 10.4584 6.50339 10.8507 6.177 11.1771C5.85061 11.5035 5.45825 11.6667 4.99992 11.6667ZM9.99992 11.6667C9.54158 11.6667 9.14922 11.5035 8.82284 11.1771C8.49645 10.8507 8.33325 10.4584 8.33325 10C8.33325 9.54171 8.49645 9.14935 8.82284 8.82296C9.14922 8.49657 9.54158 8.33337 9.99992 8.33337C10.4583 8.33337 10.8506 8.49657 11.177 8.82296C11.5034 9.14935 11.6666 9.54171 11.6666 10C11.6666 10.4584 11.5034 10.8507 11.177 11.1771C10.8506 11.5035 10.4583 11.6667 9.99992 11.6667ZM14.9999 11.6667C14.5416 11.6667 14.1492 11.5035 13.8228 11.1771C13.4964 10.8507 13.3333 10.4584 13.3333 10C13.3333 9.54171 13.4964 9.14935 13.8228 8.82296C14.1492 8.49657 14.5416 8.33337 14.9999 8.33337C15.4583 8.33337 15.8506 8.49657 16.177 8.82296C16.5034 9.14935 16.6666 9.54171 16.6666 10C16.6666 10.4584 16.5034 10.8507 16.177 11.1771C15.8506 11.5035 15.4583 11.6667 14.9999 11.6667ZM4.99992 6.66671C4.54159 6.66671 4.14922 6.50351 3.82284 6.17712C3.49645 5.85074 3.33325 5.45837 3.33325 5.00004C3.33325 4.54171 3.49645 4.14935 3.82284 3.82296C4.14922 3.49657 4.54159 3.33337 4.99992 3.33337C5.45825 3.33337 5.85061 3.49657 6.177 3.82296C6.50339 4.14935 6.66659 4.54171 6.66659 5.00004C6.66659 5.45837 6.50339 5.85074 6.177 6.17712C5.85061 6.50351 5.45825 6.66671 4.99992 6.66671ZM9.99992 6.66671C9.54158 6.66671 9.14922 6.50351 8.82284 6.17712C8.49645 5.85074 8.33325 5.45837 8.33325 5.00004C8.33325 4.54171 8.49645 4.14935 8.82284 3.82296C9.14922 3.49657 9.54158 3.33337 9.99992 3.33337C10.4583 3.33337 10.8506 3.49657 11.177 3.82296C11.5034 4.14935 11.6666 4.54171 11.6666 5.00004C11.6666 5.45837 11.5034 5.85074 11.177 6.17712C10.8506 6.50351 10.4583 6.66671 9.99992 6.66671ZM14.9999 6.66671C14.5416 6.66671 14.1492 6.50351 13.8228 6.17712C13.4964 5.85074 13.3333 5.45837 13.3333 5.00004C13.3333 4.54171 13.4964 4.14935 13.8228 3.82296C14.1492 3.49657 14.5416 3.33337 14.9999 3.33337C15.4583 3.33337 15.8506 3.49657 16.177 3.82296C16.5034 4.14935 16.6666 4.54171 16.6666 5.00004C16.6666 5.45837 16.5034 5.85074 16.177 6.17712C15.8506 6.50351 15.4583 6.66671 14.9999 6.66671Z"
                            fill="currentColor"
                        />
                    </svg>
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
