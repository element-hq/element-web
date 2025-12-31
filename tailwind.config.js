/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Tailwind CSS v4 Configuration
 *
 * 참고: v4에서는 대부분의 설정을 CSS 파일 내 @theme 블록에서 처리합니다.
 * 이 파일은 콘텐츠 소스 지정 및 플러그인 확장용으로만 사용됩니다.
 *
 * Tailwind CSS 사용 가이드: docs/tailwind-css.md 참조
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,ts,jsx,tsx}", "./res/**/*.html"],
    // Tailwind v4에서는 theme 설정이 CSS에서 @theme로 처리됩니다.
    // 커스텀 테마 확장이 필요하면 res/css/tailwind.css에서 @theme 블록 사용
};
