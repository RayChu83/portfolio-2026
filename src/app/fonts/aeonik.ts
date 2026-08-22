import localFont from "next/font/local";

export const aeonikThin = localFont({
  src: "./Aeonik/AeonikProTRIAL-Thin.otf",
  variable: "--font-aeonik-thin",
  weight: "100",
});

export const aeonikAir = localFont({
  src: "./Aeonik/AeonikProTRIAL-Air.otf",
  variable: "--font-aeonik-air",
  weight: "200",
});

export const aeonikLight = localFont({
  src: "./Aeonik/AeonikProTRIAL-Light.otf",
  variable: "--font-aeonik-light",
  weight: "300",
});

export const aeonikRegular = localFont({
  src: "./Aeonik/AeonikProTRIAL-Regular.otf",
  variable: "--font-aeonik-regular",
  weight: "400",
});

export const aeonikMedium = localFont({
  src: "./Aeonik/AeonikProTRIAL-Medium.otf",
  variable: "--font-aeonik-medium",
  weight: "500",
});

export const aeonikSemiBold = localFont({
  src: "./Aeonik/AeonikProTRIAL-SemiBold.otf",
  variable: "--font-aeonik-semibold",
  weight: "600",
});

export const aeonikBold = localFont({
  src: "./Aeonik/AeonikProTRIAL-Bold.otf",
  variable: "--font-aeonik-bold",
  weight: "700",
});

export const aeonikBlack = localFont({
  src: "./Aeonik/AeonikProTRIAL-Black.otf",
  variable: "--font-aeonik-black",
  weight: "900",
});

export const aeonikVariables = [
  aeonikThin.variable,
  aeonikAir.variable,
  aeonikLight.variable,
  aeonikRegular.variable,
  aeonikMedium.variable,
  aeonikSemiBold.variable,
  aeonikBold.variable,
  aeonikBlack.variable,
].join(" ");
