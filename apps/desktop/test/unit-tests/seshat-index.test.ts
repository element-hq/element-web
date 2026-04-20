/*
Copyright 2026 Hiroshi Shinaoka

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { TokenizerMode } from "../../src/seshat-config.js";
import { initEventIndex } from "../../src/seshat-index.js";

const eventStorePath = join(tmpdir(), "element-desktop-seshat-index-test");

describe("initEventIndex", () => {
    it("passes ngram config when opening a new index", async () => {
        const mkdir = vi.fn().mockResolvedValue(undefined);
        const deleteContents = vi.fn().mockResolvedValue(undefined);
        const eventIndex = { kind: "index" };
        const Seshat = vi.fn().mockImplementation(() => eventIndex);
        const SeshatRecovery = vi.fn();
        const fixtureValue = "fixture-value";

        class FakeReindexError extends Error {}

        const result = await initEventIndex(eventStorePath, fixtureValue, TokenizerMode.Ngram, {
            mkdir,
            deleteContents,
            createSeshat: Seshat,
            createSeshatRecovery: SeshatRecovery,
            isReindexError: (error) => error instanceof FakeReindexError,
        });

        expect(mkdir).toHaveBeenCalledWith(eventStorePath, { recursive: true });
        expect(Seshat).toHaveBeenCalledWith(eventStorePath, {
            passphrase: fixtureValue,
            tokenizerMode: TokenizerMode.Ngram,
            ngramMinSize: 2,
            ngramMaxSize: 4,
        });
        expect(SeshatRecovery).not.toHaveBeenCalled();
        expect(result).toEqual({ eventIndex });
    });

    it("passes tokenizer config through the reindex recovery path", async () => {
        const mkdir = vi.fn().mockResolvedValue(undefined);
        const deleteContents = vi.fn().mockResolvedValue(undefined);
        const reopenedIndex = { kind: "reopened-index" };
        const fixtureValue = "fixture-value";
        const recoveryIndex = {
            getUserVersion: vi.fn().mockResolvedValue(1),
            shutdown: vi.fn().mockResolvedValue(undefined),
            reindex: vi.fn().mockResolvedValue(undefined),
        };

        class FakeReindexError extends Error {}

        const Seshat = vi
            .fn()
            .mockImplementationOnce(() => {
                throw new FakeReindexError("schema changed");
            })
            .mockImplementationOnce(() => reopenedIndex);
        const SeshatRecovery = vi.fn().mockImplementation(() => recoveryIndex);

        const result = await initEventIndex(eventStorePath, fixtureValue, TokenizerMode.Language, {
            mkdir,
            deleteContents,
            createSeshat: Seshat,
            createSeshatRecovery: SeshatRecovery,
            isReindexError: (error) => error instanceof FakeReindexError,
        });

        expect(SeshatRecovery).toHaveBeenCalledWith(eventStorePath, {
            passphrase: fixtureValue,
            tokenizerMode: TokenizerMode.Language,
        });
        expect(recoveryIndex.reindex).toHaveBeenCalledOnce();
        expect(Seshat).toHaveBeenNthCalledWith(2, eventStorePath, {
            passphrase: fixtureValue,
            tokenizerMode: TokenizerMode.Language,
        });
        expect(deleteContents).not.toHaveBeenCalled();
        expect(result).toEqual({ eventIndex: reopenedIndex });
    });

    it("propagates non-reindex errors without deleting the database", async () => {
        const mkdir = vi.fn().mockResolvedValue(undefined);
        const deleteContents = vi.fn().mockResolvedValue(undefined);
        const fixtureValue = "fixture-value";
        const openError = new Error("filesystem lock");

        class FakeReindexError extends Error {}

        const Seshat = vi.fn().mockImplementationOnce(() => {
            throw openError;
        });
        const SeshatRecovery = vi.fn();

        await expect(
            initEventIndex(eventStorePath, fixtureValue, TokenizerMode.Ngram, {
                mkdir,
                deleteContents,
                createSeshat: Seshat,
                createSeshatRecovery: SeshatRecovery,
                isReindexError: (error) => error instanceof FakeReindexError,
            }),
        ).rejects.toThrow("filesystem lock");

        expect(deleteContents).not.toHaveBeenCalled();
        expect(SeshatRecovery).not.toHaveBeenCalled();
    });
});
