import { getHttpUriForMxc } from "../../src/content-repo";

describe("ContentRepo", function() {
    const baseUrl = "https://my.home.server";

    describe("getHttpUriForMxc", function() {
        it("should do nothing to HTTP URLs when allowing direct links", function() {
            const httpUrl = "http://example.com/image.jpeg";
            expect(
                getHttpUriForMxc(
                    baseUrl, httpUrl, undefined, undefined, undefined, true,
                ),
            ).toEqual(httpUrl);
        });

        it("should return the empty string HTTP URLs by default", function() {
            const httpUrl = "http://example.com/image.jpeg";
            expect(getHttpUriForMxc(baseUrl, httpUrl)).toEqual("");
        });

        it("should return a download URL if no width/height/resize are specified",
        function() {
            const mxcUri = "mxc://server.name/resourceid";
            expect(getHttpUriForMxc(baseUrl, mxcUri)).toEqual(
                baseUrl + "/_matrix/media/r0/download/server.name/resourceid",
            );
        });

        it("should return the empty string for null input", function() {
            expect(getHttpUriForMxc(null)).toEqual("");
        });

        it("should return a thumbnail URL if a width/height/resize is specified",
        function() {
            const mxcUri = "mxc://server.name/resourceid";
            expect(getHttpUriForMxc(baseUrl, mxcUri, 32, 64, "crop")).toEqual(
                baseUrl + "/_matrix/media/r0/thumbnail/server.name/resourceid" +
                "?width=32&height=64&method=crop",
            );
        });

        it("should put fragments from mxc:// URIs after any query parameters",
        function() {
            const mxcUri = "mxc://server.name/resourceid#automade";
            expect(getHttpUriForMxc(baseUrl, mxcUri, 32)).toEqual(
                baseUrl + "/_matrix/media/r0/thumbnail/server.name/resourceid" +
                "?width=32#automade",
            );
        });

        it("should put fragments from mxc:// URIs at the end of the HTTP URI",
        function() {
            const mxcUri = "mxc://server.name/resourceid#automade";
            expect(getHttpUriForMxc(baseUrl, mxcUri)).toEqual(
                baseUrl + "/_matrix/media/r0/download/server.name/resourceid#automade",
            );
        });
    });
});
