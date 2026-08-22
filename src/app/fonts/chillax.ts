import localFont from "next/font/local";

export const chillaxExtralight = localFont({
  src: "./Chillax/Chillax-Extralight.otf",
  variable: "--font-chillax-extralight",
  weight: "200",
});

export const chillaxLight = localFont({
  src: "./Chillax/Chillax-Light.otf",
  variable: "--font-chillax-light",
  weight: "300",
});

export const chillaxRegular = localFont({
  src: "./Chillax/Chillax-Regular.otf",
  variable: "--font-chillax-regular",
  weight: "400",
});

export const chillaxMedium = localFont({
  src: "./Chillax/Chillax-Medium.otf",
  variable: "--font-chillax-medium",
  weight: "500",
});

export const chillaxSemibold = localFont({
  src: "./Chillax/Chillax-Semibold.otf",
  variable: "--font-chillax-semibold",
  weight: "600",
});

export const chillaxBold = localFont({
  src: "./Chillax/Chillax-Bold.otf",
  variable: "--font-chillax-bold",
  weight: "700",
});

export const chillaxVariables = [
  chillaxExtralight.variable,
  chillaxLight.variable,
  chillaxRegular.variable,
  chillaxMedium.variable,
  chillaxSemibold.variable,
  chillaxBold.variable,
].join(" ");
