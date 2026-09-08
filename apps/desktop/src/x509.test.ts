/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { X509Certificate } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

import { getConfig } from "./config.js";

vi.mock("./config.js");
vi.mock("electron", () => ({
    ipcMain: { on: vi.fn(), once: vi.fn() },
}));

/**
 * A root CA, an intermediate CA it signed, and two leaves it signed. Generated with `__fixtures__/x509/generate.sh`.
 */
const [rootPem, intermediatePem, leafPem, otherLeafPem] = await Promise.all(
    ["root-ca", "intermediate-ca", "alice", "bob"].map(async (name) =>
        new X509Certificate(
            await readFile(path.join(import.meta.dirname, "__fixtures__", "x509", `${name}.pem`)),
        ).toString(),
    ),
);

describe("getUserCertificate", () => {
    let dir: string;
    let getUserCertificate: typeof import("./x509.js").getUserCertificate;

    beforeEach(async () => {
        vi.resetModules();
        dir = await mkdtemp(path.join(tmpdir(), "x509-test-"));
        vi.mocked(getConfig).mockReturnValue({ x509: { library_path: "unused", certs_path: dir } } as any);
        ({ getUserCertificate } = await import("./x509.js"));
    });

    it("returns the single non-CA certificate and its chain", async () => {
        await writeFile(path.join(dir, "root.pem"), rootPem);
        await writeFile(path.join(dir, "intermediate.pem"), intermediatePem);
        await writeFile(path.join(dir, "leaf.pem"), leafPem);

        const result = await getUserCertificate();
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.data.certificate.subject).toContain("CN=alice");
        expect(result.data.certificate.validTo).toBeInstanceOf(Date);
        // Leaf then intermediate; the self-signed root is excluded.
        expect(result.data.chain).toBe(leafPem + intermediatePem);
        // The trust anchors, by contrast, are every CA including the root, and never the leaf.
        expect(result.data.caCertsPem).toContain(rootPem);
        expect(result.data.caCertsPem).toContain(intermediatePem);
        expect(result.data.caCertsPem).not.toContain(leafPem);
    });

    it("reports no trust anchors when the directory holds only a leaf", async () => {
        await writeFile(path.join(dir, "leaf.pem"), leafPem);

        const result = await getUserCertificate();
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.data.caCertsPem).toBe("");
    });

    it("ignores files that are not certificates", async () => {
        await writeFile(path.join(dir, "leaf.pem"), leafPem);
        await writeFile(path.join(dir, "notes.txt"), "not a certificate");
        // A private key sharing the directory has a .pem extension but will not parse.
        await writeFile(path.join(dir, "key.pem"), "-----BEGIN PRIVATE KEY-----\nnope\n-----END PRIVATE KEY-----\n");

        const result = await getUserCertificate();
        expect(result.ok).toBe(true);
    });

    it("fails when the directory holds no leaf", async () => {
        await writeFile(path.join(dir, "root.pem"), rootPem);

        const result = await getUserCertificate();
        expect(result).toMatchObject({ ok: false, error: { code: "CERTIFICATE_NOT_FOUND" } });
    });

    it("fails when the directory holds more than one leaf", async () => {
        await writeFile(path.join(dir, "leaf.pem"), leafPem);
        await writeFile(path.join(dir, "other.pem"), otherLeafPem);

        const result = await getUserCertificate();
        expect(result).toMatchObject({ ok: false, error: { code: "CERTIFICATE_AMBIGUOUS" } });
    });

    it("fails when no certificate directory is configured", async () => {
        vi.mocked(getConfig).mockReturnValue({ x509: { library_path: "unused" } } as any);

        const result = await getUserCertificate();
        expect(result).toMatchObject({ ok: false, error: { code: "CERTIFICATE_NOT_FOUND" } });
    });
});
