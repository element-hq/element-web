/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type parseAppUrl } from "../url_utils";

export interface MobileGuideRedirectOptions {
    /**
     * The browser's user agent string.
     */
    userAgent: string;
    /**
     * Whether `window.MSStream` is present. Internet Explorer on Windows Phone claimed to be an
     * iPhone in its user agent while exposing this, so it is excluded from the iOS check.
     */
    hasMSStream: boolean;
    /**
     * The app's URL, as returned by {@link parseAppUrl}. A 3pid verification or a deep link means
     * the user is part way through something the mobile guide would interrupt.
     * See https://github.com/element-hq/element-web/issues/7378.
     */
    parsedUrl: ReturnType<typeof parseAppUrl>;
    /**
     * Whether the user has already chosen to carry on in the browser during this session.
     */
    hasSkippedRedirect: boolean;
    /**
     * The `mobile_guide_toast` config option, if the deployment set one.
     */
    mobileGuideToast?: boolean;
}

/**
 * Decide whether a mobile browser should be sent to the mobile guide page.
 *
 * @param options - the user agent, URL and configuration the decision is made from
 * @returns true if the browser should be redirected to `mobile_guide/`
 */
export function shouldRedirectToMobileGuide({
    userAgent,
    hasMSStream,
    parsedUrl,
    hasSkippedRedirect,
    mobileGuideToast,
}: MobileGuideRedirectOptions): boolean {
    if (mobileGuideToast === false) return false;

    if (parsedUrl.params.threepid || parsedUrl.location.length > 0) return false;

    if (hasSkippedRedirect) return false;

    const isIos = /iPad|iPhone|iPod/.test(userAgent) && !hasMSStream;
    const isAndroid = /Android/.test(userAgent);
    return isIos || isAndroid;
}
