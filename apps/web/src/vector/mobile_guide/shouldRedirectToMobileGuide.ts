/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

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
     * Whether the URL says the user is in the middle of something the mobile guide would interrupt,
     * such as verifying a 3pid or following a deep link.
     */
    isDeepLink: boolean;
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
    isDeepLink,
    hasSkippedRedirect,
    mobileGuideToast,
}: MobileGuideRedirectOptions): boolean {
    // The deployment has turned the mobile guide off.
    if (mobileGuideToast === false) return false;

    // Don't interrupt a 3pid verification or a deep link.
    // (https://github.com/element-hq/element-web/issues/7378)
    if (isDeepLink) return false;

    if (hasSkippedRedirect) return false;

    const isIos = /iPad|iPhone|iPod/.test(userAgent) && !hasMSStream;
    const isAndroid = /Android/.test(userAgent);
    return isIos || isAndroid;
}
