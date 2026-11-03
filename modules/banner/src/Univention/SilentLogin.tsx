/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FC, useEffect } from "react";
import styled from "styled-components";

const HiddenIFrame = styled.iframe`
    display: none;
`;

interface Props {
    icsUrl: string;
    onLoggedIn(this: void, success: boolean): void;
}

const SilentLogin: FC<Props> = ({ onLoggedIn, icsUrl }) => {
    const url = new URL("silent", icsUrl);

    useEffect(() => {
        const listener = (event: MessageEvent): void => {
            if (event.origin === url.origin && typeof event.data === "object" && event.data["loggedIn"] === true) {
                onLoggedIn(true);
            }
        };

        window.addEventListener("message", listener);

        return (): void => {
            window.removeEventListener("message", listener);
        };
    }, [onLoggedIn, url.origin]);

    // The page only needs to run its script with its own cookies and send a postMessage back,
    // so it gets no other permissions.
    return <HiddenIFrame src={url.href} sandbox="allow-scripts allow-same-origin" />;
};

export default SilentLogin;
