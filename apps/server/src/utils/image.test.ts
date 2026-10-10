import { describe, expect, it } from "vitest";
import { detectImageType } from "./image";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);

describe("detectImageType", () => {
    it("recognises PNG, JPEG and WebP by their bytes", () => {
        expect(detectImageType(png)).toBe("image/png");
        expect(detectImageType(jpeg)).toBe("image/jpeg");
        expect(detectImageType(webp)).toBe("image/webp");
    });

    it("rejects SVG, HTML and scripts even if they claim to be images", () => {
        expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
        expect(detectImageType(Buffer.from("<html><body>hi</body></html>"))).toBeNull();
        expect(detectImageType(Buffer.from("GIF89a"))).toBeNull();
    });

    it("rejects truncated and empty input", () => {
        expect(detectImageType(Buffer.alloc(0))).toBeNull();
        expect(detectImageType(png.subarray(0, 4))).toBeNull();
        expect(detectImageType(Buffer.from("RIFF"))).toBeNull();
    });

    it("rejects a RIFF container that is not WebP (e.g. WAV)", () => {
        expect(detectImageType(Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 0, 0, 0]), Buffer.from("WAVEfmt ")]))).toBeNull();
    });
});
