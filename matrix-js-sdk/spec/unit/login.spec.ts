import fetchMock from "fetch-mock-jest";

import { ClientPrefix, MatrixClient } from "../../src";
import { SSOAction } from "../../src/@types/auth";
import { TestClient } from "../TestClient";

function createExampleMatrixClient(): MatrixClient {
    return new MatrixClient({
        baseUrl: "https://example.com",
    });
}

describe("Login request", function () {
    let client: TestClient;

    beforeEach(function () {
        client = new TestClient();
    });

    afterEach(function () {
        client.stop();
    });

    it('should store "access_token" and "user_id" if in response', async function () {
        const response = { user_id: 1, access_token: Date.now().toString(16) };

        client.httpBackend.when("POST", "/login").respond(200, response);
        client.httpBackend.flush("/login", 1, 100);
        await client.client.login("m.login.any", { user: "test", password: "12312za" });

        expect(client.client.getAccessToken()).toBe(response.access_token);
        expect(client.client.getUserId()).toBe(response.user_id);
    });
});

describe("SSO login URL", function () {
    let client: TestClient;

    beforeEach(function () {
        client = new TestClient();
    });

    afterEach(function () {
        client.stop();
    });

    describe("SSOAction", function () {
        const redirectUri = "https://test.com/foo";

        it("No action", function () {
            const urlString = client.client.getSsoLoginUrl(redirectUri, undefined, undefined, undefined);
            const url = new URL(urlString);
            expect(url.searchParams.has("org.matrix.msc3824.action")).toBe(false);
        });

        it("register", function () {
            const urlString = client.client.getSsoLoginUrl(redirectUri, undefined, undefined, SSOAction.REGISTER);
            const url = new URL(urlString);
            expect(url.searchParams.get("org.matrix.msc3824.action")).toEqual("register");
        });

        it("login", function () {
            const urlString = client.client.getSsoLoginUrl(redirectUri, undefined, undefined, SSOAction.LOGIN);
            const url = new URL(urlString);
            expect(url.searchParams.get("org.matrix.msc3824.action")).toEqual("login");
        });
    });
});

describe("refreshToken", () => {
    afterEach(() => {
        fetchMock.mockReset();
    });

    it("requests the correctly-prefixed /refresh endpoint when server correctly accepts /v3", async () => {
        const client = createExampleMatrixClient();

        const response = {
            access_token: "access_token",
            refresh_token: "refresh_token",
            expires_in_ms: 30000,
        };

        fetchMock.postOnce(client.http.getUrl("/refresh", undefined, ClientPrefix.V3).toString(), response);
        fetchMock.postOnce(client.http.getUrl("/refresh", undefined, ClientPrefix.V1).toString(), () => {
            throw new Error("/v1/refresh unexpectedly called");
        });

        const refreshResult = await client.refreshToken("initial_refresh_token");
        expect(refreshResult).toEqual(response);
    });

    it("falls back to /v1 when server does not recognized /v3 refresh", async () => {
        const client = createExampleMatrixClient();

        const response = {
            access_token: "access_token",
            refresh_token: "refresh_token",
            expires_in_ms: 30000,
        };

        fetchMock.postOnce(client.http.getUrl("/refresh", undefined, ClientPrefix.V3).toString(), {
            status: 400,
            body: { errcode: "M_UNRECOGNIZED" },
        });
        fetchMock.postOnce(client.http.getUrl("/refresh", undefined, ClientPrefix.V1).toString(), response);

        const refreshResult = await client.refreshToken("initial_refresh_token");
        expect(refreshResult).toEqual(response);
    });

    it("re-raises M_UNRECOGNIZED exceptions from /v1", async () => {
        const client = createExampleMatrixClient();

        fetchMock.postOnce(client.http.getUrl("/refresh", undefined, ClientPrefix.V3).toString(), {
            status: 400,
            body: { errcode: "M_UNRECOGNIZED" },
        });
        fetchMock.postOnce(client.http.getUrl("/refresh", undefined, ClientPrefix.V1).toString(), {
            status: 400,
            body: { errcode: "M_UNRECOGNIZED" },
        });

        expect(client.refreshToken("initial_refresh_token")).rejects.toMatchObject({ errcode: "M_UNRECOGNIZED" });
    });

    it("re-raises non-M_UNRECOGNIZED exceptions from /v3", async () => {
        const client = createExampleMatrixClient();

        fetchMock.postOnce(client.http.getUrl("/refresh", undefined, ClientPrefix.V3).toString(), 429);
        fetchMock.postOnce(client.http.getUrl("/refresh", undefined, ClientPrefix.V1).toString(), () => {
            throw new Error("/v1/refresh unexpectedly called");
        });

        expect(client.refreshToken("initial_refresh_token")).rejects.toMatchObject({ httpStatus: 429 });
    });

    it("re-raises non-M_UNRECOGNIZED exceptions from /v1", async () => {
        const client = createExampleMatrixClient();

        fetchMock.postOnce(client.http.getUrl("/refresh", undefined, ClientPrefix.V3).toString(), {
            status: 400,
            body: { errcode: "M_UNRECOGNIZED" },
        });
        fetchMock.postOnce(client.http.getUrl("/refresh", undefined, ClientPrefix.V1).toString(), 429);

        expect(client.refreshToken("initial_refresh_token")).rejects.toMatchObject({ httpStatus: 429 });
    });
});
