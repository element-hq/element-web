/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FC, type JSX, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import styled from "styled-components";
import { InlineSpinner } from "@vector-im/compound-web";

import { StaticConfig } from "./config";
import { theme } from "./theme";
import type { Api } from "@element-hq/element-web-module-api";
import Logo from "./Logo.tsx";

const Sidebar = styled(motion.div)`
    padding: 16px 12px 0;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    overflow: auto;
    position: fixed;
    left: 0;
    top: 0;
    height: 100%;
    width: ${({ theme }): string => theme.menu.width};
    background: white;
    border-top-right-radius: 16px;
    border-bottom-right-radius: 16px;
`;

const SidebarHeading = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
`;

const Launcher = styled.button`
    align-items: center;
    border: none;
    color: ${({ theme }): string => theme.compound.color.textPrimary};
    cursor: pointer;
    display: flex;

    &:hover,
    &:focus,
    &[data-expanded="true"] {
        background-color: ${({ theme }): string => theme.color.accent};
        color: #ffffff;
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
        background-color: rgba(238, 239, 242, 1);
    }
`;

const CategoryHeading = styled.h2`
    font-weight: 700;
    font-size: 12px;
    color: #203257;
    margin-top: 16px;
    margin-bottom: 8px;
`;

const LinkButton = styled.a`
    font-size: 14px;
    color: #000000;
    font-weight: 500;
    display: flex;
    border-radius: 8px;
    padding: 8px;
    align-items: center;

    &:hover {
        background-color: #eeeff2;
    }
`;

const LinkLogo = styled.img`
    height: 24px;
    width: 24px;
    border-radius: 3px;
    border: 1px solid #eeeff2;
    margin-right: 8px;
    background-color: #ffffff;
`;

const CentredContainer = styled.div`
    display: flex;
    height: 100%;
    width: 100%;
    align-items: center;
    text-align: center;
    font-weight: 600;

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

const WIDTH = parseInt(theme.menu.width.slice(0, -2), 10);

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
                <Launcher aria-haspopup={true} aria-expanded={open} aria-label={api.i18n.translate("trigger_label")}>
                    <svg fill="currentColor" height="16" width="16">
                        <path d="M0 4h4V0H0v4Zm6 12h4v-4H6v4Zm-6 0h4v-4H0v4Zm0-6h4V6H0v4Zm6 0h4V6H6v4Zm6-10v4h4V0h-4ZM6 4h4V0H6v4Zm6 6h4V6h-4v4Zm0 6h4v-4h-4v4Z" />
                    </svg>
                </Launcher>
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
                                initial={{ x: -WIDTH }}
                                animate={{ x: 0 }}
                                exit={{ x: -WIDTH }}
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
