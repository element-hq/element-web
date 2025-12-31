/*
Copyright 2025 Clap

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Clap Developer Flags - 팀 개발자 전용 기능 플래그
 *
 * 이 플래그들은 로컬 스토리지에 저장되며, 서버에 동기화되지 않습니다.
 * 새 플래그를 추가하려면 이 객체에 키를 추가하세요.
 */
export const CLAP_DEV_FLAGS = {
    showCustomHomeserver: "다른 홈서버 등록 UI 표시",
} as const;

export type ClapDevFlagKey = keyof typeof CLAP_DEV_FLAGS;
export type ClapDevFlagsValue = Partial<Record<ClapDevFlagKey, boolean>>;
