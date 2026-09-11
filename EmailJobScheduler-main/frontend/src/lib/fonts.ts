import { Silkscreen } from "next/font/google";

// Pixelated/8-bit wordmark font, per the Figma design — used for the "ONB"
// sidebar wordmark only, not the rest of the UI.
export const silkscreen = Silkscreen({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
