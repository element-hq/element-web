/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// heic-decode: decode a HEIC/HEIF image to JPEG using the macOS Image I/O framework (Apple's
// licensed HEVC decoder). Reads the HEIC bytes from stdin, writes JPEG bytes to stdout. All
// in-memory — no temp files — so it is safe for end-to-end-encrypted media.
//
// Element Desktop spawns this from its main process (see src/heic.ts) instead of bundling a
// copyleft WASM decoder (libheif/heic-to) on macOS, where the OS decoder is always present and
// the HEVC patent royalty is already covered by the platform vendor.
//
// Exit codes: 0 ok; 1 empty/failed input; 2 no image source; 3 decode failed; 4/5 encode failed.

#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#import <CoreGraphics/CoreGraphics.h>

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSData *input = [[NSFileHandle fileHandleWithStandardInput] readDataToEndOfFile];
        if (input.length == 0) {
            fprintf(stderr, "heic-decode: empty input\n");
            return 1;
        }

        CGImageSourceRef source = CGImageSourceCreateWithData((__bridge CFDataRef)input, NULL);
        if (!source) {
            fprintf(stderr, "heic-decode: could not create image source\n");
            return 2;
        }

        // Decode the primary image with the EXIF orientation baked in. Using the thumbnail API with
        // CreateThumbnailFromImageAlways + WithTransform lets Image I/O apply the correct orientation for
        // us (rather than hand-rolling the eight EXIF transforms). MaxPixelSize caps the longer edge: at
        // 20000px it passes any normal phone photo through untouched, and only downscales images larger
        // than that (e.g. wide panoramas) — an acceptable bound for an inline display copy, since the
        // original bytes are always preserved for download.
        NSDictionary *options = @{
            (id)kCGImageSourceCreateThumbnailFromImageAlways: @YES,
            (id)kCGImageSourceCreateThumbnailWithTransform: @YES,
            (id)kCGImageSourceThumbnailMaxPixelSize: @20000,
        };
        CGImageRef image = CGImageSourceCreateThumbnailAtIndex(source, 0, (__bridge CFDictionaryRef)options);
        CFRelease(source);
        if (!image) {
            fprintf(stderr, "heic-decode: could not decode image\n");
            return 3;
        }

        NSMutableData *output = [NSMutableData data];
        CGImageDestinationRef dest =
            CGImageDestinationCreateWithData((__bridge CFMutableDataRef)output, CFSTR("public.jpeg"), 1, NULL);
        if (!dest) {
            CGImageRelease(image);
            fprintf(stderr, "heic-decode: could not create image destination\n");
            return 4;
        }
        NSDictionary *destProps = @{ (id)kCGImageDestinationLossyCompressionQuality: @0.92 };
        CGImageDestinationAddImage(dest, image, (__bridge CFDictionaryRef)destProps);
        bool ok = CGImageDestinationFinalize(dest);
        CFRelease(dest);
        CGImageRelease(image);
        if (!ok) {
            fprintf(stderr, "heic-decode: JPEG encode failed\n");
            return 5;
        }

        [[NSFileHandle fileHandleWithStandardOutput] writeData:output];
        return 0;
    }
}
